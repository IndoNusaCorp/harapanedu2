import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { stubLibraBackend, withVoice } from "@/test/libra";
import { renderWithProviders } from "@/test/render";
import { loginAs } from "@/test/school";
import KidsLibraAI from "./KidsLibraAI";

const live = await vi.hoisted(async () => (await import("@/test/voice")).fakeLive());
vi.mock("@google/genai", () => live.module);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  stubLibraBackend("Pecahan itu seperti membagi pizza 🍕");
});

const open = () => renderWithProviders(withVoice(<KidsLibraAI />, "/pelajar/s1"), loginAs("s1", "/libraai"));

describe("KidsLibraAI", () => {
  it("greets the child and answers a question", async () => {
    await open();
    expect(await screen.findByText("Halo! Aku robot LibraAI ✨")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Tanya LibraAI Disini");
    fireEvent.change(input, { target: { value: "Apa itu pecahan?" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("Pecahan itu seperti membagi pizza 🍕")).toBeInTheDocument();
    expect(screen.getAllByText("🤖").length).toBeGreaterThan(0); // kids avatar
  });

  it("starts a voice chat with kid-friendly wording", async () => {
    await open();
    const { default: id } = await import("@/components/translate/id");
    fireEvent.click(await screen.findByTitle(id.kids.libra.voiceStart));
    expect(await screen.findByText("Aku mendengarkan... 👂")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Berhenti Ngobrol/ })).toBeInTheDocument();
  });
});
