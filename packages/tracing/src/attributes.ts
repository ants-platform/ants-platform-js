import { AntsPlatformOtelSpanAttributes } from "@antsplatform/core";
import { type Attributes } from "@opentelemetry/api";

import {
  AntsPlatformObservationAttributes,
  AntsPlatformObservationType,
  AntsPlatformTraceAttributes,
} from "./types.js";

/**
 * Creates OpenTelemetry attributes from AntsPlatform trace attributes.
 *
 * Converts user-friendly trace attributes into the internal OpenTelemetry
 * attribute format required by the span processor.
 *
 * @param attributes - AntsPlatform trace attributes to convert
 * @returns OpenTelemetry attributes object with non-null values
 *
 * @example
 * ```typescript
 * import { createTraceAttributes } from '@antsplatform/tracing';
 *
 * const otelAttributes = createTraceAttributes({
 *   name: 'user-checkout-flow',
 *   userId: 'user-123',
 *   sessionId: 'session-456',
 *   tags: ['checkout', 'payment'],
 *   metadata: { version: '2.1.0' }
 * });
 *
 * span.setAttributes(otelAttributes);
 * ```
 *
 * @public
 */
export function createTraceAttributes({
  name,
  userId,
  sessionId,
  version,
  release,
  input,
  output,
  metadata,
  tags,
  environment,
  public: isPublic,
}: AntsPlatformTraceAttributes = {}): Attributes {
  const attributes = {
    [AntsPlatformOtelSpanAttributes.TRACE_NAME]: name,
    [AntsPlatformOtelSpanAttributes.TRACE_USER_ID]: userId,
    [AntsPlatformOtelSpanAttributes.TRACE_SESSION_ID]: sessionId,
    [AntsPlatformOtelSpanAttributes.VERSION]: version,
    [AntsPlatformOtelSpanAttributes.RELEASE]: release,
    [AntsPlatformOtelSpanAttributes.TRACE_INPUT]: _serialize(input),
    [AntsPlatformOtelSpanAttributes.TRACE_OUTPUT]: _serialize(output),
    [AntsPlatformOtelSpanAttributes.TRACE_TAGS]: tags,
    [AntsPlatformOtelSpanAttributes.ENVIRONMENT]: environment,
    [AntsPlatformOtelSpanAttributes.TRACE_PUBLIC]: isPublic,
    ..._flattenAndSerializeMetadata(metadata, "trace"),
  };

  return Object.fromEntries(
    Object.entries(attributes).filter(([_, v]) => v != null),
  );
}

export function createObservationAttributes(
  type: AntsPlatformObservationType,
  attributes: AntsPlatformObservationAttributes,
): Attributes {
  const {
    metadata,
    input,
    output,
    level,
    statusMessage,
    version,
    completionStartTime,
    model,
    modelParameters,
    usageDetails,
    costDetails,
    prompt,
  } = attributes;

  let otelAttributes: Attributes = {
    [AntsPlatformOtelSpanAttributes.OBSERVATION_TYPE]: type,
    [AntsPlatformOtelSpanAttributes.OBSERVATION_LEVEL]: level,
    [AntsPlatformOtelSpanAttributes.OBSERVATION_STATUS_MESSAGE]: statusMessage,
    [AntsPlatformOtelSpanAttributes.VERSION]: version,
    [AntsPlatformOtelSpanAttributes.OBSERVATION_INPUT]: _serialize(input),
    [AntsPlatformOtelSpanAttributes.OBSERVATION_OUTPUT]: _serialize(output),
    [AntsPlatformOtelSpanAttributes.OBSERVATION_MODEL]: model,
    [AntsPlatformOtelSpanAttributes.OBSERVATION_USAGE_DETAILS]:
      _serialize(usageDetails),
    [AntsPlatformOtelSpanAttributes.OBSERVATION_COST_DETAILS]:
      _serialize(costDetails),
    [AntsPlatformOtelSpanAttributes.OBSERVATION_COMPLETION_START_TIME]:
      _serialize(completionStartTime),
    [AntsPlatformOtelSpanAttributes.OBSERVATION_MODEL_PARAMETERS]:
      _serialize(modelParameters),
    ...(prompt && !prompt.isFallback
      ? {
          [AntsPlatformOtelSpanAttributes.OBSERVATION_PROMPT_NAME]: prompt.name,
          [AntsPlatformOtelSpanAttributes.OBSERVATION_PROMPT_VERSION]:
            prompt.version,
        }
      : {}),
    ..._flattenAndSerializeMetadata(metadata, "observation"),
  };

  return Object.fromEntries(
    Object.entries(otelAttributes).filter(([_, v]) => v != null),
  );
}

/**
 * Safely serializes an object to JSON string.
 *
 * @param obj - Object to serialize
 * @returns JSON string or undefined if null/undefined, error message if serialization fails
 * @internal
 */
function _serialize(obj: unknown): string | undefined {
  try {
    if (typeof obj === "string") return obj;

    return obj != null ? JSON.stringify(obj) : undefined;
  } catch {
    return "<failed to serialize>";
  }
}

/**
 * Flattens and serializes metadata into OpenTelemetry attribute format.
 *
 * Converts nested metadata objects into dot-notation attribute keys.
 * For example, `{ database: { host: 'localhost' } }` becomes
 * `{ 'antsPlatform.metadata.database.host': 'localhost' }`.
 *
 * @param metadata - Metadata object to flatten
 * @param type - Whether this is for observation or trace metadata
 * @returns Flattened metadata attributes
 * @internal
 */
function _flattenAndSerializeMetadata(
  metadata: unknown,
  type: "observation" | "trace",
): Record<string, string> {
  const prefix =
    type === "observation"
      ? AntsPlatformOtelSpanAttributes.OBSERVATION_METADATA
      : AntsPlatformOtelSpanAttributes.TRACE_METADATA;

  const metadataAttributes: Record<string, string> = {};

  if (metadata === undefined || metadata === null) {
    return metadataAttributes;
  }

  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    const serialized = _serialize(metadata);
    if (serialized) {
      metadataAttributes[prefix] = serialized;
    }
  } else {
    for (const [key, value] of Object.entries(metadata)) {
      const serialized = typeof value === "string" ? value : _serialize(value);
      if (serialized) {
        metadataAttributes[`${prefix}.${key}`] = serialized;
      }
    }
  }

  return metadataAttributes;
}
