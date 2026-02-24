import { prisma } from "db";
import { Prisma } from "db/generated/prisma/client";

export abstract class MetricsService {

    static async getUserMetrics(userId: number) {
        // Run aggregate + failed count + latency fetch in parallel
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

        // P95 latency calculation
        const latencies = latencyRows
            .map((r) => r.latencyMs)
            .sort((a, b) => a - b);
        const p95LatencyMs = latencies.length > 0
            ? latencies[Math.ceil(latencies.length * 0.95) - 1] ?? 0
            : 0;

        return {
            totalRequests,
            totalTokens: result._sum.totalTokens ?? 0,
            totalInputTokens: result._sum.inputTokens ?? 0,
            totalOutputTokens: result._sum.outputTokens ?? 0,
            totalCost: Math.round((result._sum.cost ?? 0) * 100) / 100,
            avgLatencyMs: Math.round(result._avg.latencyMs ?? 0),
            errorRate,
            p95LatencyMs,
        };
    }

    static async getUsageOverTime(userId: number, range: string) {
        const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
        const since = new Date();
        since.setDate(since.getDate() - days);

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

        return rows.map((r) => ({
            date: r.date.toISOString().split("T")[0],
            requests: Number(r.requests),
            tokens: Number(r.tokens),
            cost: Math.round(r.cost * 100) / 100,
        }));
    }

    static async getModelBreakdown(userId: number) {
        const groups = await prisma.usageMetric.groupBy({
            by: ["model"],
            where: { userId },
            _count: { id: true },
            _sum: { totalTokens: true, cost: true },
            orderBy: { _count: { id: "desc" } },
        });

        return groups.map((g) => ({
            model: g.model,
            requests: g._count.id,
            totalTokens: g._sum.totalTokens ?? 0,
            cost: Math.round((g._sum.cost ?? 0) * 100) / 100,
        }));
    }

    static async getProviderBreakdown(userId: number) {
        const groups = await prisma.usageMetric.groupBy({
            by: ["provider"],
            where: { userId },
            _count: { id: true },
            _sum: { totalTokens: true, cost: true },
            _avg: { latencyMs: true },
            orderBy: { _count: { id: "desc" } },
        });

        return groups.map((g) => ({
            provider: g.provider,
            requests: g._count.id,
            totalTokens: g._sum.totalTokens ?? 0,
            cost: Math.round((g._sum.cost ?? 0) * 100) / 100,
            avgLatencyMs: Math.round(g._avg.latencyMs ?? 0),
        }));
    }

    static async getThroughput(userId: number) {
        // Requests per minute, bucketed by 5-minute intervals over the last 2 hours
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

        return rows.map((r) => ({
            time: r.bucket.toISOString(),
            requestsPerMinute: Number(r.requests),
        }));
    }
}

