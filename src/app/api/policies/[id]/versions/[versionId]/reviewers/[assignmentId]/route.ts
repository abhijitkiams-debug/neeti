import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { removeReviewer } from "@/lib/reviews";

export async function DELETE(_req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { assignmentId } = await params;
    await removeReviewer({ tenantId: session.tenantId, assignmentId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
