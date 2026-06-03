# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (strict), Node 20+ runtime; universal-JS packages also target browser + edge

**Primary Dependencies**: pnpm + Turbo monorepo, tsup (ESM + CJS dual output), Vitest. `@antsplatform/client` is Fern-generated from the backend OpenAPI spec (`agentic-ants-lf-fork/fern/`). `tracing`/`otel` use `@opentelemetry/sdk-node` (Node 20+ only)

**Storage**: N/A (stateless client SDK; talks to `api.agenticants.ai`)

**Testing**: Vitest — unit (`pnpm test`), integration (`pnpm test:integration`), e2e (`pnpm test:e2e`). Integration/e2e run against built `dist`, so `pnpm build` first

**Target Platform**: [which package(s) — universal (`core`, `client`, `guardrails`, `openai`, `langchain`) vs Node-20+-only (`tracing`, `otel`)]

**Project Type**: TypeScript client SDK (multi-package monorepo, lockstep SemVer)

**Performance Goals**: [domain-specific, e.g., minimal cold-start overhead, tree-shakeable exports, or N/A]

**Constraints**: ESM + CJS dual output per package (`index.mjs` + `index.cjs` + `index.d.ts`); no Node-only imports in universal bundles; backend REST contract changes require synchronized java/python/javascript SDK release

**Scale/Scope**: [which `@antsplatform/*` package(s) touched; new sub-export vs change to existing public surface]

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [ ] **Test-First**: Vitest unit tests planned for new behavior; integration/e2e planned where the change crosses the HTTP boundary; regression test planned for each bug fix. `pnpm build` precedes integration/e2e (workspace tests run against `dist`).
- [ ] **Generated Code Is Sacred**: No hand-edits to `@antsplatform/client` (Fern-generated). Any REST contract change originates in `agentic-ants-lf-fork/fern/` and is regenerated, not patched here.
- [ ] **Quality Gates**: Plan accounts for `pnpm lint`, `pnpm typecheck`, and `pnpm format` all clean (`pnpm ci` green before push).
- [ ] **Backward Compatibility**: Change is SemVer-classified; sub-packages stay lockstep at one version; breaking public-API changes carry a MAJOR bump + deprecation window; TSDoc/CHANGELOG/SDK_CHANGES updated.
- [ ] **No Dead Weight**: No unused/dead exports introduced; removed public exports are flagged as breaking.

_Document any justified deviation in Complexity Tracking below._

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Identify which package(s) this feature touches and list the
  concrete files. The monorepo layout is fixed; do not invent new top-level dirs.
  @antsplatform/client is Fern-generated and OFF-LIMITS for hand edits.
-->

```text
src/index.ts                      # Root meta-package (ants-platform) re-exports
packages/
  core/        src/  dist/        # @antsplatform/core   — shared utils, types, base classes (universal)
  client/      src/  dist/        # @antsplatform/client — REST client, Fern-GENERATED (do NOT hand-edit)
  tracing/     src/  dist/        # @antsplatform/tracing — OTel primitives (Node 20+ only)
  otel/        src/  dist/        # @antsplatform/otel    — OTel export helpers (Node 20+ only)
  guardrails/  src/  dist/        # @antsplatform/guardrails (universal)
  openai/      src/  dist/        # @antsplatform/openai  — OpenAI integration (universal)
  langchain/   src/  dist/        # @antsplatform/langchain — LangChain integration (universal)
tests/
  integration/ *.test.ts          # Vitest: built dist + mocked HTTP
  e2e/         *.test.ts          # Vitest: real HTTP, longer timeouts
tsup.config.ts                    # Root build config
vitest.workspace.ts               # Multi-project test setup, dist-aliased imports
```

**Structure Decision**: [Name the package(s) edited (hand-written vs generated `client`), the new/changed files under `packages/<pkg>/src/`, and the test files under `tests/integration` / `tests/e2e`. Note any new sub-export and whether it affects the universal vs Node-only boundary.]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
