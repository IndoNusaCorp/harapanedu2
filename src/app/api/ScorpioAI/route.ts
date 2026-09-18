import { NextRequest } from "next/server";
import { scorpioGET, scorpioPOST } from "@/lib/ai/scorpioai/scorpioai";

// ScorpioAI (GradeHelper)
// Semua logika + system instruction ada di src/lib/ai/scorpioai/scorpioai.ts.

// GET: daftar file yang boleh dilampirkan + (guru) daftar tugas yang sudah dikumpulkan
export async function GET(request: NextRequest) {
    return scorpioGET(request);
}

// POST: chat → { message, history, fileIds, locale }
//       grading (guru) → { action: "grade", submissionIds, locale }
export async function POST(request: NextRequest) {
    return scorpioPOST(request);
}
