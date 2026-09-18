"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as localeId, enUS } from "date-fns/locale";
import { useNotifications, NOTIFICATION_EMOJI, notificationText, ProofLink } from "@/context/NotificationContext";
import { useI18n, useCurrentLocale } from "@/components/translate/client";

export function NotificationBell({ variant = "default" }: { variant?: "default" | "kids" }) {
  const ctx = useNotifications();
  const t = useI18n();
  const locale = useCurrentLocale();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const kids = variant === "kids";

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const unread = ctx?.unreadCount ?? 0;

  const toggle = () => {
    if (!ctx) return;
    // Titik merah disimpan sampai daftar ditutup supaya user masih bisa melihat mana yang baru
    if (isOpen) ctx.markAllRead();
    setIsOpen(!isOpen);
  };

  const timeAgo = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: locale === "en" ? enUS : localeId });
    } catch {
      return "";
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className={kids
          ? "relative rounded-xl p-2.5 text-kids-coral transition-all hover:bg-kids-rose/30 active:scale-90"
          : "relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-edu-blue dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"}
      >
        <span className="sr-only">{t("topbar.notifications")}</span>
        {unread > 0
          ? <BellRing className={`${kids ? "h-6 w-6" : "h-5 w-5"} animate-wiggle`} aria-hidden="true" />
          : <Bell className={kids ? "h-6 w-6" : "h-5 w-5"} aria-hidden="true" />}
        {unread > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${kids ? "border-2 border-kids-cream bg-red-500" : "bg-rose-500"}`}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {isOpen && ctx && (
        <div className={`fixed inset-x-4 top-[76px] z-50 overflow-hidden shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 ${kids
          ? "rounded-2xl border-2 border-amber-200 bg-white text-kids-ink"
          : "rounded-xl border border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-edu-night dark:text-white"}`}
        >
          <div className={`flex items-center justify-between px-4 py-3 ${kids ? "bg-kids-cream" : "border-b border-slate-100 dark:border-white/10"}`}>
            <h3 className={`font-bold ${kids ? "text-lg" : ""}`}>{kids ? `🔔 ${t("notifications.title")}` : t("notifications.title")}</h3>
            {unread > 0 && (
              <button onClick={() => ctx.markAllRead()} className={`text-xs font-semibold ${kids ? "text-kids-coral" : "text-edu-blue dark:text-sky-300"}`}>
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          {ctx.browserPermission === "default" && (
            <button
              onClick={ctx.enableBrowserNotifications}
              className={`w-full px-4 py-2.5 text-left text-xs font-semibold ${kids ? "bg-kids-sun/20 text-kids-ink" : "bg-edu-blue/10 text-edu-blue dark:text-sky-300"}`}
            >
              {t("notifications.enableBrowser")}
            </button>
          )}

          <ul className="max-h-[60vh] overflow-y-auto sm:max-h-96">
            {ctx.notifications.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm opacity-70">
                {kids && <span className="mb-2 block text-4xl">🎈</span>}
                {t("notifications.empty")}
              </li>
            ) : ctx.notifications.map(n => {
              const isNew = ctx.isUnread(n);
              const text = notificationText(n, t);
              return (
                <li key={n.id} className="flex items-start">
                  <button
                    onClick={() => { setIsOpen(false); ctx.markAllRead(); ctx.open(n); }}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${kids ? "hover:bg-kids-cream" : "hover:bg-slate-50 dark:hover:bg-white/5"} ${isNew ? (kids ? "bg-amber-50" : "bg-edu-blue/5 dark:bg-white/5") : ""}`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center text-xl ${kids ? "rounded-xl bg-kids-sun/30" : "rounded-lg bg-slate-100 dark:bg-white/10"}`}>
                      {NOTIFICATION_EMOJI[n.type]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold opacity-70">
                        {t(`notifications.type.${n.type}` as "notifications.type.class")}
                      </span>
                      <span className={`block font-semibold ${text.body && n.type !== "attendance_absent" ? "truncate" : "break-words"}`}>{text.title}</span>
                      {text.body && <span className="block truncate text-sm opacity-70">{text.body}</span>}
                      <span className="mt-0.5 block text-xs opacity-50">{timeAgo(n.created_at)}</span>
                    </span>
                    {isNew && <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${kids ? "bg-kids-coral" : "bg-edu-blue"}`} />}
                  </button>
                  <ProofLink n={n} className="mr-3" onOpen={() => { setIsOpen(false); ctx.markAllRead(); }} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
