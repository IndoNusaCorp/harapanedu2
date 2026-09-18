"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Briefcase, Plus, Trash2, User } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { CreateClassModal } from "@/components/modals/CreateClassModal";
import { CreateAssignmentModal } from "@/components/modals/CreateAssignmentModal";
import { StudentListModal } from "@/components/StudentList/StudentList";
import { getClasses, getTeacherClasses, createClass, createAssignment, deleteClass, uploadClassMateri, applyClassWorkStats } from "@/lib/api";
import { useI18n } from "@/components/translate/client";
import type { ClassData } from "@/lib/types";
import { getDoc, doc } from "firebase/firestore";
import { connecttofirestore } from "@/lib/firebase";
import { EduPage, EduHero, EduLoading, EduEmpty, eduCard, eduTile, eduGlassButton } from "@/components/ui/edu";

export default function MyWorkPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const basePath = `/${params.role}/${params.id}`;
  const { role } = useRole();
  const t = useI18n();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  //Kelas yang tombol assignment-nya dipencet, dipakai jadi pilihan awal di modal
  const [assignmentClassId, setAssignmentClassId] = useState<string>("");
  const [showStudentList, setShowStudentList] = useState(false);
  const [studentName, setStudentName] = useState<string>("");

  //mengambil data student
  useEffect(() => {
    async function fetchStudentName() {
      try {
        const studentData = await getDoc(doc(connecttofirestore, "student", params.id as string));
        if (studentData.exists()) {
          const data = studentData.data() as any;
          const fullName = [data.first_name, data.middle_name, data.last_name]
            .filter(Boolean)
            .join(" ");
          setStudentName(fullName);
        }
      } catch (error) {
        console.error("Error fetching student name:", error);
      }
    }
    if (params.id) fetchStudentName();
  }, [params.id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    let data;
    if (role === 'teacher') {
      data = await getTeacherClasses(params.id as string);
    } else {
      data = await getClasses();
    }
    setClasses(await applyClassWorkStats(data));
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

  const handleCreateClass = async (form: { name: string; course_name: string; description: string; schedule: string; room: string; materi_file?: File | null }) => {
    let finalForm: any = { ...form };
    if (form.materi_file) {
      const url = await uploadClassMateri(form.materi_file);
      if (url) {
        finalForm.materi_url = url;
        finalForm.materi_name = form.materi_file.name;
      }
      delete finalForm.materi_file;
    }
    const result = await createClass(finalForm);
    if (result) setClasses((prev) => [{ ...result, needs_grading: 0, feedback_count: 0 }, ...prev]);
  };

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
    await createAssignment(finalForm);
  };

  const handleDeleteClass = async (classId: string) => {
    if (confirm(t("myWork.deleteConfirm"))) {
      const success = await deleteClass(classId);
      if (success) setClasses((prev) => prev.filter((c) => c.id !== classId));
    }
  };

  return (
    <>
      <RealtimeLoading koleksi={["classes", "assignments", "assignment_submissions", "grades", "attendances"]} onRefresh={loadData} />
    <EduPage width="max-w-[1400px]">
      <EduHero
        badge={t("common.educatorWorkspace")}
        badgeIcon={Briefcase}
        title={t("myWork.title")}
        description={t("myWork.desc")}
        className="mb-6 sm:mb-10"
        actions={
          <>
            <button onClick={() => setShowCreateClass(true)} className="inline-flex items-center justify-center gap-3 rounded-xl bg-slate-200 px-7 py-3.5 text-base font-medium text-edu-indigo shadow-sm transition-colors hover:bg-white sm:text-lg">
              <Plus className="h-5 w-5" /> {t("myWork.createClass")}
            </button>
            <button onClick={() => setShowStudentList(true)} className={`${eduGlassButton} gap-3 px-7 py-3.5 sm:text-lg`}>
              <User className="h-5 w-5" /> {t("myWork.studentList")}
            </button>
          </>
        }
      />

      {loading ? (
        <EduLoading />
      ) : filteredClasses.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-10 xl:grid-cols-3">
          {filteredClasses.map((work) => (
            <div key={work.id} className={`${eduCard} group flex flex-col p-5 transition-transform duration-300 hover:-translate-y-1 sm:p-6`}>
              <div className="mb-4 flex items-center gap-4">
                <Briefcase className="h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xl">{work.name}</h3>
                  <p className="text-xs text-white/85">{t("myWork.studentsCount", { count: work.student_count || 0 })}</p>
                </div>
                {role === "teacher" && (
                  <button onClick={() => handleDeleteClass(work.id)} className="rounded-lg p-2 text-white/80 transition-colors hover:bg-rose-500/40 hover:text-white sm:opacity-0 sm:group-hover:opacity-100" aria-label={t("myWork.deleteAria")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-6">
                <div className={`${eduTile} flex h-20 flex-col items-center justify-center px-1 text-center`}>
                  <span className="text-[10px] uppercase tracking-wide text-slate-600">{t("myWork.needsGrading")}</span>
                  <span className="text-3xl">{work.needs_grading || 0}</span>
                </div>
                <div className={`${eduTile} flex h-20 flex-col items-center justify-center px-1 text-center`}>
                  <span className="text-[10px] uppercase tracking-wide text-slate-600">{t("myWork.messages")}</span>
                  <span className="text-3xl">{work.feedback_count || 0}</span>
                </div>
              </div>

              <div className={`${eduTile} mx-auto mt-5 w-full max-w-[240px] px-4 py-2.5`}>
                <p className="text-sm uppercase">{t("myWork.attendance")}</p>
                <div className="mt-1 grid grid-cols-2 gap-x-3 text-[11px] text-slate-600">
                  <span>{t("myWork.attended", { count: work.attendance || 0 })}</span>
                  <span>{t("myWork.absence", { count: work.absence || 0 })}</span>
                  <span>{t("myWork.late", { count: work.late || 0 })}</span>
                  <span>{t("myWork.excused", { count: work.excused_absence || 0 })}</span>
                </div>
              </div>

              {/* Guru: tombol assignment langsung buka modal buat kelas ini. Role lain: tetap ke halaman assignment */}
              {role === "teacher" ? (
                <button
                  onClick={() => { setAssignmentClassId(work.id); setShowCreateAssignment(true); }}
                  className="mt-5 rounded-xl bg-edu-blue-deep py-3 text-center text-sm font-bold transition-colors hover:bg-[#003AA3]"
                >
                  {t("myWork.assignments")}
                </button>
              ) : (
                <Link href={`${basePath}/assignment/`} className="mt-5 rounded-xl bg-edu-blue-deep py-3 text-center text-sm font-bold transition-colors hover:bg-[#003AA3]">
                  {t("myWork.assignments")}
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EduEmpty icon={Briefcase} title={t("myWork.emptyTitle")} description={t("myWork.emptyDesc")} />
      )}

      <CreateClassModal isOpen={showCreateClass} onClose={() => setShowCreateClass(false)} onSuccess={handleCreateClass} />
      <CreateAssignmentModal
        isOpen={showCreateAssignment}
        onClose={() => setShowCreateAssignment(false)}
        onSuccess={handleCreateAssignment}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        defaultClassId={assignmentClassId}
      />
      <StudentListModal isOpen={showStudentList} onClose={() => setShowStudentList(false)} />
    </EduPage>
    </>
  );
}
