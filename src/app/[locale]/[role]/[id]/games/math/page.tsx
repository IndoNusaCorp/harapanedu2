import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import { MathGame } from "@/components/kids/games/MathGame";
import { setStaticParamsLocale } from "next-international/server";

export default async function MathGamePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setStaticParamsLocale(locale);
  return (
    <>
      <RealtimeLoading />
      <MathGame />
    </>
  );
}
