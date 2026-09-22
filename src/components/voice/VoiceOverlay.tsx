"use client";

import React from "react";
import { Mic, MicOff, X, Radio } from "lucide-react";
import { useI18n } from "@/components/translate/client";
import VoiceResultPanel from "@/components/voice/VoiceResultPanel";
import { ORB_PALETTES } from "@/components/voice/LibraOrb";
import type { VoicePanel } from "@/lib/ai/voiceTools";

type VoiceStatus = "idle" | "connecting" | "listening" | "ai-speaking" | "error";

interface VoiceOverlayProps {
  status: VoiceStatus;
  error: string | null;
  onStop: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  variant?: "default" | "kids";
  userTranscript?: string;
  aiTranscript?: string;
  wakeDetected?: boolean;
  /** Dokumen / nilai yang diminta lewat suara */
  panel?: VoicePanel | null;
  onClosePanel?: () => void;
  onOpenFile?: (id: string | null) => void;
}

const noop = () => {};

// Tinggi tetap agar bar tidak "loncat" setiap render (sebelumnya Math.random di render)
const WAVE_HEIGHTS = [10, 18, 24, 16, 12];

export default function VoiceOverlay({
  status,
  error,
  onStop,
  isMuted = false,
  onToggleMute,
  variant = "default",
  userTranscript = "",
  aiTranscript = "",
  wakeDetected = false,
  panel = null,
  onClosePanel = noop,
  onOpenFile = noop,
}: VoiceOverlayProps) {
  const t = useI18n();
  if (status === "idle") return null;

  const isKids = variant === "kids";
  const hasPanel = !!panel && status !== "error";

  const statusConfig = {
    connecting: {
      label: isKids ? t("voice.kids.connecting") : t("voice.connecting"),
      hint: isKids ? t("voice.kids.connectingHint") : t("voice.connectingHint"),
      icon: <Radio className="w-10 h-10 sm:w-12 sm:h-12" />,
      pulseColor: isKids ? "bg-orange-400" : "bg-blue-500",
      iconBg: isKids ? "bg-orange-500" : "bg-blue-600",
    },
    listening: {
      label: isKids ? t("voice.kids.listening") : t("voice.listening"),
      hint: isKids ? t("voice.kids.listeningHint") : t("voice.listeningHint"),
      icon: <Mic className="w-10 h-10 sm:w-12 sm:h-12" />,
      pulseColor: isKids ? "bg-green-400" : "bg-emerald-500",
      iconBg: isKids ? "bg-green-500" : "bg-emerald-600",
    },
    "ai-speaking": {
      label: isKids ? t("voice.kids.speaking") : t("voice.speaking"),
      hint: isKids ? t("voice.kids.speakingHint") : t("voice.speakingHint"),
      icon: <Radio className="w-10 h-10 sm:w-12 sm:h-12" />,
      pulseColor: isKids ? "bg-purple-400" : "bg-indigo-500",
      iconBg: isKids ? "bg-purple-500" : "bg-indigo-600",
    },
    error: {
      label: error || (isKids ? t("voice.kids.error") : t("voice.error")),
      hint: null,
      icon: <MicOff className="w-10 h-10 sm:w-12 sm:h-12" />,
      pulseColor: "bg-red-400",
      iconBg: "bg-red-500",
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig];
  if (!config) return null;

  const hintColor =
    status === "ai-speaking"
      ? isKids ? "text-purple-200" : "text-slate-300"
      : isKids ? "text-orange-200" : "text-slate-300";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${
          isKids
            ? "bg-gradient-to-b from-orange-900/60 to-pink-900/60"
            : "bg-slate-900/70 dark:bg-black/80"
        } backdrop-blur-xl`}
        onClick={status === "error" ? onStop : undefined}
      />

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center w-full mx-4 ${
          hasPanel ? "gap-4 p-4 max-w-xl max-h-screen overflow-y-auto" : "gap-6 sm:gap-8 p-6 sm:p-8 max-w-sm"
        }`}
      >
        {/* Animated Orb */}
        <div className="relative flex items-center justify-center">
          {/* Pulse rings */}
          {status !== "error" && (
            <>
              <div
                className={`absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full ${config.pulseColor} opacity-10 animate-ping`}
                style={{ animationDuration: "2s" }}
              />
              <div
                className={`absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full ${config.pulseColor} opacity-15 animate-ping`}
                style={{ animationDuration: "2.5s", animationDelay: "0.5s" }}
              />
              <div
                className={`absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full ${config.pulseColor} opacity-20 animate-ping`}
                style={{ animationDuration: "3s", animationDelay: "1s" }}
              />
            </>
          )}

          {/* Main circle */}
          {/* Ring saat "Hey Libra" terdeteksi */}
          {wakeDetected && (
            <div
              className={`absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full border-4 ${
                isKids ? "border-yellow-300" : "border-sky-300"
              } animate-ping`}
              style={{ animationDuration: "1s" }}
            />
          )}

          <div
            className={`relative ${hasPanel ? "w-20 h-20 [&>svg]:w-8 [&>svg]:h-8" : "w-28 h-28 sm:w-32 sm:h-32"} rounded-full ${config.iconBg} flex items-center justify-center text-white shadow-2xl transition-transform duration-300 ${
              wakeDetected ? "scale-110" : status === "listening" ? "animate-pulse" : ""
            }`}
            style={{
              boxShadow: `0 0 60px ${
                status === "listening"
                  ? isKids
                    ? "rgba(34, 197, 94, 0.4)"
                    : "rgba(16, 185, 129, 0.4)"
                  : status === "ai-speaking"
                  ? isKids
                    ? "rgba(168, 85, 247, 0.4)"
                    : "rgba(99, 102, 241, 0.4)"
                  : status === "error"
                  ? "rgba(239, 68, 68, 0.4)"
                  : isKids
                  ? "rgba(251, 146, 60, 0.4)"
                  : "rgba(59, 130, 246, 0.4)"
              }`,
            }}
          >
            {config.icon}

            {/* Soundwave bars for AI speaking */}
            {status === "ai-speaking" && (
              <div className="absolute -bottom-2 flex items-end gap-1">
                {WAVE_HEIGHTS.map((height, i) => (
                  <div
                    key={i}
                    className="w-1 bg-white/80 rounded-full animate-bounce"
                    style={{
                      height: `${height}px`,
                      animationDelay: `${i * 100}ms`,
                      animationDuration: "0.6s",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status text */}
        <div className="text-center space-y-2" aria-live="polite">
          <p className="text-lg sm:text-xl font-bold text-white">
            {wakeDetected
              ? isKids ? t("voice.kids.wakeDetected") : t("voice.wakeDetected")
              : config.label}
          </p>
          {config.hint && (
            <p className={`text-sm ${hintColor}`}>
              {config.hint}
            </p>
          )}
        </div>

        {/* Dokumen / nilai yang diminta lewat suara */}
        {hasPanel && (
          <VoiceResultPanel
            panel={panel}
            palette={isKids ? ORB_PALETTES.kids : ORB_PALETTES.default}
            onClose={onClosePanel}
            onOpenFile={onOpenFile}
          />
        )}

        {/* Live transcript */}
        {status !== "error" && (userTranscript || aiTranscript) && (
          <div
            className={`w-full ${hasPanel ? "max-h-24" : "max-h-40"} overflow-y-auto rounded-2xl px-4 py-3 space-y-2 text-sm ${
              isKids ? "bg-white/15" : "bg-white/5 border border-white/10"
            }`}
          >
            {userTranscript && (
              <p className="text-white/70">
                <span className="font-semibold text-white">
                  {isKids ? t("voice.kids.you") : t("voice.you")}:
                </span>{" "}
                {userTranscript.trim()}
              </p>
            )}
            {aiTranscript && (
              <p className="text-white">
                <span className={`font-semibold ${isKids ? "text-yellow-200" : "text-sky-300"}`}>
                  LibraAI:
                </span>{" "}
                {aiTranscript.trim()}
              </p>
            )}
          </div>
        )}

        {/* Wake phrase hint */}
        {(status === "listening" || status === "ai-speaking") && !isMuted && !hasPanel && (
          <p className={`text-xs text-center ${isKids ? "text-orange-100/80" : "text-slate-400"}`}>
            {isKids ? t("voice.kids.wakeHint") : t("voice.wakeHint")}
          </p>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-3">
          {/* Mute toggle button (only show when active/listening) */}
          {status !== "error" && onToggleMute && (
            <button
              onClick={onToggleMute}
              className={`flex items-center justify-center p-3 sm:px-6 sm:py-3 rounded-full font-bold text-sm transition-all active:scale-95 shadow-lg ${
                isMuted
                  ? isKids
                    ? "bg-red-500 text-white hover:bg-red-600 border-4 border-red-200"
                    : "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30"
                  : isKids
                  ? "bg-white text-orange-600 hover:bg-orange-50 border-4 border-orange-200"
                  : "bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20"
              }`}
              title={isMuted ? t("voice.unmute") : t("voice.mute")}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span className="hidden sm:block ml-2">
                {isMuted ? t("voice.micOff") : t("voice.micOn")}
              </span>
            </button>
          )}

          {/* Stop button */}
          <button
            onClick={onStop}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all active:scale-95 shadow-lg ${
              isKids
                ? "bg-white text-orange-600 hover:bg-orange-50 border-4 border-orange-200"
                : "bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20"
            }`}
          >
            <X className="w-5 h-5" />
            {status === "error"
              ? t("common.close")
              : isKids
              ? t("voice.kids.end")
              : t("voice.end")}
          </button>
        </div>
      </div>
    </div>
  );
}
