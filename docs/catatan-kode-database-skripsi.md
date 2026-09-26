# Catatan Penjelasan Kode dan Database HarapanEdu

Bahan penjelasan implementasi untuk skripsi · 23 September 2026 · Acuan repositori: commit `819d326`.

Catatan ini menjelaskan sepuluh fitur berdasarkan kode lokal yang diperiksa. Database yang digunakan adalah **Firebase Cloud Firestore**, sedangkan berkas disimpan pada **Firebase Storage**. Firebase Authentication digunakan untuk identitas pengguna. Struktur database di bawah merupakan hasil pembacaan kode, bukan hasil pemeriksaan langsung data pada Firebase Console.

Potongan kode diambil dari berkas asli; indentasi dirapikan dan bagian di luar fokus pembahasan tidak ditampilkan. Setiap potongan disertai lokasi sumber. Potongan tersebut merupakan bagian fungsi/komponen, sehingga tidak selalu dapat dijalankan secara mandiri.

## Dasar implementasi

Antarmuka dibangun menggunakan Next.js, React, dan TypeScript. Operasi data utama berada pada `src/lib/api.ts`. Modul ini adalah kumpulan fungsi layanan yang dipanggil aplikasi; endpoint HTTP untuk AI berada pada `src/app/api/`.

Firestore menyimpan collection, document, dan field. Keterkaitan data menggunakan ID berbentuk string, misalnya `class_id`, `assignment_id`, dan `student_id`; penggabungannya dikerjakan dalam kode aplikasi. Karena menggunakan Firestore, kode database yang ditampilkan berupa Firebase SDK, bukan SQL atau `CREATE TABLE`.

**Inisialisasi koneksi Firebase:** konfigurasi dibaca dari variabel lingkungan dalam `src/lib/firebase.ts`.

Sumber: [src/lib/firebase.ts](<../src/lib/firebase.ts>), baris 17–22.

```typescript
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const connecttoauth = getAuth(app);
const connecttofirestore = getFirestore(app);
const connecttostorage = getStorage(app);

export { app, connecttoauth, connecttofirestore, connecttostorage };
```

`connecttofirestore` digunakan untuk data terstruktur, `connecttostorage` untuk berkas, dan `connecttoauth` untuk pengguna yang sedang masuk.

| Lapisan | Guru | Siswa |
|---|---|---|
| Parameter URL `[role]` | `pengajar` | `pelajar` |
| Nilai dalam `RoleContext` | `teacher` | `student` |
| `users.role_id` | `"2"` | `"1"` |
| Menu kelas utama | My Work | My Classes |

Pola halaman adalah `/[locale]/[role]/[id]/...`; `id` mewakili UID pengguna. Siswa kelas 1–6 menggunakan tampilan Kids melalui `isKidsMode`, dengan sumber data utama yang sama. Sumber pengaturan: `src/context/RoleContext.tsx`, layout peran, dan `src/components/layout/Sidebar.tsx`.

## 1. Dashboard — guru dan siswa

**Penjelasan:** Dashboard merangkum aktivitas akademik. Guru melihat kelas yang diajar, ringkasan tugas, rata-rata nilai yang berkaitan dengan dirinya/kelasnya, dan meeting. Siswa melihat kelas, status tugas pribadi, GPA berbobot kredit, dan meeting. Data ringkasan dihitung dari collection yang sudah ada sehingga tidak memerlukan collection `dashboard`.

**Kode utama:** status tugas siswa digabungkan dengan dokumen pengumpulan miliknya. Guru menggunakan daftar tugas yang dibaca oleh `getAssignments()`.

Sumber: [src/app/[locale]/[role]/[id]/page.tsx](<../src/app/[locale]/[role]/[id]/page.tsx>), baris 107–115.

```typescript
const a = await getAssignments();
if (role === 'student') {
  // Tampilkan status milik siswa ini (started/submitted/graded), bukan status bersama
  const mySubs = await getStudentSubmissions(idParam);
  setAssignments(applyStudentStatus(a, mySubs));
} else {
  setAssignments(a);
}
```

**Database:** membaca `classes`, `assignments`, `assignment_submissions`, `grades`, dan `meetings`. Nama pengguna juga dibaca dari `student`/`teacher`, dengan fallback ke `users`. Kelas guru dipilih menggunakan `teacher_id`; nilai siswa menggunakan `student_id`.

**Kode database — query kelas guru:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 110–116.

```typescript
const q = query(
  collection(connecttofirestore, "classes"),
  where("teacher_id", "==", teacherId),
  orderBy("created_at", "desc")
);
const querySnapshot = await getDocs(q);
return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClassData));
```

`where()` menentukan kelas milik guru dan `orderBy()` mengurutkannya. Rata-rata pada Dashboard guru menyaring nilai berdasarkan `graded_by` atau ID kelas guru. Daftar kelas siswa pada kode saat ini memakai `getClasses()` yang membaca seluruh kelas.

**Berkas utama:** [src/app/[locale]/[role]/[id]/page.tsx](<../src/app/[locale]/[role]/[id]/page.tsx>); [src/components/kids/KidsDashboard.tsx](<../src/components/kids/KidsDashboard.tsx>); [src/lib/api.ts](<../src/lib/api.ts>).

## 2. My Work — menu utama guru

