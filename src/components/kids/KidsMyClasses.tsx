"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { getClasses, applyStudentProgress } from "@/lib/api";
import type { ClassData } from "@/lib/types";
import { ViewMateriModal } from "@/components/modals/ViewMateriModal";
import { TakeAttendanceModal } from "@/components/modals/TakeAttendanceModal";
import { KidsPage, KidsHero } from "@/components/kids/ui";
import { useI18n } from "@/components/translate/client";

// Card color sets taken from the "Kelas ku" mockup, cycled per class.
const palettes = [
  { head: "bg-[#A64545] text-white", body: "bg-[#FAD28F]", pill: "bg-[#A64545] text-white hover:bg-[#8F3A3A]", track: "bg-white/80", bar: "bg-[#B00000]" },
  { head: "bg-[#DCD6FF] text-slate-900", body: "bg-kids-periwinkle", pill: "bg-[#FFD6DF] text-slate-900 hover:bg-[#FFC4D1]", track: "bg-white/80", bar: "bg-[#FFA8B8]" },
  { head: "bg-[#FFB3C6] text-[#6B1530]", body: "bg-[#FCA5A5]", pill: "bg-[#FF8080] text-white hover:bg-[#F26D6D]", track: "bg-white/80", bar: "bg-[#FF5C7A]" },
];

export default function KidsMyClasses() {
  const t = useI18n();
  const params = useParams();
  const idParam = params.id as string;
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showMateriModal, setShowMateriModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassSchedule, setSelectedClassSchedule] = useState<string>("");
  const [selectedMateriUrl, setSelectedMateriUrl] = useState<string | null>(null);
  const [selectedMateriName, setSelectedMateriName] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClasses();
      setClasses(await applyStudentProgress(data, idParam));
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [idParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTakeAttendanceClick = (id: string, schedule?: string) => {
    setSelectedClassId(id);
    setSelectedClassSchedule(schedule || "");
    setShowAttendanceModal(true);
  };

  const handleViewMateri = (url: string, name: string) => {
    setSelectedMateriUrl(url);
    setSelectedMateriName(name);
    setShowMateriModal(true);
  };

  const pillBase = "flex w-full items-center gap-2 rounded-full px-5 py-3.5 text-sm font-medium shadow-sm transition-all active:scale-95";

  return (
    <>
      <RealtimeLoading koleksi={["classes", "attendances", "assignments", "assignment_submissions"]} onRefresh={loadData} />
      <KidsPage loading={loading} loadingEmoji="📚" loadingText={t("kids.classes.loading")} width="max-w-[1400px]">
        <KidsHero
          badge={t("kids.classes.badge")}
          title={t("kids.classes.title")}
          subtitle={t("kids.classes.subtitle")}
        />

        {classes.length === 0 ? (
          <div className="rounded-2xl bg-white/70 p-10 text-center shadow-sm">
            <div className="mb-4 text-6xl">🤷</div>
            <h3 className="mb-2 text-2xl font-extrabold text-kids-ink">{t("kids.classes.empty")}</h3>
            <p className="font-medium text-kids-ink/70">{t("kids.classes.emptyDesc")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-10 xl:grid-cols-3">
            {classes.map((cls, i) => {
              const p = palettes[i % palettes.length];
              const progress = Math.max(0, Math.min(100, Math.round(cls.course_progress ?? 0)));
              return (
                <div
                  key={cls.id}
                  className={`flex flex-col overflow-hidden rounded-2xl shadow-lg transition-transform duration-300 hover:-translate-y-1 ${p.body}`}
                >
                  <div className={`rounded-b-2xl px-6 py-4 sm:px-8 ${p.head}`}>
                    <h3 className="truncate text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">{cls.name}</h3>
                    <p className="text-sm sm:text-base">{cls.schedule || t("kids.classes.noSchedule")}</p>
                    <p className="truncate text-sm opacity-90 sm:text-base">{cls.room || cls.course_name || " "}</p>
                  </div>

                  <div className="flex flex-1 flex-col justify-end space-y-4 px-4 pb-6 pt-10 sm:px-5 sm:pt-16">
                    {/* Progress */}
                    <div className={`${pillBase} ${p.pill} cursor-default active:scale-100`}>
                      <span className="whitespace-nowrap text-xs sm:text-sm">{t("kids.classes.progress")}</span>
                      <div className={`h-3 flex-1 overflow-hidden rounded-full ${p.track}`}>
                        <div className={`h-full rounded-full ${p.bar}`} style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-sm font-semibold">{progress}%</span>
                    </div>

                    {/* Material */}
                    {cls.materi_url ? (
                      <button
                        onClick={() => handleViewMateri(cls.materi_url!, cls.materi_name || t("kids.classes.material"))}
                        className={`${pillBase} ${p.pill} justify-center`}
                      >
                        <span>📘</span>
                        <span className="truncate">{cls.materi_name || t("kids.classes.viewMaterial")}</span>
                      </button>
                    ) : (
                      <div className={`${pillBase} ${p.pill} cursor-default justify-center opacity-90 active:scale-100`}>
                        {t("kids.classes.noMaterial")}
                      </div>
                    )}

                    {/* Attendance: dikunci kalau sudah absen hari ini */}
                    <button
                      onClick={() => handleTakeAttendanceClick(cls.id, cls.schedule)}
                      disabled={cls.attended_today}
                      className={`${pillBase} ${p.pill} justify-center font-bold disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100`}
                    >
                      {cls.attended_today && <span>🔒</span>}
                      {t("kids.classes.present")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </KidsPage>

      <TakeAttendanceModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        classId={selectedClassId || ""}
        schedule={selectedClassSchedule}
        onSuccess={() => {
          loadData();
        }}
      />

      <ViewMateriModal
        isOpen={showMateriModal}
        onClose={() => setShowMateriModal(false)}
        materiUrl={selectedMateriUrl}
        materiName={selectedMateriName}
      />
    </>
  );
}
