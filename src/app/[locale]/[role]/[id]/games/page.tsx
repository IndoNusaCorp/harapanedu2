import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";
import { KidsGamesDashboard } from "@/components/kids/KidsGamesDashboard";
import { setStaticParamsLocale } from "next-international/server";

export default async function GamesPage({ params }: { params: Promise<{ locale: string; role: string; id: string }> }) {
  const { locale } = await params;
  setStaticParamsLocale(locale);
  return (
    <>
      <RealtimeLoading />
      <KidsGamesDashboard />
    </>
  );
}
