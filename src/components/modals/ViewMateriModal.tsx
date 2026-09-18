"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, FileText, Download, Loader2, AlertTriangle, Presentation, Sheet, Image as ImageIcon, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { useI18n } from "@/components/translate/client";

interface ViewMateriModalProps {
  isOpen: boolean;
  onClose: () => void;
  materiUrl: string | null;
  materiName: string | null;
  // Actual file name (with extension) used to detect the file type when materiName is only a display title
  fileName?: string | null;
}

type Kind = "image" | "pdf" | "docx" | "pptx" | "xlsx" | "other";
// Rendered in-app so no browser/third-party viewer UI shows up
const RENDERED_KINDS: Kind[] = ["pdf", "docx", "pptx", "xlsx"];
type Status = "loading" | "ready" | "error";
type SlidePreviewer = { currentIndex: number; slideCount: number; renderNextSlide(): void; renderPreSlide(): void };

// pptx-preview renders at a fixed size; the slide is scaled with CSS to fit the stage
const SLIDE_W = 960;
const SLIDE_H = 540;

function getKind(name?: string | null): Kind {
  const ext = name?.toLowerCase().split(".").pop() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  if (["xlsx", "csv"].includes(ext)) return "xlsx";
  return "other";
}

// Firebase Storage URLs look like .../o/class_materi%2F123_answer.pdf?alt=media
function fileNameFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname).split("/").pop() ?? null;
  } catch {
    return null;
  }
}

const kindMeta: Record<Kind, { label: string; icon: typeof FileText; tint: string }> = {
  image: { label: "IMG", icon: ImageIcon, tint: "bg-emerald-100 text-emerald-600" },
  pdf: { label: "PDF", icon: FileText, tint: "bg-rose-100 text-rose-600" },
  docx: { label: "DOCX", icon: FileText, tint: "bg-blue-100 text-blue-600" },
  pptx: { label: "PPTX", icon: Presentation, tint: "bg-orange-100 text-orange-600" },
  xlsx: { label: "XLSX", icon: Sheet, tint: "bg-green-100 text-green-600" },
  other: { label: "FILE", icon: FileText, tint: "bg-slate-200 text-slate-600" },
};

