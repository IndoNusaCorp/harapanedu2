"use client";

import React, { useId, useMemo, useState } from "react";
import {
  X, FileText, Presentation, Sheet, Image as ImageIcon, ChevronRight, Search,
  GraduationCap, Trophy, TrendingDown, AlertTriangle, FolderOpen, ListOrdered,
} from "lucide-react";
import { useI18n } from "@/components/translate/client";
import { useDateFormat } from "@/components/translate/format";
import { ViewMateriModal } from "@/components/modals/ViewMateriModal";
import {
  PASSING_SCORE, fileExtension, searchGrades,
  type GradeStats, type VoiceDocItem, type VoiceGradeItem, type VoicePanel,
} from "@/lib/ai/voiceTools";

interface VoiceResultPanelProps {
  panel: VoicePanel;
  /** Warna bola: [aksen1, aksen2, aksen3, aksen4] */
  palette: string[];
  onClose: () => void;
  onOpenFile: (id: string | null) => void;
}

const FILE_STYLES: Record<string, { icon: typeof FileText; label: string; from: string; to: string }> = {
  pdf: { icon: FileText, label: "PDF", from: "#fb7185", to: "#e11d48" },
  docx: { icon: FileText, label: "DOCX", from: "#60a5fa", to: "#2563eb" },
  doc: { icon: FileText, label: "DOC", from: "#60a5fa", to: "#2563eb" },
  pptx: { icon: Presentation, label: "PPTX", from: "#fdba74", to: "#ea580c" },
  xlsx: { icon: Sheet, label: "XLSX", from: "#6ee7b7", to: "#059669" },
  csv: { icon: Sheet, label: "CSV", from: "#6ee7b7", to: "#059669" },
  image: { icon: ImageIcon, label: "IMG", from: "#c4b5fd", to: "#7c3aed" },
  other: { icon: FileText, label: "FILE", from: "#cbd5e1", to: "#64748b" },
};

function fileStyle(name: string) {
  const ext = fileExtension(name);
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return FILE_STYLES.image;
  return FILE_STYLES[ext] || FILE_STYLES.other;
}

function scoreTone(score: number | null) {
  if (score === null) return { text: "text-white/60", bg: "bg-white/10", bar: "#94a3b8" };
  if (score >= 85) return { text: "text-emerald-200", bg: "bg-emerald-400/20", bar: "#34d399" };
  if (score >= PASSING_SCORE) return { text: "text-sky-200", bg: "bg-sky-400/20", bar: "#38bdf8" };
  return { text: "text-rose-200", bg: "bg-rose-400/20", bar: "#fb7185" };
}

/**
 * VoiceResultPanel — kartu kaca yang muncul di atas bola LibraAI saat pengguna meminta
 * dokumen atau nilai lewat suara.
 */
