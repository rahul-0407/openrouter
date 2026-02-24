import Anthropic from "@anthropic-ai/sdk";
import { Messages } from "../types";
import { BaseLlm, LlmResponse, LlmStreamResult } from "./Base";
import { TextBlock } from "@anthropic-ai/sdk/resources";

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});


export class Claude extends BaseLlm {
    static async chat(model: string, messages: Messages): Promise<LlmResponse> {
        
        const response = await client.messages.create({
            max_tokens: 2048,
            messages: messages.map(message => ({
                role: message.role,
                content: message.content
            })),
            model: model
        });

        return {
            outputTokensConsumed: response.usage.output_tokens,
            inputTokensConsumed: response.usage.input_tokens,
            completions: {
                choices: response.content.map(content => ({
                    message: {
                        content: (content as TextBlock).text
                    }
                }))
            }
        }
  
    }

    static async chatStream(model: string, messages: Messages): Promise<LlmStreamResult> {
        const stream = client.messages.stream({
            max_tokens: 2048,
            messages: messages.map(message => ({
                role: message.role,
                content: message.content
            })),
            model: model,
        });

        let inputTokens = 0;
        let outputTokens = 0;

        async function* tokenGenerator(): AsyncGenerator<string, void, unknown> {
            for await (const event of stream) {
                if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                    yield event.delta.text;
                }
                if (event.type === "message_delta" && event.usage) {
                    outputTokens = event.usage.output_tokens;
                }
            }
            // Get final usage from the accumulated message
            const finalMessage = await stream.finalMessage();
            inputTokens = finalMessage.usage.input_tokens;
            outputTokens = finalMessage.usage.output_tokens;
        }

        return {
            stream: tokenGenerator(),
            getUsage: () => ({ inputTokens, outputTokens }),
        };
    }
}