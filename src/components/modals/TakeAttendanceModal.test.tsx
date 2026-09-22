import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { getFirestoreData, getFirestoreDoc, seedFirestore, signInAs } from "@/test/fakeFirebase";
import { renderWithProviders } from "@/test/render";
import { TakeAttendanceModal } from "./TakeAttendanceModal";

const type = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
const attendances = () => Object.values(getFirestoreData("attendances"));
const now = (date: Date) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);
};

beforeEach(() => {
  seedFirestore({ classes: { c1: { name: "Matematika 4A", teacher_id: "t1" } } });
  signInAs("s1", "ani@sekolah.id", "Ani Putri");
});
afterEach(() => vi.useRealTimers());

const open = (props: Partial<React.ComponentProps<typeof TakeAttendanceModal>> = {}) => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  return { onClose, onSuccess, rendered: renderWithProviders(<TakeAttendanceModal isOpen onClose={onClose} classId="c1" onSuccess={onSuccess} {...props} />) };
};
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Kirim Kehadiran" }));

describe("TakeAttendanceModal", () => {
  it("fills the name from the account and shows today's date", async () => {
    now(new Date(2026, 8, 21, 8, 0));
    await open().rendered;
    expect(screen.getByPlaceholderText("Budi")).toHaveValue("Ani");
    expect(screen.getByPlaceholderText("Santoso")).toHaveValue("Putri");
    expect(screen.getByText("21 September 2026")).toBeInTheDocument();
  });

  it("records attendance before the class starts as present", async () => {
    now(new Date(2026, 8, 21, 8, 55));
    const { onSuccess, onClose, rendered } = open({ schedule: "2026-09-21T09:00" });
    await rendered;
    submit();

    expect(await screen.findByText("Kehadiran Tercatat!")).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalled();
    expect(attendances()).toEqual([expect.objectContaining({ class_id: "c1", student_id: "s1", first_name: "Ani", last_name: "Putri", status: "Attended" })]);
    expect(getFirestoreDoc("classes/c1")).toMatchObject({ attendance: 1, course_progress: 1 });
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it("marks attendance after the scheduled start as late", async () => {
    now(new Date(2026, 8, 21, 9, 10));
    await open({ schedule: "2026-09-21T09:00" }).rendered;
    submit();
    await screen.findByText("Kehadiran Tercatat!");
    expect(attendances()[0].status).toBe("Late");
  });

  it.each([
    [9, "Attended"],
    [10, "Late"],
  ])("without a schedule, counts %s:00 as %s", async (hour, status) => {
    now(new Date(2026, 8, 21, hour, 0));
    await open().rendered;
    submit();
    await screen.findByText("Kehadiran Tercatat!");
    expect(attendances()[0].status).toBe(status);
  });

  it("records an excused absence with the reason and uploaded proof", async () => {
    now(new Date(2026, 8, 21, 8, 0));
    const { container } = await open().rendered;

    fireEvent.click(screen.getByRole("button", { name: "Tidak Hadir" }));
    type("Penjelasan singkat", "Demam");
    const photo = new File(["img"], "surat-dokter.jpg", { type: "image/jpeg" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [photo] } });
    expect(screen.getByText("surat-dokter.jpg")).toBeInTheDocument();
    submit();

    await screen.findByText("Kehadiran Tercatat!");
    const [record] = attendances();
    expect(record).toMatchObject({ status: "ExcusedAbsen", reason: "Demam", proof_url: expect.stringContaining("surat-dokter.jpg") });
    expect(Object.values(getFirestoreData("notifications")).find(n => n.audience === "teacher")).toMatchObject({
      type: "attendance_absent", recipient_id: "t1", reason: "Demam", proof_url: record.proof_url,
    });
  });

  it("records an unexcused absence", async () => {
    await open().rendered;
    fireEvent.click(screen.getByRole("button", { name: "Tidak Hadir" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Absence" } });
    submit();
    await screen.findByText("Kehadiran Tercatat!");
    expect(attendances()[0]).toMatchObject({ status: "Absence" });
    expect(getFirestoreDoc("classes/c1")).toMatchObject({ absence: 1 });
  });

  it("requires a first and last name", async () => {
    signInAs("s1");
    await open().rendered;
    type("Budi", "Ani");
    type("Santoso", "  ");
    submit();
    expect(screen.getByText("Nama depan dan nama belakang wajib diisi.")).toBeInTheDocument();
    expect(attendances()).toEqual([]);
  });

  it("shows an error when the class no longer exists", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await open({ classId: "deleted" }).rendered;
    submit();
    expect(await screen.findByText("Gagal mencatat kehadiran.")).toBeInTheDocument();
  });
});
