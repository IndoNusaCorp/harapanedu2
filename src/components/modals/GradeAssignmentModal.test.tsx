import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { GradeAssignmentModal } from "./GradeAssignmentModal";

const score = () => screen.getByPlaceholderText("95");

describe("GradeAssignmentModal", () => {
  it("grades a student's assignment", async () => {
    const onSuccess = vi.fn();
    await renderWithProviders(<GradeAssignmentModal isOpen onClose={vi.fn()} onSuccess={onSuccess} assignmentTitle="PR Pecahan" studentName="Ani" />);

    expect(screen.getByText("Ani")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("mis. Sejarah Indonesia")).toBeNull(); // course comes from the assignment
    fireEvent.change(score(), { target: { value: "87" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "B+" } });
    fireEvent.change(screen.getByPlaceholderText("Umpan balik untuk siswa..."), { target: { value: "Bagus" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Nilai" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({
      id: undefined, course_name: "", score: 87, grade_letter: "B+", feedback: "Bagus", credits: 3,
    }));
  });

  it.each(["-1", "101", "abc"])("rejects the score %s", async (value) => {
    const onSuccess = vi.fn();
    await renderWithProviders(<GradeAssignmentModal isOpen onClose={vi.fn()} onSuccess={onSuccess} assignmentTitle="PR" />);
    fireEvent.change(score(), { target: { value } });
    fireEvent.submit(score().closest("form")!);

    expect(screen.getByText("Skor harus antara 0-100.")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("asks for the course when grading without an assignment", async () => {
    const onSuccess = vi.fn();
    await renderWithProviders(<GradeAssignmentModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByPlaceholderText("mis. Sejarah Indonesia"), { target: { value: "Sejarah" } });
    fireEvent.change(score(), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Nilai" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ course_name: "Sejarah", score: 70 })));
  });

  it("edits an existing grade", async () => {
    const onSuccess = vi.fn();
    await renderWithProviders(
      <GradeAssignmentModal isOpen onClose={vi.fn()} onSuccess={onSuccess} assignmentTitle="PR"
        initialData={{ id: "g1", score: 60, grade_letter: "D", credits: 2, feedback: "Ulangi" }} />,
    );
    expect(score()).toHaveValue(60);
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "g1", score: 60, grade_letter: "D", credits: 2, course_name: "PR" })));
  });
});
