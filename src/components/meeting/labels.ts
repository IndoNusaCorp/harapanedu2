"use client";

import { useCallback } from "react";
import { useI18n } from "@/components/translate/client";
import type id from "@/components/translate/id";

export type MeetingVariant = "default" | "kids";

type RoomKeys = typeof id.meetingRoom;
type FlatKey<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K extends `${infer Base}#${string}` ? Base : K}`
    : FlatKey<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MeetingLabelKey = FlatKey<RoomKeys>;

// "meetingRoom.x" untuk tampilan umum, "kids.meetingRoom.x" untuk kids mode.
// Kedua kamus wajib punya key yang sama (dicek di labels.test.ts).
export function useMeetingLabels(variant: MeetingVariant) {
  const t = useI18n();
  return useCallback(
    (key: MeetingLabelKey, params?: Record<string, string | number>) => {
      const fullKey = `${variant === "kids" ? "kids.meetingRoom" : "meetingRoom"}.${key}`;
      return (t as unknown as (k: string, p?: Record<string, string | number>) => string)(fullKey, params);
    },
    [t, variant],
  );
}
