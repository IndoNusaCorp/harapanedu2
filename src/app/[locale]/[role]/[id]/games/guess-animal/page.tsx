import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import { GuessAnimalGame } from "@/components/kids/games/GuessAnimalGame";
import { setStaticParamsLocale } from "next-international/server";

export default async function GuessAnimalGamePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setStaticParamsLocale(locale);
  return (
    <>
      <RealtimeLoading />
      <GuessAnimalGame />
    </>
  );
}
