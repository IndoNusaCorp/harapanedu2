import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { WAKE_PHRASE_REGEX, useWakeWord } from "./useWakeWord";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    FakeRecognition.instances.push(this);
  }
  hear(transcript: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript }], { isFinal })] });
  }
}
const recognition = () => FakeRecognition.instances.at(-1)!;

beforeEach(() => {
  vi.useFakeTimers();
  FakeRecognition.instances = [];
  vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
});
afterEach(() => vi.useRealTimers());

describe("WAKE_PHRASE_REGEX", () => {
  it.each(["Hey Libra", "hai libra, tugas saya apa?", "Halo Lybra", "libra"])("matches %j", (text) => {
    expect(WAKE_PHRASE_REGEX.test(text)).toBe(true);
  });
  it.each(["library", "kalibrasi", "halo semuanya"])("does not match %j", (text) => {
    expect(WAKE_PHRASE_REGEX.test(text)).toBe(false);
  });
});

describe("useWakeWord", () => {
  it("reports when the browser has no speech recognition", () => {
    vi.stubGlobal("webkitSpeechRecognition", undefined);
    const { result } = renderHook(() => useWakeWord({ enabled: true, onWake: vi.fn() }));
    expect(result.current).toEqual({ supported: false, listening: false, error: "unsupported" });
  });

  it("listens continuously in Indonesian while enabled", () => {
    const { result } = renderHook(() => useWakeWord({ enabled: true, onWake: vi.fn() }));
    expect(recognition()).toMatchObject({ lang: "id-ID", continuous: true, interimResults: true });
    expect(result.current).toMatchObject({ supported: true, listening: true, error: null });
  });

  it("does not listen while disabled (e.g. during a voice session)", () => {
    renderHook(() => useWakeWord({ enabled: false, onWake: vi.fn() }));
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("wakes immediately with the whole sentence once it is final", () => {
    const onWake = vi.fn();
    renderHook(() => useWakeWord({ enabled: true, onWake }));
    act(() => recognition().hear("  Hey Libra, jadwal besok apa?  ", true));

    expect(onWake).toHaveBeenCalledWith("Hey Libra, jadwal besok apa?");
    expect(recognition().stop).toHaveBeenCalled();
  });

  it("waits briefly for a follow-up question before waking on interim speech", () => {
    const onWake = vi.fn();
    renderHook(() => useWakeWord({ enabled: true, onWake }));

    act(() => recognition().hear("hai libra", false));
    act(() => vi.advanceTimersByTime(1000));
    act(() => recognition().hear("hai libra tugas saya", false));
    act(() => vi.advanceTimersByTime(1000));
    expect(onWake).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(onWake).toHaveBeenCalledTimes(1);
    expect(onWake).toHaveBeenCalledWith("hai libra tugas saya");
  });

  it("ignores speech without the wake phrase", () => {
    const onWake = vi.fn();
    renderHook(() => useWakeWord({ enabled: true, onWake }));
    act(() => recognition().hear("buka perpustakaan", true));
    act(() => vi.advanceTimersByTime(5000));
    expect(onWake).not.toHaveBeenCalled();
  });

  it("restarts after the browser stops on silence", () => {
    renderHook(() => useWakeWord({ enabled: true, onWake: vi.fn() }));
    const rec = recognition();
    act(() => rec.onend!());
    expect(rec.start).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(300));
    expect(rec.start).toHaveBeenCalledTimes(2);
  });

  it("stops for good when the mic permission is denied", () => {
    const { result } = renderHook(() => useWakeWord({ enabled: true, onWake: vi.fn() }));
    const rec = recognition();
    act(() => {
      rec.onerror!({ error: "not-allowed" });
      rec.onend!();
    });
    act(() => vi.advanceTimersByTime(1000));

    expect(result.current).toMatchObject({ error: "not-allowed", listening: false });
    expect(rec.start).toHaveBeenCalledTimes(1);
  });

  it("aborts recognition when disabled", () => {
    const { rerender } = renderHook(({ enabled }) => useWakeWord({ enabled, onWake: vi.fn() }), { initialProps: { enabled: true } });
    const rec = recognition();
    rerender({ enabled: false });
    expect(rec.abort).toHaveBeenCalled();
  });
});
