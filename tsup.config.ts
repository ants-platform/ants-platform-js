import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2020",
  external: [
    "ants-platform-core",
    "@opentelemetry/api",
    "@langchain/core",
    "openai",
  ],
});
