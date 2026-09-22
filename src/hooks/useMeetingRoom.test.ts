import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc, seedFirestore, signInAs } from "@/test/fakeFirebase";
import { installFakeMedia } from "@/test/meeting";
import { deleteMeeting } from "@/lib/api";
import { liveParticipants, shouldCall, STALE_MS, useMeetingRoom, type MeetingRole } from "./useMeetingRoom";
import type { Meeting, MeetingParticipantState } from "@/lib/types";

const peerjs = await vi.hoisted(async () => (await import("@/test/meeting")).fakePeerJs());
vi.mock("peerjs", () => peerjs.module);
vi.mock("@/lib/meeting/cameraEffects", async () => (await import("@/test/meeting")).fakeCameraEffects());

const state = (name: string, role: "teacher" | "student", lastSeen: number): MeetingParticipantState => ({
  name, role, lastSeen, mute: true, camera: false, hand: false, effect: "none",
});

describe("liveParticipants", () => {
  const now = 1_000_000;

  it("keeps active, fresh participants, excludes self, and lists the teacher first", () => {
    const list = liveParticipants({
      activeParticipants: ["me", "s2", "t1", "gone", "stale"],
      participantStates: {
        me: state("Me", "student", now),
        s2: state("Zara", "student", now - 1000),
        t1: state("Bu Guru", "teacher", now - 2000),
        stale: state("Old", "student", now - STALE_MS - 1),
        left: state("Left", "student", now),
      },
    }, now, "me");

    expect(list.map(p => p.uid)).toEqual(["t1", "s2"]);
    expect(list.every(p => !p.isMe)).toBe(true);
  });

  it("handles a meeting nobody has joined", () => {
    expect(liveParticipants({}, now, "me")).toEqual([]);
  });
});

describe("shouldCall", () => {
  it("lets exactly one side of each pair start the call", () => {
    expect(shouldCall("a", "b")).toBe(true);
    expect(shouldCall("b", "a")).toBe(false);
  });
});

