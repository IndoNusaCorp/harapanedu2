import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { verifyRequestUser } from "@/lib/ai/serverAuth";
import { buildAiData } from "@/lib/ai/dataContext";
import { voiceToolDeclarations } from "@/lib/ai/voiceTools";

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.LIBRAAI_VOICE_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "API key not configured." },
                { status: 500 }
            );
        }

        // Role, kelas, dan data diambil dari user yang login (bukan dari body request)
        const user = await verifyRequestUser(request);
        if (!user) {
            return NextResponse.json(
                { success: false, error: "Sesi login tidak valid." },
                { status: 401 }
            );
        }

        const genAI = new GoogleGenAI({ apiKey });

        const role = user.role;
        const classLevel = user.classLevel;
        const contextData = JSON.stringify((await buildAiData(user)).context);

        // --- Tone instruction (same logic as text-based LibraAI) ---
        let toneInstruction = "";

        if (role === "teacher") {
            toneInstruction = `
            - Tone: Profesional, sangat sopan, hormat, dan berwibawa.
            - Gaya bicara: Gunakan sapaan Bapak/Ibu. Gunakan kata "Saya" dan "Anda" / "Bapak/Ibu". Jangan menggurui, bertindak sebagai asisten profesional yang siap membantu pengajar.
            `;
        } else {
            if (classLevel >= 1 && classLevel <= 6) {
                toneInstruction = `
                - Tone: Lebih ceria, sederhana, menyenangkan, penyemangat.
                - Gaya bicara: Gunakan bahasa yang sangat mudah dimengerti anak-anak. Posisikan diri sebagai teman belajar yang pintar dan asyik.
                `;
            } else if (classLevel >= 7 && classLevel <= 9) {
                toneInstruction = `
                - Tone: Lebih lembut, ramah, tidak terlalu kekanak-kanakan tapi belum terlalu formal.
                - Gaya bicara: Bersahabat, menyemangati, gunakan bahasa yang sopan namun santai seperti kakak mentor.
                `;
            } else if (classLevel >= 10 && classLevel <= 12) {
                toneInstruction = `
                - Tone: Lebih santai, relevan dengan remaja masa kini (seperti teman), tetapi tetap sopan.
                - Gaya bicara: Asyik, gaul namun tetap edukatif dan terstruktur. Gunakan "Saya" dan "Kamu".
                `;
            } else {
                toneInstruction = `
                - Tone: Edukatif, ramah, dan memotivasi.
                `;
            }
        }

        // Wake phrase: audio dikirim langsung dari browser ke Gemini Live, jadi server
        // tidak bisa mendeteksi ucapan user. Deteksi diserahkan ke model lewat systemInstruction.
        const callinglibra = "Hey Libra";
        const GreetingLibra =
            role === "teacher"
                ? "Iya, Bapak/Ibu? Ada yang bisa saya bantu?"
                : "Iya, saya di sini! Ada yang bisa saya bantu?";

        const systemInstruction = `
        Kamu adalah LibraAI Voice, Teman AI Akademik untuk Sekolah Dian Harapan.
        - PANGGILAN: Jika pengguna memanggil "${callinglibra}" (atau variasinya seperti "Hai Libra", "Halo Libra", "Libra"), SELALU dan SEGERA merespon, walaupun sebelumnya sedang membahas topik lain.
          - Jika panggilan itu tidak diikuti pertanyaan, jawab singkat dengan: "${GreetingLibra}"
          - Jika panggilan itu diikuti pertanyaan (misal "Hey Libra, tugas saya apa saja?"), langsung jawab pertanyaannya tanpa sapaan panjang.
        - Fokus utama: Materi Sekolah, Pelajaran, Ringkasan Materi, dan menjawab pertanyaan seputar jadwal, kelas, tugas, serta nilai pengguna.
        - Bahasa: SELALU jawab dalam Bahasa Indonesia.
        - PENTING: Kamu sedang berkomunikasi melalui SUARA (voice chat). Jawab dengan kalimat natural seperti percakapan, jangan gunakan Markdown, bullet points, atau format teks.
        - Jawab dengan ringkas dan jelas, seperti sedang berbicara langsung.
        - LAYAR: Kamu bisa menampilkan sesuatu di layar pengguna lewat tool.
          - Jika pengguna minta melihat, membuka, atau mencari file/dokumen/materi, panggil tool "show_documents" (isi "open": true jika ingin langsung dibuka).
          - Jika pengguna minta melihat nilai${role === "teacher" ? " siswa" : " (nilai pribadinya)"}, panggil tool "show_grades".
          - Jika pengguna minta menutup tampilan, panggil tool "close_panel".
          - Setelah tool selesai, jawab singkat berdasarkan hasilnya (misal "Ini dia 3 file materi Matematika" atau rata-rata nilainya). Jangan membacakan seluruh daftar.
        ${toneInstruction}
        - DILARANG KERAS 18+ KONTEN
        - DILARANG KERAS KONTEN POLITIK
        - DILARANG KERAS KONTEN SARA
        - DILARANG PAKE GUA DAN LU, WAJIB PAKAI SAYA DAN ANDA/KAMU.

        Berikut adalah konteks data pengguna saat ini (Dashboard, Kelas, Tugas, Nilai, Jadwal, dll). Gunakan data ini JIKA RELEVAN dengan pertanyaan pengguna:
        ${contextData}
        `;

        // --- Generate ephemeral token ---
        const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
        const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes

        const token = await genAI.authTokens.create({
            config: {
                uses: 1,
                expireTime: expireTime,
                newSessionExpireTime: newSessionExpireTime,
                httpOptions: { apiVersion: "v1alpha" },
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                token: token.name,
                model: "gemini-2.5-flash-native-audio-preview-12-2025",
                systemInstruction: systemInstruction,
                tools: [{ functionDeclarations: voiceToolDeclarations(role) }],
            },
        });
    } catch (error) {
        console.error("Voice API Error:", error);
        return NextResponse.json(
            { success: false, error: "Gagal membuat sesi voice. Coba lagi nanti." },
            { status: 500 }
        );
    }
}
