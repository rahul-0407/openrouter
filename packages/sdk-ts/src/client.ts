import { parseSSEStream } from "./stream";
import type {
    OpenRouterConfig,
    ChatRequest,
    ChatResponse,
    Model,
    ModelsResponse,
    Message,
} from "./types";
import { OpenRouterError } from "./types";

const DEFAULT_BASE_URL = "http://localhost:4000";

/**
 * OpenRouter SDK client.
 *
 * @example
 * ```ts
 * const client = new OpenRouter({ apiKey: "sk-or-..." });
 *
 * // Non-streaming chat
 * const res = await client.chat({
 *   model: "google/gemini-2.0-flash",
 *   messages: [{ role: "user", content: "Hello!" }],
 * });
 * console.log(res.completions.choices[0].message.content);
 *
 * // Streaming chat
 * for await (const token of client.chatStream({
 *   messages: [{ role: "user", content: "Tell me a joke" }],
 * })) {
 *   process.stdout.write(token);
 * }
 *
 * // List models
 * const models = await client.models();
 * ```
 */
export class OpenRouter {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultModel?: string;

    constructor(config: OpenRouterConfig) {
        if (!config.apiKey) {
            throw new OpenRouterError(
                "apiKey is required. Pass it via new OpenRouter({ apiKey: '...' })",
                0,
            );
        }

        this.apiKey = config.apiKey;
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.defaultModel = config.defaultModel;
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private resolveModel(request: ChatRequest): string {
        const model = request.model ?? this.defaultModel;
        if (!model) {
            throw new OpenRouterError(
                "No model specified. Either pass model in the request or set a defaultModel in the constructor.",
                0,
            );
        }
        return model;
    }

    private headers(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
    }

    private async handleErrorResponse(response: Response): Promise<never> {
        let body: unknown;
        try {
            body = await response.json();
        } catch {
            body = await response.text().catch(() => null);
        }

        const message =
            (body as { message?: string })?.message ??
            `Request failed with status ${response.status}`;

        throw new OpenRouterError(message, response.status, body);
    }

    // ── Chat (non-streaming) ───────────────────────────────────────────

    /**
     * Send a chat completion request and receive the full response.
     *
     * @param request - Chat request with model and messages
     * @returns The complete chat response
     */
    async chat(request: ChatRequest): Promise<ChatResponse> {
        const model = this.resolveModel(request);

        const response = await fetch(`${this.baseUrl}/api/v1/chat/completions`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({
                model,
                messages: request.messages,
                stream: false,
            }),
        });

        if (!response.ok) {
            await this.handleErrorResponse(response);
        }

        return response.json() as Promise<ChatResponse>;
    }

    // ── Chat (streaming) ──────────────────────────────────────────────

    /**
     * Send a streaming chat completion request.
     * Returns an async generator that yields string tokens.
     *
     * @param request - Chat request with model and messages
     * @yields Individual text tokens as they arrive
     *
     * @example
     * ```ts
     * for await (const token of client.chatStream({ messages })) {
     *   process.stdout.write(token);
     * }
     * ```
     */
    async *chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
        const model = this.resolveModel(request);

        const response = await fetch(`${this.baseUrl}/api/v1/chat/completions`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({
                model,
                messages: request.messages,
                stream: true,
            }),
        });

        if (!response.ok) {
            await this.handleErrorResponse(response);
        }

        yield* parseSSEStream(response);
    }

    // ── Models ────────────────────────────────────────────────────────

    /**
     * List all available models on the gateway.
     *
     * @returns Array of available models
     */
    async models(): Promise<Model[]> {
        // Models endpoint is on the primary backend (port 3000 by default).
        // We derive it from baseUrl: if user points at api-backend (:4000),
        // we also try the same host. Users can override if needed.
        const response = await fetch(`${this.baseUrl}/models`, {
            method: "GET",
            headers: this.headers(),
        });

        if (!response.ok) {
            await this.handleErrorResponse(response);
        }

        const data = (await response.json()) as ModelsResponse;
        return data.models;
    }
}

// ── OpenAI Compatibility Helper ───────────────────────────────────────

/**
 * Create an OpenAI-SDK-compatible configuration object.
 *
 * Use this to plug openrouter into any library that accepts
 * the OpenAI client configuration shape (baseURL + apiKey).
 *
 * @example
 * ```ts
 * import OpenAI from "openai";
 * const config = createOpenAICompatibleClient({ apiKey: "sk-or-...", baseUrl: "http://localhost:4000" });
 * const openai = new OpenAI(config);
 * ```
 */
export function createOpenAICompatibleClient(config: {
    apiKey: string;
    baseUrl?: string;
}): { apiKey: string; baseURL: string } {
    const base = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    return {
        apiKey: config.apiKey,
        baseURL: `${base}/api/v1`,
    };
}
