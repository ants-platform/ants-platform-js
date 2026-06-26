# Using `ants-platform`

The SDK has **no default export** — everything is a named export. The main entry
point is `AntsPlatformClient` (not `import AntsPlatform`).

Install:

```sh
npm install ants-platform
# or: pnpm add ants-platform / yarn add ants-platform
```

## ESM

```ts
import { AntsPlatformClient } from "ants-platform";

const client = new AntsPlatformClient({
  publicKey: process.env.ANTS_PLATFORM_PUBLIC_KEY, // "pk_..."
  secretKey: process.env.ANTS_PLATFORM_SECRET_KEY, // "sk_..."
  baseUrl: "https://api.agenticants.ai", // set explicitly — see note below
});
```

## CommonJS

```js
const { AntsPlatformClient } = require("ants-platform");

const client = new AntsPlatformClient({
  publicKey: "pk_...",
  secretKey: "sk_...",
  baseUrl: "https://api.agenticants.ai",
});
```

## Env-var form (no constructor args)

The constructor falls back to environment variables:

```ts
import { AntsPlatformClient } from "ants-platform";

// Reads ANTS_PLATFORM_PUBLIC_KEY, ANTS_PLATFORM_SECRET_KEY, ANTS_PLATFORM_BASE_URL
const client = new AntsPlatformClient();
```

## Other named exports from the same entry

`AntsGuardrailsClient`, `observe`, `startObservation`, `PromptManager`,
`ScoreManager`, `DatasetManager`, plus OTel/tracing helpers
(`getAntsPlatformTracer`, `createTraceId`, `getActiveTraceId`, ...).

## Note: set `baseUrl` explicitly

The hardcoded default in the client is still the dead
`https://api.ants-platform.com`. Until that default is fixed, always pass
`baseUrl: "https://api.agenticants.ai"` (or set `ANTS_PLATFORM_BASE_URL`),
otherwise requests go to the wrong host.
