"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React from "react";
import { Sun, Moon, Bell } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { useTheme } from "next-themes";
import { useChangeLocale, useCurrentLocale, useI18n } from "@/components/translate/client";
import { Topbar } from "@/components/layout/Topbar";

export default function SettingsPage() {
  const { role, toggleRole, isKidsMode } = useRole();
  const { theme, setTheme } = useTheme();
  const changeLocale = useChangeLocale();
  const currentLocale = useCurrentLocale();
  const t = useI18n();

  const ui = isKidsMode
    ? { page: "bg-kids-cream", panel: "bg-kids-sun shadow-amber-300/40", control: "bg-white/90 text-kids-ink", active: "bg-kids-coral text-white" }
    : { page: "bg-[#F1F5FF] dark:bg-edu-navy", panel: "bg-edu-blue shadow-blue-950/20", control: "bg-slate-200 text-slate-900", active: "bg-edu-blue text-white" };

  const rows = [
    {
      title: t("settings.language"),
      desc: t("settings.languageDesc"),
      control: (
        <div className={`flex w-full rounded-xl p-1 ${ui.control}`}>
          {(["id", "en"] as const).map((loc) => (
            <button
              key={loc}
              onClick={() => changeLocale(loc)}
              aria-pressed={currentLocale === loc}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${currentLocale === loc ? `${ui.active} shadow-sm` : "opacity-70 hover:opacity-100"}`}
            >
              {loc === "id" ? t("settings.indonesian") : t("settings.english")}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: t("settings.theme"),
      desc: t("settings.themeDesc"),
      control: (
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all hover:brightness-95 ${ui.control}`}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? t("settings.lightMode") : t("settings.darkMode")}
        </button>
      ),
    },
    {
      title: t("settings.role"),
      desc: t("settings.roleDesc"),
      control: (
        <button onClick={toggleRole} className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition-all hover:brightness-95 ${ui.control}`}>
          {role === "teacher" ? t("roles.teacher") : t("roles.student")}
        </button>
      ),
    },
    {
      title: t("settings.notifications"),
      desc: t("settings.notificationsDesc"),
      control: (
        <div className={`flex w-full items-center justify-center rounded-xl px-4 py-3 ${ui.control}`}>
          <Bell className="h-5 w-5 opacity-70" />
        </div>
      ),
    },
  ];

  return (
    <>
      <RealtimeLoading />
    <div className={`flex min-h-full flex-col font-sans ${ui.page}`}>
      <Topbar />
      <div className="mx-auto w-full max-w-[900px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <section className={`rounded-2xl p-6 text-white shadow-lg sm:p-10 ${ui.panel}`}>
          <h1 className="mb-8 text-2xl font-medium sm:text-3xl">{isKidsMode ? "⚙️ " : ""}{t("settings.title")}</h1>
          <div className="space-y-6 sm:space-y-8">
            {rows.map((row) => (
              <div key={row.title} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_minmax(220px,280px)] sm:items-center sm:gap-8">
                <div>
                  <p className="text-xl font-medium sm:text-2xl">{row.title}</p>
                  <p className="text-sm text-white/85">{row.desc}</p>
                </div>
                {row.control}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
    </>
  );
}
