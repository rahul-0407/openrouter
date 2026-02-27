import jwt from "@elysiajs/jwt";
import Elysia, { t } from "elysia";
import { MetricsModel } from "./models";
import { MetricsService } from "./service";

export const app = new Elysia({ prefix: "/metrics" })
    .use(
        jwt({
            name: 'jwt',
            secret: process.env.JWT_SECRET!
        })
    )
    .resolve(async ({ cookie: { auth }, status, jwt }) => {
        if (!auth) {
            return status(401)
        }

        const decoded = await jwt.verify(auth.value as string);

        if (!decoded || !decoded.userId) {
            return status(401)
        }

        return {
            userId: decoded.userId as string
        }
    })
    .get("/summary", async ({ userId, status }) => {
        try {
            return await MetricsService.getUserMetrics(Number(userId));
        } catch (e) {
            return status(500, { message: "Failed to fetch metrics summary" });
        }
    }, {
        response: {
            200: MetricsModel.summaryResponseSchema,
            500: MetricsModel.errorResponseSchema,
        }
    })
    .get("/usage-over-time", async ({ userId, query, status }) => {
        try {
            const range = query.range ?? "7d";
            return await MetricsService.getUsageOverTime(Number(userId), range);
        } catch (e) {
            return status(500, { message: "Failed to fetch usage over time" });
        }
    }, {
        query: t.Object({
            range: t.Optional(t.String())
        }),
        response: {
            200: MetricsModel.usageOverTimeResponseSchema,
            500: MetricsModel.errorResponseSchema,
        }
    })
    .get("/models", async ({ userId, status }) => {
        try {
            return await MetricsService.getModelBreakdown(Number(userId));
        } catch (e) {
            return status(500, { message: "Failed to fetch model breakdown" });
        }
    }, {
        response: {
            200: MetricsModel.modelBreakdownResponseSchema,
            500: MetricsModel.errorResponseSchema,
        }
    })
    .get("/providers", async ({ userId, status }) => {
        try {
            return await MetricsService.getProviderBreakdown(Number(userId));
        } catch (e) {
            return status(500, { message: "Failed to fetch provider breakdown" });
        }
    }, {
        response: {
            200: MetricsModel.providerBreakdownResponseSchema,
            500: MetricsModel.errorResponseSchema,
        }
    })
    .get("/throughput", async ({ userId, status }) => {
        try {
            return await MetricsService.getThroughput(Number(userId));
        } catch (e) {
            return status(500, { message: "Failed to fetch throughput data" });
        }
    }, {
        response: {
            200: MetricsModel.throughputResponseSchema,
            500: MetricsModel.errorResponseSchema,
        }
    })
    // ── New Metrics Endpoints ────────────────────────────────────────
    .get("/error-rate-over-time", async ({ userId, query, status }) => {
        try {
            const range = query.range ?? "7d";
            return await MetricsService.getErrorRateOverTime(Number(userId), range);
        } catch (e) {
            return status(500, { message: "Failed to fetch error rate over time" });
        }
    }, {
        query: t.Object({
            range: t.Optional(t.String())
        }),
        response: {
            200: MetricsModel.errorRateOverTimeResponseSchema,
            500: MetricsModel.errorResponseSchema,
        }
    })
    .get("/cost-over-time", async ({ userId, query, status }) => {
        try {
            const range = query.range ?? "7d";
            return await MetricsService.getCostOverTime(Number(userId), range);
        } catch (e) {
            return status(500, { message: "Failed to fetch cost over time" });
        }
    }, {
        query: t.Object({
            range: t.Optional(t.String())
        }),
        response: {
            200: MetricsModel.costOverTimeResponseSchema,
            500: MetricsModel.errorResponseSchema,
        }
    })
    .get("/latency-over-time", async ({ userId, query, status }) => {
        try {
            const range = query.range ?? "7d";
            return await MetricsService.getLatencyOverTime(Number(userId), range);
        } catch (e) {
            return status(500, { message: "Failed to fetch latency over time" });
        }
    }, {
        query: t.Object({
            range: t.Optional(t.String())
        }),
        response: {
            200: MetricsModel.latencyOverTimeResponseSchema,
            500: MetricsModel.errorResponseSchema,
        }
    })
    .get("/token-usage-over-time", async ({ userId, query, status }) => {
        try {
            const range = query.range ?? "7d";
            return await MetricsService.getTokenUsageOverTime(Number(userId), range);
        } catch (e) {
            return status(500, { message: "Failed to fetch token usage over time" });
        }
    }, {
        query: t.Object({
            range: t.Optional(t.String())
        }),
        response: {
            200: MetricsModel.tokenUsageOverTimeResponseSchema,
            500: MetricsModel.errorResponseSchema,
        }
    })
