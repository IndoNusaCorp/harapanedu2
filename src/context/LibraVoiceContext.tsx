"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { useLibraVoice } from "@/hooks/useLibraVoice";
import { useWakeWord } from "@/hooks/useWakeWord";
import LibraOrb from "@/components/voice/LibraOrb";

type VoiceSource = "manual" | "wake" | null;

type LibraVoiceContextValue = ReturnType<typeof useLibraVoice> & {
  /** Sesi dimulai dari tombol mic ("manual") atau dari "Hey Libra" ("wake") */
  source: VoiceSource;
  startManual: () => void;
  wakeWordEnabled: boolean;
  setWakeWordEnabled: (enabled: boolean) => void;
  wakeWordSupported: boolean;
  wakeWordDenied: boolean;
};

const LibraVoiceContext = createContext<LibraVoiceContextValue | null>(null);

const WAKE_WORD_STORAGE_KEY = "libra.wakeWordEnabled";
// Halaman (relatif terhadap /[role]/[id]) yang boleh memanggil "Hey Libra"; "" = dashboard
const WAKE_WORD_PAGES = ["", "/my-work", "/my-classes", "/assignment", "/calendar", "/libraai", "/meetings"];
// Sesi dari "Hey Libra" ditutup otomatis setelah hening sekian lama, lalu kembali menunggu panggilan
const WAKE_SESSION_IDLE_MS = 20_000;

function isWakeWordPage(pathname: string, basePath: string): boolean {
  const index = pathname.indexOf(basePath);
  if (index === -1) return false;
  const rest = pathname.slice(index + basePath.length).replace(/\/$/, "");
  return WAKE_WORD_PAGES.some((page) =>
    page === "" ? rest === "" : rest === page || rest.startsWith(`${page}/`)
  );
}

export function LibraVoiceProvider({ basePath, children }: { basePath: string; children: React.ReactNode }) {
  const { role, classLevel, isKidsMode } = useRole();
  const pathname = usePathname();
  const voice = useLibraVoice({ role, classLevel: classLevel ?? 0 });
  const [source, setSource] = useState<VoiceSource>(null);

  const [wakeWordEnabled, setWakeWordEnabledState] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(WAKE_WORD_STORAGE_KEY) === "false") setWakeWordEnabledState(false);
    } catch {
      // localStorage tidak tersedia
    }
  }, []);

  const setWakeWordEnabled = useCallback((enabled: boolean) => {
    setWakeWordEnabledState(enabled);
    try {
      localStorage.setItem(WAKE_WORD_STORAGE_KEY, String(enabled));
    } catch {
      // localStorage tidak tersedia
    }
  }, []);

  const { startVoiceChat, stopVoiceChat, status } = voice;

  const startManual = useCallback(() => {
    setSource("manual");
    startVoiceChat();
  }, [startVoiceChat]);

  const wakeWord = useWakeWord({
    // Mic hanya boleh dipakai satu pihak: matikan pendengar saat sesi Gemini berjalan
    enabled: wakeWordEnabled && status === "idle" && isWakeWordPage(pathname, basePath),
    onWake: (transcript) => {
      setSource("wake");
      startVoiceChat(transcript);
    },
  });

  useEffect(() => {
    if (status === "idle") setSource(null);
  }, [status]);

  // Tutup sesi "Hey Libra" jika tidak ada percakapan selama WAKE_SESSION_IDLE_MS
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (source !== "wake" || status !== "listening") return;
    idleTimerRef.current = setTimeout(stopVoiceChat, WAKE_SESSION_IDLE_MS);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [source, status, voice.userTranscript, voice.aiTranscript, stopVoiceChat]);

  const value: LibraVoiceContextValue = {
    ...voice,
    source,
    startManual,
    wakeWordEnabled,
    setWakeWordEnabled,
    wakeWordSupported: wakeWord.supported,
    wakeWordDenied: wakeWord.error === "not-allowed",
  };

  return (
    <LibraVoiceContext.Provider value={value}>
      {children}
      {source === "wake" && (
        <LibraOrb
          status={voice.status}
          error={voice.error}
          userTranscript={voice.userTranscript}
          aiTranscript={voice.aiTranscript}
          wakeDetected={voice.wakeDetected}
          getLevel={voice.getLevel}
          onStop={voice.stopVoiceChat}
          variant={isKidsMode ? "kids" : "default"}
        />
      )}
    </LibraVoiceContext.Provider>
  );
}

export function useLibraVoiceContext(): LibraVoiceContextValue {
  const ctx = useContext(LibraVoiceContext);
  if (!ctx) throw new Error("useLibraVoiceContext must be used within LibraVoiceProvider");
  return ctx;
}
