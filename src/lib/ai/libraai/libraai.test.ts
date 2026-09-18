import { describe, it, expect } from "vitest";
import { libraGET, libraPOST, libraSystemInstruction } from "./libraai";

const user = (role: "teacher" | "student", classLevel = 0) => ({ uid: "u1", role, classLevel, name: "Tester" });
const post = (body: unknown) => new Request("http://localhost/api/LibraAI", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("LibraAI", () => {
  it("builds different instructions per role and jenjang", () => {
    const teacher = libraSystemInstruction(user("teacher"), {}, []);
    const sd = libraSystemInstruction(user("student", 2), {}, []);
    const sma = libraSystemInstruction(user("student", 11), {}, []);
    expect(teacher).toContain("Bapak/Ibu");
    expect(sd).toContain("Kamu adalah LibraAI, teman belajar");
    expect(sd).not.toBe(sma);
  });

  it("includes the Firestore data, attachable files, and locale", () => {
    const prompt = libraSystemInstruction(
      user("student", 3),
      { nilai_saya: [{ nilai: 88 }] },
      [{ id: "class_materi:c1", name: "bab1.pdf", kind: "class_materi", label: "Matematika" }],
      "en",
    );
    expect(prompt).toContain('"nilai":88');
    expect(prompt).toContain("bab1.pdf (Matematika)");
    expect(prompt).toContain("ALWAYS answer in English.");
  });

  it("rejects requests without a login token", async () => {
    expect((await libraGET(new Request("http://localhost/api/LibraAI"))).status).toBe(401);
    expect((await libraPOST(post({ message: "halo" }))).status).toBe(401);
  });
});
