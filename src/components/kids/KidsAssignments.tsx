"use client";

import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Search } from "lucide-react";
import { getAssignments, getStudentSubmissions, applyStudentStatus } from "@/lib/api";
import { useRole } from "@/context/RoleContext";
import type { Assignment } from "@/lib/types";
import { KidsPage, KidsHero, KidsEmoTile, KidsStatusPill } from "@/components/kids/ui";
import { useI18n } from "@/components/translate/client";
import { useDateFormat } from "@/components/translate/format";

type FilterOption = "all" | "active" | "started" | "submitted" | "graded" | "overdue";

export default function KidsAssignments() {
  const params = useParams();
  const roleParam = params.role as string;
  const idParam = params.id as string;
  const basePath = `/${roleParam}/${idParam}`;
  const { role } = useRole();
  const t = useI18n();
  const dates = useDateFormat();

  const [filter, setFilter] = useState<FilterOption>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getAssignments();
    if (role === "student") {
      // Tampilkan status milik siswa ini (started/submitted/graded), bukan status bersama
      const mySubs = await getStudentSubmissions(idParam);
      setAssignments(applyStudentStatus(data, mySubs));
    } else {
      setAssignments(data);
    }
    setLoading(false);
  }, [role, idParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredAssignments = assignments.filter((a) => {
    const matchesFilter = filter === "all" || a.status === filter;
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.course_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getFilterLabel = (f: FilterOption) => {
    switch (f) {
      case "all": return t("common.all");
      case "active": return t("kids.assignments.filterActive");
      case "started": return t("kids.assignments.filterStarted");
      case "submitted": return t("kids.assignments.filterSubmitted");
      case "graded": return t("kids.assignments.filterGraded");
      case "overdue": return t("kids.assignments.filterOverdue");
      default: return f;
    }
  };

  return (
    <>
      <RealtimeLoading koleksi={["assignments", "assignment_submissions"]} onRefresh={loadData} />
    <KidsPage loading={loading} loadingEmoji="📝" loadingText={t("kids.assignments.loading")}>
      <KidsHero
        badge={t("kids.assignments.badge")}
        title={t("kids.assignments.title")}
        subtitle={t("kids.assignments.subtitle")}
      />

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-80 lg:shrink-0">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
          <input
            type="text"
            placeholder={t("kids.assignments.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border-2 border-transparent bg-kids-pink py-4 pl-13 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white transition-all focus:border-kids-coral focus:ring-4 focus:ring-kids-coral/25"
          />
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 hide-scrollbar lg:mx-0 lg:flex-1 lg:justify-end lg:px-0 lg:pb-0">
          {(["all", "active", "started", "submitted", "graded", "overdue"] as FilterOption[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`whitespace-nowrap rounded-xl px-5 py-4 text-sm font-bold text-white transition-all active:scale-95 ${
                filter === s
                  ? "bg-[#F24E4E] shadow-lg shadow-rose-300/60 ring-4 ring-white"
                  : "bg-kids-coral hover:brightness-105"
              }`}
            >
              {getFilterLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="overflow-hidden rounded-2xl bg-kids-olive shadow-md">
        {filteredAssignments.length > 0 ? (
          <div className="divide-y-2 divide-[#6B6526]/70">
            {filteredAssignments.map((a) => (
              <Link
                key={a.id}
                href={`${basePath}/assignment/${a.id}`}
                className="group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-black/5 sm:flex-row sm:items-center sm:px-6"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <KidsEmoTile emoji="📝" className="bg-kids-olive-dark transition-transform group-hover:rotate-6" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#3F3A0C]">{a.title}</p>
                    <p className="truncate text-sm text-[#5F5A24]">{a.course_name}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-15 sm:pl-0 sm:gap-3">
                  <KidsStatusPill status={a.status} />
                  <span className="whitespace-nowrap rounded-full bg-[#8F8840] px-4 py-1 text-xs font-medium text-white">
                    {dates.long(a.due_date)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-20 text-center">
            <div className="mb-4 text-6xl">🎉</div>
            <p className="text-2xl font-extrabold text-[#3F3A0C]">{t("kids.assignments.empty")}</p>
            <p className="mt-2 font-medium text-[#5F5A24]">{t("kids.assignments.emptyDesc")}</p>
          </div>
        )}
      </div>
    </KidsPage>
    </>
  );
}
