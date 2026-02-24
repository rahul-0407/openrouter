import bearer from "@elysiajs/bearer";
import { prisma, insertUsageMetric } from "db";
import { Elysia, t } from "elysia";
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/OpenAi";
import { Claude } from "./llms/Claude";
import { LlmResponse } from "./llms/Base";
import { openapi } from '@elysiajs/openapi'

const app = new Elysia()
.use(bearer())
.use(openapi())
.post("/api/v1/chat/completions", async ({ status, bearer: apiKey, body }) => {
  const startTime = performance.now();
  const model = body.model;
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
    // Record failed metric — invalid API key
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