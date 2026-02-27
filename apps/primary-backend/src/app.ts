import { Elysia } from "elysia";
import { app as authApp } from "./modules/auth";
import { app as apiKeyApp } from "./modules/apiKeys";
import { app as modelsApp } from "./modules/models";
import { app as paymentsApp } from "./modules/payments";
import { app as metricsApp } from "./modules/metrics";

import { app as providerHealthApp } from "./modules/provider-health";

export const app = new Elysia()
  .use(authApp)
  .use(apiKeyApp)
  .use(modelsApp)
  .use(paymentsApp)
  .use(metricsApp)
  .use(providerHealthApp)

export type App = typeof app