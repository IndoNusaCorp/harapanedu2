import { describe, it, expect, afterEach, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { seedFirestore, signInAs } from "@/test/fakeFirebase";
import { router } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { KidsTopbar } from "./KidsTopbar";

afterEach(() => vi.useRealTimers());

const at = (hour: number) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 21, hour, 0));
};

describe("KidsTopbar", () => {
  it.each([
    [7, "Selamat Pagi, Ani! 🌅"],
    [12, "Selamat Siang, Ani! ☀️"],
    [16, "Selamat Sore, Ani! 🌤️"],
    [20, "Selamat Malam, Ani! 🌙"],
  ])("greets the student by time of day (%s:00)", async (hour, greeting) => {
    at(hour);
    seedFirestore({ users: { s1: { first_name: "Ani", role_id: "1", class: 2 } } });
    signInAs("s1");
    await renderWithProviders(<KidsTopbar />, { classLevel: 2 });

    expect(await screen.findByText(greeting)).toBeInTheDocument();
    expect(screen.getByText("Pelajar · Kelas 2 SD ⭐")).toBeInTheDocument();
  });

  it("shows the kids sign-in button when logged out", async () => {
    await renderWithProviders(<KidsTopbar />);
    fireEvent.click(await screen.findByRole("button", { name: "Masuk 🚀" }));
    expect(screen.getByText("Selamat Datang Kembali")).toBeInTheDocument();
  });

  it("logs out to the landing page", async () => {
    seedFirestore({ users: { s1: { first_name: "Ani", role_id: "1", class: 2 } } });
    signInAs("s1");
    await renderWithProviders(<KidsTopbar />, { classLevel: 2 });

    fireEvent.click(await screen.findByTitle("Keluar"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
  });
});