**Penjelasan:** My Work membantu guru mengelola kelas, menambahkan tugas, membuka materi, dan memantau pekerjaan yang belum dinilai. Halaman memanggil `getTeacherClasses()` lalu `applyClassWorkStats()` untuk menghitung statistik setiap kelas. Sidebar mengarahkan guru ke My Work; siswa diarahkan ke My Classes.

**Kode utama sekaligus pembacaan database — sumber statistik kelas:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 923–939.

```typescript
const [assignments, submittedSnap, grades, attendanceSnap] = await Promise.all([
  getAssignments(),
  getDocs(query(collection(connecttofirestore, "assignment_submissions"), where("status", "==", "submitted"))),
  getGrades(),
  getDocs(query(collection(connecttofirestore, "attendances"), where("status", "in", ["Attended", "Late"]))),
]);

const classOfAssignment = new Map(assignments.map(a => [a.id, a.class_id]));
const gradedKeys = new Set(grades.map(g => `${g.assignment_id}_${g.student_id}`));

const counts = new Map<string, number>();
submittedSnap.docs.forEach(d => {
  const sub = d.data();
  if (gradedKeys.has(`${sub.assignment_id}_${sub.student_id}`)) return;
  const classId = classOfAssignment.get(sub.assignment_id);
  if (classId) counts.set(classId, (counts.get(classId) || 0) + 1);
});
```

Pengumpulan berstatus `submitted` dihitung sebagai pekerjaan yang perlu dinilai, kecuali sudah mempunyai pasangan `assignment_id` dan `student_id` pada `grades`. `feedback_count` menghitung nilai yang memiliki umpan balik. `student_count` menghitung siswa unik dengan absensi `Attended`/`Late`, sehingga bukan jumlah enrollment.

**Database:** `classes`, `assignments`, `assignment_submissions`, `grades`, dan `attendances`. Pembuatan kelas menyimpan identitas guru dan waktu pembuatan; berkas materi diunggah ke Storage terlebih dahulu.

**Kode database — membuat kelas:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 125–130.

```typescript
const user = connecttoauth.currentUser;
const docRef = await addDoc(collection(connecttofirestore, "classes"), cleanData({
  ...form,
  teacher_id: user?.uid,
  created_at: new Date().toISOString()
}));
```

`cleanData()` menghapus field bernilai `undefined` dan field `id` sebelum penulisan. `addDoc()` menghasilkan ID dokumen baru. Jika kelas baru memiliki jadwal yang valid, `syncClassSchedule()` juga membuat event kalender dan meeting terkait.

**Berkas utama:** [src/app/[locale]/[role]/[id]/my-work/page.tsx](<../src/app/[locale]/[role]/[id]/my-work/page.tsx>); [src/app/[locale]/[role]/[id]/assignment/class/[classId]/page.tsx](<../src/app/[locale]/[role]/[id]/assignment/class/[classId]/page.tsx>); [src/lib/api.ts](<../src/lib/api.ts>).

## 3. My Classes — menu utama siswa

**Penjelasan:** Siswa melihat kelas dan materi, mengisi absensi, serta memantau kemajuan belajar. Jika halaman ini dibuka sebagai guru, kode juga menyediakan pengelolaan kelas. Data siswa dimuat melalui `applyStudentProgress(await getClasses(), studentId)`.

**Kode utama — perhitungan progres individu:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 1000–1010.

```typescript
return classes.map(cls => {
  const hadir = attendedClassIds.has(cls.id);
  const tugas = assignments.filter(a => a.class_id === cls.id);
  const selesai = tugas.filter(a => uploadedIds.has(a.id)).length;

  let progress: number;
  if (tugas.length === 0) progress = hadir ? 100 : 0;
  else progress = (hadir ? 50 : 0) + (selesai / tugas.length) * 50;

  return { ...cls, course_progress: progress, attended_today: absenHariIni.has(cls.id) };
});
```

`hadir` berarti siswa pernah mempunyai absensi `Attended` atau `Late` pada kelas tersebut. `uploadedIds` memuat tugas dengan submission `submitted`/`graded`. Jika ada tugas, progres = 50% komponen kehadiran + 50% proporsi tugas terkumpul. Jika belum ada tugas, kehadiran memberi progres 100%. Nilai progres individu ini dihitung saat data dibaca, bukan ditulis sebagai progres setiap siswa pada dokumen kelas.

**Database:** `classes` untuk informasi kelas dan URL materi; `attendances` untuk absensi; `assignments` serta `assignment_submissions` untuk progres. Bukti absensi berada di Storage dengan URL pada `attendances.proof_url`.

**Kode database — menyimpan absensi dan memperbarui penghitung kelas:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 845–861.

```typescript
const docRef = await addDoc(collection(connecttofirestore, "attendances"), cleanData({
  ...form,
  created_at: new Date().toISOString()
}));

// Update class counters
const classRef = doc(connecttofirestore, "classes", form.class_id);
let updateData: any = { 
  course_progress: increment(1)
};

if (form.status === 'Attended') updateData.attendance = increment(1);
else if (form.status === 'Absence') updateData.absence = increment(1);
else if (form.status === 'Late') updateData.late = increment(1);
else if (form.status === 'ExcusedAbsen') updateData.excused_absence = increment(1);

await updateDoc(classRef, updateData);
```

