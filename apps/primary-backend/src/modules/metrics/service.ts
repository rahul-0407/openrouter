import { prisma } from "db";
import { Prisma } from "db/generated/prisma/client";
import { cache } from "cache";

function parseDays(range: string): number {
    return range === "90d" ? 90 : range === "30d" ? 30 : 7;
}

function getSince(range: string): Date {
    const since = new Date();
    since.setDate(since.getDate() - parseDays(range));
    return since;
}

// ── Metrics Service ──────────────────────────────────────────────────

export abstract class MetricsService {

    static async getUserMetrics(userId: number) {
        const cacheKey = `summary:${userId}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const [result, failedResult, latencyRows] = await Promise.all([
            prisma.usageMetric.aggregate({
                where: { userId },
                _count: { id: true },
                _sum: {
                    totalTokens: true,
                    inputTokens: true,
                    outputTokens: true,
                    cost: true,
                },
                _avg: {
                    latencyMs: true,
                },
            }),
            prisma.usageMetric.count({
                where: { userId, success: false },
            }),
            prisma.usageMetric.findMany({
                where: { userId },
                select: { latencyMs: true },
                orderBy: { createdAt: "desc" },
                take: 1000,
            }),
        ]);

        const totalRequests = result._count.id;
        const errorRate = totalRequests > 0
            ? Math.round((failedResult / totalRequests) * 10000) / 100
            : 0;

        const latencies = latencyRows
            .map((r) => r.latencyMs)
            .sort((a, b) => a - b);
        const p95LatencyMs = latencies.length > 0
            ? latencies[Math.ceil(latencies.length * 0.95) - 1] ?? 0
            : 0;

        const data = {
            totalRequests,
            totalTokens: result._sum.totalTokens ?? 0,
            totalInputTokens: result._sum.inputTokens ?? 0,
            totalOutputTokens: result._sum.outputTokens ?? 0,
            totalCost: Math.round((result._sum.cost ?? 0) * 100) / 100,
            avgLatencyMs: Math.round(result._avg.latencyMs ?? 0),
            errorRate,
            p95LatencyMs,
        };

        cache.set(cacheKey, data, 60);
        return data;
    }

    static async getUsageOverTime(userId: number, range: string) {
        const cacheKey = `usage:${userId}:${range}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const since = getSince(range);

        const rows = await prisma.$queryRaw<
            Array<{
                date: Date;
                requests: bigint;
                tokens: bigint;
                cost: number;
            }>
        >`
            SELECT
                DATE_TRUNC('day', "createdAt") AS date,
                COUNT(*)::bigint AS requests,
                COALESCE(SUM("totalTokens"), 0)::bigint AS tokens,
                COALESCE(SUM("cost"), 0)::float AS cost
            FROM "UsageMetric"
            WHERE "userId" = ${userId} AND "createdAt" >= ${since}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY date ASC
        `;

        const data = rows.map((r) => ({
            date: r.date.toISOString().split("T")[0],
            requests: Number(r.requests),
            tokens: Number(r.tokens),
            cost: Math.round(r.cost * 100) / 100,
        }));

        cache.set(cacheKey, data, 60);
        return data;
    }

    static async getModelBreakdown(userId: number) {
        const cacheKey = `models:${userId}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const groups = await prisma.usageMetric.groupBy({
            by: ["model"],
            where: { userId },
            _count: { id: true },
            _sum: { totalTokens: true, cost: true },
            orderBy: { _count: { id: "desc" } },
        });

        const data = groups.map((g) => ({
            model: g.model,
            requests: g._count.id,
            totalTokens: g._sum.totalTokens ?? 0,
            cost: Math.round((g._sum.cost ?? 0) * 100) / 100,
        }));

        cache.set(cacheKey, data, 60);
        return data;
    }

    static async getProviderBreakdown(userId: number) {
        const cacheKey = `providers:${userId}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const groups = await prisma.usageMetric.groupBy({
            by: ["provider"],
            where: { userId },
            _count: { id: true },
            _sum: { totalTokens: true, cost: true },
            _avg: { latencyMs: true },
            orderBy: { _count: { id: "desc" } },
        });

        const data = groups.map((g) => ({
            provider: g.provider,
            requests: g._count.id,
            totalTokens: g._sum.totalTokens ?? 0,
            cost: Math.round((g._sum.cost ?? 0) * 100) / 100,
            avgLatencyMs: Math.round(g._avg.latencyMs ?? 0),
        }));

        cache.set(cacheKey, data, 60);
        return data;
    }

