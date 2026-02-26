import type { StreamEvent } from "./types";

/**
 * Parse an SSE response stream and yield tokens.
 *
 * Handles the standard "data: {json}\n\n" format used by
 * the openrouter chat completions endpoint.
 *
 * Terminates on "data: [DONE]" or when the stream closes.
 */
export async function* parseSSEStream(
    response: Response,
): AsyncGenerator<string, void, unknown> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // Keep the last (potentially incomplete) line in the buffer
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;

                const payload = trimmed.slice(6); // strip "data: "

                if (payload === "[DONE]") {
                    return;
                }

                try {
                    const event: StreamEvent = JSON.parse(payload);

                    if (event.error) {
                        throw new Error(event.error.message ?? "Stream error");
                    }

                    const token = event.choices?.[0]?.delta?.content;
                    if (token) {
                        yield token;
                    }
                } catch (err) {
                    // Re-throw SDK errors, skip malformed JSON
                    if (err instanceof Error && err.message !== "Stream error") {
                        // Malformed chunk — skip silently
                    } else {
                        throw err;
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}