Setiap status memperbarui penghitung kelas yang sesuai. Penghitung pada dokumen kelas bersifat agregat, berbeda dari persentase progres individu yang dihitung di atas. Fungsi penyimpanan bernama `TakeAttandance()` sesuai ejaan pada kode.

**Berkas utama:** [src/app/[locale]/[role]/[id]/my-classes/page.tsx](<../src/app/[locale]/[role]/[id]/my-classes/page.tsx>); [src/components/kids/KidsMyClasses.tsx](<../src/components/kids/KidsMyClasses.tsx>); [src/components/modals/TakeAttendanceModal.tsx](<../src/components/modals/TakeAttendanceModal.tsx>).

## 4. Assignment — guru dan siswa

**Penjelasan:** Guru membuat, mengubah, dan menghapus tugas; menentukan kelas serta tenggat; mengunggah soal; dan memeriksa jawaban siswa. Siswa membuka tugas, membaca materi, dan mengunggah jawaban. Saat tugas dibuka siswa, `startAssignment()` membuat status `started` jika belum ada submission.

**Kode utama sekaligus database — pembuatan tugas oleh guru:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 256–262.

```typescript
const user = connecttoauth.currentUser;
const docRef = await addDoc(collection(connecttofirestore, "assignments"), cleanData({
  ...form,
  teacher_id: user?.uid,
  status: 'active',
  created_at: new Date().toISOString()
}));
```

**Alur berkas siswa:** `handleStudentSubmit()` memanggil `uploadClassMateri(selectedFile)`. Setelah memperoleh URL unduhan dari Storage, halaman memanggil `submitAssignment(assignment.id, selectedFile.name, url)`.

**Kode database — penyimpanan pengumpulan siswa:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 415–425.

```typescript
// In Firestore, we can use a composite ID for upsert, e.g. `${assignmentId}_${studentId}`
const submissionId = `${assignmentId}_${user.uid}`;
await setDoc(doc(connecttofirestore, "assignment_submissions", submissionId), cleanData({
  assignment_id: assignmentId,
  student_id: user.uid,
  status: 'submitted',
  submitted_at: new Date().toISOString(),
  file_name: fileName || null,
  file_url: fileUrl || null,
  is_late: false
}), { merge: true });
```

**Database:** `assignments` menyimpan tugas dan `materi_url`; `assignment_submissions` menyimpan jawaban per siswa dan `file_url`; `grades` menyimpan hasil penilaiannya. ID submission menggunakan pola `{assignmentId}_{studentId}`. `setDoc(..., { merge: true })` memperbarui dokumen yang sama dan mempertahankan field lain, misalnya `started_at`.

Alur normal status pribadi: `active` → `started` → `submitted` → `graded`. Field `assignments.status` adalah status bersama; `applyStudentStatus()` menggantinya untuk tampilan siswa dengan status submission milik siswa tersebut. Pada implementasi saat ini, `submitAssignment()` masih mengisi `is_late: false`; penanda tenggat terlewati pada antarmuka dihitung terpisah dari `due_date`.

**Berkas utama:** [src/app/[locale]/[role]/[id]/assignment/page.tsx](<../src/app/[locale]/[role]/[id]/assignment/page.tsx>); [src/app/[locale]/[role]/[id]/assignment/[assignmentId]/page.tsx](<../src/app/[locale]/[role]/[id]/assignment/[assignmentId]/page.tsx>); [src/components/modals/CreateAssignmentModal.tsx](<../src/components/modals/CreateAssignmentModal.tsx>).

## 5. Grades — guru dan siswa

**Penjelasan:** Guru memasukkan dan mengelola nilai, memberikan umpan balik, serta melihat ringkasan GPA siswa. Siswa melihat nilai pribadinya, status capaian, feedback, dan mengunduh laporan PDF. Pembuatan nilai juga memperbarui submission yang sudah terkumpul menjadi `graded` serta mengirim notifikasi.

**Kode utama sekaligus database — menyimpan nilai:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 503–511.

```typescript
const user = connecttoauth.currentUser;
const docRef = await addDoc(collection(connecttofirestore, "grades"), cleanData({
  ...form,
  graded_by: user?.uid,
  created_at: new Date().toISOString()
}));
await setSubmissionStatus(form.assignment_id, form.student_id, 'graded');
await notifyGrade(docRef.id, form);
return { ...form, graded_by: user?.uid, id: docRef.id } as unknown as Grade;
```

**Kode database — membaca nilai siswa yang dipilih:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 451–457.

```typescript
const q = query(
  collection(connecttofirestore, "grades"),
  where("student_id", "==", studentId),
  orderBy("created_at", "desc")
);
const querySnapshot = await getDocs(q);
return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as unknown as Grade));
```

**Database:** `grades` memuat `student_id`, `assignment_id`, `class_id`, `course_name`, `score`, `grade_letter`, `credits`, `feedback`, dan `graded_by`. `users` menyediakan nama siswa; `assignment_submissions` menyimpan status penilaian; `notifications` menyimpan pemberitahuan hasilnya.

