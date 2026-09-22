import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { CreateMeetingModal } from "./CreateMeetingModal";

const type = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

describe("CreateMeetingModal", () => {
  it("schedules an upcoming meeting", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    await renderWithProviders(<CreateMeetingModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    type("mis. Aljabar II - Review Mingguan", "Review Pecahan");
    type("mis. Hari ini, 14.00", "Senin, 09.00");
    fireEvent.click(screen.getByRole("button", { name: "Jadwalkan Pertemuan" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalledWith({ id: undefined, title: "Review Pecahan", time: "Senin, 09.00", link: "", participants: 0, status: "upcoming" });
  });

  it("keeps the status of a meeting being edited", async () => {
    const onSuccess = vi.fn();
    await renderWithProviders(
      <CreateMeetingModal isOpen onClose={vi.fn()} onSuccess={onSuccess} initialData={{ id: "m1", title: "Live", time: "Now", status: "live", participants: 4 }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "m1", status: "live", participants: 4 })));
  });

  it("requires a title and time", async () => {
    const onSuccess = vi.fn();
    await renderWithProviders(<CreateMeetingModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);
    type("mis. Aljabar II - Review Mingguan", "Review");
    type("mis. Hari ini, 14.00", "   ");
    fireEvent.click(screen.getByRole("button", { name: "Jadwalkan Pertemuan" }));
    expect(screen.getByText("Judul dan waktu wajib diisi.")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
