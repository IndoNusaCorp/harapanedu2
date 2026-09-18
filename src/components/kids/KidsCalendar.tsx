"use client";

import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React, { useState, useEffect, useCallback } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { getCalendarEvents } from "@/lib/api";
import type { CalendarEvent } from "@/lib/types";
import { KidsPage } from "@/components/kids/ui";
import { useI18n } from "@/components/translate/client";
import { useDateFormat } from "@/components/translate/format";

export default function KidsCalendar() {
  const t = useI18n();
  const dates = useDateFormat();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getCalendarEvents();
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      case "class": return { dot: "bg-sky-300", emoji: "📘" };
      case "deadline": return { dot: "bg-rose-400", emoji: "🚨" };
      case "meeting": return { dot: "bg-emerald-300", emoji: "🎥" };
      case "exam": return { dot: "bg-amber-300", emoji: "📝" };
      default: return { dot: "bg-white", emoji: "📅" };
    }
  };

  const navButton = "flex items-center justify-center rounded-xl bg-kids-violet text-white shadow-sm transition-all hover:brightness-110 active:scale-95";

  return (
    <>
      <RealtimeLoading koleksi={["calendar_events"]} onRefresh={loadData} />
    <KidsPage loading={loading} loadingEmoji="📅" loadingText={t("kids.calendar.loading")} width="max-w-[1600px]">
      <div className="flex flex-col gap-6 xl:flex-row xl:gap-8">
        {/* Calendar */}
        <section className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl uppercase tracking-tight text-black sm:text-4xl">
                {dates.pattern(currentDate, "MMMM yyyy")}
              </h2>
              <p className="mt-1 text-sm text-black/80 sm:text-base">{t("kids.calendar.desc")}</p>
            </div>
            <div className="flex items-stretch gap-2 sm:gap-3">
              <button onClick={prevMonth} className={`${navButton} w-11 sm:w-12`} aria-label={t("kids.calendar.prevMonth")}>
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className={`${navButton} flex-1 px-8 py-3 text-base uppercase sm:flex-none sm:px-14 sm:text-lg`}>
                {t("kids.calendar.today")}
              </button>
              <button onClick={nextMonth} className={`${navButton} w-11 sm:w-12`} aria-label={t("kids.calendar.nextMonth")}>
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1.5 sm:mb-3 sm:gap-3">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-center text-xs uppercase text-black sm:text-xl">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
            {emptyDays.map((_, i) => (
              <div key={`empty-${i}`} className="h-14 sm:h-20 lg:h-24" />
            ))}
            {daysInMonth.map((date) => {
              const dayEvents = getEventsForDate(date);
              const isSelected = isSameDay(date, selectedDate);
              const isTodayDate = isToday(date);
              return (
                <button
                  key={date.toString()}
                  onClick={() => setSelectedDate(date)}
                  aria-pressed={isSelected}
                  className={`relative flex h-14 flex-col items-center justify-center rounded-lg text-white shadow-sm transition-all hover:-translate-y-0.5 sm:h-20 sm:rounded-xl lg:h-24 ${
                    isTodayDate ? "bg-kids-sun" : "bg-kids-violet"
                  } ${isSelected ? "z-10 scale-105 ring-4 ring-kids-coral" : ""}`}
                >
                  <span className="text-base sm:text-xl">{format(date, "d")}</span>
                  {dayEvents.length > 0 && (
                    <span className="mt-1 flex items-center gap-0.5 sm:gap-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span key={event.id} className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${getEventBadge(event.event_type).dot}`} />
                      ))}
                    </span>
                  )}
                  {dayEvents[0] && (
                    <span className="mt-0.5 hidden max-w-full truncate px-1.5 text-[10px] font-medium lg:block">
                      {dayEvents[0].title}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Side Panel */}
        <aside className="flex w-full shrink-0 flex-col gap-6 md:flex-row xl:w-80 xl:flex-col">
          <div className="rounded-2xl bg-kids-violet p-5 text-white shadow-md md:flex-1 xl:flex-none">
            <p className="text-sm">{dates.pattern(selectedDate, "EEEE")}</p>
            <h3 className="mt-1 text-2xl">{dates.long(selectedDate)}</h3>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#7263D6] p-3">
              <div>
                <p className="text-sm">{t("kids.calendar.activities")}</p>
                <p className="text-[11px] text-white/85">{isToday(selectedDate) ? t("kids.calendar.todayLower") : t("kids.calendar.onThisDate")}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D9D9D9] text-sm font-bold text-slate-900">
                {selectedDateEvents.length}
              </div>
            </div>
          </div>

          <div className="flex min-h-[320px] flex-col rounded-2xl bg-kids-violet p-5 text-white shadow-md md:flex-1 xl:min-h-[420px]">
            <span className="w-fit rounded-full bg-[#7263D6] px-10 py-1 text-sm">{t("kids.calendar.agenda")}</span>

            {selectedDateEvents.length > 0 ? (
              <div className="mt-4 space-y-3 overflow-y-auto hide-scrollbar">
                {selectedDateEvents.map((event) => {
                  const badge = getEventBadge(event.event_type);
                  return (
                    <div key={event.id} className="rounded-xl bg-white/15 p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{badge.emoji}</span>
                        {event.event_time && (
                          <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-semibold">{event.event_time}</span>
                        )}
                      </div>
                      <h4 className="mt-2 text-lg font-bold leading-tight">{event.title}</h4>
                      <div className="mt-2 space-y-1 text-sm text-white/90">
                        {event.location && <p>📍 {event.location}</p>}
                        {event.meeting_link && (
                          <a href={`https://${event.meeting_link}`} className="inline-block font-semibold underline-offset-2 hover:underline">
                            {t("kids.calendar.joinMeeting")}
                          </a>
                        )}
                        {event.instructor && <p>👩‍🏫 {event.instructor}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D9D9D9]">
                  <Clock className="h-7 w-7 text-slate-800" />
                </div>
                <p className="mt-4 text-sm">{t("kids.calendar.noSchedule")}</p>
                <p className="mt-1 text-xs text-white/80">{t("kids.calendar.noScheduleDesc")}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </KidsPage>
    </>
  );
}
