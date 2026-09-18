import { describe, it, expect } from "vitest";
import { GRADE_MARKER } from "../tone";
import { scorpioGET, scorpioGradingInstruction, scorpioPOST, scorpioSystemInstruction } from "./scorpioai";

const user = (role: "teacher" | "student", classLevel = 0) => ({ uid: "u1", role, classLevel, name: "Tester" });
const post = (body: unknown) => new Request("http://localhost/api/ScorpioAI", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("ScorpioAI", () => {
  it("adds the grade button marker only for teachers", () => {
    expect(scorpioSystemInstruction(user("teacher"), {}, [])).toContain(GRADE_MARKER);
    const student = scorpioSystemInstruction(user("student", 2), {}, []);
    expect(student).not.toContain(GRADE_MARKER);
    expect(student).toContain("TIDAK DAPAT memberi atau mengubah nilai");
    expect(student).toContain("NILAI DI BAWAH 70");
  });

  it("grading instruction follows the locale for feedback", () => {
    expect(scorpioGradingInstruction("en")).toContain("dalam English");
    expect(scorpioGradingInstruction()).toContain("Bahasa Indonesia");
  });

  it("rejects requests without a login token", async () => {
    expect((await scorpioGET(new Request("http://localhost/api/ScorpioAI"))).status).toBe(401);
    expect((await scorpioPOST(post({ message: "halo" }))).status).toBe(401);
    expect((await scorpioPOST(post({ action: "grade", submissionIds: ["x"] }))).status).toBe(401);
  });
});
