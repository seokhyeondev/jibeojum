#!/usr/bin/env node
// SSM Parameter Store의 비밀값을 apps/api/.env.local에 채운다. AWS CLI와 893918474407 계정 자격 증명이 필요하다.
// 프로필은 AWS_PROFILE(기본 default). 다른 계정이면 아무것도 쓰지 않고 멈춘다.
//
//   pnpm env:pull                    /zipazum/dev/* 만 읽는다
//   pnpm env:pull --from prod,dev    prod를 먼저 읽고 dev 값으로 덮는다 (dev에 없는 값만 운영 값을 쓴다)
//
// .env.local에서 표시된 구역만 다시 쓴다. 구역 밖에 값이 있는 키는 로컬 값을 그대로 두고 구역에 넣지 않는다.
// 값은 화면에 출력하지 않는다.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";

const ACCOUNT = "893918474407";
const REGION = "ap-northeast-2";
const PROFILE = process.env.AWS_PROFILE ?? "default";
const STAGES = ["dev", "prod"];
const BEGIN = "# >>> pnpm env:pull";
const END = "# <<< pnpm env:pull";

const fromIndex = process.argv.indexOf("--from");
const from = fromIndex === -1 ? ["dev"] : (process.argv[fromIndex + 1] ?? "").split(",").filter(Boolean);
if (from.length === 0 || from.some((stage) => !STAGES.includes(stage))) {
  fail(`--from에는 ${STAGES.join(", ")} 중에서 쉼표로 골라 넣는다 (예: --from prod,dev)`);
}

const file = new URL("../.env.local", import.meta.url);
const aws = (...args) =>
  JSON.parse(execFileSync("aws", [...args, "--region", REGION, "--profile", PROFILE, "--output", "json"], { encoding: "utf8" }));

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const account = aws("sts", "get-caller-identity").Account;
if (account !== ACCOUNT) fail(`프로필 ${PROFILE}은 ${account} 계정이다. ${ACCOUNT} 계정 프로필을 AWS_PROFILE로 지정한다`);

// 뒤에 오는 단계가 앞 단계 값을 덮는다
const values = new Map();
for (const stage of from) {
  const path = `/zipazum/${stage}/`;
  const params = aws("ssm", "get-parameters-by-path", "--path", path, "--with-decryption", "--query", "Parameters[].[Name,Value]");
  const keys = [];
  for (const [name, value] of params) {
    const key = name.slice(path.length);
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      console.warn(`  건너뜀: ${name} (환경변수 이름이 아니다)`);
      continue;
    }
    values.set(key, value);
    keys.push(key);
  }
  console.log(`${path}* ${keys.length}개${keys.length ? `: ${keys.sort().join(", ")}` : ""}`);
}
if (values.size === 0) fail("읽은 값이 없다. 파라미터를 만들거나 --from prod,dev로 운영 값을 쓴다");

// 기존 파일에서 우리 구역을 걷어내고, 구역 밖에서 값이 있는 키는 로컬 값으로 남긴다 (.env.example의 자리표시 값은 빼고)
const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
const outside = existing.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`), "").trimEnd();
const example = parse(readFileSync(new URL("../.env.example", import.meta.url), "utf8"));
const kept = Object.entries(parse(outside))
  .filter(([key, value]) => value !== "" && value !== example[key] && values.has(key))
  .map(([key]) => key);
for (const key of kept) values.delete(key);

// dotenv는 따옴표 안의 줄바꿈·#도 그대로 읽는다. 값에 없는 따옴표를 고른다
function quote(key, value) {
  const mark = ["'", "`", '"'].find((q) => !value.includes(q));
  if (!mark) fail(`${key} 값에 ' \` " 가 모두 들어 있어 .env 형식으로 쓸 수 없다`);
  return `${key}=${mark}${value}${mark}`;
}

const lines = [...values].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => quote(key, value));
const block = [`${BEGIN} (${from.map((s) => `/zipazum/${s}`).join(" → ")}). 다시 실행하면 이 구역을 덮어쓴다`, ...lines, END].join("\n");
const content = `${outside ? `${outside}\n\n` : ""}${block}\n`;

// 쓰기 전에 다시 읽어 값이 그대로인지 확인한다
const parsed = parse(content);
for (const [key, value] of values) {
  if (parsed[key] !== value) fail(`${key} 값을 .env 형식으로 옮기지 못했다`);
}

const temp = new URL("../.env.local.tmp", import.meta.url);
writeFileSync(temp, content, { mode: 0o600 });
renameSync(temp, file);

console.log(`✓ apps/api/.env.local에 ${values.size}개를 썼다`);
if (kept.length) console.log(`  로컬 값 유지: ${kept.join(", ")}`);
if (from.includes("prod")) console.log("  ⚠ 운영 값이 들어 있다. 운영 DB·운영 AUTH_SECRET을 쓰게 되니 주의한다");
if (!existing) console.log("  S3_BUCKET, KAKAO_REDIRECT_URI 같은 일반 값은 .env.example을 보고 구역 밖에 직접 채운다");
