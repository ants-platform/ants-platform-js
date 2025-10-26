import {
  getGlobalLogger,
  ANTS_PLATFORM_SDK_VERSION,
  ANTS_PLATFORM_TRACER_NAME,
} from "@antsplatform/core";
import { TracerProvider, trace } from "@opentelemetry/api";

const ANTS_PLATFORM_GLOBAL_SYMBOL = Symbol.for("antsPlatform");

type AntsPlatformGlobalState = {
  isolatedTracerProvider: TracerProvider | null;
};

function createState(): AntsPlatformGlobalState {
  return {
    isolatedTracerProvider: null,
  };
}

interface GlobalThis {
  [ANTS_PLATFORM_GLOBAL_SYMBOL]?: AntsPlatformGlobalState;
}

function getGlobalState(): AntsPlatformGlobalState {
  const initialState = createState();

  try {
    const g = globalThis as typeof globalThis & GlobalThis;

    if (typeof g !== "object" || g === null) {
      getGlobalLogger().warn(
        "globalThis is not available, using fallback state",
      );
      return initialState;
    }

    if (!g[ANTS_PLATFORM_GLOBAL_SYMBOL]) {
      Object.defineProperty(g, ANTS_PLATFORM_GLOBAL_SYMBOL, {
        value: initialState,
        writable: false, // lock the slot (not the contents)
        configurable: false,
        enumerable: false,
      });
    }

    return g[ANTS_PLATFORM_GLOBAL_SYMBOL]!;
  } catch (err) {
    if (err instanceof Error) {
      getGlobalLogger().error(`Failed to access global state: ${err.message}`);
    } else {
      getGlobalLogger().error(`Failed to access global state: ${String(err)}`);
    }

    return initialState;
  }
}

/**
 * Sets an isolated TracerProvider for AntsPlatform tracing operations.
 *
 * This allows AntsPlatform to use its own TracerProvider instance, separate from
 * the global OpenTelemetry TracerProvider. This is useful for avoiding conflicts
 * with other OpenTelemetry instrumentation in the application.
 *
 * ⚠️  **Limitation: Span Context Sharing**
 *
 * While this function isolates span processing and export, it does NOT provide
 * complete trace isolation. OpenTelemetry context (trace IDs, parent spans) is
 * still shared between the global and isolated providers. This means:
 *
 * - Spans created with the isolated provider inherit trace IDs from global spans
 * - Spans created with the isolated provider inherit parent relationships from global spans
 * - This can result in spans from different providers being part of the same logical trace
 *
 * **Why this happens:**
 * OpenTelemetry uses a global context propagation mechanism that operates at the
 * JavaScript runtime level, independent of individual TracerProvider instances.
 * The context (containing trace ID, span ID) flows through async boundaries and
 * is inherited by all spans created within that context, regardless of which
 * TracerProvider creates them.
 *
 * @example
 * ```typescript
 * import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
 * import { AntsPlatformSpanProcessor } from '@antsplatform/otel';
 * import { setAntsPlatformTracerProvider } from '@antsplatform/tracing';
 *
 * // Create provider with span processors in constructor
 * const provider = new NodeTracerProvider({
 *   spanProcessors: [new AntsPlatformSpanProcessor()]
 * });
 *
 * setAntsPlatformTracerProvider(provider);
 *
 * // Note: Spans created with getAntsPlatformTracer() may still inherit
 * // context from spans created with the global tracer
 * ```
 *
 * @param provider - The TracerProvider instance to use, or null to clear the isolated provider
 * @public
 */
export function setAntsPlatformTracerProvider(provider: TracerProvider | null) {
  getGlobalState().isolatedTracerProvider = provider;
}

/**
 * Gets the TracerProvider for AntsPlatform tracing operations.
 *
 * Returns the isolated TracerProvider if one has been set via setAntsPlatformTracerProvider(),
 * otherwise falls back to the global OpenTelemetry TracerProvider.
 *
 * @example
 * ```typescript
 * import { getAntsPlatformTracerProvider } from '@antsplatform/tracing';
 *
 * const provider = getAntsPlatformTracerProvider();
 * const tracer = provider.getTracer('my-tracer', '1.0.0');
 * ```
 *
 * @returns The TracerProvider instance to use for AntsPlatform tracing
 * @public
 */
export function getAntsPlatformTracerProvider(): TracerProvider {
  const { isolatedTracerProvider } = getGlobalState();

  if (isolatedTracerProvider) return isolatedTracerProvider;

  return trace.getTracerProvider();
}

/**
 * Gets the OpenTelemetry tracer instance for AntsPlatform.
 *
 * This function returns a tracer specifically configured for AntsPlatform
 * with the correct tracer name and version. Used internally by all
 * AntsPlatform tracing functions to ensure consistent trace creation.
 *
 * @returns The AntsPlatform OpenTelemetry tracer instance
 *
 * @example
 * ```typescript
 * import { getAntsPlatformTracer } from '@antsplatform/tracing';
 *
 * const tracer = getAntsPlatformTracer();
 * const span = tracer.startSpan('my-operation');
 * ```
 *
 * @public
 */
export function getAntsPlatformTracer() {
  return getAntsPlatformTracerProvider().getTracer(
    ANTS_PLATFORM_TRACER_NAME,
    ANTS_PLATFORM_SDK_VERSION,
  );
}
