import React from "react";
import { Zap } from "lucide-react";

export function LoadingOverlay({ isVisible }: { isVisible: boolean }) {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl transition-opacity duration-500 animate-in fade-in">
            {/* Soft Radial Gradient Background */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,var(--tw-gradient-from)_0%,transparent_70%)] from-primary/5 to-transparent" />

            {/* 3D Cube Animation Container */}
            <div className="relative size-24 perspective-1000">
                <div className="absolute inset-0 preserve-3d animate-cube-rotate">
                    {/* Cube Faces */}
                    {[
                        "translateZ(48px)",
                        "rotateY(180deg) translateZ(48px)",
                        "rotateY(90deg) translateZ(48px)",
                        "rotateY(-90deg) translateZ(48px)",
                        "rotateX(90deg) translateZ(48px)",
                        "rotateX(-90deg) translateZ(48px)",
                    ].map((transform, i) => (
                        <div
                            key={i}
                            className="absolute inset-0 border border-primary/30 bg-primary/5 backdrop-blur-sm"
                            style={{ transform }}
                        />
                    ))}
                    {/* Glowing Core */}
                    <div className="absolute inset-4 rounded-full bg-primary/20 blur-xl animate-pulse" />
                </div>
            </div>

            {/* Brand Text */}
            <div className="mt-12 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <Zap className="size-5 text-primary animate-bounce shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
                    <span className="text-xl font-bold tracking-tighter text-foreground uppercase">
                        openrouter
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="size-1 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                    <div className="size-1 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                    <div className="size-1 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .perspective-1000 {
                    perspective: 1000px;
                }
                .preserve-3d {
                    transform-style: preserve-3d;
                }
                @keyframes cube-rotate {
                    0% { transform: rotateX(0deg) rotateY(0deg); }
                    100% { transform: rotateX(360deg) rotateY(360deg); }
                }
                .animate-cube-rotate {
                    animation: cube-rotate 8s linear infinite;
                }
                .wrap-break-word {
                    overflow-wrap: break-word;
                }
            `}} />
        </div>
    );
}
