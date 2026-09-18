"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import KidsMyClasses from "@/components/kids/KidsMyClasses";
import { BookOpen, Clock, Paperclip, Wifi, Briefcase, Lock } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { getClasses, getTeacherClasses, applyStudentProgress, createClass, updateClass, deleteClass, uploadClassMateri } from "@/lib/api";
import type { ClassData, CreateClassForm } from "@/lib/types";
import { CreateClassModal } from "@/components/modals/CreateClassModal";
import { TakeAttendanceModal } from "@/components/modals/TakeAttendanceModal";
import { ViewMateriModal } from "@/components/modals/ViewMateriModal";
import { Pencil, Trash2, Plus } from "lucide-react";
import { EduPage, EduHero, EduLoading, EduEmpty, eduCard, eduTile, eduGlassButton } from "@/components/ui/edu";
import { useI18n } from "@/components/translate/client";

export default function MyClassesPage() {
  const params = useParams();
  const { role, isKidsMode } = useRole();
  const t = useI18n();

  // If kids mode (SD class 1-6), render the kids-friendly classes view
  if (isKidsMode) return <KidsMyClasses />;

  const searchParams = useSearchParams();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showMateriModal, setShowMateriModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassSchedule, setSelectedClassSchedule] = useState<string>("");
  const [selectedMateriUrl, setSelectedMateriUrl] = useState<string | null>(null);
  const [selectedMateriName, setSelectedMateriName] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<ClassData | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    let data;
    if (role === "teacher") {
      data = await getTeacherClasses(params.id as string);
    } else {
      data = await applyStudentProgress(await getClasses(), params.id as string);
    }
    setClasses(data);
    setLoading(false);
  }, [role, params.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const searchQuery = searchParams.get("q") || "";
  const filteredClasses = classes.filter((cls) => {
    return (
      (cls.name && cls.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (cls.course_name && cls.course_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (cls.description && cls.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleCreateOrUpdate = async (form: CreateClassForm & { id?: string; materi_file?: File | null }) => {
    let finalForm: any = { ...form };
    if (form.materi_file) {
      const url = await uploadClassMateri(form.materi_file);
      if (url) {
        finalForm.materi_url = url;
        finalForm.materi_name = form.materi_file.name;
      }
      delete finalForm.materi_file;
    }

    if (finalForm.id) {
      const success = await updateClass(finalForm.id, finalForm);
      if (success) {
        setClasses(prev => prev.map(c => c.id === finalForm.id ? { ...c, ...finalForm } : c));
      }
    } else {
      const result = await createClass(finalForm);
      if (result) setClasses(prev => [result, ...prev]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("myClasses.deleteConfirm"))) return;
    const success = await deleteClass(id);
    if (success) setClasses(prev => prev.filter(c => c.id !== id));
  };

  //take attandance and update system course progress
  const handleTakeAttendanceClick = (id: string, schedule?: string) => {
    setSelectedClassId(id);
    setSelectedClassSchedule(schedule || "");
    setShowAttendanceModal(true);
  }

  const handleViewMateri = (url: string, name: string) => {
    setSelectedMateriUrl(url);
    setSelectedMateriName(name);
    setShowMateriModal(true);
  };

  return (
    <>
      <RealtimeLoading koleksi={role === "teacher" ? ["classes"] : ["classes", "attendances", "assignments", "assignment_submissions"]} onRefresh={loadData} />
    <EduPage width="max-w-[1400px]">
      <EduHero
        badge={t("common.academicWorkspace")}
        badgeIcon={Briefcase}
        title={role === "teacher" ? t("myClasses.teacherTitle") : t("myClasses.studentTitle")}
        description={role === "teacher" ? t("myClasses.teacherDesc") : t("myClasses.studentDesc")}
        className="mb-6 sm:mb-10"
        actions={role === "teacher" && (
          <button onClick={() => { setEditingClass(null); setShowModal(true); }} className={eduGlassButton}>
            <Plus className="h-5 w-5" /> {t("myClasses.createClass")}
          </button>
        )}
      />

      {loading ? (
        <EduLoading />
      ) : filteredClasses.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-10 xl:grid-cols-3">
          {filteredClasses.map((cls) => {
            const progress = Math.max(0, Math.min(100, Math.round(cls.course_progress ?? 0)));
            return (
              <div key={cls.id} className={`${eduCard} group flex flex-col p-5 transition-transform duration-300 hover:-translate-y-1 sm:p-6`}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <BookOpen className="h-8 w-8 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="truncate text-xl">{cls.name}</h3>
                      <p className="truncate text-xs text-white/85">{cls.description || cls.course_name}</p>
                    </div>
                  </div>
                  {role === "teacher" && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => { setEditingClass(cls); setShowModal(true); }} className="rounded-lg p-1.5 text-white/90 transition-colors hover:bg-white/15" aria-label={t("myClasses.editAria")}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(cls.id)} className="rounded-lg p-1.5 text-white/90 transition-colors hover:bg-rose-500/40" aria-label={t("myClasses.deleteAria")}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>

                <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-edu-blue-deep px-3 py-1 text-xs font-semibold">
                  <Clock className="h-3.5 w-3.5" /> {cls.schedule || t("myClasses.tbd")}
                </span>

                <div className="mb-5">
                  <div className="mb-1.5 flex items-end justify-between text-xs font-bold">
                    <span className="uppercase tracking-wider text-white/85">{t("myClasses.courseProgress")}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-edu-blue-deep">
                    <div className="h-full rounded-full bg-white transition-all duration-1000" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {cls.materi_url ? (
                  <button onClick={() => handleViewMateri(cls.materi_url!, cls.materi_name || t("myClasses.document"))} className={`${eduTile} group/materi mb-4 flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-white`}>
                    <span className="shrink-0 rounded-lg bg-edu-blue/10 p-2 text-edu-blue transition-transform group-hover/materi:scale-110"><Paperclip className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase text-slate-500">{t("myClasses.classMaterial")}</span>
                      <span className="block truncate text-sm font-bold">{cls.materi_name || t("myClasses.viewDocument")}</span>
                    </span>
                  </button>
                ) : (
                  <div className={`${eduTile} mb-4 flex items-center gap-3 p-3`}>
                    <span className="shrink-0 rounded-lg bg-slate-200 p-2 text-slate-500"><BookOpen className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase text-slate-500">{t("myClasses.classMaterial")}</span>
                      <span className="block truncate text-sm text-slate-500">{t("myClasses.noMaterial")}</span>
                    </span>
                  </div>
                )}

                {/* Siswa yang sudah absen hari ini: tombol dikunci */}
                <button
                  onClick={() => handleTakeAttendanceClick(cls.id, cls.schedule)}
                  disabled={cls.attended_today}
                  className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-edu-blue-deep py-3 font-bold transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-edu-blue-deep"
                >
                  {cls.attended_today ? <Lock className="h-5 w-5" /> : <Wifi className="h-5 w-5" />} {t("myClasses.takeAttendance")}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EduEmpty icon={BookOpen} title={t("myClasses.emptyTitle")} description={t("myClasses.emptyDesc")} />
      )}

      <CreateClassModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleCreateOrUpdate}
        initialData={editingClass || undefined}
      />

      <TakeAttendanceModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        classId={selectedClassId || ""}
        schedule={selectedClassSchedule}
        onSuccess={() => {
          // reload data to reflect any updated progress or stats
          loadData();
        }}
      />

      <ViewMateriModal
        isOpen={showMateriModal}
        onClose={() => setShowMateriModal(false)}
        materiUrl={selectedMateriUrl}
        materiName={selectedMateriName}
      />
    </EduPage>
    </>
  );
}
