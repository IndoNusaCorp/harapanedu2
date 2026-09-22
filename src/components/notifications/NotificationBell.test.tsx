import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getFirestoreDoc, seedFirestore, signInAs } from "@/test/fakeFirebase";
import { router } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { NotificationProvider } from "@/context/NotificationContext";
import { NotificationBell } from "./NotificationBell";

const renderBell = () => renderWithProviders(
  <NotificationProvider uid="s1" basePath="/pelajar/s1"><NotificationBell /></NotificationProvider>,
);
const bell = () => screen.getByRole("button", { name: /Lihat notifikasi/ });

beforeEach(() => {
  signInAs("s1");
  seedFirestore({
    users: { s1: { first_name: "Ani", notifications_read_at: "2026-09-12T00:00:00Z" } },
    notifications: {
      a: { type: "assignment", title: "PR Pecahan", body: "Matematika", ref_id: "a1", audience: "student", created_at: "2026-09-15T00:00:00Z" },
      b: { type: "grade_received", title: "IPA", course_name: "IPA", score: 90, recipient_id: "s1", assignment_id: "a2", audience: "student", created_at: "2026-09-11T00:00:00Z" },
      c: { type: "grade_received", title: "IPS", recipient_id: "s2", audience: "student", created_at: "2026-09-16T00:00:00Z" },
    },
  });
});

describe("NotificationBell", () => {
  it("shows the unread count", async () => {
    await renderBell();
    await waitFor(() => expect(within(bell()).getByText("1")).toBeInTheDocument());
  });

  it("lists the user's notifications with the new ones marked", async () => {
    await renderBell();
    await waitFor(() => within(bell()).getByText("1"));
    fireEvent.click(bell());

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Tugas baru");
    expect(items[0]).toHaveTextContent("PR Pecahan");
    expect(items[1]).toHaveTextContent("Tugas kamu sudah dinilai, IPA kamu mendapatkan 90");
    expect(screen.queryByText(/IPS/)).toBeNull();
  });

  it("marks everything read when the list is closed", async () => {
    await renderBell();
    await waitFor(() => within(bell()).getByText("1"));
    fireEvent.click(bell());
    fireEvent.click(bell());

    await waitFor(() => expect(within(bell()).queryByText("1")).toBeNull());
    await waitFor(() => expect(getFirestoreDoc("users/s1")?.notifications_read_at).not.toBe("2026-09-12T00:00:00Z"));
  });

  it("opens the notification's page", async () => {
    await renderBell();
    await waitFor(() => within(bell()).getByText("1"));
    fireEvent.click(bell());
    fireEvent.click(screen.getByText("PR Pecahan"));

    expect(router.push).toHaveBeenCalledWith("/pelajar/s1/assignment/a1");
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("closes on Escape", async () => {
    await renderBell();
    fireEvent.click(bell());
    expect(bell()).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(bell()).toHaveAttribute("aria-expanded", "false");
  });

  it("shows an empty state when nothing is addressed to the user", async () => {
    signInAs("t1");
    await renderWithProviders(
      <NotificationProvider uid="t1" basePath="/pengajar/t1"><NotificationBell /></NotificationProvider>,
      { role: "teacher" },
    );
    fireEvent.click(bell());
    expect(screen.getByRole("listitem")).toHaveTextContent("Belum ada notifikasi.");
  });
});
