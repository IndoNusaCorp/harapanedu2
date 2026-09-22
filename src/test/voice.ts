import { vi } from "vitest";

// Browser audio + Gemini Live stand-ins for LibraAI Voice tests.

export function fakeLive() {
  const sessions: FakeSession[] = [];
  type Callbacks = {
    onopen?: () => void;
    onmessage?: (m: unknown) => void;
    onerror?: (e: unknown) => void;
    onclose?: (e: unknown) => void;
  };
  class FakeSession {
    sendRealtimeInput = vi.fn();
    sendClientContent = vi.fn();
    sendToolResponse = vi.fn();
    close = vi.fn();
    constructor(public params: { model: string; config: Record<string, unknown>; callbacks: Callbacks }, public apiKey: string) {}
    /** Simulate a message from Gemini */
    message(m: unknown) {
      this.params.callbacks.onmessage?.(m);
    }
  }
  class GoogleGenAI {
    live: { connect: (p: FakeSession["params"]) => Promise<FakeSession> };
    constructor(opts: { apiKey: string }) {
      this.live = {
        connect: async (params) => {
          const s = new FakeSession(params, opts.apiKey);
          sessions.push(s);
          params.callbacks.onopen?.();
          return s;
        },
      };
    }
  }
  return { sessions, module: { GoogleGenAI, Modality: { AUDIO: "AUDIO", TEXT: "TEXT" } } };
}

export interface FakeMic {
  track: { enabled: boolean; stop: ReturnType<typeof vi.fn>; kind: "audio" };
  getUserMedia: ReturnType<typeof vi.fn>;
}

/** Installs a fake microphone, AudioContext and AudioWorkletNode. */
export function installFakeAudio() {
  const track = { enabled: true, stop: vi.fn(), kind: "audio" as const };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const getUserMedia = vi.fn(async (_constraints: unknown) => stream);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });

  const contexts: FakeAudioContext[] = [];
  const bufferSources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
  const worklets: FakeWorklet[] = [];

  class FakeAudioContext {
    state = "running";
    destination = {};
    audioWorklet = { addModule: vi.fn(async () => {}) };
    close = vi.fn(async () => { this.state = "closed"; });
    resume = vi.fn(async () => { this.state = "running"; });
    constructor(public options?: { sampleRate?: number }) {
      contexts.push(this);
    }
    createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }
    createBufferSource() {
      const src = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null };
      bufferSources.push(src);
      return src;
    }
  }
  class FakeWorklet {
    port: { onmessage: ((e: MessageEvent) => void) | null } = { onmessage: null };
    connect = vi.fn();
    disconnect = vi.fn();
    constructor(public ctx: unknown, public name: string) {
      worklets.push(this);
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("AudioWorkletNode", FakeWorklet);

  return { track, getUserMedia, contexts, bufferSources, worklets };
}

/** 16-bit PCM of the given samples, base64 encoded (what Gemini sends back). */
export function pcmBase64(samples: number[]) {
  const bytes = new Uint8Array(new Int16Array(samples).buffer);
  return btoa(String.fromCharCode(...bytes));
}
