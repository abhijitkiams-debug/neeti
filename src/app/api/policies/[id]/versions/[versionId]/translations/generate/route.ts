import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { LANGUAGES } from "@/lib/enums";
import { translatePolicyContent, isAiConfigured } from "@/lib/ai";

const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
const schema = z.object({ languageCode: z.enum(LANGUAGE_CODES as [string, ...string[]]) });

export async function POST(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const session = await requireEmployee(["AUTHOR", "ADMIN"]);
    const { versionId } = await params;
    const version = await prisma.policyVersion.findFirstOrThrow({ where: { id: versionId, policy: { tenantId: session.tenantId } } });

    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
    const language = LANGUAGES.find((l) => l.code === body.data.languageCode)!;
    if (language.code === "en") {
      return NextResponse.json({ error: "English is the base content — nothing to translate." }, { status: 400 });
    }

    if (!isAiConfigured()) {
      return NextResponse.json(
        { error: "AI translation isn't configured — set ANTHROPIC_API_KEY in .env, or write the translation manually." },
        { status: 503 }
      );
    }

    let translatedHtml: string;
    try {
      translatedHtml = await translatePolicyContent({ contentHtml: version.contentHtml, targetLanguageName: language.englishName });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Translation failed" }, { status: 502 });
    }

    const translation = await prisma.policyTranslation.upsert({
      where: { policyVersionId_languageCode: { policyVersionId: version.id, languageCode: language.code } },
      update: { contentHtml: translatedHtml, machineTranslated: true },
      create: {
        policyVersionId: version.id,
        languageCode: language.code,
        contentHtml: translatedHtml,
        machineTranslated: true,
        createdById: session.userId,
      },
    });
    return NextResponse.json({ translation });
  } catch (e) {
    return apiError(e);
  }
}
