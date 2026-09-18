"use client";

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Bot, FileText, History, Loader2, Paperclip, Plus, Send, Trash2, User, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { Topbar } from "@/components/layout/Topbar";
import { KidsTopbar } from "@/components/kids/KidsTopbar";
import { useCurrentLocale, useI18n } from "@/components/translate/client";
import { MAX_AI_CHATS, useAiChats } from "@/hooks/useAiChats";
import { aiFetch } from "@/lib/ai/client";
import type { AiAssistant, AiChatMessage, AiFileRef } from "@/lib/types";
import { AiMarkdown } from "./AiMarkdown";

const MAX_ATTACHMENTS = 3;

type LocalMessage = AiChatMessage & { error?: boolean };

export interface AiChatApi {
  appendModelMessage: (text: string) => void;
}

export interface AiChatProps {
  assistant: AiAssistant;
  variant?: "default" | "kids";
  title: string;
  description: string;
  placeholder: string;
  disclaimer: string;
  errorText: string;
  suggestions: string[];
  // Ubah isi pesan AI sebelum ditampilkan (mis. menghapus marker tombol)
  transformContent?: (content: string) => string;
  // Elemen tambahan di bawah pesan AI (mis. tombol "Bantu nilai")
  renderMessageExtra?: (content: string) => React.ReactNode;
  // Tombol tambahan di kolom input (mis. voice chat)
  inputAddon?: React.ReactNode;
  apiRef?: React.Ref<AiChatApi>;
  children?: React.ReactNode;
}

const API_PATH: Record<AiAssistant, string> = {
  libra: "/api/LibraAI",
  scorpio: "/api/ScorpioAI",
};

