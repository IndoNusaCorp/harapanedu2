"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { getGameProgress, saveGameProgress, GameProgress } from "@/lib/gameServices";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { useCurrentLocale, useI18n } from "@/components/translate/client";
import { drawingPrompts, toGameLocale } from "@/components/kids/games/content";

export function DrawingGame() {
  const params = useParams();
  const localeParam = params.locale as string;
  const roleParam = params.role as string;
  const idParam = params.id as string;
  const basePath = `/${localeParam}/${roleParam}/${idParam}`;

  const { isKidsMode, role } = useRole();
  const t = useI18n();
  const prompts = drawingPrompts[toGameLocale(useCurrentLocale())];
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<{ name: string, emoji: string } | null>(null);
  const [feedback, setFeedback] = useState<"idle" | "correct">("idle");
  const [loading, setLoading] = useState(true);

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [color, setColor] = useState("#000000");

  const colors = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];

  const generatePrompt = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * prompts.length);
    return prompts[randomIndex];
  }, [prompts]);

  useEffect(() => {
    const init = async () => {
      const p = await getGameProgress("drawing");
      setProgress(p);
      setCurrentPrompt(generatePrompt());
      setLoading(false);
    };
    init();
  }, [generatePrompt]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ("clientX" in e) ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = ("clientY" in e) ? e.clientY - rect.top : e.touches[0].clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ("clientX" in e) ? e.clientX - rect.left : e.touches[0].clientX - rect.left;
    const y = ("clientY" in e) ? e.clientY - rect.top : e.touches[0].clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSubmit = async () => {
    if (!progress || !hasDrawn) return;

    setFeedback("correct");
    const newProgress = {
      currentLevel: progress.currentLevel + 1,
      totalScore: progress.totalScore + 20, // Drawing gets more points!
    };
    setProgress(newProgress);
    await saveGameProgress("drawing", newProgress);

    setTimeout(() => {
      setCurrentPrompt(generatePrompt());
      clearCanvas();
      setFeedback("idle");
    }, 2000);
  };

  if (!isKidsMode && role !== 'student') {
    return <div className="p-8 text-center">{t("games.onlyKids")}</div>;
  }

  if (loading) {
    return <div className="p-8 text-center">{t("games.loading")}</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`${basePath}/games`} className="text-orange-600 font-bold hover:underline">
          {t("games.back")}
        </Link>
        <div className="flex gap-4">
          <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-xl font-bold">
            {t("games.level", { level: progress?.currentLevel ?? 1 })}
          </div>
          <div className="bg-pink-100 text-pink-800 px-4 py-2 rounded-xl font-bold">
            {t("games.score", { score: progress?.totalScore ?? 0 })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl text-center border-4 border-pink-100">
        <h1 className="text-4xl font-black text-pink-500 mb-4">{t("games.drawing.title")}</h1>

        {currentPrompt && feedback === "idle" && (
          <div className="mb-6">
            <p className="text-2xl font-bold text-gray-700">{t("games.drawing.prompt")}</p>
            <div className="text-4xl font-black text-pink-600 mt-2 flex items-center justify-center gap-4">
              <span>{currentPrompt.name}</span>
              <span>{currentPrompt.emoji}</span>
            </div>
          </div>
        )}

        <div className="relative mx-auto w-full max-w-2xl">
          {/* Color Palette */}
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-10 h-10 rounded-full border-2 ${color === c ? 'border-gray-800 scale-110 shadow-lg' : 'border-gray-300 hover:scale-105'}`}
                style={{ backgroundColor: c }}
                title={t("games.drawing.pickColor")}
                aria-label={t("games.drawing.pickColor")}
              />
            ))}
          </div>

          <div className="border-4 border-gray-200 rounded-2xl overflow-hidden bg-gray-50 touch-none">
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseOut={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-auto cursor-crosshair bg-white"
              style={{ touchAction: "none" }}
            />
          </div>

          {feedback === "correct" && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl z-10">
              <div className="text-[100px] animate-bounce">✅</div>
              <div className="text-4xl font-black text-green-500 mt-4">{t("games.drawing.great")}</div>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button
            onClick={clearCanvas}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xl py-3 px-8 rounded-2xl shadow transition-all"
          >
            {t("games.drawing.clear")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasDrawn}
            className={`font-bold text-xl py-3 px-8 rounded-2xl shadow-lg transform transition-all ${
              hasDrawn
                ? "bg-pink-500 hover:bg-pink-600 text-white active:scale-95"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {t("games.drawing.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
