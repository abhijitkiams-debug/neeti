import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { summarizeUserAgent } from "@/lib/ua-parse";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const { id: policyId } = await params;
    await prisma.policy.findFirstOrThrow({ where: { id: policyId, tenantId: session.tenantId } });

    const logs = await prisma.accessLog.findMany({
      where: { policyVersion: { policyId } },
      include: { user: true, vendorUser: { include: { vendorOrg: true } }, policyVersion: true },
      orderBy: { accessedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        versionNumber: l.policyVersion.versionNumber,
        name: l.user?.name ?? l.vendorUser?.name ?? "Unknown",
        type: l.userId ? "Employee" : "Vendor",
        agencyName: l.vendorUser?.vendorOrg.name ?? null,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        ...summarizeUserAgent(l.userAgent),
        accessedAt: l.accessedAt,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
