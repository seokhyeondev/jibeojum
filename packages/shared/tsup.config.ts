import { defineConfig } from "tsup";

// 웹(ESM)과 API(CommonJS)가 함께 쓰므로 두 형식으로 낸다.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
