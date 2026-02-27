import { LlmResponse } from "./llms/Base";

// ── ID Generation ────────────────────────────────────────────────────
let counter = 0;
export function generateChatId(): string {
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `chatcmpl-${timestamp}${rand}${(counter++).toString(36)}`;
}

// ── Non-Streaming Response Mapper ────────────────────────────────────
export function toOpenAIChatCompletion(
    response: LlmResponse,
    model: string
) {
    return {
        id: generateChatId(),
        object: "chat.completion" as const,
        created: Math.floor(Date.now() / 1000),
        model,
        choices: response.completions.choices.map((choice, index) => ({
            index,
            message: {
                role: "assistant" as const,
                content: choice.message.content,
            },
            finish_reason: "stop" as const,
        })),
        usage: {
            prompt_tokens: response.inputTokensConsumed,
            completion_tokens: response.outputTokensConsumed,
            total_tokens: response.inputTokensConsumed + response.outputTokensConsumed,
        },
    };
}

// ── Streaming Chunk Mapper ───────────────────────────────────────────
export function toOpenAIStreamChunk(
    token: string,
    id: string,
    model: string,
    index: number = 0
) {
    return {
        id,
        object: "chat.completion.chunk" as const,
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index,
                delta: { content: token },
                finish_reason: null,
            },
        ],
    };
}

// ── Final Stream Chunk (finish_reason: stop) ─────────────────────────
export function toOpenAIFinalChunk(id: string, model: string) {
    return {
        id,
        object: "chat.completion.chunk" as const,
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
            {
                index: 0,
                delta: {},
                finish_reason: "stop" as const,
            },
        ],
    };
}

// ── Error Mapper ─────────────────────────────────────────────────────
type OpenAIErrorType =
    | "invalid_request_error"
    | "authentication_error"
    | "insufficient_quota"
    | "server_error"
    | "not_found_error";

export function toOpenAIError(
    statusCode: number,
    message: string
) {
    let type: OpenAIErrorType;
    let code: string;

    switch (statusCode) {
        case 401:
        case 403:
            type = "authentication_error";
            code = "invalid_api_key";
            break;
        case 402:
            type = "insufficient_quota";
            code = "insufficient_quota";
            break;
        case 404:
            type = "not_found_error";
            code = "model_not_found";
            break;
        case 400:
            type = "invalid_request_error";
            code = "invalid_request";
            break;
        default:
            type = "server_error";
            code = "internal_error";
            break;
    }

    return {
        error: {
            message,
            type,
            code,
        },
    };
}
