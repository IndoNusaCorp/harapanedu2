import type { jsPDF as JsPDF } from "jspdf";
import type { Grade } from "@/lib/types";

export type ReportStatus = "excellent" | "good" | "average" | "below";

export interface GradeReportLabels {
  brand: string;
  title: string;
  subtitle: string;
  student: string;
  className: string;
  date: string;
  gpa: string;
  credits: string;
  courses: string;
  avgScore: string;
  no: string;
  subject: string;
  score: string;
  grade: string;
  creditsCol: string;
  status: string;
  noGrades: string;
  footer: string;
  page: (current: number, total: number) => string;
  statusLabel: (status: ReportStatus) => string;
}

export interface GradeReportData {
  grades: Grade[];
  studentName: string;
  className: string;
  dateText: string;
  gpa: string;
  totalCredits: number;
  fileName: string;
  labels: GradeReportLabels;
  getStatus: (score: number) => ReportStatus;
}

type RGB = [number, number, number];

const C = {
  cream: [255, 250, 243] as RGB,
  dot: [252, 228, 236] as RGB,
  stitch: [244, 167, 185] as RGB,
  navy: [43, 58, 103] as RGB,
  muted: [120, 128, 160] as RGB,
  white: [255, 255, 255] as RGB,
  sky: [205, 231, 255] as RGB,
  pink: [255, 196, 214] as RGB,
  peach: [255, 224, 204] as RGB,
  mint: [212, 245, 228] as RGB,
  lavender: [230, 221, 255] as RGB,
  butter: [255, 241, 184] as RGB,
  star: [255, 205, 86] as RGB,
  heart: [255, 138, 170] as RGB,
  bearFur: [205, 150, 105] as RGB,
  bearLight: [243, 208, 170] as RGB,
  dark: [60, 45, 40] as RGB,
  cheek: [255, 170, 180] as RGB,
  rowAlt: [255, 244, 248] as RGB,
  barBg: [241, 236, 247] as RGB,
};

const STATUS_STYLE: Record<ReportStatus, { bg: RGB; fg: RGB; bar: RGB }> = {
  excellent: { bg: [189, 239, 214], fg: [30, 107, 71], bar: [92, 201, 148] },
  good: { bg: [205, 231, 255], fg: [31, 78, 140], bar: [96, 165, 238] },
  average: { bg: [255, 233, 168], fg: [122, 90, 0], bar: [245, 190, 60] },
  below: { bg: [255, 201, 211], fg: [155, 34, 66], bar: [240, 110, 140] },
};

const PAGE_W = 210;
const PAGE_H = 297;
const TABLE_X = 16;
const TABLE_W = 178;
const ROW_H = 11;
const TABLE_BOTTOM = 256;

// Column left edges (mm)
const COL = { no: 16, subject: 26, score: 84, grade: 128, credits: 144, status: 160, end: 194 };

const fill = (doc: JsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const stroke = (doc: JsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const ink = (doc: JsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

function drawStar(doc: JsPDF, cx: number, cy: number, r: number, color: RGB = C.star) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  fill(doc, color);
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], "F", true);
}

function drawHeart(doc: JsPDF, cx: number, cy: number, s: number, color: RGB = C.heart) {
  fill(doc, color);
  doc.circle(cx - s / 2, cy, s / 2, "F");
  doc.circle(cx + s / 2, cy, s / 2, "F");
  doc.triangle(cx - s * 0.98, cy + s * 0.15, cx + s * 0.98, cy + s * 0.15, cx, cy + s * 1.25, "F");
}

function drawCloud(doc: JsPDF, x: number, y: number, s: number) {
  fill(doc, C.white);
  doc.circle(x, y, s * 0.55, "F");
  doc.circle(x + s * 0.6, y - s * 0.3, s * 0.7, "F");
  doc.circle(x + s * 1.3, y, s * 0.55, "F");
  doc.roundedRect(x - s * 0.2, y - s * 0.1, s * 1.7, s * 0.65, s * 0.3, s * 0.3, "F");
}

