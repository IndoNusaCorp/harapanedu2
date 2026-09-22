import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { setNavigation } from "@/test/navigation";
import { useRole } from "@/context/RoleContext";
import { Sidebar } from "./Sidebar";

const links = () => Object.fromEntries(screen.getAllByRole("link").map(a => [a.textContent, a.getAttribute("href")]));

describe("Sidebar", () => {
  it("links a student's menu to their own pages", async () => {
    await renderWithProviders(<Sidebar basePath="/pelajar/s1" />, { role: "student" });

    expect(links()).toEqual({
      Dasbor: "/pelajar/s1",
      "Kelas Saya": "/pelajar/s1/my-classes",
      Tugas: "/pelajar/s1/assignment",
      Nilai: "/pelajar/s1/grades",
      Jadwal: "/pelajar/s1/calendar",
      LibraAI: "/pelajar/s1/libraai",
      Pertemuan: "/pelajar/s1/meetings",
      Pengaturan: "/pelajar/s1/settings",
      "Pusat Bantuan": "/pelajar/s1/help",
      Tentang: "/pelajar/s1/about",
    });
  });

  it("shows teachers 'My Work' instead of 'My Classes', in English too", async () => {
    await renderWithProviders(<Sidebar basePath="/pengajar/t1" />, { role: "teacher", locale: "en" });
    expect(screen.getByRole("link", { name: "My Work" })).toHaveAttribute("href", "/pengajar/t1/my-work");
    expect(screen.queryByRole("link", { name: "My Classes" })).toBeNull();
  });

  it("highlights the current page, ignoring the locale prefix and sub-pages of assignments", async () => {
    setNavigation({ pathname: "/id/pelajar/s1/assignment/a9" });
    await renderWithProviders(<Sidebar basePath="/pelajar/s1" />);

    expect(screen.getByRole("link", { name: "Tugas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dasbor" })).not.toHaveAttribute("aria-current");
  });

  it("highlights the dashboard only on the dashboard itself", async () => {
    setNavigation({ pathname: "/en/pelajar/s1" });
    await renderWithProviders(<Sidebar basePath="/pelajar/s1" />);
    expect(screen.getAllByRole("link").filter(a => a.getAttribute("aria-current") === "page").map(a => a.textContent)).toEqual(["Dasbor"]);
  });

  it("closes the mobile menu", async () => {
    function Harness() {
      const { isSidebarOpen, setSidebarOpen } = useRole();
      return (
        <>
          <button onClick={() => setSidebarOpen(true)}>buka</button>
          <span data-testid="open">{String(isSidebarOpen)}</span>
          <Sidebar basePath="/pelajar/s1" />
        </>
      );
    }
    await renderWithProviders(<Harness />);
    fireEvent.click(screen.getByText("buka"));
    expect(screen.getByTestId("open")).toHaveTextContent("true");

    fireEvent.click(screen.getByText("Tutup menu"));
    expect(screen.getByTestId("open")).toHaveTextContent("false");
  });
});
