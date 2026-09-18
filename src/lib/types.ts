// ============================================
// TypeScript firebase
// ============================================

export type AssignmentStatus = 'active' | 'started' | 'submitted' | 'overdue' | 'graded';

export interface Role {
  id: string;
  name: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  user_id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role: string;
  role_id?: string;
  class?: number;
  school_id?: string;
  avatar_url?: string;
  notifications_read_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SchoolData {
  id: string;
  name: string;
  address?: string;
  created_at?: string;
}

export interface ClassData {
  id: string;
  name: string;
  course_name?: string;
  description?: string;
  teacher_id?: string;
  school_id?: string;
  schedule?: string;
  room?: string;
  created_at?: string;
  updated_at?: string;
  materi_url?: string;
  materi_name?: string;
  // Computed fields (from joins)
  student_count?: number;
  needs_grading?: number;
  unread_messages?: number;
  feedback_count?: number;
  
  // Attendance tracking
  attendance?: number;
  absence?: number;
  late?: number;
  excused_absence?: number;
  course_progress?: number;
  attended_today?: boolean;
}

export interface Assignment {
  id: string;
  course_name: string;
  title: string;
  description?: string;
  due_date: string;
  class_id?: string;
  teacher_id?: string;
  status: AssignmentStatus;
  created_at?: string;
  updated_at?: string;
  materi_url?: string;
  materi_name?: string;
  // Join fields
  class_name?: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  status: AssignmentStatus;
  submitted_at?: string;
  file_name?: string;
  file_url?: string;
  is_late?: boolean;
  created_at?: string;
}

export interface Grade {
  id: string;
  course_name: string;
  student_id: string;
  assignment_id?: string;
  class_id?: string;
  score: number;
  grade_letter?: string;
  credits: number;
  feedback?: string;
  cumulative_gpa: number;
  graded_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  end_time?: string;
  location?: string;
  event_type: string;
  meeting_link?: string;
  instructor?: string;
  class_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EnrolledClass {
  id: string;
  student_id: string;
  class_id: string;
  progress: number;
  enrolled_at?: string;
  // Join fields
  class?: ClassData;
}

// Form types for creating new entities
export interface CreateClassForm {
  name: string;
  course_name: string;
  description?: string;
  schedule?: string;
  room?: string;
  materi_url?: string;
  materi_name?: string;
}

export interface CreateAssignmentForm {
  course_name: string;
  title: string;
  description?: string;
  due_date: string;
  class_id?: string;
  materi_url?: string;
  materi_name?: string;
}

export interface CreateEventForm {
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  end_time?: string;
  location?: string;
  event_type: string;
  meeting_link?: string;
  class_id?: string;
}

export interface GradeForm {
  course_name: string;
  student_id: string;
  assignment_id?: string;
  class_id?: string;
  score: number;
  grade_letter?: string;
  credits?: number;
  feedback?: string;
}

export interface Meeting {
  id: string;
  title: string;
  time: string;
  participants: number;
  status: string;
  link: string;
  teacher_id?: string;
  class_id?: string;
  created_at?: string;
  activeParticipants?: string[];
  isEnded?: boolean;
  // Diisi saat pengajar memimpin meeting
  host_id?: string;
  started_at?: string;
  participantStates?: Record<string, MeetingParticipantState>;
  screenShare?: { uid: string; name: string } | null;
  shareRequests?: Record<string, MeetingShareRequest>;
  // Diubah pengajar untuk "bisukan semua"; peserta membisukan diri saat nilainya berubah
  muteAllAt?: string;
  recording?: boolean;
  ended_at?: string;
  ended_by?: string;
}

export type MeetingEffect = 'none' | 'crown' | 'cat' | 'party' | 'stars' | 'hearts' | 'retro' | 'alien' | 'comic';

export interface MeetingParticipantState {
  name: string;
  role: 'teacher' | 'student';
  mute: boolean;
  camera: boolean;
  hand: boolean;
  effect: MeetingEffect;
  stars?: number;
  // ID PeerJS yang sedang dipakai peserta (berubah setiap kali bergabung)
  peerId?: string;
  lastSeen: number;
}

export interface MeetingShareRequest {
  name: string;
  status: 'pending' | 'approved' | 'denied';
  at: string;
}

export interface MeetingMessage {
  id: string;
  uid: string;
  name: string;
  role: 'teacher' | 'student';
  text: string;
  created_at: string;
}

export interface MeetingReaction {
  id: string;
  uid: string;
  name: string;
  emoji: string;
  // Diisi saat pengajar memberi bintang ke siswa tertentu
  target?: string;
  created_at: string;
}

// ============================================
// NOTIFICATIONS
// ============================================

export type NotificationType = 'class' | 'assignment' | 'meeting' | 'meeting_live' | 'grade_given' | 'grade_received' | 'attendance_taken' | 'attendance_present' | 'attendance_absent';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  // Dokumen yang dituju (kelas / tugas / meeting)
  ref_id: string;
  class_id?: string;
  audience: 'student' | 'teacher' | 'all';
  // Kalau diisi, notifikasi hanya untuk user ini (dipakai notifikasi nilai)
  recipient_id?: string;
  assignment_id?: string;
  course_name?: string;
  student_name?: string;
  score?: number;
  // Notifikasi tidak hadir: alasan (Details) + status izin/tanpa keterangan + bukti
  reason?: string;
  attendance_status?: AttendanceStatus;
  proof_url?: string;
  created_by?: string;
  created_at: string;
}

// ============================================
// AI CHAT HISTORY (LibraAI & ScorpioAI)
// ============================================

export type AiAssistant = 'libra' | 'scorpio';

export interface AiChatMessage {
  role: 'user' | 'model';
  content: string;
  files?: string[];
  created_at: string;
}

export interface AiChatSession {
  id: string;
  user_id: string;
  assistant: AiAssistant;
  title: string;
  messages: AiChatMessage[];
  created_at: string;
  updated_at: string;
}

// File dari Firebase Storage yang boleh dibaca AI oleh user ini
export interface AiFileRef {
  id: string;
  name: string;
  kind: 'class_materi' | 'assignment_materi' | 'submission';
  label: string;
}

export interface AiSubmissionItem {
  submission_id: string;
  student_id: string;
  student_name: string;
  assignment_id: string;
  assignment_title: string;
  course_name: string;
  class_id?: string;
  file_name: string | null;
  submitted_at: string | null;
  is_late: boolean;
  already_graded: boolean;
}

export interface AiGradeResult {
  submission_id: string;
  student_id: string;
  student_name: string;
  assignment_id: string;
  assignment_title: string;
  course_name: string;
  class_id?: string;
  score: number;
  grade_letter: string;
  feedback: string;
}

export interface CreateMeetingForm {
  title: string;
  time: string;
  participants?: number;
  status?: string;
  link?: string;
  class_id?: string;
}

export type AttendanceStatus = 'Attended' | 'Absence' | 'Late' | 'ExcusedAbsen';

export interface TakeAttendanceForm {
  class_id: string;
  student_id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  status: AttendanceStatus;
  reason?: string;
  proof_url?: string;
}

export interface AttendanceRecord extends TakeAttendanceForm {
  id: string;
  created_at: string;
  updated_at?: string;
}

export interface StudentList {
  id: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  student_name?: string;
  student_id?: string;
  student_class?: string;
  student_role?: string;
}
