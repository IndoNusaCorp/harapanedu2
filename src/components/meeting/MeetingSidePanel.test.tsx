import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import type { MeetingParticipant, MeetingRoomState } from "@/hooks/useMeetingRoom";
import { useMeetingLabels } from "./labels";
import { MeetingSidePanel, type SidePanelTab } from "./MeetingSidePanel";

const person = (over: Partial<MeetingParticipant>): MeetingParticipant => ({
  uid: "x", isMe: false, name: "X", role: "student", mute: false, camera: false, hand: false, effect: "none", lastSeen: 0, ...over,
});

const makeRoom = (over: Partial<MeetingRoomState> = {}) => ({
  isTeacher: true,
  self: person({ uid: "t1", isMe: true, name: "Bu Sari", role: "teacher" }),
  participants: [
    person({ uid: "s1", name: "Ani", hand: true, stars: 2 }),
    person({ uid: "s2", name: "Budi", mute: true }),
  ],
  pendingShareRequests: [],
  screenShare: null,
  messages: [],
  muteAll: vi.fn(),
  lowerAllHands: vi.fn(),
  lowerHand: vi.fn(),
  giveStar: vi.fn(),
  stopOthersShare: vi.fn(),
  respondShareRequest: vi.fn(),
  sendMessage: vi.fn(),
  ...over,
}) as unknown as MeetingRoomState;

function Panel({ room, tab = "people", unreadChat = 0, onTab = vi.fn(), onClose = vi.fn() }: {
  room: MeetingRoomState; tab?: SidePanelTab; unreadChat?: number; onTab?: (t: SidePanelTab) => void; onClose?: () => void;
}) {
  const label = useMeetingLabels("default");
  return <MeetingSidePanel room={room} tab={tab} onTab={onTab} onClose={onClose} variant="default" label={label} unreadChat={unreadChat} />;
}
const row = (name: string) => screen.getByText(name, { exact: false }).closest("div.flex.items-center") as HTMLElement;

describe("MeetingSidePanel: people", () => {
  it("lists everyone, starting with the user", async () => {
    await renderWithProviders(<Panel room={makeRoom()} />);
    expect(screen.getByRole("button", { name: "Peserta (3)" })).toBeInTheDocument();
    expect(screen.getByText("Bu Sari (Anda)")).toBeInTheDocument();
    expect(within(row("Ani")).getByText("⭐ 2")).toBeInTheDocument();
    expect(screen.getByText("✋")).toBeInTheDocument();
  });

  it("gives the teacher controls for each student", async () => {
    const room = makeRoom();
    await renderWithProviders(<Panel room={room} />);

    fireEvent.click(screen.getByRole("button", { name: "Bisukan semua" }));
    fireEvent.click(screen.getByRole("button", { name: "Turunkan semua tangan" }));
    fireEvent.click(within(row("Ani")).getByTitle("Turunkan tangan"));
    fireEvent.click(within(row("Budi")).getByTitle("Beri bintang"));

    expect(room.muteAll).toHaveBeenCalled();
    expect(room.lowerAllHands).toHaveBeenCalled();
    expect(room.lowerHand).toHaveBeenCalledWith("s1");
    expect(room.giveStar).toHaveBeenCalledWith("s2");
    expect(within(row("Budi")).queryByTitle("Turunkan tangan")).toBeNull();
  });

  it("disables 'lower all hands' when no hand is raised", async () => {
    await renderWithProviders(<Panel room={makeRoom({ participants: [person({ uid: "s2", name: "Budi" })] })} />);
    expect(screen.getByRole("button", { name: "Turunkan semua tangan" })).toBeDisabled();
  });

  it("lets the teacher answer screen-share requests and stop a student's share", async () => {
    const room = makeRoom({
      pendingShareRequests: [{ uid: "s1", name: "Ani", status: "pending", at: "" }],
      screenShare: { uid: "s2", name: "Budi" },
    });
    await renderWithProviders(<Panel room={room} />);

    expect(screen.getByText("Ani ingin berbagi layar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Izinkan" }));
    fireEvent.click(screen.getByRole("button", { name: "Tolak" }));
    fireEvent.click(within(row("Budi")).getByTitle("Hentikan berbagi layar"));

    expect(room.respondShareRequest).toHaveBeenNthCalledWith(1, "s1", true);
    expect(room.respondShareRequest).toHaveBeenNthCalledWith(2, "s1", false);
    expect(room.stopOthersShare).toHaveBeenCalled();
  });

  it("shows students no controls", async () => {
    await renderWithProviders(<Panel room={makeRoom({ isTeacher: false })} />);
    expect(screen.queryByRole("button", { name: "Bisukan semua" })).toBeNull();
    expect(screen.queryByTitle("Beri bintang")).toBeNull();
  });
});

describe("MeetingSidePanel: chat", () => {
  it("shows the unread count on the chat tab and switches tabs", async () => {
    const onTab = vi.fn();
    await renderWithProviders(<Panel room={makeRoom()} unreadChat={4} onTab={onTab} />);
    const chatTab = screen.getByRole("button", { name: /^Chat/ });
    expect(within(chatTab).getByText("4")).toBeInTheDocument();
    fireEvent.click(chatTab);
    expect(onTab).toHaveBeenCalledWith("chat");
  });

  it("shows messages and sends new ones", async () => {
    const room = makeRoom({
      messages: [
        { id: "1", uid: "s1", name: "Ani", role: "student", text: "Halo Bu", created_at: "2026-09-21T02:00:00Z" },
        { id: "2", uid: "t1", name: "Bu Sari", role: "teacher", text: "Halo Ani", created_at: "2026-09-21T02:01:00Z" },
      ],
    });
    await renderWithProviders(<Panel room={room} tab="chat" />);

    expect(screen.getByText("Ani")).toBeInTheDocument(); // sender shown for others
    expect(screen.queryByText("Bu Sari · Pengajar")).toBeNull(); // not for own messages
    const input = screen.getByPlaceholderText("Tulis pesan...");
    expect(screen.getByRole("button", { name: "Kirim" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "Siap" } });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));

    expect(room.sendMessage).toHaveBeenCalledWith("Siap");
    expect(input).toHaveValue("");
  });

  it("invites the first message", async () => {
    await renderWithProviders(<Panel room={makeRoom()} tab="chat" />);
    expect(screen.getByText("Belum ada pesan. Mulai obrolan!")).toBeInTheDocument();
  });
});
