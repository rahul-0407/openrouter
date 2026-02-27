import { t } from "elysia";

export namespace MetricsModel {
    export const summaryResponseSchema = t.Object({
        totalRequests: t.Number(),
        totalTokens: t.Number(),
        totalInputTokens: t.Number(),
        totalOutputTokens: t.Number(),
        totalCost: t.Number(),
        avgLatencyMs: t.Number(),
        errorRate: t.Number(),
        p95LatencyMs: t.Number(),
    });

    export const usageOverTimeResponseSchema = t.Array(
        t.Object({
            date: t.String(),
            requests: t.Number(),
            tokens: t.Number(),
            cost: t.Number(),
        })
    );

    export const modelBreakdownResponseSchema = t.Array(
        t.Object({
            model: t.String(),
            requests: t.Number(),
            totalTokens: t.Number(),
            cost: t.Number(),
        })
    );

    export const providerBreakdownResponseSchema = t.Array(
        t.Object({
            provider: t.String(),
            requests: t.Number(),
            totalTokens: t.Number(),
            cost: t.Number(),
            avgLatencyMs: t.Number(),
        })
    );

    export const throughputResponseSchema = t.Array(
        t.Object({
            time: t.String(),
            requestsPerMinute: t.Number(),
        })
    );

    export const errorRateOverTimeResponseSchema = t.Array(
        t.Object({
            date: t.String(),
            totalRequests: t.Number(),
            failedRequests: t.Number(),
            errorRate: t.Number(),
        })
    );

    export const costOverTimeResponseSchema = t.Array(
        t.Object({
            date: t.String(),
            cost: t.Number(),
        })
    );

    export const latencyOverTimeResponseSchema = t.Array(
        t.Object({
            date: t.String(),
            avgLatencyMs: t.Number(),
        })
    );

    export const tokenUsageOverTimeResponseSchema = t.Array(
        t.Object({
            date: t.String(),
            inputTokens: t.Number(),
            outputTokens: t.Number(),
            totalTokens: t.Number(),
        })
    );

    export const errorResponseSchema = t.Object({
        message: t.String(),
    });
}
