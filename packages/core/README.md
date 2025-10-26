# @antsplatform/core

Core package of the Ants Platform SDK containing the public API client, logger, utilities, and more.

## Installation

```bash
npm install @antsplatform/core
```

## Features

- **API Client**: Complete API client for interacting with Ants Platform services
- **Utilities**: Core utilities and helper functions
- **Type Definitions**: Full TypeScript support with comprehensive type definitions
- **Logger**: Built-in logging functionality for debugging and monitoring

## Usage

```javascript
import { AntsPlatformAPIClient } from "@antsplatform/core";

// Initialize the client
const client = new AntsPlatformAPIClient({
  baseUrl: "https://api.ants-platform.com",
  username: "your-public-key",
  password: "your-secret-key",
});

// Use the client to interact with the API
```

## Environment Variables

The SDK supports the following environment variables:

- `ANTS_PLATFORM_PUBLIC_KEY`: Your public API key
- `ANTS_PLATFORM_SECRET_KEY`: Your secret API key
- `ANTS_PLATFORM_BASE_URL`: Base URL for the API (defaults to https://api.ants-platform.com)
- `ANTS_PLATFORM_LOG_LEVEL`: Logging level (ERROR, WARN, INFO, DEBUG)

## Documentation

- [Docs](https://agenticants.ai/docs)

## Related Packages

| Package                   | Description                                     |
| ------------------------- | ----------------------------------------------- |
| `@antsplatform/client`    | Client package for browser and Node.js          |
| `@antsplatform/tracing`   | OpenTelemetry-based tracing and instrumentation |
| `@antsplatform/otel`      | OpenTelemetry export helpers                    |
| `@antsplatform/openai`    | Integration for OpenAI SDK                      |
| `@antsplatform/langchain` | Integration for LangChain                       |

## License

MIT
