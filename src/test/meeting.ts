import { vi } from "vitest";

// PeerJS + camera/mic stand-ins for meeting room tests.

type Handler = (...args: unknown[]) => void;

class Emitter {
  handlers: Record<string, Handler[]> = {};
  on(event: string, cb: Handler) {
    (this.handlers[event] ||= []).push(cb);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    (this.handlers[event] || []).forEach(cb => cb(...args));
  }
}

export function fakePeerJs() {
  const peers: FakePeer[] = [];

  class FakeCall extends Emitter {
    open = true;
    peerConnection = { iceConnectionState: "connected", getSenders: () => [] };
    answer = vi.fn();
    close = vi.fn(() => this.emit("close"));
    constructor(public peer: string, public metadata: Record<string, unknown>) {
      super();
    }
  }

  class FakePeer extends Emitter {
    open = false;
    destroyed = false;
    calls: FakeCall[] = [];
    destroy = vi.fn(() => { this.destroyed = true; });
    reconnect = vi.fn();
    constructor(public id: string) {
      super();
      peers.push(this);
      queueMicrotask(() => {
        this.open = true;
        this.emit("open", id);
      });
    }
    call(peerId: string, _stream: unknown, opts: { metadata: Record<string, unknown> }) {
      const call = new FakeCall(peerId, opts.metadata);
      this.calls.push(call);
      return call;
    }
  }

  return { peers, module: { default: FakePeer } };
}

const track = (kind: "audio" | "video") => ({ kind, enabled: true, stop: vi.fn(), onended: null });

/** Mic (and camera) via getUserMedia, plus a minimal MediaStream. */
export function installFakeMedia({ micAllowed = true } = {}) {
  class FakeMediaStream {
    tracks: ReturnType<typeof track>[];
    constructor(tracks: ReturnType<typeof track>[] = []) {
      this.tracks = [...tracks];
    }
    getTracks() { return this.tracks; }
    getAudioTracks() { return this.tracks.filter(t => t.kind === "audio"); }
    getVideoTracks() { return this.tracks.filter(t => t.kind === "video"); }
    addTrack(t: ReturnType<typeof track>) { this.tracks.push(t); }
    removeTrack(t: ReturnType<typeof track>) { this.tracks = this.tracks.filter(x => x !== t); }
  }
  vi.stubGlobal("MediaStream", FakeMediaStream);

  const mics: ReturnType<typeof track>[] = [];
  const getUserMedia = vi.fn(async (constraints: { audio?: unknown; video?: unknown }) => {
    if (constraints.audio && !micAllowed) throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const t = track(constraints.audio ? "audio" : "video");
    if (constraints.audio) mics.push(t);
    return new FakeMediaStream([t]);
  });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return { getUserMedia, mics };
}

/** Replacement for @/lib/meeting/cameraEffects (canvas capture isn't available in jsdom). */
export function fakeCameraEffects() {
  return {
    MEETING_EFFECTS: [{ id: "none", emoji: "🚫" }, { id: "crown", emoji: "👑" }],
    createPlaceholderVideoTrack: () => ({ ...track("video"), enabled: false }),
    createSilentAudioTrack: () => ({ ...track("audio"), enabled: false }),
    CameraEffectProcessor: class {
      track = track("video");
      stop = vi.fn();
      constructor(public source: unknown, public effect: string) {}
    },
  };
}
