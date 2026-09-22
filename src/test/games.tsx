import React from "react";
import { vi } from "vitest";
import { signInAs } from "./fakeFirebase";
import { setNavigation } from "./navigation";
import { renderWithProviders } from "./render";

// Renders a kids game as a logged-in grade-2 student, with a predictable "random" question.
export async function renderGame(ui: React.ReactElement, { random = 0, locale = "id" as "id" | "en", role = "student" as "student" | "teacher" } = {}) {
  vi.spyOn(Math, "random").mockReturnValue(random);
  signInAs("s1");
  setNavigation({ params: { role: role === "teacher" ? "pengajar" : "pelajar", id: "s1" } });
  return renderWithProviders(ui, { locale, role, classLevel: role === "student" ? 2 : null });
}
