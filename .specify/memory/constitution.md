# Ants Platform JS/TS SDK Constitution

> The JS/TS client SDK for the Agentic Ants platform (npm `ants-platform` + `@antsplatform/*`). The canonical cross-repo constitution lives in `agentic-ants-lf-fork/.specify/memory/constitution.md`. This document adapts the shared principles to the JS SDK monorepo. SDK versioning is per-repo and independent of the backend; all sub-packages lockstep on one version.

## Core Principles

### I. Own What You Ship

This SDK runs inside customers' production code across Node and browser runtimes.

- MUST understand every change before merging, including AI-generated code
- MUST NOT merge AI output without verifying logic, types, and dual ESM/CJS output behavior

### II. Test-First (NON-NEGOTIABLE)

- MUST add Vitest unit tests for new behavior (`pnpm test`)
- MUST add integration/e2e coverage where the change crosses the HTTP boundary (`pnpm test:integration`, `pnpm test:e2e`)
- MUST add a regression test for every bug fix
- Workspace tests run against built `dist`, not TS source — MUST `pnpm build` (or `--filter <pkg> build`) before running integration/e2e

### III. Generated Code Is Sacred

- `@antsplatform/client` is **Fern-generated** from the backend OpenAPI spec — MUST NOT hand-edit generated client files
- API changes start in `agentic-ants-lf-fork/fern/`, regenerate, then land here
- Hand-written packages (`core`, `tracing`, `otel`, `guardrails`, integrations) are owned here

### IV. No Dead Weight

- MUST NOT leave unused exports, dead packages, or orphaned files — `pnpm lint` must be clean
- MUST NOT leave `// TODO` without a tracked ticket
- Removing an export from any `@antsplatform/*` public surface is a breaking change — treat accordingly

### V. Quality Gates Are Mandatory

Every change MUST pass before merge:

- `pnpm lint` (ESLint)
- `pnpm typecheck` (type safety first)
- `pnpm test` + relevant integration/e2e
- `pnpm format:check`
- `pnpm ci` runs the full gate — use it before pushing

### VI. Backward Compatibility and Documentation

- MUST follow SemVer; all sub-packages release in lockstep at one version
- Breaking public-API changes require a MAJOR bump + deprecation window — never silently break consumers on a backend deploy
- MUST update TSDoc (surfaced via TypeDoc), `CHANGELOG.md`, and `SDK_CHANGES.md` for public-API changes

## Governance

- Edits, builds, tests, lint, typecheck — no approval needed
- `git commit/push`, `pnpm release*` (publishes to npm; OTP via 1Password) — require explicit approval
- Amendments: PR + reviewer + rationale. Semantic versioning of this document

**Version**: 1.0.0 | **Ratified**: 2026-06-03 | **Last Amended**: 2026-06-03
