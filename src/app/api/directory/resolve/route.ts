import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";

// Resolves emails -> employee ids and mobiles -> vendor user ids, for the
// "named individuals" targeting option in the policy editor.
const schema = z.object({ emails: z.array(z.string()).default([]), mobiles: z.array(z.string()).default([]) });

export async function POST(req: NextRequest) {
  try {
    const session = await requireEmployee();
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const [users, vendorUsers] = await Promise.all([
      prisma.user.findMany({ where: { tenantId: session.tenantId, email: { in: body.data.emails } }, select: { id: true, email: true } }),
      prisma.vendorUser.findMany({ where: { tenantId: session.tenantId, mobile: { in: body.data.mobiles } }, select: { id: true, mobile: true } }),
    ]);

    return NextResponse.json({
      employeeIds: users.map((u) => u.id),
      vendorUserIds: vendorUsers.map((v) => v.id),
      unmatchedEmails: body.data.emails.filter((e) => !users.some((u) => u.email === e)),
      unmatchedMobiles: body.data.mobiles.filter((m) => !vendorUsers.some((v) => v.mobile === m)),
    });
  } catch (e) {
    return apiError(e);
  }
}
