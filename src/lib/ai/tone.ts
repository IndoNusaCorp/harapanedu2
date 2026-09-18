// ============================================
// FUNGSI BANTU: parseClassLevel
// ============================================
// Mengubah format kelas dari string (contoh: "Kelas 1 SD") menjadi angka (1-12):
// - "Kelas 1 SD"  → 1   (SD kelas 1)
// - "Kelas 1 SMP" → 7   (SMP kelas 1 = 1 + 6)
// - "Kelas 1 SMA" → 10  (SMA kelas 1 = 1 + 9)
// Jika sudah berupa angka, langsung dikembalikan. Jika kosong/tidak valid → 0.
export function parseClassLevel(classString: string | number | null | undefined): number {
    if (typeof classString === "number") return classString;
    if (!classString) return 0;

    const text = String(classString).trim();
    // Angka polos seperti "7"
    if (/^\d+$/.test(text)) return parseInt(text);

    const parts = text.split(" ");
    const kelasNumber = parseInt(parts[1]);
    if (isNaN(kelasNumber)) return 0;

    const jenjang = (parts[2] || "").toUpperCase();
    if (jenjang === "SD") return kelasNumber;
    if (jenjang === "SMP") return kelasNumber + 6;
    if (jenjang === "SMA") return kelasNumber + 9;
    return kelasNumber;
}

export function jenjangOf(classLevel: number): "SD" | "SMP" | "SMA" | null {
    if (classLevel >= 1 && classLevel <= 6) return "SD";
    if (classLevel >= 7 && classLevel <= 9) return "SMP";
    if (classLevel >= 10 && classLevel <= 12) return "SMA";
    return null;
}

// Aturan huruf nilai yang dipakai ScorpioAI (dari prompt grading asli)
export function gradeLetter(score: number): string {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "E";
}

// Marker yang dirender frontend sebagai tombol "Bantu nilai" (khusus ScorpioAI guru).
// Ditaruh di sini (bukan di scorpioai.ts) supaya halaman client tidak ikut memuat kode server.
export const GRADE_MARKER = "[BANTU_NILAI]";
