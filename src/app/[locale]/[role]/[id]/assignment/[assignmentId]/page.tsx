"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, Clock, CheckCircle2,
  UploadCloud, Loader2, Eye, AlertCircle, Award
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useRole } from "@/context/RoleContext";
import { getAssignment, getAssignmentSubmissions, submitAssignment, startAssignment, uploadClassMateri, createGrade } from "@/lib/api";
import type { Assignment } from "@/lib/types";
import { ViewMateriModal } from "@/components/modals/ViewMateriModal";
import { GradeAssignmentModal } from "@/components/modals/GradeAssignmentModal";
import { useI18n } from "@/components/translate/client";
import { useDateFormat } from "@/components/translate/format";

import KidsAssignmentDetail from "@/components/kids/KidsAssignmentDetail";

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const basePath = `/${params.role}/${params.id}`;
  const { role, isKidsMode } = useRole();
  const t = useI18n();
  const dates = useDateFormat();

  // If kids mode (SD class 1-6), render the kids-friendly assignment detail view
  if (isKidsMode) return <KidsAssignmentDetail />;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Materi state
  const [materiModalOpen, setMateriModalOpen] = useState(false);
  const [materiTitle, setMateriTitle] = useState("");
  const [materiUrl, setMateriUrl] = useState("");
  const [materiFileName, setMateriFileName] = useState<string | undefined>();

  // Grading state
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [studentToGrade, setStudentToGrade] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const assignmentId = params.assignmentId as string;

    const data = await getAssignment(assignmentId);
    if (data) {
      setAssignment(data);
    }

    // If teacher, load all submissions
    // If student, load their own submission (for simplicity we can load all submissions and filter,
    // or rely on getting submissions from API. Since we use `getAssignmentSubmissions`, we'll filter client side for student for now)
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
          alert(t("assignmentDetail.submitSuccess"));
          loadData();
        } else {
          alert(t("assignmentDetail.submitFailed"));
        }
      }
    } catch (e) {
      console.error(e);
      alert(t("assignmentDetail.uploadError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDocument = (title: string, url: string, fileName?: string) => {
    setMateriTitle(title);
    setMateriUrl(url);
    setMateriFileName(fileName);
    setMateriModalOpen(true);
  };

  const handleGradeSubmit = async (data: any) => {
    if (!studentToGrade || !assignment) return;
    try {
      const res = await createGrade({
        course_name: data.course_name || assignment.course_name || 'Unknown Course',
        student_id: studentToGrade.student_id,
        assignment_id: assignment.id,
        class_id: assignment.class_id,
        score: data.score,
        grade_letter: data.grade_letter,
        credits: data.credits,
        feedback: data.feedback
      });
      if (res) {
        alert(t("assignmentDetail.gradeSuccess"));
        setGradeModalOpen(false);
        setStudentToGrade(null);
        loadData();
      } else {
        alert(t("assignmentDetail.gradeFailed"));
      }
    } catch (e) {
      console.error(e);
      alert(t("assignmentDetail.gradeError"));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#003049]">
        <Topbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#003049]">
        <Topbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-16 h-16 text-slate-400 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t("assignmentDetail.notFound")}</h2>
          <button onClick={() => router.back()} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl">{t("assignmentDetail.goBack")}</button>
        </div>
      </div>
    );
  }

  const mySubmission = role === 'student' ? submissions.find(s => s.student_id === params.id) : null;
  const isOverdue = new Date() > new Date(assignment.due_date);

  return (
    <>
      <RealtimeLoading koleksi={["assignments", "assignment_submissions"]} onRefresh={loadData} />
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#003049] font-sans">
      <Topbar />

      <div className="flex-1 p-4 sm:p-6 lg:p-10 max-w-[1200px] mx-auto w-full">
        {/* Header */}
        <Link href={`${basePath}/assignment`} className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-4 sm:mb-6 font-medium text-sm sm:text-base">
          <ArrowLeft className="w-4 h-4" /> {t("assignmentDetail.backToList")}
        </Link>

        <div className="bg-white dark:bg-[#003049] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 shadow-sm border border-slate-200 dark:border-slate-800 mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6 sm:mb-8">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/20">{assignment.course_name}</span>
                {isOverdue && <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-full text-xs font-bold border border-rose-500/20">{t("status.overdue")}</span>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">{assignment.title}</h1>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium">
                <Clock className="w-4 h-4" /> {t("assignmentDetail.due", { date: dates.pattern(assignment.due_date, "PPpp") })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* View Prompt Button */}
              {assignment.materi_url ? (
                <button
                  onClick={() => handleViewDocument(assignment.materi_name || t("assignmentDetail.assignmentDoc"), assignment.materi_url!)}
                  className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-5 py-3 rounded-xl font-bold transition-colors shrink-0"
                >
                  <Eye className="w-5 h-5" /> {t("assignmentDetail.viewMaterial")}
                </button>
              ) : (
                <div className="px-5 py-3 rounded-xl bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 text-slate-500 text-sm font-medium text-center">
                  {t("assignmentDetail.noPromptDoc")}
                </div>
              )}
              {role === 'teacher' && (
                <button
                  onClick={() => {
                    const el = document.getElementById('submissions-table');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-bold transition-colors shrink-0"
                >
                  <Award className="w-5 h-5" /> {t("assignmentDetail.gradeSubmissions")}
                </button>
              )}
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t("assignmentDetail.description")}</h3>
            <p className="whitespace-pre-wrap">{assignment.description || t("assignmentDetail.noDescription")}</p>
          </div>
        </div>

        {/* Role Specific Sections */}
        {role === "student" ? (
          <div className="bg-white dark:bg-[#003049] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t("assignmentDetail.yourSubmission")}</h3>

            {mySubmission ? (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">{t("assignmentDetail.submitted")}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                        {dates.pattern(mySubmission.submitted_at, "PPpp")}
                      </p>
                    </div>
                  </div>
                  {mySubmission.file_url && (
                    <button
                      onClick={() => handleViewDocument(mySubmission.file_name || t("assignmentDetail.mySubmissionDoc"), mySubmission.file_url)}
                      className="bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 px-4 py-2 rounded-xl font-bold text-sm transition-colors border border-emerald-200 dark:border-emerald-500/30 w-full sm:w-auto"
                    >
                      {t("assignmentDetail.viewAnswer")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-6 sm:p-10 text-center hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium mb-4">
                    {t("assignmentDetail.uploadHint")}
                  </p>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.png,.jpg,.jpeg"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors">
                    {t("assignmentDetail.browseFiles")}
                  </label>
                  {selectedFile && (
                    <p className="mt-4 text-sm font-bold text-blue-600 dark:text-blue-400">
                      {t("assignmentDetail.selected", { name: selectedFile.name })}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleStudentSubmit}
                  disabled={!selectedFile || isSubmitting}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-2xl transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin"/> {t("assignmentDetail.submitting")}</> : t("assignmentDetail.submit")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div id="submissions-table" className="bg-white dark:bg-[#003049] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">{t("assignmentDetail.studentSubmissions", { count: submissions.length })}</h3>

            {submissions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="pb-4 font-bold text-slate-500 dark:text-slate-400 text-sm">{t("assignmentDetail.colStudent")}</th>
                      <th className="pb-4 font-bold text-slate-500 dark:text-slate-400 text-sm">{t("assignmentDetail.colSubmittedAt")}</th>
                      <th className="pb-4 font-bold text-slate-500 dark:text-slate-400 text-sm">{t("assignmentDetail.colStatus")}</th>
                      <th className="pb-4 font-bold text-slate-500 dark:text-slate-400 text-sm text-right">{t("assignmentDetail.colAction")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="py-4">
                          <p className="font-bold text-slate-900 dark:text-white">{sub.student_name}</p>
                        </td>
                        <td className="py-4">
                          <p className="text-sm font-medium text-slate-500">
                            {dates.dateTime(sub.submitted_at)}
                          </p>
                        </td>
                        <td className="py-4">
                          {sub.status === "graded" ? (
                            <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/20">
                              {t("status.graded")}
                            </span>
                          ) : (
                            <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
                              {t("status.submitted")}
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-4">
                            {sub.file_url ? (
                              <button
                                onClick={() => handleViewDocument(t("assignmentDetail.answerOf", { name: sub.student_name }), sub.file_url, sub.file_name)}
                                className="text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline inline-flex items-center gap-1"
                              >
                                <Eye className="w-4 h-4"/> {t("common.view")}
                              </button>
                            ) : (
                              <span className="text-slate-400 text-sm italic">{t("assignmentDetail.noFile")}</span>
                            )}
                            <button
                              onClick={() => {
                                setStudentToGrade(sub);
                                setGradeModalOpen(true);
                              }}
                              className="text-amber-600 dark:text-amber-500 font-bold text-sm hover:underline inline-flex items-center gap-1"
                            >
                              <Award className="w-4 h-4"/> {t("assignmentDetail.grade")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 dark:bg-[#003049] rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">{t("assignmentDetail.noSubmissions")}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <ViewMateriModal
        isOpen={materiModalOpen}
        onClose={() => setMateriModalOpen(false)}
        materiName={materiTitle}
        materiUrl={materiUrl}
        fileName={materiFileName}
      />

      <GradeAssignmentModal
        isOpen={gradeModalOpen}
        onClose={() => { setGradeModalOpen(false); setStudentToGrade(null); }}
        onSuccess={handleGradeSubmit}
        assignmentTitle={assignment.title}
        studentName={studentToGrade?.student_name}
      />
    </div>
    </>
  );
}
