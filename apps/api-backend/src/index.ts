import bearer from "@elysiajs/bearer";
import { prisma, insertUsageMetric, insertWalletTransaction } from "db";
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { Conversation, OpenAIConversation, Messages } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/OpenAi";
import { Claude } from "./llms/Claude";
import { LlmResponse, LlmStreamResult } from "./llms/Base";
import { openapi } from '@elysiajs/openapi'
import {
  generateChatId,
  toOpenAIChatCompletion,
  toOpenAIStreamChunk,
  toOpenAIFinalChunk,
  toOpenAIError,
} from "./openai-compat";

// ── Shared handler result types ──────────────────────────────────────
type HandlerSuccess = {
  ok: true;
  response: LlmResponse;
  model: string;
  userId: number;
  apiKey: string;
  providerName: string;
  inputTokenCost: number;
  outputTokenCost: number;
};

type HandlerStreamSuccess = {
  ok: true;
  streaming: true;
  streamResult: LlmStreamResult;
  model: string;
  userId: number;
  apiKey: string;
  providerName: string;
  inputTokenCost: number;
  outputTokenCost: number;
};

type HandlerError = {
  ok: false;
  statusCode: number;
  message: string;
};

type HandlerResult = HandlerSuccess | HandlerStreamSuccess | HandlerError;

