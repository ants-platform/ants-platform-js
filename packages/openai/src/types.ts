import { SpanContext } from "@opentelemetry/api";

/**
 * Configuration options for AntsPlatform OpenAI tracing.
 *
 * This interface defines all available options for customizing how OpenAI
 * SDK calls are traced and stored in AntsPlatform. It includes both trace-level
 * metadata and generation-specific configuration.
 *
 * @public
 */
export type AntsPlatformConfig = {
  /** OpenTelemetry span context to use as parent for the generated span */
  parentSpanContext?: SpanContext;
  /** Name for the trace that will contain this generation */
  traceName?: string;
  /** Session identifier to group related interactions */
  sessionId?: string;
  /** User identifier for associating the trace with a specific user */
  userId?: string;
  /** Tags for categorizing and filtering traces */
  tags?: string[];

  /** Custom name for the generation observation (defaults to SDK method name) */
  generationName?: string;
  /** Additional metadata to attach to the generation */
  generationMetadata?: Record<string, unknown>;
  /** Information about the AntsPlatform prompt used for this generation */
  antsPlatformPrompt?: {
    /** Name of the prompt template in AntsPlatform */
    name: string;
    /** Version number of the prompt template */
    version: number;
    /** Whether this is a fallback prompt due to retrieval failure */
    isFallback: boolean;
  };
};
