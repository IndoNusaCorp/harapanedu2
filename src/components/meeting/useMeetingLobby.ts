"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { connecttofirestore } from "@/lib/firebase";
import { useRole } from "@/context/RoleContext";
import type { Meeting } from "@/lib/types";
import type { MeetingExitReason } from "@/hooks/useMeetingRoom";

export function isMeetingLive(m: Meeting) {
  return m.status === "live" && !m.isEnded;
}

// Data & aksi halaman daftar meeting (dipakai tampilan umum dan kids mode)
export function useMeetingLobby() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const uid = params?.id as string;
  const { role } = useRole();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [exitReason, setExitReason] = useState<MeetingExitReason | null>(null);

  useEffect(() => {
    const q = query(collection(connecttofirestore, "meetings"), orderBy("created_at", "desc"));
    return onSnapshot(q, (snap) => {
      setMeetings(snap.docs.map(d => ({ ...d.data(), id: d.id } as Meeting)));
      setLoading(false);
    }, (e) => {
      console.error("Gagal memuat meeting:", e);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(connecttofirestore, "users", uid)).then(snap => {
      const data = snap.data();
      setName(`${data?.first_name || ""} ${data?.last_name || ""}`.trim() || data?.username || data?.name || "User");
    }).catch(() => setName("User"));
  }, [uid]);

  const join = useCallback((meeting: Meeting) => {
    setExitReason(null);
    if (role !== "teacher" && meeting.isEnded) {
      setExitReason("notStarted");
      return;
    }
    setActiveMeeting(meeting);
  }, [role]);

  // Dari notifikasi "meeting dimulai": /meetings?join=<id>
  const joinParam = searchParams.get("join");
  useEffect(() => {
    if (!joinParam || loading || !name) return;
    const target = meetings.find(m => m.id === joinParam);
    router.replace(pathname);
    if (target) join(target);
  }, [joinParam, loading, name, meetings, join, router, pathname]);

  const onExit = useCallback((reason: MeetingExitReason) => {
    setActiveMeeting(null);
    setExitReason(reason === "left" ? null : reason);
  }, []);

  return {
    uid,
    role,
    name,
    meetings,
    loading,
    activeMeeting,
    exitReason,
    dismissExit: () => setExitReason(null),
    join,
    onExit,
  };
}