// ── Core handler — shared by both routes ─────────────────────────────
async function handleChatCompletion(
  apiKey: string | undefined,
  body: { model: string; messages: Messages; stream?: boolean }
): Promise<HandlerResult> {
  const startTime = performance.now();
  const model = body.model;
  const isStreaming = body.stream === true;
  const [_companyName, providerModelName] = model.split("/");

  const apiKeyDb = await prisma.apiKey.findFirst({
    where: {
      apiKey,
      disabled: false,
      deleted: false
    },
    select: {
      user: true
    }
  });

  if (!apiKeyDb) {
    const latencyMs = Math.round(performance.now() - startTime);
    insertUsageMetric({
      userId: 0,
      apiKey: apiKey ?? "unknown",
      model,
      provider: "unknown",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      latencyMs,
      success: false,
    });
    return { ok: false, statusCode: 403, message: "Invalid api key" };
  }

  if (apiKeyDb?.user.walletBalance <= 0) {
    const latencyMs = Math.round(performance.now() - startTime);
    insertUsageMetric({
      userId: apiKeyDb.user.id,
      apiKey: apiKey ?? "unknown",
      model,
      provider: "unknown",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      latencyMs,
      success: false,
    });
    return { ok: false, statusCode: 402, message: "Insufficient wallet balance" };
  }

  const modelDb = await prisma.model.findFirst({
    where: { slug: model }
  });

  if (!modelDb) {
    const latencyMs = Math.round(performance.now() - startTime);
    insertUsageMetric({
      userId: apiKeyDb.user.id,
      apiKey: apiKey ?? "unknown",
      model,
      provider: "unknown",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      latencyMs,
      success: false,
    });
    return { ok: false, statusCode: 404, message: "This is an invalid model we dont support" };
  }

  const providers = await prisma.modelProviderMapping.findMany({
    where: { modelId: modelDb.id },
    include: { provider: true }
  });

  const provider = providers[Math.floor(Math.random() * providers.length)];
  const companyName = model.split("/")[0];

  // ── STREAMING PATH ──────────────────────────────────────────────
  if (isStreaming) {
    let streamResult: LlmStreamResult | null = null;

    try {
      if (companyName === "google") {
        streamResult = await Gemini.chatStream(providerModelName, body.messages);
      } else if (companyName === "openai") {
        streamResult = await OpenAi.chatStream(providerModelName, body.messages);
      } else if (companyName === "anthropic") {
        streamResult = await Claude.chatStream(providerModelName, body.messages);
      }
    } catch (err) {
      console.error("[stream] Provider error:", err);
      const latencyMs = Math.round(performance.now() - startTime);
      insertUsageMetric({
        userId: apiKeyDb.user.id,
        apiKey: apiKey ?? "unknown",
        model,
        provider: provider?.provider?.name ?? "unknown",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        latencyMs,
        success: false,
      });
      return { ok: false, statusCode: 500, message: "Provider error" };
    }

    if (!streamResult) {
      const latencyMs = Math.round(performance.now() - startTime);
      insertUsageMetric({
        userId: apiKeyDb.user.id,
        apiKey: apiKey ?? "unknown",
        model,
        provider: provider?.provider?.name ?? "unknown",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        latencyMs,
        success: false,
      });
      return { ok: false, statusCode: 404, message: "No provider found for this model" };
    }

    return {
      ok: true,
      streaming: true,
      streamResult,
      model,
      userId: apiKeyDb.user.id,
      apiKey: apiKey ?? "unknown",
      providerName: provider.provider.name,
      inputTokenCost: provider.inputTokenCost,
      outputTokenCost: provider.outputTokenCost,
    };
  }

  // ── NON-STREAMING PATH ─────────────────────────────────────────
  let response: LlmResponse | null = null;
  try {
    if (companyName === "google") {
      response = await Gemini.chat(providerModelName, body.messages);
    } else if (companyName === "openai") {
      response = await OpenAi.chat(providerModelName, body.messages);
    } else if (companyName === "anthropic") {
      response = await Claude.chat(providerModelName, body.messages);
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    insertUsageMetric({
      userId: apiKeyDb.user.id,
      apiKey: apiKey ?? "unknown",
      model,
      provider: provider?.provider?.name ?? "unknown",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      latencyMs,
      success: false,
    });
    return { ok: false, statusCode: 500, message: "Provider error" };
  }

  if (!response) {
    const latencyMs = Math.round(performance.now() - startTime);
    insertUsageMetric({
      userId: apiKeyDb.user.id,
      apiKey: apiKey ?? "unknown",
      model,
      provider: provider?.provider?.name ?? "unknown",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      latencyMs,
      success: false,
    });
    return { ok: false, statusCode: 404, message: "No provider found for this model" };
  }

  const inputTokens = response.inputTokensConsumed;
  const outputTokens = response.outputTokensConsumed;
  const totalTokens = inputTokens + outputTokens;
  const cost = (inputTokens * provider.inputTokenCost + outputTokens * provider.outputTokenCost) / 10;
  const latencyMs = Math.round(performance.now() - startTime);

  // Deduct wallet balance (atomic guard against negative)
  await prisma.user.updateMany({
    where: { id: apiKeyDb.user.id, walletBalance: { gte: cost } },
    data: { walletBalance: { decrement: cost } }
  });
  await prisma.apiKey.update({
    where: { apiKey: apiKey },
    data: { creditsConsumed: { increment: Math.round(cost) } }
  });

  // Record wallet transaction (DEBIT)
  insertWalletTransaction({
    userId: apiKeyDb.user.id,
    amount: cost,
    type: "DEBIT",
    description: `LLM usage: ${model}`,
  });

  // Record successful usage metric
  insertUsageMetric({
    userId: apiKeyDb.user.id,
    apiKey: apiKey ?? "unknown",
    model,
    provider: provider.provider.name,
    inputTokens,
    outputTokens,
    totalTokens,
    cost,
    latencyMs,
    success: true,
  });

  return {
    ok: true,
    response,
    model,
    userId: apiKeyDb.user.id,
    apiKey: apiKey ?? "unknown",
    providerName: provider.provider.name,
    inputTokenCost: provider.inputTokenCost,
    outputTokenCost: provider.outputTokenCost,
  };
}

// ── Build streaming Response for the legacy route ────────────────────
function buildLegacyStreamResponse(result: HandlerStreamSuccess): Response {
  const { streamResult, model, userId, apiKey, providerName, inputTokenCost, outputTokenCost } = result;
  const { stream: tokenStream, getUsage } = streamResult;
  const startTime = performance.now();

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const token of tokenStream) {
          const chunk = JSON.stringify({
            choices: [{ delta: { content: token } }]
          });
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        const latencyMs = Math.round(performance.now() - startTime);
        const usage = getUsage();
        const totalTokens = usage.inputTokens + usage.outputTokens;
        const cost = (usage.inputTokens * inputTokenCost + usage.outputTokens * outputTokenCost) / 10;

        prisma.user.updateMany({
          where: { id: userId, walletBalance: { gte: cost } },
          data: { walletBalance: { decrement: cost } }
        }).catch(() => { });
        prisma.apiKey.update({
          where: { apiKey },
          data: { creditsConsumed: { increment: Math.round(cost) } }
        }).catch(() => { });

        insertWalletTransaction({ userId, amount: cost, type: "DEBIT", description: `LLM usage: ${model}` });
        insertUsageMetric({
          userId, apiKey, model, provider: providerName,
          inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
          totalTokens, cost, latencyMs, success: true,
        });
      } catch (err) {
        const errorChunk = JSON.stringify({ error: { message: "Stream interrupted" } });
        controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        const latencyMs = Math.round(performance.now() - startTime);
        insertUsageMetric({
          userId, apiKey, model, provider: providerName,
          inputTokens: 0, outputTokens: 0, totalTokens: 0,
          cost: 0, latencyMs, success: false,
        });
      }
    }
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": process.env.FRONTEND_ORIGIN ?? "*",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

