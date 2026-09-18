import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import { DrawingGame } from "@/components/kids/games/DrawingGame";
import { setStaticParamsLocale } from "next-international/server";

export default async function DrawingGamePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setStaticParamsLocale(locale);
  return (
    <>
      <RealtimeLoading />
      <DrawingGame />
    </>
  );
}