function drawTeddy(doc: JsPDF, cx: number, cy: number, s: number) {
  doc.setLineWidth(0.3);
  // body + arms
  fill(doc, C.bearFur);
  doc.ellipse(cx, cy + s * 1.45, s * 0.95, s * 0.85, "F");
  doc.circle(cx - s * 0.95, cy + s * 1.15, s * 0.32, "F");
  doc.circle(cx + s * 0.95, cy + s * 1.15, s * 0.32, "F");
  fill(doc, C.bearLight);
  doc.ellipse(cx, cy + s * 1.6, s * 0.55, s * 0.5, "F");
  // ears
  fill(doc, C.bearFur);
  doc.circle(cx - s * 0.75, cy - s * 0.72, s * 0.36, "F");
  doc.circle(cx + s * 0.75, cy - s * 0.72, s * 0.36, "F");
  fill(doc, C.bearLight);
  doc.circle(cx - s * 0.75, cy - s * 0.72, s * 0.2, "F");
  doc.circle(cx + s * 0.75, cy - s * 0.72, s * 0.2, "F");
  // head
  fill(doc, C.bearFur);
  doc.circle(cx, cy, s, "F");
  fill(doc, C.bearLight);
  doc.ellipse(cx, cy + s * 0.35, s * 0.45, s * 0.33, "F");
  // eyes
  fill(doc, C.dark);
  doc.circle(cx - s * 0.38, cy - s * 0.08, s * 0.11, "F");
  doc.circle(cx + s * 0.38, cy - s * 0.08, s * 0.11, "F");
  fill(doc, C.white);
  doc.circle(cx - s * 0.35, cy - s * 0.12, s * 0.04, "F");
  doc.circle(cx + s * 0.41, cy - s * 0.12, s * 0.04, "F");
  // nose + mouth
  fill(doc, C.dark);
  doc.ellipse(cx, cy + s * 0.22, s * 0.13, s * 0.09, "F");
  stroke(doc, C.dark);
  doc.line(cx, cy + s * 0.3, cx, cy + s * 0.42);
  doc.line(cx, cy + s * 0.42, cx - s * 0.12, cy + s * 0.5);
  doc.line(cx, cy + s * 0.42, cx + s * 0.12, cy + s * 0.5);
  // cheeks
  fill(doc, C.cheek);
  doc.ellipse(cx - s * 0.62, cy + s * 0.25, s * 0.15, s * 0.09, "F");
  doc.ellipse(cx + s * 0.62, cy + s * 0.25, s * 0.15, s * 0.09, "F");
  // bow tie
  fill(doc, C.heart);
  doc.triangle(cx, cy + s * 1.02, cx - s * 0.35, cy + s * 0.85, cx - s * 0.35, cy + s * 1.2, "F");
  doc.triangle(cx, cy + s * 1.02, cx + s * 0.35, cy + s * 0.85, cx + s * 0.35, cy + s * 1.2, "F");
  doc.circle(cx, cy + s * 1.02, s * 0.09, "F");
  // little heart on tummy
  drawHeart(doc, cx, cy + s * 1.52, s * 0.14);
}

function drawBunny(doc: JsPDF, cx: number, cy: number, s: number) {
  doc.setLineWidth(0.35);
  stroke(doc, [235, 200, 215]);
  // ears
  fill(doc, C.white);
  doc.ellipse(cx - s * 0.38, cy - s * 1.2, s * 0.24, s * 0.7, "FD");
  doc.ellipse(cx + s * 0.38, cy - s * 1.2, s * 0.24, s * 0.7, "FD");
  fill(doc, C.pink);
  doc.ellipse(cx - s * 0.38, cy - s * 1.15, s * 0.11, s * 0.5, "F");
  doc.ellipse(cx + s * 0.38, cy - s * 1.15, s * 0.11, s * 0.5, "F");
  // head
  fill(doc, C.white);
  doc.ellipse(cx, cy, s * 0.95, s * 0.82, "FD");
  // face
  fill(doc, C.dark);
  doc.circle(cx - s * 0.35, cy - s * 0.05, s * 0.09, "F");
  doc.circle(cx + s * 0.35, cy - s * 0.05, s * 0.09, "F");
  fill(doc, C.heart);
  doc.triangle(cx - s * 0.1, cy + s * 0.15, cx + s * 0.1, cy + s * 0.15, cx, cy + s * 0.27, "F");
  fill(doc, C.cheek);
  doc.ellipse(cx - s * 0.58, cy + s * 0.2, s * 0.14, s * 0.08, "F");
  doc.ellipse(cx + s * 0.58, cy + s * 0.2, s * 0.14, s * 0.08, "F");
}

