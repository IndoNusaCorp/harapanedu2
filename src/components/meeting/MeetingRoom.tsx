"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CircleDot, Hand, MessageSquare, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff,
  SmilePlus, Sparkles, Users, Video, VideoOff,
} from "lucide-react";
import { useMeetingRoom, type MeetingExitReason, type MeetingParticipant, type MeetingRole } from "@/hooks/useMeetingRoom";
import { MEETING_EFFECTS } from "@/lib/meeting/cameraEffects";
import type { Meeting } from "@/lib/types";
import { useMeetingLabels, type MeetingLabelKey, type MeetingVariant } from "./labels";
import { ScreenView, VideoTile } from "./VideoTile";
import { ConfettiLayer, ReactionLayer } from "./MeetingOverlays";
import { MeetingSidePanel, type SidePanelTab } from "./MeetingSidePanel";

const REACTIONS = ["👏", "😂", "❤️", "🎉", "😮", "👍", "🤔", "🙌"];
const KIDS_REACTIONS = ["👏", "😂", "❤️", "🎉", "😮", "👍", "🦄", "🌈", "🚀", "🙌"];
const NOTICE_MS = 4500;

function gridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count <= 4) return "grid-cols-1 min-[480px]:grid-cols-2";
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

type Tone = "on" | "off" | "neutral" | "active";

interface ControlButtonProps {
  icon?: React.ElementType;
  labelKey: MeetingLabelKey;
  onClick: () => void;
  tone: Tone;
  badge?: number;
  hideOnMobile?: boolean;
}

function RoomButton({ icon: Icon, labelKey, onClick, tone, badge, hideOnMobile, kids, tones, label }: ControlButtonProps & {
  kids: boolean;
  tones: Record<Tone, string>;
  label: (key: MeetingLabelKey) => string;
}) {
  return (
    <button onClick={onClick} title={label(labelKey)} aria-label={label(labelKey)} className={`${hideOnMobile ? "hidden sm:flex" : "flex"} shrink-0 flex-col items-center gap-1`}>
      <span className={`relative flex items-center justify-center rounded-full transition-all active:scale-95 ${kids ? "h-12 w-12 sm:h-14 sm:w-14" : "h-11 w-11 sm:h-12 sm:w-12"} ${tones[tone]}`}>
        {Icon && <Icon className="h-5 w-5 sm:h-6 sm:w-6" />}
        {!!badge && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{badge}</span>
        )}
      </span>
      <span className={`hidden max-w-20 truncate text-[11px] font-semibold sm:block ${kids ? "" : "text-white/70"}`}>{label(labelKey)}</span>
    </button>
  );
}

