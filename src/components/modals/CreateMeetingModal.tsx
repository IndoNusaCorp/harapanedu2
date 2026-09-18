"use client";

import React, { useState } from "react";
import { X, Loader2, Video } from "lucide-react";
import { useI18n } from "@/components/translate/client";

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { id?: string; title: string; time: string; participants?: number; status?: string; link?: string }) => void;
  initialData?: { id: string; title: string; time: string; participants?: number; status?: string; link?: string };
}

export function CreateMeetingModal({ isOpen, onClose, onSuccess, initialData }: CreateMeetingModalProps) {
  const t = useI18n();
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [link, setLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialData && isOpen) {
      setTitle(initialData.title || "");
      setTime(initialData.time || "");
      setLink(initialData.link || "");
    } else if (!isOpen) {
      setTitle("");
      setTime("");
      setLink("");
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !time.trim()) {
      setError(t("modals.meeting.required"));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onSuccess({
        id: initialData?.id,
        title,
        time,
        link,
        participants: initialData?.participants || 0,
        status: initialData?.status || "upcoming"
      });
      onClose();
    } catch {
      setError(t("modals.meeting.saveFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#003049] w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-6 text-white relative overflow-hidden rounded-t-3xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{initialData ? t("modals.meeting.editTitle") : t("modals.meeting.createTitle")}</h2>
                <p className="text-violet-100 text-sm">{initialData ? t("modals.meeting.editSubtitle") : t("modals.meeting.createSubtitle")}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors" aria-label={t("common.close")}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.meeting.titleLabel")}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-medium dark:text-white"
              placeholder={t("modals.meeting.titlePlaceholder")}
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.meeting.timeLabel")}</label>
            <input
              type="text"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-medium dark:text-white"
              placeholder={t("modals.meeting.timePlaceholder")}
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.meeting.linkLabel")}</label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-medium dark:text-white"
              placeholder={t("modals.meeting.linkPlaceholder")}
            />
          </div>

          {error && (
            <p className="text-sm text-rose-500 font-medium bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-xl">
              {error}
            </p>
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
              className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : initialData ? t("common.saveChanges") : t("modals.meeting.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
