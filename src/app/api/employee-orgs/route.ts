import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

export async function GET() {
  try {
    const session = await requireEmployee();
    const orgs = await prisma.employeeOrg.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ orgs });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({ name: z.string().min(1), description: z.string().optional() });

export async function POST(req: Request) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const existing = await prisma.employeeOrg.findFirst({ where: { tenantId: session.tenantId, name: body.data.name } });
    if (existing) return NextResponse.json({ error: "An employee org with that name already exists" }, { status: 409 });

    const org = await prisma.employeeOrg.create({
      data: { tenantId: session.tenantId, name: body.data.name, description: body.data.description || null },
    });
    return NextResponse.json({ org }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
