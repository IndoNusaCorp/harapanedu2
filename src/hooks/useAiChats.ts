"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { connecttofirestore } from "@/lib/firebase";
import type { AiAssistant, AiChatMessage, AiChatSession } from "@/lib/types";

// ============================================
// Riwayat chat LibraAI / ScorpioAI di Firestore (koleksi "ai_chats")
// ============================================
// Setiap user menyimpan maksimal 5 chat per asisten. Saat membuat chat baru dan riwayat sudah penuh,
// halaman menampilkan modal konfirmasi dulu, lalu chat yang paling lama tidak dipakai dihapus otomatis.

export const MAX_AI_CHATS = 5;
const MAX_MESSAGES_PER_CHAT = 100;
const TITLE_LENGTH = 60;

const byUpdatedDesc = (a: AiChatSession, b: AiChatSession) => b.updated_at.localeCompare(a.updated_at);

// Chat yang harus dihapus supaya tersisa tempat untuk 1 chat baru
export function chatsToEvict(sessions: AiChatSession[], max = MAX_AI_CHATS): AiChatSession[] {
  const excess = sessions.length - (max - 1);
  if (excess <= 0) return [];
  return [...sessions].sort(byUpdatedDesc).slice(-excess);
}

export function chatTitle(firstMessage: string) {
  const clean = firstMessage.replace(/\s+/g, " ").trim();
  return clean.length > TITLE_LENGTH ? `${clean.slice(0, TITLE_LENGTH - 1)}…` : clean;
}

export function useAiChats(assistant: AiAssistant, uid: string | undefined) {
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeIdRef = useRef<string | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const selectChat = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);
    // Filter assistant & urutkan di client supaya tidak butuh composite index Firestore
    getDocs(query(collection(connecttofirestore, "ai_chats"), where("user_id", "==", uid)))
      .then(snap => {
        if (cancelled) return;
        const list = snap.docs
          .map(d => ({ ...d.data(), id: d.id } as AiChatSession))
          .filter(s => s.assistant === assistant)
          .sort(byUpdatedDesc);
        setSessions(list);
        // Buka chat terakhir supaya user tidak tanpa sengaja membuat chat ke-6
        selectChat(list[0]?.id ?? null);
      })
      .catch(e => console.error("Gagal memuat riwayat chat:", e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [uid, assistant, selectChat]);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeId) ?? null, [sessions, activeId]);
  const isFull = sessions.length >= MAX_AI_CHATS;
  const evictionCandidates = useMemo(() => chatsToEvict(sessions), [sessions]);

  const deleteChat = useCallback(async (id: string) => {
    await deleteDoc(doc(connecttofirestore, "ai_chats", id));
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeIdRef.current === id) selectChat(null);
  }, [selectChat]);

  // Dipanggil setelah user menyetujui modal: hapus chat terlama, lalu buka chat kosong
  const startNewChat = useCallback(async () => {
    for (const s of chatsToEvict(sessions)) {
      await deleteChat(s.id);
    }
    selectChat(null);
  }, [sessions, deleteChat, selectChat]);

  // Simpan seluruh isi chat aktif. Chat baru baru dibuat di Firestore saat pesan pertama dikirim.
  const persist = useCallback(async (messages: AiChatMessage[]) => {
    if (!uid || messages.length === 0) return;
    const now = new Date().toISOString();
    const trimmed = messages.slice(-MAX_MESSAGES_PER_CHAT);
    const currentId = activeIdRef.current;

    if (!currentId) {
      const firstUser = messages.find(m => m.role === "user");
      const session: Omit<AiChatSession, "id"> = {
        user_id: uid,
        assistant,
        title: chatTitle(firstUser?.content || "Chat"),
        messages: trimmed,
        created_at: now,
        updated_at: now,
      };
      const ref = await addDoc(collection(connecttofirestore, "ai_chats"), session);
      selectChat(ref.id);
      setSessions(prev => [{ ...session, id: ref.id }, ...prev]);
      return;
    }

    await updateDoc(doc(connecttofirestore, "ai_chats", currentId), { messages: trimmed, updated_at: now });
    setSessions(prev => prev
      .map(s => s.id === currentId ? { ...s, messages: trimmed, updated_at: now } : s)
      .sort(byUpdatedDesc));
  }, [uid, assistant, selectChat]);

  // Simpanan dijalankan berurutan supaya pesan pertama & balasan AI tidak membuat 2 dokumen chat
  const saveMessages = useCallback((messages: AiChatMessage[]) => {
    saveQueue.current = saveQueue.current
      .then(() => persist(messages))
      .catch(e => console.error("Gagal menyimpan chat:", e));
    return saveQueue.current;
  }, [persist]);

  return {
    sessions,
    activeId,
    activeSession,
    loading,
    isFull,
    evictionCandidates,
    selectChat,
    deleteChat,
    startNewChat,
    saveMessages,
  };
}
