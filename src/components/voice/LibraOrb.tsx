"use client";

import React, { useEffect, useRef } from "react";
import { X, FolderOpen, GraduationCap, Sparkles } from "lucide-react";
import { useI18n } from "@/components/translate/client";
import VoiceResultPanel from "@/components/voice/VoiceResultPanel";
import type { VoicePanel } from "@/lib/ai/voiceTools";

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
  /** Dokumen / nilai yang diminta lewat suara */
  panel?: VoicePanel | null;
  onClosePanel?: () => void;
  onOpenFile?: (id: string | null) => void;
  /** Kirim saran pertanyaan sebagai teks */
  onSuggest?: (text: string) => void;
  isTeacher?: boolean;
  variant?: "default" | "kids";
}

export const ORB_PALETTES = {
  default: ["#38bdf8", "#6366f1", "#d946ef", "#22d3ee"],
  kids: ["#fb923c", "#f472b6", "#facc15", "#f97316"],
  error: ["#f87171", "#ef4444", "#fb7185", "#fca5a5"],
};

const MAX_CAPTION_CHARS = 140;
const noop = () => {};

function lastChars(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `…${trimmed.slice(-max)}` : trimmed;
}

/**
 * LibraOrb — bola animasi ala Siri yang muncul setelah user memanggil "Hey Libra".
 * Mengambang di bawah layar tanpa menutupi halaman; ukurannya mengikuti suara user / LibraAI.
 * Jika user meminta dokumen atau nilai, panel hasil muncul di atas bola, dan bola
 * mengecil ke pojok saat dokumen dibuka.
 */
