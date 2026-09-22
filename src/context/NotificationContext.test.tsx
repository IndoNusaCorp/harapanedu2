import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreDoc, seedFirestore, signInAs } from "@/test/fakeFirebase";
import { router } from "@/test/navigation";
import { renderHookWithProviders, renderWithProviders } from "@/test/render";
import { useI18n } from "@/components/translate/client";
import { NotificationProvider, isForUser, notificationPath, notificationText, useNotifications } from "./NotificationContext";
import type { AppNotification } from "@/lib/types";

const n = (over: Partial<AppNotification>): AppNotification => ({
  id: "n1", type: "class", title: "Kelas", ref_id: "r1", audience: "student", created_at: "2026-09-16T00:00:00Z", ...over,
});

describe("isForUser", () => {
  it("shows notifications only to the matching audience and not to their creator", () => {
    expect(isForUser(n({}), "s1", "student")).toBe(true);
    expect(isForUser(n({}), "t1", "teacher")).toBe(false);
    expect(isForUser(n({ audience: "all" }), "t1", "teacher")).toBe(true);
    expect(isForUser(n({ audience: "all", created_by: "t1" }), "t1", "teacher")).toBe(false);
  });

  it("shows personal notifications only to their recipient, including the grading teacher", () => {
    const given = n({ type: "grade_given", audience: "teacher", recipient_id: "t1", created_by: "t1" });
    const received = n({ type: "grade_received", audience: "student", recipient_id: "s1", created_by: "t1" });
    expect(isForUser(given, "t1", "teacher")).toBe(true);
    expect(isForUser(given, "t2", "teacher")).toBe(false);
    expect(isForUser(received, "s1", "student")).toBe(true);
    expect(isForUser(received, "s2", "student")).toBe(false);
    // A recipient still has to match the audience
    expect(isForUser(received, "s1", "teacher")).toBe(false);
  });
});

describe("notificationPath", () => {
  it("links each notification type to the right page", () => {
    const base = "/pelajar/s1";
    expect(notificationPath(n({ type: "class" }), base)).toBe("/pelajar/s1/my-classes");
    expect(notificationPath(n({ type: "assignment", ref_id: "a9" }), base)).toBe("/pelajar/s1/assignment/a9");
    expect(notificationPath(n({ type: "meeting" }), base)).toBe("/pelajar/s1/meetings");
    expect(notificationPath(n({ type: "meeting_live", ref_id: "m3" }), base)).toBe("/pelajar/s1/meetings?join=m3");
    expect(notificationPath(n({ type: "grade_received", assignment_id: "a2" }), base)).toBe("/pelajar/s1/assignment/a2");
    expect(notificationPath(n({ type: "grade_received" }), base)).toBe("/pelajar/s1/grades");
    expect(notificationPath(n({ type: "attendance_taken" }), base)).toBe("/pelajar/s1/my-classes");
    expect(notificationPath(n({ type: "attendance_present" }), base)).toBe("/pelajar/s1/my-work");
    expect(notificationPath(n({ type: "attendance_absent" }), base)).toBe("/pelajar/s1/my-work");
  });
});

describe("notificationText", () => {
  const textFor = (locale: "id" | "en") => async (item: AppNotification) => {
    const { result } = await renderHookWithProviders(() => useI18n(), { locale });
    return notificationText(item, result.current);
  };

  it("builds grade messages from the data in the user's language", async () => {
    const grade = n({ type: "grade_received", title: "Matematika", course_name: "Matematika", score: 88 });
    expect(await textFor("id")(grade)).toEqual({ title: "Tugas kamu sudah dinilai, Matematika kamu mendapatkan 88, tetap semangat, ya!" });
    expect(await textFor("en")(grade)).toEqual({ title: "Your assignment has been graded, you got 88 in Matematika. Keep it up!" });
  });

  it("uses the absence type as the reason when the student gave none", async () => {
    const text = textFor("id");
    const absent = n({ type: "attendance_absent", title: "IPA", student_name: "Ani", attendance_status: "Absence" });
    expect(await text(absent)).toEqual({ title: "Ani tidak hadir karena tanpa keterangan", body: "IPA" });
    expect(await text({ ...absent, attendance_status: "ExcusedAbsen" })).toMatchObject({ title: "Ani tidak hadir karena izin" });
    expect(await text({ ...absent, reason: "sakit" })).toMatchObject({ title: "Ani tidak hadir karena sakit" });
  });

  it("shows other notifications as stored", async () => {
    expect(await textFor("id")(n({ type: "assignment", title: "PR Pecahan", body: "Matematika" }))).toEqual({ title: "PR Pecahan", body: "Matematika" });
  });
});

describe("NotificationProvider", () => {
  function Probe() {
    const ctx = useNotifications()!;
    return (
      <div>
        <p data-testid="unread">{ctx.unreadCount}</p>
        <ul>{ctx.notifications.map(item => <li key={item.id}>{item.title}{ctx.isUnread(item) ? " (baru)" : ""}</li>)}</ul>
        <button onClick={ctx.markAllRead}>tandai</button>
      </div>
    );
  }
  const renderProvider = () => renderWithProviders(
    <NotificationProvider uid="s1" basePath="/pelajar/s1"><Probe /></NotificationProvider>,
    { role: "student" },
  );

  beforeEach(() => {
    signInAs("s1");
    seedFirestore({
      users: { s1: { first_name: "Ani", notifications_read_at: "2026-09-12T00:00:00Z" } },
      notifications: {
        old: { type: "class", title: "Kelas lama", audience: "student", created_at: "2026-09-10T00:00:00Z" },
        teacherOnly: { type: "class", title: "Untuk guru", audience: "teacher", created_at: "2026-09-13T00:00:00Z" },
        mine: { type: "class", title: "Buatan saya", audience: "student", created_by: "s1", created_at: "2026-09-14T00:00:00Z" },
        fresh: { type: "assignment", title: "PR baru", audience: "student", created_at: "2026-09-15T00:00:00Z" },
      },
    });
  });

  it("lists the user's notifications newest first and counts unread ones", async () => {
    await renderProvider();

    await waitFor(() => expect(screen.getAllByRole("listitem").map(li => li.textContent)).toEqual(["PR baru (baru)", "Kelas lama"]));
    expect(screen.getByTestId("unread")).toHaveTextContent("1");
  });

  it("marks everything read and remembers it in the user's profile", async () => {
    await renderProvider();
    await waitFor(() => expect(screen.getByTestId("unread")).toHaveTextContent("1"));

    fireEvent.click(screen.getByText("tandai"));
    expect(screen.getByTestId("unread")).toHaveTextContent("0");
    await waitFor(() => expect(getFirestoreDoc("users/s1")?.notifications_read_at).not.toBe("2026-09-12T00:00:00Z"));
  });

  it("pops up a toast for a notification that arrives while the page is open, and opens it on click", async () => {
    await renderProvider();
    await waitFor(() => expect(screen.getByTestId("unread")).toHaveTextContent("1"));
    expect(screen.queryByText("Tugas baru")).toBeNull(); // old notifications don't toast

    seedFirestore({
      notifications: { live: { type: "assignment", title: "Kuis Pecahan", ref_id: "a9", audience: "student", created_at: new Date(Date.now() + 1000).toISOString() } },
    });

    const toastLabel = await screen.findByText("Tugas baru");
    expect(screen.getByTestId("unread")).toHaveTextContent("2");
    fireEvent.click(toastLabel);
    expect(router.push).toHaveBeenCalledWith("/pelajar/s1/assignment/a9");
    expect(screen.queryByText("Tugas baru")).toBeNull();
  });
});
