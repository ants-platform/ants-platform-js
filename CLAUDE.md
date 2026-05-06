# ants-platform-js — Claude Code orientation

JS/TS SDK for the Agentic Ants platform. Talks to `api.agenticants.ai`. Published on npm as `ants-platform` (root meta-package, currently `1.0.13`) plus seven scoped sub-packages under `@antsplatform/*`. The global `~/.claude/CLAUDE.md` aliases this repo as `ants-platform-javascript`.

pnpm + Turbo monorepo, ESM-first with CJS dual output, built with `tsup`. Vitest for unit + integration + e2e. release-it for publishing.

## Layout

```
src/index.ts                 Root meta-package re-exports.
packages/
  core/                      @antsplatform/core   — shared utils, types, base classes.
  client/                    @antsplatform/client — Universal-JS REST client (Fern-generated).
  tracing/                   @antsplatform/tracing — OTel-based instrumentation primitives. Node 20+.
  otel/                      @antsplatform/otel    — OTel export helpers. Node 20+.
  guardrails/                @antsplatform/guardrails — guardrails / policy enforcement.
  openai/                    @antsplatform/openai  — OpenAI SDK integration.
  langchain/                 @antsplatform/langchain — LangChain integration.
tests/
  integration/               Vitest project: built dist + mocked HTTP.
  e2e/                       Vitest project: real HTTP, longer timeouts (30s).
tsup.config.ts               Root build config.
vitest.workspace.ts          Multi-project test setup with dist-aliased imports.
package.json                 Root meta package; per-package configs in packages/*/package.json.
```

All sub-packages share `version 1.0.13` and lockstep on each release.

## Commands

```sh
pnpm install
pnpm build                  # builds all packages then root meta
pnpm test                   # vitest unit
pnpm test:integration       # builds first, runs tests/integration
pnpm test:e2e               # builds first, runs tests/e2e (real network)
pnpm lint && pnpm typecheck
pnpm format
pnpm ci                     # full CI: build + test + lint + typecheck + format:check
pnpm clean                  # rm dist + tsbuildinfo
pnpm nuke                   # clean + wipe node_modules + reinstall
pnpm release                # publishes all packages, OTP via 1Password CLI
pnpm release:alpha | beta | rc
```

The release scripts pull NPM OTP from 1Password (`op item get "Npmjs" --vault "Engineering-Production" --otp`). Without `op` CLI configured + signed in, releases fail at the OTP fetch.

## Things to know

- **Workspace tests use built dist**, not TS source. After editing a package, `pnpm build` (or at least `pnpm --filter <pkg> build`) before running `test:integration` / `test:e2e`. The aliases in `vitest.workspace.ts` resolve to `packages/*/dist/index.mjs`.
- **`packages/client/`** is largely Fern-generated from the OpenAPI spec in `agentic-ants-lf-fork/fern/`. Regenerate via Fern; copy generated TS into `packages/client/src/`. Hand-written wrappers around the generated client live alongside it — those are fine to edit.
- **Stale README claims**: README still shows `import { AntsPlatformClient } from "antsplatform"` (no dash) and `baseUrl: "https://api.ants-platform.com"`. Correct values are package `ants-platform` (with dash) and `https://api.agenticants.ai`. Don't propagate the README values into code or docstrings.
- **Universal vs Node-only**: `client`, `core`, `guardrails`, `openai`, `langchain` are universal-JS (browser + Node + edge runtimes). `tracing` and `otel` are **Node 20+ only** because they use `@opentelemetry/sdk-node`. Don't import from those two in code intended for the browser bundle.
- **ESM + CJS dual output.** Each sub-package emits `index.mjs` + `index.cjs` + `index.d.ts`. tsup handles this; don't switch a package to ESM-only without coordinating with the others.
- **Backend version contract**: SDK `1.0.x` tracks backend `agentic-ants-lf-fork` `0.1.x`. The `1.0` major in this SDK is inherited from the Langfuse SDK lineage and decoupled from backend versioning. Breaking REST changes in the backend require a synchronized SDK release across java / python / javascript.
- **No Next.js / React-server-component-specific entry points yet.** If adding one, put it behind a sub-export, don't change the main entry — that's how SSR users get tree-shaken.

## Approval boundaries

`pnpm install / build / test / lint / typecheck / format`, file edits — fine. `pnpm release` (publishes to npm — irreversible without unpublish), `git commit/push`, version bumps that ship — ask first.
