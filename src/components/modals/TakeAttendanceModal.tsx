"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Calendar, CheckCircle2, UploadCloud, Image as ImageIcon } from "lucide-react";
import { TakeAttandance, uploadAttendanceProof } from "@/lib/api";
import { connecttoauth } from "@/lib/firebase";
import { useI18n } from "@/components/translate/client";
import { useLocaleTag } from "@/components/translate/format";

interface TakeAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  schedule?: string;
  onSuccess?: () => void;
}

export function TakeAttendanceModal({ isOpen, onClose, classId, schedule, onSuccess }: TakeAttendanceModalProps) {
  const t = useI18n();
  const localeTag = useLocaleTag();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState<"Attended" | "Late" | "Absence" | "ExcusedAbsen">("Attended");
  const [reason, setReason] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString(localeTag, { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setError(null);
      setProofFile(null);
      setReason("");

      // Auto-fill names if possible from Firebase auth display name
      const user = connecttoauth.currentUser;
      if (user && user.displayName) {
        const parts = user.displayName.split(" ");
        if (parts.length > 0) setFirstName(parts[0]);
        if (parts.length > 2) {
          setMiddleName(parts[1]);
          setLastName(parts.slice(2).join(" "));
        } else if (parts.length === 2) {
          setLastName(parts[1]);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError(t("modals.attendance.namesRequired"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const studentId = connecttoauth.currentUser?.uid || "unknown_student";
      let proofUrl = undefined;

      if (proofFile) {
        const url = await uploadAttendanceProof(proofFile);
        if (url) proofUrl = url;
        else throw new Error("Failed to upload proof");
      }

      // Simple mock for late checking: if it's after 10 AM, mark as late (unless they selected something else)
      let finalStatus = status;
      if (status === "Attended") {
        if (schedule) {
          const scheduleTime = new Date(schedule).getTime();
          if (currentDate.getTime() > scheduleTime) {
            finalStatus = "Late";
          }
        } else if (currentDate.getHours() >= 10) {
          finalStatus = "Late";
        }
      }

      const result = await TakeAttandance({
        class_id: classId,
        student_id: studentId,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        status: finalStatus,
        reason: (status === "Absence" || status === "ExcusedAbsen") ? reason : undefined,
        proof_url: proofUrl
      });

      if (result) {
        setSuccess(true);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(t("modals.attendance.recordFailed"));
      }
    } catch (err) {
      setError(t("modals.attendance.genericError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={success ? undefined : onClose}>
      <div
        className="bg-white dark:bg-[#003049] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t("modals.attendance.title")}</h2>
                <p className="text-emerald-100 text-sm">{dateStr}</p>
              </div>
            </div>
            {!success && (
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors" aria-label={t("common.close")}>
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <CheckCircle2 className="w-20 h-20 text-emerald-500 animate-bounce" />
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{t("modals.attendance.recordedTitle")}</h3>
            <p className="text-slate-500">{t("modals.attendance.recordedDesc")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.attendance.firstName")}</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
                  placeholder={t("modals.attendance.firstPlaceholder")}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.attendance.middleName")}</label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
                  placeholder={t("modals.attendance.middlePlaceholder")}
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.attendance.lastName")}</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
                  placeholder={t("modals.attendance.lastPlaceholder")}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-3">{t("modals.attendance.statusLabel")}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("Attended")}
                  className={`py-2 px-3 rounded-xl border text-sm font-bold transition-all ${
                    status === "Attended" || status === "Late"
                      ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                      : "bg-slate-50 dark:bg-[#003049] border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {t("modals.attendance.attending")}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("ExcusedAbsen")}
                  className={`py-2 px-3 rounded-xl border text-sm font-bold transition-all ${
                    status === "ExcusedAbsen" || status === "Absence"
                      ? "bg-rose-50 dark:bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400"
                      : "bg-slate-50 dark:bg-[#003049] border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {t("modals.attendance.notAttending")}
                </button>
              </div>
            </div>

            {(status === "Absence" || status === "ExcusedAbsen") && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.attendance.reasonLabel")}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
                  >
                    <option value="ExcusedAbsen">{t("modals.attendance.excused")}</option>
                    <option value="Absence">{t("modals.attendance.unexcused")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.attendance.detailsLabel")}</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
                    placeholder={t("modals.attendance.detailsPlaceholder")}
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.attendance.proofLabel")}</label>
                  <div className="relative group cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-full px-4 py-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${proofFile ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#003049] group-hover:border-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20'}`}>
                      {proofFile ? (
                        <>
                          <ImageIcon className="w-6 h-6 text-emerald-500 mb-2" />
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{proofFile.name}</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-6 h-6 text-slate-400 mb-2" />
                          <span className="text-sm font-medium text-slate-500">{t("modals.attendance.clickUpload")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-rose-500 font-medium bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-xl">{error}</p>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("modals.attendance.submit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
