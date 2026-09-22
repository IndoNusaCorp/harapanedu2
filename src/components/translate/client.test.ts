import { describe, it, expect } from "vitest";
import { renderHookWithProviders } from "@/test/render";
import { useCurrentLocale, useI18n, useScopedI18n } from "./client";

describe("i18n client", () => {
  it("translates with the dictionary of the active locale", async () => {
    const id = await renderHookWithProviders(() => ({ t: useI18n(), locale: useCurrentLocale() }), { locale: "id" });
    const en = await renderHookWithProviders(() => ({ t: useI18n(), locale: useCurrentLocale() }), { locale: "en" });

    expect(id.result.current.locale).toBe("id");
    expect(id.result.current.t("roles.teacher")).toBe("Pengajar");
    expect(en.result.current.locale).toBe("en");
    expect(en.result.current.t("roles.teacher")).toBe("Teacher");
  });

  it("fills in placeholders and picks the plural form from {count}", async () => {
    const { result } = await renderHookWithProviders(() => useI18n(), { locale: "en" });

    expect(result.current("classLevel.elementary", { grade: 4 })).toBe("Grade 4 · Elementary");
    expect(result.current("dashboard.participants", { count: 1 })).toBe("1 Participant");
    expect(result.current("dashboard.participants", { count: 3 })).toBe("3 Participants");
  });

  it("scopes keys", async () => {
    const { result } = await renderHookWithProviders(() => useScopedI18n("status"), { locale: "id" });
    expect(result.current("graded")).toBe("Dinilai");
  });
});
