import { NextRequest } from "next/server";
import { libraGET, libraPOST } from "@/lib/ai/libraai/libraai";

// LibraAI — teman belajar (siswa) & asisten mengajar (guru).
// Semua logika + system instruction ada di src/lib/ai/libraai/libraai.ts.

// GET: daftar file materi/tugas di Storage yang boleh dilampirkan user
export async function GET(request: NextRequest) {
    return libraGET(request);
}

// POST: { message, history, fileIds, locale }
export async function POST(request: NextRequest) {
    return libraPOST(request);
}
