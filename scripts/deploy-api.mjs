#!/usr/bin/env node
// API 배포: 소스를 묶어 S3에 올리고 → CodeBuild가 Docker 이미지를 만들어 ECR에 올리고 → ECS 서비스를 새 이미지로 바꾼다.
// 로컬에 Docker가 없어도 된다. AWS CLI와 893918474407 계정 자격 증명이 필요하다.
// 로컬은 AWS_PROFILE(기본 default), GitHub Actions는 OIDC로 받은 임시 자격 증명을 쓴다 (.github/workflows/deploy-api.yml).
//
//   pnpm deploy:api              빌드 + 배포
//   pnpm deploy:api --build-only 이미지만 만든다 (ECS는 그대로)
//
// DB 마이그레이션은 배포에 넣지 않는다. SQL을 검토한 뒤 `pnpm db:migrate`로 먼저 적용한다.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REGION = "ap-northeast-2";
const PROFILE = process.env.AWS_PROFILE ?? (process.env.GITHUB_ACTIONS ? null : "default");
const profileArgs = PROFILE ? ["--profile", PROFILE] : [];
const BUILD_BUCKET = "zipazum-build-893918474407";
const PROJECT = "zipazum-api-build";
const CLUSTER = "zipazum";
const SERVICE = "zipazum-api";
const buildOnly = process.argv.includes("--build-only");

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const aws = (...args) => execFileSync("aws", [...args, "--region", REGION, ...profileArgs, "--output", "json"], { encoding: "utf8" });
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const step = (text) => console.log(`\n▶ ${text}`);

// 1) 이미지에 필요한 파일만 묶는다 (git이 무시하는 .env·node_modules·dist는 빠진다)
step("소스 묶기");
const INCLUDE = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc", "packages/shared/", "apps/api/"];
const files = git("ls-files", "-co", "--exclude-standard")
  .split("\n")
  .filter((f) => INCLUDE.some((p) => f === p || f.startsWith(p)))
  .filter((f) => !/(^|\/)\.env(?!\.example)/.test(f))
  .filter((f) => existsSync(join(root, f)));
const dirty = git("status", "--porcelain").length > 0;
const imageTag = `${git("rev-parse", "--short", "HEAD")}${dirty ? "-dirty" : ""}-${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12)}`;
const work = mkdtempSync(join(tmpdir(), "zipazum-deploy-"));
const list = join(work, "files.txt");
const archive = join(work, "src.tgz");
writeFileSync(list, files.join("\n"));
// 압축 파일 경로를 상대 경로로 넘긴다 (GNU tar는 "C:\..."를 원격 호스트로 읽는다)
execFileSync("tar", ["-czf", "src.tgz", "-C", root, "-T", list], { cwd: work });
console.log(`  ${files.length}개 파일, 이미지 태그 ${imageTag}`);

// 2) S3에 올리고 CodeBuild 시작
step("CodeBuild로 이미지 빌드");
const sourceKey = `api/${imageTag}.tgz`;
aws("s3", "cp", archive, `s3://${BUILD_BUCKET}/${sourceKey}`);
rmSync(work, { recursive: true, force: true });
const { build } = JSON.parse(
  aws("codebuild", "start-build", "--project-name", PROJECT, "--environment-variables-override",
    `name=SOURCE_KEY,value=${sourceKey},type=PLAINTEXT`, `name=IMAGE_TAG,value=${imageTag},type=PLAINTEXT`),
);
let phase = "";
for (;;) {
  const [b] = JSON.parse(aws("codebuild", "batch-get-builds", "--ids", build.id)).builds;
  if (b.currentPhase !== phase) console.log(`  ${(phase = b.currentPhase)}`);
  if (b.buildComplete) {
    if (b.buildStatus !== "SUCCEEDED") {
      console.error(`\n빌드 실패 (${b.buildStatus}). 로그: https://${REGION}.console.aws.amazon.com/codesuite/codebuild/projects/${PROJECT}/build/${encodeURIComponent(build.id)}/log`);
      process.exit(1);
    }
    break;
  }
  await new Promise((r) => setTimeout(r, 10_000));
}
console.log(`  이미지: zipazum-api:${imageTag} (latest)`);
if (buildOnly) process.exit(0);

// 3) ECS 서비스를 새 이미지(latest)로 다시 띄우고 안정될 때까지 기다린다
step("ECS 배포");
aws("ecs", "update-service", "--cluster", CLUSTER, "--service", SERVICE, "--force-new-deployment");
const wait = spawnSync("aws", ["ecs", "wait", "services-stable", "--cluster", CLUSTER, "--services", SERVICE, "--region", REGION, ...profileArgs], { stdio: "inherit" });
if (wait.status !== 0) {
  console.error("서비스가 안정되지 않았어요. CloudWatch 로그 /ecs/zipazum-api를 확인하세요.");
  process.exit(1);
}
console.log("\n✔ 배포 완료");
