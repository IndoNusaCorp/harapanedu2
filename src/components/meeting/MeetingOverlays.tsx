"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { FloatingReaction } from "@/hooks/useMeetingRoom";

const CONFETTI_COLORS = ["#FF7272", "#EEB400", "#8F80FF", "#34D399", "#60A5FA", "#F472B6"];
const CONFETTI_MS = 3000;

// Emoji reaksi yang melayang naik dari bawah layar
export function ReactionLayer({ reactions, showNames }: { reactions: FloatingReaction[]; showNames: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {reactions.map(r => (
        <div
          key={r.id}
          className="absolute bottom-24 flex flex-col items-center animate-float-up"
          style={{ left: `${r.left}%`, ["--drift" as string]: `${r.drift}px` }}
        >
          <span className="text-5xl drop-shadow-lg sm:text-6xl">{r.emoji}</span>
          {showNames && (
            <span className="mt-1 max-w-28 truncate rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-white">{r.name}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Hujan confetti saat ada yang mengirim 🎉
export function ConfettiLayer({ burstKey }: { burstKey: number }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (burstKey === 0) return;
    setActive(burstKey);
    const timer = setTimeout(() => setActive(0), CONFETTI_MS);
    return () => clearTimeout(timer);
  }, [burstKey]);

  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2 + Math.random() * 1.2,
    size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    round: i % 3 === 0,
  })), [active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[61] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={`${active}-${i}`}
          className="absolute top-0 animate-confetti"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            background: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
