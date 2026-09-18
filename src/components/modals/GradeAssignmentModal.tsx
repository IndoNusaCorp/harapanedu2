"use client";

import React, { useState } from "react";
import { X, Loader2, Award } from "lucide-react";
import { useI18n } from "@/components/translate/client";

interface GradeAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { id?: string; score: number; grade_letter: string; feedback: string; credits: number; course_name?: string }) => void;
  assignmentTitle?: string;
  studentName?: string;
  initialData?: { id: string; score: number; grade_letter?: string; feedback?: string; credits?: number; course_name?: string };
}

const GRADE_LETTERS = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "E"];

export function GradeAssignmentModal({ isOpen, onClose, onSuccess, assignmentTitle, studentName, initialData }: GradeAssignmentModalProps) {
  const t = useI18n();
  const [courseName, setCourseName] = useState("");
  const [score, setScore] = useState("");
  const [gradeLetter, setGradeLetter] = useState("A");
  const [feedback, setFeedback] = useState("");
  const [credits, setCredits] = useState("3");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialData && isOpen) {
      setCourseName(initialData.course_name || assignmentTitle || "");
      setScore(initialData.score.toString());
      setGradeLetter(initialData.grade_letter || "A");
      setFeedback(initialData.feedback || "");
      setCredits(initialData.credits ? initialData.credits.toString() : "3");
    } else if (!isOpen) {
      setCourseName(""); setScore(""); setGradeLetter("A"); setFeedback(""); setCredits("3");
    }
  }, [initialData, isOpen, assignmentTitle]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseFloat(score);
    if (isNaN(s) || s < 0 || s > 100) { setError(t("modals.grade.scoreRange")); return; }
    setIsLoading(true); setError(null);
    try {
      await onSuccess({ id: initialData?.id, course_name: courseName, score: s, grade_letter: gradeLetter, feedback, credits: parseInt(credits) || 3 });
      onClose();
    } catch { setError(t("modals.grade.saveFailed")); } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#003049] w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white relative overflow-hidden rounded-t-3xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center"><Award className="w-5 h-5" /></div>
              <div><h2 className="text-xl font-bold">{initialData ? t("modals.grade.editTitle") : t("modals.grade.addTitle")}</h2>{assignmentTitle && <p className="text-amber-100 text-sm">{assignmentTitle}</p>}</div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors" aria-label={t("common.close")}><X className="w-5 h-5" /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {studentName && (
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {t("modals.grade.student", { name: <span className="text-blue-600 dark:text-blue-400">{studentName}</span> })}
            </p>
          )}
          {!assignmentTitle && (
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.grade.courseLabel")}</label><input type="text" required value={courseName} onChange={(e) => setCourseName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white" placeholder={t("modals.grade.coursePlaceholder")} /></div>
          )}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.grade.scoreLabel")}</label><input type="number" required min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white" placeholder="95" /></div>
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.grade.gradeLabel")}</label><select value={gradeLetter} onChange={(e) => setGradeLetter(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white">{GRADE_LETTERS.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.grade.creditsLabel")}</label><input type="number" min="1" max="6" value={credits} onChange={(e) => setCredits(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white" /></div>
          </div>
          <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.grade.feedbackLabel")}</label><textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white resize-none" placeholder={t("modals.grade.feedbackPlaceholder")} /></div>
          {error && <p className="text-sm text-rose-500 font-medium bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{t("common.cancel")}</button>
            <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-70">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : initialData ? t("common.saveChanges") : t("modals.grade.submit")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
