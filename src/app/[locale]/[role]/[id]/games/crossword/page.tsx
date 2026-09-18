import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import { CrosswordGame } from "@/components/kids/games/CrosswordGame";
import { setStaticParamsLocale } from "next-international/server";

export default async function CrosswordGamePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setStaticParamsLocale(locale);
  return (
    <>
      <RealtimeLoading />
      <CrosswordGame />
    </>
  );
}