export function AiChat({
  assistant,
  variant = "default",
  title,
  description,
  placeholder,
  disclaimer,
  errorText,
  suggestions,
  transformContent = (c) => c,
  renderMessageExtra,
  inputAddon,
  apiRef,
  children,
}: AiChatProps) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const params = useParams();
  const uid = params?.id as string | undefined;
  const kids = variant === "kids";
  const chats = useAiChats(assistant, uid);

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<AiFileRef[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<AiFileRef[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmNew, setConfirmNew] = useState<{ pendingText?: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialized = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHistory) return;
    const onClick = (e: MouseEvent) => {
      if (!historyRef.current?.contains(e.target as Node)) setShowHistory(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowHistory(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showHistory]);

  // Tampilkan chat terakhir sekali setelah riwayat selesai dimuat
  useEffect(() => {
    if (chats.loading || initialized.current) return;
    initialized.current = true;
    setMessages(chats.activeSession?.messages ?? []);
  }, [chats.loading, chats.activeSession]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Daftar file Storage yang boleh dilampirkan (sudah difilter server sesuai role)
  useEffect(() => {
    if (!uid) return;
    aiFetch(API_PATH[assistant])
      .then(res => res.json())
      .then(json => json.success && setFiles(json.data.files))
      .catch(e => console.warn("Gagal memuat daftar file AI:", e));
  }, [assistant, uid]);

  // Tinggi textarea mengikuti isi
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const messagesRef = useRef<LocalMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const { saveMessages } = chats;

  const appendModelMessage = useCallback((text: string) => {
    const next = [
      ...messagesRef.current.filter(m => !m.error),
      { role: "model" as const, content: text, created_at: new Date().toISOString() },
    ];
    setMessages(next);
    saveMessages(next);
  }, [saveMessages]);

  useImperativeHandle(apiRef, () => ({ appendModelMessage }), [appendModelMessage]);

  const send = async (rawText: string, { skipFullCheck = false, base = messages }: { skipFullCheck?: boolean; base?: LocalMessage[] } = {}) => {
    const text = rawText.trim();
    if (!text || isLoading) return;

    // Chat kosong + riwayat sudah 5 → minta persetujuan hapus chat terlama dulu
    if (!skipFullCheck && !chats.activeId && chats.isFull) {
      setConfirmNew({ pendingText: text });
      return;
    }

    const attachments = selectedFiles;
    const history = base.filter(m => !m.error).map(m => ({ role: m.role, content: m.content }));
    const userMessage: LocalMessage = {
      role: "user",
      content: text,
      ...(attachments.length ? { files: attachments.map(f => f.name) } : {}),
      created_at: new Date().toISOString(),
    };
    const withUser = [...base.filter(m => !m.error), userMessage];

    setMessages(withUser);
    setInput("");
    setSelectedFiles([]);
    setShowPicker(false);
    setIsLoading(true);
    chats.saveMessages(withUser);

    try {
      const res = await aiFetch(API_PATH[assistant], {
        method: "POST",
        body: JSON.stringify({ message: text, history, fileIds: attachments.map(f => f.id), locale }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || res.statusText);

      const reply: LocalMessage = { role: "model", content: json.data.text, created_at: new Date().toISOString() };
      const withReply = [...withUser, reply];
      setMessages(withReply);
      chats.saveMessages(withReply);
    } catch (e) {
      console.error(`${assistant} gagal menjawab:`, e);
      setMessages([...withUser, { role: "model", content: errorText, created_at: new Date().toISOString(), error: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const openChat = (id: string) => {
    const session = chats.sessions.find(s => s.id === id);
    if (!session || isLoading) return;
    chats.selectChat(id);
    setMessages(session.messages);
    setShowHistory(false);
  };

  const requestNewChat = () => {
    if (isLoading) return;
    setShowHistory(false);
    if (chats.isFull) {
      setConfirmNew({});
      return;
    }
    chats.selectChat(null);
    setMessages([]);
  };

  const confirmNewChat = async () => {
    const pending = confirmNew?.pendingText;
    setConfirmNew(null);
    await chats.startNewChat();
    setMessages([]);
    if (pending) send(pending, { skipFullCheck: true, base: [] });
  };

  const removeChat = async (id: string, chatTitle: string) => {
    if (isLoading || !confirm(t("aiChat.deleteConfirm", { title: chatTitle }))) return;
    const wasActive = chats.activeId === id;
    await chats.deleteChat(id);
    if (wasActive) setMessages([]);
  };

  const toggleFile = (file: AiFileRef) => {
    setSelectedFiles(prev => prev.some(f => f.id === file.id)
      ? prev.filter(f => f.id !== file.id)
      : prev.length >= MAX_ATTACHMENTS ? prev : [...prev, file]);
  };

  const timeAgo = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: locale === "en" ? enUS : idLocale });
    } catch {
      return "";
    }
  };

  const oldest = chats.evictionCandidates[0];

  // ---------- Styles ----------
  const s = kids ? {
    page: "bg-kids-cream",
    activeItem: "border-kids-coral bg-kids-coral/10",
    item: "border-transparent hover:bg-kids-cream",
    newButton: "bg-kids-coral text-white hover:brightness-105",
    chip: "border-2 border-amber-200 bg-white text-kids-ink hover:border-kids-coral",
    userBubble: "rounded-2xl rounded-br-md bg-kids-coral font-medium text-white",
    aiBubble: "rounded-2xl rounded-bl-md border-2 border-amber-200 bg-white text-slate-800",
    errorBubble: "rounded-2xl rounded-bl-md border-2 border-red-200 bg-red-50 text-red-700",
    inputBox: "bg-kids-pink focus-within:ring-kids-coral/30",
    textarea: "text-white placeholder:text-white",
    iconButton: "text-white hover:bg-white/25",
    sendButton: "bg-kids-coral disabled:bg-white/30",
    muted: "text-kids-ink/60",
    dot: "bg-kids-coral",
  } : {
    page: "bg-[#F1F5FF] dark:bg-edu-navy",
    activeItem: "border-edu-blue bg-edu-blue/10 dark:bg-white/10",
    item: "border-transparent hover:bg-slate-100 dark:hover:bg-white/5",
    newButton: "bg-edu-blue text-white hover:bg-edu-blue-deep",
    chip: "border border-slate-200 bg-white text-slate-700 hover:border-edu-blue hover:text-edu-blue dark:border-white/10 dark:bg-edu-night dark:text-slate-200",
    userBubble: "rounded-2xl rounded-br-sm bg-edu-blue text-white shadow-md",
    aiBubble: "rounded-2xl rounded-bl-sm border border-slate-200 bg-white text-slate-800 shadow-lg shadow-slate-200/40 dark:border-white/10 dark:bg-edu-night dark:text-slate-100 dark:shadow-none",
    errorBubble: "rounded-2xl rounded-bl-sm border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
    inputBox: "bg-slate-200 focus-within:ring-edu-blue/30",
    textarea: "text-slate-900 placeholder:text-slate-600",
    iconButton: "text-slate-600 hover:bg-white/70 hover:text-edu-blue",
    sendButton: "bg-edu-blue hover:bg-edu-blue-deep disabled:bg-slate-300 disabled:text-slate-500",
    muted: "text-slate-500 dark:text-white/50",
    dot: "bg-edu-blue dark:bg-sky-300",
  };

  const historyList = (
    <div className="flex max-h-[70vh] flex-col sm:max-h-[28rem]">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className={`text-sm font-bold uppercase tracking-wide ${s.muted}`}>
          {t("aiChat.historyCount", { count: chats.sessions.length, max: MAX_AI_CHATS })}
        </h2>
        <button onClick={() => setShowHistory(false)} className="rounded-lg p-1.5 opacity-60 hover:opacity-100" aria-label={t("common.close")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-3">
        <button onClick={requestNewChat} disabled={isLoading} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${s.newButton}`}>
          <Plus className="h-4 w-4" /> {t("aiChat.newChat")}
        </button>
      </div>
      <div className="mt-3 h-1.5 px-4">
        <div className={`h-full overflow-hidden rounded-full ${kids ? "bg-amber-100" : "bg-slate-200 dark:bg-white/10"}`}>
          <div
            className={`h-full rounded-full transition-all ${chats.isFull ? "bg-amber-500" : kids ? "bg-kids-coral" : "bg-edu-blue"}`}
            style={{ width: `${(chats.sessions.length / MAX_AI_CHATS) * 100}%` }}
          />
        </div>
      </div>
      <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {chats.loading ? (
          <li className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin opacity-60" /></li>
        ) : chats.sessions.length === 0 ? (
          <li className={`px-3 py-6 text-center text-sm ${s.muted}`}>{t("aiChat.emptyHistory")}</li>
        ) : chats.sessions.map(session => (
          <li key={session.id} className={`group flex items-center gap-1 rounded-xl border ${session.id === chats.activeId ? s.activeItem : s.item}`}>
            <button onClick={() => openChat(session.id)} disabled={isLoading} className="min-w-0 flex-1 px-3 py-2.5 text-left">
              <span className="block truncate text-sm font-semibold">{session.title}</span>
              <span className={`block text-xs ${s.muted}`}>
                {t("aiChat.messagesCount", { count: session.messages.length })} · {timeAgo(session.updated_at)}
              </span>
            </button>
            <button
              onClick={() => removeChat(session.id, session.title)}
              className="mr-1 rounded-lg p-2 opacity-60 transition-opacity hover:text-rose-500 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={t("aiChat.deleteChat")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  // Riwayat & chat baru ditaruh di navbar (dropdown), bukan sidebar kedua
  const navActions = (
    <div ref={historyRef} className="relative flex items-center gap-1.5 sm:gap-2">
      <button
        onClick={() => setShowHistory(v => !v)}
        aria-expanded={showHistory}
        title={t("aiChat.historyCount", { count: chats.sessions.length, max: MAX_AI_CHATS })}
        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold ${s.chip}`}
      >
        <History className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{t("aiChat.historyCount", { count: chats.sessions.length, max: MAX_AI_CHATS })}</span>
        <span className="sm:hidden">{chats.sessions.length}/{MAX_AI_CHATS}</span>
      </button>
      <button
        onClick={requestNewChat}
        disabled={isLoading}
        title={t("aiChat.newChat")}
        aria-label={t("aiChat.newChat")}
        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-bold disabled:opacity-50 ${s.newButton}`}
      >
        <Plus className="h-4 w-4 shrink-0" />
        <span className="hidden md:inline">{t("aiChat.newChat")}</span>
      </button>

      {showHistory && (
        <div className={`fixed inset-x-4 top-[76px] z-50 overflow-hidden border shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 ${kids
          ? "rounded-2xl border-2 border-amber-200 bg-white text-kids-ink"
          : "rounded-xl border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-edu-night dark:text-white"}`}
        >
          {historyList}
        </div>
      )}
    </div>
  );

  const avatar = (role: "user" | "model") => kids ? (
    <div className={`mt-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm sm:h-12 sm:w-12 sm:text-3xl ${role === "user" ? "bg-kids-pink" : "bg-kids-sun"}`}>
      {role === "user" ? "🧑‍🎓" : assistant === "libra" ? "🤖" : "🦂"}
    </div>
  ) : (
    <div className={`mt-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm md:h-10 md:w-10 ${role === "user" ? "bg-slate-200 text-slate-700" : "bg-gradient-to-br from-edu-indigo to-edu-purple text-white"}`}>
      {role === "user" ? <User className="h-4 w-4 md:h-5 md:w-5" /> : <Bot className="h-4 w-4 md:h-5 md:w-5" />}
    </div>
  );

  return (
    <div className={`relative flex h-full min-h-0 flex-col overflow-hidden font-sans ${s.page}`}>
      {kids ? <KidsTopbar actions={navActions} /> : <Topbar actions={navActions} />}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Pesan */}
          <div className="z-10 flex-1 overflow-y-auto scroll-smooth px-4 py-6 hide-scrollbar lg:px-8">
            <div className="mx-auto max-w-4xl space-y-6 pb-4">
              {messages.length === 0 && !chats.loading && (
                <div className="flex min-h-[40vh] flex-col items-center justify-center space-y-4 text-center">
                  {kids && <div className="text-7xl animate-float sm:text-8xl">{assistant === "libra" ? "🤖" : "🦂"}</div>}
                  <div>
                    <h3 className={`text-2xl sm:text-3xl ${kids ? "font-semibold text-black" : "font-medium text-slate-900 dark:text-white"}`}>{title}</h3>
                    <p className={`mx-auto mt-2 max-w-xl text-base sm:text-xl ${kids ? "text-black" : "text-slate-600 dark:text-white/80"}`}>{description}</p>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="flex max-w-3xl flex-wrap justify-center gap-2 pt-2">
                      {suggestions.map(q => (
                        <button key={q} onClick={() => send(q)} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${s.chip}`}>
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={`${msg.created_at}-${i}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[92%] gap-2 sm:gap-3 md:max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    {avatar(msg.role)}
                    <div className={`min-w-0 px-4 py-3 text-[15px] leading-relaxed sm:px-5 sm:py-4 ${msg.role === "user" ? s.userBubble : msg.error ? s.errorBubble : s.aiBubble}`}>
                      {msg.files && msg.files.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {msg.files.map(name => (
                            <span key={name} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-semibold">
                              <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      ) : msg.error ? (
                        <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {msg.content}</p>
                      ) : (
                        <>
                          <AiMarkdown variant={variant}>{transformContent(msg.content)}</AiMarkdown>
                          {renderMessageExtra?.(msg.content)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-end gap-3">
                    {avatar("model")}
                    <div className={`flex items-center gap-1.5 px-5 py-4 ${s.aiBubble}`}>
                      {[0, 150, 300].map(delay => (
                        <span key={delay} className={`h-2 w-2 animate-bounce rounded-full ${s.dot}`} style={{ animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} className="h-4" />
            </div>
          </div>

          {/* Input */}
          <div className="z-20 px-4 pb-5 pt-2 lg:px-8 lg:pb-8">
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="relative mx-auto max-w-5xl">
              {showPicker && (
                <div className={`absolute bottom-full left-0 right-0 mb-2 max-h-80 overflow-y-auto p-3 shadow-2xl sm:right-auto sm:w-[26rem] ${kids ? "rounded-2xl border-2 border-amber-200 bg-white text-kids-ink" : "rounded-xl border border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-edu-night dark:text-white"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-bold">{t("aiChat.attachTitle")}</p>
                    <button type="button" onClick={() => setShowPicker(false)} className="rounded-lg p-1 opacity-60 hover:opacity-100" aria-label={t("common.close")}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className={`mb-2 text-xs ${s.muted}`}>{t("aiChat.attachHint", { max: MAX_ATTACHMENTS })}</p>
                  {files.length === 0 ? (
                    <p className={`py-4 text-center text-sm ${s.muted}`}>{t("aiChat.noFiles")}</p>
                  ) : (["class_materi", "assignment_materi", "submission"] as const).map(kind => {
                    const group = files.filter(f => f.kind === kind);
                    if (group.length === 0) return null;
                    return (
                      <div key={kind} className="mb-2">
                        <p className={`px-1 py-1 text-xs font-bold uppercase tracking-wide ${s.muted}`}>{t(`aiChat.kind.${kind}` as "aiChat.kind.class_materi")}</p>
                        {group.map(file => {
                          const checked = selectedFiles.some(f => f.id === file.id);
                          const disabled = !checked && selectedFiles.length >= MAX_ATTACHMENTS;
                          return (
                            <label key={file.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${disabled ? "opacity-40" : kids ? "hover:bg-kids-cream" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}>
                              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleFile(file)} className="h-4 w-4 shrink-0 accent-current" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{file.name}</span>
                                <span className={`block truncate text-xs ${s.muted}`}>{file.label}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedFiles.map(file => (
                    <span key={file.id} className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${s.chip}`}>
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <button type="button" onClick={() => toggleFile(file)} aria-label={t("aiChat.removeFile")}><X className="h-3.5 w-3.5" /></button>
                    </span>
                  ))}
                </div>
              )}

              <div className={`flex items-end gap-1 rounded-xl p-2 shadow-lg transition-all focus-within:ring-4 sm:gap-2 sm:p-3 ${s.inputBox}`}>
                <button
                  type="button"
                  onClick={() => setShowPicker(v => !v)}
                  aria-label={t("aiChat.attach")}
                  title={t("aiChat.attach")}
                  className={`relative shrink-0 rounded-lg p-2.5 transition-colors ${s.iconButton}`}
                >
                  <Paperclip className="h-5 w-5" />
                  {selectedFiles.length > 0 && (
                    <span className={`absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${kids ? "bg-kids-coral" : "bg-edu-blue"}`}>
                      {selectedFiles.length}
                    </span>
                  )}
                </button>
                {inputAddon}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder={placeholder}
                  className={`max-h-40 w-full resize-none border-none bg-transparent px-2 py-2.5 text-base outline-none focus:ring-0 hide-scrollbar sm:text-xl ${s.textarea}`}
                  rows={1}
                />
                <button
                  type="submit"
                  aria-label={t("aiChat.send")}
                  disabled={!input.trim() || isLoading}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md transition-all active:scale-95 disabled:shadow-none sm:h-12 sm:w-12 ${s.sendButton}`}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="ml-0.5 h-5 w-5" />}
                </button>
              </div>
              <p className={`mt-2 text-center text-xs font-medium ${s.muted}`}>{disclaimer}</p>
            </form>
          </div>
        </div>
      </div>

      {/* Modal: riwayat penuh → chat terlama akan dihapus */}
      {confirmNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmNew(null)} />
          <div className={`relative w-full max-w-md p-6 shadow-2xl animate-pop ${kids ? "rounded-3xl border-4 border-amber-200 bg-white text-kids-ink" : "rounded-2xl bg-white text-slate-900 dark:bg-edu-night dark:text-white"}`}>
            <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${kids ? "bg-kids-sun/30 text-3xl" : "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"}`}>
              {kids ? "🧹" : <AlertTriangle className="h-7 w-7" />}
            </div>
            <h3 className="text-center text-lg font-bold">{t(kids ? "kids.aiChat.fullTitle" : "aiChat.fullTitle")}</h3>
            <p className={`mt-2 text-center text-sm ${kids ? "text-kids-ink/80" : "text-slate-600 dark:text-white/70"}`}>
              {t(kids ? "kids.aiChat.fullDesc" : "aiChat.fullDesc", { max: MAX_AI_CHATS, title: oldest?.title ?? "-" })}
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirmNew(null)} className={`flex-1 rounded-xl px-4 py-3 font-semibold ${kids ? "border-2 border-amber-200 hover:bg-kids-cream" : "border border-slate-200 hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5"}`}>
                {t("common.cancel")}
              </button>
              <button onClick={confirmNewChat} className={`flex-1 rounded-xl px-4 py-3 font-bold text-white ${kids ? "bg-kids-coral hover:brightness-105" : "bg-amber-500 hover:bg-amber-600"}`}>
                {t(kids ? "kids.aiChat.fullConfirm" : "aiChat.fullConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
