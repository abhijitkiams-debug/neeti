import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { submitQuizAnswer } from "@/lib/quiz";

const schema = z.object({ assignmentId: z.string().min(1), optionId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
    const result = await submitQuizAnswer(session, body.data.assignmentId, body.data.optionId);
    return NextResponse.json({ result });
  } catch (e) {
    return apiError(e);
  }
}
