"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import KidsAssignments from "@/components/kids/KidsAssignments";
import { FileText, Clock, CheckCircle2, AlertCircle, Search, Briefcase, Award } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { getAssignments, getStudentSubmissions, applyStudentStatus, createAssignment, updateAssignment, deleteAssignment, uploadClassMateri } from "@/lib/api";
import type { Assignment } from "@/lib/types";
import { CreateAssignmentModal } from "@/components/modals/CreateAssignmentModal";
import { Pencil, Trash2, Plus } from "lucide-react";
import { EduPage, EduHero, EduLoading, EduEmpty, eduCard, eduTile, eduGlassButton, eduInput } from "@/components/ui/edu";
import { useI18n } from "@/components/translate/client";
import { useDateFormat, useStatusLabel } from "@/components/translate/format";

type FilterOption = "all" | "active" | "started" | "submitted" | "graded" | "overdue";

export default function AssignmentPage() {
  const params = useParams();
  const basePath = `/${params.role}/${params.id}`;
  const { role, isKidsMode } = useRole();
  const t = useI18n();
  const dates = useDateFormat();
  const statusLabel = useStatusLabel();

  // If kids mode (SD class 1-6), render the kids-friendly assignments view
  if (isKidsMode) return <KidsAssignments />;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [filter, setFilter] = useState<FilterOption>("all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getAssignments();
    if (role === "student") {
      // Tampilkan status milik siswa ini (started/submitted/graded), bukan status bersama
      const mySubs = await getStudentSubmissions(params.id as string);
      setAssignments(applyStudentStatus(data, mySubs));
    } else {
      setAssignments(data);
    }
    setLoading(false);
  }, [role, params.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Sync state with URL params
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Clock className="w-4 h-4 text-emerald-600" />;
      case "started": return <Clock className="w-4 h-4 text-amber-500" />;
      case "overdue": return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case "submitted": return <CheckCircle2 className="w-4 h-4 text-sky-600" />;
      case "graded": return <Award className="w-4 h-4 text-amber-600" />;
      default: return null;
    }
  };

  const filteredAssignments = assignments.filter((a) => {
    const matchesFilter = filter === "all" || a.status === filter;
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.course_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCreateOrUpdate = async (form: { title: string; course_name: string; description: string; due_date: string; materi_file?: File | null; class_id?: string; id?: string }) => {
    let finalForm: any = { ...form };
    delete finalForm.materi_file;
    if (form.materi_file) {
      const url = await uploadClassMateri(form.materi_file);
      if (url) {
        finalForm.materi_url = url;
        finalForm.materi_name = form.materi_file.name;
      }
    }

    if (form.id) {
      const success = await updateAssignment(form.id, finalForm);
      if (success) {
        setAssignments(prev => prev.map(a => a.id === form.id ? { ...a, ...finalForm } : a));
      }
    } else {
      const result = await createAssignment(finalForm);
      if (result) setAssignments(prev => [result, ...prev]);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (!confirm(t("assignments.deleteConfirm"))) return;
    const success = await deleteAssignment(id);
    if (success) setAssignments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <>
      <RealtimeLoading koleksi={["assignments", "assignment_submissions"]} onRefresh={loadData} />
    <EduPage>
      <EduHero
        badge={t("common.academicWorkspace")}
        badgeIcon={Briefcase}
        title={t("assignments.title")}
        description={role === "teacher" ? t("assignments.teacherDesc") : t("assignments.studentDesc")}
        actions={role === "teacher" && (
          <button onClick={() => { setEditingAssignment(null); setShowModal(true); }} className={`${eduGlassButton} sm:px-7 sm:py-4 sm:text-lg`}>
            <Plus className="h-5 w-5" /> {t("assignments.create")}
          </button>
        )}
      />

      {/* Search & Filters */}
      <div className="my-6 flex flex-col gap-4 sm:my-8 lg:flex-row lg:items-center lg:gap-10">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder={t("assignments.searchPlaceholder")} value={searchQuery} onChange={handleSearchChange} className={`${eduInput} py-4 pl-12`} />
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 hide-scrollbar sm:gap-6 lg:mx-0 lg:px-0 lg:pb-0">
          {(["all", "active", "started", "submitted", "graded", "overdue"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`whitespace-nowrap rounded-xl px-6 py-3 text-base transition-all sm:py-4 sm:text-lg ${filter === s ? "bg-white text-edu-blue shadow-lg ring-2 ring-edu-blue" : "bg-edu-blue text-white hover:bg-edu-blue-deep"}`}
            >
              {s === "all" ? t("common.all") : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <EduLoading />
      ) : filteredAssignments.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-10 xl:grid-cols-3">
          {filteredAssignments.map((a) => (
            <Link key={a.id} href={`${basePath}/assignment/${a.id}`} className={`${eduCard} group flex flex-col p-5 transition-transform duration-200 hover:-translate-y-1 sm:p-6`}>
              <div className="flex items-start gap-3">
                <Briefcase className="mt-1 h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl">{a.title}</p>
                  <p className="truncate text-xs text-white/80">{a.course_name}</p>
                </div>
                {role === "teacher" && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={(e) => { e.preventDefault(); setEditingAssignment(a); setShowModal(true); }} className="rounded-lg p-1.5 text-white/90 transition-colors hover:bg-white/15" aria-label={t("assignments.editAria")}><Pencil className="h-4 w-4" /></button>
                    <button onClick={(e) => handleDelete(e, a.id)} className="rounded-lg p-1.5 text-white/90 transition-colors hover:bg-rose-500/40" aria-label={t("assignments.deleteAria")}><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <div className="mt-5 flex flex-row items-center justify-center gap-4 sm:flex-col sm:gap-6">
                <div className={`${eduTile} flex h-20 w-28 flex-col items-center justify-center px-1 sm:w-32`}>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{t("assignments.statusLabel")}</span>
                  <span className="mt-1 flex items-center gap-1 text-center text-sm font-semibold">{getStatusIcon(a.status)}{statusLabel(a.status)}</span>
                </div>
                <div className={`${eduTile} flex h-20 w-28 flex-col items-center justify-center sm:w-32`}>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{t("assignments.dueLabel")}</span>
                  <span className="mt-1 text-2xl">{dates.short(a.due_date)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EduEmpty icon={FileText} title={t("assignments.emptyTitle")} description={t("assignments.emptyDesc")} />
      )}

      <CreateAssignmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleCreateOrUpdate}
        initialData={editingAssignment || undefined}
      />
    </EduPage>
    </>
  );
}
