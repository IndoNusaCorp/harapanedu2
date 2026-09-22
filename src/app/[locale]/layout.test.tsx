import React from "react";
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import RootLayout, { generateMetadata } from "./layout";

const params = (locale: string) => Promise.resolve({ locale });

describe("Root layout", () => {
  it("uses the page title and description of the requested language", async () => {
    expect(await generateMetadata({ params: params("id") })).toEqual({
      title: "HarapanEdu - Sistem Pendidikan Sekolah Dian Harapan",
      description: "Platform pendidikan digital untuk Sekolah Dian Harapan",
    });
    expect((await generateMetadata({ params: params("en") })).title).toBe("HarapanEdu - Sekolah Dian Harapan Education System");
  });

  it("falls back to Indonesian metadata for unknown locales", async () => {
    expect((await generateMetadata({ params: params("fr") })).title).toBe("HarapanEdu - Sistem Pendidikan Sekolah Dian Harapan");
  });

  it("sets the document language and fonts", async () => {
    const html = (await RootLayout({ children: <p>isi</p>, params: params("en") })) as React.ReactElement<{ lang: string; className: string; children: React.ReactElement }>;
    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("en");
    expect(html.props.className).toContain("--font-inter");
    expect(html.props.className).toContain("--font-geist-mono");
  });

  it("wraps pages in the theme, language and role providers", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
    const html = (await RootLayout({ children: <p>isi halaman</p>, params: params("id") })) as React.ReactElement<{ children: React.ReactElement<{ children: React.ReactNode }> }>;
    const body = html.props.children;
    // Render the body's content (everything inside <body>)
    await renderWithProviders(<>{body.props.children}</>);
    expect(screen.getByText("isi halaman")).toBeInTheDocument();
  });
});
