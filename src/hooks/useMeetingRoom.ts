"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MediaConnection, default as PeerClient } from "peerjs";
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc,
  increment, limitToLast, onSnapshot, orderBy, query, updateDoc, where,
} from "firebase/firestore";
import { connecttofirestore } from "@/lib/firebase";
import { pushNotification } from "@/lib/api";
import {
  CameraEffectProcessor, createPlaceholderVideoTrack, createSilentAudioTrack,
} from "@/lib/meeting/cameraEffects";
import type {
  Meeting, MeetingEffect, MeetingMessage, MeetingParticipantState, MeetingReaction,
} from "@/lib/types";

// ============================================
// Logika ruang meeting (dipakai pengajar, pelajar, dan kids mode)
// ============================================
// - Kehadiran, status mic/kamera, izin share screen, dll disimpan di dokumen meetings/{id}
// - Chat di subkoleksi meetings/{id}/messages, reaksi di meetings/{id}/reactions
// - Video/audio lewat PeerJS (peer-to-peer, mesh): tiap pasangan peserta punya 1 koneksi kamera.
//   Aturan siapa yang menelepon: uid yang lebih kecil menelepon uid yang lebih besar (tidak ada panggilan ganda).
//   Share screen memakai koneksi terpisah: yang berbagi layar menelepon semua peserta.

export const STALE_MS = 45_000;
const HEARTBEAT_MS = 15_000;
const RECONCILE_MS = 4_000;
const CALL_TIMEOUT_MS = 15_000;
const REACTION_TTL_MS = 8_000;
const REACTION_COOLDOWN_MS = 600;
const FLOATING_MS = 3_000;
const HAND_GRACE_MS = 3_000;

export type MeetingRole = "teacher" | "student";
export type MeetingExitReason = "left" | "endedByTeacher" | "endedByMe" | "notStarted" | "deleted";
export type MeetingNotice =
  | "micUnavailable" | "cameraFailed" | "screenFailed" | "shareBusy" | "shareDenied"
  | "shareStopped" | "mutedByTeacher" | "recordFailed" | "connectionFailed";

export interface MeetingParticipant extends MeetingParticipantState {
  uid: string;
  isMe: boolean;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  name: string;
  left: number;
  drift: number;
}

interface CamCall {
  call: MediaConnection;
  peerId: string;
  since: number;
  connected: boolean;
}

// Peserta yang benar-benar masih di ruangan (heartbeat masih baru), guru selalu paling atas
export function liveParticipants(room: Pick<Meeting, "activeParticipants" | "participantStates">, now: number, selfUid: string): MeetingParticipant[] {
  const active = new Set(room.activeParticipants || []);
  return Object.entries(room.participantStates || {})
    .filter(([id, s]) => id !== selfUid && active.has(id) && now - (s?.lastSeen || 0) < STALE_MS)
    .map(([id, s]) => ({ ...s, uid: id, isMe: false }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "teacher" ? -1 : 1));
}

export function shouldCall(myUid: string, otherUid: string) {
  return myUid < otherUid;
}

const isFailed = (call: MediaConnection) => {
  const state = call.peerConnection?.iceConnectionState;
  return state === "failed" || state === "closed";
};

