"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Users, Search, User, Shield, AlertTriangle } from "lucide-react";
import { getStudentList } from "@/lib/api";
import type { StudentList as StudentListType } from "@/lib/types";
import { connecttoauth } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { useI18n } from "@/components/translate/client";

interface StudentListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StudentListModal({ isOpen, onClose }: StudentListModalProps) {
  const t = useI18n();
  const [students, setStudents] = useState<StudentListType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(connecttoauth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen && !authLoading && currentUser) {
      const fetchStudents = async () => {
        setLoading(true);
        try {
          const data = await getStudentList();
          setStudents(data);
        } catch (error) {
          console.error("Error fetching students:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchStudents();
    }
  }, [isOpen, currentUser, authLoading]);

  if (!isOpen) return null;

  const filteredStudents = students.filter(
    (s) =>
      s.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.middle_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#003049] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{t("studentList.title")}</h2>
                <p className="text-blue-100 text-sm">{t("studentList.subtitle")}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors" aria-label={t("common.close")}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative z-10 mt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-200" />
              <input
                type="text"
                placeholder={t("studentList.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/20 text-white placeholder-blue-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {authLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
              <p>{t("studentList.verifying")}</p>
            </div>
          ) : !currentUser ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t("studentList.accessDenied")}</h3>
              <p className="text-slate-500 text-sm">{t("studentList.signInRequired")}</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
              <p>{t("studentList.loading")}</p>
            </div>
          ) : filteredStudents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredStudents.map((student) => (
                <div key={student.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-blue-500/30 transition-colors">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">
                      {[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ") || t("common.unknown")}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                        <Shield className="w-3 h-3" /> {t("studentList.studentBadge")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t("studentList.emptyTitle")}</h3>
              <p className="text-slate-500 text-sm">{t("studentList.emptyDesc")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