**Perhitungan:** GPA = Σ(poin dari skor × credits) / Σ(credits), dengan dua angka desimal. Poin skor pada kode: ≥90 = 4,0; ≥85 = 3,7; ≥80 = 3,3; ≥75 = 3,0; ≥70 = 2,7; ≥65 = 2,3; ≥60 = 2,0; di bawah 60 = 0. GPA dihitung ulang dari nilai, bukan bergantung pada field `cumulative_gpa` tersimpan. Skala ini adalah aturan aplikasi yang ditemukan pada kode, bukan klaim kebijakan resmi sekolah.

Halaman Grades guru saat ini memakai `getGrades()` dan `getStudentGPAs()` yang membaca seluruh data nilai, sedangkan siswa memakai query `student_id`. Ekspor PDF menggunakan `src/lib/gradeReportPdf.ts` dan diunduh melalui browser.

**Berkas utama:** [src/app/[locale]/[role]/[id]/grades/page.tsx](<../src/app/[locale]/[role]/[id]/grades/page.tsx>); [src/components/kids/KidsGrades.tsx](<../src/components/kids/KidsGrades.tsx>); [src/components/modals/GradeAssignmentModal.tsx](<../src/components/modals/GradeAssignmentModal.tsx>); [src/lib/gradeReportPdf.ts](<../src/lib/gradeReportPdf.ts>).

## 6. Schedule — guru dan siswa

**Penjelasan:** Menu Schedule menggunakan halaman `calendar`. Guru membuat, mengubah, dan menghapus kegiatan; siswa melihat kegiatan berdasarkan tanggal. Kalender membedakan jenis kegiatan seperti kelas, tenggat, meeting, dan ujian melalui `event_type`.

**Kode utama — memilih kegiatan pada suatu tanggal:**

Sumber: [src/app/[locale]/[role]/[id]/calendar/page.tsx](<../src/app/[locale]/[role]/[id]/calendar/page.tsx>), baris 49–56.

```typescript
const getEventsForDate = (date: Date) => events.filter((e) => {
  try {
    const eventDate = new Date(e.event_date);
    return isSameDay(eventDate, date);
  } catch { return false; }
});

const selectedDateEvents = getEventsForDate(selectedDate);
```

**Database:** `calendar_events` menyimpan judul, tanggal, jam, lokasi, jenis kegiatan, ID kelas jika ada, dan UID pembuat. `getCalendarEvents()` membaca data berurutan berdasarkan `event_date`.

**Kode database — membuat kegiatan:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 617–623.

```typescript
const user = connecttoauth.currentUser;
const docRef = await addDoc(collection(connecttofirestore, "calendar_events"), cleanData({
  ...form,
  created_by: user?.uid,
  created_at: new Date().toISOString()
}));
return { ...form, created_by: user?.uid, id: docRef.id } as unknown as CalendarEvent;
```

`updateCalendarEvent()` memakai `updateDoc()`, sedangkan `deleteCalendarEvent()` memakai `deleteDoc()`. Event dipantau oleh `RealtimeLoading` melalui listener Firestore. Pada kode ini, pembacaan kalender belum memfilter berdasarkan kelas atau pembuat. Sinkronisasi dari kelas terjadi saat kelas dibuat dengan jadwal; perubahan jadwal kelas belum otomatis memperbarui event dan meeting yang sudah dibuat. Pembuatan tugas biasa juga belum otomatis membuat event tenggat.

**Berkas utama:** [src/app/[locale]/[role]/[id]/calendar/page.tsx](<../src/app/[locale]/[role]/[id]/calendar/page.tsx>); [src/components/kids/KidsCalendar.tsx](<../src/components/kids/KidsCalendar.tsx>); [src/components/modals/CreateEventModal.tsx](<../src/components/modals/CreateEventModal.tsx>).

## 7. ScorpioAI — guru dan siswa

**Penjelasan:** ScorpioAI adalah asisten penilaian. Guru dapat meminta ringkasan nilai dan usulan penilaian dari berkas jawaban siswa. Siswa dapat memahami nilai serta feedback miliknya dan memperoleh arahan perbaikan belajar. API menolak aksi penilaian dari pengguna yang bukan guru.

**Alur:** browser → `/api/ScorpioAI` → verifikasi Firebase ID token → `buildAiData()` → pembacaan berkas Storage → Gemini → pratinjau hasil → persetujuan guru → `createGrade()`.

**Kode utama — pembuatan usulan nilai:**

Sumber: [src/lib/ai/scorpioai/scorpioai.ts](<../src/lib/ai/scorpioai/scorpioai.ts>), baris 257–265.

```typescript
const res = await ai.models.generateContent({
  model: AI_MODEL,
  contents: [{ role: "user", parts }],
  config: { systemInstruction, responseMimeType: "application/json", responseJsonSchema: GRADE_SCHEMA },
});
const parsed = JSON.parse(res.text || "{}");
if (!parsed.readable) return { skipped };

const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
```

Respons AI berupa JSON dengan `score`, `feedback`, dan `readable`. Skor dibatasi menjadi bilangan bulat 0–100; berkas yang dinyatakan tidak terbaca dilewati. Server memeriksa `user.role === "teacher"` sebelum menjalankan penilaian, membatasi satu permintaan hingga 10 submission, dan mencocokkan pilihan dengan submission dalam cakupan data guru.

**Kode penyimpanan setelah guru menekan setuju:**

