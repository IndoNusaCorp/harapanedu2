import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import * as XLSX from "xlsx";
import { renderWithProviders } from "@/test/render";
import { ViewMateriModal } from "./ViewMateriModal";

const viewers = vi.hoisted(() => ({
  renderAsync: vi.fn(async (_buf: ArrayBuffer, el: HTMLElement) => { el.innerHTML = "<section class='docx'>Isi dokumen Word</section>"; }),
  pptx: { currentIndex: 0, slideCount: 3 },
  pdfPages: 2,
}));
vi.mock("docx-preview", () => ({ renderAsync: viewers.renderAsync }));
vi.mock("pptx-preview", () => ({
  init: () => {
    const p = viewers.pptx;
    return {
      get currentIndex() { return p.currentIndex; },
      get slideCount() { return p.slideCount; },
      preview: async () => {},
      renderNextSlide: () => { p.currentIndex++; },
      renderPreSlide: () => { p.currentIndex--; },
      destroy: vi.fn(),
    };
  },
}));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    destroy: vi.fn(),
    promise: Promise.resolve({
      numPages: viewers.pdfPages,
      getPage: async () => ({
        getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    }),
  }),
}));

const serve = (body: BodyInit | null, status = 200) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));

beforeEach(() => {
  viewers.pptx.currentIndex = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});

const open = (props: Partial<React.ComponentProps<typeof ViewMateriModal>>) => {
  const onClose = vi.fn();
  const rendered = renderWithProviders(<ViewMateriModal isOpen onClose={onClose} materiUrl="https://files/x" materiName="Materi" {...props} />);
  return { onClose, rendered };
};

describe("ViewMateriModal", () => {
  it("renders nothing without a file", async () => {
    await renderWithProviders(<ViewMateriModal isOpen onClose={vi.fn()} materiUrl={null} materiName={null} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows images directly, with a download link", async () => {
    await open({ materiUrl: "https://files/foto.png", materiName: "Foto Praktikum" }).rendered;
    expect(screen.getByRole("dialog", { name: "Foto Praktikum" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto Praktikum" })).toHaveAttribute("src", "https://files/foto.png");
    expect(screen.getByRole("link", { name: /Unduh/ })).toHaveAttribute("href", "https://files/foto.png");
  });

  it("detects the file type from a Firebase Storage URL when the title has no extension", async () => {
    await open({
      materiUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/class_materi%2F123_bab1.jpeg?alt=media",
      materiName: "Materi Bab 1",
    }).rendered;
    expect(screen.getByText("IMG")).toBeInTheDocument();
  });

  it("offers a download for files it can't preview", async () => {
    await open({ materiUrl: "https://files/arsip.zip", materiName: "arsip.zip" }).rendered;
    expect(screen.getByText("Pratinjau Tidak Tersedia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Unduh File/ })).toHaveAttribute("href", "https://files/arsip.zip");
  });

  it("renders every sheet of a spreadsheet as a table", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Nama", "Nilai"], ["Ani", 90]]), "Kelas A");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Nama"], ["Budi"]]), "Kelas B");
    serve(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    await open({ materiName: "nilai.xlsx" }).rendered;

    expect(await screen.findByRole("cell", { name: "Ani" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kelas B" }));
    expect(screen.getByRole("cell", { name: "Budi" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Ani" })).toBeNull();
  });

  it("renders Word documents", async () => {
    serve("docx-bytes");
    await open({ materiName: "tugas.docx" }).rendered;
    expect(await screen.findByText("Isi dokumen Word")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Menyiapkan dokumen...")).toBeNull());
  });

  it("draws one canvas per PDF page", async () => {
    serve("%PDF");
    const { rendered } = open({ materiName: "bab1.pdf" });
    const { container } = await rendered;
    await waitFor(() => expect(container.ownerDocument.querySelectorAll("canvas")).toHaveLength(2));
  });

  it("steps through slides with the buttons and arrow keys", async () => {
    serve("pptx-bytes");
    await open({ materiName: "slide.pptx" }).rendered;

    expect(await screen.findByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Slide sebelumnya" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Slide berikutnya" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Slide berikutnya" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("falls back to a download when the file can't be loaded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    serve(null, 404);
    await open({ materiName: "hilang.pdf" }).rendered;
    expect(await screen.findByText("Dokumen Gagal Dimuat")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Unduh File/ })).toBeInTheDocument();
  });

  it("closes with Escape, the close button or the backdrop", async () => {
    const { onClose, rendered } = open({ materiUrl: "https://files/foto.png" });
    const { container } = await rendered;
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    fireEvent.click(screen.getByRole("dialog"));
    fireEvent.click(container.firstElementChild!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
