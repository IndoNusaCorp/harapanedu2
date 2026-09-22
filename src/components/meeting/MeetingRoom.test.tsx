import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc, seedFirestore, signInAs } from "@/test/fakeFirebase";
import { installFakeMedia } from "@/test/meeting";
import { renderWithProviders } from "@/test/render";
import type { Meeting } from "@/lib/types";
import { MeetingRoom } from "./MeetingRoom";

const peerjs = await vi.hoisted(async () => (await import("@/test/meeting")).fakePeerJs());
vi.mock("peerjs", () => peerjs.module);
vi.mock("@/lib/meeting/cameraEffects", async () => (await import("@/test/meeting")).fakeCameraEffects());

const meeting: Meeting = { id: "m1", title: "Kelas Pecahan", time: "", participants: 0, status: "live", link: "", class_id: "c1" };
const room = () => getFirestoreDoc("meetings/m1") as unknown as Meeting;
const teacherState = () => ({ name: "Bu Sari", role: "teacher", mute: true, camera: false, hand: false, effect: "none", lastSeen: Date.now() });

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  installFakeMedia();
  peerjs.peers.length = 0;
});

const enter = (as: "student" | "teacher", withTeacher = true) => {
  seedFirestore({
    meetings: {
      m1: {
        ...meeting,
        host_id: withTeacher ? "t1" : undefined,
        started_at: new Date(Date.now() - 65_000).toISOString(),
        activeParticipants: withTeacher && as === "student" ? ["t1"] : [],
        participantStates: withTeacher && as === "student" ? { t1: teacherState() } : {},
      },
    },
  });
  const uid = as === "teacher" ? "t1" : "s1";
  signInAs(uid);
  const onExit = vi.fn();
  const rendered = renderWithProviders(
    <MeetingRoom meeting={meeting} uid={uid} role={as} name={as === "teacher" ? "Bu Sari" : "Ani"} variant="default" onExit={onExit} />,
    { role: as },
  );
  return { onExit, rendered };
};
const joined = (uid: string) => waitFor(() => expect(room().activeParticipants).toContain(uid));
const button = (name: string) => screen.getByRole("button", { name });

describe("MeetingRoom: student", () => {
  it("shows the room with everyone in it", async () => {
    await enter("student").rendered;
    await joined("s1");

    expect(screen.getByRole("heading", { name: "Kelas Pecahan" })).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(await screen.findByText("Ani (Anda)")).toBeInTheDocument();
    expect(screen.getByText("Bu Sari")).toBeInTheDocument();
    expect(screen.queryByText("Menunggu pengajar bergabung...")).toBeNull();
  });

  it("tells students when the teacher isn't there", async () => {
    await enter("student", false).rendered;
    expect(await screen.findByText("Menunggu pengajar bergabung...")).toBeInTheDocument();
  });

  it("turns the mic on and shares the new state", async () => {
    await enter("student").rendered;
    await joined("s1");
    await waitFor(() => expect(button("Nyalakan mic")).toBeInTheDocument());

    fireEvent.click(button("Nyalakan mic"));
    expect(await screen.findByRole("button", { name: "Matikan mic" })).toBeInTheDocument();
    await waitFor(() => expect(room().participantStates?.s1?.mute).toBe(false));
  });

  it("raises a hand and picks a camera effect", async () => {
    await enter("student").rendered;
    await joined("s1");

    fireEvent.click(button("Angkat tangan"));
    expect(await screen.findByText("✋ 1")).toBeInTheDocument();
    await waitFor(() => expect(room().participantStates?.s1?.hand).toBe(true));

    fireEvent.click(button("Efek kamera"));
    expect(screen.getByText("Nyalakan kamera untuk melihat efeknya.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mahkota/ }));
    await waitFor(() => expect(room().participantStates?.s1?.effect).toBe("crown"));
  });

  it("sends a reaction that floats up for everyone", async () => {
    await enter("student").rendered;
    await joined("s1");

    fireEvent.click(button("Reaksi"));
    fireEvent.click(screen.getByRole("button", { name: "👏" }));

    await waitFor(() => expect(Object.values(getFirestoreData("meetings/m1/reactions"))).toEqual([
      expect.objectContaining({ emoji: "👏", uid: "s1", name: "Ani" }),
    ]));
    // Shown as a floating reaction with the sender's name
    await waitFor(() => expect(screen.getAllByText("👏")).toHaveLength(2));
  });

  it("chats, and counts unread messages while the chat is closed", async () => {
    await enter("student").rendered;
    await joined("s1");

    seedFirestore({ "meetings/m1/messages": { a: { uid: "t1", name: "Bu Sari", role: "teacher", text: "Selamat pagi", created_at: new Date(Date.now() + 1000).toISOString() } } });
    const chatButton = await screen.findByRole("button", { name: "Chat" });
    await waitFor(() => expect(within(chatButton).getByText("1")).toBeInTheDocument());

    fireEvent.click(chatButton);
    expect(screen.getByText("Selamat pagi")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Tulis pesan..."), { target: { value: "Pagi Bu!" } });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));
    expect(await screen.findByText("Pagi Bu!")).toBeInTheDocument();
  });

  it("leaves the meeting", async () => {
    const { onExit, rendered } = enter("student");
    await rendered;
    await joined("s1");

    fireEvent.click(button("Keluar"));
    expect(onExit).toHaveBeenCalledWith("left");
    await waitFor(() => expect(room().activeParticipants).toEqual(["t1"]));
  });

  it("warns when the microphone is blocked", async () => {
    installFakeMedia({ micAllowed: false });
    await enter("student").rendered;
    expect(await screen.findByText("Mikrofon tidak bisa diakses. Periksa izin mikrofon di browser.")).toBeInTheDocument();
  });
});

describe("MeetingRoom: teacher", () => {
  it("has no student-only controls and can end the meeting for everyone", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { onExit, rendered } = enter("teacher");
    await rendered;
    await joined("t1");

    expect(screen.queryByRole("button", { name: "Angkat tangan" })).toBeNull();
    fireEvent.click(button("Keluar"));
    fireEvent.click(screen.getByRole("button", { name: "Akhiri untuk semua" }));

    expect(window.confirm).toHaveBeenCalledWith("Akhiri pertemuan ini untuk semua peserta?");
    await waitFor(() => expect(onExit).toHaveBeenCalledWith("endedByMe"));
    expect(room()).toMatchObject({ isEnded: true, status: "ended", activeParticipants: [] });
  });

  it("keeps the meeting going when the teacher cancels ending it", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const { onExit, rendered } = enter("teacher");
    await rendered;
    await joined("t1");

    fireEvent.click(button("Keluar"));
    fireEvent.click(screen.getByRole("button", { name: "Akhiri untuk semua" }));
    expect(onExit).not.toHaveBeenCalled();
    expect(room().isEnded).toBe(false);
  });
});
