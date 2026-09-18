import type { MeetingEffect } from "@/lib/types";

// ============================================
// Efek kamera lucu untuk siswa saat meeting
// ============================================
// Video kamera digambar ulang ke <canvas> + filter/stiker, lalu hasil canvas-nya yang dikirim ke peserta lain.
// Tidak memakai deteksi wajah: stiker diletakkan di posisi tetap (atas tengah / pinggir layar).

export const MEETING_EFFECTS: { id: MeetingEffect; emoji: string }[] = [
  { id: "none", emoji: "🚫" },
  { id: "crown", emoji: "👑" },
  { id: "cat", emoji: "🐱" },
  { id: "party", emoji: "🥳" },
  { id: "stars", emoji: "✨" },
  { id: "hearts", emoji: "💖" },
  { id: "retro", emoji: "📼" },
  { id: "alien", emoji: "👽" },
  { id: "comic", emoji: "💥" },
];

const WIDTH = 640;
const HEIGHT = 480;
const FPS = 24;

const FILTERS: Partial<Record<MeetingEffect, string>> = {
  retro: "sepia(0.85) contrast(1.1) saturate(1.2) brightness(0.95)",
  alien: "hue-rotate(110deg) saturate(1.8) contrast(1.1)",
  comic: "contrast(1.7) saturate(2.2) brightness(1.05)",
};

function emoji(ctx: CanvasRenderingContext2D, char: string, x: number, y: number, size: number, rotate = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, 0, 0);
  ctx.restore();
}

// Gambar stiker di atas video; t = waktu (detik) untuk animasi
export function drawEffectOverlay(ctx: CanvasRenderingContext2D, effect: MeetingEffect, t: number, w = WIDTH, h = HEIGHT) {
  switch (effect) {
    case "crown":
      emoji(ctx, "👑", w / 2, h * 0.12 + Math.sin(t * 3) * 4, h * 0.22, Math.sin(t * 2) * 0.08);
      break;
    case "cat": {
      // Telinga kucing
      ctx.fillStyle = "#F9A8D4";
      ctx.strokeStyle = "#3D2C12";
      ctx.lineWidth = 6;
      for (const side of [-1, 1]) {
        const cx = w / 2 + side * w * 0.17;
        const wiggle = Math.sin(t * 4 + side) * 4;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.08, h * 0.2);
        ctx.lineTo(cx + side * w * 0.02, h * 0.02 + wiggle);
        ctx.lineTo(cx + w * 0.08, h * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      emoji(ctx, "🐾", w * 0.08, h * 0.9, h * 0.1, -0.3);
      emoji(ctx, "🐾", w * 0.92, h * 0.9, h * 0.1, 0.3);
      break;
    }
    case "party":
      emoji(ctx, "🎉", w * 0.1, h * 0.12, h * 0.14, Math.sin(t * 3) * 0.2);
      emoji(ctx, "🎈", w * 0.9, h * 0.2 + Math.sin(t * 2) * 10, h * 0.16);
      emoji(ctx, "🎊", w * 0.1, h * 0.85, h * 0.12, Math.cos(t * 3) * 0.2);
      emoji(ctx, "🥳", w * 0.9, h * 0.85, h * 0.12);
      break;
    case "stars":
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 + t * 0.5;
        const x = w / 2 + Math.cos(angle) * w * 0.44;
        const y = h / 2 + Math.sin(angle) * h * 0.42;
        const size = h * (0.06 + 0.03 * Math.abs(Math.sin(t * 3 + i)));
        emoji(ctx, i % 2 ? "⭐" : "✨", x, y, size);
      }
      break;
    case "hearts":
      for (let i = 0; i < 8; i++) {
        const progress = (t * 0.25 + i / 8) % 1;
        const x = w * (0.08 + (i % 4) * 0.28) + Math.sin(t * 2 + i) * 12;
        const y = h * (1.05 - progress * 1.1);
        ctx.globalAlpha = Math.min(1, (1 - progress) * 2);
        emoji(ctx, i % 3 ? "💖" : "💕", x, y, h * 0.09);
      }
      ctx.globalAlpha = 1;
      break;
    case "comic":
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      emoji(ctx, "💥", w * 0.88, h * 0.13, h * 0.16, Math.sin(t * 4) * 0.15);
      break;
    case "alien":
      emoji(ctx, "🛸", w * 0.15 + Math.sin(t) * 40, h * 0.12, h * 0.14);
      break;
    case "retro":
      // Garis-garis scanline ala TV lama
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let y = (t * 40) % 6; y < h; y += 6) ctx.fillRect(0, y, w, 2);
      break;
  }
}

export class CameraEffectProcessor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = performance.now();
  private source: MediaStream;
  effect: MeetingEffect;
  readonly track: MediaStreamTrack;

  constructor(source: MediaStream, effect: MeetingEffect = "none") {
    this.source = source;
    this.effect = effect;
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = source;
    this.video.play().catch(() => {});

    this.canvas = document.createElement("canvas");
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = this.canvas.getContext("2d")!;
    this.track = this.canvas.captureStream(FPS).getVideoTracks()[0];

    // setInterval (bukan requestAnimationFrame) supaya video tetap terkirim walau tab tidak aktif
    this.timer = setInterval(() => this.draw(), 1000 / FPS);
  }

  private draw() {
    const { ctx, video } = this;
    if (video.readyState < 2) return;

    // Crop tengah supaya rasio 4:3 tanpa gepeng
    const vw = video.videoWidth || WIDTH;
    const vh = video.videoHeight || HEIGHT;
    const scale = Math.max(WIDTH / vw, HEIGHT / vh);
    const dw = vw * scale;
    const dh = vh * scale;

    ctx.filter = FILTERS[this.effect] || "none";
    ctx.drawImage(video, (WIDTH - dw) / 2, (HEIGHT - dh) / 2, dw, dh);
    ctx.filter = "none";
    drawEffectOverlay(ctx, this.effect, (performance.now() - this.startedAt) / 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track.stop();
    this.source.getTracks().forEach(t => t.stop());
    this.video.srcObject = null;
  }
}

// Track video hitam sebagai pengganti saat kamera mati (supaya koneksi WebRTC tetap punya slot video)
export function createPlaceholderVideoTrack(): MediaStreamTrack {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 12;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 16, 12);
  }
  const track = canvas.captureStream(1).getVideoTracks()[0];
  track.enabled = false;
  return track;
}

// Track audio hening untuk peserta tanpa mikrofon
export function createSilentAudioTrack(): MediaStreamTrack {
  const ctx = new AudioContext();
  const destination = ctx.createMediaStreamDestination();
  const track = destination.stream.getAudioTracks()[0];
  track.enabled = false;
  return track;
}
