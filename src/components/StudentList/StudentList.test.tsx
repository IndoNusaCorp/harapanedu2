import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { seedFirestore, signInAs } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { StudentListModal } from "./StudentList";

beforeEach(() => {
  seedFirestore({
    users: {
      s1: { role_id: "1", first_name: "Ani", middle_name: "Sri", last_name: "Putri" },
      s2: { role_id: "1", first_name: "Budi", last_name: "Santoso" },
      s3: { role_id: "1" },
      t1: { role_id: "2", first_name: "Bu", last_name: "Guru" },
    },
  });
});

const open = () => renderWithProviders(<StudentListModal isOpen onClose={vi.fn()} />, { role: "teacher" });

describe("StudentListModal", () => {
  it("denies access when logged out", async () => {
    await open();
    expect(await screen.findByText("Akses Ditolak")).toBeInTheDocument();
    expect(screen.queryByText("Ani Sri Putri")).toBeNull();
  });

  it("lists every student with their full name, but not teachers", async () => {
    signInAs("t1");
    await open();
    expect(await screen.findByText("Ani Sri Putri")).toBeInTheDocument();
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.queryByText("Bu Guru")).toBeNull();
  });

  it("searches by first, middle or last name", async () => {
    signInAs("t1");
    await open();
    await screen.findByText("Ani Sri Putri");
    const search = screen.getByPlaceholderText("Cari siswa...");

    fireEvent.change(search, { target: { value: "SRI" } });
    expect(screen.getByText("Ani Sri Putri")).toBeInTheDocument();
    expect(screen.queryByText("Budi Santoso")).toBeNull();

    fireEvent.change(search, { target: { value: "santoso" } });
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("Siswa tidak ditemukan")).toBeInTheDocument();
  });
});
