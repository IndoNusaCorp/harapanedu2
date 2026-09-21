"use client";

import { useEffect, useRef, useState } from "react";

// Cocok dengan "Hey/Hai/Halo Libra" atau "Libra" saja, termasuk salah dengar umum dari transkripsi
export const WAKE_PHRASE_REGEX = /\b(hey|hei|hai|hi|halo|hallo)?\s*(libra|lybra|lebra)\b/i;

const RESTART_DELAY_MS = 300;
// Setelah "Hey Libra" terdengar, tunggu sebentar agar pertanyaan lanjutan ("..., tugas saya apa?") ikut terbawa
const FOLLOW_UP_WAIT_MS = 1200;

type WakeWordError = "not-allowed" | "unsupported" | null;

interface UseWakeWordOptions {
  /** Aktifkan pendengar wake phrase (matikan saat sesi voice sedang berjalan) */
  enabled: boolean;
  /** Dipanggil saat "Hey Libra" terdengar, dengan kalimat lengkap yang diucapkan user */
  onWake: (transcript: string) => void;
  lang?: string;
}

interface UseWakeWordReturn {
  supported: boolean;
  listening: boolean;
  error: WakeWordError;
}

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * useWakeWord — mendengarkan "Hey Libra" di browser (Web Speech API) tanpa perlu klik mic.
 * Hanya dipakai saat voice chat mati; setelah terdeteksi, sesi Gemini Live yang mengambil alih mic.
 */
export function useWakeWord({ enabled, onWake, lang = "id-ID" }: UseWakeWordOptions): UseWakeWordReturn {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<WakeWordError>(null);

  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    setSupported(!!SpeechRecognition);
    if (!SpeechRecognition) {
      setError("unsupported");
      return;
    }
    if (!enabled) return;

    let stopped = false;
    let woke = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let followUpTimer: ReturnType<typeof setTimeout> | null = null;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    const fireWake = (transcript: string) => {
      if (woke || stopped) return;
      woke = true;
      stopped = true;
      if (followUpTimer) clearTimeout(followUpTimer);
      try {
        recognition.stop();
      } catch {
        // Sudah berhenti
      }
      onWakeRef.current(transcript.trim());
    };

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      let latest = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        latest += event.results[i][0].transcript;
        isFinal = event.results[i].isFinal;
      }
      if (!WAKE_PHRASE_REGEX.test(latest)) return;

      if (isFinal) {
        fireWake(latest);
      } else {
        // Masih bicara: beri waktu untuk pertanyaan lanjutan, lalu tetap bangun walau belum final
        if (followUpTimer) clearTimeout(followUpTimer);
        followUpTimer = setTimeout(() => fireWake(latest), FOLLOW_UP_WAIT_MS);
      }
    };

    recognition.onerror = (event: any) => {
      // "no-speech" dan "aborted" normal terjadi; cukup restart lewat onend
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        stopped = true;
        setError("not-allowed");
      }
    };

    recognition.onend = () => {
      setListening(false);
      // Chrome menghentikan recognition setelah hening; nyalakan lagi selama masih aktif
      if (!stopped) {
        restartTimer = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Sedang berjalan
          }
        }, RESTART_DELAY_MS);
      }
    };

    setError(null);
    try {
      recognition.start();
    } catch {
      // Sedang berjalan
    }

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      if (followUpTimer) clearTimeout(followUpTimer);
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // Sudah berhenti
      }
      setListening(false);
    };
  }, [enabled, lang]);

  return { supported, listening, error };
}
