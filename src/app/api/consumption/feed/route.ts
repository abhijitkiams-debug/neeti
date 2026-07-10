import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { visiblePolicyIdsFor, sessionIdentity } from "@/lib/consumption";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const familyId = req.nextUrl.searchParams.get("familyId") ?? undefined;
    const ids = await visiblePolicyIdsFor(session);

    const policies = await prisma.policy.findMany({
      where: { id: { in: ids }, familyId },
      include: { family: true, currentVersion: true },
      orderBy: { currentVersion: { publishedAt: "desc" } },
    });

    const { userId, vendorUserId } = sessionIdentity(session);
    const [reads, stars] = await Promise.all([
      prisma.readReceipt.findMany({
        where: { policyVersionId: { in: policies.map((p) => p.currentVersionId!).filter(Boolean) }, userId, vendorUserId },
      }),
      prisma.star.findMany({ where: { policyId: { in: ids }, userId, vendorUserId } }),
    ]);
    const readVersionIds = new Set(reads.map((r) => r.policyVersionId));
    const starredPolicyIds = new Set(stars.map((s) => s.policyId));

    const feed = policies.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      family: p.family.name,
      versionNumber: p.currentVersion?.versionNumber,
      publishedAt: p.currentVersion?.publishedAt,
      unread: p.currentVersionId ? !readVersionIds.has(p.currentVersionId) : false,
      starred: starredPolicyIds.has(p.id),
    }));

    return NextResponse.json({ feed });
  } catch (e) {
    return apiError(e);
  }
}
