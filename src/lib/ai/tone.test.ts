import { describe, it, expect } from "vitest";
import { gradeLetter, jenjangOf, parseClassLevel } from "./tone";

describe("parseClassLevel", () => {
  it("parses numbers, numeric strings, and 'Kelas N JENJANG' strings", () => {
    expect(parseClassLevel(4)).toBe(4);
    expect(parseClassLevel("7")).toBe(7);
    expect(parseClassLevel("Kelas 1 SD")).toBe(1);
    expect(parseClassLevel("Kelas 2 SMP")).toBe(8);
    expect(parseClassLevel("Kelas 3 SMA")).toBe(12);
  });

  it("falls back to 0 for empty or invalid values", () => {
    expect(parseClassLevel(undefined)).toBe(0);
    expect(parseClassLevel("")).toBe(0);
    expect(parseClassLevel("Kelas X SD")).toBe(0);
  });
});

describe("tone helpers", () => {
  it("maps class levels to jenjang", () => {
    expect(jenjangOf(3)).toBe("SD");
    expect(jenjangOf(9)).toBe("SMP");
    expect(jenjangOf(10)).toBe("SMA");
    expect(jenjangOf(0)).toBeNull();
  });

  it("converts scores to grade letters", () => {
    expect([95, 85, 75, 65, 30].map(gradeLetter)).toEqual(["A", "B", "C", "D", "E"]);
  });
});
