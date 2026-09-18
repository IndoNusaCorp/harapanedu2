import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import { GuessPictureGame } from "@/components/kids/games/GuessPictureGame";
import { setStaticParamsLocale } from "next-international/server";

export default async function GuessPictureGamePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setStaticParamsLocale(locale);
  return (
    <>
      <RealtimeLoading />
      <GuessPictureGame />
    </>
  );
}