Sumber: [src/components/ai/ScorpioGradingModal.tsx](<../src/components/ai/ScorpioGradingModal.tsx>), baris 97–107.

```typescript
const ok = await createGrade({
  course_name: r.course_name || "Unknown",
  student_id: r.student_id,
  assignment_id: r.assignment_id,
  class_id: r.class_id,
  score: r.score,
  grade_letter: r.grade_letter,
  feedback: r.feedback,
  credits: 1,
});
if (ok) saved++;
```

Guru dapat mengubah skor dan feedback sebelum menyetujui. Pemanggilan model sendiri belum menulis nilai ke database. `createGrade()` menggunakan kode Firestore pada bagian Grades.

**Database:** `users`, `classes`, `assignments`, `assignment_submissions`, dan `grades` menjadi sumber utama penilaian; konteks bersama juga mengambil absensi, jadwal, dan meeting. Riwayat percakapan berada pada `ai_chats` dengan `assistant: "scorpio"`. Struktur serta kode penyimpanan riwayat sama dengan bagian LibraAI di bawah. File soal dan jawaban dibaca dari URL Storage yang tercantum dalam data aplikasi.

**Berkas utama:** [src/app/[locale]/[role]/[id]/grades/ai-grades-helper/page.tsx](<../src/app/[locale]/[role]/[id]/grades/ai-grades-helper/page.tsx>); [src/app/api/ScorpioAI/route.ts](<../src/app/api/ScorpioAI/route.ts>); [src/lib/ai/scorpioai/scorpioai.ts](<../src/lib/ai/scorpioai/scorpioai.ts>); [src/components/ai/ScorpioGradingModal.tsx](<../src/components/ai/ScorpioGradingModal.tsx>).

## 8. LibraAI — guru dan siswa

**Penjelasan:** LibraAI membantu guru menyiapkan rencana pembelajaran, latihan, dan ringkasan materi. Untuk siswa, LibraAI menjelaskan materi dan membimbing pemahaman tugas. Instruksi model membedakan peran dan jenjang siswa, serta mengarahkan urusan penilaian ke ScorpioAI.

**Kode utama — mengirim pesan, konteks, dan lampiran ke model:**

Sumber: [src/lib/ai/libraai/libraai.ts](<../src/lib/ai/libraai/libraai.ts>), baris 142–148.

```typescript
const result = await genAIforLibra().models.generateContent({
  model: AI_MODEL,
  contents: [...history, { role: "user", parts: [...(await filesToParts(attachments)), { text: message }] }],
  config: {
    systemInstruction: libraSystemInstruction(user, data.context, publicFiles(data.files), body.locale),
  },
});
```

`libraSystemInstruction()` menyusun instruksi berdasarkan peran, jenjang, bahasa, dan data Firestore. `filesToParts()` membaca lampiran yang dipilih. API membatasi riwayat yang dikirim menjadi 20 pesan dan lampiran maksimal 3 berkas. Nama model yang tertulis pada kode LibraAI dan ScorpioAI adalah `gemini-3.8-flash`; catatan ini tidak menguji ketersediaan layanan model tersebut.

**Database:** `buildAiData()` mengambil konteks dari collection akademik. Riwayat teks menggunakan `ai_chats` dengan `user_id`, `assistant`, `title`, `messages`, `created_at`, dan `updated_at`. Untuk LibraAI, nilai `assistant` adalah `"libra"`.

**Kode database — dokumen riwayat baru dan pembaruan pesan:**

Sumber: [src/hooks/useAiChats.ts](<../src/hooks/useAiChats.ts>), baris 92–100.

```typescript
const session: Omit<AiChatSession, "id"> = {
  user_id: uid,
  assistant,
  title: chatTitle(firstUser?.content || "Chat"),
  messages: trimmed,
  created_at: now,
  updated_at: now,
};
const ref = await addDoc(collection(connecttofirestore, "ai_chats"), session);
```

Sumber: [src/hooks/useAiChats.ts](<../src/hooks/useAiChats.ts>), baris 106.

```typescript
await updateDoc(doc(connecttofirestore, "ai_chats", currentId), { messages: trimmed, updated_at: now });
```

Array `messages` menyimpan peran pengirim (`user`/`model`), isi pesan, waktu, dan nama lampiran jika ada. Aplikasi menyimpan hingga 100 pesan terakhir per chat dan membatasi riwayat menjadi 5 chat per pengguna per asisten. Jika penuh, pembuatan chat baru meminta persetujuan pengguna untuk menghapus chat yang paling lama tidak diperbarui.

**Berkas utama:** [src/app/[locale]/[role]/[id]/libraai/page.tsx](<../src/app/[locale]/[role]/[id]/libraai/page.tsx>); [src/app/api/LibraAI/route.ts](<../src/app/api/LibraAI/route.ts>); [src/lib/ai/libraai/libraai.ts](<../src/lib/ai/libraai/libraai.ts>); [src/components/ai/AiChat.tsx](<../src/components/ai/AiChat.tsx>); [src/hooks/useAiChats.ts](<../src/hooks/useAiChats.ts>).

## 9. LibraAI Voice — guru dan siswa

