import { describe, it, expect, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { seedFirestore } from "@/test/fakeFirebase";
import { router, setNavigation } from "@/test/navigation";
import { renderHookWithProviders } from "@/test/render";
import type { Meeting } from "@/lib/types";
import { isMeetingLive, useMeetingLobby } from "./useMeetingLobby";

const meeting = (over: Partial<Meeting>) => ({ title: "Kelas", time: "", participants: 0, status: "upcoming", link: "", ...over });

beforeEach(() => {
  setNavigation({ pathname: "/id/pelajar/s1/meetings", params: { role: "pelajar", id: "s1" } });
  seedFirestore({
    users: { s1: { first_name: "Ani", last_name: "Putri" }, t1: { username: "busari" } },
    meetings: {
      m1: meeting({ title: "Lama", created_at: "2026-09-01" }),
      m2: meeting({ title: "Live", status: "live", created_at: "2026-09-03" }),
      m3: meeting({ title: "Selesai", status: "ended", isEnded: true, created_at: "2026-09-02" }),
    },
  });
});

const load = async (role: "student" | "teacher" = "student") => {
  const hook = await renderHookWithProviders(() => useMeetingLobby(), { role });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await waitFor(() => expect(hook.result.current.name).not.toBe(""));
  return hook;
};

describe("isMeetingLive", () => {
  it("is live only while started and not ended", () => {
    expect(isMeetingLive(meeting({ id: "a", status: "live" }) as Meeting)).toBe(true);
    expect(isMeetingLive(meeting({ id: "a", status: "live", isEnded: true }) as Meeting)).toBe(false);
    expect(isMeetingLive(meeting({ id: "a" }) as Meeting)).toBe(false);
  });
});

describe("useMeetingLobby", () => {
  it("lists meetings newest first and loads the user's name", async () => {
    const { result } = await load();
    expect(result.current.meetings.map(m => m.title)).toEqual(["Live", "Selesai", "Lama"]);
    expect(result.current.name).toBe("Ani Putri");
    expect(result.current.uid).toBe("s1");
  });

  it("updates in realtime when a meeting is added", async () => {
    const { result } = await load();
    seedFirestore({ meetings: { m4: meeting({ title: "Baru", created_at: "2026-09-09" }) } });
    await waitFor(() => expect(result.current.meetings[0].title).toBe("Baru"));
  });

  it("keeps students out of a meeting that has ended, but lets teachers restart it", async () => {
    const student = await load("student");
    act(() => student.result.current.join(student.result.current.meetings[1]));
    expect(student.result.current.activeMeeting).toBeNull();
    expect(student.result.current.exitReason).toBe("notStarted");

    setNavigation({ params: { role: "pengajar", id: "t1" } });
    const teacher = await load("teacher");
    act(() => teacher.result.current.join(teacher.result.current.meetings[1]));
    expect(teacher.result.current.activeMeeting?.title).toBe("Selesai");
  });

  it("joins the meeting from a notification link and cleans the URL", async () => {
    setNavigation({ search: "join=m2" });
    const { result } = await load();
    await waitFor(() => expect(result.current.activeMeeting?.id).toBe("m2"));
    expect(router.replace).toHaveBeenCalledWith("/id/pelajar/s1/meetings");
  });

  it("shows why the user left, except when they left themselves", async () => {
    const { result } = await load();
    act(() => result.current.join(result.current.meetings[0]));
    act(() => result.current.onExit("endedByTeacher"));
    expect(result.current).toMatchObject({ activeMeeting: null, exitReason: "endedByTeacher" });

    act(() => result.current.dismissExit());
    act(() => result.current.join(result.current.meetings[0]));
    act(() => result.current.onExit("left"));
    expect(result.current.exitReason).toBeNull();
  });
});
