"use client";

import React from "react";
import { Loader2, X } from "lucide-react";
import { KidsPage, KidsHero } from "@/components/kids/ui";
import { useI18n } from "@/components/translate/client";
import { MeetingRoom } from "@/components/meeting/MeetingRoom";
import { isMeetingLive, useMeetingLobby } from "@/components/meeting/useMeetingLobby";
import { useMeetingLabels } from "@/components/meeting/labels";

export default function KidsMeetings() {
  const t = useI18n();
  const L = useMeetingLabels("kids");
  const lobby = useMeetingLobby();

  if (lobby.activeMeeting) {
    return (
      <MeetingRoom
        meeting={lobby.activeMeeting}
        uid={lobby.uid}
        role={lobby.role}
        name={lobby.name}
        variant="kids"
        onExit={lobby.onExit}
      />
    );
  }

  return (
    <KidsPage>
      <KidsHero
        badge={t("kids.meetings.badge")}
        title={t("kids.meetings.title")}
        subtitle={t("kids.meetings.subtitle")}
      />

      {lobby.exitReason && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-white px-4 py-3 font-bold text-kids-ink shadow-sm">
          <span>{L(`exit.${lobby.exitReason}`)}</span>
          <button onClick={lobby.dismissExit} className="rounded-xl p-1.5 text-kids-coral hover:bg-kids-rose/30" aria-label={t("common.close")}>
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {lobby.loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-3 text-5xl animate-bounce">🔍</div>
          <Loader2 className="h-8 w-8 animate-spin text-kids-coral" />
          <p className="mt-2 font-bold text-kids-ink">{t("kids.meetings.searching")}</p>
        </div>
      ) : lobby.meetings.length > 0 ? (
        <div className="space-y-4">
          {lobby.meetings.map((meeting) => {
            const live = isMeetingLive(meeting);
            return (
              <div key={meeting.id} className={`group flex flex-col gap-4 rounded-2xl p-4 text-white shadow-md transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center sm:p-5 ${live ? "bg-kids-coral ring-4 ring-kids-sun" : "bg-kids-periwinkle"}`}>
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/25 text-4xl transition-transform group-hover:rotate-6 sm:h-20 sm:w-20">
                    {live ? "🔴" : "🎥"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-2xl font-semibold sm:text-3xl">{meeting.title}</h3>
                      {live && <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-black text-kids-coral">{t("kids.meetings.liveNow")}</span>}
                    </div>
                    <p className="text-sm">⏰ {meeting.time}</p>
                    <p className="text-xs text-white/90">{t("kids.meetings.friendsJoined", { count: live ? meeting.activeParticipants?.length || 0 : 0 })}</p>
                  </div>
                </div>
                <button
                  onClick={() => lobby.join(meeting)}
                  disabled={!lobby.name}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/20 px-6 py-3.5 text-base font-bold backdrop-blur-md transition-all hover:bg-white/30 active:scale-95 disabled:opacity-50 sm:w-auto"
                >
                  {t("kids.meetings.joinNow")}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/70 py-20 text-center shadow-sm">
          <div className="mb-4 text-6xl">🎈</div>
          <h3 className="text-2xl font-black text-kids-ink">{t("kids.meetings.empty")}</h3>
          <p className="mt-2 font-medium text-kids-ink/70">{t("kids.meetings.emptyDesc")}</p>
        </div>
      )}
    </KidsPage>
  );
}
