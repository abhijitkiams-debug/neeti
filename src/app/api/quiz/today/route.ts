import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getOrCreateTodaysQuiz } from "@/lib/quiz";

export async function GET() {
  try {
    const session = await requireSession();
    const questions = await getOrCreateTodaysQuiz(session);
    return NextResponse.json({ questions });
  } catch (e) {
    return apiError(e);
  }
}
