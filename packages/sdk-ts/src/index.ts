/**
 * OpenRouter TypeScript SDK
 *
 * A lightweight, zero-dependency SDK for the OpenRouter LLM gateway.
 *
 * @packageDocumentation
 */

// Client
export { OpenRouter, createOpenAICompatibleClient } from "./client";

// Types
export type {
    OpenRouterConfig,
    Message,
    ChatRequest,
    ChatResponse,
    ChatChoice,
    StreamEvent,
    Model,
    Company,
    ModelsResponse,
} from "./types";

export { OpenRouterError } from "./types";

// Stream utilities (advanced usage)
export { parseSSEStream } from "./stream";
