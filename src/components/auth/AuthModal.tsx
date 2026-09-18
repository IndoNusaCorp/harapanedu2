"use client";

import React, { useState } from "react";
import { X, Mail, Lock, User, Loader2, Users, GraduationCap } from "lucide-react";
import { connecttoauth, connecttofirestore } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useI18n } from "@/components/translate/client";
import { useClassLabel } from "@/components/translate/format";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (roleId: string, userId: string) => void;
}

const CLASS_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Junior High (year 1-3 = level 7-9) and Senior High (year 1-3 = level 10-12)
// are still locked, so only Elementary (level 1-6) can register for now.
const LOCKED_CLASS_LEVELS = [7, 8, 9, 10, 11, 12];
const isClassLevelLocked = (level: number) => LOCKED_CLASS_LEVELS.includes(level);

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const t = useI18n();
  const classLabel = useClassLabel();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registration fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUserName] = useState("");
  const [roleId, setRoleId] = useState<string>("1"); // "1" = Pelajar, "2" = Pengajar
  const [classLevel, setClassLevel] = useState<number>(1); // 1 to 12

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Map Firebase auth error codes to a translated, user-friendly message.
  const getAuthErrorMessage = (err: any) => {
    switch (err?.code) {
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return t("auth.errors.invalidCredential");
      case "auth/email-already-in-use":
        return t("auth.errors.emailInUse");
      case "auth/weak-password":
        return t("auth.errors.weakPassword");
      case "auth/invalid-email":
        return t("auth.errors.invalidEmail");
      case "auth/too-many-requests":
        return t("auth.errors.tooManyRequests");
      default:
        return t("auth.errors.generic");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(connecttoauth, email, password);
        const user = userCredential.user;

        // Fetch user's role from database to redirect correctly
        const userDoc = await getDoc(doc(connecttofirestore, "users", user.uid));

        if (!userDoc.exists()) {
          console.error("Could not fetch role, defaulting to student");
          onSuccess("1", user.uid);
        } else {
          const userData = userDoc.data();
          onSuccess(userData.role_id || "1", user.uid);
        }
      } else {
        // Safety net in case a locked level still reaches the form.
        if (roleId === "1" && isClassLevelLocked(classLevel)) {
          setError(t("auth.classLevelLockedHint"));
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(connecttoauth, email, password);
        const user = userCredential.user;

        // Save to Firestore
        await setDoc(doc(connecttofirestore, "users", user.uid), {
          user_id: user.uid,
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName || null,
          username: username || null,
          role_id: roleId,
          class: roleId === "1" ? classLevel : null,
          created_at: new Date().toISOString()
        });

        onSuccess(roleId, user.uid);
      }

      onClose();
    } catch (err: any) {
      console.error("Authentication error:", err);
      setError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#003049] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 sm:p-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {isLogin ? t("auth.loginDesc") : t("auth.registerDesc")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("auth.firstName")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                      placeholder={t("auth.firstPlaceholder")}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("auth.middleName")}
                    </label>
                    <input
                      type="text"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                      placeholder={t("auth.middlePlaceholder")}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("auth.lastName")}
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                      placeholder={t("auth.lastPlaceholder")}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("auth.username")}
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                      placeholder={t("auth.usernamePlaceholder")}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("auth.role")}
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white appearance-none"
                    >
                      <option value="1">{t("roles.student")}</option>
                      <option value="2">{t("roles.teacher")}</option>
                    </select>
                  </div>
                </div>

                {roleId === "1" && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("auth.classLevel")}
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        value={classLevel}
                        onChange={(e) => setClassLevel(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white appearance-none"
                      >
                        {CLASS_LEVELS.map((level) => (
                          <option key={level} value={level} disabled={isClassLevelLocked(level)}>
                            {isClassLevelLocked(level)
                              ? `${classLabel(level)} (${t("auth.classLevelLocked")})`
                              : classLabel(level)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("auth.classLevelLockedHint")}
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1 mt-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("auth.email")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                  placeholder={t("auth.emailPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("auth.password")}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center mt-6"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                isLogin ? t("auth.signIn") : t("auth.createAccount")
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-500 dark:text-gray-400">
              {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-500 font-semibold transition-colors"
              >
                {isLogin ? t("auth.signUp") : t("auth.signIn")}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