export function useMeetingRoom({ meeting, uid, role, name, onExit }: {
  meeting: Meeting;
  uid: string;
  role: MeetingRole;
  name: string;
  onExit: (reason: MeetingExitReason) => void;
}) {
  const isTeacher = role === "teacher";
  const meetingRef = useMemo(() => doc(connecttofirestore, "meetings", meeting.id), [meeting.id]);
  const joinedAt = useRef(new Date().toISOString());

  const [room, setRoom] = useState<Meeting>(meeting);
  const [now, setNow] = useState(() => Date.now());
  const [joined, setJoined] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);

  const [mute, setMute] = useState(true);
  const [camera, setCamera] = useState(false);
  const [hand, setHand] = useState(false);
  const [effect, setEffect] = useState<MeetingEffect>("none");
  const [micAvailable, setMicAvailable] = useState(true);
  const [localVideo, setLocalVideo] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreen, setRemoteScreen] = useState<{ uid: string; stream: MediaStream } | null>(null);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [confettiKey, setConfettiKey] = useState(0);
  const [starBursts, setStarBursts] = useState<Record<string, number>>({});
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState<{ kind: MeetingNotice; at: number } | null>(null);

  // Ref untuk dipakai di callback PeerJS / Firestore yang dibuat sekali
  const outStream = useRef<MediaStream | null>(null);
  const audioTrack = useRef<MediaStreamTrack | null>(null);
  const placeholderTrack = useRef<MediaStreamTrack | null>(null);
  const processor = useRef<CameraEffectProcessor | null>(null);
  const peerRef = useRef<PeerClient | null>(null);
  const camCalls = useRef(new Map<string, CamCall>());
  const screenCalls = useRef(new Map<string, MediaConnection>());
  const incomingScreen = useRef<MediaConnection | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const roomRef = useRef<Meeting>(meeting);
  const exited = useRef(false);
  const onExitRef = useRef(onExit);
  const participantsRef = useRef<MeetingParticipant[]>([]);
  const lastMuteAll = useRef<string | undefined>(undefined);
  const lastShareUid = useRef<string | undefined>(undefined);
  const lastRequestStatus = useRef<string | undefined>(undefined);
  const handChangedAt = useRef(0);
  const lastReactionAt = useRef(0);
  const seenReactions = useRef(new Set<string>());
  const effectRef = useRef<MeetingEffect>("none");

  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  const notify = useCallback((kind: MeetingNotice) => setNotice({ kind, at: Date.now() }), []);

  const participants = useMemo(() => liveParticipants(room, now, uid), [room, now, uid]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);

  const self: MeetingParticipant = {
    uid,
    isMe: true,
    name,
    role,
    mute,
    camera,
    hand,
    effect,
    stars: room.participantStates?.[uid]?.stars || 0,
    lastSeen: now,
  };

  // ---------------------------------------------
  // Keluar dari meeting
  // ---------------------------------------------
  const leaveWrites = useCallback(() => {
    const updates: Record<string, unknown> = {
      activeParticipants: arrayRemove(uid),
      [`participantStates.${uid}`]: deleteField(),
      [`shareRequests.${uid}`]: deleteField(),
    };
    if (roomRef.current.screenShare?.uid === uid) updates.screenShare = null;
    if (roomRef.current.host_id === uid && recorder.current) updates.recording = false;
    return updateDoc(meetingRef, updates).catch(e => console.warn("Gagal keluar meeting:", e));
  }, [meetingRef, uid]);

  const exit = useCallback((reason: MeetingExitReason) => {
    if (exited.current) return;
    exited.current = true;
    if (reason === "left") leaveWrites();
    onExitRef.current(reason);
  }, [leaveWrites]);

  // ---------------------------------------------
  // Mikrofon + track video pengganti
  // ---------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const placeholder = createPlaceholderVideoTrack();
    placeholderTrack.current = placeholder;

    (async () => {
      let audio: MediaStreamTrack;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        audio = stream.getAudioTracks()[0];
        // Semua peserta masuk dalam keadaan mic mati
        audio.enabled = false;
      } catch {
        audio = createSilentAudioTrack();
        setMicAvailable(false);
        notify("micUnavailable");
      }
      if (cancelled) {
        audio.stop();
        return;
      }
      audioTrack.current = audio;
      outStream.current = new MediaStream([audio, placeholder]);
      setMediaReady(true);
    })();

    return () => {
      cancelled = true;
      audioTrack.current?.stop();
      placeholder.stop();
      processor.current?.stop();
      processor.current = null;
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    };
  }, [notify]);

  // ---------------------------------------------
  // Bergabung + listener dokumen meeting + heartbeat
  // ---------------------------------------------
  useEffect(() => {
    let alive = true;
    // React StrictMode (dev) memasang efek dua kali; pemasangan kedua harus bisa bergabung lagi
    exited.current = false;

    (async () => {
      const snap = await getDoc(meetingRef);
      if (!alive) return;
      if (!snap.exists()) return exit("deleted");
      const data = snap.data() as Meeting;
      if (!isTeacher && data.isEnded) return exit("notStarted");

      const updates: Record<string, unknown> = {
        activeParticipants: arrayUnion(uid),
        [`participantStates.${uid}`]: {
          name, role, mute: true, camera: false, hand: false, effect: "none", stars: 0, lastSeen: Date.now(),
        } satisfies MeetingParticipantState,
      };

      if (isTeacher) {
        const hostStillThere = !data.isEnded && data.status === "live" && !!data.host_id && (data.activeParticipants || []).includes(data.host_id);
        Object.assign(updates, { isEnded: false, status: "live", host_id: uid });
        if (!hostStillThere) {
          Object.assign(updates, { started_at: new Date().toISOString(), screenShare: null, shareRequests: {}, recording: false });
        }
        await updateDoc(meetingRef, updates);
        if (!hostStillThere) {
          pushNotification({ type: "meeting_live", title: data.title, ref_id: meeting.id, class_id: data.class_id, audience: "student" });
        }
      } else {
        await updateDoc(meetingRef, updates);
      }
      if (alive) setJoined(true);
    })().catch(e => {
      console.error("Gagal bergabung ke meeting:", e);
      notify("connectionFailed");
    });

    const unsubscribe = onSnapshot(meetingRef, (snap) => {
      if (!snap.exists()) return exit("deleted");
      const data = { ...snap.data(), id: snap.id } as Meeting;
      roomRef.current = data;
      setRoom(data);

      if (data.isEnded && data.ended_at && data.ended_at > joinedAt.current && data.ended_by !== uid) {
        return exit("endedByTeacher");
      }

      // Pengajar menekan "bisukan semua"
      if (!isTeacher && data.muteAllAt && data.muteAllAt > joinedAt.current && data.muteAllAt !== lastMuteAll.current) {
        lastMuteAll.current = data.muteAllAt;
        if (audioTrack.current?.enabled) {
          audioTrack.current.enabled = false;
          setMute(true);
          notify("mutedByTeacher");
        }
      }

      // Share screen saya digantikan / dihentikan pengajar
      const shareUid = data.screenShare?.uid;
      if (lastShareUid.current === uid && shareUid !== uid && screenStreamRef.current) {
        stopShareLocalRef.current();
        notify("shareStopped");
      }
      lastShareUid.current = shareUid;

      // Jawaban pengajar atas permintaan share screen
      const status = data.shareRequests?.[uid]?.status;
      if (status === "denied" && lastRequestStatus.current !== "denied") {
        notify("shareDenied");
        updateDoc(meetingRef, { [`shareRequests.${uid}`]: deleteField() }).catch(() => {});
      }
      lastRequestStatus.current = status;

      // Tangan saya diturunkan pengajar
      const remoteHand = data.participantStates?.[uid]?.hand;
      if (remoteHand === false && Date.now() - handChangedAt.current > HAND_GRACE_MS) {
        setHand(h => (h ? false : h));
      }
    }, (e) => console.warn("Listener meeting gagal:", e));

    const heartbeat = setInterval(() => {
      setNow(Date.now());
      if (exited.current) return;
      updateDoc(meetingRef, { [`participantStates.${uid}.lastSeen`]: Date.now() }).catch(() => {});
    }, HEARTBEAT_MS);
    const tick = setInterval(() => setNow(Date.now()), 5_000);

    const onPageHide = () => { if (!exited.current) leaveWrites(); };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      alive = false;
      unsubscribe();
      clearInterval(heartbeat);
      clearInterval(tick);
      window.removeEventListener("pagehide", onPageHide);
      // Pindah halaman tanpa menekan tombol keluar
      if (!exited.current) {
        exited.current = true;
        leaveWrites();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingRef, uid]);

  // Sinkronkan status lokal ke Firestore (per field, supaya bintang dari guru tidak tertimpa)
  useEffect(() => {
    if (!joined || exited.current) return;
    updateDoc(meetingRef, {
      [`participantStates.${uid}.mute`]: mute,
      [`participantStates.${uid}.camera`]: camera,
      [`participantStates.${uid}.hand`]: hand,
      [`participantStates.${uid}.effect`]: effect,
      [`participantStates.${uid}.lastSeen`]: Date.now(),
      ...(peerId ? { [`participantStates.${uid}.peerId`]: peerId } : {}),
    }).catch(e => console.warn("Gagal sinkron status:", e));
  }, [joined, mute, camera, hand, effect, peerId, meetingRef, uid]);

  // ---------------------------------------------
  // PeerJS
  // ---------------------------------------------
  const removeRemote = useCallback((remoteUid: string) => {
    setRemoteStreams(prev => {
      if (!(remoteUid in prev)) return prev;
      const next = { ...prev };
      delete next[remoteUid];
      return next;
    });
  }, []);

  const registerCamCall = useCallback((remoteUid: string, call: MediaConnection) => {
    const existing = camCalls.current.get(remoteUid);
    if (existing && existing.call !== call) existing.call.close();
    const entry: CamCall = { call, peerId: call.peer, since: Date.now(), connected: false };
    camCalls.current.set(remoteUid, entry);

    call.on("stream", (stream) => {
      entry.connected = true;
      setRemoteStreams(prev => ({ ...prev, [remoteUid]: stream }));
    });
    const cleanup = () => {
      if (camCalls.current.get(remoteUid)?.call !== call) return;
      camCalls.current.delete(remoteUid);
      removeRemote(remoteUid);
    };
    call.on("close", cleanup);
    call.on("error", cleanup);
  }, [removeRemote]);

  const reconcile = useCallback(() => {
    const peer = peerRef.current;
    const out = outStream.current;
    if (!peer || !peer.open || peer.destroyed || !out) return;

    const others = participantsRef.current.filter(p => p.peerId);
    const present = new Set(others.map(p => p.uid));

    camCalls.current.forEach((entry, remoteUid) => {
      if (!present.has(remoteUid)) {
        entry.call.close();
        camCalls.current.delete(remoteUid);
        removeRemote(remoteUid);
      }
    });
    screenCalls.current.forEach((call, remoteUid) => {
      if (!present.has(remoteUid)) {
        call.close();
        screenCalls.current.delete(remoteUid);
      }
    });

    for (const p of others) {
      const entry = camCalls.current.get(p.uid);
      const stale = entry && (
        entry.peerId !== p.peerId ||
        isFailed(entry.call) ||
        (!entry.connected && Date.now() - entry.since > CALL_TIMEOUT_MS)
      );
      if (entry && stale) {
        entry.call.close();
        camCalls.current.delete(p.uid);
        removeRemote(p.uid);
      }
      if (!camCalls.current.has(p.uid) && shouldCall(uid, p.uid)) {
        const call = peer.call(p.peerId!, out, { metadata: { uid, kind: "cam" } });
        if (call) registerCamCall(p.uid, call);
      }

      const screen = screenStreamRef.current;
      const screenCall = screenCalls.current.get(p.uid);
      if (screenCall && (screenCall.peer !== p.peerId || isFailed(screenCall))) {
        screenCall.close();
        screenCalls.current.delete(p.uid);
      }
      if (screen && !screenCalls.current.has(p.uid)) {
        const call = peer.call(p.peerId!, screen, { metadata: { uid, kind: "screen" } });
        if (call) {
          screenCalls.current.set(p.uid, call);
          call.on("close", () => {
            if (screenCalls.current.get(p.uid) === call) screenCalls.current.delete(p.uid);
          });
        }
      }
    }
  }, [uid, registerCamCall, removeRemote]);

  useEffect(() => {
    if (!mediaReady) return;
    let destroyed = false;
    let peer: PeerClient | null = null;
    const calls = camCalls.current;
    const screens = screenCalls.current;

    import("peerjs").then(({ default: Peer }) => {
      if (destroyed) return;
      const suffix = Math.random().toString(36).slice(2, 8);
      peer = new Peer(`hedu-${meeting.id}-${uid}-${suffix}`);
      peerRef.current = peer;

      peer.on("open", (id) => setPeerId(id));
      peer.on("disconnected", () => {
        if (!destroyed && peer && !peer.destroyed) peer.reconnect();
      });
      peer.on("error", (err) => {
        if (err.type === "peer-unavailable") {
          // Peserta yang ditelepon sudah tidak ada; hapus supaya dicoba lagi saat reconcile
          calls.forEach((entry, remoteUid) => {
            if (err.message.includes(entry.peerId)) {
              entry.call.close();
              calls.delete(remoteUid);
            }
          });
          return;
        }
        console.warn("PeerJS error:", err.type, err);
        if (err.type === "network" || err.type === "server-error" || err.type === "socket-error") notify("connectionFailed");
      });

      peer.on("call", (call) => {
        const meta = (call.metadata || {}) as { uid?: string; kind?: string };
        if (!meta.uid) {
          call.close();
          return;
        }
        if (meta.kind === "screen") {
          incomingScreen.current?.close();
          incomingScreen.current = call;
          call.answer();
          call.on("stream", (stream) => setRemoteScreen({ uid: meta.uid!, stream }));
          call.on("close", () => setRemoteScreen(prev => (prev?.uid === meta.uid ? null : prev)));
          return;
        }
        if (!outStream.current) return;
        call.answer(outStream.current);
        registerCamCall(meta.uid, call);
      });
    }).catch(e => {
      console.error("PeerJS gagal dimuat:", e);
      notify("connectionFailed");
    });

    return () => {
      destroyed = true;
      calls.forEach(entry => entry.call.close());
      calls.clear();
      screens.forEach(call => call.close());
      screens.clear();
      incomingScreen.current?.close();
      peer?.destroy();
      peerRef.current = null;
    };
  }, [mediaReady, meeting.id, uid, notify, registerCamCall]);

  const participantKey = participants.map(p => `${p.uid}:${p.peerId || ""}`).join("|");
  useEffect(() => {
    reconcile();
  }, [participantKey, peerId, reconcile]);

  useEffect(() => {
    const interval = setInterval(reconcile, RECONCILE_MS);
    return () => clearInterval(interval);
  }, [reconcile]);

  // ---------------------------------------------
  // Mic & kamera
  // ---------------------------------------------
  const replaceTrack = useCallback((track: MediaStreamTrack) => {
    const out = outStream.current;
    if (out) {
      out.getTracks().filter(t => t.kind === track.kind).forEach(t => out.removeTrack(t));
      out.addTrack(track);
    }
    camCalls.current.forEach(({ call }) => {
      call.peerConnection?.getSenders()
        .filter(sender => sender.track?.kind === track.kind)
        .forEach(sender => sender.replaceTrack(track).catch(() => {}));
    });
  }, []);

  const toggleMute = useCallback(async () => {
    if (!micAvailable) {
      // Coba minta izin mikrofon lagi
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        const track = stream.getAudioTracks()[0];
        audioTrack.current?.stop();
        audioTrack.current = track;
        replaceTrack(track);
        setMicAvailable(true);
        setMute(false);
      } catch {
        notify("micUnavailable");
      }
      return;
    }
    const track = audioTrack.current;
    if (!track) return;
    track.enabled = mute;
    setMute(!mute);
  }, [micAvailable, mute, notify, replaceTrack]);

  const toggleCamera = useCallback(async () => {
    if (camera) {
      processor.current?.stop();
      processor.current = null;
      if (placeholderTrack.current) replaceTrack(placeholderTrack.current);
      setLocalVideo(null);
      setCamera(false);
      return;
    }
    try {
      const raw = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      const proc = new CameraEffectProcessor(raw, effectRef.current);
      processor.current = proc;
      replaceTrack(proc.track);
      setLocalVideo(new MediaStream([proc.track]));
      setCamera(true);
    } catch (e) {
      console.warn("Kamera gagal:", e);
      notify("cameraFailed");
    }
  }, [camera, notify, replaceTrack]);

  const changeEffect = useCallback((next: MeetingEffect) => {
    effectRef.current = next;
    if (processor.current) processor.current.effect = next;
    setEffect(next);
  }, []);

  const toggleHand = useCallback(() => {
    handChangedAt.current = Date.now();
    setHand(h => !h);
  }, []);

  // ---------------------------------------------
  // Share screen
  // ---------------------------------------------
  const stopShareLocal = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    screenCalls.current.forEach(call => call.close());
    screenCalls.current.clear();
  }, []);
  const stopShareLocalRef = useRef(stopShareLocal);
  useEffect(() => { stopShareLocalRef.current = stopShareLocal; }, [stopShareLocal]);

  const stopShare = useCallback(() => {
    stopShareLocal();
    if (roomRef.current.screenShare?.uid === uid) {
      updateDoc(meetingRef, { screenShare: null }).catch(() => {});
    }
  }, [stopShareLocal, meetingRef, uid]);

  const myShareRequest = room.shareRequests?.[uid];
  const canShareScreen = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
  const canStartShare = isTeacher || myShareRequest?.status === "approved";

  const startShare = useCallback(async () => {
    if (!canStartShare) return;
    const current = roomRef.current.screenShare;
    if (!isTeacher && current && current.uid !== uid) {
      notify("shareBusy");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      stream.getVideoTracks()[0].onended = () => stopShare();
      screenStreamRef.current = stream;
      setScreenStream(stream);
      lastShareUid.current = uid;
      await updateDoc(meetingRef, {
        screenShare: { uid, name },
        ...(isTeacher ? {} : { [`shareRequests.${uid}`]: deleteField() }),
      });
      reconcile();
    } catch (e) {
      console.warn("Share screen gagal:", e);
      stopShareLocal();
      notify("screenFailed");
    }
  }, [canStartShare, isTeacher, uid, name, meetingRef, notify, reconcile, stopShare, stopShareLocal]);

  const requestShare = useCallback(() => {
    updateDoc(meetingRef, {
      [`shareRequests.${uid}`]: { name, status: "pending", at: new Date().toISOString() },
    }).catch(() => {});
  }, [meetingRef, uid, name]);

  const cancelShareRequest = useCallback(() => {
    updateDoc(meetingRef, { [`shareRequests.${uid}`]: deleteField() }).catch(() => {});
  }, [meetingRef, uid]);

  // ---------------------------------------------
  // Kontrol pengajar
  // ---------------------------------------------
  const respondShareRequest = useCallback((target: string, approve: boolean) => {
    updateDoc(meetingRef, { [`shareRequests.${target}.status`]: approve ? "approved" : "denied" }).catch(() => {});
  }, [meetingRef]);

  const stopOthersShare = useCallback(() => {
    updateDoc(meetingRef, { screenShare: null }).catch(() => {});
  }, [meetingRef]);

  const muteAll = useCallback(() => {
    updateDoc(meetingRef, { muteAllAt: new Date().toISOString() }).catch(() => {});
  }, [meetingRef]);

  const lowerHand = useCallback((target: string) => {
    updateDoc(meetingRef, { [`participantStates.${target}.hand`]: false }).catch(() => {});
  }, [meetingRef]);

  const lowerAllHands = useCallback(() => {
    const raised = participantsRef.current.filter(p => p.hand);
    if (raised.length === 0) return;
    updateDoc(meetingRef, Object.fromEntries(raised.map(p => [`participantStates.${p.uid}.hand`, false]))).catch(() => {});
  }, [meetingRef]);

  // ---------------------------------------------
  // Reaksi, bintang, dan confetti
  // ---------------------------------------------
  const reactionsCol = useMemo(() => collection(meetingRef, "reactions"), [meetingRef]);

  const postReaction = useCallback(async (data: Omit<MeetingReaction, "id" | "created_at" | "uid" | "name">) => {
    try {
      const ref = await addDoc(reactionsCol, { ...data, uid, name, created_at: new Date().toISOString() });
      setTimeout(() => deleteDoc(ref).catch(() => {}), REACTION_TTL_MS);
    } catch (e) {
      console.warn("Reaksi gagal:", e);
    }
  }, [reactionsCol, uid, name]);

  const sendReaction = useCallback((emoji: string) => {
    if (Date.now() - lastReactionAt.current < REACTION_COOLDOWN_MS) return;
    lastReactionAt.current = Date.now();
    postReaction({ emoji });
  }, [postReaction]);

  const giveStar = useCallback((target: string) => {
    updateDoc(meetingRef, { [`participantStates.${target}.stars`]: increment(1) }).catch(() => {});
    postReaction({ emoji: "⭐", target });
  }, [meetingRef, postReaction]);

  useEffect(() => {
    const q = query(reactionsCol, where("created_at", ">", joinedAt.current));
    return onSnapshot(q, (snap) => {
      snap.docChanges().forEach(change => {
        if (change.type !== "added" || seenReactions.current.has(change.doc.id)) return;
        seenReactions.current.add(change.doc.id);
        const r = { ...change.doc.data(), id: change.doc.id } as MeetingReaction;

        if (r.target) {
          setStarBursts(prev => ({ ...prev, [r.target!]: Date.now() }));
          return;
        }
        if (r.emoji === "🎉") setConfettiKey(k => k + 1);

        const floating: FloatingReaction = {
          id: r.id,
          emoji: r.emoji,
          name: r.name,
          left: 8 + Math.random() * 80,
          drift: Math.round(Math.random() * 120 - 60),
        };
        setReactions(prev => [...prev.slice(-30), floating]);
        setTimeout(() => setReactions(prev => prev.filter(x => x.id !== floating.id)), FLOATING_MS);
      });
    }, (e) => console.warn("Listener reaksi gagal:", e));
  }, [reactionsCol]);

  // ---------------------------------------------
  // Chat
  // ---------------------------------------------
  useEffect(() => {
    const q = query(collection(meetingRef, "messages"), orderBy("created_at"), limitToLast(200));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ ...d.data(), id: d.id } as MeetingMessage)));
    }, (e) => console.warn("Listener chat gagal:", e));
  }, [meetingRef]);

  const visibleMessages = useMemo(
    () => messages.filter(m => !room.started_at || m.created_at >= room.started_at),
    [messages, room.started_at],
  );

  const sendMessage = useCallback((text: string) => {
    const clean = text.trim().slice(0, 500);
    if (!clean) return;
    addDoc(collection(meetingRef, "messages"), {
      uid, name, role, text: clean, created_at: new Date().toISOString(),
    }).catch(e => console.warn("Chat gagal:", e));
  }, [meetingRef, uid, name, role]);

  // ---------------------------------------------
  // Rekam meeting (pengajar) → file .webm diunduh ke komputer pengajar
  // ---------------------------------------------
  const startRecording = useCallback(async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 24 },
        audio: true,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);

      const audioCtx = new AudioContext();
      const destination = audioCtx.createMediaStreamDestination();
      if (display.getAudioTracks().length) {
        audioCtx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(destination);
      }
      if (audioTrack.current) {
        audioCtx.createMediaStreamSource(new MediaStream([audioTrack.current])).connect(destination);
      }

      const mixed = new MediaStream([...display.getVideoTracks(), ...destination.stream.getAudioTracks()]);
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
        .find(m => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(mixed, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        display.getTracks().forEach(t => t.stop());
        audioCtx.close().catch(() => {});
        recorder.current = null;
        setRecording(false);
        updateDoc(meetingRef, { recording: false }).catch(() => {});

        if (chunks.length === 0) return;
        const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
        const a = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        a.href = url;
        a.download = `${(roomRef.current.title || "meeting").replace(/[^\w-]+/g, "_")}-${stamp}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      };
      display.getVideoTracks()[0].onended = () => { if (rec.state !== "inactive") rec.stop(); };

      rec.start(1000);
      recorder.current = rec;
      setRecording(true);
      updateDoc(meetingRef, { recording: true }).catch(() => {});
    } catch (e) {
      console.warn("Rekam gagal:", e);
      notify("recordFailed");
    }
  }, [meetingRef, notify]);

  const stopRecording = useCallback(() => {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
  }, []);

  // ---------------------------------------------
  // Keluar / akhiri
  // ---------------------------------------------
  const leave = useCallback(() => {
    stopRecording();
    exit("left");
  }, [exit, stopRecording]);

  const endForAll = useCallback(async () => {
    stopRecording();
    exited.current = true;
    try {
      await updateDoc(meetingRef, {
        isEnded: true,
        status: "ended",
        ended_at: new Date().toISOString(),
        ended_by: uid,
        activeParticipants: [],
        participantStates: {},
        screenShare: null,
        shareRequests: {},
        recording: false,
      });
    } catch (e) {
      console.error("Gagal mengakhiri meeting:", e);
    }
    onExitRef.current("endedByMe");
  }, [meetingRef, uid, stopRecording]);

  // Layar yang sedang dibagikan (milik sendiri atau peserta lain)
  const activeScreen = room.screenShare
    ? room.screenShare.uid === uid
      ? screenStream
      : remoteScreen && remoteScreen.uid === room.screenShare.uid ? remoteScreen.stream : null
    : null;

  const pendingShareRequests = Object.entries(room.shareRequests || {})
    .filter(([id, r]) => r.status === "pending" && participants.some(p => p.uid === id))
    .map(([id, r]) => ({ uid: id, ...r }));

  return {
    room,
    isTeacher,
    self,
    participants,
    remoteStreams,
    localVideo,
    activeScreen,
    screenShare: room.screenShare ?? null,
    isSharing: !!screenStream,
    canShareScreen,
    canStartShare,
    myShareRequest,
    pendingShareRequests,
    micAvailable,
    peerReady: !!peerId,
    messages: visibleMessages,
    reactions,
    confettiKey,
    starBursts,
    recording,
    roomRecording: !!room.recording,
    notice,
    toggleMute,
    toggleCamera,
    toggleHand,
    changeEffect,
    startShare,
    stopShare,
    requestShare,
    cancelShareRequest,
    respondShareRequest,
    stopOthersShare,
    muteAll,
    lowerHand,
    lowerAllHands,
    sendReaction,
    giveStar,
    sendMessage,
    startRecording,
    stopRecording,
    leave,
    endForAll,
  };
}

export type MeetingRoomState = ReturnType<typeof useMeetingRoom>;
