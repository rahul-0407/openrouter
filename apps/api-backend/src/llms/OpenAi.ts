import { Messages } from "../types";
import { BaseLlm, LlmResponse, LlmStreamResult } from "./Base";
import OpenAI from "openai";
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export class OpenAi extends BaseLlm {
    static async chat(model: string, messages: Messages): Promise<LlmResponse> {
        const response = await client.responses.create({
            model: model,
            input:  messages.map(message => ({
                role: message.role,
                content: message.content
            }))
        });

        return {
            inputTokensConsumed: response.usage?.input_tokens!,
            outputTokensConsumed: response.usage?.output_tokens!,
            completions: {
                choices: [{
                    message: {
                        content: response.output_text
                    }
                }]
            }
        }
    }

    static async chatStream(model: string, messages: Messages): Promise<LlmStreamResult> {
        const stream = await client.responses.create({
            model: model,
            input: messages.map(message => ({
                role: message.role,
                content: message.content
            })),
            stream: true,
        });

        let inputTokens = 0;
        let outputTokens = 0;

        async function* tokenGenerator(): AsyncGenerator<string, void, unknown> {
            for await (const event of stream) {
                if (event.type === "response.output_text.delta") {
                    yield event.delta;
                }
                if (event.type === "response.completed" && event.response.usage) {
                    inputTokens = event.response.usage.input_tokens;
                    outputTokens = event.response.usage.output_tokens;
                }
            }
        }

        return {
            stream: tokenGenerator(),
            getUsage: () => ({ inputTokens, outputTokens }),
        };
    }
}