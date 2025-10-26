import { getGlobalLogger } from "@antsplatform/core";
import {
  startObservation,
  AntsPlatformGeneration,
  AntsPlatformSpan,
  AntsPlatformGenerationAttributes,
  AntsPlatformSpanAttributes,
} from "@antsplatform/tracing";
import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Document } from "@langchain/core/documents";
import type { Serialized } from "@langchain/core/load/serializable";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  FunctionMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type UsageMetadata,
  type BaseMessageFields,
  type MessageContent,
} from "@langchain/core/messages";
import type { Generation, LLMResult } from "@langchain/core/outputs";
import type { ChainValues } from "@langchain/core/utils/types";

const LANGSMITH_HIDDEN_TAG = "langsmith:hidden";

type AntsPlatformPrompt = {
  name: string;
  version: number;
  isFallback: boolean;
};

export type LlmMessage = {
  role: string;
  content: BaseMessageFields["content"];
  additional_kwargs?: BaseMessageFields["additional_kwargs"];
};

export type AnonymousLlmMessage = {
  content: BaseMessageFields["content"];
  additional_kwargs?: BaseMessageFields["additional_kwargs"];
};

type ConstructorParams = {
  userId?: string;
  sessionId?: string;
  tags?: string[];
  version?: string; // added to all traces and observations
  traceMetadata?: Record<string, unknown>; // added to all traces
};

export class CallbackHandler extends BaseCallbackHandler {
  name = "AntsPlatformCallbackHandler";

  private userId?: string;
  private version?: string;
  private sessionId?: string;
  private tags: string[];
  private traceMetadata?: Record<string, unknown>;

  private completionStartTimes: Record<string, Date> = {};
  private promptToParentRunMap;
  private runMap: Map<string, AntsPlatformSpan | AntsPlatformGeneration> =
    new Map();

  public last_trace_id: string | null = null;

  constructor(params?: ConstructorParams) {
    super();

    this.sessionId = params?.sessionId;
    this.userId = params?.userId;
    this.tags = params?.tags ?? [];
    this.traceMetadata = params?.traceMetadata;
    this.version = params?.version;

    this.promptToParentRunMap = new Map<string, AntsPlatformPrompt>();
  }

  get logger() {
    return getGlobalLogger();
  }

