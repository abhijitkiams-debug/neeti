import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVendor } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { issueOtp } from "@/lib/otp";

// Vendor attestation is a two-step re-verification: request a fresh OTP here,
// then POST the code to the sibling `attest` route to actually sign.
export async function POST() {
  try {
    const session = await requireVendor();
    const vendorUser = await prisma.vendorUser.findUniqueOrThrow({ where: { id: session.vendorUserId } });
    const devCode = await issueOtp(vendorUser.id, "ATTESTATION", vendorUser.tenantId, vendorUser.mobile);
    return NextResponse.json({ ok: true, devCode });
  } catch (e) {
    return apiError(e);
  }
}
