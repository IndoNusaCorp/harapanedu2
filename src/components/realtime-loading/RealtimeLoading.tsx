"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCurrentLocale } from "@/components/translate/client";
import { useRealtimeLoading, type RealtimeLoadingOptions } from "./realtime-loading";

export function RealtimeLoading({ intervalDetik = 10, koleksi, onRefresh }: { intervalDetik?: number } & RealtimeLoadingOptions) {
  const locale = useCurrentLocale();
  const { loading, error, tryagain } = useRealtimeLoading(intervalDetik, { koleksi, onRefresh });

  if (!error) return null;

  const text = locale === "en"
    ? { title: "Loading error", desc: "Data took longer than 30 seconds to load.", retry: "Try again" }
    : { title: "Loading error", desc: "Data gagal dimuat lebih dari 30 detik.", retry: "Coba lagi" };

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-red-200 bg-white p-4 shadow-lg dark:border-red-500/30 dark:bg-edu-night"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 dark:text-white">{text.title}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300">{text.desc}</p>
      </div>
      <button
        type="button"
        onClick={tryagain}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-edu-blue px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-edu-blue-deep disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {text.retry}
      </button>
    </div>
  );
}
