"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { X, Loader2, FileText } from "lucide-react";
import { useI18n } from "@/components/translate/client";
import { connecttofirestore } from "@/lib/firebase";
import { getDocs, collection, query, where } from "firebase/firestore";

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { id?: string; title: string; course_name: string; description: string; due_date: string; materi_file?: File | null; class_id?: string }) => void;
  classes?: { id: string; name: string }[];
  defaultClassId?: string;
  initialData?: { id: string; title: string; course_name: string; description?: string; due_date: string; class_id?: string };
}

export function CreateAssignmentModal({ isOpen, onClose, onSuccess, classes = [], defaultClassId, initialData }: CreateAssignmentModalProps) {
  const t = useI18n();
  const params = useParams();
  const teacherid = params?.id as string | undefined;
  const [title, setTitle] = useState("");
  const [courseName, setCourseName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [classId, setClassId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMateri, setUploadMateri] = useState<File | null>(null);

  //State untuk mengambil data kelas terbaru dari guru
  const [newclassdataforassignment, setNewclassdataforassignment] = useState<any[]>([]);

  //Bagian sini untuk mengambil data kelas dari firestore, cuma kelas milik guru yang lagi login
  async function fetchnewclassdataforassignment() {
    if (!teacherid) return;
    try {
      const kelasmilikguru = query(collection(connecttofirestore, "classes"), where("teacher_id", "==", teacherid));
      const getclassfromfirestore = await getDocs(kelasmilikguru);
      const listclassfromfirestore = getclassfromfirestore.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setNewclassdataforassignment(listclassfromfirestore);
    } catch (error) {
      console.error("Error fetching class data for assignment:", error);
    }
  }

  //Ambil ulang data kelas tiap modal dibuka biar kelas yang baru dibikin ikut muncul
  React.useEffect(() => {
    if (isOpen) fetchnewclassdataforassignment();
  }, [isOpen, teacherid]);

  //Gabung kelas dari props dengan kelas dari firestore, id yang sama tidak didobel
  const classoptions: { id: string; name: string }[] = [
    ...classes,
    ...newclassdataforassignment
      .filter((cls) => !classes.some((c) => c.id === cls.id))
      .map((cls) => ({ id: cls.id, name: cls.name || cls.course_name || cls.id }))
  ];

  //Daftar mata pelajaran dari kelas guru, dipakai jadi saran di input course name (tidak didobel)
  const courseoptions: string[] = Array.from(
    new Set(newclassdataforassignment.map((cls) => cls.course_name).filter(Boolean))
  );

  //Course name ikut terisi otomatis dari kelas yang dipilih, tapi tidak menimpa kalau guru sudah ketik sendiri
  React.useEffect(() => {
    if (!isOpen || initialData) return;
    const kelasterpilih = newclassdataforassignment.find((cls) => cls.id === classId);
    const bolehditimpa = !courseName.trim() || courseoptions.includes(courseName);
    if (kelasterpilih?.course_name && bolehditimpa) setCourseName(kelasterpilih.course_name);
  }, [classId, newclassdataforassignment, isOpen, initialData]);

  const handleUploadMateri = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadMateri(file);
    }
  };

  React.useEffect(() => {
    if (initialData && isOpen) {
      setTitle(initialData.title || "");
      setCourseName(initialData.course_name || "");
      setDescription(initialData.description || "");
      if (initialData.due_date) {
        try {
          const date = new Date(initialData.due_date);
          const formatted = date.toISOString().slice(0, 16);
          setDueDate(formatted);
        } catch { setDueDate(""); }
      } else {
        setDueDate("");
      }
      setClassId(initialData.class_id || "");
      setUploadMateri(null);
    } else if (isOpen) {
      setClassId(defaultClassId || "");
    } else {
      setTitle(""); setCourseName(""); setDescription(""); setDueDate(""); setClassId(""); setUploadMateri(null);
    }
  }, [initialData, isOpen, defaultClassId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !courseName.trim() || !dueDate) {
      setError(t("modals.assignment.required"));
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      await onSuccess({
        id: initialData?.id,
        title,
        course_name: courseName,
        description,
        due_date: new Date(dueDate).toISOString(),
        class_id: classId || undefined,
        materi_file: uploadMateri
      });
      onClose();
    } catch {
      setError(t("modals.assignment.saveFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#003049] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center"><FileText className="w-5 h-5" /></div>
              <div><h2 className="text-xl font-bold">{initialData ? t("modals.assignment.editTitle") : t("modals.assignment.createTitle")}</h2><p className="text-indigo-100 text-sm">{initialData ? t("modals.assignment.editSubtitle") : t("modals.assignment.createSubtitle")}</p></div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors" aria-label={t("common.close")}><X className="w-5 h-5" /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.assignment.titleLabel")}</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all" placeholder={t("modals.assignment.titlePlaceholder")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.assignment.courseLabel")}</label>
              {/* Pakai datalist biar ada pilihan otomatis dari kelas guru, tapi tetap bisa diketik manual */}
              <input type="text" required list="courseoptionsforassignment" value={courseName} onChange={(e) => setCourseName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all" placeholder={t("modals.assignment.coursePlaceholder")} />
              <datalist id="courseoptionsforassignment">
                {courseoptions.map((course) => (<option key={course} value={course} />))}
              </datalist>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.assignment.dueLabel")}</label>
              <input type="datetime-local" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all" />
            </div>
          </div>

          {classoptions.length > 0 && (
            <div>
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.assignment.classLabel")}</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all">
                <option value="">{t("modals.assignment.allClasses")}</option>
                {classoptions.map((cls) => (<option key={cls.id} value={cls.id}>{cls.name}</option>))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.assignment.materialLabel")}</label>
            <input
              type="file"
              onChange={handleUploadMateri}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.png"
            />
            {uploadMateri && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t("common.selectedFile", { name: uploadMateri.name })}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{t("modals.assignment.descLabel")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#003049] border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-medium dark:text-white transition-all resize-none" placeholder={t("modals.assignment.descPlaceholder")} />
          </div>
          {error && <p className="text-sm text-rose-500 font-medium bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{t("common.cancel")}</button>
            <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-70">
              {isLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> {t("common.processing")}</> : initialData ? t("common.saveChanges") : t("modals.assignment.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
