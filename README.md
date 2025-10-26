<p align="center">
  <img src="./static/logo.png" alt="Ants Platform Logo" width="400">
</p>

# Ants Platform JS/TS SDK

[![MIT License](https://img.shields.io/badge/License-MIT-red.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/ants-platform.svg)](https://www.npmjs.com/package/ants-platform)

Modular mono repo for the Ants Platform JS/TS client libraries.

## Packages

| Package                                         | NPM                                                                                                                       | Description                                                    | Environments |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------ |
| [@antsplatform/client](./packages/client)       | [![NPM](https://img.shields.io/npm/v/@antsplatform/client.svg)](https://www.npmjs.com/package/@antsplatform/client)       | Ants Platform API client for universal JavaScript environments | Universal JS |
| [@antsplatform/tracing](./packages/tracing)     | [![NPM](https://img.shields.io/npm/v/@antsplatform/tracing.svg)](https://www.npmjs.com/package/@antsplatform/tracing)     | Ants Platform instrumentation methods based on OpenTelemetry   | Node.js 20+  |
| [@antsplatform/otel](./packages/otel)           | [![NPM](https://img.shields.io/npm/v/@antsplatform/otel.svg)](https://www.npmjs.com/package/@antsplatform/otel)           | Ants Platform OpenTelemetry export helpers                     | Node.js 20+  |
| [@antsplatform/openai](./packages/openai)       | [![NPM](https://img.shields.io/npm/v/@antsplatform/openai.svg)](https://www.npmjs.com/package/@antsplatform/openai)       | Ants Platform integration for OpenAI SDK                       | Universal JS |
| [@antsplatform/langchain](./packages/langchain) | [![NPM](https://img.shields.io/npm/v/@antsplatform/langchain.svg)](https://www.npmjs.com/package/@antsplatform/langchain) | Ants Platform integration for LangChain                        | Universal JS |

## Installation

```bash
npm install antsplatform
# or
yarn add antsplatform
# or
pnpm add antsplatform
```

## Quick Start

```javascript
import { AntsPlatformClient } from "antsplatform";

const client = new AntsPlatformClient({
  publicKey: "your-public-key",
  secretKey: "your-secret-key",
  baseUrl: "https://api.ants-platform.com", // optional
});
```

## Documentation

- [Docs](https://agenticants.ai/docs)

## Development

This is a monorepo managed with pnpm. See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development instructions.

Quick start:

```bash
pnpm install    # Install dependencies
pnpm build      # Build all packages
pnpm test       # Run tests
pnpm ci         # Run full CI suite
```

## License

[MIT](LICENSE)
