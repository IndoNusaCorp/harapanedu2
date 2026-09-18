import { doc, getDoc } from "firebase/firestore";
import { connecttofirestore } from "@/lib/firebase";
import { parseClassLevel } from "./tone";

// ============================================
// Verifikasi user yang memanggil API AI
// ============================================
// Frontend mengirim Firebase ID token di header "Authorization: Bearer <token>".
// Token dicek ke Google Identity Toolkit, lalu role & kelas diambil dari Firestore.
// Jadi role TIDAK dipercaya dari body request → siswa tidak bisa mengaku sebagai guru.

export interface AiUser {
  uid: string;
  role: "teacher" | "student";
  classLevel: number;
  name: string;
}

export async function verifyRequestUser(request: Request): Promise<AiUser | null> {
  const header = request.headers.get("authorization") || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!idToken) return null;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = await res.json();
  const uid: string | undefined = data.users?.[0]?.localId;
  if (!uid) return null;

  const snap = await getDoc(doc(connecttofirestore, "users", uid));
  const profile = snap.exists() ? snap.data() : {};

  return {
    uid,
    role: profile.role_id === "2" || profile.role === "teacher" ? "teacher" : "student",
    classLevel: parseClassLevel(profile.class),
    name: fullName(profile) || data.users[0].email?.split("@")[0] || "Pengguna",
  };
}

export function fullName(user: { first_name?: string; last_name?: string; name?: string; username?: string } | undefined) {
  if (!user) return "";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.name || user.username || "";
}
