import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET() {
  try {
    const session = await requireEmployee();
    const families = await prisma.policyFamily.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ families });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({ name: z.string().min(1), description: z.string().optional() });

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
    const family = await prisma.policyFamily.create({
      data: { tenantId: session.tenantId, name: body.data.name, description: body.data.description },
    });
    return NextResponse.json({ family }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
