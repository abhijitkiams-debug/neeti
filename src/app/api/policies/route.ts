import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { createPolicyWithDraft } from "@/lib/policies";

export async function GET(req: NextRequest) {
  try {
    const session = await requireEmployee();
    const familyId = req.nextUrl.searchParams.get("familyId") ?? undefined;
    const policies = await prisma.policy.findMany({
      where: { tenantId: session.tenantId, familyId },
      include: { family: true, currentVersion: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ policies });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({
  familyId: z.string().min(1),
  title: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and hyphens"),
  contentHtml: z.string().default(""),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN", "PUBLISHER"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const existing = await prisma.policy.findFirst({ where: { tenantId: session.tenantId, slug: body.data.slug } });
    if (existing) return NextResponse.json({ error: "A policy with that URL slug already exists" }, { status: 409 });

    const { policy, version } = await createPolicyWithDraft({
      tenantId: session.tenantId,
      familyId: body.data.familyId,
      title: body.data.title,
      slug: body.data.slug,
      authorId: session.userId,
      contentHtml: body.data.contentHtml,
      sourceType: "WYSIWYG",
    });

    return NextResponse.json({ policy, version }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
