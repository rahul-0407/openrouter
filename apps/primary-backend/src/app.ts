import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { app as authApp } from "./modules/auth";
import { app as apiKeyApp } from "./modules/apiKeys";
import { app as modelsApp } from "./modules/models";
import { app as paymentsApp } from "./modules/payments";
import { app as metricsApp } from "./modules/metrics";
import { app as providerHealthApp } from "./modules/provider-health";
import { conversationApp } from "./modules/conversations";

export const app = new Elysia()
  .use(cors({
    origin: [/localhost:3001/, /localhost:3002/],
    credentials: true
  }))
  .use(authApp)
  .use(apiKeyApp)
  .use(modelsApp)
  .use(paymentsApp)
  .use(metricsApp)
  .use(providerHealthApp)
  .use(conversationApp);

export type App = typeof app