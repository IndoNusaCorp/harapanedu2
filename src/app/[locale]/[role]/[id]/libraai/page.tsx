"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";

import React from "react";
import { Mic, MicOff } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import KidsLibraAI from "@/components/kids/KidsLibraAI";
import { AiChat } from "@/components/ai/AiChat";
import { useLibraVoiceContext } from "@/context/LibraVoiceContext";
import VoiceOverlay from "@/components/voice/VoiceOverlay";
import { useI18n } from "@/components/translate/client";

export default function LibraAIPage() {
  const { isKidsMode } = useRole();
  // Kids mode (SD kelas 1-6) memakai tampilan khusus anak
  return isKidsMode ? <KidsLibraAI /> : <DefaultLibraAI />;
}

function DefaultLibraAI() {
  const { role } = useRole();
  const t = useI18n();
  const voice = useLibraVoiceContext();
  const isTeacher = role === "teacher";

  const suggestions = isTeacher
    ? [t("libra.suggestions.teacher1"), t("libra.suggestions.teacher2"), t("libra.suggestions.teacher3"), t("libra.suggestions.teacher4")]
    : [t("libra.suggestions.student1"), t("libra.suggestions.student2"), t("libra.suggestions.student3"), t("libra.suggestions.student4")];

  return (
    <>
      <RealtimeLoading />
      <AiChat
        assistant="libra"
        title={t("libra.title")}
        description={isTeacher ? t("libra.teacherDesc") : t("libra.desc")}
        placeholder={isTeacher ? t("libra.teacherPlaceholder") : t("libra.placeholder")}
        disclaimer={t("libra.disclaimer")}
        errorText={t("libra.errorReply")}
        suggestions={suggestions}
        inputAddon={
          <button
            type="button"
            onClick={voice.isActive ? voice.stopVoiceChat : voice.startManual}
            className={`shrink-0 rounded-lg p-2.5 transition-all ${voice.isActive
              ? "animate-pulse text-red-600 hover:bg-red-100"
              : "text-slate-600 hover:bg-white/70 hover:text-emerald-600"}`}
            title={voice.isActive ? t("libra.voiceStop") : t("libra.voiceStart")}
          >
            {voice.isActive ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        }
      >
        <VoiceOverlay
          status={voice.source === "manual" ? voice.status : "idle"}
          error={voice.error}
          onStop={voice.stopVoiceChat}
          isMuted={voice.isMuted}
          onToggleMute={voice.toggleMute}
          userTranscript={voice.userTranscript}
          aiTranscript={voice.aiTranscript}
          wakeDetected={voice.wakeDetected}
          panel={voice.panel}
          onClosePanel={voice.closePanel}
          onOpenFile={voice.openFile}
          variant="default"
        />
      </AiChat>
    </>
  );
}
