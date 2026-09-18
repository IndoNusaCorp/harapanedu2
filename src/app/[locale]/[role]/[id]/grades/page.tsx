"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/components/translate/client";
import { Award, BookOpen, ChevronRight, Download, Bot, Briefcase } from "lucide-react";
import KidsGrades from "@/components/kids/KidsGrades";
import { useRole } from "@/context/RoleContext";
import { useParams } from "next/navigation";
import { getGrades, createGrade, updateGrade, deleteGrade, getStudentGPAs, getStudentGrades, getUserProfile } from "@/lib/api";
import { downloadGradeReportPdf } from "@/lib/gradeReportPdf";
import type { Grade, GradeForm } from "@/lib/types";
import { GradeAssignmentModal } from "@/components/modals/GradeAssignmentModal";
import { Pencil, Trash2, Plus } from "lucide-react";
import { EduPage, EduHero, EduStat, EduLoading, eduCard, eduSolidButton } from "@/components/ui/edu";

type ScoreStatus = "excellent" | "good" | "average" | "below";

export default function GradesPage() {
  const params = useParams();
  const id = params?.id as string;
  const { role, isKidsMode } = useRole();
  const t = useI18n();

  // If kids mode (SD class 1-6), render the kids-friendly grades view
  if (isKidsMode) return <KidsGrades />;

  const [grades, setGrades] = useState<Grade[]>([]);
  const [studentGPAs, setStudentGPAs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [downloading, setDownloading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (role === "teacher") {
      const gpas = await getStudentGPAs();
      setStudentGPAs(gpas);
      const data = await getGrades();
      setGrades(data);
    } else {
      const data = await getStudentGrades(id);
      setGrades(data);
    }
    setLoading(false);
  }, [role, id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Calculate GPA from scores
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
  const weightedGPA = grades.length > 0 && totalCredits > 0
    ? (grades.reduce((acc, g) => acc + (getGpaPoint(Number(g.score) || 0) * (Number(g.credits) || 0)), 0) / totalCredits).toFixed(2)
    : "0.00";

  const getStatusFromScore = (score: number): ScoreStatus => {
    if (score >= 90) return "excellent";
    if (score >= 80) return "good";
    if (score >= 70) return "average";
    return "below";
  };

  const getStatusLabel = (status: ScoreStatus) => {
    switch (status) {
      case "excellent": return t("grades.excellent");
      case "good": return t("grades.good");
      case "average": return t("grades.average");
      default: return t("grades.below");
    }
  };

  const getBadgeStyle = (status: ScoreStatus) => {
    switch (status) {
      case "excellent": return "bg-emerald-400 text-emerald-950";
      case "good": return "bg-sky-300 text-sky-950";
      case "average": return "bg-amber-300 text-amber-950";
      default: return "bg-rose-400 text-rose-950";
    }
  };

  const handleDownloadTranscript = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const profile = role === "student" ? await getUserProfile() : null;
      const studentName = role === "student"
        ? (profile?.username || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || profile?.name || "-")
        : t("grades.reportAllStudents");
      const slug = role === "student" && studentName !== "-"
        ? `-${studentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
        : "";
      const locale = (params?.locale as string) === "id" ? "id-ID" : "en-US";

      await downloadGradeReportPdf({
        grades,
        studentName,
        className: profile?.class ? String(profile.class) : "-",
        dateText: new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }),
        gpa: weightedGPA,
        totalCredits,
        fileName: `${t("grades.reportFile")}${slug}.pdf`,
        getStatus: getStatusFromScore,
        labels: {
          brand: t("common.appName"),
          title: t("grades.reportTitle"),
          subtitle: t("grades.reportSubtitle"),
          student: t("grades.reportStudent"),
          className: t("grades.reportClass"),
          date: t("grades.reportDate"),
          gpa: t("grades.cumulativeGpa"),
          credits: t("grades.totalCredits"),
          courses: t("grades.reportCourses"),
          avgScore: t("grades.reportAvgScore"),
          no: t("grades.reportNo"),
          subject: t("grades.reportSubject"),
          score: t("grades.reportScore"),
          grade: t("grades.reportGrade"),
          creditsCol: t("grades.reportCredits"),
          status: t("grades.reportStatus"),
          noGrades: t("grades.noGrades"),
          footer: t("grades.reportFooter"),
          page: (current, total) => t("grades.reportPage", { current, total }),
          statusLabel: getStatusLabel,
        },
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleCreateOrUpdate = async (form: GradeForm & { id?: string }) => {
    if (form.id) {
      const success = await updateGrade(form.id, form);
      if (success) {
        setGrades(prev => prev.map(g => g.id === form.id ? { ...g, ...form, id: g.id } as Grade : g));
      }
    } else {
      const result = await createGrade(form);
      if (result) setGrades(prev => [result, ...prev]);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t("grades.deleteConfirm"))) return;
    const success = await deleteGrade(id);
    if (success) setGrades(prev => prev.filter(g => g.id !== id));
  };

  const ProgressBar = ({ value }: { value: number }) => (
    <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-edu-blue-deep transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-semibold text-slate-900">{Math.round(value)}%</span>
    </div>
  );

  return (
    <>
      <RealtimeLoading koleksi={["grades"]} onRefresh={loadData} />
    <EduPage>
      <EduHero
        badge={t("common.academicWorkspace")}
        badgeIcon={Briefcase}
        title={role === "teacher" ? t("grades.teacherTitle") : t("grades.studentTitle")}
        description={role === "teacher" ? t("grades.teacherDesc") : t("grades.studentDesc")}
        className="min-h-[180px] sm:min-h-[210px]"
      />

      {loading ? (
        <EduLoading />
      ) : (
        <>
          {/* GPA Cards */}
          <div className="my-6 grid grid-cols-1 gap-4 sm:my-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-10">
            <EduStat label={t("grades.cumulativeGpa")} value={weightedGPA} icon={Award} iconClass="text-amber-300" />
            <EduStat label={t("grades.totalCredits")} value={totalCredits} icon={BookOpen} />
            <a href={`/${params?.locale}/${params?.role}/${id}/grades/ai-grades-helper`} className={`${eduCard} flex items-center justify-between gap-4 p-5 transition-transform hover:-translate-y-0.5 sm:col-span-2 sm:p-6 lg:col-span-1`}>
              <div className="min-w-0">
                <p className="text-sm font-medium sm:text-base">{t("grades.aiHelper")}</p>
                <p className="mt-1 text-sm text-white/85">{role === "teacher" ? t("grades.aiHelperTeacher") : t("grades.aiHelperStudent")}</p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-white/80">
                <Bot className="h-8 w-8" />
              </div>
            </a>
          </div>

          {/* Course List */}
          <section className={`${eduCard} p-5 sm:p-8 lg:p-10`}>
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <h3 className="text-3xl font-bold tracking-tight sm:text-4xl">{role === "teacher" ? t("grades.studentGpas") : t("grades.currentCourses")}</h3>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4">
                {role === "teacher" && (
                  <button onClick={() => { setEditingGrade(null); setShowModal(true); }} className={`${eduSolidButton} sm:min-w-[150px]`}><Plus className="h-4 w-4" /> {t("grades.addGrade")}</button>
                )}
                <button onClick={handleDownloadTranscript} disabled={downloading} className={`${eduSolidButton} disabled:opacity-60 sm:min-w-[150px]`}><Download className="h-4 w-4" /> {t("common.download")}</button>
                {role === "teacher" && (
                  <>
                    <button onClick={() => setShowManageModal(true)} className={`${eduSolidButton} sm:min-w-[150px]`}><Pencil className="h-4 w-4" /> {t("common.edit")}</button>
                    <button onClick={() => setShowManageModal(true)} className={`${eduSolidButton} hover:bg-rose-600 sm:min-w-[110px]`}><Trash2 className="h-4 w-4" /> {t("common.delete")}</button>
                  </>
                )}
              </div>
            </div>

            <div className="divide-y divide-white/10">
              {role === "teacher" ? (
                studentGPAs.length === 0 ? (
                  <p className="py-10 text-center text-white/80">{t("grades.noStudentGrades")}</p>
                ) : studentGPAs.map((student) => (
                  <div key={student.id} className="grid grid-cols-1 items-center gap-3 rounded-xl px-2 py-4 transition-colors hover:bg-white/5 sm:grid-cols-[1fr_minmax(140px,1fr)_auto] sm:gap-6">
                    <div className="min-w-0">
                      <h4 className="truncate text-lg font-bold">{student.name}</h4>
                      <p className="text-xs font-bold text-white/80">{t("grades.creditsTotal", { count: Number(student.totalCredits) || 0 })}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-center text-xs font-bold">{t("grades.averageScore")}</p>
                      <ProgressBar value={student.avgScore} />
                    </div>
                    <span className="w-fit rounded-lg bg-slate-200 px-3 py-1.5 text-base font-bold text-slate-900 sm:justify-self-end sm:text-lg">
                      {t("grades.gpaValue", { gpa: student.gpa })}
                    </span>
                  </div>
                ))
              ) : (
                grades.length === 0 ? (
                  <p className="py-10 text-center text-white/80">{t("grades.noGrades")}</p>
                ) : grades.map((course) => {
                  const status = getStatusFromScore(course.score);
                  return (
                    <div key={course.id} className="grid grid-cols-1 items-center gap-3 rounded-xl px-2 py-4 transition-colors hover:bg-white/5 sm:grid-cols-[1fr_minmax(140px,1fr)_auto] sm:gap-6">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-lg font-bold">{course.course_name}</h4>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${getBadgeStyle(status)}`}>{getStatusLabel(status)}</span>
                        </div>
                        <p className="text-xs font-bold text-white/80">{t("grades.credits", { count: Number(course.credits) || 0 })}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-center text-xs font-bold">{t("grades.gradeProgress")}</p>
                        <ProgressBar value={course.score} />
                      </div>
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-2xl font-black text-slate-900 sm:justify-self-end">
                        {course.grade_letter || "-"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}

      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-edu-night">
            <div className="flex items-center justify-between border-b border-slate-100 bg-edu-blue p-5 text-white sm:p-6">
              <h3 className="flex items-center gap-3 text-xl font-extrabold sm:text-2xl">
                <Award className="h-6 w-6" /> {t("grades.manageGrades")}
              </h3>
              <button onClick={() => setShowManageModal(false)} className="rounded-full bg-white/15 p-2 transition-colors hover:bg-white/25" aria-label={t("common.close")}>
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-3">
                {grades.length === 0 ? (
                  <div className="py-10 text-center text-slate-500">{t("grades.noGradesFound")}</div>
                ) : (
                  grades.map(grade => {
                    const status = getStatusFromScore(grade.score);
                    return (
                      <div key={grade.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-edu-blue/50 sm:flex-row sm:items-center dark:border-white/10 dark:bg-white/5">
                        <div>
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <p className="text-lg font-bold text-slate-900 dark:text-white">{grade.course_name}</p>
                            <span className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getBadgeStyle(status)}`}>{getStatusLabel(status)}</span>
                          </div>
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500 dark:text-white/70">
                            <span className="font-bold text-edu-blue dark:text-sky-300">{grade.score}%</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            {t("grades.credits", { count: Number(grade.credits) || 0 })}
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            {t("grades.gradeLetter", { letter: grade.grade_letter || "-" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingGrade(grade); setShowModal(true); setShowManageModal(false); }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-edu-blue px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-edu-blue-deep sm:flex-none"
                          >
                            <Pencil className="h-4 w-4" /> {t("common.edit")}
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, grade.id)}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-200 sm:flex-none"
                          >
                            <Trash2 className="h-4 w-4" /> {t("common.delete")}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <GradeAssignmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleCreateOrUpdate as any}
        initialData={editingGrade as any}
      />
    </EduPage>
    </>
  );
}
