import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const { id } = await params;
    await prisma.user.findFirstOrThrow({ where: { id, tenantId: session.tenantId } });

    const employee = await prisma.user.update({ where: { id }, data: { status: "DEACTIVATED", deactivatedAt: new Date() } });

    await writeAuditLog({
      tenantId: session.tenantId,
      actorType: "USER",
      actorId: session.userId,
      action: "EMPLOYEE_DEACTIVATED",
      entityType: "User",
      entityId: id,
      metadata: { email: employee.email },
    });

    return NextResponse.json({ employee });
  } catch (e) {
    return apiError(e);
  }
}
