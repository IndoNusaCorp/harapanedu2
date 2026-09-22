import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { seedAccount, seedFirestore, signInAs } from "@/test/fakeFirebase";
import { router } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { useRole } from "@/context/RoleContext";
import LandingPage from "./page";

function ClassLevel() {
  return <p data-testid="level">{String(useRole().classLevel)}</p>;
}

beforeEach(() => {
  seedFirestore({ users: { t1: { role_id: "2" }, s1: { role_id: "1", class: 3 } } });
});

describe("Landing page", () => {
  it("introduces the app to visitors", async () => {
    await renderWithProviders(<LandingPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "HarapanEdu" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent)).toEqual(["Pelajar", "Pengajar", "LibraAI"]);
  });

  it("sends a logged-in teacher straight to their dashboard", async () => {
    signInAs("t1");
    await renderWithProviders(<LandingPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/pengajar/t1"));
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("sets kids mode before redirecting an elementary student", async () => {
    signInAs("s1");
    await renderWithProviders(<><LandingPage /><ClassLevel /></>);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/pelajar/s1"));
    expect(screen.getByTestId("level")).toHaveTextContent("3");
  });

  it("signs in from the landing page and opens the right dashboard", async () => {
    seedAccount("sari@sekolah.id", "rahasia123", "t1");
    await renderWithProviders(<LandingPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mulai Sekarang" }));

    fireEvent.change(screen.getByPlaceholderText("nama@contoh.com"), { target: { value: "sari@sekolah.id" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "rahasia123" } });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/pengajar/t1"));
  });
});
