import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getVendorOrgSignoffSummary } from "@/lib/signoff";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee();
    const { id } = await params;
    await prisma.vendorOrg.findFirstOrThrow({ where: { id, tenantId: session.tenantId } });
    const summary = await getVendorOrgSignoffSummary(id);
    return NextResponse.json(summary);
  } catch (e) {
    return apiError(e);
  }
}
