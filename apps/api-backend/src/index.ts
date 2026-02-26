import bearer from "@elysiajs/bearer";
import { prisma, insertUsageMetric, insertWalletTransaction } from "db";
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/OpenAi";
import { Claude } from "./llms/Claude";
import { LlmResponse, LlmStreamResult } from "./llms/Base";
import { openapi } from '@elysiajs/openapi'

const app = new Elysia()
  .use(cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3001",
    credentials: true,
  }))
  .use(bearer())
  .use(openapi())
  .post("/api/v1/chat/completions", async ({ status, bearer: apiKey, body }) => {
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
    })

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
      return status(403, {
        message: "Invalid api key"
      })
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
      return status(402, {
        message: "Insufficient wallet balance"
      })
    }

    const modelDb = await prisma.model.findFirst({
      where: {
        slug: model
      }
    })

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
      return status(403, {
        message: "This is an invalid model we dont support"
      })
    }

    const providers = await prisma.modelProviderMapping.findMany({
      where: {
        modelId: modelDb.id
      },
      include: {
        provider: true
      }
    })

    const provider = providers[Math.floor(Math.random() * providers.length)];

    // Determine adapter from model slug prefix (more reliable than DB provider name)
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
        return status(500, { message: "Provider error" });
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
        return status(403, { message: "No provider found for this model" });
      }

      const { stream: tokenStream, getUsage } = streamResult;
      const userId = apiKeyDb.user.id;
      const providerName = provider.provider.name;
      const inputTokenCost = provider.inputTokenCost;
      const outputTokenCost = provider.outputTokenCost;

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

            // Record success metric after stream completes
            const latencyMs = Math.round(performance.now() - startTime);
            const usage = getUsage();
            const totalTokens = usage.inputTokens + usage.outputTokens;
            const cost = (usage.inputTokens * inputTokenCost + usage.outputTokens * outputTokenCost) / 10;

            // Deduct wallet balance (fire-and-forget, guard against negative)
            prisma.user.updateMany({
              where: { id: userId, walletBalance: { gte: cost } },
              data: { walletBalance: { decrement: cost } }
            }).catch(() => { });
            prisma.apiKey.update({
              where: { apiKey: apiKey },
              data: { creditsConsumed: { increment: Math.round(cost) } }
            }).catch(() => { });

            insertWalletTransaction({
              userId,
              amount: cost,
              type: "DEBIT",
              description: `LLM usage: ${model}`,
            });

            insertUsageMetric({
              userId,
              apiKey: apiKey ?? "unknown",
              model,
              provider: providerName,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              totalTokens,
              cost,
              latencyMs,
              success: true,
            });
          } catch (err) {
            // Mid-stream failure
            const errorChunk = JSON.stringify({ error: { message: "Stream interrupted" } });
            controller.enqueue(encoder.encode(`data: ${errorChunk}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();

            const latencyMs = Math.round(performance.now() - startTime);
            insertUsageMetric({
              userId,
              apiKey: apiKey ?? "unknown",
              model,
              provider: providerName,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              cost: 0,
              latencyMs,
              success: false,
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

    // ── NON-STREAMING PATH (existing behavior) ─────────────────────
    let response: LlmResponse | null = null
    try {
      if (companyName === "google") {
        response = await Gemini.chat(providerModelName, body.messages)
      } else if (companyName === "openai") {
        response = await OpenAi.chat(providerModelName, body.messages)
      } else if (companyName === "anthropic") {
        response = await Claude.chat(providerModelName, body.messages)
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
      return status(500, {
        message: "Provider error"
      })
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
      return status(403, {
        message: "No provider found for this model"
      })
    }

    const inputTokens = response.inputTokensConsumed;
    const outputTokens = response.outputTokensConsumed;
    const totalTokens = inputTokens + outputTokens;
    const cost = (inputTokens * provider.inputTokenCost + outputTokens * provider.outputTokenCost) / 10;
    const latencyMs = Math.round(performance.now() - startTime);

    // Deduct wallet balance (atomic guard against negative)
    await prisma.user.updateMany({
      where: {
        id: apiKeyDb.user.id,
        walletBalance: { gte: cost }
      },
      data: {
        walletBalance: {
          decrement: cost
        }
      }
    });
    await prisma.apiKey.update({
      where: {
        apiKey: apiKey
      },
      data: {
        creditsConsumed: {
          increment: Math.round(cost)
        }
      }
    });

    // Record wallet transaction (DEBIT)
    insertWalletTransaction({
      userId: apiKeyDb.user.id,
      amount: cost,
      type: "DEBIT",
      description: `LLM usage: ${model}`,
    });

    // Record successful usage metric (fire-and-forget)
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

    return response;
  }, {
    body: Conversation
  }).listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);