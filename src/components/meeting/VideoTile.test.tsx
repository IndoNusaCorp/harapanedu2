import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import type { MeetingParticipant } from "@/hooks/useMeetingRoom";
import { useMeetingLabels, type MeetingVariant } from "./labels";
import { ScreenView, VideoTile, hashIndex } from "./VideoTile";

const person = (over: Partial<MeetingParticipant> = {}): MeetingParticipant => ({
  uid: "s1", isMe: false, name: "budi", role: "student", mute: false, camera: false, hand: false, effect: "none", lastSeen: 0, ...over,
});
const stream = () => ({ getAudioTracks: () => [], getTracks: () => [] }) as unknown as MediaStream;

function Tile({ variant = "default", ...props }: Omit<React.ComponentProps<typeof VideoTile>, "label" | "variant"> & { variant?: MeetingVariant }) {
  const label = useMeetingLabels(variant);
  return <VideoTile {...props} variant={variant} label={label} />;
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

describe("VideoTile", () => {
  it("shows an initial instead of video while the camera is off", async () => {
    const { container } = await renderWithProviders(<Tile participant={person()} stream={stream()} />);
    expect(screen.getByText("B")).toBeInTheDocument();
    // Other participants' media stays attached (hidden) so they can still be heard
    expect(container.querySelector("video")).toHaveClass("opacity-0");
  });

  it("shows the video when the camera is on", async () => {
    const s = stream();
    const { container } = await renderWithProviders(<Tile participant={person({ camera: true })} stream={s} />);
    const video = container.querySelector("video")!;
    expect(video).not.toHaveClass("opacity-0");
    expect(video.srcObject).toBe(s);
    expect(screen.queryByText("B")).toBeNull();
  });

  it("mutes and labels the user's own tile", async () => {
    const { container } = await renderWithProviders(<Tile participant={person({ isMe: true, camera: true, name: "Ani" })} stream={stream()} />);
    expect(screen.getByText("Ani (Anda)")).toBeInTheDocument();
    expect((container.querySelector("video") as HTMLVideoElement).muted).toBe(true);
  });

  it("does not attach the user's own media while their camera is off", async () => {
    const { container } = await renderWithProviders(<Tile participant={person({ isMe: true })} stream={stream()} />);
    expect(container.querySelector("video")).toBeNull();
  });

  it("shows teacher badge, stars, effect and raised hand", async () => {
    await renderWithProviders(<Tile participant={person({ role: "teacher", name: "Bu Sari", stars: 3, effect: "crown", hand: true, mute: true })} stream={null} />);
    expect(screen.getByText("Pengajar")).toBeInTheDocument();
    expect(screen.getByText("⭐ 3")).toBeInTheDocument();
    expect(screen.getByText("👑")).toBeInTheDocument();
    expect(document.querySelector(".animate-wiggle")).not.toBeNull();
  });

  it("uses an animal avatar for kids and a teacher avatar for the teacher", async () => {
    await renderWithProviders(<>
      <Tile variant="kids" participant={person({ uid: "abc" })} stream={null} />
      <Tile variant="kids" participant={person({ uid: "t1", role: "teacher", name: "Guru" })} stream={null} />
    </>);
    expect(screen.getByText(["🐼", "🦊", "🐯", "🐸", "🐵", "🐰", "🐻", "🐨", "🦁", "🐧"][hashIndex("abc", 10)])).toBeInTheDocument();
    expect(screen.getByText("🧑‍🏫")).toBeInTheDocument();
  });

  it("pins on click", async () => {
    const onPin = vi.fn();
    await renderWithProviders(<Tile participant={person()} stream={null} onPin={onPin} />);
    fireEvent.click(screen.getByText("budi"));
    expect(onPin).toHaveBeenCalled();
  });

  it("hashIndex is stable and in range", () => {
    expect(hashIndex("s1", 6)).toBe(hashIndex("s1", 6));
    for (const id of ["a", "b", "teacher-99", ""]) expect(hashIndex(id, 6)).toBeLessThan(6);
  });
});

describe("ScreenView", () => {
  it("shows the shared screen with its label, or a placeholder while connecting", async () => {
    const { container, rerender } = await renderWithProviders(<ScreenView stream={null} label="Bu Sari sedang berbagi layar" variant="default" />);
    expect(screen.getByText("🖥️")).toBeInTheDocument();
    rerender(<ScreenView stream={stream()} label="Bu Sari sedang berbagi layar" variant="default" />);
    expect(container.querySelector("video")).not.toBeNull();
    expect(screen.getByText("Bu Sari sedang berbagi layar")).toBeInTheDocument();
  });
});
