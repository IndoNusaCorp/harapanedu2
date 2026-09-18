"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, UserCircle2, LogOut, Menu } from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { KidsTopbar } from "@/components/kids/KidsTopbar";
import { AuthModal } from "@/components/auth/AuthModal";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { connecttoauth, connecttofirestore } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { useI18n } from "@/components/translate/client";
import { useClassLabel } from "@/components/translate/format";

// actions: tombol tambahan halaman (mis. riwayat chat AI) yang ditaruh di navbar
export function Topbar({ actions }: { actions?: React.ReactNode } = {}) {
  const router = useRouter();
  const { setRole, setClassLevel, classLevel, isKidsMode, toggleSidebar } = useRole();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userRoleId, setUserRoleId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const t = useI18n();
  const classLabel = useClassLabel();

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getSearchPlaceholder = () => {
    if (pathname?.includes("/assignment")) return t("topbar.searchAssignments");
    if (pathname?.includes("/my-classes")) return t("topbar.searchClasses");
    if (pathname?.includes("/my-work")) return t("topbar.searchClasses");
    return t("topbar.searchDefault");
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    const newParams = new URLSearchParams(searchParams.toString());
    if (query) {
      newParams.set("q", query);
    } else {
      newParams.delete("q");
    }
    router.replace(`${pathname}?${newParams.toString()}`);
  };

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
      setUserRoleId(data.role_id);

      // Set classLevel for kids mode
      setClassLevel(data.class ?? null);

      // Sync RoleContext with the database role
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
        setUserRoleId(null);
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

  // Render kids topbar for SD students (class 1-6)
  if (isKidsMode) return <KidsTopbar actions={actions} />;

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-x-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:gap-x-6 sm:px-6 lg:px-10 dark:border-white/10 dark:bg-edu-navy/90">
      <button
        type="button"
        className="rounded-lg p-2 text-edu-blue hover:bg-edu-blue/10 lg:hidden dark:text-white dark:hover:bg-white/10"
        onClick={toggleSidebar}
      >
        <span className="sr-only">{t("topbar.openMenu")}</span>
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-x-3 lg:gap-x-6">
        <div className="relative w-full max-w-md">
          <label htmlFor="search-field" className="sr-only">
            {t("topbar.search")}
          </label>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            id="search-field"
            className="block w-full rounded-xl border border-transparent bg-slate-100 py-2.5 pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-500 transition focus:border-edu-blue focus:ring-4 focus:ring-edu-blue/20 dark:bg-white/10 dark:text-white dark:placeholder:text-white/60"
            placeholder={getSearchPlaceholder()}
            type="search"
            name="search"
            value={searchParams.get("q") || ""}
            onChange={handleSearchChange}
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-x-2 sm:gap-x-4">
          {actions}
          {isAuthenticated && <NotificationBell />}

          {!isAuthenticated ? (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="rounded-xl bg-edu-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-edu-blue-deep"
            >
              {t("topbar.signIn")}
            </button>
          ) : (
            <div className="flex items-center gap-x-2 sm:gap-x-4">
              <div className="flex items-center gap-x-2 rounded-xl p-1 lg:bg-slate-100 lg:pr-4 dark:lg:bg-white/10">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-edu-blue text-white">
                  <UserCircle2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="hidden lg:flex lg:flex-col lg:items-start">
                  <span className="max-w-[160px] truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">
                    {userName}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-white/60">
                    {userRoleId === "1"
                      ? `${t("roles.student")}${classLevel ? ` · ${classLabel(classLevel)}` : ''}`
                      : userRoleId === "2" ? t("roles.teacher") : `${userName}`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-rose-300"
                title={t("topbar.logout")}
              >
                <span className="sr-only">{t("topbar.logout")}</span>
                <LogOut className="h-5 w-5" aria-hidden="true" />
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
