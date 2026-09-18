import { connecttofirestore, connecttoauth, connecttostorage } from './firebase';
import { 
  collection, getDocs, addDoc, deleteDoc, doc, 
  query, where, orderBy, setDoc, updateDoc, getDoc, increment, writeBatch,
  type DocumentReference
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { format } from "date-fns";
import type {
  ClassData,
  Assignment,
  AssignmentSubmission,
  Grade,
  CalendarEvent,
  EnrolledClass,
  UserProfile,
  CreateClassForm,
  CreateAssignmentForm,
  CreateEventForm,
  GradeForm,
  TakeAttendanceForm,
  StudentList,
  AppNotification
} from './types';

// ============================================
// Helper
// ============================================
function handleError(error: unknown, context: string) {
  console.error(`[HarapanEdu API] ${context}:`, error);
}

function cleanData(data: any) {
  const cleaned = { ...data };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  delete cleaned.id;
  return cleaned;
}

// Hapus permanen banyak dokumen sekaligus (batch Firestore maksimal 500 operasi)
async function deleteRefs(refs: DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += 500) {
    const batch = writeBatch(connecttofirestore);
    refs.slice(i, i + 500).forEach(r => batch.delete(r));
    await batch.commit();
  }
}

// Ambil semua dokumen di satu koleksi yang field-nya sama dengan value
async function findDocs(koleksi: string, field: string, value: string) {
  const snap = await getDocs(query(collection(connecttofirestore, koleksi), where(field, "==", value)));
  return snap.docs;
}

// Hapus file di Firebase Storage dari download URL-nya; gagal (file sudah tidak ada, dsb) diabaikan
async function deleteStorageFiles(urls: (string | null | undefined)[]): Promise<void> {
  await Promise.all(
    urls.filter((u): u is string => !!u).map(async url => {
      try {
        await deleteObject(ref(connecttostorage, url));
      } catch (e) {
        handleError(e, 'deleteStorageFile');
      }
    })
  );
}

// ============================================
// NOTIFICATIONS
// ============================================

// Kirim notifikasi ke siswa; gagal kirim tidak boleh menggagalkan aksi utamanya
export async function pushNotification(data: Omit<AppNotification, 'id' | 'created_at' | 'created_by'>): Promise<void> {
  try {
    await addDoc(collection(connecttofirestore, "notifications"), cleanData({
      ...data,
      created_by: connecttoauth.currentUser?.uid,
      created_at: new Date().toISOString()
    }));
  } catch (e) {
    handleError(e, 'pushNotification');
  }
}

export async function markNotificationsRead(): Promise<boolean> {
  return updateUserProfile({ notifications_read_at: new Date().toISOString() });
}

// ============================================
// CLASSES
// ============================================

export async function getClasses(): Promise<ClassData[]> {
  try {
    const q = query(collection(connecttofirestore, "classes"), orderBy("created_at", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClassData));
  } catch (e) {
    handleError(e, 'getClasses');
    return [];
  }
}

export async function getTeacherClasses(teacherId: string): Promise<ClassData[]> {
  try {
    const q = query(
      collection(connecttofirestore, "classes"),
      where("teacher_id", "==", teacherId),
      orderBy("created_at", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ClassData));
  } catch (e) {
    handleError(e, 'getTeacherClasses');
    return [];
  }
}

export async function createClass(form: CreateClassForm): Promise<ClassData | null> {
  try {
    const user = connecttoauth.currentUser;
    const docRef = await addDoc(collection(connecttofirestore, "classes"), cleanData({
      ...form,
      teacher_id: user?.uid,
      created_at: new Date().toISOString()
    }));
    if (form.schedule) {
      await syncClassSchedule(docRef.id, form);
    }
    await pushNotification({
      type: 'class',
      title: form.name,
      body: form.course_name,
      ref_id: docRef.id,
      class_id: docRef.id,
      audience: 'student',
    });
    return { ...form, teacher_id: user?.uid, id: docRef.id } as unknown as ClassData;
  } catch (e) {
    handleError(e, 'createClass');
    return null;
  }
}

