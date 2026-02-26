import { Messages } from "../types";
import { BaseLlm, LlmResponse, LlmStreamResult } from "./Base";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class OpenAi extends BaseLlm {

  static async chat(model: string, messages: Messages): Promise<LlmResponse> {
    const response = await client.responses.create({
      model,
      input: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });

    return {
      inputTokensConsumed: response.usage?.input_tokens ?? 0,
      outputTokensConsumed: response.usage?.output_tokens ?? 0,
      completions: {
        choices: [{
          message: { content: response.output_text ?? "" }
        }]
      }
    };
  }

  static async chatStream(model: string, messages: Messages): Promise<LlmStreamResult> {

    const stream = await client.responses.stream({
      model,
      input: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });

    let inputTokens = 0;
    let outputTokens = 0;

    async function* tokenGenerator(): AsyncGenerator<string, void, unknown> {
      for await (const event of stream) {

        if (event.type === "response.output_text.delta") {
          yield event.delta;
        }

        if (event.type === "response.completed") {
          inputTokens = event.response.usage?.input_tokens ?? 0;
          outputTokens = event.response.usage?.output_tokens ?? 0;
        }
      }
    }

    return {
      stream: tokenGenerator(),
      getUsage: () => ({ inputTokens, outputTokens })
    };
  }
}