export default function VoiceResultPanel({ panel, palette, onClose, onOpenFile }: VoiceResultPanelProps) {
  const openDoc = panel.type === "documents" && panel.openId
    ? panel.items.find((f) => f.id === panel.openId) ?? null
    : null;

  return (
    <>
      <style>{`
        @keyframes libra-panel-in { from { opacity: 0; transform: translateY(18px) scale(.96); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
        @keyframes libra-row-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes libra-shimmer { to { background-position: -200% 0; } }
        @keyframes libra-border { to { --libra-angle: 360deg; } }
        @property --libra-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
        .libra-panel { animation: libra-panel-in .5s cubic-bezier(.2,.9,.3,1.1) both; }
        .libra-panel-border { --libra-angle: 0deg; animation: libra-border 6s linear infinite; }
        .libra-row { animation: libra-row-in .35s ease-out both; }
        .libra-skeleton { background: linear-gradient(90deg, rgb(255 255 255 / .06) 25%, rgb(255 255 255 / .16) 50%, rgb(255 255 255 / .06) 75%); background-size: 200% 100%; animation: libra-shimmer 1.4s linear infinite; }
        .libra-scroll { scrollbar-width: thin; scrollbar-color: rgb(255 255 255 / .2) transparent; }
        @media (prefers-reduced-motion: reduce) {
          .libra-panel, .libra-row, .libra-skeleton, .libra-panel-border { animation: none; }
        }
      `}</style>

      {!openDoc && (
      <div
        className="libra-panel libra-panel-border pointer-events-auto relative w-[min(92vw,34rem)] rounded-[28px] p-px shadow-[0_24px_80px_-12px_rgb(0_0_0/.6)]"
        style={{
          background: `conic-gradient(from var(--libra-angle), ${palette[0]}, ${palette[1]}, ${palette[2]}, ${palette[3]}, ${palette[0]})`,
        }}
      >
        <div className="relative overflow-hidden rounded-[27px] bg-slate-950/80 text-white backdrop-blur-2xl">
          {/* Cahaya warna bola di sudut kartu */}
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-40 blur-3xl"
            style={{ background: palette[1] }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full opacity-25 blur-3xl"
            style={{ background: palette[2] }}
          />

          <div className="relative">
            {panel.type === "loading" && <LoadingView tool={panel.tool} palette={palette} onClose={onClose} />}
            {panel.type === "error" && <ErrorView onClose={onClose} />}
            {panel.type === "documents" && (
              <DocumentsView items={panel.items} query={panel.query} palette={palette} onClose={onClose} onOpen={onOpenFile} />
            )}
            {panel.type === "grades" && (
              <GradesView
                scope={panel.scope}
                items={panel.items}
                stats={panel.stats}
                query={panel.query}
                palette={palette}
                onClose={onClose}
              />
            )}
          </div>
        </div>
      </div>
      )}

      {openDoc && (
        <div className="pointer-events-auto">
          <ViewMateriModal
            isOpen
            onClose={() => onOpenFile(null)}
            materiUrl={openDoc.url}
            materiName={openDoc.name}
            fileName={openDoc.name}
          />
        </div>
      )}
    </>
  );
}

// ---------- Bagian umum ----------

function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  palette,
  onClose,
}: {
  icon: typeof FileText;
  title: string;
  subtitle?: string;
  palette: string[];
  onClose: () => void;
}) {
  const t = useI18n();
  return (
    <div className="flex items-center gap-3 px-5 pb-3 pt-5">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/20"
        style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[2]})` }}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-bold tracking-tight">{title}</h3>
        {subtitle && <p className="truncate text-xs text-white/60">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("voice.panel.close")}
        title={t("voice.panel.close")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof FileText; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 pb-8 pt-4 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
        <Icon className="h-6 w-6 text-white/60" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-xs text-xs text-white/55">{hint}</p>
    </div>
  );
}

function LoadingView({ tool, palette, onClose }: { tool: string; palette: string[]; onClose: () => void }) {
  const t = useI18n();
  const isGrades = tool === "show_grades";
  return (
    <div aria-busy="true">
      <PanelHeader
        icon={isGrades ? GraduationCap : FolderOpen}
        title={isGrades ? t("voice.panel.loadingGrades") : t("voice.panel.loadingDocuments")}
        palette={palette}
        onClose={onClose}
      />
      <div className="space-y-2.5 px-5 pb-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <div className="libra-skeleton h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="libra-skeleton h-3 rounded-full" style={{ width: `${70 - i * 12}%` }} />
              <div className="libra-skeleton h-2.5 w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorView({ onClose }: { onClose: () => void }) {
  const t = useI18n();
  return (
    <>
      <PanelHeader icon={AlertTriangle} title={t("voice.panel.error")} palette={["#fb7185", "#ef4444", "#f43f5e", "#fca5a5"]} onClose={onClose} />
      <EmptyState icon={AlertTriangle} title={t("voice.panel.error")} hint={t("voice.panel.errorHint")} />
    </>
  );
}

// ---------- Dokumen ----------

function DocumentsView({
  items,
  query,
  palette,
  onClose,
  onOpen,
}: {
  items: VoiceDocItem[];
  query: string;
  palette: string[];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const t = useI18n();
  const subtitle = [
    query ? t("voice.panel.resultsFor", { query }) : t("voice.panel.allFiles"),
    t("voice.panel.fileCount", { count: items.length }),
  ].join(" · ");

  return (
    <>
      <PanelHeader icon={FolderOpen} title={t("voice.panel.documents")} subtitle={subtitle} palette={palette} onClose={onClose} />
      {items.length === 0 ? (
        <EmptyState icon={FolderOpen} title={t("voice.panel.noDocuments")} hint={t("voice.panel.noDocumentsHint")} />
      ) : (
        <ul className="libra-scroll max-h-[min(46vh,24rem)] space-y-2 overflow-y-auto px-3 pb-4">
          {items.map((file, i) => {
            const style = fileStyle(file.name);
            return (
              <li key={file.id} className="libra-row" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
                <button
                  type="button"
                  onClick={() => onOpen(file.id)}
                  className="group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                >
                  <div
                    className="relative flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl shadow-md"
                    style={{ background: `linear-gradient(160deg, ${style.from}, ${style.to})` }}
                  >
                    <style.icon className="h-4.5 w-4.5 text-white" />
                    <span className="mt-0.5 text-[9px] font-black tracking-wider text-white/90">{style.label}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{file.name}</p>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
                        {t(`voice.panel.kinds.${file.kind}`)}
                      </span>
                      {file.label && <span className="truncate text-xs text-white/55">{file.label}</span>}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80 transition group-hover:bg-white group-hover:text-slate-900">
                    {t("voice.panel.open")}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ---------- Nilai ----------

type SortMode = "recent" | "high" | "low";

function GradesView({
  scope,
  items,
  stats,
  query,
  palette,
  onClose,
}: {
  scope: "student" | "teacher";
  items: VoiceGradeItem[];
  stats: GradeStats;
  query: string;
  palette: string[];
  onClose: () => void;
}) {
  const t = useI18n();
  const dates = useDateFormat();
  const isTeacher = scope === "teacher";
  const [sort, setSort] = useState<SortMode>("recent");
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const filtered = filter.trim() ? searchGrades(items, filter) : items;
    if (sort === "recent") return filtered;
    const sign = sort === "high" ? -1 : 1;
    return [...filtered].sort((a, b) => sign * ((a.score ?? -1) - (b.score ?? -1)));
  }, [items, filter, sort]);

  const title = isTeacher ? t("voice.panel.studentGrades") : t("voice.panel.myGrades");
  const subtitle = [
    query ? t("voice.panel.resultsFor", { query }) : null,
    t("voice.panel.gradeCount", { count: stats.count }),
  ].filter(Boolean).join(" · ");

  const formatDate = (date?: string) => {
    if (!date) return null;
    try {
      return dates.short(date);
    } catch {
      return date;
    }
  };

  return (
    <>
      <PanelHeader icon={GraduationCap} title={title} subtitle={subtitle} palette={palette} onClose={onClose} />

      {items.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t("voice.panel.noGrades")} hint={t("voice.panel.noGradesHint")} />
      ) : (
        <div className="libra-scroll max-h-[min(52vh,30rem)] overflow-y-auto pb-4">
          {/* Ringkasan */}
          <div className="flex items-center gap-4 px-5 pb-4">
            <ScoreRing value={stats.average} palette={palette} label={t("voice.panel.average")} />
            <div className="grid flex-1 grid-cols-2 gap-2">
              <StatChip icon={Trophy} label={t("voice.panel.highest")} value={stats.highest} />
              <StatChip icon={TrendingDown} label={t("voice.panel.lowest")} value={stats.lowest} />
              <StatChip icon={ListOrdered} label={t("voice.panel.total")} value={stats.count} />
              <StatChip
                icon={AlertTriangle}
                label={t("voice.panel.belowPassing", { kkm: PASSING_SCORE })}
                value={stats.belowPassing}
                warn={stats.belowPassing > 0}
              />
            </div>
          </div>

          {/* Sebaran (pengajar) / rata-rata per mapel (pelajar) */}
          {isTeacher ? (
            <Distribution items={items} />
          ) : (
            stats.byCourse.length > 1 && (
              <div className="mx-5 mb-4 rounded-2xl bg-white/5 p-3.5">
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-white/50">{t("voice.panel.byCourse")}</p>
                <div className="space-y-2">
                  {stats.byCourse.slice(0, 5).map((c, i) => (
                    <div key={c.course} className="libra-row flex items-center gap-3" style={{ animationDelay: `${i * 60}ms` }}>
                      <span className="w-28 shrink-0 truncate text-xs text-white/75">{c.course}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{ width: `${Math.min(100, c.average)}%`, background: scoreTone(c.average).bar }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums">{c.average}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Kontrol */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-slate-950/70 px-5 py-2 backdrop-blur-xl">
            {items.length > 5 && (
              <label className="flex min-w-[10rem] flex-1 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10 focus-within:ring-white/30">
                <Search className="h-3.5 w-3.5 shrink-0 text-white/50" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={isTeacher ? t("voice.panel.filterTeacher") : t("voice.panel.filterStudent")}
                  className="w-full bg-transparent text-xs text-white placeholder:text-white/40 focus:outline-none"
                />
              </label>
            )}
            <div className="flex shrink-0 rounded-full bg-white/10 p-0.5 text-[11px] font-bold" role="group" aria-label={t("voice.panel.sort")}>
              {(["recent", "high", "low"] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSort(mode)}
                  aria-pressed={sort === mode}
                  className={`rounded-full px-2.5 py-1 transition ${sort === mode ? "bg-white text-slate-900 shadow" : "text-white/65 hover:text-white"}`}
                >
                  {t(`voice.panel.sortModes.${mode}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Daftar nilai */}
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-white/55">{t("voice.panel.noMatch")}</p>
          ) : (
            <ul className="space-y-1.5 px-3 pt-2">
              {rows.map((g, i) => {
                const tone = scoreTone(g.score);
                const date = formatDate(g.date);
                return (
                  <li
                    key={`${g.student}-${g.assignment}-${g.course}-${i}`}
                    className="libra-row flex items-start gap-3 rounded-2xl p-2.5 transition hover:bg-white/5"
                    style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                  >
                    {isTeacher && <Avatar name={g.student || "?"} palette={palette} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{isTeacher ? g.student : g.assignment}</p>
                      <p className="truncate text-xs text-white/55">
                        {[isTeacher ? g.assignment : null, g.course, date].filter(Boolean).join(" · ")}
                      </p>
                      {g.feedback && !isTeacher && (
                        <p className="mt-1 line-clamp-2 text-xs italic text-white/65">“{g.feedback}”</p>
                      )}
                    </div>
                    <div className={`flex shrink-0 flex-col items-center rounded-xl px-2.5 py-1 ${tone.bg}`}>
                      <span className={`text-base font-black leading-tight tabular-nums ${tone.text}`}>
                        {g.score ?? "–"}
                      </span>
                      {g.letter && <span className="text-[10px] font-bold text-white/60">{g.letter}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function ScoreRing({ value, palette, label }: { value: number | null; palette: string[]; label: string }) {
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const progress = value === null ? 0 : Math.min(100, Math.max(0, value)) / 100;
  const gradientId = `libra-ring-${useId().replace(/:/g, "")}`;

  return (
    <div className="relative h-[92px] w-[92px] shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette[0]} />
            <stop offset="100%" stopColor={palette[2]} />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(255 255 255 / .1)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.9,.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black leading-none tabular-nums">{value ?? "–"}</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/55">{label}</span>
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  warn = false,
}: {
  icon: typeof Trophy;
  label: string;
  value: number | null;
  warn?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${warn ? "bg-rose-400/15" : "bg-white/5"}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${warn ? "text-rose-300" : "text-white/50"}`} />
      <div className="min-w-0">
        <p className={`text-sm font-bold leading-tight tabular-nums ${warn ? "text-rose-200" : ""}`}>{value ?? "–"}</p>
        <p className="truncate text-[10px] text-white/50">{label}</p>
      </div>
    </div>
  );
}

function Distribution({ items }: { items: VoiceGradeItem[] }) {
  const t = useI18n();
  const scored = items.filter((g) => g.score !== null) as (VoiceGradeItem & { score: number })[];
  if (scored.length === 0) return null;

  const bands = [
    { key: "excellent", count: scored.filter((g) => g.score >= 85).length, color: "#34d399" },
    { key: "good", count: scored.filter((g) => g.score >= PASSING_SCORE && g.score < 85).length, color: "#38bdf8" },
    { key: "needsWork", count: scored.filter((g) => g.score < PASSING_SCORE).length, color: "#fb7185" },
  ] as const;

  return (
    <div className="mx-5 mb-4 rounded-2xl bg-white/5 p-3.5">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-white/50">{t("voice.panel.distribution")}</p>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
        {bands.map((b) =>
          b.count ? (
            <div
              key={b.key}
              className="h-full transition-[width] duration-700 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(b.count / scored.length) * 100}%`, background: b.color }}
            />
          ) : null
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {bands.map((b) => (
          <span key={b.key} className="flex items-center gap-1.5 text-[11px] text-white/70">
            <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
            {t(`voice.panel.bands.${b.key}`, { kkm: PASSING_SCORE })}
            <span className="font-bold tabular-nums text-white">{b.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Avatar({ name, palette }: { name: string; palette: string[] }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  // Warna stabil per nama
  const hue = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % palette.length;
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-1 ring-white/20"
      style={{ background: `linear-gradient(135deg, ${palette[hue]}, ${palette[(hue + 1) % palette.length]})` }}
    >
      {initials}
    </div>
  );
}
