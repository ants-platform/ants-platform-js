---
description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: REQUIRED. Test-First is NON-NEGOTIABLE in this SDK. Every story gets Vitest unit tests; add integration/e2e where the change crosses the HTTP boundary; add a regression test for every bug fix. Workspace integration/e2e run against built `dist`, so run `pnpm build` before them.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Hand-written packages**: `packages/<pkg>/src/*.ts` (core, tracing, otel, guardrails, openai, langchain)
- **Generated client**: `packages/client/src/` is Fern-generated and OFF-LIMITS for hand edits — regenerate from `agentic-ants-lf-fork/fern/` instead. Hand-written wrappers alongside it are editable.
- **Root meta-package**: `src/index.ts` re-exports the public surface
- **Tests**: `tests/integration/*.test.ts`, `tests/e2e/*.test.ts`; package-local unit specs live beside source as `packages/<pkg>/src/*.test.ts`
- **Reminder**: `tracing` and `otel` are Node 20+ only — do not add Node-only imports to universal packages

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints/contracts from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Package wiring and build/test scaffolding

- [ ] T001 Confirm target package(s) under packages/<pkg>/ and add any new sub-export entry points
- [ ] T002 Wire new export into packages/<pkg>/src/index.ts and root src/index.ts re-exports
- [ ] T003 [P] Confirm tsup.config.ts emits ESM + CJS + d.ts for the package; verify pnpm lint/typecheck/format baseline is clean

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types/utilities that MUST be complete before ANY user story can be implemented

**[CRITICAL]**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your feature):

- [ ] T004 Define shared types/interfaces in packages/core/src/types.ts
- [ ] T005 [P] Add base error/result classes in packages/core/src/errors.ts
- [ ] T006 [P] If the backend OpenAPI changed: regenerate @antsplatform/client via Fern (do NOT hand-edit generated files)
- [ ] T007 Add hand-written client wrapper(s) in packages/client/src/<wrapper>.ts

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) [MVP]

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (REQUIRED — Test-First)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation. Run `pnpm build` before integration/e2e.**

- [ ] T010 [P] [US1] Unit test for [behavior] in packages/<pkg>/src/[name].test.ts
- [ ] T011 [P] [US1] Integration test (mocked HTTP) for [API call] in tests/integration/[name].test.ts

### Implementation for User Story 1

- [ ] T012 [P] [US1] Implement [function/class] in packages/<pkg>/src/[name].ts
- [ ] T013 [US1] Wire into package public surface in packages/<pkg>/src/index.ts (depends on T012)
- [ ] T014 [US1] Add input validation and typed error handling
- [ ] T015 [US1] Add TSDoc on the new public symbols
- [ ] T016 [US1] pnpm build, then run tests/integration for this story

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (REQUIRED — Test-First)

- [ ] T017 [P] [US2] Unit test for [behavior] in packages/<pkg>/src/[name].test.ts
- [ ] T018 [P] [US2] Integration test (mocked HTTP) for [API call] in tests/integration/[name].test.ts

### Implementation for User Story 2

- [ ] T019 [P] [US2] Implement [function/class] in packages/<pkg>/src/[name].ts
- [ ] T020 [US2] Wire into package public surface in packages/<pkg>/src/index.ts
- [ ] T021 [US2] Integrate with User Story 1 components (if needed)

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (REQUIRED — Test-First)

- [ ] T022 [P] [US3] Unit test for [behavior] in packages/<pkg>/src/[name].test.ts
- [ ] T023 [P] [US3] e2e test (real HTTP) for [end-to-end journey] in tests/e2e/[name].test.ts

### Implementation for User Story 3

- [ ] T024 [P] [US3] Implement [function/class] in packages/<pkg>/src/[name].ts
- [ ] T025 [US3] Wire into package public surface in packages/<pkg>/src/index.ts

**Checkpoint**: All user stories independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Update TSDoc, CHANGELOG.md, and SDK_CHANGES.md for public-API changes
- [ ] TXXX Confirm SemVer classification; keep all sub-packages lockstep at one version; add deprecation notes for any breaking change
- [ ] TXXX Remove dead/unused exports introduced during the feature
- [ ] TXXX [P] Add any missing unit tests in packages/<pkg>/src/\*.test.ts
- [ ] TXXX pnpm build, then pnpm test:integration and pnpm test:e2e
- [ ] TXXX Run pnpm ci (full gate: build + test + lint + typecheck + format:check) before requesting review

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 -> P2 -> P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Test-First, non-negotiable)
- Run `pnpm build` before integration/e2e (workspace tests use built dist)
- Types/utilities before functions, functions before public-surface wiring
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (write first, expect failures):
Task: "Unit test for [behavior] in packages/<pkg>/src/[name].test.ts"
Task: "Integration test (mocked HTTP) for [API call] in tests/integration/[name].test.ts"

# Then implement:
Task: "Implement [function/class] in packages/<pkg>/src/[name].ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: pnpm build, run unit + integration for US1
5. Demo/publish if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Test independently -> Demo (MVP)
3. Add User Story 2 -> Test independently -> Demo
4. Add User Story 3 -> Test independently -> Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests come first and must fail before implementation (Test-First)
- @antsplatform/client is Fern-generated — never hand-edit; regenerate from agentic-ants-lf-fork/fern/
- pnpm build before any integration/e2e run
- Keep sub-packages lockstep at one version; classify SemVer impact before release
- Commit after each task or logical group
- No UTF-8 emojis anywhere
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
