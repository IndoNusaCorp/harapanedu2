"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { X } from "lucide-react";
import { connecttofirestore } from "@/lib/firebase";
import { markNotificationsRead } from "@/lib/api";
import { useRole } from "@/context/RoleContext";
import { useI18n } from "@/components/translate/client";
import { ViewMateriModal } from "@/components/modals/ViewMateriModal";
import type { AppNotification } from "@/lib/types";

const MAX_NOTIFICATIONS = 30;
const TOAST_MS = 6000;

type BrowserPermission = NotificationPermission | "unsupported";

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isUnread: (n: AppNotification) => boolean;
  markAllRead: () => void;
  open: (n: AppNotification) => void;
  openProof: (n: AppNotification) => void;
  browserPermission: BrowserPermission;
  enableBrowserNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Notifikasi hanya untuk audiens yang sesuai role, dan bukan buatan user itu sendiri
export function isForUser(n: AppNotification, uid: string, role: "teacher" | "student") {
  // Notifikasi pribadi (mis. nilai) hanya untuk penerimanya, termasuk konfirmasi ke guru itu sendiri
  if (n.recipient_id) return n.recipient_id === uid && (n.audience === "all" || n.audience === role);
  if (n.created_by === uid) return false;
  return n.audience === "all" || n.audience === role;
}

export function notificationPath(n: AppNotification, basePath: string) {
  switch (n.type) {
    case "class":
    case "attendance_taken":
      return `${basePath}/my-classes`;
    case "attendance_present":
    case "attendance_absent":
      return `${basePath}/my-work`;
    case "assignment": return `${basePath}/assignment/${n.ref_id}`;
    case "meeting_live": return `${basePath}/meetings?join=${n.ref_id}`;
    case "grade_given":
    case "grade_received":
      return n.assignment_id ? `${basePath}/assignment/${n.assignment_id}` : `${basePath}/grades`;
    default: return `${basePath}/meetings`;
  }
}

type Translate = ReturnType<typeof useI18n>;

// Judul & isi yang ditampilkan; notifikasi nilai disusun dari datanya supaya ikut bahasa user
export function notificationText(n: AppNotification, t: Translate): { title: string; body?: string } {
  const vars = { course: n.course_name || n.title, student: n.student_name || "-", score: String(n.score ?? "-") };
  if (n.type === "grade_given") return { title: t("notifications.gradeGiven", vars) };
  if (n.type === "grade_received") return { title: t("notifications.gradeReceived", vars) };
  if (n.type === "attendance_taken") return { title: t("notifications.attendanceTaken"), body: n.course_name || n.title };
  if (n.type === "attendance_present") return { title: t("notifications.attendancePresent", vars), body: n.course_name || n.title };
  if (n.type === "attendance_absent") {
    // Details kosong → pakai jenis ketidakhadiran (izin / tanpa keterangan) sebagai alasan
    const reason = n.reason || (n.attendance_status === "Absence" ? t("notifications.absenceUnexcused") : t("notifications.absenceExcused"));
    return { title: t("notifications.attendanceAbsent", { ...vars, reason }), body: n.course_name || n.title };
  }
  return { title: n.title, body: n.body };
}

