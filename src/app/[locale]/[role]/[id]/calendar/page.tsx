"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";

import React, { useState, useEffect, useCallback } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Video, User } from "lucide-react";
import KidsCalendar from "@/components/kids/KidsCalendar";
import { useRole } from "@/context/RoleContext";
import { CreateEventModal } from "@/components/modals/CreateEventModal";
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/api";
import type { CalendarEvent, CreateEventForm } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/components/translate/client";
import { useDateFormat } from "@/components/translate/format";
import { EduPage, eduCard } from "@/components/ui/edu";

export default function CalendarPage() {
  const { role, isKidsMode } = useRole();
  const t = useI18n();
  const dates = useDateFormat();

  // If kids mode (SD class 1-6), render the kids-friendly calendar view
  if (isKidsMode) return <KidsCalendar />;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getCalendarEvents();
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
  const startingDayIndex = startOfMonth(currentDate).getDay();
  const emptyDays = Array.from({ length: startingDayIndex });
  // Sunday-first short day names in the active language (the grid starts on Sunday).
  const weekDays = Array.from({ length: 7 }, (_, i) => dates.pattern(addDays(startOfWeek(new Date()), i), "EEE"));

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const getEventsForDate = (date: Date) => events.filter((e) => {
    try {
      const eventDate = new Date(e.event_date);
      return isSameDay(eventDate, date);
    } catch { return false; }
  });

  const selectedDateEvents = getEventsForDate(selectedDate);

  const getEventBadge = (type: string) => {
    switch (type) {
      case "class": return "bg-sky-300";
      case "deadline": return "bg-rose-400";
      case "meeting": return "bg-emerald-300";
      case "exam": return "bg-amber-300";
      default: return "bg-white";
    }
  };

  const handleCreateOrUpdate = async (form: CreateEventForm & { id?: string }) => {
    if (form.id) {
      const success = await updateCalendarEvent(form.id, form);
      if (success) {
        setEvents(prev => prev.map(e => e.id === form.id ? { ...e, ...form, id: e.id } as CalendarEvent : e));
      }
    } else {
      const result = await createCalendarEvent(form);
      if (result) setEvents(prev => [...prev, result]);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t("calendar.deleteConfirm"))) return;
    const success = await deleteCalendarEvent(id);
    if (success) setEvents(prev => prev.filter(ev => ev.id.toString() !== id.toString()));
  };

  const gradientButton = "flex items-center justify-center rounded-xl bg-gradient-to-r from-edu-indigo to-edu-purple text-white shadow-md transition-all hover:brightness-110 active:scale-95";

  return (
    <>
      <RealtimeLoading koleksi={["calendar_events"]} onRefresh={loadData} />
    <EduPage width="max-w-[1600px]">
      <div className="flex flex-col gap-6 xl:flex-row xl:gap-8">
        {/* Calendar */}
        <section className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl uppercase tracking-tight text-slate-900 sm:text-4xl dark:text-white">{dates.pattern(currentDate, "MMMM yyyy")}</h2>
              <p className="mt-1 max-w-sm text-sm text-slate-600 sm:text-base dark:text-white/85">{t("calendar.desc")}</p>
            </div>
            <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
              <button onClick={prevMonth} className={`${gradientButton} w-11 sm:w-10`} aria-label={t("calendar.prevMonth")}><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className={`${gradientButton} flex-1 px-8 py-3 text-base uppercase sm:flex-none sm:px-16 sm:text-lg`}>{t("calendar.today")}</button>
              <button onClick={nextMonth} className={`${gradientButton} w-11 sm:w-10`} aria-label={t("calendar.nextMonth")}><ChevronRight className="h-5 w-5" /></button>
              {role === "teacher" && (
                <button onClick={() => { setEditingEvent(null); setShowCreateEvent(true); }} className={`${gradientButton} w-full gap-2 px-10 py-3 text-sm sm:ml-4 sm:w-auto`}>
                  <Plus className="h-4 w-4" /> {t("calendar.addEvent")}
                </button>
              )}
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1.5 sm:mb-3 sm:gap-3">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-center text-xs uppercase text-slate-700 sm:text-2xl dark:text-white">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
            {emptyDays.map((_, i) => <div key={`empty-${i}`} className="h-14 sm:h-20 lg:h-24" />)}
            {daysInMonth.map((date) => {
              const dayEvents = getEventsForDate(date);
              const isSelected = isSameDay(date, selectedDate);
              const isTodayDate = isToday(date);
              return (
                <button
                  key={date.toString()}
                  onClick={() => setSelectedDate(date)}
                  aria-pressed={isSelected}
                  className={`relative flex h-14 flex-col items-center justify-center rounded-lg text-white shadow-sm transition-all hover:-translate-y-0.5 sm:h-20 sm:rounded-xl lg:h-24 ${isTodayDate ? "bg-gradient-to-br from-edu-indigo to-edu-purple" : "bg-edu-blue hover:bg-edu-blue-deep"} ${isSelected ? "z-10 scale-105 ring-4 ring-sky-300" : ""}`}
                >
                  <span className="text-base sm:text-xl">{format(date, "d")}</span>
                  {dayEvents.length > 0 && (
                    <span className="mt-1 flex items-center gap-0.5 sm:gap-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span key={event.id} className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${getEventBadge(event.event_type)}`} />
                      ))}
                    </span>
                  )}
                  {dayEvents[0] && (
                    <span className="mt-0.5 hidden max-w-full truncate px-1.5 text-[10px] font-medium lg:block">{dayEvents[0].title}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Side Panel */}
        <aside className="flex w-full shrink-0 flex-col gap-6 md:flex-row xl:w-80 xl:flex-col">
          <div className={`${eduCard} p-5 md:flex-1 xl:flex-none`}>
            <p className="text-sm">{dates.pattern(selectedDate, "EEEE")}</p>
            <h2 className="mt-1 text-2xl">{dates.long(selectedDate)}</h2>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-edu-blue-deep p-3">
              <div>
                <p className="text-sm">{t("calendar.events")}</p>
                <p className="text-[11px] text-white/85">{isToday(selectedDate) ? t("calendar.todayLower") : t("calendar.onThisDay")}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D9D9D9] text-sm font-bold text-slate-900">{selectedDateEvents.length}</div>
            </div>
          </div>

          <div className={`${eduCard} flex min-h-[320px] flex-col p-5 md:flex-1 xl:min-h-[420px]`}>
            <span className="w-fit rounded-full bg-slate-200 px-10 py-1 text-sm text-slate-900">{t("calendar.agenda")}</span>
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-white/80">{t("common.loading")}</div>
            ) : selectedDateEvents.length > 0 ? (
              <div className="mt-4 space-y-3 overflow-y-auto hide-scrollbar">
                {selectedDateEvents.map((event) => (
                  <div key={event.id} className="rounded-xl bg-white/10 p-4 transition-colors hover:bg-white/15">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs font-bold">
                        <span className={`h-2 w-2 rounded-full ${getEventBadge(event.event_type)}`} /> {event.event_time}
                      </span>
                      {role === "teacher" && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingEvent(event); setShowCreateEvent(true); }} className="rounded p-1 text-white/80 transition-colors hover:text-white" aria-label={t("calendar.editAria")}><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={(e) => handleDelete(e, event.id.toString())} className="rounded p-1 text-white/80 transition-colors hover:text-rose-300" aria-label={t("calendar.deleteAria")}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                    <h4 className="mb-2 text-base font-bold leading-tight">{event.title}</h4>
                    <div className="space-y-1.5 text-xs text-white/85">
                      {event.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {event.location}</div>}
                      {event.meeting_link && <div className="flex items-center gap-2"><Video className="h-3.5 w-3.5" /> <a href={`https://${event.meeting_link}`} className="font-semibold hover:underline">{t("calendar.joinMeeting")}</a></div>}
                      {event.instructor && <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> {event.instructor}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D9D9D9]"><Clock className="h-7 w-7 text-slate-800" /></div>
                <p className="mt-4 text-sm">{t("calendar.noEvents")}</p>
                <p className="mt-1 text-xs text-white/80">{t("calendar.noEventsDesc")}</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <CreateEventModal
        isOpen={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        onSuccess={handleCreateOrUpdate as any}
        defaultDate={format(selectedDate, "yyyy-MM-dd")}
        initialData={editingEvent as any}
      />
    </EduPage>
    </>
  );
}