// ── Build streaming Response for the OpenAI-compat route ─────────────
function buildOpenAIStreamResponse(result: HandlerStreamSuccess): Response {
  const { streamResult, model, userId, apiKey, providerName, inputTokenCost, outputTokenCost } = result;
  const { stream: tokenStream, getUsage } = streamResult;
  const startTime = performance.now();
  const chatId = generateChatId();

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const token of tokenStream) {
          const chunk = JSON.stringify(toOpenAIStreamChunk(token, chatId, model));
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        // Final chunk with finish_reason: "stop"
        const finalChunk = JSON.stringify(toOpenAIFinalChunk(chatId, model));
        controller.enqueue(encoder.encode(`data: ${finalChunk}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        const latencyMs = Math.round(performance.now() - startTime);
        const usage = getUsage();
        const totalTokens = usage.inputTokens + usage.outputTokens;
        const cost = (usage.inputTokens * inputTokenCost + usage.outputTokens * outputTokenCost) / 10;

        prisma.user.updateMany({
          where: { id: userId, walletBalance: { gte: cost } },
          data: { walletBalance: { decrement: cost } }
        }).catch(() => { });
        prisma.apiKey.update({
          where: { apiKey },
          data: { creditsConsumed: { increment: Math.round(cost) } }
        }).catch(() => { });

        insertWalletTransaction({ userId, amount: cost, type: "DEBIT", description: `LLM usage: ${model}` });
        insertUsageMetric({
          userId, apiKey, model, provider: providerName,
          inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
          totalTokens, cost, latencyMs, success: true,
        });
      } catch (err) {
        const errorChunk = JSON.stringify(toOpenAIError(500, "Stream interrupted"));
        controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        const latencyMs = Math.round(performance.now() - startTime);
        insertUsageMetric({
          userId, apiKey, model, provider: providerName,
          inputTokens: 0, outputTokens: 0, totalTokens: 0,
          cost: 0, latencyMs, success: false,
        });
      }
    }
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": process.env.FRONTEND_ORIGIN ?? "*",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

// ── Elysia App ───────────────────────────────────────────────────────
const app = new Elysia()
  .use(cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3001",
    credentials: true,
  }))
  .use(bearer())
  .use(openapi())

  // ── Legacy route (backward compatible) ───────────────────────────
  .post("/api/v1/chat/completions", async ({ status, bearer: apiKey, body }) => {
    const result = await handleChatCompletion(apiKey, body);

    if (!result.ok) {
      return status(result.statusCode as any, { message: result.message });
    }

    if ("streaming" in result) {
      return buildLegacyStreamResponse(result);
    }

    return result.response;
  }, {
    body: Conversation
  })

  // ── OpenAI-compatible route (/v1/chat/completions) ───────────────
  .post("/v1/chat/completions", async ({ status, bearer: apiKey, body }) => {
    const result = await handleChatCompletion(apiKey, body);

    if (!result.ok) {
      return status(result.statusCode as any, toOpenAIError(result.statusCode, result.message));
    }

    if ("streaming" in result) {
      return buildOpenAIStreamResponse(result);
    }

    return toOpenAIChatCompletion(result.response, result.model);
  }, {
    body: OpenAIConversation
  })

  .listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);