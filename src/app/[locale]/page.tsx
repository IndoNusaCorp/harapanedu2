"use client";
import { RealtimeLoading } from "@/components/realtime-loading/RealtimeLoading";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { connecttoauth, connecttofirestore } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { AuthModal } from "@/components/auth/AuthModal";
import { useRole } from "@/context/RoleContext";
import { useI18n } from "@/components/translate/client";

export default function LandingPage() {
  const router = useRouter();
  const { setClassLevel } = useRole();
  const [checking, setChecking] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const t = useI18n();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(connecttoauth, async (user) => {
      if (user) {
        // User is logged in, fetch their role and redirect
        try {
          const userDoc = await getDoc(doc(connecttofirestore, "users", user.uid));
          const data = userDoc.data();
          const rolePath = data?.role_id === "2" ? "pengajar" : "pelajar";
          // Set classLevel for kids mode before redirect
          setClassLevel(data?.class ?? null);
          router.replace(`/${rolePath}/${user.uid}`);
        } catch (error) {
          console.error("Error fetching user role", error);
          setChecking(false);
        }
      } else {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleAuthSuccess = (roleId: string, userId: string) => {
    const rolePath = roleId === "2" ? "pengajar" : "pelajar";
    router.push(`/${rolePath}/${userId}`);
  };

  if (checking) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-edu-blue dark:text-white" />
      </div>
    );
  }

  const features = [
    { emoji: "📚", title: t("landing.studentTitle"), desc: t("landing.studentDesc"), className: "bg-kids-sun text-white" },
    { emoji: "👩‍🏫", title: t("landing.teacherTitle"), desc: t("landing.teacherDesc"), className: "bg-edu-blue text-white" },
    { emoji: "🤖", title: t("landing.aiTitle"), desc: t("landing.aiDesc"), className: "bg-kids-coral text-white" },
  ];

  return (
    <>
      <RealtimeLoading />
    <div className="h-full w-full overflow-y-auto bg-[#F1F5FF] dark:bg-edu-navy">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-6">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-edu-indigo to-edu-purple px-6 py-10 text-center text-white shadow-2xl shadow-purple-900/25 sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-white/10" />
          <div className="relative z-10 mx-auto max-w-2xl">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-md">
              <Sparkles className="h-4 w-4" />
              {t("landing.badge")}
            </span>

            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-edu-indigo sm:h-14 sm:w-14">
                <BookOpen className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t("landing.title")}</h1>
            </div>

            <p className="mb-8 text-base leading-relaxed text-white/90 sm:text-xl">{t("landing.subtitle")}</p>

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-edu-indigo shadow-lg transition-all hover:scale-[1.02] active:scale-95 sm:w-auto sm:text-lg"
            >
              {t("landing.button")}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-3 sm:gap-6">
          {features.map((f) => (
            <div key={f.emoji} className={`rounded-2xl p-6 shadow-md transition-transform hover:-translate-y-1 ${f.className}`}>
              <div className="mb-3 text-4xl">{f.emoji}</div>
              <h3 className="mb-1 text-lg font-bold">{f.title}</h3>
              <p className="text-sm text-white/90">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
    </>
  );
}
