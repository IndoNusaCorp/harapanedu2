"use client";

import React, { useState } from "react";
import { X, Loader2, BookOpen } from "lucide-react";
import { useI18n } from "@/components/translate/client";

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (classData: { id?: string; name: string; course_name: string; description: string; schedule: string; room: string; materi_file?: File | null }) => void;
  initialData?: { id: string; name: string; course_name?: string; description?: string; schedule?: string; room?: string };
}

export function CreateClassModal({ isOpen, onClose, onSuccess, initialData }: CreateClassModalProps) {
  const t = useI18n();
  const [name, setName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("");
  const [room, setRoom] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMateri, setUploadMateri] = useState<File | null>(null);

  //function untuk upload materi
  const handleUploadMateri = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadMateri(file);
    }
  };

  React.useEffect(() => {
    if (initialData && isOpen) {
      setName(initialData.name || "");
      setCourseName(initialData.course_name || "");
      setDescription(initialData.description || "");
      setSchedule(initialData.schedule || "");
      setRoom(initialData.room || "");
    } else if (!isOpen) {
      setName("");
      setCourseName("");
      setDescription("");
      setSchedule("");
      setRoom("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !courseName.trim()) {
      setError(t("modals.class.required"));
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      await onSuccess({ id: initialData?.id, name, course_name: courseName, description, schedule, room, materi_file: uploadMateri });
      onClose();
    } catch {
      setError(t("modals.class.saveFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#003049] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{initialData ? t("modals.class.editTitle") : t("modals.class.createTitle")}</h2>
                <p className="text-blue-100 text-sm">{initialData ? t("modals.class.editSubtitle") : t("modals.class.createSubtitle")}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors" aria-label={t("common.close")}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.class.nameLabel")}</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
                placeholder={t("modals.class.namePlaceholder")}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.class.courseLabel")}</label>
              <input
                type="text"
                required
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
                placeholder={t("modals.class.coursePlaceholder")}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.class.descLabel")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all resize-none"
                placeholder={t("modals.class.descPlaceholder")}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.class.scheduleLabel")}</label>
              <input
                type="datetime-local"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.class.roomLabel")}</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
                placeholder={t("modals.class.roomPlaceholder")}
              />
            </div>
          </div>

          {/* Upload File (Materi Class) */}
          <div className="col-span-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.class.materialLabel")}</label>
            <input
              type="file"
              onChange={handleUploadMateri}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
              // Upload file hanya pdf dan document
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.png"
            />
            {uploadMateri && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t("common.selectedFile", { name: uploadMateri.name })}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-500 font-medium bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
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
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> {t("common.processing")}</> : initialData ? t("common.saveChanges") : t("modals.class.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
