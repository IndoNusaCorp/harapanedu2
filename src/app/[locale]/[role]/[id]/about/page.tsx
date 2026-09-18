"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React from "react";
import { BookOpen, Heart, Shield, Globe } from "lucide-react";
import { useI18n } from "@/components/translate/client";
import { useRole } from "@/context/RoleContext";
import { Topbar } from "@/components/layout/Topbar";

export default function AboutPage() {
  const t = useI18n();
  const { isKidsMode } = useRole();

  const ui = isKidsMode
    ? { page: "bg-kids-cream", panel: "bg-kids-sun shadow-amber-300/40", icon: "text-kids-coral" }
    : { page: "bg-[#F1F5FF] dark:bg-edu-navy", panel: "bg-gradient-to-r from-edu-indigo to-edu-purple shadow-purple-900/20", icon: "text-edu-blue" };

  const items = [
    { icon: Heart, title: t("about.mission"), desc: t("about.missionDesc") },
    { icon: Shield, title: t("about.privacy"), desc: t("about.privacyDesc") },
    { icon: Globe, title: t("about.madeIn"), desc: t("about.madeInDesc") },
  ];

  return (
    <>
      <RealtimeLoading />
    <div className={`flex min-h-full flex-col font-sans ${ui.page}`}>
      <Topbar />
      <div className="mx-auto w-full max-w-[900px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <section className={`relative overflow-hidden rounded-2xl p-8 text-center text-white shadow-lg sm:p-12 ${ui.panel}`}>
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-center gap-3">
              {isKidsMode ? <span className="text-4xl sm:text-5xl">🧸</span> : <BookOpen className="h-9 w-9 sm:h-10 sm:w-10" />}
              <span className="text-3xl font-extrabold sm:text-4xl">{t("common.appName")}</span>
            </div>
            <p className="mx-auto max-w-md text-base text-white/90 sm:text-lg">{t("about.desc")}</p>
            <p className="mt-4 text-xs text-white/80 sm:text-sm">{t("about.version", { version: "1.0.0" })}</p>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {items.map((item) => (
            <div key={item.title} className={`rounded-2xl p-6 text-center shadow-md ${isKidsMode ? "bg-white" : "bg-edu-blue text-white"}`}>
              <item.icon className={`mx-auto mb-3 h-8 w-8 ${isKidsMode ? ui.icon : "text-white"}`} />
              <h3 className={`mb-1 font-bold ${isKidsMode ? "text-kids-ink" : ""}`}>{item.title}</h3>
              <p className={`text-sm ${isKidsMode ? "text-kids-ink/70" : "text-white/85"}`}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
