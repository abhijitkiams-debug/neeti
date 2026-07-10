import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { visiblePolicyIdsFor, sessionIdentity } from "@/lib/consumption";
import { recordAttestation } from "@/lib/attestation";
import { verifyPassword } from "@/lib/hash";
import { verifyOtp } from "@/lib/otp";

const employeeSchema = z.object({ password: z.string().min(1) });
const vendorSchema = z.object({ code: z.string().length(6) });

// Employee: e-sign via an AD re-verification stand-in (password re-entry).
// Vendor: OTP re-verified at the moment of signing (see attest-otp route).
// Both paths write an immutable Attestation record with method + hash.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireSession();
    const { slug } = await params;
    const policy = await prisma.policy.findFirstOrThrow({ where: { slug } });
    const visibleIds = await visiblePolicyIdsFor(session);
    if (!visibleIds.includes(policy.id) || !policy.currentVersionId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { userId, vendorUserId } = sessionIdentity(session);
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");

    if (session.kind === "employee") {
      const body = employeeSchema.safeParse(await req.json());
      if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
      if (!user.passwordHash) {
        return NextResponse.json({ error: "AD re-verification is not configured for this account" }, { status: 400 });
      }
      const ok = await verifyPassword(body.data.password, user.passwordHash);
      if (!ok) return NextResponse.json({ error: "Re-verification failed" }, { status: 401 });

      await recordAttestation({ policyVersionId: policy.currentVersionId, userId, method: "AD_REVERIFY", ipAddress: ip });
    } else {
      const body = vendorSchema.safeParse(await req.json());
      if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

      const ok = await verifyOtp(session.vendorUserId, "ATTESTATION", body.data.code);
      if (!ok) return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });

      await recordAttestation({ policyVersionId: policy.currentVersionId, vendorUserId, method: "OTP", ipAddress: ip });
    }

    // Attesting implies having read it.
    await prisma.readReceipt.upsert({
      where: userId
        ? { policyVersionId_userId: { policyVersionId: policy.currentVersionId, userId } }
        : { policyVersionId_vendorUserId: { policyVersionId: policy.currentVersionId, vendorUserId: vendorUserId! } },
      update: {},
      create: { policyVersionId: policy.currentVersionId, userId, vendorUserId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
