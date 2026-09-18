"use client";

import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2,
  UploadCloud, Loader2, Eye
} from "lucide-react";
import { KidsTopbar } from "@/components/kids/KidsTopbar";
import { useRole } from "@/context/RoleContext";
import { getAssignment, getAssignmentSubmissions, submitAssignment, startAssignment, uploadClassMateri } from "@/lib/api";
import type { Assignment } from "@/lib/types";
import { ViewMateriModal } from "@/components/modals/ViewMateriModal";
import { useI18n } from "@/components/translate/client";
import { useDateFormat } from "@/components/translate/format";

export default function KidsAssignmentDetail() {
  const params = useParams();
  const router = useRouter();
  const { role } = useRole();
  const t = useI18n();
  const dates = useDateFormat();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Materi state
  const [materiModalOpen, setMateriModalOpen] = useState(false);
  const [materiTitle, setMateriTitle] = useState("");
  const [materiUrl, setMateriUrl] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const assignmentId = params.assignmentId as string;

    const data = await getAssignment(assignmentId);
    if (data) {
      setAssignment(data);
    }

    // Load their own submission
    const subs = await getAssignmentSubmissions(assignmentId);
    // Dokumen "started" belum berisi jawaban, jadi tidak dihitung sebagai submission
    setSubmissions(subs.filter(s => s.status !== 'started'));

    setLoading(false);
  }, [params.assignmentId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Ubah status tugas siswa dari "not started" menjadi "started"
  const settostarted = async () => {
    return await startAssignment(params.assignmentId as string);
  };

  // Saat siswa membuka (klik) assignment
  useEffect(() => {
    if (role === "student") {
      const clicktheassignment = settostarted();
    }
  }, [role, params.assignmentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleStudentSubmit = async () => {
    if (!selectedFile || !assignment) return;
    setIsSubmitting(true);
    try {
      const url = await uploadClassMateri(selectedFile);
      if (url) {
        const success = await submitAssignment(assignment.id, selectedFile.name, url);
        if (success) {
          alert(t("kids.assignmentDetail.success"));
          loadData();
        } else {
          alert(t("kids.assignmentDetail.failed"));
        }
      }
    } catch (e) {
      console.error(e);
      alert(t("kids.assignmentDetail.uploadError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDocument = (title: string, url: string) => {
    setMateriTitle(title);
    setMateriUrl(url);
    setMateriModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-full" style={{ background: "#FFF5E1" }}>
        <KidsTopbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="text-5xl animate-bounce">📝</div>
            <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
            <p className="text-orange-600 font-bold text-lg">{t("kids.assignments.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-col min-h-full" style={{ background: "#FFF5E1" }}>
        <KidsTopbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-6xl mb-4 animate-bounce">🤷</div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">{t("kids.assignmentDetail.notFound")}</h2>
          <button onClick={() => router.back()} className="mt-6 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black shadow-lg shadow-orange-500/30 transition-all active:scale-95">
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  const mySubmission = role === 'student' ? submissions.find(s => s.student_id === params.id) : null;
  const isOverdue = new Date() > new Date(assignment.due_date);

  return (
    <div className="flex flex-col min-h-full" style={{ background: "#FFF5E1" }}>
      <RealtimeLoading koleksi={["assignments", "assignment_submissions"]} onRefresh={loadData} />
      <KidsTopbar />

      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1000px] mx-auto w-full space-y-6 sm:space-y-8">

        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border-2 border-orange-200 text-orange-600 font-bold hover:bg-orange-50 transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 font-bold" /> {t("kids.assignmentDetail.backToList")}
        </button>

        <div className="bg-white rounded-[32px] p-6 sm:p-8 relative overflow-hidden shadow-xl border-4 border-blue-200">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-100 to-transparent rounded-bl-full opacity-50 pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-xl text-sm font-black border-2 border-blue-200 flex items-center gap-2">
                <span className="text-lg">📘</span> {assignment.course_name}
              </span>
              {isOverdue && (
                <span className="bg-red-100 text-red-700 px-4 py-1.5 rounded-xl text-sm font-black border-2 border-red-200 flex items-center gap-2">
                  <span className="text-lg">🚨</span> {t("kids.assignmentDetail.late")}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-800 mb-4 leading-tight">
              {assignment.title}
            </h1>

            <div className="flex items-center gap-3 bg-orange-100 text-orange-700 w-fit px-4 py-2 rounded-xl font-bold border border-orange-200 mb-6">
              <span className="text-xl">⏰</span> {t("kids.assignmentDetail.deadline", { date: dates.dateTime(assignment.due_date) })}
            </div>

            <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 mb-6">
              <h3 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-2">
                <span className="text-xl">📝</span> {t("kids.assignmentDetail.descTitle")}
              </h3>
              <p className="text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">
                {assignment.description || t("kids.assignmentDetail.noDesc")}
              </p>
            </div>

            {assignment.materi_url && (
              <button
                onClick={() => handleViewDocument(assignment.materi_name || t("kids.assignmentDetail.taskDoc"), assignment.materi_url!)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-blue-400 to-sky-500 hover:from-blue-500 hover:to-sky-600 text-white px-6 py-3.5 rounded-2xl font-black transition-all active:scale-95 shadow-md border-b-4 border-blue-700"
              >
                <Eye className="w-6 h-6" /> {t("kids.assignmentDetail.viewMaterial")}
              </button>
            )}
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-xl border-4 border-emerald-200">
          <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
            <span className="text-3xl">🚀</span> {t("kids.assignmentDetail.submitTitle")}
          </h3>

          {mySubmission ? (
            <div className="bg-emerald-50 border-4 border-emerald-200 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 text-6xl opacity-20 rotate-12">🎉</div>
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 shrink-0 bg-emerald-400 rounded-2xl flex items-center justify-center text-white shadow-inner border-b-4 border-emerald-600">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <p className="font-black text-emerald-800 text-xl">{t("kids.assignmentDetail.submittedTitle")}</p>
                    <p className="text-emerald-600 font-bold mt-1">
                      {t("kids.assignmentDetail.sentAt", { date: dates.dateTime(mySubmission.submitted_at) })}
                    </p>
                  </div>
                </div>
                {mySubmission.file_url && (
                  <button
                    onClick={() => handleViewDocument(mySubmission.file_name || t("kids.assignmentDetail.myTaskDoc"), mySubmission.file_url)}
                    className="bg-white text-emerald-600 hover:bg-emerald-100 px-6 py-3 rounded-2xl font-black transition-colors border-2 border-emerald-300 w-full sm:w-auto shadow-sm"
                  >
                    {t("kids.assignmentDetail.viewMyAnswer")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-4 border-dashed border-sky-200 bg-sky-50 rounded-[28px] p-6 sm:p-12 text-center hover:bg-sky-100 hover:border-sky-300 transition-colors group">
                <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl mb-4 shadow-sm border-2 border-sky-100 group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                  📁
                </div>
                <p className="text-sky-800 font-bold text-lg mb-4">
                  {t("kids.assignmentDetail.chooseHint")}
                </p>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.png,.jpg,.jpeg"
                />
                <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-8 py-4 rounded-2xl font-black shadow-md border-b-4 border-sky-700 transition-all active:scale-95">
                  <UploadCloud className="w-6 h-6" /> {t("kids.assignmentDetail.chooseFile")}
                </label>
                {selectedFile && (
                  <div className="mt-6 inline-flex max-w-full items-center gap-2 bg-white px-4 py-2 rounded-xl text-sm font-bold text-blue-600 border-2 border-blue-200">
                    <span className="text-lg">📎</span> <span className="truncate">{selectedFile.name}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleStudentSubmit}
                disabled={!selectedFile || isSubmitting}
                className="w-full py-5 bg-gradient-to-r from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 disabled:from-slate-200 disabled:to-slate-300 disabled:border-slate-300 text-white font-black text-xl rounded-2xl transition-all shadow-lg active:scale-95 border-b-4 border-pink-700 flex items-center justify-center gap-3 disabled:scale-100 disabled:shadow-none"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-7 h-7 animate-spin"/> {t("kids.assignmentDetail.sending")}</>
                ) : (
                  <>{t("kids.assignmentDetail.sendNow")}</>
                )}
              </button>
            </div>
          )}
        </div>

      </div>

      <ViewMateriModal
        isOpen={materiModalOpen}
        onClose={() => setMateriModalOpen(false)}
        materiName={materiTitle}
        materiUrl={materiUrl}
      />
    </div>
  );
}
