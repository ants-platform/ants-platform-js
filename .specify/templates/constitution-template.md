# [PROJECT_NAME] Constitution

<!-- The JS/TS SDK constitution. Mirror the live copy in .specify/memory/constitution.md. -->

> [ONE_LINE_SCOPE]

<!-- e.g. The JS/TS client SDK for the Agentic Ants platform (npm `ants-platform` + `@antsplatform/*`). SDK versioning is per-repo; all sub-packages lockstep on one version. -->

## Core Principles

### I. Own What You Ship

[OWNERSHIP_RULES]

<!-- This SDK runs inside customers' production code (Node + browser). MUST understand every change before merge, incl. AI-generated code; MUST NOT merge unverified logic/types/dual ESM-CJS behavior. -->

### II. Test-First (NON-NEGOTIABLE)

[TEST_FIRST_RULES]

<!-- MUST add Vitest unit tests for new behavior; integration/e2e where the change crosses the HTTP boundary; a regression test per bug fix. Workspace tests run against built dist — MUST `pnpm build` before integration/e2e. -->

### III. Generated Code Is Sacred

[GENERATED_CODE_RULES]

<!-- @antsplatform/client is Fern-generated — MUST NOT hand-edit. API changes start in agentic-ants-lf-fork/fern/, regenerate, then land here. Hand-written packages (core, tracing, otel, guardrails, integrations) are owned here. -->

### IV. No Dead Weight

[NO_DEAD_WEIGHT_RULES]

<!-- MUST NOT leave unused exports, dead packages, orphaned files — `pnpm lint` must be clean. No `// TODO` without a tracked ticket. Removing a public export is a breaking change. -->

### V. Quality Gates Are Mandatory

[QUALITY_GATE_RULES]

<!-- Every change MUST pass before merge: `pnpm lint`, `pnpm typecheck`, `pnpm test` + relevant integration/e2e, `pnpm format:check`. `pnpm ci` runs the full gate. -->

### VI. Backward Compatibility and Documentation

[COMPAT_AND_DOCS_RULES]

<!-- MUST follow SemVer; sub-packages release in lockstep at one version. Breaking public-API changes need a MAJOR bump + deprecation window. MUST update TSDoc, CHANGELOG.md, SDK_CHANGES.md for public-API changes. -->

## Governance

[GOVERNANCE_RULES]

<!-- Edits/builds/tests/lint/typecheck need no approval; git commit/push and `pnpm release*` (publishes to npm, OTP via 1Password) require explicit approval. Amendments: PR + reviewer + rationale; semantic versioning of this document. -->

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]

<!-- e.g. Version: 1.0.0 | Ratified: 2026-06-03 | Last Amended: 2026-06-03 -->
