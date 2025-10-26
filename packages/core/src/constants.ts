import packageJson from "../package.json" with { type: "json" };

export const ANTS_PLATFORM_TRACER_NAME = "ants-platform-sdk";
export const ANTS_PLATFORM_SDK_VERSION = packageJson.version;
export const ANTS_PLATFORM_SDK_NAME = "javascript";

// From Ants Platform: web/src/features/otel/server/attributes.ts
export enum AntsPlatformOtelSpanAttributes {
  // Ants Platform Trace attributes
  TRACE_NAME = "ants-platform.trace.name",
  TRACE_USER_ID = "user.id",
  TRACE_SESSION_ID = "session.id",
  TRACE_TAGS = "ants-platform.trace.tags",
  TRACE_PUBLIC = "ants-platform.trace.public",
  TRACE_METADATA = "ants-platform.trace.metadata",
  TRACE_INPUT = "ants-platform.trace.input",
  TRACE_OUTPUT = "ants-platform.trace.output",

  // Ants Platform observation attributes
  OBSERVATION_TYPE = "ants-platform.observation.type",
  OBSERVATION_METADATA = "ants-platform.observation.metadata",
  OBSERVATION_LEVEL = "ants-platform.observation.level",
  OBSERVATION_STATUS_MESSAGE = "ants-platform.observation.status_message",
  OBSERVATION_INPUT = "ants-platform.observation.input",
  OBSERVATION_OUTPUT = "ants-platform.observation.output",

  // Ants Platform observation of type Generation attributes
  OBSERVATION_COMPLETION_START_TIME = "ants-platform.observation.completion_start_time",
  OBSERVATION_MODEL = "ants-platform.observation.model.name",
  OBSERVATION_MODEL_PARAMETERS = "ants-platform.observation.model.parameters",
  OBSERVATION_USAGE_DETAILS = "ants-platform.observation.usage_details",
  OBSERVATION_COST_DETAILS = "ants-platform.observation.cost_details",
  OBSERVATION_PROMPT_NAME = "ants-platform.observation.prompt.name",
  OBSERVATION_PROMPT_VERSION = "ants-platform.observation.prompt.version",

  //   General
  ENVIRONMENT = "ants-platform.environment",
  RELEASE = "ants-platform.release",
  VERSION = "ants-platform.version",

  // Internal
  AS_ROOT = "ants-platform.internal.as_root",

  // Compatibility - Map properties that were documented in https://ants-platform.com/docs/opentelemetry/get-started#property-mapping,
  // but have a new assignment
  TRACE_COMPAT_USER_ID = "ants-platform.user.id",
  TRACE_COMPAT_SESSION_ID = "ants-platform.session.id",
}
