"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import KidsDashboard from "@/components/kids/KidsDashboard";
import {
  FileText, Clock, CheckCircle2, AlertCircle, Award,
  BookOpen, TrendingUp, ChevronRight,
  Calendar, Sparkles, Loader2, Video
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { getClasses, getTeacherClasses, getAssignments, getGrades, getStudentGrades, createClass, getMeetings, getStudentSubmissions, applyStudentStatus } from "@/lib/api";
import type { ClassData, Assignment, Grade, Meeting } from "@/lib/types";
import { CreateClassModal } from "@/components/modals/CreateClassModal";
import { connecttofirestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { EduPage, EduStat, eduCard } from "@/components/ui/edu";
import { useI18n } from "@/components/translate/client";
import { useDateFormat, useMeetingStatusLabel, useStatusLabel } from "@/components/translate/format";

export default function Dashboard() {
  const params = useParams();
  const roleParam = params.role as string;
  const idParam = params.id as string;
  const basePath = `/${roleParam}/${idParam}`;
  const t = useI18n();
  const dates = useDateFormat();
  const statusLabel = useStatusLabel();
  const meetingStatusLabel = useMeetingStatusLabel();

  //state untuk mengambil data first name, middle name, last name (Student)
  const [studentName, setStudentName] = useState<string>("");

  useEffect(() => {
    async function fetchStudentName() {
      try {
        const studentDoc = await getDoc(doc(connecttofirestore, "student", idParam));
        if (studentDoc.exists()) {
          const data = studentDoc.data();
          const fullName = [data.first_name, data.middle_name, data.last_name]
            .filter(Boolean)
            .join(" ");
          setStudentName(fullName);
        } else {
          // Fallback: cek di collection "users"
          const userDoc = await getDoc(doc(connecttofirestore, "users", idParam));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const fullName = [data.first_name, data.middle_name, data.last_name]
              .filter(Boolean)
              .join(" ");
            setStudentName(fullName || data.name || "");
          }
        }
      } catch (error) {
        console.error("Error fetching student name:", error);
      }
    }
    if (idParam) fetchStudentName();
  }, [idParam]);

  //state untuk mengambil data first name, middle name, last name (Teacher)
  const [teacherName, setTeacherName] = useState<string>("");
  useEffect(() => {
    async function fetchTeacherName() {
      try {
        const teacherDoc = await getDoc(doc(connecttofirestore, "teacher", idParam));
        if (teacherDoc.exists()) {
          const data = teacherDoc.data();
          const fullName = [data.first_name, data.middle_name, data.last_name]
            .filter(Boolean)
            .join(" ");
          setTeacherName(fullName);
        } else {
          // Fallback: cek di collection "users"
          const userDoc = await getDoc(doc(connecttofirestore, "users", idParam));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const fullName = [data.first_name, data.middle_name, data.last_name]
              .filter(Boolean)
              .join(" ");
            setTeacherName(fullName || data.name || "");
          }
        }
      } catch (error) {
        console.error("Error fetching teacher name:", error);
      }
    }
    if (idParam) fetchTeacherName();
  }, [idParam]);

  const { role, isKidsMode } = useRole();

  // If kids mode (SD class 1-6), render the kids-friendly dashboard
  if (isKidsMode) return <KidsDashboard />;
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const a = await getAssignments();
      if (role === 'student') {
        // Tampilkan status milik siswa ini (started/submitted/graded), bukan status bersama
        const mySubs = await getStudentSubmissions(idParam);
        setAssignments(applyStudentStatus(a, mySubs));
      } else {
        setAssignments(a);
      }

      let c;
      if (role === 'teacher') {
        c = await getTeacherClasses(idParam);
      } else {
        c = await getClasses(); // Fallback for student
      }
      setClasses(c);

      let g;
      if (role === 'teacher') {
        g = await getGrades();
      } else {
        g = await getStudentGrades(idParam);
      }
      setGrades(g);

      const m = await getMeetings();
      setMeetings(m);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [role, idParam]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateClass = async (form: { name: string; course_name: string; description: string; schedule: string; room: string }) => {
    const result = await createClass(form);
    if (result) {
      setClasses((prev) => [result, ...prev]);
    }
  };

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
  const cumulativeGPA = grades.length > 0 && totalCredits > 0
    ? (grades.reduce((acc, g) => acc + (getGpaPoint(Number(g.score) || 0) * (Number(g.credits) || 0)), 0) / totalCredits).toFixed(2)
    : "0.00";

  // Nilai rata-rata guru: hanya nilai yang diberikan guru ini atau berasal dari kelas yang ia ajar
  const teacherClassIds = new Set(classes.map((c) => c.id));
  const teacherScores = grades
    .filter((g) => g.graded_by === idParam || (g.class_id !== undefined && teacherClassIds.has(g.class_id)))
    .map((g) => Number(g.score))
    .filter((score) => Number.isFinite(score));
  const averageScore = teacherScores.length > 0
    ? Math.round(teacherScores.reduce((acc, score) => acc + score, 0) / teacherScores.length)
    : null;
  const averageScoreColor = averageScore === null
    ? "text-white/60"
    : averageScore >= 80 ? "text-emerald-400" : averageScore >= 70 ? "text-amber-300" : "text-rose-400";

  const displayAssignments = assignments.slice(0, 3);
  const activeCount = assignments.filter(a => a.status === 'active').length;
  const pendingCount = assignments.filter(a => a.status === 'active' || a.status === 'started' || a.status === 'overdue').length;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active": return "bg-[#0E6B5C] text-emerald-300";
      case "started": return "bg-amber-400 text-amber-950";
      case "overdue": return "bg-rose-950/60 text-rose-200";
      case "submitted": return "bg-sky-950/50 text-sky-200";
      case "graded": return "bg-amber-950/50 text-amber-200";
      default: return "bg-edu-blue-deep text-white/80";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Clock className="w-3 h-3" />;
      case "started": return <Clock className="w-3 h-3" />;
      case "overdue": return <AlertCircle className="w-3 h-3" />;
      case "submitted": return <CheckCircle2 className="w-3 h-3" />;
      case "graded": return <Award className="w-3 h-3" />;
      default: return null;
    }
  };

  const nextMeeting = meetings[0];

  return (
    <>
      <RealtimeLoading koleksi={["assignments", "assignment_submissions", "classes", "grades", "meetings"]} onRefresh={loadData} />
    <EduPage width="max-w-[1400px]">
      {/* Greeting */}
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-wide text-edu-blue sm:text-sm dark:text-sky-300">
          {dates.full(new Date())}
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl dark:text-white">
          {role === "teacher"
            ? t("dashboard.welcomeTeacher", { name: teacherName || t("common.user") })
            : t("dashboard.welcomeStudent", { name: studentName || t("common.user") })}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-base dark:text-white/70">
          {role === "teacher"
            ? t("dashboard.teacherSubtitle", { count: activeCount })
            : t("dashboard.studentSubtitle", { count: pendingCount })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Updates Banner */}
        <section className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#4338CA] to-[#3730A3] p-6 text-white shadow-xl shadow-indigo-950/20 sm:p-8 lg:col-span-7">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
          <div className="relative z-10">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-sm backdrop-blur-md">
              <Sparkles className="h-4 w-4" /> {t("dashboard.updatesBadge")}
            </span>
            <h3 className="max-w-xl text-xl font-bold leading-snug tracking-tight sm:text-2xl lg:text-[28px]">
              {role === "teacher"
                ? t("dashboard.teacherBanner", { classes: classes.length, assignments: assignments.length })
                : grades.length > 0
                  ? t("dashboard.studentBannerGpa", { gpa: cumulativeGPA })
                  : t("dashboard.studentBanner", { classes: classes.length, pending: pendingCount })}
            </h3>
          </div>
          <div className="relative z-10 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={`${basePath}/grades`} className="rounded-full bg-slate-200 px-7 py-3 text-center text-sm font-bold text-[#3730A3] transition-colors hover:bg-white">
              {t("dashboard.viewAnalytics")}
            </Link>
            <Link href={`${basePath}/libraai`} className="rounded-lg border border-white/30 bg-white/10 px-5 py-3 text-center text-sm font-bold backdrop-blur transition-colors hover:bg-white/20">
              {t("dashboard.askLibra")}
            </Link>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          {role === "teacher" ? (
            <EduStat
              label={t("dashboard.averageScore")}
              value={loading ? "…" : averageScore !== null ? `${averageScore}%` : "—"}
              hint={loading ? undefined : averageScore !== null
                ? t("dashboard.averageScoreHint", { count: teacherScores.length })
                : t("dashboard.noScoresYet")}
              icon={TrendingUp}
              iconClass={averageScoreColor}
              className="lg:flex-1"
            />
          ) : (
            <EduStat
              label={t("dashboard.cumulativeGpa")}
              value={cumulativeGPA}
              icon={TrendingUp}
              iconClass="text-emerald-400"
              className="lg:flex-1"
            />
          )}
          <EduStat label={t("dashboard.activeClasses")} value={classes.length} icon={BookOpen} iconClass="text-cyan-300" className="lg:flex-1" />
        </div>

        {/* Recent Tasks */}
        <section className={`${eduCard} flex min-h-[300px] flex-col p-5 sm:p-7 lg:col-span-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xl font-bold">
              <Clock className="h-6 w-6 text-white/80" /> {t("dashboard.recentTasks")}
            </h3>
            <Link href={`${basePath}/assignment`} className="text-sm font-bold hover:underline">{t("common.viewAll")}</Link>
          </div>
          <div className="flex-1 space-y-1">
            {loading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : displayAssignments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center text-white/80">
                <FileText className="mb-2 h-8 w-8" />
                <p className="font-semibold">{t("dashboard.noAssignmentsYet")}</p>
              </div>
            ) : (
              displayAssignments.map((a) => (
                <Link href={`${basePath}/assignment/${a.id}`} key={a.id} className="group flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-6 w-6 shrink-0 text-white/80" />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{a.title}</p>
                      <p className="truncate text-xs text-white/80">{a.course_name}</p>
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1 text-xs font-bold ${getStatusStyle(a.status)}`}>
                    {getStatusIcon(a.status)}
                    {statusLabel(a.status)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Upcoming Meeting */}
        <section className="relative flex flex-col overflow-hidden rounded-2xl bg-edu-night p-5 text-white shadow-xl shadow-slate-950/30 sm:p-7 lg:col-span-7">
          <Calendar aria-hidden className="pointer-events-none absolute right-6 top-4 h-28 w-28 text-white/15 sm:h-36 sm:w-36" />
          <div className="relative z-10">
            <h3 className="text-2xl font-bold">{t("dashboard.upcomingMeeting")}</h3>
            <p className="text-sm text-white/80 sm:text-base">{nextMeeting ? t("dashboard.hasMeeting") : t("dashboard.noMeeting")}</p>
          </div>

          {nextMeeting ? (
            <div className="relative z-10 mt-5 rounded-xl bg-[#454B5C]/90 p-4 backdrop-blur-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-edu-blue px-6 py-1.5 text-sm">{meetingStatusLabel(nextMeeting.status)}</span>
                <span className="text-sm text-white/90 sm:text-base">{nextMeeting.time}</span>
              </div>
              <h4 className="mt-4 text-2xl font-bold sm:px-4">{nextMeeting.title}</h4>
              <p className="mt-2 flex items-center gap-3 text-lg font-bold sm:px-4 sm:text-2xl">
                <Video className="h-6 w-6 text-white/70" /> {t("dashboard.participants", { count: nextMeeting.participants || 0 })}
              </p>
              <Link href={`${basePath}/meetings`} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-slate-200 py-3.5 text-base font-medium text-slate-900 transition-colors hover:bg-white">
                {role === "teacher" ? t("dashboard.manageMeeting") : t("dashboard.joinVirtualClass")} <ChevronRight className="h-5 w-5" />
              </Link>
            </div>
          ) : (
            <div className="relative z-10 mt-5 flex flex-1 flex-col items-center justify-center rounded-xl bg-[#454B5C]/60 p-8 text-center">
              <Calendar className="mb-3 h-8 w-8 text-white/60" />
              <p className="font-semibold text-white/90">{t("dashboard.scheduleClear")}</p>
              {role === "teacher" && (
                <Link href={`${basePath}/meetings`} className="mt-4 text-sm font-semibold text-sky-300 transition-colors hover:text-sky-200">
                  {t("dashboard.scheduleMeeting")}
                </Link>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Create Class Modal */}
      <CreateClassModal
        isOpen={showCreateClass}
        onClose={() => setShowCreateClass(false)}
        onSuccess={handleCreateClass}
      />
    </EduPage>
    </>
  );
}
