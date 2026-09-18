"use client"
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/components/translate/client";
import { useRole } from "@/context/RoleContext";
import { AiChat, type AiChatApi } from "@/components/ai/AiChat";
import { ScorpioGradingModal } from "@/components/ai/ScorpioGradingModal";
import { GRADE_MARKER } from "@/lib/ai/tone";

// ============================================
// Halaman ScorpioAI (GradeHelper)
// ============================================
// - Kids mode (SD 1-6) : tampilan anak, hanya lihat & perbaiki nilai sendiri
// - Siswa SMP/SMA      : tampilan default, hanya lihat & perbaiki nilai sendiri
// - Guru               : bisa minta ScorpioAI menilai tugas yang dikumpulkan (wajib disetujui guru)
export default function AIGradesHelperPage() {
  const t = useI18n();
  const { role, isKidsMode } = useRole();
  const isTeacher = role === "teacher";
  const chatRef = useRef<AiChatApi>(null);
  const [showGradingModal, setShowGradingModal] = useState(false);

  // Marker [BANTU_NILAI] dari AI dihapus dari teks dan diganti tombol (khusus guru)
  const stripMarker = (content: string) => content.split(GRADE_MARKER).join("").trim();
  const renderGradeButton = (content: string) => isTeacher && content.includes(GRADE_MARKER) && (
    <button
      onClick={() => setShowGradingModal(true)}
      className="mt-4 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-edu-blue to-edu-indigo px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95"
    >
      <Sparkles className="h-5 w-5" />
      {t("scorpio.helpGrade")}
    </button>
  );

  if (isKidsMode) {
    return (
      <AiChat
        assistant="scorpio"
        variant="kids"
        title={t("kids.scorpio.title")}
        description={t("kids.scorpio.desc")}
        placeholder={t("kids.scorpio.placeholder")}
        disclaimer={t("kids.scorpio.disclaimer")}
        errorText={t("kids.scorpio.errorReply")}
        suggestions={[t("kids.scorpio.suggest1"), t("kids.scorpio.suggest2"), t("kids.scorpio.suggest3")]}
        transformContent={stripMarker}
      />
    );
  }

  const suggestions = isTeacher
    ? [t("scorpio.suggestions.teacher1"), t("scorpio.suggestions.teacher2"), t("scorpio.suggestions.teacher3"), t("scorpio.suggestions.teacher4")]
    : [t("scorpio.suggestions.student1"), t("scorpio.suggestions.student2"), t("scorpio.suggestions.student3"), t("scorpio.suggestions.student4")];

  return (
    <>
      <RealtimeLoading />
      <AiChat
        assistant="scorpio"
        apiRef={chatRef}
        title={t("scorpio.title")}
        description={isTeacher ? t("scorpio.teacherDesc") : t("scorpio.studentDesc")}
        placeholder={isTeacher ? t("scorpio.teacherPlaceholder") : t("scorpio.studentPlaceholder")}
        disclaimer={t("scorpio.disclaimer")}
        errorText={t("scorpio.errorReply")}
        suggestions={suggestions}
        transformContent={stripMarker}
        renderMessageExtra={renderGradeButton}
        inputAddon={isTeacher && (
          <button
            type="button"
            onClick={() => setShowGradingModal(true)}
            title={t("scorpio.helpGrade")}
            aria-label={t("scorpio.helpGrade")}
            className="shrink-0 rounded-lg p-2.5 text-slate-600 transition-colors hover:bg-white/70 hover:text-edu-indigo"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        )}
      >
        {isTeacher && (
          <ScorpioGradingModal
            isOpen={showGradingModal}
            onClose={() => setShowGradingModal(false)}
            onSaved={(count) => chatRef.current?.appendModelMessage(t("scorpio.grading.savedMessage", { count }))}
            onRejected={(items) => chatRef.current?.appendModelMessage(t("scorpio.grading.rejectedMessage", {
              list: items.map(g => `- ${g.student_name}: ${g.assignment_title}`).join("\n"),
            }))}
          />
        )}
      </AiChat>
    </>
  )
}
