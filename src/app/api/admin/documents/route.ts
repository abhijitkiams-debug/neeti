import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

// Consolidated document register for Admin/Management: every policy, its
// live status, and whether it's Mandatory (linked to a mandatory coverage
// checklist item) or Optional/Recommended.
export async function GET() {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const [policies, coverageLinks] = await Promise.all([
      prisma.policy.findMany({
        where: { tenantId: session.tenantId },
        include: {
          family: true,
          currentVersion: true,
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          _count: { select: { versions: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.coverageChecklistItem.findMany({
        where: { tenantId: session.tenantId, linkedPolicyId: { not: null } },
      }),
    ]);

    const scopeByPolicyId = new Map(coverageLinks.map((c) => [c.linkedPolicyId!, c.mandatory ? "Mandatory" : "Recommended"]));

    const documents = policies.map((p) => {
      const latest = p.versions[0];
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        family: p.family.name,
        status: p.currentVersion?.status ?? latest?.status ?? "DRAFT",
        versionNumber: p.currentVersion?.versionNumber ?? latest?.versionNumber ?? 0,
        totalVersions: p._count.versions,
        publishedAt: p.currentVersion?.publishedAt ?? null,
        expiresAt: p.currentVersion?.expiresAt ?? null,
        scope: scopeByPolicyId.get(p.id) ?? "Optional",
        updatedAt: p.updatedAt,
      };
    });

    return NextResponse.json({ documents });
  } catch (e) {
    return apiError(e);
  }
}
