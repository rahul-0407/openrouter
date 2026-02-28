import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import {
    LayoutDashboard,
    Key,
    Wallet,
    BarChart3,
    MessageSquare,
    Zap,
    LogOut,
    BookOpen,
    ExternalLink,
    ShieldCheck,
} from "lucide-react";
import { LoadingOverlay } from "./LoadingOverlay";

const DOCS_URL = "http://localhost:3002";

const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "API Keys", href: "/api-keys", icon: Key },
    { label: "Wallet", href: "/wallet", icon: Wallet },
    { label: "Metrics", href: "/metrics", icon: BarChart3 },
    { label: "Health", href: "/dashboard/provider-health", icon: ShieldCheck },
    { label: "Chat", href: "/chat", icon: MessageSquare },
    { label: "Docs", href: DOCS_URL, icon: BookOpen, external: true },
] as const;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const [isNavigatingToDocs, setIsNavigatingToDocs] = useState(false);

    const prefetchDocs = useCallback(() => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = DOCS_URL;
        document.head.appendChild(link);
    }, []);

    const handleDocsClick = (e: React.MouseEvent) => {
        setIsNavigatingToDocs(true);
        // We'll let the user see the animation for a moment even if it's fast
        setTimeout(() => {
            window.location.href = DOCS_URL;
        }, 800);
        e.preventDefault();
    };

    return (
        <div className="dark min-h-screen bg-background flex">
            <LoadingOverlay isVisible={isNavigatingToDocs} />
            
            {/* Sidebar */}
            <aside className="w-64 border-r border-border/50 flex flex-col bg-card/30">
                {/* Brand */}
                <div className="px-5 h-16 flex items-center gap-2.5 border-b border-border/50">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 border border-primary/20">
                        <Zap className="size-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-semibold tracking-tight text-foreground uppercase">
                        OpenRouter
                    </span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        const classes = cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        );

                        if ('external' in item && item.external) {
                            return (
                                <a
                                    key={item.href}
                                    href={item.href}
                                    onClick={handleDocsClick}
                                    onMouseEnter={prefetchDocs}
                                    className={classes}
                                >
                                    <item.icon className="size-4" />
                                    {item.label}
                                    <ExternalLink className="size-3 ml-auto text-muted-foreground/50" />
                                </a>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={classes}
                            >
                                <item.icon className="size-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="px-3 py-4 border-t border-border/50">
                    <Link
                        to="/signin"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    >
                        <LogOut className="size-4" />
                        Sign out
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <div className="max-w-5xl mx-auto px-8 py-8">
                    {children}
                </div>
            </main>
        </div>
    );
}