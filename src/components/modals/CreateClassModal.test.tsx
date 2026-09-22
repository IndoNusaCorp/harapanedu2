import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { CreateClassModal } from "./CreateClassModal";

const type = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

describe("CreateClassModal", () => {
  it("submits the new class with its schedule and material file", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const { container } = await renderWithProviders(<CreateClassModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    type("mis. MTK - 201", "Matematika 4A");
    type("mis. Aljabar II", "Matematika");
    type("Ruang 302", "R-12");
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: "2026-10-05T09:30" } });
    const file = new File(["x"], "bab1.pdf", { type: "application/pdf" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(screen.getByText("File dipilih: bab1.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Buat Kelas" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalledWith({
      id: undefined, name: "Matematika 4A", course_name: "Matematika", description: "", schedule: "2026-10-05T09:30", room: "R-12", materi_file: file,
    });
  });

  it("rejects blank names", async () => {
    const onSuccess = vi.fn();
    await renderWithProviders(<CreateClassModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);
    type("mis. MTK - 201", "   ");
    type("mis. Aljabar II", "Matematika");
    fireEvent.click(screen.getByRole("button", { name: "Buat Kelas" }));

    expect(screen.getByText("Nama kelas dan nama mata pelajaran wajib diisi.")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("edits an existing class", async () => {
    const onSuccess = vi.fn();
    await renderWithProviders(
      <CreateClassModal isOpen onClose={vi.fn()} onSuccess={onSuccess} initialData={{ id: "c1", name: "IPA 4B", course_name: "IPA", room: "Lab" }} />,
    );
    expect(screen.getByRole("heading", { name: "Ubah Kelas" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("mis. MTK - 201")).toHaveValue("IPA 4B");

    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", name: "IPA 4B", room: "Lab" })));
  });

  it("keeps the form open with an error when saving fails", async () => {
    const onClose = vi.fn();
    await renderWithProviders(<CreateClassModal isOpen onClose={onClose} onSuccess={vi.fn().mockRejectedValue(new Error("x"))} />);
    type("mis. MTK - 201", "A");
    type("mis. Aljabar II", "B");
    fireEvent.click(screen.getByRole("button", { name: "Buat Kelas" }));

    expect(await screen.findByText("Gagal menyimpan kelas. Silakan coba lagi.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from the backdrop but not from inside the dialog", async () => {
    const onClose = vi.fn();
    const { container } = await renderWithProviders(<CreateClassModal isOpen onClose={onClose} onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByPlaceholderText("mis. MTK - 201"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(container.firstElementChild!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
