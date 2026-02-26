import { Messages } from "../types";
import { BaseLlm, LlmResponse, LlmStreamResult } from "./Base";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY
});

export class Gemini extends BaseLlm {

  static async chat(model: string, messages: Messages): Promise<LlmResponse> {
    const response = await ai.models.generateContent({
      model,
      contents: messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        text: m.content
      }))
    });

    return {
      outputTokensConsumed: response.usageMetadata?.candidatesTokenCount ?? 0,
      inputTokensConsumed: response.usageMetadata?.promptTokenCount ?? 0,
      completions: {
        choices: [{
          message: { content: response.text ?? "" }
        }]
      }
    };
  }

  static async chatStream(model: string, messages: Messages): Promise<LlmStreamResult> {

    const response = await ai.models.generateContentStream({
      model,
      contents: messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        text: m.content
      }))
    });

    let inputTokens = 0;
    let outputTokens = 0;

    async function* tokenGenerator(): AsyncGenerator<string, void, unknown> {
      for await (const chunk of response) {
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = chunk.usageMetadata.candidatesTokenCount ?? outputTokens;
        }
        if (chunk.text) yield chunk.text;
      }
    }

    return {
      stream: tokenGenerator(),
      getUsage: () => ({ inputTokens, outputTokens })
    };
  }
}