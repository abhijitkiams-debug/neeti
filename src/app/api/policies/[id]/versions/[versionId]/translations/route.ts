import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { LANGUAGES } from "@/lib/enums";

const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

async function loadVersion(versionId: string, tenantId: string) {
  return prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId } } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee();
    const { versionId } = await params;
    await loadVersion(versionId, session.tenantId);

    const translations = await prisma.policyTranslation.findMany({
      where: { policyVersionId: versionId },
      select: { languageCode: true, contentHtml: true, machineTranslated: true, updatedAt: true },
    });
    return NextResponse.json({ translations });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({
  languageCode: z.enum(LANGUAGE_CODES as [string, ...string[]]),
  contentHtml: z.string().min(1),
});

export async function PUT(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { versionId } = await params;
    const version = await loadVersion(versionId, session.tenantId);

    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
    if (body.data.languageCode === "en") {
      return NextResponse.json({ error: "English is the base content — edit it from the main editor, not as a translation." }, { status: 400 });
    }

    const translation = await prisma.policyTranslation.upsert({
      where: { policyVersionId_languageCode: { policyVersionId: version.id, languageCode: body.data.languageCode } },
      update: { contentHtml: body.data.contentHtml, machineTranslated: false },
      create: {
        policyVersionId: version.id,
        languageCode: body.data.languageCode,
        contentHtml: body.data.contentHtml,
        machineTranslated: false,
        createdById: session.userId,
      },
    });
    return NextResponse.json({ translation });
  } catch (e) {
    return apiError(e);
  }
}
