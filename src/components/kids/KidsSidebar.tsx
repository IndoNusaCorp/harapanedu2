"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { useI18n } from "@/components/translate/client";

interface KidsSidebarProps {
  basePath: string;
}

const kidsNavigation = [
  { label: "kids.nav.home", emoji: "🏠", key: "dashboard" },
  { label: "kids.nav.myClasses", emoji: "📚", key: "my-classes" },
  { label: "kids.nav.tasks", emoji: "📝", key: "assignment" },
  { label: "kids.nav.grades", emoji: "🏆", key: "grades" },
  { label: "kids.nav.schedule", emoji: "📅", key: "calendar" },
  { label: "kids.nav.play", emoji: "🎮", key: "games" },
  { label: "kids.nav.libraai", emoji: "🤖", key: "libraai" },
  { label: "kids.nav.meeting", emoji: "🎥", key: "meetings" },
] as const;

const kidsBottomNav = [
  { label: "kids.nav.settings", emoji: "⚙️", key: "settings" },
  { label: "kids.nav.help", emoji: "❓", key: "help" },
  { label: "kids.nav.about", emoji: "ℹ️", key: "about" },
] as const;

export function KidsSidebar({ basePath }: KidsSidebarProps) {
  const pathname = usePathname();
  const { role, isSidebarOpen, setSidebarOpen } = useRole();
  const t = useI18n();

  // URLs carry a locale prefix (/id/..., /en/...), links don't — compare without it.
  const path = pathname.replace(/^\/(id|en)(?=\/|$)/, "") || "/";

  const getHref = (key: string) => {
    if (key === "dashboard") return basePath;
    if (key === "my-classes" && role === "teacher") return `${basePath}/my-work`;
    return `${basePath}/${key}`;
  };

  const isActive = (key: string) => {
    const href = getHref(key);
    if (key === "dashboard") return path === href;
    if (key === "assignment" || key === "games" || key === "grades") return path.startsWith(href);
    return path === href;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col bg-kids-cream shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none lg:border-r lg:border-amber-200/60 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-[72px] shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kids-sun text-xl shadow-md shadow-amber-300/50">
              🧸
            </div>
            <div className="leading-tight">
              <span className="block text-lg font-extrabold tracking-tight text-kids-ink">{t("common.appName")}</span>
              <span className="block text-[11px] font-semibold text-kids-coral">{t("kids.nav.tagline")}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-kids-ink/70 hover:bg-kids-rose/30 lg:hidden"
          >
            <span className="sr-only">{t("nav.closeMenu")}</span>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-5 pt-2">
          <nav className="flex-1 space-y-3">
            {kidsNavigation.map((item) => {
              const active = isActive(item.key);
              return (
                <Link
                  key={item.key}
                  href={getHref(item.key)}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center justify-center gap-2.5 rounded-xl px-4 py-3.5 text-lg font-medium text-white transition-all duration-200 active:scale-95 ${
                    active
                      ? "bg-kids-coral shadow-lg shadow-rose-300/60 ring-4 ring-white"
                      : "bg-kids-rose hover:scale-[1.03] hover:bg-kids-coral/90"
                  }`}
                >
                  <span className={`text-xl transition-transform duration-200 ${active ? "" : "group-hover:scale-125 group-hover:-rotate-12"}`}>
                    {item.emoji}
                  </span>
                  <span className="truncate">{t(item.label)}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom navigation */}
          <div className="mt-8 space-y-1 px-6">
            {kidsBottomNav.map((item) => {
              const active = isActive(item.key);
              return (
                <Link
                  key={item.key}
                  href={getHref(item.key)}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-base transition-colors hover:bg-kids-rose/30 ${
                    active ? "font-bold text-kids-coral" : "text-kids-ink"
                  }`}
                >
                  <span>{item.emoji}</span>
                  <span>{t(item.label)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
