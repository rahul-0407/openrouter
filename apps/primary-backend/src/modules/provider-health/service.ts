import { prisma } from "db";
import { cache } from "cache";

export abstract class ProviderHealthService {
    static async getProviderHealthSummary() {
        const cacheKey = "provider:health:summary";
        const cached = cache.get<any[]>(cacheKey);
        if (cached) return cached;

        // Aggregate metrics per provider from the last 24 hours
        const since = new Date();
        since.setHours(since.getHours() - 24);

        const providers = await prisma.usageMetric.groupBy({
            by: ["provider"],
            where: {
                createdAt: { gte: since }
            },
            _count: { id: true },
            _avg: { latencyMs: true },
            _sum: { cost: true }
        });

        const failedCounts = await prisma.usageMetric.groupBy({
            by: ["provider"],
            where: {
                createdAt: { gte: since },
                success: false
            },
            _count: { id: true }
        });

        const lastSuccess = await prisma.usageMetric.groupBy({
            by: ["provider"],
            where: { success: true },
            _max: { createdAt: true }
        });

        const lastFailure = await prisma.usageMetric.groupBy({
            by: ["provider"],
            where: { success: false },
            _max: { createdAt: true }
        });

        const failedMap = new Map(failedCounts.map(f => [f.provider, f._count.id]));
        const successMap = new Map(lastSuccess.map(s => [s.provider, s._max.createdAt]));
        const failureMap = new Map(lastFailure.map(f => [f.provider, f._max.createdAt]));

        const result = providers.map(p => {
            const totalRequests = p._count.id;
            const failedRequests = failedMap.get(p.provider) || 0;
            const errorRate = (failedRequests / totalRequests) * 100;

            let status: "Healthy" | "Degraded" | "Down" = "Healthy";
            if (errorRate > 15) {
                status = "Down";
            } else if (errorRate > 5) {
                status = "Degraded";
            }

            // Also check if no success in last hour while having failures
            const lastSucc = successMap.get(p.provider);
            const now = new Date();
            if (lastSucc && (now.getTime() - lastSucc.getTime() > 3600000) && failedRequests > 0) {
                status = "Down";
            }

            return {
                provider: p.provider,
                requests: totalRequests,
                errorRate: Math.round(errorRate * 100) / 100,
                avgLatency: Math.round(p._avg.latencyMs || 0),
                cost: Math.round((p._sum.cost || 0) * 100) / 100,
                status,
                lastSuccess: lastSucc,
                lastFailure: failureMap.get(p.provider) || null
            };
        });

        cache.set(cacheKey, result, 30); // 30s TTL
        return result;
    }

    static async getProviderHealthTimeSeries(range: string = "24h") {
        const cacheKey = `provider:health:timeseries:${range}`;
        const cached = cache.get<any[]>(cacheKey);
        if (cached) return cached;

        const hours = range === "7d" ? 168 : range === "30d" ? 720 : 24;
        const since = new Date();
        since.setHours(since.getHours() - hours);

        const rows = await prisma.$queryRaw<
            Array<{
                bucket: Date;
                provider: string;
                latency: number;
                error_rate: number;
            }>
        >`
            SELECT
                DATE_TRUNC('hour', "createdAt") AS bucket,
                "provider",
                AVG("latencyMs")::float AS latency,
                (SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END)::float / COUNT(*)::float) * 100 AS error_rate
            FROM "UsageMetric"
            WHERE "createdAt" >= ${since}
            GROUP BY 1, 2
            ORDER BY bucket ASC
        `;

        const result = rows.map(r => ({
            timestamp: r.bucket.toISOString(),
            provider: r.provider,
            latency: Math.round(r.latency),
            errorRate: Math.round(r.error_rate * 100) / 100
        }));

        cache.set(cacheKey, result, 30); // 30s TTL
        return result;
    }
}
