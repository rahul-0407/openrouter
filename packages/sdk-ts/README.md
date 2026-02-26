# openrouter-sdk

A lightweight, zero-dependency TypeScript SDK for the OpenRouter LLM gateway.

## Installation

```bash
bun add openrouter-sdk
# or
npm install openrouter-sdk
```

## Quick Start

```ts
import { OpenRouter } from "openrouter-sdk";

const client = new OpenRouter({
  apiKey: "your-api-key",
  baseUrl: "http://localhost:4000", // optional
  defaultModel: "google/gemini-2.0-flash", // optional
});
```

## Usage

### Chat (Non-Streaming)

```ts
const response = await client.chat({
  model: "google/gemini-2.0-flash",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.completions.choices[0].message.content);
```

### Chat (Streaming)

```ts
for await (const token of client.chatStream({
  messages: [{ role: "user", content: "Tell me a joke" }],
})) {
  process.stdout.write(token);
}
```

### List Models

```ts
const models = await client.models();
models.forEach((m) => console.log(m.slug));
```

### OpenAI Compatibility

```ts
import OpenAI from "openai";
import { createOpenAICompatibleClient } from "openrouter-sdk";

const config = createOpenAICompatibleClient({
  apiKey: "your-api-key",
  baseUrl: "http://localhost:4000",
});
const openai = new OpenAI(config);
```

## Error Handling

```ts
import { OpenRouterError } from "openrouter-sdk";

try {
  await client.chat({ messages: [{ role: "user", content: "Hi" }] });
} catch (err) {
  if (err instanceof OpenRouterError) {
    console.error(`Error ${err.status}: ${err.message}`);
  }
}
```
