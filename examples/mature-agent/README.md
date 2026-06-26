# Mature agent — end-to-end tracing with `ants-platform`

A realistic **Operations Copilot** that handles a customer support ticket and, in
a **single end-to-end trace**, talks to multiple LLMs, a sub-agent, a database,
an MCP tool, an HTTP integration, a desktop tool, guardrails, and an evaluator.
Every call is instrumented with the `ants-platform` SDK, so the whole run is
recorded as one trace on the Ants Platform backend.

This is a complete, **runnable** project — it makes real calls and exports real
traces (verified below), not mocks.

---

## What the agent does

Given a support ticket (a Berlin customer reporting a slow dashboard during a
storm), the copilot:

1. **Guards the input** — runs the request through a guardrail policy.
2. **Routes** — a fast model classifies the ticket and decides whether weather is
   relevant, emitting a small JSON plan.
3. **Gathers context in parallel** —
   - looks up the customer + past incidents from a **SQLite** database,
   - reads the matching ops **runbook section over MCP**,
   - fetches **current Berlin weather** from a public HTTP API.
4. **Delegates** root-cause analysis to a **researcher sub-agent** (a second,
   independently-traced agent using a stronger reasoning model).
5. **Synthesizes** a customer-facing reply with the reasoning model.
6. **Guards the output** — runs the draft through a guardrail policy.
7. **Evaluates** the draft with an LLM-as-judge (groundedness + helpfulness).
8. **Notifies** the human operator via a **macOS desktop notification**.
9. Emits a **completion event**.

## How the instrumentation works

| Step                   | SDK primitive                                          | Observation type |
| ---------------------- | ------------------------------------------------------ | ---------------- |
| Root agent             | `startActiveObservation('ops-copilot', …)`             | `agent`          |
| Input/output safety    | `AntsGuardrailsClient` + `startActiveObservation`      | `guardrail`      |
| LLM calls (×4)         | `observeOpenAI(...)` (auto-captures model/tokens/cost) | `generation`     |
| DB lookup              | `startActiveObservation`                               | `retriever`      |
| MCP / weather / notify | `startActiveObservation`                               | `tool`           |
| Researcher sub-agent   | `startActiveObservation('agent:researcher', …)`        | `agent`          |
| LLM-as-judge           | `startActiveObservation`                               | `evaluator`      |
| Completion marker      | `startObservation(..., { asType: 'event' })`           | `event`          |

The key idea: `startActiveObservation` makes its span the **active** span for the
duration of its callback. Anything created inside — including `observeOpenAI`
generations — nests under it automatically. Wrapping the whole run in one root
`agent` observation is what produces a single end-to-end trace with no manual
parent-child wiring.

**Tracing is bootstrapped first** in [`src/instrumentation.ts`](./src/instrumentation.ts):
it registers an `AntsPlatformSpanProcessor` on a Node OpenTelemetry provider and
calls `provider.register()` (which installs the async-context manager that makes
nesting work). Import it before anything that creates spans, and call
`provider.forceFlush()` on exit so a short-lived script doesn't drop spans.

Every SDK symbol used here is a **named export of the root `ants-platform`
package** — no deep imports into `@antsplatform/*`:

```ts
import {
  AntsPlatformSpanProcessor,
  setAntsPlatformTracerProvider,
  startObservation,
  startActiveObservation,
  updateActiveTrace,
  observeOpenAI,
  AntsGuardrailsClient,
} from "ants-platform";
```

## Trace shape

```
ops-copilot                      (agent, root trace = "ops-copilot-run")
├─ guardrail:input               (guardrail)
├─ router                        (generation · gpt-4o-mini)
├─ kb-account-lookup             (retriever · sqlite)
├─ mcp:read_runbook              (tool · real MCP server subprocess)
├─ tool:weather                  (tool · open-meteo HTTP)
├─ agent:researcher              (agent · sub-agent)
│  └─ researcher-llm             (generation · gpt-4o)
├─ synthesis                     (generation · gpt-4o)
├─ guardrail:output              (guardrail)
├─ evaluator:reply-quality       (evaluator)
│  └─ evaluator-llm              (generation · gpt-4o-mini)
├─ tool:desktop-notify           (tool · osascript)
└─ task-complete                 (event)
```

