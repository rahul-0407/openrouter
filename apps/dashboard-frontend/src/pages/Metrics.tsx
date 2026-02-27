import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
    Activity,
    Coins,
    Clock,
    Hash,
    BarChart3,
    TrendingUp,
    AlertTriangle,
    DollarSign,
    Timer,
    Layers,
    Inbox,
} from "lucide-react";
import { useState, memo } from "react";

const API_BASE = "http://localhost:3000";

async function fetchMetrics(path: string) {
    const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch ${path}`);
    return res.json();
}

// ── Skeleton Loader ──────────────────────────────────────────────────

function ChartSkeleton() {
    return (
        <div className="animate-pulse space-y-3">
            <div className="flex items-end gap-1 h-48 pt-4">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex-1 rounded-sm bg-muted/30"
                        style={{
                            height: `${20 + Math.random() * 70}%`,
                            animationDelay: `${i * 80}ms`,
                        }}
                    />
                ))}
            </div>
            <div className="flex justify-between">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-2 w-10 rounded bg-muted/20" />
                ))}
            </div>
        </div>
    );
}

function CardSkeleton() {
    return (
        <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-muted/30 animate-pulse" />
                    <div className="size-4 rounded bg-muted/20 animate-pulse" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-8 w-20 rounded bg-muted/30 animate-pulse" />
            </CardContent>
        </Card>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="flex items-center justify-center size-12 rounded-xl bg-muted/10 border border-border/30 mb-3">
                <Inbox className="size-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground/60">{message}</p>
        </div>
    );
}

// ── SVG Chart Components ─────────────────────────────────────────────

const LineChart = memo(function LineChart({
    data,
    xKey,
    yKey,
    label,
    color = "#818cf8",
    formatValue,
}: {
    data: Record<string, any>[];
    xKey: string;
    yKey: string;
    label: string;
    color?: string;
    formatValue?: (v: number) => string;
}) {
    if (!data.length) {
        return <EmptyState message={`No ${label.toLowerCase()} data available`} />;
    }

    const width = 600;
    const height = 200;
    const padX = 50;
    const padY = 30;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const values = data.map((d) => Number(d[yKey]));
    const maxVal = Math.max(...values, 1);

    const points = data.map((d, i) => {
        const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
        const y = padY + chartH - (Number(d[yKey]) / maxVal) * chartH;
        return { x, y, label: d[xKey], value: Number(d[yKey]) };
    });

    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaD = `${pathD} L ${points[points.length - 1]!.x} ${padY + chartH} L ${points[0]!.x} ${padY + chartH} Z`;

    const fmt = formatValue ?? ((v: number) => String(Math.round(v)));

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto transition-opacity duration-500">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = padY + chartH - frac * chartH;
                return (
                    <g key={frac}>
                        <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="currentColor" className="text-border/30" strokeDasharray="4" />
                        <text x={padX - 8} y={y + 4} textAnchor="end" fill="currentColor" className="text-muted-foreground" fontSize="10">
                            {fmt(maxVal * frac)}
                        </text>
                    </g>
                );
            })}

            {/* Area fill */}
            <path d={areaD} fill={color} opacity="0.08" />

            {/* Line */}
            <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

            {/* Dots */}
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
            ))}

            {/* X labels (show up to 7) */}
            {points
                .filter((_, i) => data.length <= 7 || i % Math.ceil(data.length / 7) === 0)
                .map((p, i) => (
                    <text key={i} x={p.x} y={height - 4} textAnchor="middle" fill="currentColor" className="text-muted-foreground" fontSize="9">
                        {typeof p.label === "string" ? (p.label.length > 10 ? p.label.slice(5) : p.label) : p.label}
                    </text>
                ))}
        </svg>
    );
});

const BarChartHorizontal = memo(function BarChartHorizontal({
    data,
    nameKey,
    valueKey,
    color = "#818cf8",
}: {
    data: Record<string, any>[];
    nameKey: string;
    valueKey: string;
    color?: string;
}) {
    if (!data.length) {
        return <EmptyState message="No data available" />;
    }

    const maxVal = Math.max(...data.map((d) => Number(d[valueKey])), 1);

    return (
        <div className="space-y-3">
            {data.map((d, i) => (
                <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground truncate mr-4 font-mono text-xs">
                            {d[nameKey]}
                        </span>
                        <span className="tabular-nums font-medium text-xs">
                            {Number(d[valueKey]).toLocaleString()} reqs
                        </span>
                    </div>
                    <div className="h-2 bg-card/80 rounded-full overflow-hidden border border-border/30">
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${(Number(d[valueKey]) / maxVal) * 100}%`,
                                backgroundColor: color,
                                opacity: 0.7 + 0.3 * (Number(d[valueKey]) / maxVal),
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
});

