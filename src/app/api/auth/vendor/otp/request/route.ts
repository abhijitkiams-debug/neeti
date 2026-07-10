import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueOtp } from "@/lib/otp";

const schema = z.object({ mobile: z.string().min(6) });

export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const vendorUser = await prisma.vendorUser.findFirst({
    where: { mobile: body.data.mobile, status: "ACTIVE" },
    include: { vendorOrg: true },
  });

  // Don't leak whether a mobile number exists.
  if (!vendorUser || vendorUser.vendorOrg.status !== "ACTIVE") {
    return NextResponse.json({ ok: true });
  }

  const devCode = await issueOtp(vendorUser.id, "LOGIN", vendorUser.tenantId, vendorUser.mobile);
  return NextResponse.json({ ok: true, devCode });
}
