"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getGameProgress, saveGameProgress, GameProgress } from "@/lib/gameServices";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { useCurrentLocale, useI18n } from "@/components/translate/client";
import { crosswordWords, toGameLocale } from "@/components/kids/games/content";

// A simpler version for kids: Guess a few independent words on a grid layout.
export function CrosswordGame() {
  const params = useParams();
  const localeParam = params.locale as string;
  const roleParam = params.role as string;
  const idParam = params.id as string;
  const basePath = `/${localeParam}/${roleParam}/${idParam}`;

  const { isKidsMode, role } = useRole();
  const t = useI18n();
  const words = crosswordWords[toGameLocale(useCurrentLocale())];
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");

  // State for current puzzle
  const [currentWord, setCurrentWord] = useState<{ word: string, hint: string } | null>(null);
  const [inputs, setInputs] = useState<string[]>([]);

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const generatePuzzle = useCallback(() => {
    const randomWord = words[Math.floor(Math.random() * words.length)];
    return randomWord;
  }, [words]);

  useEffect(() => {
    const init = async () => {
      const p = await getGameProgress("crossword");
      setProgress(p);
      const puzzle = generatePuzzle();
      setCurrentWord(puzzle);
      setInputs(Array(puzzle.word.length).fill(""));
      setLoading(false);
    };
    init();
  }, [generatePuzzle]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1); // Only allow one char
    value = value.toUpperCase();

    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);

    // Auto-focus next
    if (value !== "" && index < inputs.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && inputs[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!currentWord || !progress) return;

    const currentAnswer = inputs.join("");
    if (currentAnswer === currentWord.word) {
      setFeedback("correct");
      const newProgress = {
        currentLevel: progress.currentLevel + 1,
        totalScore: progress.totalScore + 15,
      };
      setProgress(newProgress);
      await saveGameProgress("crossword", newProgress);

      setTimeout(() => {
        const nextPuzzle = generatePuzzle();
        setCurrentWord(nextPuzzle);
        setInputs(Array(nextPuzzle.word.length).fill(""));
        setFeedback("idle");
        inputRefs.current[0]?.focus();
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
          <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-xl font-bold">
            {t("games.score", { score: progress?.totalScore ?? 0 })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl text-center border-4 border-purple-100">
        <h1 className="text-4xl font-black text-purple-500 mb-8">{t("games.crossword.title")}</h1>

        {currentWord && (
          <>
            <div className="bg-purple-50 rounded-2xl p-6 mb-8 inline-block shadow-inner">
              <h2 className="text-xl text-purple-800 font-bold mb-2">{t("games.crossword.hint")}</h2>
              <p className="text-2xl font-black text-gray-800">{currentWord.hint}</p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {inputs.map((char, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  value={char}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="text-black w-12 h-12 sm:w-16 sm:h-16 text-center text-3xl sm:text-4xl font-black rounded-xl border-4 border-purple-200 focus:border-purple-500 focus:ring-0 uppercase transition-colors"
                  maxLength={2}
                />
              ))}
            </div>
          </>
        )}

        <div>
          <button
            onClick={handleSubmit}
            className="bg-purple-500 hover:bg-purple-600 text-white font-bold text-xl py-3 px-8 rounded-2xl shadow-lg transform active:scale-95 transition-all"
          >
            {t("games.check")}
          </button>
        </div>

        {feedback === "correct" && (
          <div className="mt-8 text-green-500 text-5xl sm:text-6xl animate-bounce">
            {t("games.correct")}
          </div>
        )}
        {feedback === "wrong" && (
          <div className="mt-8 text-red-500 text-4xl sm:text-6xl animate-shake">
            {t("games.crossword.wrong")}
          </div>
        )}
      </div>
    </div>
  );
}
