"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/components/translate/client";

type VoiceStatus = "idle" | "connecting" | "listening" | "ai-speaking" | "error";

interface LibraOrbProps {
  status: VoiceStatus;
  error: string | null;
  userTranscript: string;
  aiTranscript: string;
  wakeDetected: boolean;
  /** Level suara 0..1, dibaca per frame */
  getLevel: () => number;
  onStop: () => void;
  variant?: "default" | "kids";
}

const PALETTES = {
  default: ["#38bdf8", "#6366f1", "#d946ef", "#22d3ee"],
  kids: ["#fb923c", "#f472b6", "#facc15", "#f97316"],
  error: ["#f87171", "#ef4444", "#fb7185", "#fca5a5"],
};

const MAX_CAPTION_CHARS = 140;

function lastChars(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `…${trimmed.slice(-max)}` : trimmed;
}

/**
 * LibraOrb — bola animasi ala Siri yang muncul setelah user memanggil "Hey Libra".
 * Mengambang di bawah layar tanpa menutupi halaman; ukurannya mengikuti suara user / LibraAI.
 */
export default function LibraOrb({
  status,
  error,
  userTranscript,
  aiTranscript,
  wakeDetected,
  getLevel,
  onStop,
  variant = "default",
}: LibraOrbProps) {
  const t = useI18n();
  const orbRef = useRef<HTMLDivElement>(null);
  const isKids = variant === "kids";

  // Animasi level suara per frame, tanpa re-render React
  useEffect(() => {
    let frame = 0;
    let smoothed = 0;
    const tick = (time: number) => {
      const target = getLevel();
      smoothed += (target - smoothed) * 0.18;
      // Saat menghubungkan / hening, bola tetap "bernapas" pelan
      const breathe = (Math.sin(time / 700) + 1) * 0.03;
      const level = Math.max(smoothed, breathe);
      orbRef.current?.style.setProperty("--lvl", level.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getLevel]);

  // Esc untuk menutup
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStop]);

  if (status === "idle") return null;

  const palette = status === "error" ? PALETTES.error : isKids ? PALETTES.kids : PALETTES.default;
  const speed = status === "ai-speaking" ? 0.6 : status === "connecting" ? 1.6 : 1;

  const label =
    status === "error"
      ? error || t("voice.error")
      : wakeDetected
      ? isKids ? t("voice.kids.wakeDetected") : t("voice.wakeDetected")
      : status === "connecting"
      ? isKids ? t("voice.kids.connecting") : t("voice.connecting")
      : status === "ai-speaking"
      ? isKids ? t("voice.kids.speaking") : t("voice.speaking")
      : isKids ? t("voice.kids.listening") : t("voice.listening");

  const caption = aiTranscript
    ? lastChars(aiTranscript, MAX_CAPTION_CHARS)
    : lastChars(userTranscript, MAX_CAPTION_CHARS);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center pb-8 sm:pb-10">
      <style>{`
        @keyframes libra-orb-spin { to { transform: rotate(360deg); } }
        @keyframes libra-orb-in { from { opacity: 0; transform: translateY(24px) scale(.6); } to { opacity: 1; transform: none; } }
        .libra-orb { --lvl: 0; animation: libra-orb-in .45s cubic-bezier(.2,.9,.3,1.2) both; }
        .libra-orb-core { transform: scale(calc(1 + var(--lvl) * .35)); transition: transform 60ms linear; }
        .libra-orb-blob { position: absolute; inset: -20%; border-radius: 9999px; mix-blend-mode: screen; filter: blur(14px); animation: libra-orb-spin linear infinite; }
        .libra-orb-glow { transform: scale(calc(1.1 + var(--lvl) * .9)); opacity: calc(.35 + var(--lvl) * .6); transition: transform 80ms linear, opacity 80ms linear; }
        @media (prefers-reduced-motion: reduce) {
          .libra-orb, .libra-orb-blob { animation: none; }
        }
      `}</style>

      {/* Latar gradasi lembut di bawah layar */}
      <div
        className={`absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t ${
          isKids ? "from-orange-900/40" : "from-slate-950/60"
        } to-transparent`}
      />

      <div ref={orbRef} className="libra-orb relative flex flex-col items-center gap-4">
        {/* Bola */}
        <button
          type="button"
          onClick={onStop}
          aria-label={isKids ? t("voice.kids.end") : t("voice.end")}
          className="pointer-events-auto relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32"
        >
          <div
            className="libra-orb-glow absolute inset-0 rounded-full blur-2xl"
            style={{ background: `radial-gradient(circle, ${palette[1]}, transparent 70%)` }}
          />
          <div className="libra-orb-core relative h-full w-full overflow-hidden rounded-full bg-slate-950 shadow-2xl">
            <div
              className="libra-orb-blob"
              style={{
                background: `conic-gradient(from 0deg, ${palette[0]}, transparent 40%, ${palette[1]} 60%, transparent 85%)`,
                animationDuration: `${4 * speed}s`,
              }}
            />
            <div
              className="libra-orb-blob"
              style={{
                background: `conic-gradient(from 120deg, ${palette[2]}, transparent 45%, ${palette[3]} 70%, transparent)`,
                animationDuration: `${6 * speed}s`,
                animationDirection: "reverse",
              }}
            />
            <div
              className="libra-orb-blob"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${palette[3]}, transparent 55%)`,
                animationDuration: `${9 * speed}s`,
              }}
            />
            {/* Kilau kaca */}
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,.45),transparent_45%)]" />
            <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
          </div>
        </button>

        {/* Status + transkrip */}
        <div className="flex max-w-[min(90vw,28rem)] flex-col items-center gap-1 px-4 text-center" aria-live="polite">
          <p className="text-sm font-semibold tracking-wide text-white/80">{label}</p>
          {caption && status !== "error" && (
            <p className={`text-base font-medium leading-snug sm:text-lg ${aiTranscript ? "text-white" : "text-white/70"}`}>
              {caption}
            </p>
          )}
        </div>
      </div>

      {/* Tombol tutup */}
      <button
        type="button"
        onClick={onStop}
        aria-label={isKids ? t("voice.kids.end") : t("voice.end")}
        title={isKids ? t("voice.kids.end") : t("voice.end")}
        className="pointer-events-auto absolute bottom-8 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 sm:bottom-10"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
