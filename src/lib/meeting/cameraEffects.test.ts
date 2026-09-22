import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MeetingEffect } from "@/lib/types";
import {
  CameraEffectProcessor,
  MEETING_EFFECTS,
  createPlaceholderVideoTrack,
  createSilentAudioTrack,
  drawEffectOverlay,
} from "./cameraEffects";

// 2D context that records what was drawn
function recordingContext() {
  const calls: { name: string; args: unknown[]; filter: string }[] = [];
  const state: Record<string, unknown> = { filter: "none", globalAlpha: 1 };
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => { calls.push({ name: prop, args, filter: String(target.filter) }); };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, state };
}

const fakeTrack = () => ({ enabled: true, stop: vi.fn(), kind: "video" }) as unknown as MediaStreamTrack;

describe("MEETING_EFFECTS", () => {
  it("offers 'none' first and has unique effects", () => {
    expect(MEETING_EFFECTS[0].id).toBe("none");
    expect(new Set(MEETING_EFFECTS.map(e => e.id)).size).toBe(MEETING_EFFECTS.length);
  });
});

describe("drawEffectOverlay", () => {
  it("draws nothing for 'none'", () => {
    const { ctx, calls } = recordingContext();
    drawEffectOverlay(ctx, "none", 0);
    expect(calls).toEqual([]);
  });

  it.each(MEETING_EFFECTS.filter(e => e.id !== "none").map(e => e.id))("draws a sticker/overlay for '%s'", (effect) => {
    const { ctx, calls } = recordingContext();
    drawEffectOverlay(ctx, effect as MeetingEffect, 1.5);
    expect(calls.some(c => ["fillText", "fill", "fillRect", "strokeRect"].includes(c.name))).toBe(true);
  });

  it("uses the effect's own emoji", () => {
    const { ctx, calls } = recordingContext();
    drawEffectOverlay(ctx, "crown", 0);
    expect(calls.filter(c => c.name === "fillText").map(c => c.args[0])).toEqual(["👑"]);
  });

  it("restores full opacity after the fading hearts", () => {
    const { ctx, state } = recordingContext();
    drawEffectOverlay(ctx, "hearts", 3.2);
    expect(state.globalAlpha).toBe(1);
  });
});

describe("CameraEffectProcessor", () => {
  let recorder: ReturnType<typeof recordingContext>;
  let outputTrack: MediaStreamTrack;
  let readyState = 4;

  beforeEach(() => {
    vi.useFakeTimers();
    recorder = recordingContext();
    outputTrack = fakeTrack();
    readyState = 4;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(recorder.ctx as never);
    Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
      configurable: true,
      value: () => ({ getVideoTracks: () => [outputTrack] }),
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockImplementation(() => readyState);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
  });

  const source = () => {
    const cam = fakeTrack();
    return { cam, stream: { getTracks: () => [cam] } as unknown as MediaStream };
  };

  it("sends the canvas track and applies the effect's colour filter to each frame", () => {
    const processor = new CameraEffectProcessor(source().stream, "retro");
    expect(processor.track).toBe(outputTrack);

    vi.advanceTimersByTime(100);
    const frame = recorder.calls.find(c => c.name === "drawImage");
    expect(frame?.filter).toContain("sepia");
    expect(recorder.state.filter).toBe("none");
    processor.stop();
  });

  it("switches effect on the fly", () => {
    const processor = new CameraEffectProcessor(source().stream, "none");
    vi.advanceTimersByTime(50);
    expect(recorder.calls.filter(c => c.name === "fillText")).toEqual([]);

    processor.effect = "crown";
    vi.advanceTimersByTime(50);
    expect(recorder.calls.some(c => c.name === "fillText" && c.args[0] === "👑")).toBe(true);
    processor.stop();
  });

  it("waits until the camera has a frame before drawing", () => {
    readyState = 1;
    const processor = new CameraEffectProcessor(source().stream, "crown");
    vi.advanceTimersByTime(200);
    expect(recorder.calls.some(c => c.name === "drawImage")).toBe(false);
    processor.stop();
  });

  it("stop() ends drawing and releases the camera and output tracks", () => {
    const { cam, stream } = source();
    const processor = new CameraEffectProcessor(stream, "party");
    processor.stop();
    const drawn = recorder.calls.length;

    vi.advanceTimersByTime(500);
    expect(recorder.calls.length).toBe(drawn);
    expect(cam.stop).toHaveBeenCalled();
    expect(outputTrack.stop).toHaveBeenCalled();
  });

  it("creates disabled placeholder tracks for a camera or mic that is off", () => {
    expect(createPlaceholderVideoTrack().enabled).toBe(false);

    const audioTrack = fakeTrack();
    vi.stubGlobal("AudioContext", class {
      createMediaStreamDestination() {
        return { stream: { getAudioTracks: () => [audioTrack] } };
      }
    });
    expect(createSilentAudioTrack()).toBe(audioTrack);
    expect(audioTrack.enabled).toBe(false);
  });
});
