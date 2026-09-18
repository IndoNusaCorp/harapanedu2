"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { useI18n } from "@/components/translate/client";
import { aiFetch } from "@/lib/ai/client";

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
  startVoiceChat: () => Promise<void>;
  stopVoiceChat: () => void;
  isActive: boolean;
  isMuted: boolean;
  toggleMute: () => void;
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

  /**
   * Play queued audio buffers sequentially
   */
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setStatus((prev) => (prev === "ai-speaking" ? "listening" : prev));
      return;
    }

    isPlayingRef.current = true;
    setStatus("ai-speaking");

    const samples = audioQueueRef.current.shift()!;

    if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
      playbackContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    const ctx = playbackContextRef.current;
    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(ctx.destination);
    sourceNode.onended = () => {
      playNextAudio();
    };
    sourceNode.start();
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
   * Start the voice chat session
   */
  const startVoiceChat = useCallback(async () => {
    try {
      setError(null);
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

      const { token, model, systemInstruction } = tokenData.data;

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
            // Handle audio response from Gemini
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const audioBuffer = base64ToArrayBuffer(part.inlineData.data);
                  enqueueAudio(audioBuffer);
                }
              }
            }
            // Detect turn completion
            if (message.serverContent?.turnComplete) {
              // AI finished speaking; will transition back to listening when audio queue drains
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

      setStatus("listening");
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
  }, [role, classLevel, enqueueAudio, t]);

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
  }, [cleanupResources]);

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
  };
}
