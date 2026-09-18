"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Hand, MicOff, MonitorOff, MonitorUp, Send, Star, Video, VolumeX, X } from "lucide-react";
import type { MeetingParticipant, MeetingRoomState } from "@/hooks/useMeetingRoom";
import type { MeetingLabelKey, MeetingVariant } from "./labels";

export type SidePanelTab = "people" | "chat";

export function MeetingSidePanel({
  room,
  tab,
  onTab,
  onClose,
  variant,
  label,
  unreadChat,
}: {
  room: MeetingRoomState;
  tab: SidePanelTab;
  onTab: (tab: SidePanelTab) => void;
  onClose: () => void;
  variant: MeetingVariant;
  label: (key: MeetingLabelKey, params?: Record<string, string | number>) => string;
  unreadChat: number;
}) {
  const kids = variant === "kids";
  const everyone: MeetingParticipant[] = [room.self, ...room.participants];
  const raisedHands = everyone.filter(p => p.hand).length;

  const s = kids ? {
    panel: "bg-white text-kids-ink sm:rounded-3xl",
    header: "border-b-2 border-amber-100 bg-kids-cream",
    tabActive: "bg-kids-coral text-white",
    tab: "bg-white text-kids-ink",
    row: "rounded-2xl border-2 border-amber-100 bg-white",
    muted: "text-kids-ink/60",
    action: "bg-kids-cream hover:bg-amber-100 text-kids-ink",
    bubbleMe: "bg-kids-coral text-white",
    bubble: "bg-kids-cream text-kids-ink",
    input: "border-2 border-amber-200 bg-white text-kids-ink placeholder:text-kids-ink/40",
    send: "bg-kids-coral",
  } : {
    panel: "bg-edu-night text-white sm:rounded-2xl",
    header: "border-b border-white/10",
    tabActive: "bg-white text-edu-navy",
    tab: "bg-white/5 text-white/80 hover:bg-white/10",
    row: "rounded-xl border border-white/5 bg-white/[0.03]",
    muted: "text-white/60",
    action: "bg-white/10 hover:bg-white/20 text-white",
    bubbleMe: "bg-edu-blue text-white",
    bubble: "bg-white/10 text-white",
    input: "border border-white/10 bg-white/5 text-white placeholder:text-white/40",
    send: "bg-edu-blue",
  };

  return (
    <div className={`absolute inset-0 z-40 flex w-full flex-col overflow-hidden shadow-2xl sm:relative sm:inset-auto sm:w-80 lg:w-96 ${s.panel}`}>
      <div className={`flex items-center gap-2 p-3 ${s.header}`}>
        <div className="flex flex-1 gap-1.5">
          <button onClick={() => onTab("people")} className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${tab === "people" ? s.tabActive : s.tab}`}>
            {label("people")} ({everyone.length})
          </button>
          <button onClick={() => onTab("chat")} className={`relative flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${tab === "chat" ? s.tabActive : s.tab}`}>
            {label("chat")}
            {unreadChat > 0 && tab !== "chat" && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] text-white">{unreadChat}</span>
            )}
          </button>
        </div>
        <button onClick={onClose} className="rounded-full p-2 opacity-70 transition-opacity hover:opacity-100" aria-label={label("close")}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {tab === "people" ? (
        <div className="flex-1 space-y-2 overflow-y-auto p-3 hide-scrollbar">
          {room.isTeacher && (
            <div className="flex gap-2 pb-1">
              <button onClick={room.muteAll} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${s.action}`}>
                <VolumeX className="h-4 w-4" /> {label("muteAll")}
              </button>
              <button onClick={room.lowerAllHands} disabled={raisedHands === 0} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-40 ${s.action}`}>
                <Hand className="h-4 w-4" /> {label("lowerAllHands")}
              </button>
            </div>
          )}

          {room.isTeacher && room.pendingShareRequests.map(r => (
            <div key={r.uid} className="rounded-xl border border-amber-300/60 bg-amber-400/15 p-3">
              <p className="text-sm font-semibold">{label("shareRequestTitle", { name: r.name })}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => room.respondShareRequest(r.uid, false)} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold ${s.action}`}>{label("deny")}</button>
                <button onClick={() => room.respondShareRequest(r.uid, true)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">
                  <Check className="h-3.5 w-3.5" /> {label("approve")}
                </button>
              </div>
            </div>
          ))}

          {everyone.map(p => {
            const isSharing = room.screenShare?.uid === p.uid;
            return (
              <div key={p.uid} className={`flex items-center gap-3 p-2.5 ${s.row}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {p.hand && <span className="mr-1">✋</span>}
                    {p.name}{p.isMe && ` (${label("you")})`}
                  </p>
                  <p className={`flex items-center gap-2 text-xs ${s.muted}`}>
                    <span>{p.role === "teacher" ? label("teacher") : label("student")}</span>
                    {(p.stars ?? 0) > 0 && <span>⭐ {p.stars}</span>}
                    {isSharing && <MonitorUp className="h-3.5 w-3.5 text-sky-400" />}
                    {p.camera && <Video className="h-3.5 w-3.5" />}
                    {p.mute && <MicOff className="h-3.5 w-3.5 text-rose-400" />}
                  </p>
                </div>
                {room.isTeacher && !p.isMe && (
                  <div className="flex shrink-0 gap-1">
                    {p.hand && (
                      <button onClick={() => room.lowerHand(p.uid)} title={label("lowerHand")} className={`rounded-lg p-2 ${s.action}`}>
                        <Hand className="h-4 w-4" />
                      </button>
                    )}
                    {isSharing && (
                      <button onClick={room.stopOthersShare} title={label("stopTheirShare")} className={`rounded-lg p-2 ${s.action}`}>
                        <MonitorOff className="h-4 w-4" />
                      </button>
                    )}
                    {p.role === "student" && (
                      <button onClick={() => room.giveStar(p.uid)} title={label("giveStar")} className="rounded-lg bg-amber-400 p-2 text-amber-950 hover:bg-amber-300">
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <ChatTab room={room} label={label} s={s} />
      )}
    </div>
  );
}

function ChatTab({ room, label, s }: {
  room: MeetingRoomState;
  label: (key: MeetingLabelKey, params?: Record<string, string | number>) => string;
  s: Record<string, string>;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room.messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    room.sendMessage(text);
    setText("");
  };

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 hide-scrollbar">
        {room.messages.length === 0 && (
          <p className={`py-10 text-center text-sm ${s.muted}`}>{label("chatEmpty")}</p>
        )}
        {room.messages.map(m => {
          const mine = m.uid === room.self.uid;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && (
                <span className={`mb-0.5 px-1 text-xs font-semibold ${s.muted}`}>
                  {m.name}{m.role === "teacher" && ` · ${label("teacher")}`}
                </span>
              )}
              <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${mine ? s.bubbleMe : s.bubble}`}>{m.text}</p>
              <span className={`mt-0.5 px-1 text-[10px] ${s.muted}`}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={label("chatPlaceholder")}
          className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-400/40 ${s.input}`}
        />
        <button type="submit" disabled={!text.trim()} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40 ${s.send}`} aria-label={label("send")}>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  );
}
