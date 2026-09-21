"use client";

import { useEffect, useState } from "react";

/**
 * CoachAvatar - AI coach avatar with subtle animations
 * 
 * States:
 * - idle: Subtle breathing animation
 * - listening: Gentle pulsing when input is focused
 * - thinking: Loading animation with dots
 * - speaking: Active animation during response
 */

type AvatarState = "idle" | "listening" | "thinking" | "speaking";

interface CoachAvatarProps {
  state?: AvatarState;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function CoachAvatar({ 
  state = "idle", 
  size = "md",
  className = "" 
}: CoachAvatarProps) {
  const [tick, setTick] = useState(0);

  // Thinking animation - dots. Only the tick counter is stateful; the rendered
  // string is derived, so leaving "thinking" needs no state reset in the effect.
  useEffect(() => {
    if (state !== "thinking") return;

    const interval = setInterval(() => setTick((prev) => prev + 1), 400);
    return () => clearInterval(interval);
  }, [state]);

  const dots = state === "thinking" ? ".".repeat(tick % 4) : "";

  const sizeStyles = {
    sm: { width: 40, height: 40, fontSize: 20 },
    md: { width: 56, height: 56, fontSize: 28 },
    lg: { width: 80, height: 80, fontSize: 40 },
  };

  const { width, height, fontSize } = sizeStyles[size];

  // Animation keyframes based on state
  const getAnimation = () => {
    switch (state) {
      case "listening":
        return "pulse 2s ease-in-out infinite";
      case "thinking":
        return "breathe 1.5s ease-in-out infinite";
      case "speaking":
        return "bounce 0.6s ease-in-out infinite";
      default:
        return "breathe 4s ease-in-out infinite";
    }
  };

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width, height }}
    >
      {/* Glow ring for listening/thinking states */}
      {(state === "listening" || state === "thinking") && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "var(--primary)",
            opacity: 0.15,
            animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
          }}
        />
      )}
      
      {/* Main avatar circle */}
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width,
          height,
          background: "linear-gradient(135deg, var(--primary) 0%, var(--terracotta-deep) 100%)",
          boxShadow: state === "speaking" 
            ? "0 0 20px rgba(196, 114, 74, 0.4)" 
            : "0 4px 12px rgba(196, 114, 74, 0.2)",
          animation: getAnimation(),
          transition: "box-shadow var(--motion-medium) ease",
        }}
      >
        {/* Coach icon/emoji */}
        <span 
          style={{ 
            fontSize, 
            lineHeight: 1,
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))"
          }}
          role="img" 
          aria-label="Financial coach"
        >
          🤖
        </span>

        {/* Thinking dots overlay */}
        {state === "thinking" && (
          <span
            className="absolute bottom-0 right-0 flex items-center justify-center rounded-full"
            style={{
              width: size === "lg" ? 24 : size === "md" ? 18 : 14,
              height: size === "lg" ? 24 : size === "md" ? 18 : 14,
              backgroundColor: "var(--surface)",
              border: "2px solid var(--primary)",
              fontSize: size === "lg" ? 10 : 8,
              fontWeight: 700,
              color: "var(--primary)",
            }}
          >
            {dots || "..."}
          </span>
        )}
      </div>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
