"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { useI18n } from "@/components/translate/client";
import { aiFetch } from "@/lib/ai/client";
import { WAKE_PHRASE_REGEX } from "@/hooks/useWakeWord";
import { VOICE_TOOL_NAMES, type VoicePanel, type VoiceToolName } from "@/lib/ai/voiceTools";

type VoiceStatus = "idle" | "connecting" | "listening" | "ai-speaking" | "error";

interface UseLibraVoiceOptions {
  role: string;
  classLevel: number | null;
  // Tidak dipakai lagi: server mengambil konteks sendiri dari Firestore
  contextData?: string;
}

interface UseLibraVoiceReturn {
  status: VoiceStatus;
  error: string | null;
  /** initialText: kalimat yang sudah diucapkan user (dari wake word), dikirim sebagai giliran pertama */
  startVoiceChat: (initialText?: string) => Promise<void>;
  stopVoiceChat: () => void;
  isActive: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  /** Transkrip ucapan user pada giliran saat ini */
  userTranscript: string;
  /** Transkrip jawaban LibraAI pada giliran saat ini */
  aiTranscript: string;
  /** true sesaat setelah user memanggil "Hey Libra" */
  wakeDetected: boolean;
  /** Level suara 0..1 (mic saat mendengarkan, LibraAI saat bicara) — dibaca per frame untuk animasi */
  getLevel: () => number;
  /** Tampilan hasil tool (dokumen / nilai) yang diminta lewat suara */
  panel: VoicePanel | null;
  closePanel: () => void;
  /** Buka / tutup file di panel dokumen (null = tutup viewer) */
  openFile: (id: string | null) => void;
  /** Kirim pertanyaan berupa teks (misal dari chip saran) ke sesi yang sedang berjalan */
  sendText: (text: string) => void;
}

interface FunctionCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

const WAKE_FLASH_MS = 1500;

/** RMS sederhana, dinormalisasi ke 0..1 */
function rms(samples: ArrayLike<number>, scale: number): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] / scale;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

