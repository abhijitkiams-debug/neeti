import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { respondToReview, ReviewError } from "@/lib/reviews";

const schema = z.object({ status: z.enum(["APPROVED", "CHANGES_REQUESTED"]), comment: z.string().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee();
    const { versionId } = await params;
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const assignment = await respondToReview({
      tenantId: session.tenantId,
      versionId,
      reviewerId: session.userId,
      status: body.data.status,
      comment: body.data.comment,
    });
    return NextResponse.json({ assignment });
  } catch (e) {
    if (e instanceof ReviewError) return NextResponse.json({ error: e.message }, { status: 400 });
    return apiError(e);
  }
}
