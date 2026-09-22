import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// status loading (isPending) dikendalikan dari test
const state = vi.hoisted(() => {
  const refresh = vi.fn();
  return {
    pending: false,
    router: { refresh },
    start: vi.fn((cb: () => void) => cb()),
  };
});

vi.mock('next/navigation', () => ({ useRouter: () => state.router }));

// listener onSnapshot firestore dikendalikan dari test
const fs = vi.hoisted(() => ({
  listeners: {} as Record<string, (snap: { metadata: { hasPendingWrites: boolean } }) => void>,
  unsubscribe: vi.fn(),
}));
vi.mock('@/lib/firebase', () => ({ connecttofirestore: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nama: string) => nama,
  onSnapshot: vi.fn((nama: string, next: (snap: { metadata: { hasPendingWrites: boolean } }) => void) => {
    fs.listeners[nama] = next;
    return fs.unsubscribe;
  }),
}));
const snap = (hasPendingWrites = false) => ({ metadata: { hasPendingWrites } });
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useTransition: () => [state.pending, state.start] };
});

import { useRealtimeLoading } from './realtime-loading';

describe('realtime-loading.ts', () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    state.pending = false;
    state.router.refresh.mockClear();
    state.start.mockClear();
    fs.listeners = {};
    fs.unsubscribe.mockClear();
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
    vi.useRealTimers();
  });

  it('refresh otomatis tiap interval', () => {
    renderHook(() => useRealtimeLoading(10));
    expect(state.router.refresh).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(state.router.refresh).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(state.router.refresh).toHaveBeenCalledTimes(2);
  });

  it('loading selesai sebelum 30 detik -> "Loading berhasil." dan tidak error', () => {
    const { result, rerender } = renderHook(() => useRealtimeLoading(10));

    state.pending = true;
    rerender();
    expect(log).toHaveBeenCalledWith('Loading...');

    act(() => { vi.advanceTimersByTime(5_000); });
    state.pending = false;
    rerender();
    expect(log).toHaveBeenCalledWith('Loading berhasil.');

    act(() => { vi.advanceTimersByTime(30_000); });
    expect(log).not.toHaveBeenCalledWith('Loading error...');
    expect(result.current.error).toBe(false);
  });

  it('loading melewati 30 detik -> "Loading error..." dan error = true', () => {
    const { result, rerender } = renderHook(() => useRealtimeLoading(10));

    state.pending = true;
    rerender();
    act(() => { vi.advanceTimersByTime(29_999); });
    expect(result.current.error).toBe(false);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.error).toBe(true);
    expect(log).toHaveBeenCalledWith('Loading error...');

    // setelah akhirnya berhasil, error hilang lagi
    state.pending = false;
    rerender();
    expect(result.current.error).toBe(false);
    expect(log).toHaveBeenCalledWith('Loading berhasil.');
  });

  it('tryagain menghapus error dan refresh ulang', () => {
    const { result } = renderHook(() => useRealtimeLoading(10));
    act(() => { result.current.tryagain(); });
    expect(result.current.error).toBe(false);
    expect(state.router.refresh).toHaveBeenCalledTimes(1);
  });

  it('guru add/edit/delete -> onRefresh (loadData) dipanggil otomatis', async () => {
    const onRefresh = vi.fn();
    renderHook(() => useRealtimeLoading(10, { koleksi: ['assignments', 'grades'], onRefresh }));
    expect(Object.keys(fs.listeners)).toEqual(['assignments', 'grades']);

    // snapshot pertama = data awal, tidak memuat ulang
    act(() => { fs.listeners.assignments(snap()); });
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(onRefresh).not.toHaveBeenCalled();

    // perubahan dari guru
    act(() => { fs.listeners.assignments(snap()); });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('perubahan beruntun cukup dimuat sekali, pending write diabaikan', async () => {
    const onRefresh = vi.fn();
    renderHook(() => useRealtimeLoading(10, { koleksi: ['classes'], onRefresh }));
    act(() => { fs.listeners.classes(snap()); });

    act(() => { fs.listeners.classes(snap(true)); });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(onRefresh).not.toHaveBeenCalled();

    act(() => {
      fs.listeners.classes(snap());
      fs.listeners.classes(snap());
      fs.listeners.classes(snap());
    });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('tanpa onRefresh -> fallback router.refresh, listener dilepas saat unmount', async () => {
    const { unmount } = renderHook(() => useRealtimeLoading(10, { koleksi: ['meetings'] }));
    act(() => { fs.listeners.meetings(snap()); fs.listeners.meetings(snap()); });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(state.router.refresh).toHaveBeenCalledTimes(1);

    unmount();
    expect(fs.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('tryagain juga memanggil onRefresh', async () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useRealtimeLoading(10, { onRefresh }));
    await act(async () => { result.current.tryagain(); });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
