import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

// Optional IP allow-listing for the publisher/admin console only — never
// applied to the vendor/employee consumption portal, per the security baseline.
export async function GET() {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const entries = await prisma.ipAllowlistEntry.findMany({ where: { tenantId: session.tenantId } });
    return NextResponse.json({ entries });
  } catch (e) {
    return apiError(e);
  }
}

const schema = z.object({ cidr: z.string().min(1), label: z.string().optional() });

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee(["ADMIN"]);
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
    const entry = await prisma.ipAllowlistEntry.create({
      data: { tenantId: session.tenantId, cidr: body.data.cidr, label: body.data.label },
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