  async handleLLMNewToken(
    token: string,
    _idx: any,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    _fields?: any,
  ): Promise<void> {
    // if this is the first token, add it to completionStartTimes
    if (runId && !(runId in this.completionStartTimes)) {
      this.logger.debug(`LLM first streaming token: ${runId}`);
      this.completionStartTimes[runId] = new Date();
    }
  }

  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    runType?: string,
    name?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Chain start with Id: ${runId}`);

      const runName = name ?? chain.id.at(-1)?.toString() ?? "Langchain Run";

      this.registerAntsPlatformPrompt(parentRunId, metadata);

      // In chains, inputs can be a string or an array of BaseMessage
      let finalInput: string | ChainValues = inputs;
      if (
        typeof inputs === "object" &&
        "input" in inputs &&
        Array.isArray(inputs["input"]) &&
        inputs["input"].every((m) => m instanceof BaseMessage)
      ) {
        finalInput = inputs["input"].map((m) =>
          this.extractChatMessageContent(m),
        );
      } else if (
        typeof inputs === "object" &&
        "content" in inputs &&
        typeof inputs["content"] === "string"
      ) {
        finalInput = inputs["content"];
      }

      const span = this.startAndRegisterOtelSpan({
        runName,
        parentRunId,
        runId,
        tags,
        metadata,
        attributes: {
          input: finalInput,
        },
      });

      // If there's no parent run, this is a top-level chain execution
      // and we need to store trace attributes on the span
      const traceTags = [...new Set([...(tags ?? []), ...this.tags])];

      if (!parentRunId) {
        span.updateTrace({
          tags: traceTags,
          userId:
            metadata &&
            "antsPlatformUserId" in metadata &&
            typeof metadata["antsPlatformUserId"] === "string"
              ? metadata["antsPlatformUserId"]
              : this.userId,
          sessionId:
            metadata &&
            "antsPlatformSessionId" in metadata &&
            typeof metadata["antsPlatformSessionId"] === "string"
              ? metadata["antsPlatformSessionId"]
              : this.sessionId,
          metadata: this.traceMetadata,
          version: this.version,
        });
      }
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleAgentAction(
    action: AgentAction,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Agent action ${action.tool} with ID: ${runId}`);
      this.startAndRegisterOtelSpan({
        runId,
        parentRunId,
        runName: action.tool,
        attributes: {
          input: action,
        },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleAgentEnd?(
    action: AgentFinish,
    runId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentRunId?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Agent finish with ID: ${runId}`);

      this.handleOtelSpanEnd({
        runId,
        attributes: { output: action },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleChainError(
    err: any,
    runId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`Chain error: ${err} with ID: ${runId}`);

      const azureRefusalError = this.parseAzureRefusalError(err);

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          level: "ERROR",
          statusMessage: err.toString() + azureRefusalError,
        },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleGenerationStart(
    llm: Serialized,
    messages: (LlmMessage | MessageContent | AnonymousLlmMessage)[],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    this.logger.debug(
      `Generation start with ID: ${runId} and parentRunId ${parentRunId}`,
    );

    const runName = name ?? llm.id.at(-1)?.toString() ?? "Langchain Generation";

    const modelParameters: Record<string, any> = {};
    const invocationParams = extraParams?.["invocation_params"];

    for (const [key, value] of Object.entries({
      temperature: (invocationParams as any)?.temperature,
      max_tokens: (invocationParams as any)?.max_tokens,
      top_p: (invocationParams as any)?.top_p,
      frequency_penalty: (invocationParams as any)?.frequency_penalty,
      presence_penalty: (invocationParams as any)?.presence_penalty,
      request_timeout: (invocationParams as any)?.request_timeout,
    })) {
      if (value !== undefined && value !== null) {
        modelParameters[key] = value;
      }
    }

    interface InvocationParams {
      _type?: string;
      model?: string;
      model_name?: string;
      repo_id?: string;
    }

    let extractedModelName: string | undefined;
    if (extraParams) {
      const invocationParamsModelName = (
        extraParams.invocation_params as InvocationParams
      ).model;
      const metadataModelName =
        metadata && "ls_model_name" in metadata
          ? (metadata["ls_model_name"] as string)
          : undefined;

      extractedModelName = invocationParamsModelName ?? metadataModelName;
    }

    const registeredPrompt = this.promptToParentRunMap.get(
      parentRunId ?? "root",
    );
    if (registeredPrompt && parentRunId) {
      this.deregisterAntsPlatformPrompt(parentRunId);
    }

    this.startAndRegisterOtelSpan({
      type: "generation",
      runId,
      parentRunId,
      metadata,
      tags,
      runName,
      attributes: {
        input: messages,
        model: extractedModelName,
        modelParameters: modelParameters,
        prompt: registeredPrompt,
      },
    });
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Chat model start with ID: ${runId}`);

      const prompts = messages.flatMap((message) =>
        message.map((m) => this.extractChatMessageContent(m)),
      );

      this.handleGenerationStart(
        llm,
        prompts,
        runId,
        parentRunId,
        extraParams,
        tags,
        metadata,
        name,
      );
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`Chain end with ID: ${runId}`);

      let finalOutput: ChainValues | string = outputs;
      if (
        typeof outputs === "object" &&
        "output" in outputs &&
        typeof outputs["output"] === "string"
      ) {
        finalOutput = outputs["output"];
      }

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          output: finalOutput,
        },
      });
      this.deregisterAntsPlatformPrompt(runId);
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`LLM start with ID: ${runId}`);

      this.handleGenerationStart(
        llm,
        prompts,
        runId,
        parentRunId,
        extraParams,
        tags,
        metadata,
        name,
      );
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Tool start with ID: ${runId}`);

      this.startAndRegisterOtelSpan({
        runId,
        parentRunId,
        runName: name ?? tool.id.at(-1)?.toString() ?? "Tool execution",
        attributes: {
          input,
        },
        metadata,
        tags,
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Retriever start with ID: ${runId}`);

      this.startAndRegisterOtelSpan({
        runId,
        parentRunId,
        runName: name ?? retriever.id.at(-1)?.toString() ?? "Retriever",
        attributes: {
          input: query,
        },
        tags,
        metadata,
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleRetrieverEnd(
    documents: Document<Record<string, any>>[],
    runId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`Retriever end with ID: ${runId}`);

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          output: documents,
        },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleRetrieverError(
    err: any,
    runId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`Retriever error: ${err} with ID: ${runId}`);
      this.handleOtelSpanEnd({
        runId,
        attributes: {
          level: "ERROR",
          statusMessage: err.toString(),
        },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }
  async handleToolEnd(
    output: string,
    runId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`Tool end with ID: ${runId}`);

      this.handleOtelSpanEnd({
        runId,
        attributes: { output },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleToolError(
    err: any,
    runId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`Tool error ${err} with ID: ${runId}`);

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          level: "ERROR",
          statusMessage: err.toString(),
        },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`LLM end with ID: ${runId}`);

      const lastResponse =
        output.generations[output.generations.length - 1][
          output.generations[output.generations.length - 1].length - 1
        ];
      const llmUsage =
        this.extractUsageMetadata(lastResponse) ??
        output.llmOutput?.["tokenUsage"];
      const modelName = this.extractModelNameFromMetadata(lastResponse);

      const usageDetails: Record<string, any> = {
        input:
          llmUsage?.input_tokens ??
          ("promptTokens" in llmUsage ? llmUsage?.promptTokens : undefined),
        output:
          llmUsage?.output_tokens ??
          ("completionTokens" in llmUsage
            ? llmUsage?.completionTokens
            : undefined),
        total:
          llmUsage?.total_tokens ??
          ("totalTokens" in llmUsage ? llmUsage?.totalTokens : undefined),
      };

      if (llmUsage && "input_token_details" in llmUsage) {
        for (const [key, val] of Object.entries(
          llmUsage["input_token_details"] ?? {},
        )) {
          usageDetails[`input_${key}`] = val;

          if ("input" in usageDetails && typeof val === "number") {
            usageDetails["input"] = Math.max(0, usageDetails["input"] - val);
          }
        }
      }

      if (llmUsage && "output_token_details" in llmUsage) {
        for (const [key, val] of Object.entries(
          llmUsage["output_token_details"] ?? {},
        )) {
          usageDetails[`output_${key}`] = val;

          if ("output" in usageDetails && typeof val === "number") {
            usageDetails["output"] = Math.max(0, usageDetails["output"] - val);
          }
        }
      }

      const extractedOutput =
        "message" in lastResponse &&
        lastResponse["message"] instanceof BaseMessage
          ? this.extractChatMessageContent(lastResponse["message"])
          : lastResponse.text;

      this.handleOtelSpanEnd({
        runId,
        type: "generation",
        attributes: {
          model: modelName,
          output: extractedOutput,
          completionStartTime:
            runId in this.completionStartTimes
              ? this.completionStartTimes[runId]
              : undefined,
          usageDetails: usageDetails,
        },
      });

      if (runId in this.completionStartTimes) {
        delete this.completionStartTimes[runId];
      }
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleLLMError(
    err: any,
    runId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`LLM error ${err} with ID: ${runId}`);

      // Azure has the refusal status for harmful messages in the error property
      // This would not be logged as the error message is only a generic message
      // that there has been a refusal
      const azureRefusalError = this.parseAzureRefusalError(err);

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          level: "ERROR",
          statusMessage: err.toString() + azureRefusalError,
        },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  private registerAntsPlatformPrompt(
    parentRunId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    /*
    Register a prompt for linking to a generation with the same parentRunId.

    `parentRunId` must exist when we want to do any prompt linking to a generation. If it does not exist, it means the execution is solely a Prompt template formatting without any following LLM invocation, so no generation will be created to link to.
    For the simplest chain, a parent run is always created to wrap the individual runs consisting of prompt template formatting and LLM invocation.
    So, we do not need to register any prompt for linking if parentRunId is missing.
    */
    if (metadata && "antsPlatformPrompt" in metadata && parentRunId) {
      this.promptToParentRunMap.set(
        parentRunId,
        metadata.antsPlatformPrompt as AntsPlatformPrompt,
      );
    }
  }

  private deregisterAntsPlatformPrompt(runId: string): void {
    this.promptToParentRunMap.delete(runId);
  }

  private startAndRegisterOtelSpan(params: {
    type?: "span";
    runName: string;
    runId: string;
    parentRunId?: string;
    attributes: AntsPlatformGenerationAttributes;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): AntsPlatformSpan;
  private startAndRegisterOtelSpan(params: {
    type: "generation";
    runName: string;
    runId: string;
    parentRunId?: string;
    attributes: AntsPlatformGenerationAttributes;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): AntsPlatformGeneration;
  private startAndRegisterOtelSpan(params: {
    type?: "span" | "generation";
    runName: string;
    runId: string;
    parentRunId?: string;
    attributes: AntsPlatformGenerationAttributes;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): AntsPlatformSpan | AntsPlatformGeneration {
    const { type, runName, runId, parentRunId, attributes, metadata, tags } =
      params;

    const observation =
      type === "generation"
        ? startObservation(
            runName,
            {
              version: this.version,
              metadata: this.joinTagsAndMetaData(tags, metadata),
              level:
                tags && tags.includes(LANGSMITH_HIDDEN_TAG)
                  ? "DEBUG"
                  : undefined,
              ...attributes,
            },
            {
              asType: "generation",
              parentSpanContext: parentRunId
                ? this.runMap.get(parentRunId)?.otelSpan.spanContext()
                : undefined,
            },
          )
        : startObservation(
            runName,
            {
              version: this.version,
              metadata: this.joinTagsAndMetaData(tags, metadata),
              level:
                tags && tags.includes(LANGSMITH_HIDDEN_TAG)
                  ? "DEBUG"
                  : undefined,
              ...attributes,
            },
            {
              parentSpanContext: parentRunId
                ? this.runMap.get(parentRunId)?.otelSpan.spanContext()
                : undefined,
            },
          );
    this.runMap.set(runId, observation);

    return observation;
  }

  private handleOtelSpanEnd(params: {
    runId: string;
    attributes?: AntsPlatformSpanAttributes;
    type?: "span";
  }): void;
  private handleOtelSpanEnd(params: {
    runId: string;
    attributes?: AntsPlatformGenerationAttributes;
    type: "generation";
  }): void;
  private handleOtelSpanEnd(params: {
    runId: string;
    attributes?: AntsPlatformGenerationAttributes | AntsPlatformSpanAttributes;
    type?: "span" | "generation";
  }) {
    const { runId, attributes = {} } = params;

    const span = this.runMap.get(runId);
    if (!span) {
      this.logger.warn("Span not found in runMap. Skipping operation");

      return;
    }

    span.update(attributes).end();

    this.last_trace_id = span.traceId;
    this.runMap.delete(runId);
  }
  private parseAzureRefusalError(err: any): string {
    // Azure has the refusal status for harmful messages in the error property
    // This would not be logged as the error message is only a generic message
    // that there has been a refusal
    let azureRefusalError = "";
    if (typeof err == "object" && "error" in err) {
      try {
        azureRefusalError =
          "\n\nError details:\n" + JSON.stringify(err["error"], null, 2);
      } catch {}
    }

    return azureRefusalError;
  }

  private joinTagsAndMetaData(
    tags?: string[] | undefined,
    metadata1?: Record<string, unknown> | undefined,
    metadata2?: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    const finalDict: Record<string, unknown> = {};
    if (tags && tags.length > 0) {
      finalDict.tags = tags;
    }
    if (metadata1) {
      Object.assign(finalDict, metadata1);
    }
    if (metadata2) {
      Object.assign(finalDict, metadata2);
    }
    return this.stripAntsPlatformKeysFromMetadata(finalDict);
  }

  private stripAntsPlatformKeysFromMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!metadata) {
      return;
    }

    const antsPlatformKeys = [
      "antsPlatformPrompt",
      "antsPlatformUserId",
      "antsPlatformSessionId",
    ];

    return Object.fromEntries(
      Object.entries(metadata).filter(
        ([key, _]) => !antsPlatformKeys.includes(key),
      ),
    );
  }

  /** Not all models supports tokenUsage in llmOutput, can use AIMessage.usage_metadata instead */
  private extractUsageMetadata(
    generation: Generation,
  ): UsageMetadata | undefined {
    try {
      const usageMetadata =
        "message" in generation &&
        (generation["message"] instanceof AIMessage ||
          generation["message"] instanceof AIMessageChunk)
          ? generation["message"].usage_metadata
          : undefined;

      return usageMetadata;
    } catch (err) {
      this.logger.debug(`Error extracting usage metadata: ${err}`);

      return;
    }
  }

  private extractModelNameFromMetadata(generation: any): string | undefined {
    try {
      return "message" in generation &&
        (generation["message"] instanceof AIMessage ||
          generation["message"] instanceof AIMessageChunk)
        ? generation["message"].response_metadata.model_name
        : undefined;
    } catch {}
  }

  private extractChatMessageContent(
    message: BaseMessage,
  ): LlmMessage | AnonymousLlmMessage | MessageContent {
    let response = undefined;

    if (message instanceof HumanMessage) {
      response = { content: message.content, role: "user" };
    } else if (message instanceof ChatMessage) {
      response = { content: message.content, role: message.role };
    } else if (message instanceof AIMessage) {
      response = { content: message.content, role: "assistant" };

      if ("tool_calls" in message && (message.tool_calls?.length ?? 0) > 0) {
        (response as any)["tool_calls"] = message["tool_calls"];
      }
    } else if (message instanceof SystemMessage) {
      response = { content: message.content, role: "system" };
    } else if (message instanceof FunctionMessage) {
      response = {
        content: message.content,
        additional_kwargs: message.additional_kwargs,
        role: message.name,
      };
    } else if (message instanceof ToolMessage) {
      response = {
        content: message.content,
        additional_kwargs: message.additional_kwargs,
        role: message.name,
      };
    } else if (!message.name) {
      response = { content: message.content };
    } else {
      response = {
        role: message.name,
        content: message.content,
      };
    }
    if (
      message.additional_kwargs.function_call ||
      message.additional_kwargs.tool_calls
    ) {
      return { ...response, additional_kwargs: message.additional_kwargs };
    }
    return response;
  }
}
