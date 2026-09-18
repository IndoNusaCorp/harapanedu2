"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { KidsPage } from "@/components/kids/ui";
import { useI18n } from "@/components/translate/client";

const gamesList = [
  { id: "math", name: "kids.games.mathName", description: "kids.games.mathDesc", emoji: "➕", color: "bg-[#FF9A90]" },
  { id: "guess-animal", name: "kids.games.animalName", description: "kids.games.animalDesc", emoji: "🦋", color: "bg-[#CCF2C0]" },
  { id: "guess-picture", name: "kids.games.pictureName", description: "kids.games.pictureDesc", emoji: "🖼️", color: "bg-[#B3F0F7]" },
  { id: "drawing", name: "kids.games.drawingName", description: "kids.games.drawingDesc", emoji: "🎨", color: "bg-[#FFA6F9]" },
  { id: "crossword", name: "kids.games.crosswordName", description: "kids.games.crosswordDesc", emoji: "🧩", color: "bg-[#FF7A7A]" },
] as const;

export function KidsGamesDashboard() {
  const params = useParams();
  const localeParam = params.locale as string;
  const roleParam = params.role as string;
  const idParam = params.id as string;
  const basePath = `/${localeParam}/${roleParam}/${idParam}`;

  const { isKidsMode, role } = useRole();
  const t = useI18n();

  // Protect route if not kids mode
  if (!isKidsMode && role !== 'student') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700">{t("kids.games.oops")}</h2>
          <p className="text-gray-500 mt-2">{t("kids.games.onlyStudents")}</p>
        </div>
      </div>
    );
  }

  return (
    <KidsPage width="max-w-[1100px]">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-medium tracking-tight text-black sm:text-5xl">{t("kids.games.title")}</h1>
        <p className="mt-1 text-sm text-black/80 sm:text-base">{t("kids.games.subtitle")}</p>
      </div>

      {/* Game Cards Grid */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {gamesList.map((game) => (
          <Link href={`${basePath}/games/${game.id}`} key={game.id} className="group relative block pr-8 pt-6">
            <span aria-hidden className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#D9D9D9] transition-transform duration-300 group-hover:scale-110" />
            <div className={`relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl ${game.color}`}>
              <h3 className="max-w-[65%] text-base font-bold text-slate-900">{t(game.name)}</h3>
              <span aria-hidden className="absolute right-4 top-1/2 -translate-y-1/2 text-6xl drop-shadow-md transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                {game.emoji}
              </span>
              <p className="max-w-[60%] text-xs font-medium text-slate-800">{t(game.description)}</p>
            </div>
          </Link>
        ))}
      </div>
    </KidsPage>
  );
}