---

## Prerequisites

- **Node.js 20+** (the tracing/otel packages require it).
- **pnpm** (this example is workspace-linked to the SDK in this repo).
- An **OpenAI API key** with access to the configured models.
- **Ants Platform API keys** (public + secret) for the project you want traces in.
- macOS for the native desktop notification (other platforms fall back to stdout).
- Network access (OpenAI, Open-Meteo, and the Ants Platform ingestion API).
- `npx` available — the MCP tool spawns the bundled MCP server via `npx tsx`.

## Environment variables

| Variable                    | Required | Default                      | Purpose                                                   |
| --------------------------- | -------- | ---------------------------- | --------------------------------------------------------- |
| `ANTS_PLATFORM_PUBLIC_KEY`  | yes      | —                            | Ants Platform public key (`pk-…`). Auth for trace export. |
| `ANTS_PLATFORM_SECRET_KEY`  | yes      | —                            | Ants Platform secret key (`sk-…`). Auth for trace export. |
| `ANTS_PLATFORM_BASE_URL`    | no       | `https://api.agenticants.ai` | Ingestion API base URL.                                   |
| `ANTS_PLATFORM_ENVIRONMENT` | no       | `examples`                   | Tags every trace with an environment in the UI.           |
| `OPENAI_API_KEY`            | yes      | —                            | Real OpenAI calls.                                        |
| `ANTS_FAST_MODEL`           | no       | `gpt-4o-mini`                | Fast model for routing + evaluation.                      |
| `ANTS_REASONING_MODEL`      | no       | `gpt-4o`                     | Reasoning model for the sub-agent + synthesis.            |
| `ANTS_GUARDRAILS_API_KEY`   | no       | falls back to `pk:sk`        | `publicKey:secretKey` for guardrails.                     |
| `ANTS_GUARDRAILS_AGENT_ID`  | no       | —                            | Guardrail agent id. Unset → guardrail steps pass-through. |

## Run it

From the repo root (so the workspace links `ants-platform` to the local build):

```sh
pnpm install
pnpm build                        # build the SDK packages the example imports

cd examples/mature-agent
cp .env.example .env              # fill in the keys above
pnpm --filter @antsplatform/example-mature-agent start
```

Expected output (abridged):

```
[AGENT_CONFIG] Successfully initialized agent configuration: { agentName: 'ops-copilot', projectId: '…' }

=== Outcome ===
Trace ID     : b4f7f1507a7bbdfba66c82d1f2892c5d
Likely cause : ClickHouse query fan-out on wide date ranges (medium)
Groundedness : 1  Helpfulness: 1
Blocked      : false

--- Draft reply ---
Hi there, … (a grounded support reply) …

[traces flushed to Ants Platform]
```

## Verify the trace landed

The run prints a **Trace ID**. Confirm it on the backend via the public API
(ingestion is async, so allow a few seconds):

```sh
curl -u "$ANTS_PLATFORM_PUBLIC_KEY:$ANTS_PLATFORM_SECRET_KEY" \
  "https://api.agenticants.ai/api/public/traces/<TRACE_ID>" | jq '{name, observations: (.observations|length)}'
```

A healthy run returns `name: "ops-copilot-run"` with **14 observations**
(10 spans + 4 generations). Or open the trace in the Ants UI to see the tree
above, with real token usage and cost on each generation.

> This example was verified live: one trace, 14 observations, multi-model
> generations (`gpt-4o-mini` for router/eval, `gpt-4o` for researcher/synthesis)
> with real token counts, exported with no auth errors.