**Penjelasan:** LibraAI Voice menyediakan percakapan suara melalui Gemini Live. Guru memperoleh bantuan mengajar dan ringkasan data akademik; siswa memperoleh bantuan belajar serta akses ke nilai pribadinya. Pengguna dapat memulai melalui tombol mikrofon atau panggilan “Hey Libra” pada halaman yang diizinkan, jika browser mendukung pengenalan suara dan izin mikrofon diberikan.

**Alur:** mikrofon → audio PCM → Gemini Live → jawaban suara dan transkrip pada antarmuka. Server memverifikasi pengguna dan mengambil konteks Firestore sebelum menerbitkan token sementara untuk koneksi browser.

**Kode utama — pengiriman audio mikrofon:**

Sumber: [src/hooks/useLibraVoice.ts](<../src/hooks/useLibraVoice.ts>), baris 409–414.

```typescript
sessionRef.current.sendRealtimeInput({
  audio: {
    data: base64Audio,
    mimeType: "audio/pcm;rate=16000",
  },
});
```

Audio masukan dikirim dengan laju 16 kHz; pemutaran respons pada hook menggunakan 24 kHz. Endpoint `/api/libraai-voice` mengembalikan token, model, instruksi, dan deklarasi tool. Model suara yang tertulis pada kode adalah `gemini-2.5-flash-native-audio-preview-12-2025`.

**Database — pembacaan data sesuai identitas siswa:** fungsi bersama `buildAiData()` menggunakan query berikut untuk data pribadi. Guru mendapatkan penyaringan kelas/tugas/nilai sesuai hubungan kepemilikannya di `buildTeacherData()`.

Sumber: [src/lib/ai/dataContext.ts](<../src/lib/ai/dataContext.ts>), baris 35–38.

```typescript
async function whereEq(koleksi: string, field: string, value: string): Promise<Row[]> {
  const snap = await getDocs(query(collection(connecttofirestore, koleksi), where(field, "==", value)));
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}
```

Sumber: [src/lib/ai/dataContext.ts](<../src/lib/ai/dataContext.ts>), baris 83–92.

```typescript
const [users, classes, assignments, mySubs, myGrades, myAttendance, meetings, events] = await Promise.all([
  all("users"),
  all("classes"),
  all("assignments"),
  whereEq("assignment_submissions", "student_id", user.uid),
  whereEq("grades", "student_id", user.uid),
  whereEq("attendances", "student_id", user.uid),
  all("meetings"),
  all("calendar_events"),
]);
```

Tool `show_documents` membaca daftar URL materi/soal/jawaban dari konteks data dan menampilkannya pada panel. Tool `show_grades` menampilkan nilai sesuai cakupan pengguna; `close_panel` menutup panel di browser. Pemanggilan tool data dilayani melalui `/api/libraai-voice/tools` setelah verifikasi identitas kembali.

Tidak ditemukan collection khusus sesi suara maupun penulisan rekaman/transkrip Voice ke Firestore atau Storage pada alur ini. Audio dikirim langsung ke Gemini Live; transkrip disimpan sementara dalam state React. Preferensi aktivasi wake word menggunakan `localStorage` dengan kunci `libra.wakeWordEnabled`.

**Berkas utama:** [src/context/LibraVoiceContext.tsx](<../src/context/LibraVoiceContext.tsx>); [src/hooks/useLibraVoice.ts](<../src/hooks/useLibraVoice.ts>); [src/hooks/useWakeWord.ts](<../src/hooks/useWakeWord.ts>); [src/app/api/libraai-voice/route.ts](<../src/app/api/libraai-voice/route.ts>); [src/app/api/libraai-voice/tools/route.ts](<../src/app/api/libraai-voice/tools/route.ts>).

## 10. Meeting — guru dan siswa

**Penjelasan:** Meeting menyediakan pertemuan daring. Antarmuka guru menyediakan pembuatan/pengelolaan meeting, kontrol peserta, persetujuan berbagi layar, perekaman, dan pengakhiran sesi. Siswa dapat bergabung, mengatur mikrofon/kamera, mengangkat tangan, mengirim pesan/reaksi, dan meminta izin berbagi layar.

**Kode utama — koneksi media antarpeserta:**

Sumber: [src/hooks/useMeetingRoom.ts](<../src/hooks/useMeetingRoom.ts>), baris 404–407.

```typescript
if (!camCalls.current.has(p.uid) && shouldCall(uid, p.uid)) {
  const call = peer.call(p.peerId!, out, { metadata: { uid, kind: "cam" } });
  if (call) registerCamCall(p.uid, call);
}
```

`peer.call()` dari PeerJS membangun panggilan media menggunakan WebRTC. Firestore menyinkronkan identitas peer, peserta, status mikrofon/kamera, dan kendali ruang; aliran audio/video tidak disimpan pada document Firestore.

**Database:** dokumen `meetings/{meetingId}` menyimpan metadata dan state ruang. Field yang digunakan antara lain `teacher_id`, `class_id`, `status`, `host_id`, `activeParticipants`, `participantStates`, `screenShare`, `shareRequests`, `muteAllAt`, `recording`, dan `isEnded`. Pesan serta reaksi menggunakan subcollection `messages` dan `reactions`.

**Kode database — sinkronisasi dan pengiriman chat:**

Sumber: [src/hooks/useMeetingRoom.ts](<../src/hooks/useMeetingRoom.ts>), baris 716–721.

