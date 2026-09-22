import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AiMarkdown } from "./AiMarkdown";

describe("AiMarkdown", () => {
  it("renders markdown formatting", () => {
    render(<AiMarkdown>{"## Ringkasan\n\n**Penting:** baca bab 1\n\n- satu\n- dua"}</AiMarkdown>);
    expect(screen.getByRole("heading", { level: 2, name: "Ringkasan" })).toBeInTheDocument();
    expect(screen.getByText("Penting:").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem").map(li => li.textContent)).toEqual(["satu", "dua"]);
  });

  it("renders GFM tables inside a scrollable wrapper", () => {
    const { container } = render(<AiMarkdown>{"| No | Tugas | Nilai |\n|---|---|---|\n| 1 | PR Pecahan | 90 |"}</AiMarkdown>);
    expect(screen.getAllByRole("columnheader").map(th => th.textContent)).toEqual(["No", "Tugas", "Nilai"]);
    expect(screen.getByRole("cell", { name: "PR Pecahan" })).toBeInTheDocument();
    expect(container.querySelector("table")!.parentElement).toHaveClass("overflow-x-auto");
  });

  it("renders LaTeX math with KaTeX", () => {
    const { container } = render(<AiMarkdown>{"Luas lingkaran $L = \\pi r^2$"}</AiMarkdown>);
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).not.toContain("$L");
  });

  it("uses the kids styling in kids mode", () => {
    const { container } = render(<AiMarkdown variant="kids">{"| A |\n|---|\n| 1 |"}</AiMarkdown>);
    expect(container.firstElementChild!.className).toContain("prose-headings:text-kids-coral");
    expect(container.querySelector("table")!.parentElement).toHaveClass("border-orange-200");
  });

  it("does not render raw HTML from the AI", () => {
    const { container } = render(<AiMarkdown>{'<img src=x onerror="alert(1)"><script>alert(1)</script>'}</AiMarkdown>);
    expect(container.querySelector("img, script")).toBeNull();
  });
});