// ── Metrics Page ─────────────────────────────────────────────────────

export function Metrics() {
    const [range, setRange] = useState("7d");

    const summaryQuery = useQuery({
        queryKey: ["metrics-summary"],
        queryFn: () => fetchMetrics("/metrics/summary"),
        staleTime: 30_000,
    });

    const usageQuery = useQuery({
        queryKey: ["metrics-usage", range],
        queryFn: () => fetchMetrics(`/metrics/usage-over-time?range=${range}`),
        staleTime: 30_000,
    });

    const modelsQuery = useQuery({
        queryKey: ["metrics-models"],
        queryFn: () => fetchMetrics("/metrics/models"),
        staleTime: 30_000,
    });

    const providersQuery = useQuery({
        queryKey: ["metrics-providers"],
        queryFn: () => fetchMetrics("/metrics/providers"),
        staleTime: 30_000,
    });

    const throughputQuery = useQuery({
        queryKey: ["metrics-throughput"],
        queryFn: () => fetchMetrics("/metrics/throughput"),
        staleTime: 30_000,
    });

    // New metrics queries
    const errorRateQuery = useQuery({
        queryKey: ["metrics-error-rate", range],
        queryFn: () => fetchMetrics(`/metrics/error-rate-over-time?range=${range}`),
        staleTime: 30_000,
    });

    const costQuery = useQuery({
        queryKey: ["metrics-cost", range],
        queryFn: () => fetchMetrics(`/metrics/cost-over-time?range=${range}`),
        staleTime: 30_000,
    });

    const latencyQuery = useQuery({
        queryKey: ["metrics-latency", range],
        queryFn: () => fetchMetrics(`/metrics/latency-over-time?range=${range}`),
        staleTime: 30_000,
    });

    const tokenQuery = useQuery({
        queryKey: ["metrics-tokens", range],
        queryFn: () => fetchMetrics(`/metrics/token-usage-over-time?range=${range}`),
        staleTime: 30_000,
    });

    const summary = summaryQuery.data;

    const rangeSelector = (
        <div className="flex items-center gap-1 rounded-lg border border-border/50 p-0.5">
            {["7d", "30d", "90d"].map((r) => (
                <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        range === r
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    {r}
                </button>
            ))}
        </div>
    );

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Metrics</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Usage analytics and model throughput.
                        </p>
                    </div>
                    {rangeSelector}
                </div>

                {/* Summary Cards */}
                {summaryQuery.isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <CardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-card/50 border-border/50 hover:border-border/80 transition-all duration-300">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Total Requests</span>
                                    <Activity className="size-4 text-muted-foreground/60" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold tracking-tight">
                                    {(summary?.totalRequests ?? 0).toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/50 border-border/50 hover:border-border/80 transition-all duration-300">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Total Tokens</span>
                                    <Hash className="size-4 text-muted-foreground/60" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold tracking-tight">
                                    {(summary?.totalTokens ?? 0).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {(summary?.totalInputTokens ?? 0).toLocaleString()} in / {(summary?.totalOutputTokens ?? 0).toLocaleString()} out
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/50 border-border/50 hover:border-border/80 transition-all duration-300">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Total Cost</span>
                                    <Coins className="size-4 text-muted-foreground/60" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold tracking-tight">
                                    {(summary?.totalCost ?? 0).toLocaleString()} <span className="text-base font-normal text-muted-foreground">credits</span>
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card/50 border-border/50 hover:border-border/80 transition-all duration-300">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Avg Latency</span>
                                    <Clock className="size-4 text-muted-foreground/60" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold tracking-tight">
                                    {(summary?.avgLatencyMs ?? 0).toLocaleString()} <span className="text-base font-normal text-muted-foreground">ms</span>
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Usage Over Time */}
                <Card className="bg-card/30 border-border/50 hover:border-border/70 transition-all duration-300">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="size-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">Usage Over Time</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {usageQuery.isLoading ? (
                            <ChartSkeleton />
                        ) : (
                            <LineChart
                                data={usageQuery.data ?? []}
                                xKey="date"
                                yKey="requests"
                                label="Requests"
                                color="#818cf8"
                            />
                        )}
                    </CardContent>
                </Card>

                {/* New Metrics Charts (2×2 grid) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="bg-card/30 border-border/50 hover:border-border/70 transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="size-4 text-orange-400" />
                                <span className="text-sm font-semibold">Error Rate Over Time</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {errorRateQuery.isLoading ? (
                                <ChartSkeleton />
                            ) : (
                                <LineChart
                                    data={errorRateQuery.data ?? []}
                                    xKey="date"
                                    yKey="errorRate"
                                    label="Error rate"
                                    color="#f97316"
                                    formatValue={(v) => `${v.toFixed(1)}%`}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/30 border-border/50 hover:border-border/70 transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <DollarSign className="size-4 text-amber-400" />
                                <span className="text-sm font-semibold">Cost Over Time</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {costQuery.isLoading ? (
                                <ChartSkeleton />
                            ) : (
                                <LineChart
                                    data={costQuery.data ?? []}
                                    xKey="date"
                                    yKey="cost"
                                    label="Cost"
                                    color="#f59e0b"
                                    formatValue={(v) => `${v.toFixed(2)}`}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/30 border-border/50 hover:border-border/70 transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Timer className="size-4 text-pink-400" />
                                <span className="text-sm font-semibold">Avg Latency Over Time</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {latencyQuery.isLoading ? (
                                <ChartSkeleton />
                            ) : (
                                <LineChart
                                    data={latencyQuery.data ?? []}
                                    xKey="date"
                                    yKey="avgLatencyMs"
                                    label="Latency"
                                    color="#ec4899"
                                    formatValue={(v) => `${Math.round(v)}ms`}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/30 border-border/50 hover:border-border/70 transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Layers className="size-4 text-cyan-400" />
                                <span className="text-sm font-semibold">Token Usage Over Time</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {tokenQuery.isLoading ? (
                                <ChartSkeleton />
                            ) : (
                                <LineChart
                                    data={tokenQuery.data ?? []}
                                    xKey="date"
                                    yKey="totalTokens"
                                    label="Tokens"
                                    color="#06b6d4"
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Model & Provider Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="bg-card/30 border-border/50 hover:border-border/70 transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="size-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">Model Usage</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {modelsQuery.isLoading ? (
                                <ChartSkeleton />
                            ) : (
                                <BarChartHorizontal
                                    data={modelsQuery.data ?? []}
                                    nameKey="model"
                                    valueKey="requests"
                                    color="#818cf8"
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/30 border-border/50 hover:border-border/70 transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="size-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">Provider Usage</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {providersQuery.isLoading ? (
                                <ChartSkeleton />
                            ) : (
                                <BarChartHorizontal
                                    data={providersQuery.data ?? []}
                                    nameKey="provider"
                                    valueKey="requests"
                                    color="#34d399"
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Throughput */}
                <Card className="bg-card/30 border-border/50 hover:border-border/70 transition-all duration-300">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity className="size-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">Throughput (req/min)</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {throughputQuery.isLoading ? (
                            <ChartSkeleton />
                        ) : (
                            <LineChart
                                data={throughputQuery.data ?? []}
                                xKey="time"
                                yKey="requestsPerMinute"
                                label="Req/min"
                                color="#f472b6"
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
