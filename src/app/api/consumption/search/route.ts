import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { visiblePolicyIdsFor } from "@/lib/consumption";

// Full-text search across titles + body, scoped to the caller's visible audience.
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!q) return NextResponse.json({ results: [] });

    const ids = await visiblePolicyIdsFor(session);
    const policies = await prisma.policy.findMany({
      where: {
        id: { in: ids },
        OR: [
          { title: { contains: q } },
          { currentVersion: { contentHtml: { contains: q } } },
        ],
      },
      include: { family: true, currentVersion: true },
      take: 50,
    });

    return NextResponse.json({
      results: policies.map((p) => ({ slug: p.slug, title: p.title, family: p.family.name, publishedAt: p.currentVersion?.publishedAt })),
    });
  } catch (e) {
    return apiError(e);
  }
}
