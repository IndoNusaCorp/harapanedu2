"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Search, Calendar, Clock,
  CheckCircle2, UploadCloud, Eye, FileText,
  Plus, Loader2
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { CreateAssignmentModal } from "@/components/modals/CreateAssignmentModal";
import { getAssignmentsByClass, createAssignment, updateAssignmentStatus, uploadClassMateri } from "@/lib/api";
import type { Assignment } from "@/lib/types";
import { useI18n } from "@/components/translate/client";
import { useLocaleTag, useStatusLabel } from "@/components/translate/format";

export default function AssignmentManagementPage() {
  const params = useParams();
  const basePath = `/${params.role}/${params.id}`;
  const { role } = useRole();
  const t = useI18n();
  const localeTag = useLocaleTag();
  const statusLabel = useStatusLabel();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getAssignmentsByClass(params.classId as string);
    setAssignments(data);
    setLoading(false);
  }, [params.classId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setSearchQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    const newParams = new URLSearchParams(searchParams.toString());
    if (query) {
      newParams.set("q", query);
    } else {
      newParams.delete("q");
    }
    router.replace(`${pathname}?${newParams.toString()}`);
  };

  const filteredAssignments = assignments.filter((a) => {
    return a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           a.course_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleCreateAssignment = async (form: { title: string; course_name: string; description: string; due_date: string; materi_file?: File | null; class_id?: string }) => {
    let finalForm: any = { ...form };
    delete finalForm.materi_file;
    if (form.materi_file) {
      const url = await uploadClassMateri(form.materi_file);
      if (url) {
        finalForm.materi_url = url;
        finalForm.materi_name = form.materi_file.name;
      }
    }
    // ensure class_id is set to current class if not provided
    if (!finalForm.class_id) {
      finalForm.class_id = params.classId as string;
    }
    const result = await createAssignment(finalForm);
    if (result) setAssignments((prev) => [result, ...prev]);
  };

  const handleSubmit = async (assignmentId: string) => {
    setSubmitting(assignmentId);
    const success = await updateAssignmentStatus(assignmentId, "submitted");
    if (success) {
      setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, status: "submitted" as const } : a));
    }
    setSubmitting(null);
  };

  return (
    <>
      <RealtimeLoading koleksi={["assignments"]} onRefresh={loadData} />
    <div className="flex flex-col min-h-full font-sans bg-slate-50 dark:bg-[#003049]">


      {/* Main Layout */}
      <div className="flex-1 flex flex-col xl:flex-row p-4 sm:p-6 lg:p-10 max-w-[1600px] mx-auto w-full gap-6 sm:gap-8">

        {/* Left Column */}
        <div className="flex-1 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{t("classAssignments.title")}</h2>
            {role === "teacher" && (
              <button onClick={() => setShowCreateAssignment(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                <Plus className="w-5 h-5" /> {t("classAssignments.createNew")}
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-[#003049] p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" placeholder={t("classAssignments.searchPlaceholder")} value={searchQuery} onChange={handleSearchChange} className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-[#003049] border-transparent focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm transition-all" /></div>
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-500">{t("classAssignments.statusLabel")}</span>
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">{t("status.active")}</span>
              <span className="px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 text-xs font-bold rounded-lg border border-blue-500/20">{t("status.submitted")}</span>
              <span className="px-3 py-1.5 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 text-xs font-bold rounded-lg border border-rose-500/20">{t("status.overdue")}</span>
            </div>
          </div>

          {/* Cards */}
          {loading ? (
            <div className="py-20 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : filteredAssignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredAssignments.map((a) => (
                <div key={a.id} className="bg-white dark:bg-[#003049] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800/80 shadow-sm flex flex-col relative overflow-hidden group">
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div><h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-1">{a.title}</h3><p className="text-sm text-slate-500 font-medium">{t("classAssignments.course", { name: a.course_name })}</p></div>
                    <span className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full border ${a.status === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20' : a.status === 'overdue' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-500/20' : a.status === 'submitted' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-500/20' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200'}`}>{statusLabel(a.status)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-semibold mb-6"><Clock className="w-4 h-4 text-slate-400" /> {t("classAssignments.due", { date: new Date(a.due_date).toLocaleDateString(localeTag, { month: 'short', day: 'numeric', year: 'numeric' }) })}</div>
                  {a.description && <p className="text-sm text-slate-500 mb-4 line-clamp-2">{a.description}</p>}
                  <div className="mt-auto flex flex-col sm:flex-row gap-2">
                    {a.status === "active" && role === "student" && (
                      <button onClick={() => handleSubmit(a.id)} disabled={submitting === a.id} className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                        {submitting === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> {t("classAssignments.submit")}</>}
                      </button>
                    )}
                    {a.status === "overdue" && role === "student" && (
                      <>
                        <button onClick={() => handleSubmit(a.id)} disabled={submitting === a.id} className="flex-1 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-slate-700 transition-colors">{t("classAssignments.submitLate")}</button>
                        <button onClick={() => setExtensionModalOpen(!extensionModalOpen)} className="flex-1 py-2.5 bg-white dark:bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">{t("classAssignments.requestExtension")}</button>
                      </>
                    )}
                    {role === "teacher" && <Link href={`${basePath}/grades`} className="flex-1 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-amber-700 transition-colors text-center">{t("classAssignments.grade")}</Link>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white dark:bg-[#003049] rounded-[24px] sm:rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t("classAssignments.emptyTitle")}</h3>
              <p className="text-slate-500 mt-2">
                {role === "teacher" ? t("classAssignments.emptyTeacher") : t("classAssignments.emptyStudent")}
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-6">
          <div className="bg-white dark:bg-[#003049] rounded-3xl p-6 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("classAssignments.myCalendar")}</h3>
            <Link href={`${basePath}/calendar`} className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"><Calendar className="w-4 h-4" /> {t("classAssignments.openCalendar")}</Link>
          </div>
          <div className="bg-white dark:bg-[#003049] rounded-3xl p-6 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("classAssignments.recentNotifications")}</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5"></div><p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("classAssignments.notifGrades")}</p></li>
              <li className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5"></div><p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("classAssignments.notifDueDate")}</p></li>
              <li className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div><p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("classAssignments.notifFeedback")}</p></li>
            </ul>
          </div>
          <div className="bg-white dark:bg-[#003049] rounded-3xl p-6 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">{t("classAssignments.quickActions")}</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#003049] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-100 dark:border-slate-800"><UploadCloud className="w-4 h-4 text-blue-500" /> {t("classAssignments.uploadFile")}</button>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#003049] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-100 dark:border-slate-800"><FileText className="w-4 h-4 text-emerald-500" /> {t("classAssignments.startDraft")}</button>
              <Link href={`${basePath}/grades`} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#003049] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-100 dark:border-slate-800"><Eye className="w-4 h-4 text-slate-500" /> {t("classAssignments.viewGrades")}</Link>
            </div>
          </div>
        </div>
      </div>

      <CreateAssignmentModal isOpen={showCreateAssignment} onClose={() => setShowCreateAssignment(false)} onSuccess={handleCreateAssignment} />
    </div>
    </>
  );
}