export function NotificationProvider({ uid, basePath, children }: {
  uid: string;
  basePath: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = useI18n();
  const { role, isKidsMode } = useRole();
  const [all, setAll] = useState<AppNotification[]>([]);
  const [readAt, setReadAt] = useState<string>("");
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [browserPermission, setBrowserPermission] = useState<BrowserPermission>("unsupported");
  const mountedAt = useRef(new Date().toISOString());
  const seenIds = useRef<Set<string>>(new Set());
  // Bukti ketidakhadiran yang sedang dibuka di viewer materi
  const [proof, setProof] = useState<AppNotification | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  // Kapan terakhir user membuka daftar notifikasi
  useEffect(() => {
    return onSnapshot(doc(connecttofirestore, "users", uid), (snap) => {
      setReadAt(snap.data()?.notifications_read_at || "");
    }, (err) => console.warn("Notifikasi: gagal membaca status baca", err));
  }, [uid]);

  useEffect(() => {
    const q = query(collection(connecttofirestore, "notifications"), orderBy("created_at", "desc"), limit(MAX_NOTIFICATIONS));
    return onSnapshot(q, (snap) => {
      setAll(snap.docs.map(d => ({ ...d.data(), id: d.id } as AppNotification)));
    }, (err) => console.warn("Notifikasi: listener gagal", err));
  }, []);

  const notifications = useMemo(() => all.filter(n => isForUser(n, uid, role)), [all, uid, role]);

  // Notifikasi yang masuk setelah halaman dibuka → toast + notifikasi browser
  useEffect(() => {
    const fresh = notifications.filter(n => n.created_at > mountedAt.current && !seenIds.current.has(n.id));
    notifications.forEach(n => seenIds.current.add(n.id));
    if (fresh.length === 0) return;

    setToasts(prev => [...fresh, ...prev].slice(0, 3));
    fresh.forEach(n => {
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== n.id)), TOAST_MS);
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        const title = t(`notifications.type.${n.type}` as "notifications.type.class");
        const browserNotif = new Notification(title, { body: notificationText(n, t).title, icon: "/favicon.ico", tag: n.id });
        browserNotif.onclick = () => {
          window.focus();
          router.push(notificationPath(n, basePath));
        };
      }
    });
  }, [notifications, basePath, router, t]);

  const isUnread = useCallback((n: AppNotification) => !readAt || n.created_at > readAt, [readAt]);
  const unreadCount = notifications.filter(isUnread).length;

  const markAllRead = useCallback(() => {
    if (unreadCount === 0) return;
    setReadAt(new Date().toISOString());
    markNotificationsRead();
  }, [unreadCount]);

  const open = useCallback((n: AppNotification) => {
    setToasts(prev => prev.filter(x => x.id !== n.id));
    router.push(notificationPath(n, basePath));
  }, [router, basePath]);

  const openProof = useCallback((n: AppNotification) => {
    setToasts(prev => prev.filter(x => x.id !== n.id));
    setProof(n);
  }, []);

  const enableBrowserNotifications = useCallback(() => {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then(setBrowserPermission);
  }, []);

  const value = { notifications, unreadCount, isUnread, markAllRead, open, openProof, browserPermission, enableBrowserNotifications };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ViewMateriModal
        isOpen={!!proof}
        onClose={() => setProof(null)}
        materiUrl={proof?.proof_url || null}
        materiName={proof ? `${t("notifications.proofTitle")} · ${proof.student_name || "-"}` : null}
      />
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 top-20 z-[70] flex flex-col items-end gap-3 sm:left-auto sm:right-6 sm:w-96">
        {toasts.map(n => {
          const text = notificationText(n, t);
          return (
          <div
            key={n.id}
            className={`pointer-events-auto flex w-full items-start gap-3 p-4 shadow-2xl animate-toast-in ${isKidsMode
              ? "rounded-2xl border-2 border-amber-200 bg-white text-kids-ink"
              : "rounded-xl border border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-edu-night dark:text-white"}`}
          >
            <button onClick={() => open(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
              <span className="text-2xl leading-none">{NOTIFICATION_EMOJI[n.type]}</span>
              <span className="min-w-0">
                <span className={`block text-xs font-bold uppercase tracking-wide ${isKidsMode ? "text-kids-coral" : "text-edu-blue dark:text-sky-300"}`}>
                  {t(`notifications.type.${n.type}` as "notifications.type.class")}
                </span>
                <span className={`block font-semibold ${text.body && n.type !== "attendance_absent" ? "truncate" : "break-words"}`}>{text.title}</span>
                {text.body && <span className="block truncate text-sm opacity-70">{text.body}</span>}
              </span>
            </button>
            <ProofLink n={n} />
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== n.id))}
              className="rounded-lg p-1 opacity-60 hover:opacity-100"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export const NOTIFICATION_EMOJI: Record<AppNotification["type"], string> = {
  class: "🏫",
  assignment: "📝",
  meeting: "📅",
  meeting_live: "🔴",
  grade_given: "✅",
  grade_received: "🏅",
  attendance_taken: "🙋",
  attendance_present: "🙋",
  attendance_absent: "🚫",
};

// Tombol bukti (proof) dari form Take Attendance siswa, dibuka di viewer materi HarapanEdu
export function ProofLink({ n, className = "", onOpen }: { n: AppNotification; className?: string; onOpen?: () => void }) {
  const t = useI18n();
  const ctx = useContext(NotificationContext);
  if (!n.proof_url || !ctx) return null;
  return (
    <button
      type="button"
      onClick={() => { onOpen?.(); ctx.openProof(n); }}
      className={`shrink-0 self-center rounded-lg px-2 py-1 text-xs font-semibold text-edu-blue hover:bg-edu-blue/10 dark:text-sky-300 ${className}`}
    >
      📎 {t("notifications.viewProof")}
    </button>
  );
}

// Boleh null: Topbar juga dirender di luar layout role (mis. saat test)
export function useNotifications() {
  return useContext(NotificationContext);
}
