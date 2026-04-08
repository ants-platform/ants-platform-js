/**
 * Ants Platform SDK - Main Entry Point
 *
 * This is the main entry point for the Ants Platform SDK.
 * It re-exports all functionality from the client package.
 */

export * from "@antsplatform/client";
export * from "@antsplatform/tracing";

// Guardrails — re-export core types under a namespace to avoid conflicts
export {
  AntsGuardrailsClient,
  GuardrailViolationError,
  type GuardrailResult,
  type Violation,
} from "@antsplatform/guardrails";
