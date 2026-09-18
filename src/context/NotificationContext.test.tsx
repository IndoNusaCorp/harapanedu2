import { describe, it, expect } from "vitest";
import { isForUser, notificationPath } from "./NotificationContext";
import type { AppNotification } from "@/lib/types";

const n = (over: Partial<AppNotification>): AppNotification => ({
  id: "n1", type: "class", title: "Kelas", ref_id: "r1", audience: "student", created_at: "2026-09-16T00:00:00Z", ...over,
});

describe("notifications", () => {
  it("shows notifications only to the matching audience and not to their creator", () => {
    expect(isForUser(n({}), "s1", "student")).toBe(true);
    expect(isForUser(n({}), "t1", "teacher")).toBe(false);
    expect(isForUser(n({ audience: "all" }), "t1", "teacher")).toBe(true);
    expect(isForUser(n({ audience: "all", created_by: "t1" }), "t1", "teacher")).toBe(false);
  });

  it("shows grade notifications only to their recipient, including the grading teacher", () => {
    const given = n({ type: "grade_given", audience: "teacher", recipient_id: "t1", created_by: "t1" });
    const received = n({ type: "grade_received", audience: "student", recipient_id: "s1", created_by: "t1" });
    expect(isForUser(given, "t1", "teacher")).toBe(true);
    expect(isForUser(given, "t2", "teacher")).toBe(false);
    expect(isForUser(received, "s1", "student")).toBe(true);
    expect(isForUser(received, "s2", "student")).toBe(false);
  });

  it("links each notification type to the right page", () => {
    const base = "/pelajar/s1";
    expect(notificationPath(n({ type: "class" }), base)).toBe("/pelajar/s1/my-classes");
    expect(notificationPath(n({ type: "assignment", ref_id: "a9" }), base)).toBe("/pelajar/s1/assignment/a9");
    expect(notificationPath(n({ type: "meeting" }), base)).toBe("/pelajar/s1/meetings");
    expect(notificationPath(n({ type: "meeting_live", ref_id: "m3" }), base)).toBe("/pelajar/s1/meetings?join=m3");
    expect(notificationPath(n({ type: "grade_received", assignment_id: "a2" }), base)).toBe("/pelajar/s1/assignment/a2");
    expect(notificationPath(n({ type: "grade_received" }), base)).toBe("/pelajar/s1/grades");
    expect(notificationPath(n({ type: "attendance_taken" }), base)).toBe("/pelajar/s1/my-classes");
    expect(notificationPath(n({ type: "attendance_absent" }), base)).toBe("/pelajar/s1/my-work");
  });
});
