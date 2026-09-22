import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { seedFirestore } from "@/test/fakeFirebase";
import { setNavigation } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";
import { CreateAssignmentModal } from "./CreateAssignmentModal";

const type = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
const TITLE = "mis. Esai Sejarah: Kerajaan Majapahit";
const classSelect = () => document.querySelector("select")!;
const COURSE = "mis. Sejarah Indonesia";

describe("CreateAssignmentModal", () => {
  const openAsTeacher = (props: Partial<React.ComponentProps<typeof CreateAssignmentModal>> = {}) => {
    setNavigation({ params: { role: "pengajar", id: "t1" } });
    seedFirestore({
      classes: {
        c1: { name: "Matematika 4A", course_name: "Matematika", teacher_id: "t1" },
        c2: { name: "IPA 4A", course_name: "IPA", teacher_id: "t1" },
        c9: { name: "Kelas Guru Lain", course_name: "Seni", teacher_id: "t2" },
      },
    });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    return { onSuccess, onClose, render: renderWithProviders(<CreateAssignmentModal isOpen onClose={onClose} onSuccess={onSuccess} {...props} />) };
  };

  it("offers only the logged-in teacher's classes", async () => {
    const { render } = openAsTeacher();
    await render;
    await screen.findByRole("option", { name: "Matematika 4A" });
    expect(screen.getAllByRole("option").map(o => o.textContent)).toEqual(["Semua kelas", "Matematika 4A", "IPA 4A"]);
  });

  it("fills the course from the chosen class and submits an ISO due date", async () => {
    const { render, onSuccess, onClose } = openAsTeacher();
    const { container } = await render;
    await screen.findByRole("option", { name: "IPA 4A" });

    type(TITLE, "PR Tumbuhan");
    fireEvent.change(classSelect(), { target: { value: "c2" } });
    expect(screen.getByPlaceholderText(COURSE)).toHaveValue("IPA");
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: "2026-10-01T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat Tugas" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalledWith({
      id: undefined, title: "PR Tumbuhan", course_name: "IPA", description: "",
      due_date: new Date("2026-10-01T08:00").toISOString(), class_id: "c2", materi_file: null,
    });
  });

  it("does not overwrite a course the teacher typed", async () => {
    const { render } = openAsTeacher();
    await render;
    await screen.findByRole("option", { name: "IPA 4A" });
    type(COURSE, "Biologi Dasar");
    fireEvent.change(classSelect(), { target: { value: "c2" } });
    expect(screen.getByPlaceholderText(COURSE)).toHaveValue("Biologi Dasar");
  });

  it("preselects the class it was opened from", async () => {
    const { render } = openAsTeacher({ defaultClassId: "c1" });
    await render;
    await waitFor(() => expect(classSelect()).toHaveValue("c1"));
    expect(screen.getByPlaceholderText(COURSE)).toHaveValue("Matematika");
  });

  it("rejects a blank title (the browser only checks that it is not empty)", async () => {
    const { render, onSuccess } = openAsTeacher();
    const { container } = await render;
    type(TITLE, "  ");
    type(COURSE, "IPA");
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: "2026-10-01T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat Tugas" }));
    expect(screen.getByText("Judul, nama mata pelajaran, dan tenggat wajib diisi.")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // KNOWN BUG: the due date is shown as UTC in a local datetime-local input, so saving an edit without
  // touching the date moves the deadline back by the UTC offset (7 hours in WIB) every time.
  // Remove `.fails` once CreateAssignmentModal formats the date in local time.
  it.fails("edits an assignment, keeping its due date", async () => {
    const { render, onSuccess } = openAsTeacher({
      initialData: { id: "a1", title: "PR Pecahan", course_name: "Matematika", due_date: "2026-10-01T08:00:00.000Z", class_id: "c1" },
    });
    await render;
    expect(screen.getByRole("heading", { name: "Ubah Tugas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      id: "a1", title: "PR Pecahan", due_date: "2026-10-01T08:00:00.000Z", class_id: "c1",
    })));
  });
});