    static async getThroughput(userId: number) {
        const cacheKey = `throughput:${userId}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const since = new Date();
        since.setHours(since.getHours() - 2);

        const rows = await prisma.$queryRaw<
            Array<{
                bucket: Date;
                requests: bigint;
            }>
        >`
            SELECT
                DATE_TRUNC('minute', "createdAt") AS bucket,
                COUNT(*)::bigint AS requests
            FROM "UsageMetric"
            WHERE "userId" = ${userId} AND "createdAt" >= ${since}
            GROUP BY DATE_TRUNC('minute', "createdAt")
            ORDER BY bucket ASC
        `;

        const data = rows.map((r) => ({
            time: r.bucket.toISOString(),
            requestsPerMinute: Number(r.requests),
        }));

        cache.set(cacheKey, data, 60);
        return data;
    }

    // ── New Metrics Methods ──────────────────────────────────────────

    static async getErrorRateOverTime(userId: number, range: string) {
        const cacheKey = `errorRate:${userId}:${range}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const since = getSince(range);

        const rows = await prisma.$queryRaw<
            Array<{
                date: Date;
                total_requests: bigint;
                failed_requests: bigint;
            }>
        >`
            SELECT
                DATE_TRUNC('day', "createdAt") AS date,
                COUNT(*)::bigint AS total_requests,
                SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END)::bigint AS failed_requests
            FROM "UsageMetric"
            WHERE "userId" = ${userId} AND "createdAt" >= ${since}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY date ASC
        `;

        const data = rows.map((r) => {
            const total = Number(r.total_requests);
            const failed = Number(r.failed_requests);
            return {
                date: r.date.toISOString().split("T")[0],
                totalRequests: total,
                failedRequests: failed,
                errorRate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
            };
        });

        cache.set(cacheKey, data, 60);
        return data;
    }

    static async getCostOverTime(userId: number, range: string) {
        const cacheKey = `cost:${userId}:${range}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const since = getSince(range);

        const rows = await prisma.$queryRaw<
            Array<{
                date: Date;
                cost: number;
            }>
        >`
            SELECT
                DATE_TRUNC('day', "createdAt") AS date,
                COALESCE(SUM("cost"), 0)::float AS cost
            FROM "UsageMetric"
            WHERE "userId" = ${userId} AND "createdAt" >= ${since}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY date ASC
        `;

        const data = rows.map((r) => ({
            date: r.date.toISOString().split("T")[0],
            cost: Math.round(r.cost * 100) / 100,
        }));

        cache.set(cacheKey, data, 60);
        return data;
    }

    static async getLatencyOverTime(userId: number, range: string) {
        const cacheKey = `latency:${userId}:${range}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const since = getSince(range);

        const rows = await prisma.$queryRaw<
            Array<{
                date: Date;
                avg_latency: number;
            }>
        >`
            SELECT
                DATE_TRUNC('day', "createdAt") AS date,
                COALESCE(AVG("latencyMs"), 0)::float AS avg_latency
            FROM "UsageMetric"
            WHERE "userId" = ${userId} AND "createdAt" >= ${since}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY date ASC
        `;

        const data = rows.map((r) => ({
            date: r.date.toISOString().split("T")[0],
            avgLatencyMs: Math.round(r.avg_latency),
        }));

        cache.set(cacheKey, data, 60);
        return data;
    }

    static async getTokenUsageOverTime(userId: number, range: string) {
        const cacheKey = `tokens:${userId}:${range}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const since = getSince(range);

        const rows = await prisma.$queryRaw<
            Array<{
                date: Date;
                input_tokens: bigint;
                output_tokens: bigint;
                total_tokens: bigint;
            }>
        >`
            SELECT
                DATE_TRUNC('day', "createdAt") AS date,
                COALESCE(SUM("inputTokens"), 0)::bigint AS input_tokens,
                COALESCE(SUM("outputTokens"), 0)::bigint AS output_tokens,
                COALESCE(SUM("totalTokens"), 0)::bigint AS total_tokens
            FROM "UsageMetric"
            WHERE "userId" = ${userId} AND "createdAt" >= ${since}
            GROUP BY DATE_TRUNC('day', "createdAt")
            ORDER BY date ASC
        `;

        const data = rows.map((r) => ({
            date: r.date.toISOString().split("T")[0],
            inputTokens: Number(r.input_tokens),
            outputTokens: Number(r.output_tokens),
            totalTokens: Number(r.total_tokens),
        }));

        cache.set(cacheKey, data, 60);
        return data;
    }
}