```typescript
useEffect(() => {
  const q = query(collection(meetingRef, "messages"), orderBy("created_at"), limitToLast(200));
  return onSnapshot(q, (snap) => {
    setMessages(snap.docs.map(d => ({ ...d.data(), id: d.id } as MeetingMessage)));
  }, (e) => console.warn("Listener chat gagal:", e));
}, [meetingRef]);
```

Sumber: [src/hooks/useMeetingRoom.ts](<../src/hooks/useMeetingRoom.ts>), baris 728–734.

```typescript
const sendMessage = useCallback((text: string) => {
  const clean = text.trim().slice(0, 500);
  if (!clean) return;
  addDoc(collection(meetingRef, "messages"), {
    uid, name, role, text: clean, created_at: new Date().toISOString(),
  }).catch(e => console.warn("Chat gagal:", e));
}, [meetingRef, uid, name, role]);
```

`onSnapshot()` memperbarui tampilan saat data berubah. Chat dibatasi 500 karakter per pesan dan listener mengambil 200 pesan terakhir. Ketika guru mengakhiri sesi, kode mengisi `status: "ended"`, `isEnded: true`, waktu/pelaku pengakhiran, serta mengosongkan state peserta.

Rekaman dibuat oleh `MediaRecorder` dan diunduh sebagai `.webm` ke komputer guru. Field `recording` di Firestore hanya menandai status perekaman; implementasi ini belum mengunggah rekaman ke Firebase Storage. Status hadir pada meeting juga terpisah dari absensi akademik di collection `attendances`.

**Berkas utama:** [src/app/[locale]/[role]/[id]/meetings/page.tsx](<../src/app/[locale]/[role]/[id]/meetings/page.tsx>); [src/components/meeting/useMeetingLobby.ts](<../src/components/meeting/useMeetingLobby.ts>); [src/components/meeting/MeetingRoom.tsx](<../src/components/meeting/MeetingRoom.tsx>); [src/hooks/useMeetingRoom.ts](<../src/hooks/useMeetingRoom.ts>).

## Ringkasan struktur Firestore

Daftar berikut memuat field utama yang dibaca atau ditulis oleh sepuluh fitur tersebut. Field opsional dapat tidak ada atau bernilai `null`; daftar ini bukan kontrak validasi Firestore. ID dokumen biasanya digabungkan menjadi properti `id` saat pembacaan. Field waktu `created_at`/`updated_at` pada alur utama ditulis sebagai string ISO melalui `new Date().toISOString()`.

| Collection / document | Field utama dan tipe | Hubungan / fungsi |
|---|---|---|
| `users/{uid}` | `user_id`, `first_name`, `middle_name`, `last_name`, `username`, `role_id`: string; `class`: number/null; `created_at`: string | Profil berdasarkan UID Firebase Auth; peran dan jenjang |
| `classes/{classId}` | `name`, `course_name`, `teacher_id`, `description`, `schedule`, `room`, `materi_url`, `materi_name`: string | Kelas guru; URL berkas materi |
| `assignments/{assignmentId}` | `title`, `course_name`, `description`, `class_id`, `teacher_id`, `due_date`, `status`, `materi_url`, `materi_name`: string | Tugas yang terkait kelas dan guru |
| `assignment_submissions/{assignmentId}_{studentId}` | `assignment_id`, `student_id`, `status`, `started_at`, `submitted_at`: string; `file_name`, `file_url`: string/null; `is_late`: boolean | Satu dokumen pengumpulan per pasangan tugas–siswa |
| `grades/{gradeId}` | `student_id`, `assignment_id`, `class_id`, `course_name`, `grade_letter`, `feedback`, `graded_by`: string; `score`, `credits`: number | Nilai dan umpan balik; terkait siswa/tugas/kelas |
| `attendances/{attendanceId}` | `class_id`, `student_id`, nama siswa, `status`, `reason`, `proof_url`, `created_at`: string | Absensi; status `Attended`, `Late`, `Absence`, atau `ExcusedAbsen` |
| `calendar_events/{eventId}` | `title`, `description`, `event_date`, `event_time`, `end_time`, `location`, `event_type`, `meeting_link`, `class_id`, `created_by`: string | Kegiatan akademik; tanggal dan waktu dipisah |
| `meetings/{meetingId}` | `title`, `time`, `teacher_id`, `class_id`, `status`, `host_id`: string; `activeParticipants`: array string; `participantStates`, `shareRequests`: map; `screenShare`: map/null; `recording`, `isEnded`: boolean | Metadata, kehadiran ruang, dan kendali meeting |
| `meetings/{meetingId}/messages/{messageId}` | `uid`, `name`, `role`, `text`, `created_at`: string | Chat di dalam meeting |
| `meetings/{meetingId}/reactions/{reactionId}` | `uid`, `name`, `emoji`, `target` opsional, `created_at`: string | Reaksi dan pemberian bintang |
| `ai_chats/{chatId}` | `user_id`, `assistant`, `title`, `created_at`, `updated_at`: string; `messages`: array map | Riwayat percakapan teks LibraAI/ScorpioAI |
| `notifications/{notificationId}` | `type`, `title`, `ref_id`, `class_id`, `audience`, `recipient_id`, `created_by`, `created_at`: string; field tambahan sesuai jenis notifikasi | Pemberitahuan kelas, tugas, nilai, absensi, dan meeting |

