import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetFirebase } from "@/test/fakeFirebase";
import { resetNavigation } from "@/test/navigation";

// Firebase runs in memory (see src/test/fakeFirebase.ts): tests never touch the real project.
vi.mock("firebase/app", async () => (await import("@/test/fakeFirebase")).appModule);
vi.mock("firebase/auth", async () => (await import("@/test/fakeFirebase")).authModule);
vi.mock("firebase/firestore", async () => (await import("@/test/fakeFirebase")).firestoreModule);
vi.mock("firebase/storage", async () => (await import("@/test/fakeFirebase")).storageModule);

// next/font is compiled by Next at build time
vi.mock("next/font/google", () => {
  const font = (name: string) => () => ({ className: `font-${name}`, variable: `--font-${name}`, style: { fontFamily: name } });
  return { Inter: font("inter"), Geist: font("geist"), Geist_Mono: font("geist-mono") };
});

// Browser APIs that jsdom doesn't implement
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

// `globals` is off, so Testing Library can't register its own afterEach cleanup
afterEach(() => {
  cleanup();
  resetFirebase();
  resetNavigation();
});