describe("useMeetingRoom", () => {
  const meeting: Meeting = { id: "m1", title: "Kelas Pecahan", time: "", participants: 0, status: "upcoming", link: "", class_id: "c1" };
  const room = () => getFirestoreDoc("meetings/m1") as unknown as Meeting;

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    installFakeMedia();
    peerjs.peers.length = 0;
    seedFirestore({ meetings: { m1: { ...meeting } } });
  });

  const join = (uid: string, role: MeetingRole, name: string, onExit = vi.fn()) => {
    const hook = renderHook(() => useMeetingRoom({ meeting, uid, role, name, onExit }));
    return { ...hook, onExit };
  };
  const joinedTeacher = async () => {
    signInAs("t1");
    const teacher = join("t1", "teacher", "Bu Guru");
    await waitFor(() => expect(room().host_id).toBe("t1"));
    return teacher;
  };

  it("starts the meeting when the teacher joins and notifies students", async () => {
    await joinedTeacher();

    expect(room()).toMatchObject({ status: "live", isEnded: false, host_id: "t1", activeParticipants: ["t1"], started_at: expect.any(String) });
    expect(room().participantStates?.t1).toMatchObject({ name: "Bu Guru", role: "teacher", mute: true, camera: false });
    await waitFor(() => expect(Object.values(getFirestoreData("notifications"))).toEqual([
      expect.objectContaining({ type: "meeting_live", ref_id: "m1", audience: "student", class_id: "c1" }),
    ]));
  });

  it("does not let a student into a meeting that has ended", async () => {
    seedFirestore({ meetings: { m1: { ...meeting, isEnded: true } } });
    const { onExit } = join("s1", "student", "Ani");
    await waitFor(() => expect(onExit).toHaveBeenCalledWith("notStarted"));
    expect(room().activeParticipants).toBeUndefined();
  });

  it("exits when the teacher deletes the meeting mid-session", async () => {
    const { onExit } = join("s1", "student", "Ani");
    await waitFor(() => expect(room().activeParticipants).toEqual(["s1"]));

    await deleteMeeting("m1");
    await waitFor(() => expect(onExit).toHaveBeenCalledWith("deleted"));
  });

  it("shows participants to each other and lets exactly one side place the video call", async () => {
    const teacher = await joinedTeacher();
    const student = join("s1", "student", "Ani");

    await waitFor(() => expect(teacher.result.current.participants.map(p => p.uid)).toEqual(["s1"]));
    await waitFor(() => expect(student.result.current.participants.map(p => p.uid)).toEqual(["t1"]));
    await waitFor(() => expect(room().participantStates?.s1?.peerId).toBeTruthy());
    await waitFor(() => expect(room().participantStates?.t1?.peerId).toBeTruthy());

    // "s1" < "t1", so only the student calls
    const studentPeer = peerjs.peers.find(p => p.id.includes("-s1-"))!;
    const teacherPeer = peerjs.peers.find(p => p.id.includes("-t1-"))!;
    await waitFor(() => expect(studentPeer.calls.map(c => c.peer)).toEqual([room().participantStates!.t1.peerId]));
    expect(studentPeer.calls[0].metadata).toEqual({ uid: "s1", kind: "cam" });
    expect(teacherPeer.calls).toEqual([]);
  });

  it("syncs chat between participants, only for this session", async () => {
    seedFirestore({ "meetings/m1/messages": { old: { uid: "x", name: "X", role: "student", text: "sesi lalu", created_at: "2020-01-01T00:00:00Z" } } });
    const teacher = await joinedTeacher();
    const student = join("s1", "student", "Ani");

    act(() => student.result.current.sendMessage("   Halo Bu!   "));
    act(() => student.result.current.sendMessage("   "));
    act(() => student.result.current.sendMessage("x".repeat(600)));

    await waitFor(() => expect(teacher.result.current.messages.map(m => m.text)).toEqual(["Halo Bu!", "x".repeat(500)]));
    expect(teacher.result.current.messages[0]).toMatchObject({ uid: "s1", name: "Ani", role: "student" });
  });

  it("mutes students when the teacher mutes everyone", async () => {
    const teacher = await joinedTeacher();
    const student = join("s1", "student", "Ani");
    await waitFor(() => expect(room().activeParticipants).toContain("s1"));

    await act(() => student.result.current.toggleMute());
    expect(student.result.current.self.mute).toBe(false);

    act(() => teacher.result.current.muteAll());
    await waitFor(() => expect(student.result.current.self.mute).toBe(true));
    expect(student.result.current.notice?.kind).toBe("mutedByTeacher");
  });

  it("handles a denied screen-share request", async () => {
    const teacher = await joinedTeacher();
    const student = join("s1", "student", "Ani");
    await waitFor(() => expect(teacher.result.current.participants).toHaveLength(1));

    act(() => student.result.current.requestShare());
    await waitFor(() => expect(teacher.result.current.pendingShareRequests).toEqual([expect.objectContaining({ uid: "s1", name: "Ani", status: "pending" })]));

    act(() => teacher.result.current.respondShareRequest("s1", false));
    await waitFor(() => expect(student.result.current.notice?.kind).toBe("shareDenied"));
    await waitFor(() => expect(room().shareRequests).toEqual({}));
    expect(student.result.current.canStartShare).toBe(false);
  });

  it("gives a student a star", async () => {
    const teacher = await joinedTeacher();
    join("s1", "student", "Ani");
    await waitFor(() => expect(teacher.result.current.participants).toHaveLength(1));

    act(() => teacher.result.current.giveStar("s1"));
    act(() => teacher.result.current.giveStar("s1"));
    await waitFor(() => expect(room().participantStates?.s1?.stars).toBe(2));
  });

  it("removes a student who leaves", async () => {
    await joinedTeacher();
    const student = join("s1", "student", "Ani");
    await waitFor(() => expect(room().activeParticipants).toEqual(["t1", "s1"]));

    act(() => student.result.current.leave());
    expect(student.onExit).toHaveBeenCalledWith("left");
    await waitFor(() => expect(room().activeParticipants).toEqual(["t1"]));
    expect(room().participantStates).not.toHaveProperty("s1");
  });

  it("ends the meeting for everyone", async () => {
    const teacher = await joinedTeacher();
    const student = join("s1", "student", "Ani");
    await waitFor(() => expect(room().activeParticipants).toContain("s1"));

    await act(() => teacher.result.current.endForAll());

    expect(teacher.onExit).toHaveBeenCalledWith("endedByMe");
    expect(room()).toMatchObject({ isEnded: true, status: "ended", ended_by: "t1", activeParticipants: [] });
    await waitFor(() => expect(student.onExit).toHaveBeenCalledWith("endedByTeacher"));
  });

  it("works without a microphone and says so", async () => {
    installFakeMedia({ micAllowed: false });
    const student = join("s1", "student", "Ani");
    await waitFor(() => expect(student.result.current.micAvailable).toBe(false));
    expect(student.result.current.notice?.kind).toBe("micUnavailable");
  });
});
