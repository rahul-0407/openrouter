import { Messages } from "../types";

export type LlmResponse = {
  completions: {
    choices: {
      message: {
        content: string
      }
    }[]
  },
  inputTokensConsumed: number,
  outputTokensConsumed: number
}

export type LlmStreamResult = {
  stream: AsyncGenerator<string, void, unknown>;
  getUsage: () => { inputTokens: number; outputTokens: number };
}

export class BaseLlm {
  static async chat(model: string, messages: Messages): Promise<LlmResponse> {
    throw new Error("Not implemented")
  }

  static async chatStream(model: string, messages: Messages): Promise<LlmStreamResult> {
    throw new Error("Not implemented")
  }
}