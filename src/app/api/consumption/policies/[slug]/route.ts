import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { visiblePolicyIdsFor, sessionIdentity } from "@/lib/consumption";
import { clientIp, clientUserAgent } from "@/lib/request-info";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireSession();
    const { slug } = await params;

    const policy = await prisma.policy.findFirst({
      where: { slug },
      include: { family: true, currentVersion: true },
    });
    if (!policy || !policy.currentVersionId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const visibleIds = await visiblePolicyIdsFor(session);
    if (!visibleIds.includes(policy.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { userId, vendorUserId } = sessionIdentity(session);
    const [readReceipt, attestation, star] = await Promise.all([
      prisma.readReceipt.findFirst({ where: { policyVersionId: policy.currentVersionId, userId, vendorUserId } }),
      prisma.attestation.findFirst({ where: { policyVersionId: policy.currentVersionId, userId, vendorUserId } }),
      prisma.star.findFirst({ where: { policyId: policy.id, userId, vendorUserId } }),
    ]);

    await prisma.accessLog.create({
      data: {
        policyVersionId: policy.currentVersionId,
        userId,
        vendorUserId,
        ipAddress: clientIp(req),
        userAgent: clientUserAgent(req),
      },
    });

    return NextResponse.json({
      policy: {
        id: policy.id,
        slug: policy.slug,
        title: policy.title,
        family: policy.family.name,
        contentHtml: policy.currentVersion!.contentHtml,
        versionNumber: policy.currentVersion!.versionNumber,
        versionId: policy.currentVersionId,
        publishedAt: policy.currentVersion!.publishedAt,
        expiresAt: policy.currentVersion!.expiresAt,
        sourceType: policy.currentVersion!.sourceType,
        sourceFileUrl: policy.currentVersion!.sourceFileUrl,
      },
      hasRead: !!readReceipt,
      hasAttested: !!attestation,
      starred: !!star,
    });
  } catch (e) {
    return apiError(e);
  }
}