// A new class with a schedule ("yyyy-MM-ddTHH:mm") also shows up in Calendar and Meetings
async function syncClassSchedule(classId: string, form: CreateClassForm): Promise<void> {
  const start = new Date(form.schedule!);
  if (isNaN(start.getTime())) return;

  await Promise.all([
    createCalendarEvent({
      title: form.name,
      description: form.description,
      event_date: format(start, "yyyy-MM-dd"),
      event_time: format(start, "HH:mm"),
      location: form.room,
      event_type: "class",
      class_id: classId,
    }),
    createMeeting({
      title: form.name,
      time: format(start, "d MMM yyyy, HH:mm"),
      status: "upcoming",
      link: "",
      class_id: classId,
    }, { notify: false }),
  ]);
}

export async function updateClass(classId: string, updates: Partial<CreateClassForm>): Promise<boolean> {
  try {
    await updateDoc(doc(connecttofirestore, "classes", classId), cleanData({
      ...updates,
      updated_at: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    handleError(e, 'updateClass');
    return false;
  }
}


// Hapus kelas beserta semua data yang terkait: tugas (+ submission & nilainya),
// event kalender, meeting, enrollment, absensi, nilai, dan file di Storage
export async function deleteClass(classId: string): Promise<boolean> {
  try {
    const classRef = doc(connecttofirestore, "classes", classId);
    const [classSnap, assignments, events, meetings, enrolled, attendances, grades, notifications] = await Promise.all([
      getDoc(classRef),
      findDocs("assignments", "class_id", classId),
      findDocs("calendar_events", "class_id", classId),
      findDocs("meetings", "class_id", classId),
      findDocs("enrolled_classes", "class_id", classId),
      findDocs("attendances", "class_id", classId),
      findDocs("grades", "class_id", classId),
      findDocs("notifications", "class_id", classId),
    ]);

    for (const a of assignments) {
      if (!(await deleteAssignment(a.id))) throw new Error(`Failed to delete assignment ${a.id}`);
    }
    for (const m of meetings) {
      await deleteMeetingActivity(m.id);
    }

    await deleteRefs([...events, ...meetings, ...enrolled, ...attendances, ...grades, ...notifications].map(d => d.ref));
    await deleteStorageFiles([
      classSnap.data()?.materi_url,
      ...attendances.map(d => d.data().proof_url),
    ]);
    await deleteDoc(classRef);
    return true;
  } catch (e) {
    handleError(e, 'deleteClass');
    return false;
  }
}

// ============================================
// ASSIGNMENTS
// ============================================

export async function getAssignments(): Promise<Assignment[]> {
  try {
    const q = query(collection(connecttofirestore, "assignments"), orderBy("due_date", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Assignment));
  } catch (e) {
    handleError(e, 'getAssignments');
    return [];
  }
}

export async function getAssignmentsByClass(classId: string): Promise<Assignment[]> {
  try {
    const q = query(
      collection(connecttofirestore, "assignments"),
      where("class_id", "==", classId),
      orderBy("due_date", "asc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Assignment));
  } catch (e) {
    handleError(e, 'getAssignmentsByClass');
    return [];
  }
}

export async function createAssignment(form: CreateAssignmentForm): Promise<Assignment | null> {
  try {
    const user = connecttoauth.currentUser;
    const docRef = await addDoc(collection(connecttofirestore, "assignments"), cleanData({
      ...form,
      teacher_id: user?.uid,
      status: 'active',
      created_at: new Date().toISOString()
    }));
    await pushNotification({
      type: 'assignment',
      title: form.title,
      body: form.course_name,
      ref_id: docRef.id,
      class_id: form.class_id,
      audience: 'student',
    });
    return { ...form, teacher_id: user?.uid, status: 'active', id: docRef.id } as unknown as Assignment;
  } catch (e) {
    handleError(e, 'createAssignment');
    return null;
  }
}

export async function updateAssignment(assignmentId: string, updates: Partial<CreateAssignmentForm>): Promise<boolean> {
  try {
    await updateDoc(doc(connecttofirestore, "assignments", assignmentId), cleanData({
      ...updates,
      updated_at: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    handleError(e, 'updateAssignment');
    return false;
  }
}

// Hapus tugas beserta submission siswa, nilai tugas itu, dan file materi/jawaban di Storage
export async function deleteAssignment(assignmentId: string): Promise<boolean> {
  try {
    const assignmentRef = doc(connecttofirestore, "assignments", assignmentId);
    const [assignmentSnap, submissions, grades, notifications, gradeNotifications] = await Promise.all([
      getDoc(assignmentRef),
      findDocs("assignment_submissions", "assignment_id", assignmentId),
      findDocs("grades", "assignment_id", assignmentId),
      findDocs("notifications", "ref_id", assignmentId),
      findDocs("notifications", "assignment_id", assignmentId),
    ]);

    await deleteRefs([...submissions, ...grades, ...notifications, ...gradeNotifications].map(d => d.ref));
    await deleteStorageFiles([
      assignmentSnap.data()?.materi_url,
      ...submissions.map(d => d.data().file_url),
    ]);
    await deleteDoc(assignmentRef);
    return true;
  } catch (e) {
    handleError(e, 'deleteAssignment');
    return false;
  }
}

export async function getAssignment(assignmentId: string): Promise<Assignment | null> {
  try {
    const docSnap = await getDoc(doc(connecttofirestore, "assignments", assignmentId));
    if (docSnap.exists()) {
      return { ...docSnap.data(), id: docSnap.id } as Assignment;
    }
    return null;
  } catch (e) {
    handleError(e, 'getAssignment');
    return null;
  }
}

export async function getAssignmentSubmissions(assignmentId: string): Promise<any[]> {
  try {
    const q = query(collection(connecttofirestore, "assignment_submissions"), where("assignment_id", "==", assignmentId));
    const querySnapshot = await getDocs(q);
    
    const submissions = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
    
    // Fetch student profiles to append student name
    const profilesQuery = await getDocs(collection(connecttofirestore, "users"));
    const profiles = profilesQuery.docs.map(d => ({ ...d.data(), id: d.id } as any));
    
    return submissions.map(sub => {
      const student = profiles.find(p => p.id === sub.student_id);
      return {
        ...sub,
        student_name: student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || 'Unknown Student' : 'Unknown Student'
      };
    });
  } catch (e) {
    handleError(e, 'getAssignmentSubmissions');
    return [];
  }
}


export async function updateAssignmentStatus(assignmentId: string, status: string): Promise<boolean> {
  try {
    await updateDoc(doc(connecttofirestore, "assignments", assignmentId), cleanData({
      status,
      updated_at: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    handleError(e, 'updateAssignmentStatus');
    return false;
  }
}

// Get all submission docs (started/submitted/graded) belonging to one student
export async function getStudentSubmissions(studentId: string): Promise<AssignmentSubmission[]> {
  try {
    const q = query(collection(connecttofirestore, "assignment_submissions"), where("student_id", "==", studentId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AssignmentSubmission));
  } catch (e) {
    handleError(e, 'getStudentSubmissions');
    return [];
  }
}

// Replace each assignment's shared status with the student's own status (if they have one)
export function applyStudentStatus(assignments: Assignment[], submissions: AssignmentSubmission[]): Assignment[] {
  return assignments.map(a => {
    const sub = submissions.find(s => s.assignment_id === a.id);
    return sub?.status ? { ...a, status: sub.status } : a;
  });
}

// Mark an assignment as "started" for the logged-in student (only if they have no submission yet)
export async function startAssignment(assignmentId: string): Promise<boolean> {
  try {
    const user = connecttoauth.currentUser;
    if (!user) throw new Error("No user logged in");

    const submissionRef = doc(connecttofirestore, "assignment_submissions", `${assignmentId}_${user.uid}`);
    const existing = await getDoc(submissionRef);
    if (existing.exists()) return true;

    await setDoc(submissionRef, cleanData({
      assignment_id: assignmentId,
      student_id: user.uid,
      status: 'started',
      started_at: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    handleError(e, 'startAssignment');
    return false;
  }
}

export async function submitAssignment(assignmentId: string, fileName?: string, fileUrl?: string): Promise<boolean> {
  try {
    const user = connecttoauth.currentUser;
    if (!user) throw new Error("No user logged in");
    
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

    return true;
  } catch (e) {
    handleError(e, 'submitAssignment');
    return false;
  }
}

// ============================================
// GRADES
// ============================================

export async function getGrades(): Promise<Grade[]> {
  try {
    const q = query(collection(connecttofirestore, "grades"), orderBy("created_at", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as unknown as Grade));
  } catch (e) {
    handleError(e, 'getGrades');
    return [];
  }
}

export async function getStudentGrades(studentId: string): Promise<Grade[]> {
  try {
    const q = query(
      collection(connecttofirestore, "grades"),
      where("student_id", "==", studentId),
      orderBy("created_at", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as unknown as Grade));
  } catch (e) {
    handleError(e, 'getStudentGrades');
    return [];
  }
}

// Ubah status submission siswa untuk satu tugas (hanya kalau submission-nya sudah ada)
async function setSubmissionStatus(assignmentId: string | undefined, studentId: string | undefined, status: 'submitted' | 'graded') {
  if (!assignmentId || !studentId) return;
  const submissionRef = doc(connecttofirestore, "assignment_submissions", `${assignmentId}_${studentId}`);
  const existing = await getDoc(submissionRef);
  if (!existing.exists() || existing.data().status === 'started') return;
  await updateDoc(submissionRef, { status, updated_at: new Date().toISOString() });
}

// Notifikasi nilai: konfirmasi untuk guru yang menilai + kabar nilai untuk siswanya
async function notifyGrade(gradeId: string, form: GradeForm) {
  const teacherId = connecttoauth.currentUser?.uid;
  let studentName = '';
  try {
    const student = (await getDoc(doc(connecttofirestore, "users", form.student_id))).data();
    studentName = student?.username
      || [student?.first_name, student?.last_name].filter(Boolean).join(' ')
      || student?.name
      || '';
  } catch (e) {
    handleError(e, 'notifyGrade');
  }
  const shared = {
    title: form.course_name,
    ref_id: gradeId,
    class_id: form.class_id,
    assignment_id: form.assignment_id,
    course_name: form.course_name,
    student_name: studentName || '-',
    score: form.score,
  };
  await Promise.all([
    teacherId && pushNotification({ ...shared, type: 'grade_given', audience: 'teacher', recipient_id: teacherId }),
    pushNotification({ ...shared, type: 'grade_received', audience: 'student', recipient_id: form.student_id }),
  ]);
}

export async function createGrade(form: GradeForm): Promise<Grade | null> {
  try {
    const user = connecttoauth.currentUser;
    const docRef = await addDoc(collection(connecttofirestore, "grades"), cleanData({
      ...form,
      graded_by: user?.uid,
      created_at: new Date().toISOString()
    }));
    await setSubmissionStatus(form.assignment_id, form.student_id, 'graded');
    await notifyGrade(docRef.id, form);
    return { ...form, graded_by: user?.uid, id: docRef.id } as unknown as Grade;
  } catch (e) {
    handleError(e, 'createGrade');
    return null;
  }
}

export async function deleteGrade(gradeId: string): Promise<boolean> {
  try {
    const gradeRef = doc(connecttofirestore, "grades", gradeId);
    const [gradeSnap, notifications] = await Promise.all([
      getDoc(gradeRef),
      findDocs("notifications", "ref_id", gradeId),
    ]);
    const grade = gradeSnap.data();
    await deleteDoc(gradeRef);
    await deleteRefs(notifications.map(d => d.ref));
    // Nilai dihapus -> tugas siswa kembali perlu dinilai
    if (grade) await setSubmissionStatus(grade.assignment_id, grade.student_id, 'submitted');
    return true;
  } catch (e) {
    handleError(e, 'deleteGrade');
    return false;
  }
}


export async function updateGrade(gradeId: string, updates: Partial<GradeForm>): Promise<boolean> {
  try {
    await updateDoc(doc(connecttofirestore, "grades", gradeId), cleanData({
      ...updates,
      updated_at: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    handleError(e, 'updateGrade');
    return false;
  }
}

export async function getStudentGPAs(): Promise<any[]> {
  try {
    const gradesSnap = await getDocs(collection(connecttofirestore, "grades"));
    const grades = gradesSnap.docs.map(doc => doc.data() as any);

    const studentIds = [...new Set(grades.map(g => g.student_id).filter(Boolean))];

    const usersSnap = await getDocs(collection(connecttofirestore, "users"));
    const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const students = studentIds.map(id => {
      const user = users.find(u => u.id === id);
      const studentGrades = grades.filter(g => g.student_id === id);
      const totalCredits = studentGrades.reduce((acc, g) => acc + (Number(g.credits) || 0), 0);
      
      const getGpaPoint = (score: number) => {
        if (score >= 90) return 4.0;
        if (score >= 85) return 3.7;
        if (score >= 80) return 3.3;
        if (score >= 75) return 3.0;
        if (score >= 70) return 2.7;
        if (score >= 65) return 2.3;
        if (score >= 60) return 2.0;
        return 0.0;
      };

      const weightedGPA = studentGrades.length > 0 && totalCredits > 0 
        ? (studentGrades.reduce((acc, g) => acc + (getGpaPoint(Number(g.score) || 0) * (Number(g.credits) || 0)), 0) / totalCredits).toFixed(2) 
        : "0.00";

      let scoreTotal = studentGrades.reduce((acc, g) => acc + (Number(g.score) || 0), 0);
      let avgScore = studentGrades.length > 0 ? scoreTotal / studentGrades.length : 0;

      return {
        id: id,
        name: user ? (`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name || 'Unknown Student') : 'Unknown Student',
        gpa: weightedGPA,
        totalCredits,
        avgScore
      };
    });
    
    return students;
  } catch (e) {
    handleError(e, 'getStudentGPAs');
    return [];
  }
}

// ============================================
// CALENDAR EVENTS
// ============================================

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const q = query(collection(connecttofirestore, "calendar_events"), orderBy("event_date", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as unknown as CalendarEvent));
  } catch (e) {
    handleError(e, 'getCalendarEvents');
    return [];
  }
}

export async function createCalendarEvent(form: CreateEventForm): Promise<CalendarEvent | null> {
  try {
    const user = connecttoauth.currentUser;
    const docRef = await addDoc(collection(connecttofirestore, "calendar_events"), cleanData({
      ...form,
      created_by: user?.uid,
      created_at: new Date().toISOString()
    }));
    return { ...form, created_by: user?.uid, id: docRef.id } as unknown as CalendarEvent;
  } catch (e) {
    handleError(e, 'createCalendarEvent');
    return null;
  }
}

export async function updateCalendarEvent(eventId: string, updates: Partial<CreateEventForm>): Promise<boolean> {
  try {
    await updateDoc(doc(connecttofirestore, "calendar_events", eventId), cleanData({
      ...updates,
      updated_at: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    handleError(e, 'updateCalendarEvent');
    return false;
  }
}


export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(connecttofirestore, "calendar_events", eventId));
    return true;
  } catch (e) {
    handleError(e, 'deleteCalendarEvent');
    return false;
  }
}

// ============================================
// ENROLLED CLASSES
// ============================================

export async function getEnrolledClasses(studentId?: string): Promise<EnrolledClass[]> {
  try {
    let q = query(collection(connecttofirestore, "enrolled_classes"), orderBy("enrolled_at", "desc"));
    
    if (studentId) {
      q = query(
        collection(connecttofirestore, "enrolled_classes"), 
        where("student_id", "==", studentId),
        orderBy("enrolled_at", "desc")
      );
    }

    const querySnapshot = await getDocs(q);
    
    // In NoSQL, joining classes requires a separate fetch or duplicating data.
    // For simplicity, we just return the enrolled classes data.
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as unknown as EnrolledClass));
  } catch (e) {
    handleError(e, 'getEnrolledClasses');
    return [];
  }
}

export async function enrollInClass(classId: string): Promise<boolean> {
  try {
    const user = connecttoauth.currentUser;
    if (!user) throw new Error("Not logged in");

    await addDoc(collection(connecttofirestore, "enrolled_classes"), cleanData({
      student_id: user.uid,
      class_id: classId,
      progress: 0,
      enrolled_at: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    handleError(e, 'enrollInClass');
    return false;
  }
}

// ============================================
// MEETINGS
// ============================================

import type { Meeting, CreateMeetingForm } from './types';

export async function getMeetings(): Promise<Meeting[]> {
  try {
    const q = query(collection(connecttofirestore, "meetings"), orderBy("created_at", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Meeting));
  } catch (e) {
    handleError(e, 'getMeetings');
    return [];
  }
}

export async function createMeeting(form: CreateMeetingForm, { notify = true } = {}): Promise<Meeting | null> {
  try {
    const user = connecttoauth.currentUser;
    const docRef = await addDoc(collection(connecttofirestore, "meetings"), cleanData({
      ...form,
      teacher_id: user?.uid,
      created_at: new Date().toISOString()
    }));
    if (notify) {
      await pushNotification({
        type: 'meeting',
        title: form.title,
        body: form.time,
        ref_id: docRef.id,
        class_id: form.class_id,
        audience: 'student',
      });
    }
    return { ...form, teacher_id: user?.uid, id: docRef.id } as unknown as Meeting;
  } catch (e) {
    handleError(e, 'createMeeting');
    return null;
  }
}

export async function updateMeeting(meetingId: string, updates: Partial<CreateMeetingForm>): Promise<boolean> {
  try {
    await updateDoc(doc(connecttofirestore, "meetings", meetingId), cleanData({
      ...updates,
      updated_at: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    handleError(e, 'updateMeeting');
    return false;
  }
}

// Chat & reaksi meeting disimpan di subkoleksi, jadi tidak ikut terhapus bersama dokumen meeting
async function deleteMeetingActivity(meetingId: string): Promise<void> {
  const [messages, reactions, notifications] = await Promise.all([
    getDocs(collection(connecttofirestore, "meetings", meetingId, "messages")),
    getDocs(collection(connecttofirestore, "meetings", meetingId, "reactions")),
    findDocs("notifications", "ref_id", meetingId),
  ]);
  await deleteRefs([...messages.docs, ...reactions.docs, ...notifications].map(d => d.ref));
}

export async function deleteMeeting(meetingId: string): Promise<boolean> {
  try {
    await deleteMeetingActivity(meetingId);
    await deleteDoc(doc(connecttofirestore, "meetings", meetingId));
    return true;
  } catch (e) {
    handleError(e, 'deleteMeeting');
    return false;
  }
}

// ============================================
// USER PROFILE
// ============================================


export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const user = connecttoauth.currentUser;
    if (!user) return null;
    
    const userDoc = await getDoc(doc(connecttofirestore, "users", user.uid));
    if (!userDoc.exists()) return null;

    return userDoc.data() as UserProfile;
  } catch (e) {
    handleError(e, 'getUserProfile');
    return null;
  }
}

export async function updateUserProfile(updates: Partial<UserProfile>): Promise<boolean> {
  try {
    const user = connecttoauth.currentUser;
    if (!user) return false;
    
    await updateDoc(doc(connecttofirestore, "users", user.uid), cleanData({
      ...updates,
      updated_at: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    handleError(e, 'updateUserProfile');
    return false;
  }
}

// ============================================
// Attendance
// ============================================

export async function uploadAttendanceProof(file: File): Promise<string | null> {
  try {
    const storageRef = ref(connecttostorage, `attendance_proofs/${Date.now()}_${file.name}`);
    const uploadPromise = uploadBytes(storageRef, file);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timeout. Check Firebase Storage rules/CORS.")), 15000));
    
    const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as any;
    return await getDownloadURL(snapshot.ref);
  } catch (e) {
    handleError(e, 'uploadAttendanceProof');
    return null;
  }
}

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

export async function TakeAttandance(form: TakeAttendanceForm): Promise<boolean> {
  try {
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

    // Notifikasi pribadi ke siswa yang baru absen, dan ke guru pemilik kelas
    const classSnap = await getDoc(classRef);
    const cls = classSnap.data();
    const hadir = form.status === 'Attended' || form.status === 'Late';
    const studentName = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ');
    await Promise.all([
      pushNotification({
        type: 'attendance_taken',
        title: cls?.name || '',
        course_name: cls?.name,
        ref_id: docRef.id,
        class_id: form.class_id,
        audience: 'student',
        recipient_id: form.student_id,
      }),
      cls?.teacher_id && pushNotification({
        type: hadir ? 'attendance_present' : 'attendance_absent',
        title: cls?.name || '',
        course_name: cls?.name,
        ref_id: docRef.id,
        class_id: form.class_id,
        audience: 'teacher',
        recipient_id: cls.teacher_id,
        student_name: studentName,
        attendance_status: form.status,
        reason: hadir ? undefined : form.reason?.trim(),
        proof_url: hadir ? undefined : form.proof_url,
      }),
    ]);
    return true;
  } catch (e) {
    handleError(e, 'takeAttendance');
    return false;
  }
}

// ============================================
// CLASS PROGRESS
// ============================================

export async function getClassById(classId: string): Promise<number | null> {
  try {
    const docSnap = await getDoc(doc(connecttofirestore, "classes", classId));
    if (docSnap.exists()) {
      return docSnap.data().course_progress || 0;
    }
    return null;
  } catch (e) {
    handleError(e, 'getClassById');
    return null;
  }
}

// Hitung statistik kartu kelas di my-work:
// - needs_grading: tugas yang sudah dikumpulkan siswa tapi belum diberi nilai.
//   Submission lama yang statusnya masih "submitted" tapi sudah punya nilai di koleksi grades tidak dihitung.
// - feedback_count: nilai yang diberi feedback oleh guru.
// - student_count: jumlah siswa berbeda yang sudah submit attendance hadir (Attended/Late) di kelas itu.
export async function applyClassWorkStats(classes: ClassData[]): Promise<ClassData[]> {
  try {
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

    const feedbackCounts = new Map<string, number>();
    grades.forEach(g => {
      if (!g.feedback?.trim()) return;
      const classId = g.class_id || (g.assignment_id ? classOfAssignment.get(g.assignment_id) : undefined);
      if (classId) feedbackCounts.set(classId, (feedbackCounts.get(classId) || 0) + 1);
    });

    // Satu siswa yang absen berkali-kali di kelas yang sama tetap dihitung satu
    const hadirPerKelas = new Map<string, Set<string>>();
    attendanceSnap.docs.forEach(d => {
      const a = d.data();
      if (!a.class_id || !a.student_id) return;
      if (!hadirPerKelas.has(a.class_id)) hadirPerKelas.set(a.class_id, new Set());
      hadirPerKelas.get(a.class_id)!.add(a.student_id);
    });

    return classes.map(cls => ({
      ...cls,
      needs_grading: counts.get(cls.id) || 0,
      feedback_count: feedbackCounts.get(cls.id) || 0,
      student_count: hadirPerKelas.get(cls.id)?.size || 0,
    }));
  } catch (e) {
    handleError(e, 'applyClassWorkStats');
    return classes;
  }
}

// Learning progress per student per class:
// hadir (Attended/Late) minimal sekali = 50%, sisa 50% dari tugas kelas itu yang sudah di-upload.
// Kalau kelas belum punya tugas, hadir sekali langsung 100%.
// attended_today: siswa sudah submit attendance (status apa pun) di kelas itu hari ini.
export async function applyStudentProgress(classes: ClassData[], studentId: string): Promise<ClassData[]> {
  try {
    const [attendanceSnap, assignments, submissions] = await Promise.all([
      getDocs(query(collection(connecttofirestore, "attendances"), where("student_id", "==", studentId))),
      getAssignments(),
      getStudentSubmissions(studentId),
    ]);

    const attendedClassIds = new Set(
      attendanceSnap.docs
        .map(d => d.data())
        .filter(a => a.status === 'Attended' || a.status === 'Late')
        .map(a => a.class_id)
    );
    const today = new Date().toDateString();
    const absenHariIni = new Set(
      attendanceSnap.docs
        .map(d => d.data())
        .filter(a => a.created_at && new Date(a.created_at).toDateString() === today)
        .map(a => a.class_id)
    );
    const uploadedIds = new Set(
      submissions
        .filter(s => s.status === 'submitted' || s.status === 'graded')
        .map(s => s.assignment_id)
    );

    return classes.map(cls => {
      const hadir = attendedClassIds.has(cls.id);
      const tugas = assignments.filter(a => a.class_id === cls.id);
      const selesai = tugas.filter(a => uploadedIds.has(a.id)).length;

      let progress: number;
      if (tugas.length === 0) progress = hadir ? 100 : 0;
      else progress = (hadir ? 50 : 0) + (selesai / tugas.length) * 50;

      return { ...cls, course_progress: progress, attended_today: absenHariIni.has(cls.id) };
    });
  } catch (e) {
    handleError(e, 'applyStudentProgress');
    return classes;
  }
}

// ============================================
// STUDENT LISTS
// ============================================

export async function getStudentList(filters?: {
  student_name?: string;
  student_id?: string;
  student_class?: string;
  student_role?: string;
}): Promise<StudentList[]> {
  try {
    // Query users with role_id == "1" (students)
    const q = query(
      collection(connecttofirestore, "users"),
      where("role_id", "==", "1")
    );
    const querySnapshot = await getDocs(q);
    let docs = querySnapshot.docs;

    // Fallback: If no users are found with role_id == "1", query with role == "student"
    if (docs.length === 0) {
      const fallbackQuery = query(
        collection(connecttofirestore, "users"),
        where("role", "==", "student")
      );
      const fallbackSnapshot = await getDocs(fallbackQuery);
      docs = fallbackSnapshot.docs;
    }

    return docs.map(doc => ({ ...doc.data(), id: doc.id } as StudentList));
  } catch (e) {
    handleError(e, 'getStudentList');
    return [];
  }
}