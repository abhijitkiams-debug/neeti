import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

// Individual user (employee) report: everything assigned, read status, attestation status.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const { id } = await params;
    const user = await prisma.user.findFirstOrThrow({ where: { id, tenantId: session.tenantId } });

    const memberships = await prisma.audienceMember.findMany({
      where: { userId: id },
      include: { policyVersion: { include: { policy: { include: { family: true } } } } },
    });
    const [reads, attestations] = await Promise.all([
      prisma.readReceipt.findMany({ where: { userId: id } }),
      prisma.attestation.findMany({ where: { userId: id } }),
    ]);
    const readVersionIds = new Set(reads.map((r) => r.policyVersionId));
    const attestedVersionIds = new Set(attestations.map((a) => a.policyVersionId));

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, department: user.department },
      items: memberships.map((m) => ({
        policyTitle: m.policyVersion.policy.title,
        family: m.policyVersion.policy.family.name,
        versionNumber: m.policyVersion.versionNumber,
        read: readVersionIds.has(m.policyVersionId),
        attested: attestedVersionIds.has(m.policyVersionId),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