export function ViewMateriModal({ isOpen, onClose, materiUrl, materiName, fileName }: ViewMateriModalProps) {
  const t = useI18n();
  const kind = [fileName, materiName, fileNameFromUrl(materiUrl)]
    .map(getKind)
    .find((k) => k !== "other") ?? "other";
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [sheets, setSheets] = useState<{ name: string; html: string }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const previewerRef = useRef<SlidePreviewer | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideCount, setSlideCount] = useState(0);
  const [slideScale, setSlideScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const goSlide = (dir: 1 | -1) => {
    const p = previewerRef.current;
    if (!p) return;
    if (dir > 0 && p.currentIndex < p.slideCount - 1) p.renderNextSlide();
    else if (dir < 0 && p.currentIndex > 0) p.renderPreSlide();
    setSlideIndex(p.currentIndex);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen();
  };

  useEffect(() => {
    if (!isOpen || !materiUrl || !RENDERED_KINDS.includes(kind)) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    setStatus("loading");
    setSheets([]);
    setActiveSheet(0);

    (async () => {
      try {
        const res = await fetch(materiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;
        const el = containerRef.current;

        if (kind === "pdf" && el) {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
          const task = pdfjs.getDocument({ data: buffer });
          destroy = () => void task.destroy();
          const doc = await task.promise;
          el.innerHTML = "";
          const targetWidth = Math.min(el.clientWidth - 32, 1000);
          const dpr = window.devicePixelRatio || 1;
          for (let i = 1; i <= doc.numPages; i++) {
            if (cancelled) return;
            const page = await doc.getPage(i);
            const viewport = page.getViewport({ scale: (targetWidth / page.getViewport({ scale: 1 }).width) * dpr });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width / dpr}px`;
            canvas.className = "mb-6 max-w-full rounded-lg bg-white shadow-md";
            el.appendChild(canvas);
            await page.render({ canvas, viewport }).promise;
            if (i === 1 && !cancelled) setStatus("ready");
          }
        } else if (kind === "docx" && el) {
          const { renderAsync } = await import("docx-preview");
          el.innerHTML = "";
          await renderAsync(buffer, el, undefined, { className: "docx", inWrapper: true, breakPages: true });
        } else if (kind === "pptx" && el) {
          const { init } = await import("pptx-preview");
          el.innerHTML = "";
          const previewer = init(el, { width: SLIDE_W, height: SLIDE_H, mode: "slide" });
          destroy = () => {
            previewer.destroy();
            previewerRef.current = null;
          };
          await previewer.preview(buffer);
          if (cancelled) return;
          previewerRef.current = previewer;
          setSlideCount(previewer.slideCount ?? 0);
          setSlideIndex(Math.max(0, previewer.currentIndex));
        } else if (kind === "xlsx") {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(buffer, { type: "array" });
          setSheets(wb.SheetNames.map((name) => ({ name, html: XLSX.utils.sheet_to_html(wb.Sheets[name], { header: "", footer: "" }) })));
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        console.error("ViewMateriModal:", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [isOpen, materiUrl, kind]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
      if (kind === "pptx" && e.key === "ArrowRight") goSlide(1);
      if (kind === "pptx" && e.key === "ArrowLeft") goSlide(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!isOpen || kind !== "pptx") return;
    const onFullscreen = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onFullscreen);

    const area = slideAreaRef.current;
    const observer = new ResizeObserver(() => {
      if (!area) return;
      const pad = document.fullscreenElement ? 0 : 32;
      setSlideScale(Math.max(0.1, Math.min((area.clientWidth - pad) / SLIDE_W, (area.clientHeight - pad) / SLIDE_H)));
    });
    if (area) observer.observe(area);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      observer.disconnect();
      if (document.fullscreenElement) document.exitFullscreen();
    };
  }, [isOpen, kind]);

  if (!isOpen || !materiUrl) return null;

  const meta = kindMeta[kind];
  const title = materiName || t("modals.materi.defaultName");
  const isRendered = RENDERED_KINDS.includes(kind);

  const fallback = (icon: React.ReactNode, heading: string, desc: string) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">{icon}</div>
      <h3 className="mb-2 text-lg font-bold text-slate-800">{heading}</h3>
      <p className="mb-6 max-w-md text-sm text-slate-500">{desc}</p>
      <a href={materiUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-edu-blue-deep px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-[#003AA3]">
        <Download className="h-4 w-4" /> {t("modals.materi.downloadFile")}
      </a>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-edu-blue px-4 py-3 text-white sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tint}`}>
              <meta.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="line-clamp-1 text-base font-bold sm:text-lg">{title}</h2>
              <div className="flex items-center gap-2 text-xs text-white/75">
                <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-bold tracking-wide">{meta.label}</span>
                <span>{t("modals.materi.viewer")}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href={materiUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-sm font-bold transition-colors hover:bg-white/25 sm:px-4">
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">{t("common.download")}</span>
            </a>
            <button onClick={onClose} className="rounded-xl p-2 text-white/90 transition-colors hover:bg-white/15" aria-label={t("common.close")}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {kind === "xlsx" && sheets.length > 1 && (
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-3 pt-2">
            {sheets.map((s, i) => (
              <button key={s.name} onClick={() => setActiveSheet(i)} className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors ${i === activeSheet ? "bg-white text-edu-blue shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {s.name}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex-1 overflow-hidden bg-slate-100">
          {kind === "image" && (
            <div className="flex h-full w-full items-center justify-center overflow-auto p-4 sm:p-8">
              <img src={materiUrl} alt={title} className="max-h-full max-w-full rounded-xl object-contain shadow-md" />
            </div>
          )}

          {isRendered && (
            <div className={`materi-render h-full w-full overflow-auto ${status === "ready" ? "" : "invisible"}`}>
              {kind === "xlsx" ? (
                <div className="p-4 sm:p-6">
                  <div className="materi-sheet overflow-auto rounded-xl bg-white shadow-sm" dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html ?? "" }} />
                </div>
              ) : kind === "pptx" ? (
                <div ref={stageRef} className={`flex h-full w-full flex-col ${isFullscreen ? "bg-black" : "bg-slate-900"}`}>
                  <div ref={slideAreaRef} className="group/stage relative flex flex-1 items-center justify-center overflow-hidden">
                    <div className={`overflow-hidden bg-white ${isFullscreen ? "" : "rounded-lg shadow-2xl"}`} style={{ width: SLIDE_W * slideScale, height: SLIDE_H * slideScale }}>
                      <div ref={containerRef} className="materi-pptx origin-top-left" style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${slideScale})` }} />
                    </div>
                    <button onClick={() => goSlide(-1)} disabled={slideIndex <= 0} aria-label={t("modals.materi.prevSlide")} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/30 disabled:pointer-events-none disabled:opacity-0 sm:left-4 sm:h-12 sm:w-12">
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button onClick={() => goSlide(1)} disabled={slideIndex >= slideCount - 1} aria-label={t("modals.materi.nextSlide")} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/30 disabled:pointer-events-none disabled:opacity-0 sm:right-4 sm:h-12 sm:w-12">
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold tabular-nums">
                      {slideCount ? slideIndex + 1 : 0} / {slideCount}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${slideCount ? ((slideIndex + 1) / slideCount) * 100 : 0}%` }} />
                    </div>
                    <button onClick={toggleFullscreen} aria-label={isFullscreen ? t("modals.materi.exitFullscreen") : t("modals.materi.fullscreen")} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold transition-colors hover:bg-white/20">
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      <span className="hidden sm:inline">{isFullscreen ? t("modals.materi.exitFullscreen") : t("modals.materi.fullscreen")}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div ref={containerRef} className={kind === "pdf" ? "flex flex-col items-center px-4 py-6" : ""} />
              )}
            </div>
          )}

          {isRendered && status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-9 w-9 animate-spin text-edu-blue" />
              <p className="text-sm font-semibold">{t("modals.materi.loading")}</p>
            </div>
          )}

          {isRendered && status === "error" &&
            fallback(<AlertTriangle className="h-10 w-10 text-amber-500" />, t("modals.materi.loadError"), t("modals.materi.loadErrorDesc"))}

          {kind === "other" &&
            fallback(<FileText className="h-10 w-10 text-slate-400" />, t("modals.materi.noPreview"), t("modals.materi.noPreviewDesc"))}
        </div>
      </div>

      <style>{`
        .materi-render .docx-wrapper { background: transparent; padding: 24px 12px; }
        .materi-render .docx-wrapper > section.docx { box-shadow: 0 4px 20px rgb(15 23 42 / 0.08); border-radius: 8px; margin-bottom: 24px; max-width: 100%; }
        .materi-sheet table { border-collapse: collapse; font-size: 13px; color: #0f172a; min-width: 100%; }
        .materi-sheet td { border: 1px solid #e2e8f0; padding: 6px 10px; white-space: nowrap; }
        .materi-sheet tr:first-child td { background: #f1f5f9; font-weight: 700; position: sticky; top: 0; }
        .materi-sheet tr:nth-child(even) td { background: #f8fafc; }
        .materi-pptx .pptx-preview-wrapper { overflow: hidden !important; background: #fff !important; }
        .materi-pptx .pptx-preview-wrapper-next, .materi-pptx .pptx-preview-wrapper-pagination { display: none !important; }
      `}</style>
    </div>
  );
}
