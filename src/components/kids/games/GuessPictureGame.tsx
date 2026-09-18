"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getGameProgress, saveGameProgress, GameProgress } from "@/lib/gameServices";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { useCurrentLocale, useI18n } from "@/components/translate/client";
import { pictures, isCorrectGuess, toGameLocale, type GuessItem } from "@/components/kids/games/content";

export function GuessPictureGame() {
  const params = useParams();
  const localeParam = params.locale as string;
  const roleParam = params.role as string;
  const idParam = params.id as string;
  const basePath = `/${localeParam}/${roleParam}/${idParam}`;

  const { isKidsMode, role } = useRole();
  const t = useI18n();
  const list = pictures[toGameLocale(useCurrentLocale())];
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [currentPicture, setCurrentPicture] = useState<GuessItem | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [loading, setLoading] = useState(true);

  const generateQuestion = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
  }, [list]);

  useEffect(() => {
    const init = async () => {
      const p = await getGameProgress("guess-picture");
      setProgress(p);
      setCurrentPicture(generateQuestion());
      setLoading(false);
    };
    init();
  }, [generateQuestion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPicture || !progress) return;

    if (isCorrectGuess(currentPicture, userAnswer)) {
      setFeedback("correct");
      const newProgress = {
        currentLevel: progress.currentLevel + 1,
        totalScore: progress.totalScore + 10,
      };
      setProgress(newProgress);
      await saveGameProgress("guess-picture", newProgress);

      setTimeout(() => {
        setCurrentPicture(generateQuestion());
        setUserAnswer("");
        setFeedback("idle");
      }, 1500);
    } else {
      setFeedback("wrong");
      setTimeout(() => setFeedback("idle"), 1500);
    }
  };

  if (!isKidsMode && role !== 'student') {
    return <div className="p-8 text-center">{t("games.onlyKids")}</div>;
  }

  if (loading) {
    return <div className="p-8 text-center">{t("games.loading")}</div>;
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-3xl mx-auto min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`${basePath}/games`} className="text-orange-600 font-bold hover:underline">
          {t("games.back")}
        </Link>
        <div className="flex gap-4">
          <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-xl font-bold">
            {t("games.level", { level: progress?.currentLevel ?? 1 })}
          </div>
          <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl font-bold">
            {t("games.score", { score: progress?.totalScore ?? 0 })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl text-center border-4 border-emerald-100">
        <h1 className="text-4xl font-black text-emerald-500 mb-8">{t("games.picture.title")}</h1>

        {currentPicture && (
          <div className="text-[120px] sm:text-[150px] leading-none mb-8 transform hover:scale-110 transition-transform duration-300">
            {currentPicture.emoji}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 max-w-sm mx-auto">
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="text-black w-full text-center text-2xl p-4 rounded-2xl border-4 border-emerald-200 focus:border-emerald-500 focus:ring-0 transition-colors"
            placeholder={t("games.picture.placeholder")}
            autoFocus
          />
          <div>
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xl py-3 px-8 rounded-2xl shadow-lg transform active:scale-95 transition-all w-full"
            >
              {t("games.check")}
            </button>
          </div>
        </form>

        {feedback === "correct" && (
          <div className="mt-8 text-green-500 text-5xl sm:text-6xl animate-bounce">
            {t("games.correct")}
          </div>
        )}
        {feedback === "wrong" && (
          <div className="mt-8 text-red-500 text-4xl sm:text-6xl animate-shake">
            {t("games.wrong")}
          </div>
        )}
      </div>
    </div>
  );
}
