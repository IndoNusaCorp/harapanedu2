import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { CreateEventModal } from "./CreateEventModal";

const type = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

describe("CreateEventModal", () => {
  it("creates an event on the day that was clicked", async () => {
    const onSuccess = vi.fn();
    const { container } = await renderWithProviders(<CreateEventModal isOpen onClose={vi.fn()} onSuccess={onSuccess} defaultDate="2026-10-12" />);

    expect(container.querySelector('input[type="date"]')).toHaveValue("2026-10-12");
    type("mis. Ujian Tengah Semester", "UTS Matematika");
    fireEvent.click(screen.getByRole("button", { name: "Ujian" }));
    type("10.00", "08.00");
    fireEvent.click(screen.getByRole("button", { name: "Tambah Acara" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({
      id: undefined, title: "UTS Matematika", description: "", event_date: "2026-10-12", event_time: "08.00",
      location: "", event_type: "exam", meeting_link: "",
    }));
  });

  it("asks for a link only for meetings", async () => {
    await renderWithProviders(<CreateEventModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.queryByPlaceholderText("https://zoom.us/j/...")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pertemuan" }));
    expect(screen.getByPlaceholderText("https://zoom.us/j/...")).toBeInTheDocument();
  });

  it("rejects a blank title (the browser only checks that it is not empty)", async () => {
    const onSuccess = vi.fn();
    await renderWithProviders(<CreateEventModal isOpen onClose={vi.fn()} onSuccess={onSuccess} defaultDate="2026-10-12" />);
    type("mis. Ujian Tengah Semester", "   ");
    fireEvent.click(screen.getByRole("button", { name: "Tambah Acara" }));
    expect(screen.getByText("Judul dan tanggal wajib diisi.")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("loads an event for editing", async () => {
    const onSuccess = vi.fn();
    await renderWithProviders(
      <CreateEventModal isOpen onClose={vi.fn()} onSuccess={onSuccess}
        initialData={{ id: "e1", title: "Rapat", event_date: "2026-10-01", event_type: "meeting", meeting_link: "https://zoom.us/j/1" }} />,
    );
    expect(screen.getByPlaceholderText("https://zoom.us/j/...")).toHaveValue("https://zoom.us/j/1");
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "e1", event_type: "meeting" })));
  });
});
