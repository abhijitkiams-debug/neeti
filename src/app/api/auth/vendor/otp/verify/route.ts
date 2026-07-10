import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/otp";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/api";

const schema = z.object({ mobile: z.string().min(6), code: z.string().length(6) });

export async function POST(req: NextRequest) {
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const vendorUser = await prisma.vendorUser.findFirst({
      where: { mobile: body.data.mobile, status: "ACTIVE" },
      include: { vendorOrg: true },
    });
    if (!vendorUser || vendorUser.vendorOrg.status !== "ACTIVE") {
      return NextResponse.json({ error: "Invalid mobile or code" }, { status: 401 });
    }

    const ok = await verifyOtp(vendorUser.id, "LOGIN", body.data.code);
    if (!ok) return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });

    await createSession({
      kind: "vendor",
      vendorUserId: vendorUser.id,
      vendorOrgId: vendorUser.vendorOrgId,
      tenantId: vendorUser.tenantId,
      role: vendorUser.role as never,
      name: vendorUser.name,
      mobile: vendorUser.mobile,
    });

    return NextResponse.json({ id: vendorUser.id, name: vendorUser.name, role: vendorUser.role });
  } catch (e) {
    return apiError(e);
  }
}
