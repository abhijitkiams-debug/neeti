import { prisma } from "./prisma";
import { generateOtp, sha256 } from "./hash";
import { queueAndSendNotification } from "./notify";

const OTP_TTL_MINUTES = 5;

export async function issueOtp(vendorUserId: string, purpose: "LOGIN" | "ATTESTATION", tenantId: string, mobile: string) {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: { vendorUserId, codeHash: sha256(code), purpose, expiresAt },
  });

  await queueAndSendNotification({
    tenantId,
    type: "REMINDER",
    channel: "SMS",
    recipientVendorUserId: vendorUserId,
    to: mobile,
    payload: {
      subject: "Neeti OTP",
      body: `Your Neeti ${purpose === "LOGIN" ? "login" : "attestation"} OTP is ${code}. Valid for ${OTP_TTL_MINUTES} minutes.`,
      deepLink: "/vendor/login",
    },
  });

  // Dev convenience: also return the code so the scaffold is testable without
  // a real SMS gateway wired up. Never do this in a production build.
  return process.env.NODE_ENV === "production" ? undefined : code;
}

export async function verifyOtp(vendorUserId: string, purpose: "LOGIN" | "ATTESTATION", code: string) {
  const candidate = await prisma.otpCode.findFirst({
    where: { vendorUserId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!candidate) return false;
  if (candidate.codeHash !== sha256(code)) return false;

  await prisma.otpCode.update({ where: { id: candidate.id }, data: { consumedAt: new Date() } });
  return true;
}
