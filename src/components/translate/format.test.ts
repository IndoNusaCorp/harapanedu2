import { describe, it, expect } from "vitest";
import { renderHookWithProviders } from "@/test/render";
import { useClassLabel, useDateFormat, useLocaleTag, useMeetingStatusLabel, useRoleLabel, useStatusLabel } from "./format";

const inLocale = async <T,>(hook: () => T, locale: "id" | "en") => (await renderHookWithProviders(hook, { locale })).result.current;

describe("useDateFormat", () => {
  const date = new Date(2026, 8, 14, 13, 5);

  it("formats dates in Indonesian", async () => {
    const f = await inLocale(useDateFormat, "id");
    expect(f.short(date)).toBe("14 Sep");
    expect(f.long(date)).toBe("14 September 2026");
    expect(f.full(date)).toBe("Senin, 14 September 2026");
    expect(f.pattern(date, "EEEE")).toBe("Senin");
  });

  it("formats dates in English", async () => {
    const f = await inLocale(useDateFormat, "en");
    expect(f.short(date)).toBe("Sep 14");
    expect(f.long(date)).toBe("September 14th, 2026");
    expect(f.full(date)).toBe("Monday, September 14th, 2026");
  });

  it("accepts ISO strings and timestamps", async () => {
    const f = await inLocale(useDateFormat, "id");
    expect(f.short("2026-01-05T10:00:00")).toBe("5 Jan");
    expect(f.short(date.getTime())).toBe("14 Sep");
  });
});

describe("label helpers", () => {
  it("returns the BCP-47 tag for number/date APIs", async () => {
    expect(await inLocale(useLocaleTag, "id")).toBe("id-ID");
    expect(await inLocale(useLocaleTag, "en")).toBe("en-US");
  });

  it("names class levels by school stage", async () => {
    const label = await inLocale(useClassLabel, "id");
    expect([1, 6, 7, 9, 10, 12, 0].map(label)).toEqual([
      "Kelas 1 SD", "Kelas 6 SD", "Kelas 1 SMP", "Kelas 3 SMP", "Kelas 1 SMA", "Kelas 3 SMA", "Kelas 0",
    ]);
  });

  it("maps every meeting status spelling to a label", async () => {
    const label = await inLocale(useMeetingStatusLabel, "id");
    expect([undefined, "scheduled", "LIVE", "ongoing", "completed", "finished"].map(label)).toEqual([
      "Mendatang", "Mendatang", "Berlangsung", "Berlangsung", "Selesai", "Selesai",
    ]);
    expect(label("postponed")).toBe("postponed");
  });

  it("translates assignment statuses and roles", async () => {
    const status = await inLocale(useStatusLabel, "en");
    const role = await inLocale(useRoleLabel, "id");
    expect(status("started")).not.toBe("started");
    expect(status("unknown")).toBe("unknown");
    expect([role("teacher"), role("student"), role(undefined)]).toEqual(["Pengajar", "Pelajar", "Tamu"]);
  });
});
