"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getGameProgress, saveGameProgress, GameProgress } from "@/lib/gameServices";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { useI18n } from "@/components/translate/client";

type Operation = "+" | "-" | "x" | "/";

interface MathQuestion {
  num1: number;
  num2: number;
  operation: Operation;
  answer: number;
}

export function MathGame() {
  const params = useParams();
  const localeParam = params.locale as string;
  const roleParam = params.role as string;
  const idParam = params.id as string;
  const basePath = `/${localeParam}/${roleParam}/${idParam}`;

  const { isKidsMode, role } = useRole();
  const t = useI18n();
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [question, setQuestion] = useState<MathQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [loading, setLoading] = useState(true);

  // Generate question based on level
  const generateQuestion = useCallback((level: number): MathQuestion => {
    // Difficulty scales slightly with level
    const maxNum = Math.min(10 + level * 2, 100);

    // Choose operation
    // For early levels (1-3) stick to + and -
    // Mid levels (4-6) add x
    // Higher levels add /
    let availableOps = ["+", "-"];
    if (level > 3) availableOps.push("x");
    if (level > 6) availableOps.push("/");

    const operation = availableOps[Math.floor(Math.random() * availableOps.length)] as Operation;

    let num1 = Math.floor(Math.random() * maxNum) + 1;
    let num2 = Math.floor(Math.random() * maxNum) + 1;
    let answer = 0;

    switch (operation) {
      case "+":
        answer = num1 + num2;
        break;
      case "-":
        // ensure positive answer for kids
        if (num1 < num2) {
          const temp = num1;
          num1 = num2;
          num2 = temp;
        }
        answer = num1 - num2;
        break;
      case "x":
        // keep multiplication simpler
        num1 = Math.floor(Math.random() * Math.min(12, maxNum)) + 1;
        num2 = Math.floor(Math.random() * Math.min(10, maxNum)) + 1;
        answer = num1 * num2;
        break;
      case "/":
        // Ensure clean division
        num2 = Math.floor(Math.random() * 10) + 1; // divisor
        answer = Math.floor(Math.random() * 10) + 1; // result
        num1 = num2 * answer; // dividend
        break;
    }

    return { num1, num2, operation, answer };
  }, []);

  useEffect(() => {
    const init = async () => {
      const p = await getGameProgress("math");
      setProgress(p);
      setQuestion(generateQuestion(p.currentLevel));
      setLoading(false);
    };
    init();
  }, [generateQuestion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !progress) return;

    const parsedAnswer = parseInt(userAnswer, 10);
    if (isNaN(parsedAnswer)) return;

    if (parsedAnswer === question.answer) {
      setFeedback("correct");
      const newProgress = {
        currentLevel: progress.currentLevel + 1,
        totalScore: progress.totalScore + 10,
      };
      setProgress(newProgress);
      await saveGameProgress("math", newProgress);

      setTimeout(() => {
        setQuestion(generateQuestion(newProgress.currentLevel));
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
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-xl font-bold">
            {t("games.score", { score: progress?.totalScore ?? 0 })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl text-center border-4 border-blue-100">
        <h1 className="text-4xl font-black text-blue-500 mb-8">{t("games.math.title")}</h1>

        {question && (
          <div className="text-5xl sm:text-6xl font-black text-gray-800 mb-8 flex items-center justify-center gap-4">
            <span>{question.num1}</span>
            <span className="text-blue-500">{question.operation}</span>
            <span>{question.num2}</span>
            <span className="text-blue-500">=</span>
            <span>?</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="number"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="text-black w-48 text-center text-4xl p-4 rounded-2xl border-4 border-blue-200 focus:border-blue-500 focus:ring-0 transition-colors"
            placeholder={t("games.math.placeholder")}
            autoFocus
          />
          <div>
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-xl py-3 px-8 rounded-2xl shadow-lg transform active:scale-95 transition-all"
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
