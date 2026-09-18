"use client";

import React, { useState } from "react";
import { X, Loader2, CalendarDays } from "lucide-react";
import { useI18n } from "@/components/translate/client";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { id?: string; title: string; description: string; event_date: string; event_time: string; location: string; event_type: string; meeting_link: string }) => void;
  defaultDate?: string;
  initialData?: { id: string; title: string; description?: string; event_date: string; event_time?: string; location?: string; event_type: string; meeting_link?: string };
}

const EVENT_TYPES = [
  { value: "class", label: "modals.event.types.class", color: "bg-blue-500" },
  { value: "deadline", label: "modals.event.types.deadline", color: "bg-rose-500" },
  { value: "meeting", label: "modals.event.types.meeting", color: "bg-emerald-500" },
  { value: "exam", label: "modals.event.types.exam", color: "bg-amber-500" },
] as const;

export function CreateEventModal({ isOpen, onClose, onSuccess, defaultDate, initialData }: CreateEventModalProps) {
  const t = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(defaultDate || "");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState("class");
  const [meetingLink, setMeetingLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialData && isOpen) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setEventDate(initialData.event_date || defaultDate || "");
      setEventTime(initialData.event_time || "");
      setLocation(initialData.location || "");
      setEventType(initialData.event_type || "class");
      setMeetingLink(initialData.meeting_link || "");
    } else if (!isOpen) {
      setTitle(""); setDescription(""); setEventDate(defaultDate || ""); setEventTime(""); setLocation(""); setEventType("class"); setMeetingLink("");
    }
  }, [initialData, isOpen, defaultDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) { setError(t("modals.event.required")); return; }
    setIsLoading(true); setError(null);
    try {
      await onSuccess({ id: initialData?.id, title, description, event_date: eventDate, event_time: eventTime, location, event_type: eventType, meeting_link: meetingLink });
      onClose();
    } catch { setError(t("modals.event.saveFailed")); } finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#003049] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white relative overflow-hidden rounded-t-3xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div>
              <div><h2 className="text-xl font-bold">{initialData ? t("modals.event.editTitle") : t("modals.event.createTitle")}</h2><p className="text-emerald-100 text-sm">{initialData ? t("modals.event.editSubtitle") : t("modals.event.createSubtitle")}</p></div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors" aria-label={t("common.close")}><X className="w-5 h-5" /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.event.titleLabel")}</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white" placeholder={t("modals.event.titlePlaceholder")} />
          </div>
          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-2">{t("modals.event.typeLabel")}</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((type) => (
                <button key={type.value} type="button" onClick={() => setEventType(type.value)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${eventType === type.value ? "bg-blue-600 text-white shadow-md" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>{t(type.label)}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.event.dateLabel")}</label><input type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white" /></div>
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.event.timeLabel")}</label><input type="text" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white" placeholder={t("modals.event.timePlaceholder")} /></div>
          </div>
          <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.event.locationLabel")}</label><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white" placeholder={t("modals.event.locationPlaceholder")} /></div>
          {eventType === "meeting" && (
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.event.linkLabel")}</label><input type="text" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white" placeholder="https://zoom.us/j/..." /></div>
          )}
          <div><label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.event.descLabel")}</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium dark:text-white resize-none" placeholder={t("modals.event.descPlaceholder")} /></div>
          {error && <p className="text-sm text-rose-500 font-medium bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{t("common.cancel")}</button>
            <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-70">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : initialData ? t("common.saveChanges") : t("modals.event.submit")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
