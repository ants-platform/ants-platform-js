/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
  entryPoints: [
    "./packages/core",
    "./packages/client",
    "./packages/langchain",
    "./packages/openai",
    "./packages/otel",
    "./packages/tracing",
  ],
  entryPointStrategy: "packages",
  name: "Ants Platform JS/TS SDKs",
  navigationLinks: {
    GitHub: "https://github.com/ants-platform/ants-platform-js",
    Docs: "https://ants-platform.com/docs/sdk/typescript",
  },
};
