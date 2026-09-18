"use client";

import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { useCurrentLocale, useI18n } from "./client";

// Locale-aware formatting helpers so dates, numbers, and labels follow the active language.

export function useDateFormat() {
  const isEn = useCurrentLocale() === "en";
  const locale = isEn ? enUS : idLocale;
  return {
    locale,
    /** e.g. "Jul 30" / "30 Jul" */
    short: (date: Date | string | number) => format(new Date(date), isEn ? "MMM d" : "d MMM", { locale }),
    /** e.g. "September 21st, 2026" / "21 September 2026" */
    long: (date: Date | string | number) => format(new Date(date), "PPP", { locale }),
    /** e.g. "Monday, September 14th, 2026" / "Senin, 14 September 2026" */
    full: (date: Date | string | number) => format(new Date(date), "PPPP", { locale }),
    /** e.g. "Sep 14, 2026, 1:00 PM" / "14 Sep 2026, 13.00" */
    dateTime: (date: Date | string | number) => format(new Date(date), "PPp", { locale }),
    pattern: (date: Date | string | number, pattern: string) => format(new Date(date), pattern, { locale }),
  };
}

export function useLocaleTag() {
  return useCurrentLocale() === "en" ? "en-US" : "id-ID";
}

export function useClassLabel() {
  const t = useI18n();
  return (level: number) => {
    if (level >= 1 && level <= 6) return t("classLevel.elementary", { grade: level });
    if (level >= 7 && level <= 9) return t("classLevel.junior", { grade: level - 6 });
    if (level >= 10 && level <= 12) return t("classLevel.senior", { grade: level - 9 });
    return t("classLevel.generic", { grade: level });
  };
}

export function useMeetingStatusLabel() {
  const t = useI18n();
  return (status?: string) => {
    switch ((status || "upcoming").toLowerCase()) {
      case "upcoming":
      case "scheduled":
        return t("common.meetingStatus.upcoming");
      case "live":
      case "ongoing":
        return t("common.meetingStatus.live");
      case "ended":
      case "completed":
      case "finished":
        return t("common.meetingStatus.ended");
      default:
        return status as string;
    }
  };
}

export function useStatusLabel() {
  const t = useI18n();
  return (status: string) => {
    switch (status) {
      case "active": return t("status.active");
      case "started": return t("status.started");
      case "submitted": return t("status.submitted");
      case "overdue": return t("status.overdue");
      case "graded": return t("status.graded");
      default: return status;
    }
  };
}

export function useRoleLabel() {
  const t = useI18n();
  return (role?: string) => {
    if (role === "teacher") return t("roles.teacher");
    if (role === "student") return t("roles.student");
    return t("roles.guest");
  };
}
