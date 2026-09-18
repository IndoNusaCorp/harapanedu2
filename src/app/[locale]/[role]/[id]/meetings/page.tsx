"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";

import React, { useState } from "react";
import { Video, Plus, Pencil, Trash2, Briefcase, User, X } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import KidsMeetings from "@/components/kids/KidsMeetings";
import { createMeeting, updateMeeting, deleteMeeting } from "@/lib/api";
import type { Meeting, CreateMeetingForm } from "@/lib/types";
import { CreateMeetingModal } from "@/components/modals/CreateMeetingModal";
import { useI18n } from "@/components/translate/client";
import { EduPage, EduHero, EduLoading, EduEmpty, eduCard, eduGlassButton } from "@/components/ui/edu";
import { MeetingRoom } from "@/components/meeting/MeetingRoom";
import { isMeetingLive, useMeetingLobby } from "@/components/meeting/useMeetingLobby";
import { useMeetingLabels } from "@/components/meeting/labels";

export default function MeetingsPage() {
  const { isKidsMode } = useRole();
  // Kids mode (SD kelas 1-6) memakai tampilan khusus anak
  return isKidsMode ? <KidsMeetings /> : <DefaultMeetings />;
}

function DefaultMeetings() {
  const t = useI18n();
  const L = useMeetingLabels("default");
  const lobby = useMeetingLobby();
  const isTeacher = lobby.role === "teacher";
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const handleCreateOrUpdate = async (form: CreateMeetingForm & { id?: string }) => {
    if (form.id) {
      await updateMeeting(form.id, form);
    } else {
      await createMeeting(form);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t("meetings.deleteConfirm"))) return;
    await deleteMeeting(id);
  };

  if (lobby.activeMeeting) {
    return (
      <MeetingRoom
        meeting={lobby.activeMeeting}
        uid={lobby.uid}
        role={lobby.role}
        name={lobby.name}
        variant="default"
        onExit={lobby.onExit}
      />
    );
  }

  return (
    <>
      <RealtimeLoading />
      <EduPage>
        <EduHero
          badge={t("common.academicWorkspace")}
          badgeIcon={Briefcase}
          title={t("meetings.title")}
          description={t("meetings.desc")}
          actions={isTeacher && (
            <button
              onClick={() => { setEditingMeeting(null); setShowModal(true); }}
              className={`${eduGlassButton} sm:px-16 sm:py-5 sm:text-xl`}
            >
              <Plus className="h-5 w-5" /> {t("meetings.schedule")}
            </button>
          )}
        />

        {lobby.exitReason && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
            <span>{L(`exit.${lobby.exitReason}`)}</span>
            <button onClick={lobby.dismissExit} className="rounded-lg p-1 hover:bg-black/5" aria-label={t("common.close")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mt-6 sm:mt-10">
          {lobby.loading ? (
            <EduLoading />
          ) : lobby.meetings.length > 0 ? (
            <div className="space-y-5">
              {lobby.meetings.map((meeting) => {
                const live = isMeetingLive(meeting);
                const joinedCount = live ? meeting.activeParticipants?.length || 0 : 0;
                return (
                  <div key={meeting.id} className={`${eduCard} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-8 sm:py-4 ${live ? "ring-2 ring-rose-400" : ""}`}>
                    <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-16">
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-edu-blue-deep sm:h-20 sm:w-20">
                        <Briefcase className="h-8 w-8 sm:h-10 sm:w-10" />
                        {live && <span className="absolute -right-1 -top-1 h-4 w-4 animate-pulse rounded-full border-2 border-edu-blue bg-rose-500" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-2xl sm:text-3xl">{meeting.title}</h3>
                          {live && <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-bold">{t("common.meetingStatus.live")}</span>}
                        </div>
                        <p className="text-xs">{meeting.time}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs">
                          <User className="h-3 w-3" />
                          {t("meetings.joined", { count: joinedCount })}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      {isTeacher && (
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditingMeeting(meeting); setShowModal(true); }} className="rounded-lg p-2 text-white/90 transition-colors hover:bg-white/15" aria-label={t("meetings.editAria")}><Pencil className="h-4 w-4" /></button>
                          <button onClick={(e) => handleDelete(e, meeting.id)} className="rounded-lg p-2 text-white/90 transition-colors hover:bg-rose-500/40" aria-label={t("meetings.deleteAria")}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                      <button
                        onClick={() => lobby.join(meeting)}
                        disabled={!lobby.name}
                        className={`${eduGlassButton} flex-1 font-bold disabled:opacity-50 sm:flex-none sm:px-16 sm:py-4`}
                      >
                        {isTeacher ? t("meetings.host") : t("meetings.join")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EduEmpty icon={Video} title={t("meetings.emptyTitle")} description={t("meetings.emptyDesc")} />
          )}
        </div>

        <CreateMeetingModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleCreateOrUpdate}
          initialData={editingMeeting || undefined}
        />
      </EduPage>
    </>
  );
}
