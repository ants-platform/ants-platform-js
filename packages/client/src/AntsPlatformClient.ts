import {
  AntsPlatformAPIClient,
  ANTS_PLATFORM_SDK_VERSION,
  getGlobalLogger,
  getEnv,
} from "@antsplatform/core";

import { DatasetManager } from "./dataset/index.js";
import { MediaManager } from "./media/index.js";
import { PromptManager } from "./prompt/index.js";
import { ScoreManager } from "./score/index.js";

/**
 * Configuration parameters for initializing a AntsPlatformClient instance.
 *
 * @public
 */
export interface AntsPlatformClientParams {
  /**
   * Public API key for authentication with Ants Platform.
   * Can also be provided via ANTS_PLATFORM_PUBLIC_KEY environment variable.
   */
  publicKey?: string;

  /**
   * Secret API key for authentication with Ants Platform.
   * Can also be provided via ANTS_PLATFORM_SECRET_KEY environment variable.
   */
  secretKey?: string;

  /**
   * Base URL of the Ants Platform instance to connect to.
   * Can also be provided via ANTS_PLATFORM_BASE_URL environment variable.
   *
   * @defaultValue "https://api.ants-platform.com"
   */
  baseUrl?: string;

  /**
   * Request timeout in seconds.
   * Can also be provided via ANTS_PLATFORM_TIMEOUT environment variable.
   *
   * @defaultValue 5
   */
  timeout?: number;

  /**
   * Additional HTTP headers to include with API requests.
   */
  additionalHeaders?: Record<string, string>;
}

/**
 * Main client for interacting with the Ants Platform API.
 *
 * The AntsPlatformClient provides access to all Ants Platform functionality including:
 * - Prompt management and retrieval
 * - Dataset operations
 * - Score creation and management
 * - Media upload and handling
 * - Direct API access for advanced use cases
 *
 * @example
 * ```typescript
 * // Initialize with explicit credentials
 * const antsPlatform = new AntsPlatformClient({
 *   publicKey: "pk_...",
 *   secretKey: "sk_...",
 *   baseUrl: "https://api.ants-platform.com"
 * });
 *
 * // Or use environment variables
 * const antsPlatform = new AntsPlatformClient();
 *
 * // Use the client
 * const prompt = await antsPlatform.prompt.get("my-prompt");
 * const compiledPrompt = prompt.compile({ variable: "value" });
 * ```
 *
 * @public
 */
export class AntsPlatformClient {
  /**
   * Direct access to the underlying Ants Platform API client.
   * Use this for advanced API operations not covered by the high-level managers.
   */
  public api: AntsPlatformAPIClient;

  /**
   * Manager for prompt operations including creation, retrieval, and caching.
   */
  public prompt: PromptManager;

  /**
   * Manager for dataset operations including retrieval and item linking.
   */
  public dataset: DatasetManager;

  /**
   * Manager for score creation and batch processing.
   */
  public score: ScoreManager;

  /**
   * Manager for media upload and reference resolution.
   */
  public media: MediaManager;

  private baseUrl: string;
  private projectId: string | null = null;

  /**
   * @deprecated Use prompt.get instead
   */
  public getPrompt: typeof PromptManager.prototype.get;
  /**
   * @deprecated Use prompt.create instead
   */
  public createPrompt: typeof PromptManager.prototype.create;
  /**
   * @deprecated Use prompt.update instead
   */
  public updatePrompt: typeof PromptManager.prototype.update;
  /**
   * @deprecated Use dataset.get instead
   */
  public getDataset: typeof DatasetManager.prototype.get;
  /**
   * @deprecated Use api.trace.get instead
   */
  public fetchTrace: typeof AntsPlatformAPIClient.prototype.trace.get;
  /**
   * @deprecated Use api.trace.list instead
   */
  public fetchTraces: typeof AntsPlatformAPIClient.prototype.trace.list;
  /**
   * @deprecated Use api.observations.get instead
   */
  public fetchObservation: typeof AntsPlatformAPIClient.prototype.observations.get;
  /**
   * @deprecated Use api.observations.list instead
   */
  public fetchObservations: typeof AntsPlatformAPIClient.prototype.observations.getMany;
  /**
   * @deprecated Use api.sessions.get instead
   */
  public fetchSessions: typeof AntsPlatformAPIClient.prototype.sessions.get;
  /**
   * @deprecated Use api.datasets.getRun instead
   */
  public getDatasetRun: typeof AntsPlatformAPIClient.prototype.datasets.getRun;
  /**
   * @deprecated Use api.datasets.getRuns instead
   */
  public getDatasetRuns: typeof AntsPlatformAPIClient.prototype.datasets.getRuns;
  /**
   * @deprecated Use api.datasets.create instead
   */
  public createDataset: typeof AntsPlatformAPIClient.prototype.datasets.create;
  /**
   * @deprecated Use api.datasetItems.get instead
   */
  public getDatasetItem: typeof AntsPlatformAPIClient.prototype.datasetItems.get;
  /**
   * @deprecated Use api.datasetItems.create instead
   */
  public createDatasetItem: typeof AntsPlatformAPIClient.prototype.datasetItems.create;
  /**
   * @deprecated Use api.media.get instead
   */
  public fetchMedia: typeof AntsPlatformAPIClient.prototype.media.get;
  /**
   * @deprecated Use media.resolveReferences instead
   */
  public resolveMediaReferences: typeof MediaManager.prototype.resolveReferences;

