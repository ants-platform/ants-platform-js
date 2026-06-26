import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: { tsconfig: "./tsconfig.build.json" },
  tsconfig: "./tsconfig.build.json",
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
