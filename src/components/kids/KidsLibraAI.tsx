"use client";

import React from "react";
import { Mic, MicOff } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { AiChat } from "@/components/ai/AiChat";
import { useLibraVoice } from "@/hooks/useLibraVoice";
import VoiceOverlay from "@/components/voice/VoiceOverlay";
import { useI18n } from "@/components/translate/client";

export default function KidsLibraAI() {
  const { role, classLevel } = useRole();
  const t = useI18n();
  const voice = useLibraVoice({ role, classLevel: classLevel ?? 0 });

  return (
    <AiChat
      assistant="libra"
      variant="kids"
      title={t("kids.libra.greetingTitle")}
      description={`${t("kids.libra.greetingLine1")}. ${t("kids.libra.greetingLine2")}`}
      placeholder={t("kids.libra.placeholder")}
      disclaimer={t("kids.libra.disclaimer")}
      errorText={t("kids.libra.errorReply")}
      suggestions={[t("kids.libra.suggest1"), t("kids.libra.suggest2"), t("kids.libra.suggest3"), t("kids.libra.suggest4")]}
      inputAddon={
        <button
          type="button"
          onClick={voice.isActive ? voice.stopVoiceChat : voice.startVoiceChat}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-all active:scale-95 ${voice.isActive ? "animate-pulse bg-red-500" : "bg-white/25 hover:bg-white/35"}`}
          title={voice.isActive ? t("kids.libra.voiceStop") : t("kids.libra.voiceStart")}
        >
          {voice.isActive ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
      }
    >
      <VoiceOverlay
        status={voice.status}
        error={voice.error}
        onStop={voice.stopVoiceChat}
        isMuted={voice.isMuted}
        onToggleMute={voice.toggleMute}
        variant="kids"
      />
    </AiChat>
  );
}
