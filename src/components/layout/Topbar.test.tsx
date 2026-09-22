import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { authModule, seedFirestore, signInAs } from "@/test/fakeFirebase";
import { router, setNavigation } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { Topbar } from "./Topbar";

describe("Topbar", () => {
  it("offers sign-in when logged out", async () => {
    await renderWithProviders(<Topbar />);
    fireEvent.click(await screen.findByRole("button", { name: "Masuk / Daftar" }));
    expect(screen.getByText("Selamat Datang Kembali")).toBeInTheDocument();
  });

  it("shows the logged-in teacher's name and role", async () => {
    seedFirestore({ users: { t1: { first_name: "Sari", last_name: "Dewi", role_id: "2" } } });
    signInAs("t1");
    await renderWithProviders(<Topbar />, { role: "teacher" });

    expect(await screen.findByText("Sari Dewi")).toBeInTheDocument();
    expect(screen.getByText("Pengajar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lihat notifikasi/ })).toBeInTheDocument();
  });

  it("shows a student's class level", async () => {
    seedFirestore({ users: { s1: { username: "budi", role_id: "1", class: 8 } } });
    signInAs("s1");
    await renderWithProviders(<Topbar />);
    expect(await screen.findByText("Pelajar · Kelas 2 SMP")).toBeInTheDocument();
  });

  it("switches to the kids top bar for elementary students", async () => {
    seedFirestore({ users: { s1: { first_name: "Ani", role_id: "1", class: 3 } } });
    signInAs("s1");
    await renderWithProviders(<Topbar />);
    expect(await screen.findByPlaceholderText("Cari tugas atau kelas...")).toBeInTheDocument();
  });

  it("falls back to the email name when the profile is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    signInAs("u1", "rina.w@sekolah.id");
    await renderWithProviders(<Topbar />);
    expect(await screen.findAllByText("rina.w")).not.toHaveLength(0);
  });

  it("puts the search text in ?q, keeping other query params", async () => {
    setNavigation({ pathname: "/id/pelajar/s1/assignment", search: "status=active" });
    await renderWithProviders(<Topbar />);

    const input = screen.getByPlaceholderText("Cari tugas...");
    fireEvent.change(input, { target: { value: "pecahan" } });
    expect(router.replace).toHaveBeenLastCalledWith("/id/pelajar/s1/assignment?status=active&q=pecahan");
  });

  it("clears ?q when the search is emptied", async () => {
    setNavigation({ pathname: "/id/pelajar/s1/my-classes", search: "q=ipa" });
    await renderWithProviders(<Topbar />);

    const input = screen.getByPlaceholderText("Cari kelas...");
    expect(input).toHaveValue("ipa");
    fireEvent.change(input, { target: { value: "" } });
    expect(router.replace).toHaveBeenLastCalledWith("/id/pelajar/s1/my-classes?");
  });

  it("logs out and goes to the landing page", async () => {
    seedFirestore({ users: { t1: { first_name: "Sari", role_id: "2" } } });
    signInAs("t1");
    const signOut = vi.spyOn(authModule, "signOut");
    await renderWithProviders(<Topbar />, { role: "teacher" });

    fireEvent.click(await screen.findByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
    expect(signOut).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Masuk / Daftar" })).toBeInTheDocument();
  });
});
