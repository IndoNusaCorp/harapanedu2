"use client";

import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getClasses, getAssignments, getStudentGrades, getMeetings, getStudentSubmissions, applyStudentStatus } from "@/lib/api";
import { useRole } from "@/context/RoleContext";
import type { ClassData, Assignment, Grade, Meeting } from "@/lib/types";
import { KidsPage, KidsHero, KidsStatusPill, kidsGlassButton } from "@/components/kids/ui";
import { useI18n } from "@/components/translate/client";
import { useDateFormat, useMeetingStatusLabel } from "@/components/translate/format";

export default function KidsDashboard() {
  const params = useParams();
  const roleParam = params.role as string;
  const idParam = params.id as string;
  const basePath = `/${roleParam}/${idParam}`;
  const { role } = useRole();
  const t = useI18n();
  const dates = useDateFormat();
  const meetingStatusLabel = useMeetingStatusLabel();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const a = await getAssignments();
      if (role === "student") {
        // Tampilkan status milik siswa ini (started/submitted/graded), bukan status bersama
        const mySubs = await getStudentSubmissions(idParam);
        setAssignments(applyStudentStatus(a, mySubs));
      } else {
        setAssignments(a);
      }

      const c = await getClasses();
      setClasses(c);

      const g = await getStudentGrades(idParam);
      setGrades(g);

      const m = await getMeetings();
      setMeetings(m);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [role, idParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getGpaPoint = (score: number) => {
    if (score >= 90) return 4.0;
    if (score >= 85) return 3.7;
    if (score >= 80) return 3.3;
    if (score >= 75) return 3.0;
    if (score >= 70) return 2.7;
    if (score >= 65) return 2.3;
    if (score >= 60) return 2.0;
    return 0.0;
  };

  const totalCredits = grades.reduce((acc, g) => acc + (Number(g.credits) || 0), 0);
  const cumulativeGPA =
    grades.length > 0 && totalCredits > 0
      ? (
          grades.reduce(
            (acc, g) => acc + getGpaPoint(Number(g.score) || 0) * (Number(g.credits) || 0),
            0
          ) / totalCredits
        ).toFixed(2)
      : "0.00";

  const pendingAssignments = assignments.filter(
    (a) => a.status === "active" || a.status === "started" || a.status === "overdue"
  );
  const displayAssignments = assignments.slice(0, 4);

  // Fun stat cards for kids
  const statCards = [
    { emoji: "🏆", label: t("kids.dashboard.yourScore"), value: cumulativeGPA, className: "bg-[#FAD29A] text-kids-ink" },
    { emoji: "📚", label: t("kids.dashboard.activeClasses"), value: classes.length, className: "bg-[#FF5C5C] text-white" },
    { emoji: "📝", label: t("kids.dashboard.tasks"), value: pendingAssignments.length, className: "bg-[#F9D24A] text-kids-ink" },
    { emoji: "🎥", label: t("kids.dashboard.meetings"), value: meetings.length, className: "bg-[#9CF96F] text-[#14532D]" },
  ];

  const nextMeeting = meetings[0];

  return (
    <>
      <RealtimeLoading koleksi={["assignments", "assignment_submissions", "classes", "grades", "meetings"]} onRefresh={loadData} />
    <KidsPage loading={loading} loadingEmoji="📚" width="max-w-[1400px]">
      <KidsHero
        badge={t("kids.dashboard.badge")}
        mascot={null}
        title={
          grades.length > 0
            ? t("kids.dashboard.titleGpa", { gpa: cumulativeGPA })
            : t("kids.dashboard.titleClasses", { count: classes.length })
        }
        subtitle={t("kids.dashboard.subtitle", { date: dates.full(new Date()), count: pendingAssignments.length })}
        actions={
          <>
            <Link href={`${basePath}/grades`} className={kidsGlassButton}>{t("kids.dashboard.viewGrades")}</Link>
            <Link href={`${basePath}/libraai`} className={kidsGlassButton}>{t("kids.dashboard.askLibra")}</Link>
          </>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.emoji}
            className={`flex items-center justify-between gap-2 rounded-2xl p-4 shadow-md transition-transform duration-200 hover:-translate-y-1 sm:p-6 ${card.className}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold sm:text-lg">{card.label}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{card.value}</p>
            </div>
            <span className="shrink-0 text-4xl drop-shadow sm:text-6xl">{card.emoji}</span>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Recent tasks */}
        <div className="flex min-h-[300px] flex-col overflow-hidden rounded-2xl bg-[#FCA5A5] text-white shadow-md">
          <div className="flex border-b border-[#C45A5A]/60 text-sm font-semibold sm:text-base">
            <div className="flex-1 px-5 py-3.5">{t("kids.dashboard.recentTasks")}</div>
            <div className="w-32 border-l border-[#C45A5A]/60 px-3 py-3.5 text-center sm:w-40">{t("kids.dashboard.status")}</div>
          </div>
          <div className="flex flex-1 flex-col">
            {displayAssignments.length === 0 ? (
              <div className="flex flex-1">
                <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
                  <span className="mb-2 text-5xl">🎉</span>
                  <p className="text-lg font-bold">{t("kids.dashboard.noTasks")}</p>
                  <p className="text-sm text-white/90">{t("kids.dashboard.noTasksDesc")}</p>
                </div>
                <div className="w-32 border-l border-[#C45A5A]/60 sm:w-40" />
              </div>
            ) : (
              <>
                {displayAssignments.map((a) => (
                  <Link
                    href={`${basePath}/assignment/${a.id}`}
                    key={a.id}
                    className="group flex items-stretch transition-colors hover:bg-white/15"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-5 py-3">
                      <span className="text-2xl transition-transform group-hover:scale-110">📄</span>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{a.title}</p>
                        <p className="truncate text-xs text-white/90 sm:text-sm">{a.course_name}</p>
                      </div>
                    </div>
                    <div className="flex w-32 items-center justify-center border-l border-[#C45A5A]/60 px-2 sm:w-40">
                      <KidsStatusPill status={a.status} />
                    </div>
                  </Link>
                ))}
                <div className="flex flex-1">
                  <div className="flex-1" />
                  <div className="w-32 border-l border-[#C45A5A]/60 sm:w-40" />
                </div>
              </>
            )}
          </div>
          <Link
            href={`${basePath}/assignment`}
            className="flex items-center justify-center gap-1 border-t border-[#C45A5A]/60 py-3 text-sm font-bold transition-colors hover:bg-white/15"
          >
            {t("kids.dashboard.viewAll")} <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Upcoming class */}
        <div className="flex flex-col rounded-2xl bg-kids-periwinkle p-5 text-white shadow-md sm:p-6">
          <div>
            <h3 className="text-lg font-semibold sm:text-xl">{t("kids.dashboard.upcomingClass")}</h3>
            <p className="text-xs text-white/90 sm:text-sm">{t("kids.dashboard.seeSchedule")}</p>
          </div>

          {nextMeeting ? (
            <div className="mt-4 flex flex-1 flex-col rounded-2xl border border-white/60 bg-white/15 p-4 backdrop-blur-sm sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/60 bg-white/20 px-4 py-1.5 text-xs font-medium">
                  {meetingStatusLabel(nextMeeting.status)}
                </span>
                <span className="text-xs text-white/90">{nextMeeting.time}</span>
              </div>
              <h4 className="mt-5 text-3xl font-semibold">{nextMeeting.title}</h4>
              <p className="mt-1 text-base">{t("kids.dashboard.participants", { count: nextMeeting.participants || 0 })}</p>
              <Link
                href={`${basePath}/meetings`}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white/30 sm:mt-auto"
              >
                {t("kids.dashboard.joinOnline")} <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/15 p-8 text-center">
              <span className="mb-3 text-5xl">😊</span>
              <p className="text-lg font-bold">{t("kids.dashboard.scheduleEmpty")}</p>
              <p className="mt-1 text-sm text-white/90">{t("kids.dashboard.noMeetingToday")}</p>
            </div>
          )}
        </div>
      </div>
    </KidsPage>
    </>
  );
}
