// 로컬 개발 서버: tsc로 계속 컴파일하고 결과가 바뀌면 Node가 다시 띄운다.
// Nest CLI 12는 Node 22.14에서 실행되지 않아 tsc를 직접 쓴다. 데코레이터 메타데이터 때문에 tsx/esbuild는 쓰지 않는다.
import { spawn, spawnSync } from "node:child_process";

const tsc = ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"];

const first = spawnSync(process.execPath, tsc, { stdio: "inherit" });
if (first.status !== 0) process.exit(first.status ?? 1);

const children = [
  spawn(process.execPath, [...tsc, "--watch", "--preserveWatchOutput"], { stdio: "inherit" }),
  spawn(process.execPath, ["--watch", "--enable-source-maps", "dist/main.js"], { stdio: "inherit" }),
];
const stop = () => children.forEach((child) => child.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
