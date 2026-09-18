"use client";

import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowDown } from "lucide-react";
import { getStudentGrades, getUserProfile } from "@/lib/api";
import { downloadGradeReportPdf, type ReportStatus } from "@/lib/gradeReportPdf";
import type { Grade } from "@/lib/types";
import { KidsPage, KidsHero, KidsEmoTile } from "@/components/kids/ui";
import { useI18n } from "@/components/translate/client";
import { useLocaleTag } from "@/components/translate/format";

type ScoreStatus = "veryGood" | "good" | "fair" | "poor";

export default function KidsGrades() {
  const params = useParams();
  const id = params?.id as string;
  const t = useI18n();
  const localeTag = useLocaleTag();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getStudentGrades(id);
    setGrades(data);
    setLoading(false);
  }, [id]);

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
  const weightedGPA =
    grades.length > 0 && totalCredits > 0
      ? (
        grades.reduce(
          (acc, g) => acc + getGpaPoint(Number(g.score) || 0) * (Number(g.credits) || 0),
          0
        ) / totalCredits
      ).toFixed(2)
      : "0.00";

  const formattedGPA = new Intl.NumberFormat(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(weightedGPA));

  const getStatusFromScore = (score: number): ScoreStatus => {
    if (score >= 90) return "veryGood";
    if (score >= 80) return "good";
    if (score >= 70) return "fair";
    return "poor";
  };

  const getStatusLabel = (status: ScoreStatus) => {
    switch (status) {
      case "veryGood": return t("kids.grades.veryGood");
      case "good": return t("kids.grades.good");
      case "fair": return t("kids.grades.fair");
      default: return t("kids.grades.poor");
    }
  };

  const getBadgeStyle = (status: ScoreStatus) => {
    switch (status) {
      case "veryGood":
      case "good":
        return "bg-[#00CF7F] text-[#053B26]";
      case "fair":
        return "bg-amber-400 text-amber-950";
      default:
        return "bg-red-600 text-white";
    }
  };

  const reportStatusMap: Record<ReportStatus, ScoreStatus> = { excellent: "veryGood", good: "good", average: "fair", below: "poor" };

  const handleDownloadTranscript = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const profile = await getUserProfile();
      const studentName = profile?.username || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.name || "-";
      const slug = studentName !== "-" ? `-${studentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "";

      await downloadGradeReportPdf({
        grades,
        studentName,
        className: profile?.class ? String(profile.class) : "-",
        dateText: new Date().toLocaleDateString(localeTag, { day: "numeric", month: "long", year: "numeric" }),
        gpa: formattedGPA,
        totalCredits,
        fileName: `${t("grades.reportFile")}${slug}.pdf`,
        getStatus: (score) => (score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 70 ? "average" : "below"),
        labels: {
          brand: t("common.appName"),
          title: t("kids.grades.reportTitle"),
          subtitle: t("grades.reportSubtitle"),
          student: t("grades.reportStudent"),
          className: t("grades.reportClass"),
          date: t("grades.reportDate"),
          gpa: t("kids.grades.gpa"),
          credits: t("kids.grades.totalClasses"),
          courses: t("grades.reportCourses"),
          avgScore: t("grades.reportAvgScore"),
          no: t("grades.reportNo"),
          subject: t("grades.reportSubject"),
          score: t("grades.reportScore"),
          grade: t("grades.reportGrade"),
          creditsCol: t("grades.reportCredits"),
          status: t("grades.reportStatus"),
          noGrades: t("kids.grades.empty"),
          footer: t("grades.reportFooter"),
          page: (current, total) => t("grades.reportPage", { current, total }),
          statusLabel: (status) => getStatusLabel(reportStatusMap[status]),
        },
      });
    } finally {
      setDownloading(false);
    }
  };

  const summaryCard = "flex items-center justify-between gap-4 rounded-xl bg-kids-coral px-6 py-5 text-white shadow-md shadow-rose-300/40 sm:px-8";

  return (
    <>
      <RealtimeLoading koleksi={["grades"]} onRefresh={loadData} />
    <KidsPage loading={loading} loadingEmoji="🏆" loadingText={t("kids.grades.loading")}>
      <KidsHero badge={t("kids.grades.badge")} title={t("kids.grades.title")} subtitle={t("kids.grades.subtitle")} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-10">
        <div className={summaryCard}>
          <span className="text-xl uppercase sm:text-2xl">{t("kids.grades.gpa")}</span>
          <span className="text-2xl font-bold sm:text-3xl">{formattedGPA}</span>
        </div>
        <div className={summaryCard}>
          <span className="text-xl uppercase sm:text-2xl">{t("kids.grades.totalClasses")}</span>
          <span className="text-2xl font-bold sm:text-3xl">{totalCredits}</span>
        </div>
        <a
          href={`/pelajar/${id}/grades/ai-grades-helper`}
          target="_blank"
          className={`${summaryCard} justify-center text-center transition-all hover:-translate-y-0.5 hover:brightness-105 sm:col-span-2 lg:col-span-1`}
        >
          <span className="text-xl font-bold uppercase sm:text-2xl">{t("kids.grades.askScorpio")}</span>
        </a>
      </div>

      {/* Course List */}
      <div className="overflow-hidden rounded-2xl bg-kids-lime shadow-md">
        <div className="flex flex-col gap-3 border-b-2 border-[#5B7A2E]/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <h3 className="text-xl font-bold text-[#2F4A12] sm:text-2xl">{t("kids.grades.listTitle")}</h3>
          <button
            onClick={handleDownloadTranscript}
            disabled={downloading}
            className="inline-flex disabled:opacity-60 w-full items-center justify-center gap-2 rounded-xl bg-[#A3D65F] px-5 py-2.5 text-sm font-semibold text-[#1F3309] transition-all hover:brightness-95 active:scale-95 sm:w-auto"
          >
            <ArrowDown className="h-5 w-5" /> {t("kids.grades.download")}
          </button>
        </div>

        <div className="space-y-2 px-3 py-4 sm:px-10 sm:py-6">
          {grades.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mb-3 text-6xl">🌱</div>
              <p className="text-xl font-bold text-[#2F4A12]">{t("kids.grades.empty")}</p>
              <p className="font-medium text-[#3F5E1C]">{t("kids.grades.emptyDesc")}</p>
            </div>
          ) : (
            grades.map((course) => {
              const status = getStatusFromScore(course.score);
              return (
                <div
                  key={course.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/25 sm:gap-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <KidsEmoTile emoji="📝" className="bg-white/50" />
                    <div className="min-w-0">
                      <h4 className="truncate text-lg text-[#2F4A12] sm:text-2xl">{course.course_name}</h4>
                      <span className={`mt-0.5 inline-block rounded-full px-3 py-0.5 text-[10px] font-bold uppercase sm:text-xs ${getBadgeStyle(status)}`}>
                        {getStatusLabel(status)}
                      </span>
                    </div>
                  </div>
                  <span className="w-10 text-center text-lg font-bold text-[#2F4A12] sm:w-24 sm:text-xl">{course.score}</span>
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border-[5px] border-slate-200 bg-white shadow-sm sm:h-16 sm:w-24">
                    <span className="text-2xl text-slate-900 sm:text-3xl">{course.grade_letter || "-"}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </KidsPage>
    </>
  );
}
