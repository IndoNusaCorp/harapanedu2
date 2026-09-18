"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Loader2, Paperclip, Sparkles, X } from "lucide-react";
import { useI18n } from "@/components/translate/client";
import { useLocaleTag } from "@/components/translate/format";
import { createGrade } from "@/lib/api";
import { aiFetch } from "@/lib/ai/client";
import { gradeLetter } from "@/lib/ai/tone";
import type { AiGradeResult, AiSubmissionItem } from "@/lib/types";

const MAX_BATCH = 10;

// ============================================
// Modal penilaian ScorpioAI (khusus guru)
// ============================================
// 1. select  : guru memilih tugas yang sudah dikumpulkan
// 2. loading : ScorpioAI membaca file jawaban dari Storage dan memberi nilai
// 3. preview : guru bisa mengubah nilai/feedback, lalu setuju (disimpan) atau tolak (nilai manual)
export function ScorpioGradingModal({ isOpen, onClose, onSaved, onRejected }: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (count: number) => void;
  onRejected: (items: AiGradeResult[]) => void;
}) {
  const t = useI18n();
  const localeTag = useLocaleTag();
  const [step, setStep] = useState<"select" | "loading" | "preview">("select");
  const [submissions, setSubmissions] = useState<AiSubmissionItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<AiGradeResult[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep("select");
    setSelected([]);
    setResults([]);
    setSkipped([]);
    setLoadingList(true);
    aiFetch("/api/ScorpioAI")
      .then(res => res.json())
      .then(json => {
        const list: AiSubmissionItem[] = json.success ? json.data.submissions : [];
        setSubmissions(list);
        // Default: pilih yang belum dinilai
        setSelected(list.filter(s => !s.already_graded && s.file_name).slice(0, MAX_BATCH).map(s => s.submission_id));
      })
      .catch(() => setSubmissions([]))
      .finally(() => setLoadingList(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id)
      ? prev.filter(x => x !== id)
      : prev.length >= MAX_BATCH ? prev : [...prev, id]);
  };

  const startGrading = async () => {
    if (selected.length === 0) return;
    setStep("loading");
    try {
      const res = await aiFetch("/api/ScorpioAI", {
        method: "POST",
        body: JSON.stringify({ action: "grade", submissionIds: selected }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setResults(json.data.results);
      setSkipped(json.data.skipped);
      setStep("preview");
    } catch (e) {
      console.error("Grading gagal:", e);
      alert(t("scorpio.grading.gradingError"));
      setStep("select");
    }
  };

  const updateResult = (i: number, changes: Partial<AiGradeResult>) => {
    setResults(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, ...changes };
      if (changes.score !== undefined) next.grade_letter = gradeLetter(next.score);
      return next;
    }));
  };

  const accept = async () => {
    setSaving(true);
    try {
      let saved = 0;
      for (const r of results) {
        const ok = await createGrade({
          course_name: r.course_name || "Unknown",
          student_id: r.student_id,
          assignment_id: r.assignment_id,
          class_id: r.class_id,
          score: r.score,
          grade_letter: r.grade_letter,
          feedback: r.feedback,
          credits: 1,
        });
        if (ok) saved++;
      }
      if (saved < results.length) alert(t("scorpio.grading.saveFailed"));
      onSaved(saved);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const reject = () => {
    onRejected(results);
    onClose();
  };

  const scoreColor = (score: number) => score >= 90 ? "text-emerald-500" : score >= 70 ? "text-edu-blue dark:text-sky-300" : "text-rose-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => step !== "loading" && onClose()} />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-pop dark:bg-edu-night">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-edu-indigo to-edu-purple text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {step === "select" && t("scorpio.grading.selectTitle")}
                {step === "loading" && t("scorpio.grading.loadingTitle")}
                {step === "preview" && t("scorpio.grading.previewTitle")}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {step === "select" && t("scorpio.grading.submittedCount", { count: submissions.length })}
                {step === "loading" && t("scorpio.grading.pleaseWait")}
                {step === "preview" && t("scorpio.grading.gradedCount", { count: results.length })}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={step === "loading"} className="rounded-xl p-2 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-white/10" aria-label={t("common.close")}>
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === "select" && (
            loadingList ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-edu-blue" /></div>
            ) : submissions.length === 0 ? (
              <div className="py-12 text-center">
                <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <p className="font-medium text-slate-500">{t("scorpio.grading.noSubmissions")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("scorpio.grading.maxHint", { max: MAX_BATCH })}</p>
                {submissions.map(sub => {
                  const checked = selected.includes(sub.submission_id);
                  const disabled = !sub.file_name || (!checked && selected.length >= MAX_BATCH);
                  return (
                    <label
                      key={sub.submission_id}
                      className={`flex items-start gap-4 rounded-2xl border-2 p-4 transition-all ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${checked
                        ? "border-edu-blue bg-blue-50 dark:border-sky-400 dark:bg-blue-900/20"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(sub.submission_id)}
                        className="mt-1 h-5 w-5 shrink-0 rounded-md accent-edu-blue"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-800 dark:text-white">{sub.student_name}</p>
                          {sub.already_graded && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> {t("scorpio.grading.alreadyGraded")}
                            </span>
                          )}
                          {sub.is_late && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">{t("scorpio.grading.late")}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{sub.assignment_title} — {sub.course_name}</p>
                        <p className={`mt-1 flex items-center gap-1 text-xs ${sub.file_name ? "text-edu-blue dark:text-sky-300" : "text-rose-500"}`}>
                          <Paperclip className="h-3 w-3" /> {sub.file_name || t("scorpio.grading.noFile")}
                        </p>
                        {sub.submitted_at && (
                          <p className="mt-1 text-xs text-slate-400">{t("scorpio.grading.submittedOn", { date: new Date(sub.submitted_at).toLocaleDateString(localeTag) })}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )
          )}

          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="mb-4 h-12 w-12 animate-spin text-edu-blue" />
              <p className="font-medium text-slate-600 dark:text-slate-300">{t("scorpio.grading.analyzing")}</p>
              <p className="mt-1 text-sm text-slate-400">{t("scorpio.grading.mayTake")}</p>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {skipped.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="font-semibold">{t("scorpio.grading.skippedTitle")}</p>
                  <ul className="mt-1 list-disc pl-5">{skipped.map(s => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
              {results.map((r, i) => (
                <div key={r.submission_id} className="space-y-2 rounded-2xl border-2 border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-white">{r.student_name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{r.assignment_title} — {r.course_name}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={r.score}
                        onChange={(e) => updateResult(i, { score: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        className={`w-20 rounded-xl border border-slate-200 bg-transparent px-2 py-1 text-center text-2xl font-black dark:border-white/15 ${scoreColor(r.score)}`}
                        aria-label={t("scorpio.grading.scoreLabel")}
                      />
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-white">
                        {t("scorpio.grading.gradeBadge", { letter: r.grade_letter })}
                      </span>
                    </div>
                  </div>
                  <textarea
                    value={r.feedback}
                    onChange={(e) => updateResult(i, { feedback: e.target.value })}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 outline-none focus:border-edu-blue dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    aria-label={t("scorpio.grading.feedbackLabel")}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-200 px-6 py-4 dark:border-white/10">
          {step === "select" && (
            <>
              <button onClick={onClose} className="flex-1 rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5">
                {t("common.cancel")}
              </button>
              <button
                onClick={startGrading}
                disabled={selected.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-edu-blue to-edu-indigo px-4 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {t("scorpio.grading.start", { count: selected.length })}
              </button>
            </>
          )}
          {step === "preview" && (
            <>
              <button onClick={reject} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-red-200 px-4 py-3 font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20">
                <X className="h-4 w-4" /> {t("scorpio.grading.reject")}
              </button>
              <button
                onClick={accept}
                disabled={saving || results.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? t("scorpio.grading.saving") : t("scorpio.grading.accept")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
