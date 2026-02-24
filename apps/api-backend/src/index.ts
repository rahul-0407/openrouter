import bearer from "@elysiajs/bearer";
import { prisma, insertUsageMetric } from "db";
import { Elysia, t } from "elysia";
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/OpenAi";
import { Claude } from "./llms/Claude";
import { LlmResponse, LlmStreamResult } from "./llms/Base";
import { openapi } from '@elysiajs/openapi'

const app = new Elysia()
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

  if (apiKeyDb?.user.credits <= 0) {
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
      message: "You dont have enough credits in your db"
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

  // ── STREAMING PATH ──────────────────────────────────────────────
  if (isStreaming) {
    let streamResult: LlmStreamResult | null = null;

    try {
      if (provider.provider.name === "Google API" || provider.provider.name === "Google Vertex") {
        streamResult = await Gemini.chatStream(providerModelName, body.messages);
      } else if (provider.provider.name === "OpenAI") {
        streamResult = await OpenAi.chatStream(providerModelName, body.messages);
      } else if (provider.provider.name === "Claude API") {
        streamResult = await Claude.chatStream(providerModelName, body.messages);
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
          const creditsUsed = (usage.inputTokens * inputTokenCost + usage.outputTokens * outputTokenCost) / 10;

          // Deduct credits (fire-and-forget)
          prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: creditsUsed } }
          }).catch(() => {});
          prisma.apiKey.update({
            where: { apiKey: apiKey },
            data: { creditsConsumed: { increment: creditsUsed } }
          }).catch(() => {});

          insertUsageMetric({
            userId,
            apiKey: apiKey ?? "unknown",
            model,
            provider: providerName,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens,
            cost: creditsUsed,
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
    "Access-Control-Allow-Origin": "http://localhost:3001",
    "Access-Control-Allow-Credentials": "true",
  },
});
  }

  // ── NON-STREAMING PATH (existing behavior) ─────────────────────
  let response: LlmResponse | null = null
  try {
    if (provider.provider.name === "Google API") {
      response = await Gemini.chat(providerModelName, body.messages)
    }

    if (provider.provider.name === "Google Vertex") {
      response = await Gemini.chat(providerModelName, body.messages)
    }
    
    if (provider.provider.name === "OpenAI") {
      response = await OpenAi.chat(providerModelName, body.messages)
    }
    
    if (provider.provider.name === "Claude API") {
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
  const creditsUsed = (inputTokens * provider.inputTokenCost + outputTokens * provider.outputTokenCost) / 10;
  const latencyMs = Math.round(performance.now() - startTime);

  const res = await prisma.user.update({
    where: {
      id: apiKeyDb.user.id
    },
    data: {
      credits: {
        decrement: creditsUsed
      }
    }
  });
  const res2 = await prisma.apiKey.update({
    where: {
      apiKey: apiKey
    }, 
    data: {
      creditsConsumed: {
        increment: creditsUsed
      }
    }
  })

  // Record successful usage metric (fire-and-forget)
  insertUsageMetric({
    userId: apiKeyDb.user.id,
    apiKey: apiKey ?? "unknown",
    model,
    provider: provider.provider.name,
    inputTokens,
    outputTokens,
    totalTokens,
    cost: creditsUsed,
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