"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  GraduationCap,
  Settings,
  Users,
  HelpCircle,
  Info,
  Video,
  Bot,
  X
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { useI18n } from "@/components/translate/client";

interface SidebarProps {
  basePath: string; // e.g. "/pelajar/abc123" or "/pengajar/abc123"
}

export function Sidebar({ basePath }: SidebarProps) {
  const pathname = usePathname();
  const { role, isSidebarOpen, setSidebarOpen } = useRole();
  const t = useI18n();

  // URLs carry a locale prefix (/id/..., /en/...), links don't — compare without it.
  const path = pathname.replace(/^\/(id|en)(?=\/|$)/, "") || "/";

  const navigation = [
    { key: "dashboard", name: t("nav.dashboard"), href: basePath, icon: LayoutDashboard },
    { key: "classes", name: role === "teacher" ? t("nav.myWork") : t("nav.myClasses"), href: `${basePath}/${role === "teacher" ? "my-work" : "my-classes"}`, icon: Users },
    { key: "assignments", name: t("nav.assignments"), href: `${basePath}/assignment`, icon: BookOpen },
    { key: "grades", name: t("nav.grades"), href: `${basePath}/grades`, icon: GraduationCap },
    { key: "schedule", name: t("nav.schedule"), href: `${basePath}/calendar`, icon: CalendarDays },
    { key: "libraai", name: t("nav.libraai"), href: `${basePath}/libraai`, icon: Bot },
    { key: "meetings", name: t("nav.meetings"), href: `${basePath}/meetings`, icon: Video }
  ];

  const bottomNavigation = [
    { key: "settings", name: t("nav.settings"), href: `${basePath}/settings`, icon: Settings },
    { key: "help", name: t("nav.helpCenter"), href: `${basePath}/help`, icon: HelpCircle },
    { key: "about", name: t("nav.about"), href: `${basePath}/about`, icon: Info },
  ];

  const isActive = (item: { key: string; href: string }) =>
    path === item.href ||
    (item.key === "assignments" && path.startsWith(item.href)) ||
    (item.key === "grades" && path.startsWith(item.href));

  return (
    <>
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col bg-edu-blue text-white shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[72px] shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-edu-blue">
              <BookOpen className="h-5 w-5" />
            </div>
            <span>{t("common.appName")}</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 lg:hidden"
          >
            <span className="sr-only">{t("nav.closeMenu")}</span>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-6 pt-2">
          <nav className="flex-1 space-y-3">
            {navigation.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-5 py-3.5 text-base font-medium transition-all duration-200 ${active
                    ? "bg-white text-edu-blue shadow-lg shadow-blue-950/20"
                    : "bg-edu-blue-deep text-white hover:bg-[#003AA3]"
                    }`}
                >
                  <item.icon
                    className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${active ? "text-edu-blue" : "text-white/80"}`}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 space-y-1 px-2">
            {bottomNavigation.map((item) => {
              const active = path === item.href;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-base transition-colors hover:bg-white/10 ${active ? "font-bold text-white" : "text-white/85"}`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
