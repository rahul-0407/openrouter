import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
    Activity,
    Clock,
    AlertTriangle,
    ShieldCheck,
    ShieldAlert,
    ShieldEllipsis,
    TrendingUp,
    Timer,
    Inbox,
} from "lucide-react";
import { useState, memo } from "react";

const API_BASE = "http://localhost:3000";

async function fetchHealth(path: string) {
    const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch ${path}`);
    return res.json();
}

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
            <path d={areaD} fill={color} opacity="0.08" />
            <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
            {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
            ))}
            {points
                .filter((_, i) => data.length <= 7 || i % Math.ceil(data.length / 7) === 0)
                .map((p, i) => (
                    <text key={i} x={p.x} y={height - 4} textAnchor="middle" fill="currentColor" className="text-muted-foreground" fontSize="9">
                         {typeof p.label === "string" ? (p.label.length > 13 ? p.label.slice(11, 16) : p.label) : p.label}
                    </text>
                ))}
        </svg>
    );
});

export function ProviderHealth() {
    const [range, setRange] = useState("24h");

    const summaryQuery = useQuery({
        queryKey: ["health-summary"],
        queryFn: () => fetchHealth("/admin/provider-health/summary"),
        staleTime: 30_000,
    });

    const timeseriesQuery = useQuery({
        queryKey: ["health-timeseries", range],
        queryFn: () => fetchHealth(`/admin/provider-health/timeseries?range=${range}`),
        staleTime: 30_000,
    });

    const providers = summaryQuery.data || [];

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Healthy": return <ShieldCheck className="size-5 text-emerald-500" />;
            case "Degraded": return <ShieldEllipsis className="size-5 text-amber-500" />;
            case "Down": return <ShieldAlert className="size-5 text-destructive" />;
            default: return null;
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Provider Health</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Real-time status and performance metrics for all integrated providers.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {summaryQuery.isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="bg-card/50 border-border/50 animate-pulse h-32" />
                        ))
                    ) : (
                        providers.map((p: any) => (
                            <Card key={p.provider} className="bg-card/50 border-border/50 hover:border-border/80 transition-all">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(p.status)}
                                            <span className="font-semibold">{p.provider}</span>
                                        </div>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                            p.status === "Healthy" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                            p.status === "Degraded" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                            "bg-destructive/10 border-destructive/20 text-destructive"
                                        }`}>
                                            {p.status}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                                                <Activity className="size-3" /> Error Rate
                                            </div>
                                            <div className="font-mono text-lg">{p.errorRate}%</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                                                <Clock className="size-3" /> Latency
                                            </div>
                                            <div className="font-mono text-lg">{p.avgLatency}ms</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="bg-card/30 border-border/50">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Timer className="size-4 text-pink-400" />
                                <span className="text-sm font-semibold">Latency Over Time (Avg)</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {timeseriesQuery.isLoading ? <ChartSkeleton /> : (
                                <LineChart
                                    data={timeseriesQuery.data || []}
                                    xKey="timestamp"
                                    yKey="latency"
                                    label="Latency"
                                    color="#ec4899"
                                    formatValue={(v) => `${Math.round(v)}ms`}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/30 border-border/50">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="size-4 text-orange-400" />
                                <span className="text-sm font-semibold">Error Rate Over Time (%)</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {timeseriesQuery.isLoading ? <ChartSkeleton /> : (
                                <LineChart
                                    data={timeseriesQuery.data || []}
                                    xKey="timestamp"
                                    yKey="errorRate"
                                    label="Error rate"
                                    color="#f97316"
                                    formatValue={(v) => `${v.toFixed(1)}%`}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
