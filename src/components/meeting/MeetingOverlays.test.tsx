import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ConfettiLayer, ReactionLayer } from "./MeetingOverlays";

afterEach(() => vi.useRealTimers());

describe("ReactionLayer", () => {
  const reactions = [
    { id: "r1", emoji: "👏", name: "Ani", left: 10, drift: 20 },
    { id: "r2", emoji: "❤️", name: "Budi", left: 50, drift: -20 },
  ];

  it("floats each reaction with its sender's name", () => {
    render(<ReactionLayer reactions={reactions} showNames />);
    expect(screen.getByText("👏")).toBeInTheDocument();
    expect(screen.getByText("Budi")).toBeInTheDocument();
    expect(screen.getByText("❤️").parentElement).toHaveStyle({ left: "50%" });
  });

  it("can hide names", () => {
    render(<ReactionLayer reactions={reactions} showNames={false} />);
    expect(screen.queryByText("Ani")).toBeNull();
  });
});

describe("ConfettiLayer", () => {
  it("bursts confetti for 3 seconds each time the key changes", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<ConfettiLayer burstKey={0} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ConfettiLayer burstKey={1} />);
    expect(container.querySelectorAll("span")).toHaveLength(70);

    act(() => vi.advanceTimersByTime(2999));
    expect(container).not.toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(1));
    expect(container).toBeEmptyDOMElement();

    rerender(<ConfettiLayer burstKey={2} />);
    expect(container.querySelectorAll("span")).toHaveLength(70);
  });
});
