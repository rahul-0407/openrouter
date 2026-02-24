import { Messages } from "../types";
import { BaseLlm, LlmResponse, LlmStreamResult } from "./Base";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY
});


export class Gemini extends BaseLlm {
    static async chat(model: string, messages: Messages): Promise<LlmResponse> {
        const response = await ai.models.generateContent({
            model: model,
            contents: messages.map(message => ({
                text: message.content,
                role: message.role
            }))
        });

        return {
            outputTokensConsumed: response.usageMetadata?.candidatesTokenCount!,
            inputTokensConsumed: response.usageMetadata?.promptTokenCount!,
            completions: {
                choices: [{
                    message: {
                        content: response.text!
                    }
                }]
            }
        }
    }

    static async chatStream(model: string, messages: Messages): Promise<LlmStreamResult> {
        const response = await ai.models.generateContentStream({
            model: model,
            contents: messages.map(message => ({
                text: message.content,
                role: message.role
            }))
        });

        let inputTokens = 0;
        let outputTokens = 0;

        async function* tokenGenerator(): AsyncGenerator<string, void, unknown> {
            for await (const chunk of response) {
                // Capture usage from each chunk (final chunk has totals)
                if (chunk.usageMetadata) {
                    inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
                    outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
                }
                const text = chunk.text;
                if (text) {
                    yield text;
                }
            }
        }

        return {
            stream: tokenGenerator(),
            getUsage: () => ({ inputTokens, outputTokens }),
        };
    }
}