function drawBackground(doc: JsPDF) {
  fill(doc, C.cream);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  fill(doc, C.dot);
  for (let row = 0, y = 4; y < PAGE_H; row++, y += 12) {
    for (let x = row % 2 ? 10 : 4; x < PAGE_W; x += 12) doc.circle(x, y, 0.7, "F");
  }
  // stitched border
  stroke(doc, C.stitch);
  doc.setLineWidth(0.6);
  doc.setLineDashPattern([2, 1.5], 0);
  doc.roundedRect(7, 7, PAGE_W - 14, PAGE_H - 14, 6, 6, "S");
  doc.setLineDashPattern([], 0);
}

function fitText(doc: JsPDF, text: string, maxWidth: number) {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && doc.getTextWidth(out + "...") > maxWidth) out = out.slice(0, -1);
  return out.trimEnd() + "...";
}

function drawHeader(doc: JsPDF, d: GradeReportData) {
  const { labels } = d;
  fill(doc, C.sky);
  doc.roundedRect(16, 16, 178, 48, 8, 8, "F");
  drawCloud(doc, 112, 26, 7);
  drawCloud(doc, 136, 54, 5);
  drawStar(doc, 124, 40, 2.6);
  drawStar(doc, 196 - 10, 22, 2);
  drawStar(doc, 108, 57, 1.6, C.heart);
  drawTeddy(doc, 166, 36, 10);

  // brand pill
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const brandW = doc.getTextWidth(labels.brand) + 8;
  fill(doc, C.white);
  doc.roundedRect(24, 21, brandW, 6, 3, 3, "F");
  ink(doc, C.navy);
  doc.text(labels.brand, 28, 25.2);

  doc.setFontSize(24);
  doc.text(labels.title, 24, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  ink(doc, C.muted);
  doc.text(doc.splitTextToSize(labels.subtitle, 80), 24, 48);
}

function drawInfoCard(doc: JsPDF, d: GradeReportData, y: number) {
  fill(doc, C.white);
  stroke(doc, C.pink);
  doc.setLineWidth(0.5);
  doc.roundedRect(16, y, 178, 20, 5, 5, "FD");
  const items = [
    { label: d.labels.student, value: d.studentName, x: 24, w: 70 },
    { label: d.labels.className, value: d.className, x: 100, w: 36 },
    { label: d.labels.date, value: d.dateText, x: 142, w: 48 },
  ];
  items.forEach((it, i) => {
    if (i > 0) {
      stroke(doc, C.dot);
      doc.line(it.x - 4, y + 4, it.x - 4, y + 16);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    ink(doc, C.muted);
    doc.text(it.label.toUpperCase(), it.x, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    ink(doc, C.navy);
    doc.text(fitText(doc, it.value, it.w), it.x, y + 15);
  });
}

function drawStats(doc: JsPDF, d: GradeReportData, y: number) {
  const scores = d.grades.map((g) => Number(g.score) || 0);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const stats = [
    { label: d.labels.gpa, value: d.gpa, bg: C.peach, icon: "star" },
    { label: d.labels.credits, value: String(d.totalCredits), bg: C.mint, icon: "heart" },
    { label: d.labels.courses, value: String(d.grades.length), bg: C.lavender, icon: "star" },
    { label: d.labels.avgScore, value: `${avg}%`, bg: C.butter, icon: "heart" },
  ];
  const gap = 6;
  const w = (178 - gap * 3) / 4;
  stats.forEach((s, i) => {
    const x = 16 + i * (w + gap);
    fill(doc, s.bg);
    doc.roundedRect(x, y, w, 26, 6, 6, "F");
    fill(doc, C.white);
    doc.circle(x + w - 7, y + 7, 4, "F");
    if (s.icon === "star") drawStar(doc, x + w - 7, y + 7.3, 2.6);
    else drawHeart(doc, x + w - 7, y + 6.2, 1.6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    ink(doc, C.muted);
    doc.text(fitText(doc, s.label.toUpperCase(), w - 16), x + 5, y + 8);
    doc.setFontSize(18);
    ink(doc, C.navy);
    doc.text(s.value, x + 5, y + 20);
  });
}

function drawTableHeader(doc: JsPDF, d: GradeReportData, y: number) {
  fill(doc, C.pink);
  doc.roundedRect(TABLE_X, y, TABLE_W, 10, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  ink(doc, C.navy);
  const ty = y + 6.6;
  doc.text(d.labels.no, COL.no + 5, ty, { align: "center" });
  doc.text(d.labels.subject, COL.subject + 2, ty);
  doc.text(d.labels.score, COL.score + 2, ty);
  doc.text(d.labels.grade, (COL.grade + COL.credits) / 2, ty, { align: "center" });
  doc.text(d.labels.creditsCol, (COL.credits + COL.status) / 2, ty, { align: "center" });
  doc.text(d.labels.status, (COL.status + COL.end) / 2, ty, { align: "center" });
  return y + 12;
}

function drawRow(doc: JsPDF, d: GradeReportData, g: Grade, index: number, y: number) {
  const score = Number(g.score) || 0;
  const status = d.getStatus(score);
  const style = STATUS_STYLE[status];
  const mid = y + ROW_H / 2;

  fill(doc, index % 2 === 1 ? C.rowAlt : C.white);
  doc.roundedRect(TABLE_X, y, TABLE_W, ROW_H, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  ink(doc, C.muted);
  doc.text(String(index + 1), COL.no + 5, mid + 1.2, { align: "center" });

  ink(doc, C.navy);
  doc.setFontSize(9.5);
  doc.text(fitText(doc, g.course_name || "-", COL.score - COL.subject - 4), COL.subject + 2, mid + 1.3);

  // score bar
  const barW = 28;
  fill(doc, C.barBg);
  doc.roundedRect(COL.score + 2, mid - 2, barW, 4, 2, 2, "F");
  const filled = (Math.min(100, Math.max(0, score)) / 100) * barW;
  if (filled > 0) {
    fill(doc, style.bar);
    doc.roundedRect(COL.score + 2, mid - 2, Math.max(filled, 4), 4, 2, 2, "F");
  }
  doc.setFontSize(8.5);
  doc.text(`${score}%`, COL.score + barW + 4, mid + 1.2);

  // letter badge
  const gx = (COL.grade + COL.credits) / 2;
  fill(doc, C.lavender);
  doc.circle(gx, mid, 4, "F");
  doc.setFontSize(9.5);
  ink(doc, [91, 63, 168]);
  doc.text(g.grade_letter || "-", gx, mid + 1.3, { align: "center" });

  ink(doc, C.navy);
  doc.setFontSize(9);
  doc.text(String(Number(g.credits) || 0), (COL.credits + COL.status) / 2, mid + 1.2, { align: "center" });

  // status pill
  doc.setFontSize(7);
  const label = d.labels.statusLabel(status).toUpperCase();
  const pillW = Math.min(COL.end - COL.status - 4, doc.getTextWidth(label) + 6);
  const px = (COL.status + COL.end) / 2 - pillW / 2;
  fill(doc, style.bg);
  doc.roundedRect(px, mid - 2.6, pillW, 5.2, 2.6, 2.6, "F");
  ink(doc, style.fg);
  doc.text(fitText(doc, label, pillW - 3), (COL.status + COL.end) / 2, mid + 0.9, { align: "center" });
}

function drawFooter(doc: JsPDF, d: GradeReportData, page: number, total: number) {
  drawBunny(doc, 30, 278, 7);
  drawHeart(doc, 46, 270, 1.6);
  drawStar(doc, 180, 266, 2, C.star);
  drawStar(doc, 188, 272, 1.3, C.heart);

  if (page === total) {
    fill(doc, C.white);
    stroke(doc, C.pink);
    doc.setLineWidth(0.4);
    doc.roundedRect(52, 262, 106, 12, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    ink(doc, C.navy);
    doc.text(fitText(doc, d.labels.footer, 98), 105, 269.4, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ink(doc, C.muted);
  doc.text(d.labels.page(page, total), 188, 283, { align: "right" });
}

export async function downloadGradeReportPdf(d: GradeReportData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // Page 1
  drawBackground(doc);
  drawHeader(doc, d);
  drawInfoCard(doc, d, 72);
  drawStats(doc, d, 98);
  let y = drawTableHeader(doc, d, 132);

  if (d.grades.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    ink(doc, C.muted);
    doc.text(d.labels.noGrades, 105, y + 12, { align: "center" });
    drawStar(doc, 105, y + 24, 3);
  }

  d.grades.forEach((g, i) => {
    if (y + ROW_H > TABLE_BOTTOM) {
      doc.addPage();
      drawBackground(doc);
      fill(doc, C.sky);
      doc.roundedRect(16, 16, 178, 16, 6, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      ink(doc, C.navy);
      doc.text(fitText(doc, `${d.labels.title} - ${d.studentName}`, 150), 24, 26.5);
      drawStar(doc, 184, 24, 2.5);
      y = drawTableHeader(doc, d, 38);
    }
    drawRow(doc, d, g, i, y);
    y += ROW_H;
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, d, p, total);
  }

  doc.save(d.fileName);
}
