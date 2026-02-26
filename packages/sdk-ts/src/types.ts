// ── Message Types ──────────────────────────────────────────────────────

/** A single message in a conversation. */
export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

// ── Chat Request / Response ────────────────────────────────────────────

/** Options for a chat completion request. */
export interface ChatRequest {
    /** Model identifier, e.g. "google/gemini-2.0-flash" */
    model?: string;
    /** Conversation messages */
    messages: Message[];
    /** Enable streaming (used internally) */
    stream?: boolean;
}

/** A single choice in a non-streaming chat response. */
export interface ChatChoice {
    message: {
        content: string;
    };
}

/** Non-streaming chat completion response. */
export interface ChatResponse {
    completions: {
        choices: ChatChoice[];
    };
    inputTokensConsumed: number;
    outputTokensConsumed: number;
}

// ── Streaming types ────────────────────────────────────────────────────

/** A single SSE event from the streaming endpoint. */
export interface StreamEvent {
    choices?: { delta: { content?: string } }[];
    error?: { message: string };
}

// ── Models ─────────────────────────────────────────────────────────────

/** Company that created a model. */
export interface Company {
    id: string;
    name: string;
    website: string;
}

/** An available model on the gateway. */
export interface Model {
    id: string;
    name: string;
    slug: string;
    company: Company;
}

/** Response from the models endpoint. */
export interface ModelsResponse {
    models: Model[];
}

// ── Client Config ──────────────────────────────────────────────────────

/** Configuration for the OpenRouter client. */
export interface OpenRouterConfig {
    /** Your API key (Bearer token) */
    apiKey: string;
    /** Base URL of the gateway. Defaults to http://localhost:4000 */
    baseUrl?: string;
    /** Default model to use when not specified per-request */
    defaultModel?: string;
}

// ── Error ──────────────────────────────────────────────────────────────

/** Error thrown by the OpenRouter SDK. */
export class OpenRouterError extends Error {
    public readonly status: number;
    public readonly body: unknown;

    constructor(message: string, status: number, body?: unknown) {
        super(message);
        this.name = "OpenRouterError";
        this.status = status;
        this.body = body;
    }
}
