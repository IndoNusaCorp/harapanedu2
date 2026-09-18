"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { KidsTopbar } from "@/components/kids/KidsTopbar";
import { useI18n } from "@/components/translate/client";

// Shared building blocks for Kids mode (pelajar SD kelas 1-6):
// cream canvas, sunny yellow hero with the teddy mascot, playful coral buttons.

export const kidsCoralButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-kids-coral px-5 py-3 text-sm font-bold text-white shadow-md shadow-rose-300/40 transition-all hover:brightness-105 active:scale-95";
export const kidsGlassButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/50 bg-white/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/30 active:scale-95";

export function KidsPage({ children, loading, loadingEmoji = "📚", loadingText, width = "max-w-[1200px]" }: {
  children?: React.ReactNode;
  loading?: boolean;
  loadingEmoji?: string;
  loadingText?: string;
  width?: string;
}) {
  const t = useI18n();
  return (
    <div className="flex min-h-full flex-col bg-kids-cream font-sans">
      <KidsTopbar />
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="text-5xl animate-bounce">{loadingEmoji}</div>
            <Loader2 className="h-8 w-8 animate-spin text-kids-coral" />
            <p className="text-lg font-bold text-kids-ink">{loadingText ?? t("kids.loading")}</p>
          </div>
        </div>
      ) : (
        <div className={`mx-auto w-full flex-1 space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 lg:px-10 lg:py-10 ${width}`}>
          {children}
        </div>
      )}
    </div>
  );
}

export function KidsBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md">
      {children}
    </span>
  );
}

export function KidsHero({ badge, title, subtitle, actions, mascot = "🧸" }: {
  badge: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  mascot?: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-kids-sun p-6 shadow-lg shadow-amber-300/40 sm:p-8 lg:p-10">
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/10" />
      <div className="relative z-10 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <KidsBadge>✨ {badge}</KidsBadge>
          <h1 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-white drop-shadow-sm sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          {subtitle && <p className="mt-2 max-w-xl text-sm font-medium text-white/95 sm:text-base">{subtitle}</p>}
          {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
        </div>
        {mascot && (
          <div aria-hidden className="shrink-0 select-none text-6xl drop-shadow-md animate-float sm:text-8xl lg:text-9xl">
            {mascot}
          </div>
        )}
      </div>
    </section>
  );
}

const statusStyles = {
  active: { label: "kids.status.active", className: "bg-[#FF1F1F] text-white" },
  started: { label: "kids.status.started", className: "bg-[#FACC15] text-[#422006]" },
  submitted: { label: "kids.status.submitted", className: "bg-[#16C72E] text-white" },
  overdue: { label: "kids.status.overdue", className: "bg-[#B91C1C] text-white" },
  graded: { label: "kids.status.graded", className: "bg-edu-blue text-white" },
} as const;

export function KidsStatusPill({ status }: { status: string }) {
  const t = useI18n();
  const s = statusStyles[status as keyof typeof statusStyles] ?? statusStyles.active;
  return (
    <span className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${s.className}`}>
      ⏰ {t(s.label)}
    </span>
  );
}

export function KidsEmoTile({ emoji = "📝", className = "bg-black/10" }: { emoji?: string; className?: string }) {
  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl sm:h-14 sm:w-14 sm:text-3xl ${className}`}>
      {emoji}
    </div>
  );
}
