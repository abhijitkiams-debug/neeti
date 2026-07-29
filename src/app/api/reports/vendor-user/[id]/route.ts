import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getVendorUserSignoff } from "@/lib/signoff";

// Individual vendor-user report: everything assigned, read status,
// attestation status — the vendor-side counterpart to
// /api/reports/user/[id].
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const { id } = await params;
    const vendorUser = await prisma.vendorUser.findFirstOrThrow({
      where: { id, tenantId: session.tenantId },
      include: { vendorOrg: { select: { id: true, name: true } } },
    });

    const items = await getVendorUserSignoff(id);

    return NextResponse.json({
      vendorUser: { id: vendorUser.id, name: vendorUser.name, mobile: vendorUser.mobile, vendorOrgId: vendorUser.vendorOrg.id, vendorOrgName: vendorUser.vendorOrg.name },
      items,
    });
  } catch (e) {
    return apiError(e);
  }
}
