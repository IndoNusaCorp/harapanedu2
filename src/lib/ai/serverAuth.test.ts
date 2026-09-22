import { describe, it, expect, beforeEach } from "vitest";
import { seedFirestore } from "@/test/fakeFirebase";
import { aiRequest, stubNetwork } from "@/test/ai";
import { fullName, verifyRequestUser } from "./serverAuth";

let fetchMock: ReturnType<typeof stubNetwork>;
beforeEach(() => {
  fetchMock = stubNetwork();
});

describe("verifyRequestUser", () => {
  it("rejects requests without a Bearer token without calling Google", async () => {
    expect(await verifyRequestUser(aiRequest("http://x/api"))).toBeNull();
    expect(await verifyRequestUser(new Request("http://x/api", { headers: { Authorization: "Basic abc" } }))).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects tokens that Google does not accept", async () => {
    const req = new Request("http://x/api", { headers: { Authorization: "Bearer forged" } });
    expect(await verifyRequestUser(req)).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toContain("key=test-api-key");
  });

  it("takes role, class and name from Firestore, not from the request", async () => {
    seedFirestore({
      users: {
        t1: { role_id: "2", first_name: "Bu", last_name: "Sari" },
        s1: { role_id: "1", class: "Kelas 2 SMP", username: "ani" },
      },
    });
    expect(await verifyRequestUser(aiRequest("http://x/api", { uid: "t1" }))).toEqual({ uid: "t1", role: "teacher", classLevel: 0, name: "Bu Sari" });
    expect(await verifyRequestUser(aiRequest("http://x/api", { uid: "s1" }))).toEqual({ uid: "s1", role: "student", classLevel: 8, name: "ani" });
  });

  it("treats a user without a profile as a student named after their email", async () => {
    expect(await verifyRequestUser(aiRequest("http://x/api", { uid: "new" }))).toEqual({ uid: "new", role: "student", classLevel: 0, name: "new" });
  });
});

describe("fullName", () => {
  it("prefers first + last name, then name, then username", () => {
    expect(fullName({ first_name: "Ani", last_name: "Putri", name: "x" })).toBe("Ani Putri");
    expect(fullName({ last_name: "Putri" })).toBe("Putri");
    expect(fullName({ name: "Budi", username: "b" })).toBe("Budi");
    expect(fullName({ username: "citra" })).toBe("citra");
    expect(fullName(undefined)).toBe("");
  });
});
