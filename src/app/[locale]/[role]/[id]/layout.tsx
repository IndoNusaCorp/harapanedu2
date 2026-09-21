"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { KidsSidebar } from "@/components/kids/KidsSidebar";
import { useRole } from "@/context/RoleContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { LibraVoiceProvider } from "@/context/LibraVoiceContext";
import { connecttoauth, connecttofirestore } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const VALID_ROLES = ["pelajar", "pengajar"] as const;

export default function RoleLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const { setRole, setClassLevel, isKidsMode } = useRole();
  const [isValidated, setIsValidated] = useState(false);

  const role = params.role as string;
  const id = params.id as string;
  const basePath = `/${role}/${id}`;

  useEffect(() => {
    // Validate role param
    if (!VALID_ROLES.includes(role as any)) {
      router.replace("/");
      return;
    }

    // Set RoleContext based on URL role
    if (role === "pengajar") {
      setRole("teacher");
    } else {
      setRole("student");
    }

    // Validate auth: check if user is logged in and the id matches
    const unsubscribe = onAuthStateChanged(connecttoauth, async (user) => {
      if (!user) {
        // Not logged in, redirect to landing
        router.replace("/");
        return;
      }
      if (user.uid !== id) {
        // ID mismatch, redirect to correct URL
        router.replace("/");
        return;
      }

      // Fetch classLevel from Firestore to determine kids mode
      try {
        const userDoc = await getDoc(doc(connecttofirestore, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setClassLevel(data.class ?? null);
        }
      } catch (err) {
        console.error("Error fetching classLevel:", err);
      }

      setIsValidated(true);
    });

    return () => unsubscribe();
  }, [role, id, router, setRole, setClassLevel]);

  if (!isValidated) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-edu-blue dark:border-white"></div>
      </div>
    );
  }

  return (
    <NotificationProvider uid={id} basePath={basePath}>
      {/* Voice LibraAI global: "Hey Libra" bisa dipanggil dari beberapa halaman dan tetap jalan saat pindah halaman */}
      <LibraVoiceProvider basePath={basePath}>
        <div className="relative z-10 flex h-full w-full">
          {isKidsMode ? <KidsSidebar basePath={basePath} /> : <Sidebar basePath={basePath} />}
          <main className={`relative flex min-w-0 flex-1 flex-col overflow-y-auto ${isKidsMode ? "bg-kids-cream" : "bg-[#F1F5FF] dark:bg-edu-navy"}`}>
            {children}
          </main>
        </div>
      </LibraVoiceProvider>
    </NotificationProvider>
  );
}