export default function LibraOrb({
  status,
  error,
  userTranscript,
  aiTranscript,
  wakeDetected,
  getLevel,
  onStop,
  panel = null,
  onClosePanel = noop,
  onOpenFile = noop,
  onSuggest,
  isTeacher = false,
  variant = "default",
}: LibraOrbProps) {
  const t = useI18n();
  const orbRef = useRef<HTMLDivElement>(null);
  const isKids = variant === "kids";
  const hasPanel = !!panel;
  const isDocOpen = panel?.type === "documents" && !!panel.openId;

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

  // Esc: tutup dokumen (ditangani viewer) → tutup panel → akhiri percakapan
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isDocOpen) return;
      if (hasPanel) onClosePanel();
      else onStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStop, onClosePanel, hasPanel, isDocOpen]);

  if (status === "idle") return null;

  const palette = status === "error" ? ORB_PALETTES.error : isKids ? ORB_PALETTES.kids : ORB_PALETTES.default;
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

  const suggestions = [
    { icon: FolderOpen, text: t("voice.panel.suggestDocs") },
    { icon: GraduationCap, text: isTeacher ? t("voice.panel.suggestGradesTeacher") : t("voice.panel.suggestGradesStudent") },
  ];
  const showSuggestions =
    !!onSuggest && status === "listening" && !hasPanel && !userTranscript && !aiTranscript && !wakeDetected;

  const endLabel = isKids ? t("voice.kids.end") : t("voice.end");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center pb-8 sm:pb-10">
      <style>{`
        @keyframes libra-orb-spin { to { transform: rotate(360deg); } }
        @keyframes libra-orb-in { from { opacity: 0; transform: translateY(24px) scale(.6); } to { opacity: 1; transform: none; } }
        @keyframes libra-orb-ripple { from { transform: scale(1); opacity: .5; } to { transform: scale(1.9); opacity: 0; } }
        @keyframes libra-chip-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .libra-orb { --lvl: 0; animation: libra-orb-in .45s cubic-bezier(.2,.9,.3,1.2) both; }
        .libra-orb-core { transform: scale(calc(1 + var(--lvl) * .35)); transition: transform 60ms linear; }
        .libra-orb-blob { position: absolute; inset: -20%; border-radius: 9999px; mix-blend-mode: screen; filter: blur(14px); animation: libra-orb-spin linear infinite; }
        .libra-orb-glow { transform: scale(calc(1.1 + var(--lvl) * .9)); opacity: calc(.35 + var(--lvl) * .6); transition: transform 80ms linear, opacity 80ms linear; }
        .libra-orb-ripple { animation: libra-orb-ripple 2.4s cubic-bezier(.2,.6,.4,1) infinite; }
        .libra-orb-size { transition: width .45s cubic-bezier(.2,.9,.3,1.1), height .45s cubic-bezier(.2,.9,.3,1.1); }
        .libra-chip { animation: libra-chip-in .4s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .libra-orb, .libra-orb-blob, .libra-orb-ripple, .libra-chip { animation: none; }
        }
      `}</style>

      {/* Latar gradasi lembut di bawah layar (lebih tinggi saat panel tampil) */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t transition-[height] duration-500 ${
          hasPanel && !isDocOpen ? "h-[85vh]" : "h-72"
        } ${isKids ? "from-orange-950/70 via-orange-950/25" : "from-slate-950/80 via-slate-950/30"} to-transparent`}
      />

      {/* Panel dokumen / nilai (viewer dokumen dirender dari sini juga) */}
      {panel && (
        <div className={isDocOpen ? "" : "relative mb-5 px-4"}>
          <VoiceResultPanel panel={panel} palette={palette} onClose={onClosePanel} onOpenFile={onOpenFile} />
        </div>
      )}

      <div
        ref={orbRef}
        className={`libra-orb flex items-center gap-3 ${
          isDocOpen
            ? "pointer-events-auto fixed bottom-5 right-5 z-[70] flex-row rounded-full bg-slate-950/80 py-2 pl-2 pr-4 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl"
            : "relative flex-col"
        }`}
      >
        {/* Bola */}
        <button
          type="button"
          onClick={onStop}
          aria-label={endLabel}
          className={`libra-orb-size pointer-events-auto relative flex shrink-0 items-center justify-center ${
            isDocOpen ? "h-12 w-12" : hasPanel ? "h-20 w-20" : "h-28 w-28 sm:h-32 sm:w-32"
          }`}
        >
          {status === "listening" && !isDocOpen && (
            <div className="libra-orb-ripple absolute inset-0 rounded-full border" style={{ borderColor: `${palette[0]}80` }} />
          )}
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
        <div
          className={`flex flex-col gap-1 ${
            isDocOpen ? "max-w-[min(60vw,16rem)] items-start text-left" : "max-w-[min(90vw,28rem)] items-center px-4 text-center"
          }`}
          aria-live="polite"
        >
          <p className={`font-semibold tracking-wide text-white/80 ${isDocOpen ? "text-xs" : "text-sm"}`}>{label}</p>
          {caption && status !== "error" && (
            <p
              className={`font-medium leading-snug ${aiTranscript ? "text-white" : "text-white/70"} ${
                isDocOpen ? "line-clamp-2 text-xs" : hasPanel ? "line-clamp-2 text-sm sm:text-base" : "text-base sm:text-lg"
              }`}
            >
              {caption}
            </p>
          )}
        </div>

        {/* Saran pertanyaan */}
        {showSuggestions && (
          <div className="flex max-w-[92vw] flex-wrap justify-center gap-2 px-4">
            <span className="libra-chip flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">
              <Sparkles className="h-3 w-3" /> {t("voice.panel.tryAsking")}
            </span>
            {suggestions.map((s, i) => (
              <button
                key={s.text}
                type="button"
                onClick={() => onSuggest?.(s.text)}
                className="libra-chip pointer-events-auto flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur-md transition hover:bg-white/20 active:scale-95"
                style={{ animationDelay: `${150 + i * 80}ms` }}
              >
                <s.icon className="h-4 w-4 text-white/70" />
                {s.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tombol tutup */}
      {!isDocOpen && (
        <button
          type="button"
          onClick={onStop}
          aria-label={endLabel}
          title={endLabel}
          className="pointer-events-auto absolute bottom-8 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 sm:bottom-10"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