  /**
   * Creates a new AntsPlatformClient instance.
   *
   * @param params - Configuration parameters. If not provided, will use environment variables.
   *
   * @throws Will log warnings if required credentials are not provided
   *
   * @example
   * ```typescript
   * // With explicit configuration
   * const client = new AntsPlatformClient({
   *   publicKey: "pk_...",
   *   secretKey: "sk_...",
   *   baseUrl: "https://api.ants-platform.com"
   * });
   *
   * // Using environment variables
   * const client = new AntsPlatformClient();
   * ```
   */
  constructor(params?: AntsPlatformClientParams) {
    const logger = getGlobalLogger();

    const publicKey = params?.publicKey ?? getEnv("ANTS_PLATFORM_PUBLIC_KEY");
    const secretKey = params?.secretKey ?? getEnv("ANTS_PLATFORM_SECRET_KEY");
    this.baseUrl =
      params?.baseUrl ??
      getEnv("ANTS_PLATFORM_BASE_URL") ??
      getEnv("ANTS_PLATFORM_BASEURL") ?? // legacy v2
      "https://api.ants-platform.com";

    if (!publicKey) {
      logger.warn(
        "No public key provided in constructor or as ANTS_PLATFORM_PUBLIC_KEY env var. Client operations will fail.",
      );
    }
    if (!secretKey) {
      logger.warn(
        "No secret key provided in constructor or as ANTS_PLATFORM_SECRET_KEY env var. Client operations will fail.",
      );
    }
    const timeoutSeconds =
      params?.timeout ?? Number(getEnv("ANTS_PLATFORM_TIMEOUT") ?? 5);

    this.api = new AntsPlatformAPIClient({
      baseUrl: this.baseUrl,
      username: publicKey,
      password: secretKey,
      xAntsPlatformPublicKey: publicKey,
      xAntsPlatformSdkVersion: ANTS_PLATFORM_SDK_VERSION,
      xAntsPlatformSdkName: "javascript",
      environment: "", // noop as baseUrl is set
      headers: params?.additionalHeaders,
    });

    logger.debug("Initialized AntsPlatformClient with params:", {
      publicKey,
      baseUrl: this.baseUrl,
      timeoutSeconds,
    });

    this.prompt = new PromptManager({ apiClient: this.api });
    this.dataset = new DatasetManager({ apiClient: this.api });
    this.score = new ScoreManager({ apiClient: this.api });
    this.media = new MediaManager({ apiClient: this.api });

    // Keep v3 compat by exposing old interface
    this.getPrompt = this.prompt.get.bind(this.prompt); // keep correct this context for cache access
    this.createPrompt = this.prompt.create.bind(this.prompt);
    this.updatePrompt = this.prompt.update.bind(this.prompt);
    this.getDataset = this.dataset.get;
    this.fetchTrace = this.api.trace.get;
    this.fetchTraces = this.api.trace.list;
    this.fetchObservation = this.api.observations.get;
    this.fetchObservations = this.api.observations.getMany;
    this.fetchSessions = this.api.sessions.get;
    this.getDatasetRun = this.api.datasets.getRun;
    this.getDatasetRuns = this.api.datasets.getRuns;
    this.createDataset = this.api.datasets.create;
    this.getDatasetItem = this.api.datasetItems.get;
    this.createDatasetItem = this.api.datasetItems.create;
    this.fetchMedia = this.api.media.get;
    this.resolveMediaReferences = this.media.resolveReferences;
  }

  /**
   * Flushes any pending score events to the Ants Platform API.
   *
   * This method ensures all queued scores are sent immediately rather than
   * waiting for the automatic flush interval or batch size threshold.
   *
   * @returns Promise that resolves when all pending scores have been sent
   *
   * @example
   * ```typescript
   * antsPlatform.score.create({ name: "quality", value: 0.8 });
   * await antsPlatform.flush(); // Ensures the score is sent immediately
   * ```
   */
  public async flush() {
    return this.score.flush();
  }

  /**
   * Gracefully shuts down the client by flushing all pending data.
   *
   * This method should be called before your application exits to ensure
   * all data is sent to Ants Platform.
   *
   * @returns Promise that resolves when shutdown is complete
   *
   * @example
   * ```typescript
   * // Before application exit
   * await antsPlatform.shutdown();
   * ```
   */
  public async shutdown() {
    return this.score.shutdown();
  }

  /**
   * Generates a URL to view a specific trace in the Ants Platform UI.
   *
   * @param traceId - The ID of the trace to generate a URL for
   * @returns Promise that resolves to the trace URL
   *
   * @example
   * ```typescript
   * const traceId = "trace-123";
   * const url = await antsPlatform.getTraceUrl(traceId);
   * console.log(`View trace at: ${url}`);
   * ```
   */
  public async getTraceUrl(traceId: string) {
    let projectId = this.projectId;

    if (!projectId) {
      projectId = (await this.api.projects.get()).data[0].id;
      this.projectId = projectId;
    }

    const traceUrl = `${this.baseUrl}/project/${projectId}/traces/${traceId}`;

    return traceUrl;
  }
}