export function MeetingRoom({ meeting, uid, role, name, variant, onExit }: {
  meeting: Meeting;
  uid: string;
  role: MeetingRole;
  name: string;
  variant: MeetingVariant;
  onExit: (reason: MeetingExitReason) => void;
}) {
  const L = useMeetingLabels(variant);
  const kids = variant === "kids";
  const room = useMeetingRoom({ meeting, uid, role, name, onExit });

  const [panel, setPanel] = useState<SidePanelTab | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [popover, setPopover] = useState<"reactions" | "effects" | "end" | null>(null);
  const [chatReadAt, setChatReadAt] = useState(() => new Date().toISOString());
  const [clock, setClock] = useState(() => Date.now());
  const [visibleNotice, setVisibleNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!room.notice) return;
    setVisibleNotice(room.notice.kind);
    const timer = setTimeout(() => setVisibleNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [room.notice]);

  // Chat dianggap terbaca selama panel chat terbuka
  useEffect(() => {
    if (panel === "chat") setChatReadAt(new Date().toISOString());
  }, [panel, room.messages.length]);

  const unreadChat = room.messages.filter(m => m.uid !== uid && m.created_at > chatReadAt).length;
  const everyone: MeetingParticipant[] = useMemo(() => [room.self, ...room.participants], [room.self, room.participants]);
  const teacherPresent = room.isTeacher || room.participants.some(p => p.role === "teacher");
  const raisedHands = everyone.filter(p => p.hand).length;
  const pinnedParticipant = pinned ? everyone.find(p => p.uid === pinned) : undefined;
  const streamFor = (p: MeetingParticipant) => (p.isMe ? room.localVideo : room.remoteStreams[p.uid] ?? null);

  const togglePanel = (tab: SidePanelTab) => setPanel(prev => (prev === tab ? null : tab));
  const togglePopover = (name: "reactions" | "effects" | "end") => setPopover(prev => (prev === name ? null : name));

  const tile = (p: MeetingParticipant, opts: { compact?: boolean; big?: boolean } = {}) => (
    <VideoTile
      key={p.uid}
      participant={p}
      stream={streamFor(p)}
      variant={variant}
      label={L}
      compact={opts.compact}
      pinned={opts.big}
      starBurstAt={room.starBursts[p.uid]}
      onPin={() => setPinned(prev => (prev === p.uid ? null : p.uid))}
    />
  );

  // ---------- Stage ----------
  let stage: React.ReactNode;
  if (room.screenShare) {
    const sharer = room.screenShare.uid === uid ? L("youSharing") : L("sharing", { name: room.screenShare.name });
    stage = (
      <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
        <div className="min-h-0 flex-1">
          <ScreenView stream={room.activeScreen} label={sharer} variant={variant} />
        </div>
        <div className="flex shrink-0 gap-3 overflow-x-auto pb-1 hide-scrollbar lg:w-60 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          {everyone.map(p => (
            <div key={p.uid} className="h-28 w-40 shrink-0 lg:h-36 lg:w-full">{tile(p, { compact: true })}</div>
          ))}
        </div>
      </div>
    );
  } else if (pinnedParticipant) {
    stage = (
      <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
        <div className="min-h-0 flex-1">{tile(pinnedParticipant, { big: true })}</div>
        <div className="flex shrink-0 gap-3 overflow-x-auto pb-1 hide-scrollbar lg:w-60 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          {everyone.filter(p => p.uid !== pinned).map(p => (
            <div key={p.uid} className="h-28 w-40 shrink-0 lg:h-36 lg:w-full">{tile(p, { compact: true })}</div>
          ))}
        </div>
      </div>
    );
  } else {
    stage = (
      <div className={`grid h-full auto-rows-fr gap-3 overflow-y-auto hide-scrollbar sm:gap-4 ${gridClass(everyone.length)}`}>
        {everyone.map(p => tile(p))}
      </div>
    );
  }

  // ---------- Theme ----------
  const t = kids ? {
    root: "bg-kids-cream text-kids-ink",
    bar: "border-t-2 border-amber-200 bg-kids-cream",
    top: "border-b-2 border-amber-200",
    on: "bg-kids-coral text-white hover:brightness-105",
    off: "bg-[#C44545] text-white ring-4 ring-red-200",
    neutral: "bg-white text-kids-ink shadow hover:bg-amber-50",
    active: "bg-kids-sun text-white ring-4 ring-amber-200",
    pop: "rounded-3xl border-4 border-amber-200 bg-white text-kids-ink",
    chip: "rounded-full bg-kids-sun px-4 py-1.5 text-sm font-bold text-white",
    banner: "rounded-2xl border-2 border-amber-200 bg-white text-kids-ink shadow-lg",
  } : {
    root: "bg-edu-navy text-white",
    bar: "",
    top: "",
    on: "bg-white/10 text-white hover:bg-white/20",
    off: "bg-rose-500 text-white hover:bg-rose-600",
    neutral: "bg-white/10 text-white hover:bg-white/20",
    active: "bg-edu-grape text-white ring-2 ring-sky-300",
    pop: "rounded-2xl bg-edu-night text-white ring-1 ring-white/10",
    chip: "rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium",
    banner: "rounded-xl bg-edu-night text-white shadow-2xl ring-1 ring-white/10",
  };

  const shareButton = (() => {
    if (!room.canShareScreen) return null;
    if (room.isSharing) return <RoomButton kids={kids} tones={t} label={L} icon={MonitorOff} labelKey="stopShare" onClick={room.stopShare} tone="active" />;
    if (room.isTeacher) return <RoomButton kids={kids} tones={t} label={L} icon={MonitorUp} labelKey="shareScreen" onClick={room.startShare} tone="neutral" />;
    if (room.canStartShare) return <RoomButton kids={kids} tones={t} label={L} icon={MonitorUp} labelKey="startApprovedShare" onClick={room.startShare} tone="active" />;
    if (room.myShareRequest?.status === "pending") return <RoomButton kids={kids} tones={t} label={L} icon={MonitorUp} labelKey="cancelRequest" onClick={room.cancelShareRequest} tone="active" />;
    return <RoomButton kids={kids} tones={t} label={L} icon={MonitorUp} labelKey="requestShare" onClick={room.requestShare} tone="neutral" />;
  })();

  const startedAt = room.room.started_at ? new Date(room.room.started_at).getTime() : null;

  return (
    <div className={`fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden font-sans ${t.root}`}>
      {/* Bar atas */}
      <div className={`flex items-center justify-between gap-3 px-4 py-3 sm:px-6 ${t.top}`}>
        <div className="flex min-w-0 items-center gap-2">
          {kids && <span className="text-2xl sm:text-3xl">🎥</span>}
          <h2 className={`truncate text-lg sm:text-xl ${kids ? "font-extrabold" : "font-semibold"}`}>{room.room.title}</h2>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-1 text-xs font-bold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> {L("live")}
          </span>
          {startedAt && <span className={`hidden font-mono text-sm sm:inline ${kids ? "text-kids-ink/70" : "text-white/70"}`}>{formatElapsed(clock - startedAt)}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {room.roomRecording && (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-500">
              <CircleDot className="h-3.5 w-3.5 animate-pulse" /> <span className="hidden sm:inline">{L("recording")}</span>
            </span>
          )}
          {raisedHands > 0 && <span className={t.chip}>✋ {raisedHands}</span>}
          <span className={`flex items-center gap-1.5 ${t.chip}`}><Users className="h-4 w-4" /> {everyone.length}</span>
        </div>
      </div>

      {/* Banner status */}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-[55] flex flex-col items-center gap-2 px-4">
        {visibleNotice && (
          <div className={`pointer-events-auto px-4 py-2.5 text-sm font-semibold animate-toast-in ${t.banner}`}>
            {L(`notice.${visibleNotice}` as MeetingLabelKey)}
          </div>
        )}
        {!teacherPresent && (
          <div className={`px-4 py-2.5 text-sm font-semibold ${t.banner}`}>{L("waitingTeacher")}</div>
        )}
        {!room.peerReady && (
          <div className={`px-4 py-2 text-xs font-semibold ${t.banner}`}>{L("connecting")}</div>
        )}
        {!room.isTeacher && room.canStartShare && !room.isSharing && room.canShareScreen && (
          <div className={`pointer-events-auto flex items-center gap-3 px-4 py-2.5 text-sm font-semibold animate-toast-in ${t.banner}`}>
            <span>{L("shareApproved")}</span>
            <button onClick={room.startShare} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">{L("startApprovedShare")}</button>
          </div>
        )}
        {!room.isTeacher && room.myShareRequest?.status === "pending" && (
          <div className={`px-4 py-2 text-xs font-semibold ${t.banner}`}>{L("requestPending")}</div>
        )}
      </div>

      {/* Permintaan share screen untuk pengajar (saat panel peserta tertutup) */}
      {room.isTeacher && panel !== "people" && room.pendingShareRequests.length > 0 && (
        <div className="absolute right-4 top-20 z-[56] w-72 space-y-2">
          {room.pendingShareRequests.map(r => (
            <div key={r.uid} className={`p-3 animate-toast-in ${t.banner}`}>
              <p className="text-sm font-semibold">🖥️ {L("shareRequestTitle", { name: r.name })}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => room.respondShareRequest(r.uid, false)} className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20">{L("deny")}</button>
                <button onClick={() => room.respondShareRequest(r.uid, true)} className="flex-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">{L("approve")}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Area utama */}
      <div className="relative flex min-h-0 flex-1 gap-4 p-3 sm:p-5">
        <div className="min-h-0 min-w-0 flex-1">{stage}</div>
        {panel && (
          <MeetingSidePanel
            room={room}
            tab={panel}
            onTab={setPanel}
            onClose={() => setPanel(null)}
            variant={variant}
            label={L}
            unreadChat={unreadChat}
          />
        )}
      </div>

      {/* Bar kontrol */}
      <div className={`relative z-50 px-2 py-3 sm:px-6 ${t.bar}`}>
        {popover === "reactions" && (
          <div className={`absolute bottom-full left-1/2 mb-2 grid -translate-x-1/2 grid-cols-5 gap-1 p-2 shadow-2xl animate-pop ${t.pop}`}>
            {(kids ? KIDS_REACTIONS : REACTIONS).map(emoji => (
              <button key={emoji} onClick={() => room.sendReaction(emoji)} className="rounded-xl p-2 text-3xl transition-transform hover:scale-125 active:scale-95">
                {emoji}
              </button>
            ))}
          </div>
        )}
        {popover === "effects" && (
          <div className={`absolute bottom-full left-1/2 mb-2 w-[min(92vw,22rem)] -translate-x-1/2 p-3 shadow-2xl animate-pop ${t.pop}`}>
            <p className="mb-2 text-sm font-bold">{L("effects")}</p>
            {!room.self.camera && <p className="mb-2 text-xs opacity-70">{L("effectsHint")}</p>}
            <div className="grid grid-cols-3 gap-2">
              {MEETING_EFFECTS.map(e => (
                <button
                  key={e.id}
                  onClick={() => room.changeEffect(e.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-semibold transition-all ${room.self.effect === e.id
                    ? kids ? "bg-kids-sun text-white" : "bg-edu-grape text-white"
                    : kids ? "bg-kids-cream hover:bg-amber-100" : "bg-white/5 hover:bg-white/10"}`}
                >
                  <span className="text-2xl">{e.emoji}</span>
                  {L(`effect.${e.id}` as MeetingLabelKey)}
                </button>
              ))}
            </div>
          </div>
        )}
        {popover === "end" && (
          <div className={`absolute bottom-full right-2 mb-2 w-56 overflow-hidden py-2 shadow-2xl animate-pop sm:right-6 ${t.pop}`}>
            <button onClick={room.leave} className="w-full px-4 py-3 text-left font-medium hover:bg-white/10">{L("leave")}</button>
            <button
              onClick={() => { if (confirm(L("endConfirm"))) room.endForAll(); }}
              className="w-full px-4 py-3 text-left font-medium text-rose-400 hover:bg-white/10"
            >
              {L("endForAll")}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className={`hidden w-40 truncate text-sm lg:block ${kids ? "font-semibold" : "text-white/70"}`}>
            {new Date(clock).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {room.room.title}
          </span>

          <div className="flex flex-1 items-start justify-center gap-2 overflow-x-auto px-1 hide-scrollbar sm:gap-3">
            <RoomButton kids={kids} tones={t} label={L}
              icon={room.self.mute ? MicOff : Mic}
              labelKey={room.self.mute ? "unmute" : "mute"}
              onClick={room.toggleMute}
              tone={room.self.mute ? "off" : "on"}
            />
            <RoomButton kids={kids} tones={t} label={L}
              icon={room.self.camera ? Video : VideoOff}
              labelKey={room.self.camera ? "cameraOff" : "cameraOn"}
              onClick={room.toggleCamera}
              tone={room.self.camera ? "on" : "off"}
            />
            {shareButton}
            <RoomButton kids={kids} tones={t} label={L} icon={SmilePlus} labelKey="reactions" onClick={() => togglePopover("reactions")} tone={popover === "reactions" ? "active" : "neutral"} />
            {!room.isTeacher && (
              <>
                <RoomButton kids={kids} tones={t} label={L} icon={Sparkles} labelKey="effects" onClick={() => togglePopover("effects")} tone={popover === "effects" || room.self.effect !== "none" ? "active" : "neutral"} />
                <RoomButton kids={kids} tones={t} label={L} icon={Hand} labelKey={room.self.hand ? "lowerHand" : "raiseHand"} onClick={room.toggleHand} tone={room.self.hand ? "active" : "neutral"} />
              </>
            )}
            {room.isTeacher && typeof MediaRecorder !== "undefined" && room.canShareScreen && (
              <RoomButton kids={kids} tones={t} label={L}
                icon={CircleDot}
                labelKey={room.recording ? "stopRecording" : "record"}
                onClick={room.recording ? room.stopRecording : room.startRecording}
                tone={room.recording ? "off" : "neutral"}
                hideOnMobile
              />
            )}
            <RoomButton kids={kids} tones={t} label={L}
              icon={Users}
              labelKey="people"
              onClick={() => togglePanel("people")}
              tone={panel === "people" ? "active" : "neutral"}
              badge={room.isTeacher ? room.pendingShareRequests.length + raisedHands : 0}
            />
            <RoomButton kids={kids} tones={t} label={L} icon={MessageSquare} labelKey="chat" onClick={() => togglePanel("chat")} tone={panel === "chat" ? "active" : "neutral"} badge={panel === "chat" ? 0 : unreadChat} />

            <button
              onClick={() => (room.isTeacher ? togglePopover("end") : room.leave())}
              title={L("leave")}
              aria-label={L("leave")}
              className="ml-1 flex shrink-0 flex-col items-center gap-1 sm:ml-3"
            >
              <span className={`flex items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition-all hover:bg-rose-600 active:scale-95 ${kids ? "h-12 w-16 sm:h-14 sm:w-24" : "h-11 w-16 sm:h-12 sm:w-24"}`}>
                <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <span className={`hidden text-[11px] font-bold sm:block ${kids ? "text-red-600" : "text-rose-300"}`}>{L("leave")}</span>
            </button>
          </div>

          <span className="hidden w-40 lg:block" />
        </div>
      </div>

      <ReactionLayer reactions={room.reactions} showNames={!kids} />
      <ConfettiLayer burstKey={room.confettiKey} />
    </div>
  );
}
