import Anthropic from "@anthropic-ai/sdk";
import { Messages } from "../types";
import { BaseLlm, LlmResponse } from "./Base";
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
}