/**
 * Ants Platform SDK — root meta-package entry point.
 *
 * Re-exports the full public surface of every `@antsplatform/*` sub-package so
 * consumers can `import { ... } from "ants-platform"` without reaching into the
 * scoped packages directly.
 *
 * Integration packages depend on optional peer dependencies — install the peer
 * alongside `ants-platform` to use that integration (see `peerDependencies` in
 * package.json):
 *   - OpenAI tracing (`observeOpenAI`)            -> peer: `openai`
 *   - LangChain callbacks (`CallbackHandler`)     -> peer: `@langchain/core`
 *   - Span export (`AntsPlatformSpanProcessor`)   -> peers: `@opentelemetry/*`
 */

// REST client — prompts, datasets, scores, media, agent management.
export * from "@antsplatform/client";

// Tracing primitives — startObservation / startActiveObservation / observe,
// typed observations (agent, tool, generation, chain, retriever, embedding,
// evaluator, guardrail, event, span), the tracer provider, and agent context.
// This is the package that provides the canonical `AgentConfig` type.
export * from "@antsplatform/tracing";

// Export pipeline — register `AntsPlatformSpanProcessor` on an OpenTelemetry
// provider to ship spans to the Ants Platform backend. Named re-exports (not
// `export *`) so otel's `AgentConfig` does not collide with the tracing one
// above; tracing's is the public one.
export { AntsPlatformSpanProcessor } from "@antsplatform/otel";
export type {
  AntsPlatformSpanProcessorParams,
  MaskFunction,
  ShouldExportSpan,
} from "@antsplatform/otel";

// Guardrails — input/output policy enforcement client and result helpers.
// (Provider wrappers like `AntsOpenAI` remain on the `@antsplatform/guardrails/
// providers/*` subpaths so their provider SDKs stay opt-in.)
export * from "@antsplatform/guardrails";

// OpenAI integration — drop-in tracing wrapper. Optional peer: `openai`
// (imported as a type only, so it adds no runtime weight when unused).
export { observeOpenAI } from "@antsplatform/openai";
export type { AntsPlatformConfig } from "@antsplatform/openai";

// LangChain integration — callback handler for chains/agents/LLMs.
// Optional peers: `@langchain/core`, `@opentelemetry/api`.
export { CallbackHandler } from "@antsplatform/langchain";
