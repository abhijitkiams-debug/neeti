import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { sessionIdentity } from "@/lib/consumption";

export async function GET() {
  try {
    const session = await requireSession();
    const { userId, vendorUserId } = sessionIdentity(session);
    const stars = await prisma.star.findMany({
      where: { userId, vendorUserId },
      include: { policy: { include: { family: true, currentVersion: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      starred: stars
        .filter((s) => s.policy.currentVersionId)
        .map((s) => ({ slug: s.policy.slug, title: s.policy.title, family: s.policy.family.name })),
    });
  } catch (e) {
    return apiError(e);
  }
}
