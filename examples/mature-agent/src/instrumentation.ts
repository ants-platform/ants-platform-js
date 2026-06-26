/**
 * Tracing bootstrap. Import this FIRST, before any code that creates spans.
 *
 * It registers an `AntsPlatformSpanProcessor` on a Node OpenTelemetry provider.
 * The processor batches finished spans and ships them to the Ants Platform
 * backend, and `provider.register()` installs the async-hooks context manager
 * that lets `startActiveObservation(...)` and `observeOpenAI(...)` nest their
 * children under the currently-active span — which is what makes the whole run
 * show up as ONE end-to-end trace.
 */
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  AntsPlatformSpanProcessor,
  setAntsPlatformTracerProvider,
} from "ants-platform";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

const processor = new AntsPlatformSpanProcessor({
  publicKey: required("ANTS_PLATFORM_PUBLIC_KEY"),
  secretKey: required("ANTS_PLATFORM_SECRET_KEY"),
  baseUrl: process.env.ANTS_PLATFORM_BASE_URL ?? "https://api.agenticants.ai",
  environment: process.env.ANTS_PLATFORM_ENVIRONMENT ?? "examples",
  // Short-lived script -> flush every span quickly so nothing is lost on exit.
  // Long-running services should leave this as the default "batched".
  exportMode: "batched",
  flushAt: 1,
  // Tagging spans with an agent registers this run under the AI Command Center.
  // projectId is fetched automatically from the API using the keys above.
  agent: {
    agentName: "ops-copilot",
    agentDisplayName: "Operations Copilot (example)",
  },
});

const provider = new NodeTracerProvider({ spanProcessors: [processor] });
provider.register();
setAntsPlatformTracerProvider(provider);

/** Flush and tear down tracing so no spans are dropped when the process exits. */
export async function shutdownTracing(): Promise<void> {
  await provider.forceFlush();
  await provider.shutdown();
}
