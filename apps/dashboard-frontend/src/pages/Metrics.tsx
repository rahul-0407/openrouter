import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
    Activity,
    Coins,
    Clock,
    Hash,
    Loader2,
    BarChart3,
    TrendingUp,
} from "lucide-react";
import { useState } from "react";

const API_BASE = "http://localhost:3000";

async function fetchMetrics(path: string) {
    const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch ${path}`);
    return res.json();
}

// ── SVG Chart Components ─────────────────────────────────────────────

function LineChart({
    data,
    xKey,
    yKey,
    label,
    color = "#818cf8",
}: {
    data: Record<string, any>[];
    xKey: string;
    yKey: string;
    label: string;
    color?: string;
}) {
    if (!data.length) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No data available
            </div>
        );
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

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                const y = padY + chartH - frac * chartH;
                return (
                    <g key={frac}>
                        <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="currentColor" className="text-border/30" strokeDasharray="4" />
                        <text x={padX - 8} y={y + 4} textAnchor="end" fill="currentColor" className="text-muted-foreground" fontSize="10">
                            {Math.round(maxVal * frac)}
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
}

function BarChartHorizontal({
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
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No data available
            </div>
        );
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
                            className="h-full rounded-full transition-all duration-500"
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
}

// ── Metrics Page ─────────────────────────────────────────────────────

export function Metrics() {
    const [range, setRange] = useState("7d");

    const summaryQuery = useQuery({
        queryKey: ["metrics-summary"],
        queryFn: () => fetchMetrics("/metrics/summary"),
    });

    const usageQuery = useQuery({
        queryKey: ["metrics-usage", range],
        queryFn: () => fetchMetrics(`/metrics/usage-over-time?range=${range}`),
    });

    const modelsQuery = useQuery({
        queryKey: ["metrics-models"],
        queryFn: () => fetchMetrics("/metrics/models"),
    });

    const providersQuery = useQuery({
        queryKey: ["metrics-providers"],
        queryFn: () => fetchMetrics("/metrics/providers"),
    });

    const throughputQuery = useQuery({
        queryKey: ["metrics-throughput"],
        queryFn: () => fetchMetrics("/metrics/throughput"),
    });

    const summary = summaryQuery.data;
    const isLoading = summaryQuery.isLoading;

    return (
        <DashboardLayout>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Metrics</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Usage analytics and model throughput.
                    </p>
                </div>

                {/* Summary Cards */}
                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
                        <Loader2 className="size-4 animate-spin" />
                        Loading metrics...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-card/50 border-border/50">
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

                        <Card className="bg-card/50 border-border/50">
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

                        <Card className="bg-card/50 border-border/50">
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

                        <Card className="bg-card/50 border-border/50">
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
                <Card className="bg-card/30 border-border/50">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="size-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">Usage Over Time</span>
                            </div>
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
                        </div>
                    </CardHeader>
                    <CardContent>
                        {usageQuery.isLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                                <Loader2 className="size-4 animate-spin" />
                                Loading...
                            </div>
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

                {/* Model & Provider Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="bg-card/30 border-border/50">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="size-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">Model Usage</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {modelsQuery.isLoading ? (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                                    <Loader2 className="size-4 animate-spin" />
                                    Loading...
                                </div>
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

                    <Card className="bg-card/30 border-border/50">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="size-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">Provider Usage</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {providersQuery.isLoading ? (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                                    <Loader2 className="size-4 animate-spin" />
                                    Loading...
                                </div>
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
                <Card className="bg-card/30 border-border/50">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Activity className="size-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">Throughput (req/min)</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {throughputQuery.isLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                                <Loader2 className="size-4 animate-spin" />
                                Loading...
                            </div>
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
