"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";

// Shared building blocks for the educator (pengajar) / default theme:
// navy canvas, purple gradient hero, solid blue cards.

export const eduCard = "rounded-2xl bg-edu-blue text-white shadow-lg shadow-blue-950/20";
export const eduTile = "rounded-xl bg-slate-50 text-slate-900";
export const eduGlassButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/15 px-5 py-3 text-sm sm:text-base font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25 active:scale-[0.98]";
export const eduSolidButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-edu-blue-deep px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#003AA3] active:scale-[0.98]";
export const eduInput =
  "w-full rounded-xl border border-transparent bg-slate-200/90 dark:bg-white/90 px-5 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-edu-blue focus:ring-4 focus:ring-edu-blue/25";

export function EduPage({ children, width = "max-w-[1200px]", className = "" }: {
  children: React.ReactNode;
  width?: string;
  className?: string;
}) {
  return (
    <div className="flex min-h-full flex-col bg-[#F1F5FF] font-sans dark:bg-edu-navy">
      <Topbar />
      <div className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10 ${width} ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function EduHero({ badge, badgeIcon: BadgeIcon, title, description, actions, className = "" }: {
  badge: string;
  badgeIcon?: React.ElementType;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-edu-indigo to-edu-purple p-6 text-white shadow-xl shadow-purple-900/20 sm:p-8 lg:p-10 ${className}`}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 sm:h-72 sm:w-72" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 right-40 hidden h-40 w-40 rounded-full bg-white/10 md:block" />
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-medium backdrop-blur-md">
            {BadgeIcon && <BadgeIcon className="h-3.5 w-3.5" />}
            {badge}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
          {description && <p className="mt-2 text-sm text-white/85 sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">{actions}</div>}
      </div>
    </section>
  );
}

export function EduStat({ label, value, hint, icon: Icon, iconClass = "text-cyan-300", className = "" }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ElementType;
  iconClass?: string;
  className?: string;
}) {
  return (
    <div className={`${eduCard} flex items-center justify-between gap-4 p-5 sm:p-6 ${className}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white/85 sm:text-base">{label}</p>
        <p className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{value}</p>
        {hint && <p className="mt-1 text-xs text-white/70 sm:text-sm">{hint}</p>}
      </div>
      {Icon && (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-edu-blue-deep sm:h-16 sm:w-16">
          <Icon className={`h-7 w-7 sm:h-8 sm:w-8 ${iconClass}`} />
        </div>
      )}
    </div>
  );
}

export function EduLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-edu-blue dark:text-white" />
    </div>
  );
}

export function EduEmpty({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className={`${eduCard} px-6 py-16 text-center`}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-edu-blue-deep">
        <Icon className="h-8 w-8 text-white/70" />
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      {description && <p className="mt-2 text-white/75">{description}</p>}
    </div>
  );
}
