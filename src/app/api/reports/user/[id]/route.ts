import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getEmployeeSignoff } from "@/lib/signoff";

// Individual user (employee) report: everything assigned, read status, attestation status.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const { id } = await params;
    const user = await prisma.user.findFirstOrThrow({ where: { id, tenantId: session.tenantId } });

    const items = await getEmployeeSignoff(id);

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, department: user.department },
      items,
    });
  } catch (e) {
    return apiError(e);
  }
}