/**
 * arrayBufferToBase64 — converts an ArrayBuffer to a base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * base64ToArrayBuffer — converts a base64 string to an ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function useLibraVoice({
  role,
  classLevel,
}: UseLibraVoiceOptions): UseLibraVoiceReturn {
  const t = useI18n();
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;
  const [userTranscript, setUserTranscript] = useState("");
  const [aiTranscript, setAiTranscript] = useState("");
  const [wakeDetected, setWakeDetected] = useState(false);
  const [panel, setPanel] = useState<VoicePanel | null>(null);
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Menandai giliran baru, supaya transkrip lama dibersihkan saat user mulai bicara lagi
  const turnDoneRef = useRef(true);
  const userTranscriptRef = useRef("");

  // Refs to persist across renders
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Audio playback queue
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Level audio untuk animasi (ref, supaya tidak memicu re-render tiap chunk)
  const inputLevelRef = useRef(0);
  const outputLevelRef = useRef(0);
  const statusRef = useRef<VoiceStatus>("idle");
  statusRef.current = status;

  /**
   * Play queued audio buffers sequentially
   */
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      outputLevelRef.current = 0;
      setStatus((prev) => (prev === "ai-speaking" ? "listening" : prev));
      return;
    }

    isPlayingRef.current = true;
    setStatus("ai-speaking");

    const samples = audioQueueRef.current.shift()!;
    outputLevelRef.current = rms(samples, 1);

    if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    const ctx = playbackContextRef.current;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(ctx.destination);
    sourceNode.onended = () => {
      if (currentSourceRef.current === sourceNode) currentSourceRef.current = null;
      playNextAudio();
    };
    currentSourceRef.current = sourceNode;
    sourceNode.start();
  }, []);

  /**
   * Hentikan audio LibraAI yang sedang diputar (dipakai saat user memotong / memanggil "Hey Libra")
   */
  const stopPlayback = useCallback(() => {
    audioQueueRef.current = [];
    const current = currentSourceRef.current;
    currentSourceRef.current = null;
    if (current) {
      current.onended = null;
      try {
        current.stop();
      } catch {
        // Sudah berhenti
      }
    }
    isPlayingRef.current = false;
    setStatus((prev) => (prev === "ai-speaking" ? "listening" : prev));
  }, []);

  const flashWake = useCallback(() => {
    setWakeDetected(true);
    if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    wakeTimerRef.current = setTimeout(() => setWakeDetected(false), WAKE_FLASH_MS);
  }, []);

  /**
   * Enqueue received audio for playback
   */
  const enqueueAudio = useCallback(
    (pcmData: ArrayBuffer) => {
      // Convert Int16 PCM to Float32
      const int16 = new Int16Array(pcmData);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      audioQueueRef.current.push(float32);

      if (!isPlayingRef.current) {
        playNextAudio();
      }
    },
    [playNextAudio]
  );

  /**
   * Jalankan tool yang diminta Gemini, tampilkan hasilnya, lalu kirim ringkasannya kembali ke model
   */
  const handleToolCalls = useCallback(async (calls: FunctionCall[]) => {
    const session = sessionRef.current;
    // Abaikan hasil yang datang setelah sesi ditutup
    const showPanel = (next: VoicePanel) => {
      if (sessionRef.current === session) setPanel(next);
    };
    const responses = await Promise.all(
      calls.map(async (call) => {
        const name = call.name as VoiceToolName;
        const reply = (response: Record<string, unknown>) => ({ id: call.id, name: call.name, response });

        if (!VOICE_TOOL_NAMES.includes(name)) return reply({ error: "Tool tidak dikenal" });
        if (name === "close_panel") {
          setPanel(null);
          return reply({ ok: true });
        }

        showPanel({ type: "loading", tool: name });
        try {
          const res = await aiFetch("/api/libraai-voice/tools", {
            method: "POST",
            body: JSON.stringify({ name, args: call.args || {} }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || "tool");
          showPanel(json.data.panel);
          return reply(json.data.result);
        } catch (err) {
          console.warn("[LibraVoice] Tool gagal:", name, err);
          showPanel({ type: "error", tool: name });
          return reply({ error: "Gagal mengambil data. Minta pengguna mencoba lagi." });
        }
      })
    );

    try {
      if (sessionRef.current === session) session?.sendToolResponse({ functionResponses: responses });
    } catch (err) {
      console.warn("[LibraVoice] Gagal mengirim hasil tool:", err);
    }
  }, []);

  /**
   * Start the voice chat session
   */
  const startVoiceChat = useCallback(async (initialText?: string) => {
    // Bisa dipanggil langsung dari onClick (argumen berupa event), abaikan selain string
    const firstTurn = typeof initialText === "string" ? initialText.trim() : "";
    try {
      setError(null);
      setUserTranscript("");
      setAiTranscript("");
      setPanel(null);
      turnDoneRef.current = true;
      userTranscriptRef.current = "";
      setStatus("connecting");

      // 1. Request microphone permission
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;

      // 2. Fetch ephemeral token from API route
      const tokenResponse = await aiFetch("/api/libraai-voice", {
        method: "POST",
        body: JSON.stringify({ role, classLevel }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.success) {
        throw new Error(tokenData.error || "token");
      }

      const { token, model, systemInstruction, tools } = tokenData.data;

      // 3. Connect to Gemini Live API via SDK
      const ai = new GoogleGenAI({ 
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' }
      });

      const session = await ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          tools,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede",
              },
            },
          },
        },
        callbacks: {
          onopen: () => {
            console.log("[LibraVoice] Session connected");
            setStatus("listening");
          },
          onmessage: (message: any) => {
            // Model meminta menampilkan dokumen / nilai di layar
            if (message.toolCall?.functionCalls?.length) {
              handleToolCalls(message.toolCall.functionCalls);
            }

            const content = message.serverContent;
            if (!content) return;

            // User memotong LibraAI (misal memanggil "Hey Libra" saat LibraAI bicara):
            // buang sisa audio agar LibraAI langsung mendengarkan
            if (content.interrupted) {
              stopPlayback();
            }

            // Transkrip ucapan user + deteksi wake phrase
            const inputText: string | undefined = content.inputTranscription?.text;
            if (inputText) {
              if (turnDoneRef.current) {
                turnDoneRef.current = false;
                userTranscriptRef.current = "";
                setAiTranscript("");
              }
              const prev = userTranscriptRef.current;
              const next = prev + inputText;
              userTranscriptRef.current = next;
              setUserTranscript(next);
              if (WAKE_PHRASE_REGEX.test(next) && !WAKE_PHRASE_REGEX.test(prev)) {
                flashWake();
                stopPlayback();
              }
            }

            // Transkrip jawaban LibraAI
            const outputText: string | undefined = content.outputTranscription?.text;
            if (outputText) {
              setAiTranscript((prev) => prev + outputText);
            }

            // Handle audio response from Gemini
            if (content.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const audioBuffer = base64ToArrayBuffer(part.inlineData.data);
                  enqueueAudio(audioBuffer);
                }
              }
            }

            // AI selesai menjawab; status kembali ke listening saat antrean audio habis
            if (content.turnComplete) {
              turnDoneRef.current = true;
            }
          },
          onerror: (e: any) => {
            console.error("[LibraVoice] Error:", e);
            setError(t("voice.errors.connectionLost"));
            setStatus("error");
          },
          onclose: (e: any) => {
            console.log("[LibraVoice] Session closed:", e?.reason || "");
            setStatus("idle");
          },
        },
      });

      sessionRef.current = session;

      // 4. Setup AudioWorklet for mic capture
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/pcm-processor.js");

      const source = audioContext.createMediaStreamSource(micStream);
      sourceNodeRef.current = source;

      const workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletNodeRef.current = workletNode;

      // 5. Stream mic audio to Gemini
      workletNode.port.onmessage = (event: MessageEvent) => {
        inputLevelRef.current = rms(new Int16Array(event.data), 32768);
        if (sessionRef.current) {
          const base64Audio = arrayBufferToBase64(event.data);
          try {
            sessionRef.current.sendRealtimeInput({
              audio: {
                data: base64Audio,
                mimeType: "audio/pcm;rate=16000",
              },
            });
          } catch (err) {
            // Session may have closed
            console.warn("[LibraVoice] Failed to send audio:", err);
          }
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination); // Required for worklet to run

      // Dimulai tanpa klik (wake word): browser bisa menahan AudioContext dalam keadaan suspended
      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }

      setStatus("listening");

      // "Hey Libra" sudah diucapkan sebelum sesi terhubung, jadi teruskan ke Gemini agar langsung dijawab
      if (firstTurn) {
        flashWake();
        userTranscriptRef.current = firstTurn;
        setUserTranscript(firstTurn);
        turnDoneRef.current = false;
        session.sendClientContent({
          turns: [{ role: "user", parts: [{ text: firstTurn }] }],
          turnComplete: true,
        });
      }
    } catch (err: any) {
      console.error("[LibraVoice] Start error:", err);

      if (err.name === "NotAllowedError") {
        setError(t("voice.errors.micDenied"));
      } else if (err.name === "NotFoundError") {
        setError(t("voice.errors.micNotFound"));
      } else {
        setError(t("voice.errors.startFailed"));
      }

      setStatus("error");
      // Cleanup on error
      cleanupResources();
    }
  }, [role, classLevel, enqueueAudio, stopPlayback, flashWake, handleToolCalls, t]);

  /**
   * Cleanup all audio resources
   */
  const cleanupResources = useCallback(() => {
    // Stop mic
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // Disconnect worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Disconnect source
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // Close audio contexts
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (playbackContextRef.current && playbackContextRef.current.state !== "closed") {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    currentSourceRef.current = null;

    if (wakeTimerRef.current) {
      clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }
  }, []);

  /**
   * Stop the voice chat session
   */
  const stopVoiceChat = useCallback(() => {
    // Close Gemini session
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch {
        // Ignore close errors
      }
      sessionRef.current = null;
    }

    cleanupResources();
    setStatus("idle");
    setError(null);
    setIsMuted(false);
    setUserTranscript("");
    setAiTranscript("");
    setWakeDetected(false);
    setPanel(null);
  }, [cleanupResources]);

  const closePanel = useCallback(() => setPanel(null), []);

  const sendText = useCallback((text: string) => {
    const session = sessionRef.current;
    if (!session || !text.trim()) return;
    stopPlayback();
    turnDoneRef.current = false;
    userTranscriptRef.current = text;
    setUserTranscript(text);
    setAiTranscript("");
    session.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
  }, [stopPlayback]);

  const openFile = useCallback((id: string | null) => {
    setPanel((prev) => (prev?.type === "documents" ? { ...prev, openId: id } : prev));
  }, []);

  /**
   * Toggle mute state for the microphone
   */
  const toggleMute = useCallback(() => {
    if (micStreamRef.current) {
      const audioTracks = micStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const newMutedState = !isMuted;
        audioTracks[0].enabled = !newMutedState;
        setIsMuted(newMutedState);
      }
    }
  }, [isMuted]);

  const getLevel = useCallback(() => {
    const current = statusRef.current;
    if (current === "ai-speaking") return outputLevelRef.current;
    if (current === "listening" && !isMutedRef.current) return inputLevelRef.current;
    return 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch {
          // Ignore
        }
      }
      cleanupResources();
    };
  }, [cleanupResources]);

  return {
    status,
    error,
    startVoiceChat,
    stopVoiceChat,
    isActive: status !== "idle" && status !== "error",
    isMuted,
    toggleMute,
    userTranscript,
    aiTranscript,
    wakeDetected,
    getLevel,
    panel,
    closePanel,
    openFile,
    sendText,
  };
}
