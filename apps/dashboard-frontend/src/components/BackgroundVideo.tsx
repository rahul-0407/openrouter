import { useEffect, useRef } from "react";

interface BackgroundVideoProps {
    src: string;
    opacity?: number;
}

export function BackgroundVideo({ src, opacity = 0.15 }: BackgroundVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Ensure video plays efficiently
        video.play().catch((error) => {
            console.warn("Video autoplay failed:", error);
        });
    }, []);

    return (
        <video
            ref={videoRef}
            className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            style={{
                opacity,
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
            }}
        >
            <source src={src} type="video/mp4" />
            <source src={src} type="video/webm" />
            Your browser does not support the video tag.
        </video>
    );
}
