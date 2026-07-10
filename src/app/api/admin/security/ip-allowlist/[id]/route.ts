import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const { id } = await params;
    await prisma.ipAllowlistEntry.findFirstOrThrow({ where: { id, tenantId: session.tenantId } });
    await prisma.ipAllowlistEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