`enrolled_classes` juga memiliki fungsi baca/tulis dalam `src/lib/api.ts`, dengan field `student_id`, `class_id`, `progress`, dan `enrolled_at`. Namun, daftar My Classes dan Dashboard siswa yang diperiksa masih membaca `getClasses()`; jangan menyebut daftar tersebut sudah dibatasi berdasarkan enrollment. Collection `student` dan `teacher` dibaca oleh sebagian halaman untuk nama pengguna, sedangkan proses registrasi yang diperiksa menulis profil ke `users`.

Hubungan utama: `classes` → `assignments` melalui `class_id`; `assignments` → `assignment_submissions` melalui `assignment_id`; siswa dihubungkan melalui `student_id`; `grades` menghubungkan siswa dengan tugas/kelas. Hubungan ini dikelola oleh aplikasi, bukan foreign key SQL. Penghapusan data terkait dilakukan secara eksplisit dalam fungsi seperti `deleteClass()` dan `deleteAssignment()`.

## Firebase Storage — kode dan hubungan dengan Firestore

Storage menyimpan isi berkas. Firestore menyimpan nama berkas, URL unduhan, dan informasi akademik yang terkait.

| Pola lokasi Storage pada kode | Isi berkas | Field URL di Firestore |
|---|---|---|
| `class_materi/{Date.now()}_{file.name}` | Materi kelas, soal tugas, dan jawaban siswa; ketiganya menggunakan helper unggah yang sama | `classes.materi_url`, `assignments.materi_url`, atau `assignment_submissions.file_url` |
| `attendance_proofs/{Date.now()}_{file.name}` | Bukti absensi/izin | `attendances.proof_url` |

**Kode unggah yang dipakai bersama:**

Sumber: [src/lib/api.ts](<../src/lib/api.ts>), baris 829–841.

```typescript
export async function uploadClassMateri(file: File): Promise<string | null> {
  try {
    const storageRef = ref(connecttostorage, `class_materi/${Date.now()}_${file.name}`);
    const uploadPromise = uploadBytes(storageRef, file);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timeout. Check Firebase Storage rules/CORS.")), 15000));

    const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as any;
    return await getDownloadURL(snapshot.ref);
  } catch (e) {
    handleError(e, 'uploadClassMateri');
    return null;
  }
}
```

`ref()` menentukan lokasi objek, `uploadBytes()` mengunggah berkas, dan `getDownloadURL()` mengembalikan URL yang kemudian disimpan ke Firestore. `Promise.race()` membatasi waktu tunggu pada fungsi ini menjadi 15 detik. Prefix `class_materi` merupakan bagian nama objek Storage, bukan collection Firestore.

AI membaca isi berkas melalui `src/lib/ai/storageFiles.ts`. PDF/gambar dikirim sebagai data inline, teks/CSV sebagai teks, Excel diubah menjadi CSV, dan teks DOCX/PPTX diambil dari XML internalnya. Pembaca AI membatasi ukuran berkas hingga 15 MB dan teks hingga 60.000 karakter. Batas ini berada pada proses pembacaan AI, bukan validasi ukuran pada helper unggah di atas.

## Catatan ketepatan untuk penulisan skripsi

1. **Pembedaan peran:** tombol dan menu dibedakan melalui `RoleContext`. Layout memeriksa sesi login dan kecocokan UID URL; role UI dipetakan dari URL. Endpoint AI memverifikasi token dan mengambil peran dari `users`. Jangan menyamakan penyembunyian tombol dengan pembatasan akses database.
2. **Cakupan data:** beberapa halaman masih membaca seluruh kelas, tugas, kalender, meeting, atau nilai guru. Data pribadi siswa pada query tertentu menggunakan `student_id`, sedangkan detail tugas masih membaca submission tugas lalu memilih milik siswa di sisi klien. Catatan fitur harus mengikuti cakupan query yang benar-benar ada.
3. **Firestore/Storage Rules:** berkas aturan keamanan dan konfigurasi indeks tidak ditemukan dalam repositori yang diperiksa. Karena itu, catatan ini tidak menyatakan aturan akses produksi atau indeks sudah terverifikasi. Jika diperlukan sebagai lampiran skripsi, gunakan aturan yang benar-benar terpasang pada Firebase Console.
4. **Pembaruan data:** banyak halaman menggunakan `RealtimeLoading`, yang memasang listener `onSnapshot()` dan memanggil ulang pemuatan data setelah perubahan. Meeting memakai listener langsung. Hal ini berbeda dari menyimpan hasil ringkasan Dashboard ke collection tersendiri.
5. **Hasil pembacaan kode:** riwayat chat teks disimpan, tetapi riwayat suara belum disimpan; rekaman meeting diunduh lokal. Usulan skor ScorpioAI menunggu persetujuan guru. Instruksi perilaku AI merupakan konfigurasi yang mengarahkan model, bukan jaminan bahwa setiap respons selalu benar.

Catatan disusun melalui pemeriksaan kode sumber dan kesesuaian potongan kode. Tidak dilakukan pembacaan data produksi, pengujian layanan AI, atau perubahan pada kode aplikasi/database.

