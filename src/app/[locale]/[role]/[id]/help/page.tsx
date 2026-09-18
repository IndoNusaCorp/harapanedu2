"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React from "react";
import { HelpCircle, MessageSquare, BookOpen, Mail } from "lucide-react";
import { useI18n } from "@/components/translate/client";
import { useRole } from "@/context/RoleContext";
import { Topbar } from "@/components/layout/Topbar";

export default function HelpPage() {
  const t = useI18n();
  const { isKidsMode } = useRole();

  const ui = isKidsMode
    ? { page: "bg-kids-cream", panel: "bg-kids-sun shadow-amber-300/40", icon: "text-kids-coral" }
    : { page: "bg-[#F1F5FF] dark:bg-edu-navy", panel: "bg-edu-blue shadow-blue-950/20", icon: "text-edu-blue" };

  const items = [
    { icon: BookOpen, title: t("help.gettingStarted"), desc: t("help.gettingStartedDesc") },
    { icon: MessageSquare, title: t("help.libraSupport"), desc: t("help.libraSupportDesc") },
    { icon: HelpCircle, title: t("help.faq"), desc: t("help.faqDesc") },
    { icon: Mail, title: t("help.contact"), desc: t("help.contactDesc") },
  ];

  return (
    <>
      <RealtimeLoading />
    <div className={`flex min-h-full flex-col font-sans ${ui.page}`}>
      <Topbar />
      <div className="mx-auto w-full max-w-[900px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <section className={`rounded-2xl p-6 text-white shadow-lg sm:p-10 ${ui.panel}`}>
          <h1 className="text-2xl font-medium sm:text-3xl">{t("help.title")}</h1>
          <p className="mt-1 text-sm text-white/85 sm:text-base">{t("help.desc")}</p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8">
            {items.map((item) => (
              <button
                key={item.title}
                type="button"
                className="group flex min-h-[110px] flex-col items-center justify-center rounded-xl bg-slate-200 p-5 text-center text-slate-900 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"
              >
                <item.icon className={`mb-2 h-7 w-7 transition-transform group-hover:scale-110 ${ui.icon}`} />
                <span className="text-sm font-semibold sm:text-base">{item.title}</span>
                <span className="mt-0.5 text-xs text-slate-600">{item.desc}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
    </>
  );
}
