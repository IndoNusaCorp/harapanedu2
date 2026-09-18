"use client";

import React, { useEffect, useRef, useState } from "react";
import { Hand, MicOff, Pin } from "lucide-react";
import type { MeetingParticipant } from "@/hooks/useMeetingRoom";
import { MEETING_EFFECTS } from "@/lib/meeting/cameraEffects";
import type { MeetingLabelKey, MeetingVariant } from "./labels";

const KID_AVATARS = ["🐼", "🦊", "🐯", "🐸", "🐵", "🐰", "🐻", "🐨", "🦁", "🐧"];
const AVATAR_COLORS = ["bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500", "bg-indigo-500", "bg-sky-500"];

export function hashIndex(text: string, size: number) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % size;
}

// Satu AudioContext dipakai bersama untuk mendeteksi siapa yang sedang bicara
let sharedAudioCtx: AudioContext | null = null;

function useSpeaking(stream: MediaStream | null, enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!stream || !enabled || stream.getAudioTracks().length === 0) {
      setSpeaking(false);
      return;
    }
    try {
      sharedAudioCtx ??= new AudioContext();
      const ctx = sharedAudioCtx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const interval = setInterval(() => {
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) ** 2;
        setSpeaking(Math.sqrt(sum / data.length) > 6);
      }, 250);
      return () => {
        clearInterval(interval);
        source.disconnect();
      };
    } catch {
      return undefined;
    }
  }, [stream, enabled]);
  return speaking;
}

function StreamVideo({ stream, muted, fit, hidden }: { stream: MediaStream; muted: boolean; fit: "cover" | "contain"; hidden?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${hidden ? "pointer-events-none absolute h-px w-px opacity-0" : `h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}`}
    />
  );
}

export function ScreenView({ stream, label, variant }: { stream: MediaStream | null; label: string; variant: MeetingVariant }) {
  const kids = variant === "kids";
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${kids ? "rounded-3xl bg-indigo-950 ring-4 ring-kids-sun" : "rounded-2xl bg-black ring-1 ring-white/10"}`}>
      {stream ? (
        <StreamVideo stream={stream} muted fit="contain" />
      ) : (
        <div className={`animate-pulse ${kids ? "text-6xl" : "text-5xl"}`}>🖥️</div>
      )}
      <span className={`absolute left-3 top-3 rounded-lg px-3 py-1.5 text-sm font-semibold ${kids ? "bg-white/90 text-edu-blue" : "bg-black/60 text-white backdrop-blur"}`}>
        {label}
      </span>
    </div>
  );
}

export function VideoTile({
  participant,
  stream,
  variant,
  label,
  pinned = false,
  compact = false,
  starBurstAt,
  onPin,
}: {
  participant: MeetingParticipant;
  stream: MediaStream | null;
  variant: MeetingVariant;
  label: (key: MeetingLabelKey, params?: Record<string, string | number>) => string;
  pinned?: boolean;
  compact?: boolean;
  starBurstAt?: number;
  onPin?: () => void;
}) {
  const kids = variant === "kids";
  const p = participant;
  const speaking = useSpeaking(p.isMe ? null : stream, !p.mute);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!starBurstAt || Date.now() - starBurstAt > 3000) return;
    setBurst(true);
    const timer = setTimeout(() => setBurst(false), 2500);
    return () => clearTimeout(timer);
  }, [starBurstAt]);

  const displayName = p.isMe ? `${p.name} (${label("you")})` : p.name;
  const showVideo = p.camera && !!stream;
  const effectEmoji = p.effect !== "none" ? MEETING_EFFECTS.find(e => e.id === p.effect)?.emoji : null;

  const frame = kids
    ? `rounded-3xl bg-kids-periwinkle ring-4 ${speaking ? "ring-emerald-400" : pinned ? "ring-kids-sun" : "ring-transparent"}`
    : `rounded-2xl bg-edu-night ring-2 ${speaking ? "ring-emerald-400" : pinned ? "ring-edu-grape" : "ring-white/5"}`;

  return (
    <div
      onClick={onPin}
      className={`group relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden shadow-lg transition-all ${frame} ${compact ? "min-h-[110px]" : "min-h-[160px]"}`}
    >
      {/* Video selalu dipasang untuk peserta lain supaya suaranya tetap terdengar walau kamera mati */}
      {stream && (!p.isMe || showVideo) && (
        <StreamVideo stream={stream} muted={p.isMe} fit="cover" hidden={!showVideo} />
      )}

      {!showVideo && (
        kids ? (
          <div className={`flex items-center justify-center rounded-full bg-white/30 shadow-inner ${pinned ? "h-36 w-36 text-7xl" : compact ? "h-14 w-14 text-3xl" : "h-24 w-24 text-5xl"}`}>
            {p.role === "teacher" ? "🧑‍🏫" : KID_AVATARS[hashIndex(p.uid, KID_AVATARS.length)]}
          </div>
        ) : (
          <div className={`flex items-center justify-center rounded-full font-bold text-white ${AVATAR_COLORS[hashIndex(p.uid, AVATAR_COLORS.length)]} ${pinned ? "h-32 w-32 text-5xl" : compact ? "h-12 w-12 text-xl" : "h-20 w-20 text-3xl"}`}>
            {(p.name[0] || "U").toUpperCase()}
          </div>
        )
      )}

      {/* Status di pojok kanan atas */}
      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        {p.hand && (
          <span className={`flex items-center justify-center rounded-full bg-amber-400 text-white shadow-md animate-wiggle ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
            {kids ? <span className={compact ? "text-sm" : "text-lg"}>✋</span> : <Hand className="h-4 w-4" />}
          </span>
        )}
        {p.mute && (
          <span className={`flex items-center justify-center rounded-full bg-rose-500 shadow-md ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
            <MicOff className="h-4 w-4 text-white" />
          </span>
        )}
      </div>

      {/* Bintang dari guru */}
      {(p.stars ?? 0) > 0 && (
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-black shadow ${kids ? "bg-kids-sun text-white" : "bg-amber-400/90 text-amber-950"}`}>
          ⭐ {p.stars}
        </span>
      )}

      {burst && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-7xl animate-pop drop-shadow-lg">⭐</span>
          <span className="absolute text-3xl animate-float-up" style={{ ["--drift" as string]: "-40px" }}>✨</span>
          <span className="absolute text-3xl animate-float-up" style={{ ["--drift" as string]: "40px" }}>🌟</span>
        </div>
      )}

      {onPin && !compact && (
        <span className="absolute right-2 top-12 hidden rounded-full bg-black/40 p-1.5 text-white group-hover:block">
          <Pin className="h-3.5 w-3.5" />
        </span>
      )}

      <div className={`absolute bottom-2 left-2 right-2 flex items-center gap-1.5 ${compact ? "text-xs" : "text-sm"}`}>
        <span className={`flex min-w-0 items-center gap-1.5 rounded-xl px-2.5 py-1 font-semibold ${kids ? "bg-white/90 text-slate-800 shadow" : "bg-black/55 text-white backdrop-blur-md"}`}>
          {effectEmoji && <span>{effectEmoji}</span>}
          <span className="truncate">{displayName}</span>
          {p.role === "teacher" && (
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${kids ? "bg-edu-blue text-white" : "bg-edu-grape text-white"}`}>
              {label("teacher")}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
