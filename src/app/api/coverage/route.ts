import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { deriveCoverageStatus, coveragePercent } from "@/lib/coverage";

export async function GET() {
  try {
    const session = await requireEmployee();
    const items = await prisma.coverageChecklistItem.findMany({
      where: { tenantId: session.tenantId },
      include: { family: true, linkedPolicy: true },
      orderBy: [{ familyId: "asc" }, { itemName: "asc" }],
    });
    const withStatus = await Promise.all(
      items.map(async (i) => ({ ...i, status: await deriveCoverageStatus(i) }))
    );
    const percent = await coveragePercent(session.tenantId);
    return NextResponse.json({ items: withStatus, coveragePercent: percent });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({
  familyId: z.string().optional(),
  itemName: z.string().min(1),
  mandatory: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const item = await prisma.coverageChecklistItem.create({
      data: {
        tenantId: session.tenantId,
        familyId: body.data.familyId,
        itemName: body.data.itemName,
        mandatory: body.data.mandatory,
        sourceTemplate: "CUSTOM",
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
