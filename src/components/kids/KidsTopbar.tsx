"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, LogOut, Menu } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { connecttoauth, connecttofirestore } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useI18n } from "@/components/translate/client";
import { useClassLabel } from "@/components/translate/format";

export function KidsTopbar({ actions }: { actions?: React.ReactNode } = {}) {
  const router = useRouter();
  const { setRole, classLevel, setClassLevel, toggleSidebar } = useRole();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const t = useI18n();
  const classLabel = useClassLabel();

  const fetchUserData = async (userId: string, fallbackEmail?: string) => {
    try {
      const userDoc = await getDoc(doc(connecttofirestore, "users", userId));

      if (!userDoc.exists()) {
        console.error("Firestore user_data query error: Document does not exist");
        if (fallbackEmail) {
          setUserName(fallbackEmail.split('@')[0]);
        }
        return;
      }

      const data = userDoc.data();
      const displayName = data.username || `${data.first_name || ''} ${data.last_name || ''}`.trim();
      setUserName(displayName || fallbackEmail?.split('@')[0] || t("common.user"));

      // Set classLevel for display
      setClassLevel(data.class ?? null);

      if (data.role_id === "2") {
        setRole("teacher");
      } else {
        setRole("student");
      }
    } catch (err) {
      console.error("Error fetching user data", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(connecttoauth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        fetchUserData(user.uid, user.email || undefined);
      } else {
        setIsAuthenticated(false);
        setUserName("");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (roleId: string, userId: string) => {
    const rolePath = roleId === "2" ? "pengajar" : "pelajar";
    router.push(`/${rolePath}/${userId}`);
  };

  const handleLogout = async () => {
    await signOut(connecttoauth);
    setRole("student");
    router.push("/");
  };

  // Get time-based greeting for kids
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 10) return t("kids.topbar.morning");
    if (hour < 14) return t("kids.topbar.day");
    if (hour < 18) return t("kids.topbar.afternoon");
    return t("kids.topbar.evening");
  };

  const getGreetingEmoji = () => {
    const hour = new Date().getHours();
    if (hour < 10) return "🌅";
    if (hour < 14) return "☀️";
    if (hour < 18) return "🌤️";
    return "🌙";
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-x-3 border-b border-amber-200/70 bg-kids-cream/90 px-4 backdrop-blur-md sm:px-6 lg:px-10">
      {/* Mobile hamburger */}
      <button
        type="button"
        className="rounded-xl p-2 text-kids-coral transition-colors hover:bg-kids-rose/30 active:scale-90 lg:hidden"
        onClick={toggleSidebar}
      >
        <span className="sr-only">{t("topbar.openMenu")}</span>
        <Menu className="h-7 w-7" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-x-3 lg:gap-x-6">
        {/* Search bar */}
        <form className="relative w-full max-w-md" action="#" method="GET">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white"
            aria-hidden="true"
          />
          <input
            id="kids-search-field"
            className="block w-full rounded-xl border-2 border-transparent bg-kids-pink py-2.5 pl-12 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white/90 transition-all focus:border-kids-coral focus:ring-4 focus:ring-kids-coral/25"
            placeholder={t("kids.topbar.searchPlaceholder")}
            type="search"
            name="search"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-x-2 lg:gap-x-3">
          {actions}
          {isAuthenticated && <NotificationBell variant="kids" />}

          {!isAuthenticated ? (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="rounded-xl bg-kids-coral px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:brightness-105 active:scale-95"
            >
              {t("kids.topbar.signIn")}
            </button>
          ) : (
            <div className="flex items-center gap-x-2">
              {/* User avatar & greeting */}
              <div className="flex items-center gap-x-3 rounded-xl p-1 lg:bg-white/70 lg:pr-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kids-sun text-lg shadow-sm">
                  😊
                </div>
                <div className="hidden lg:flex lg:flex-col lg:items-start">
                  <span className="max-w-[220px] truncate text-sm font-extrabold leading-tight text-kids-ink">
                    {t("kids.topbar.greeting", { greeting: getGreeting(), name: userName })} {getGreetingEmoji()}
                  </span>
                  <span className="text-xs font-semibold text-kids-coral">
                    {t("roles.student")}{classLevel ? ` · ${classLabel(classLevel)}` : ''} ⭐
                  </span>
                </div>
              </div>

              {/* Logout button */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-kids-ink/70 transition-all hover:bg-red-50 hover:text-red-500 active:scale-90"
                title={t("topbar.logout")}
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                <span className="hidden lg:inline text-sm font-bold">{t("topbar.logout")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </header>
  );
}
