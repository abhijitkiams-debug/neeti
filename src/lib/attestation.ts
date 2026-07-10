import { prisma } from "./prisma";
import { sha256 } from "./hash";
import type { AttestationMethod } from "./enums";

export async function recordAttestation(params: {
  policyVersionId: string;
  userId?: string;
  vendorUserId?: string;
  method: AttestationMethod;
  ipAddress?: string | null;
}) {
  const signedAt = new Date();
  const recordHash = sha256(
    [params.policyVersionId, params.userId ?? "", params.vendorUserId ?? "", params.method, signedAt.toISOString()].join("|")
  );

  return prisma.attestation.create({
    data: {
      policyVersionId: params.policyVersionId,
      userId: params.userId,
      vendorUserId: params.vendorUserId,
      method: params.method,
      ipAddress: params.ipAddress ?? null,
      signedAt,
      recordHash,
    },
  });
}
