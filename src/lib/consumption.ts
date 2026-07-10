import { prisma } from "./prisma";
import type { Session } from "./auth";

/** Policy ids the current session is entitled to see in the consumption portal —
 * i.e. they are an AudienceMember of that policy's currently published version.
 * This is the hard tenant/audience isolation boundary: vendor users only ever
 * see their own assigned policies, never another vendor org's or the full catalog. */
export async function visiblePolicyIdsFor(session: Session): Promise<string[]> {
  const where =
    session.kind === "employee"
      ? { userId: session.userId }
      : { vendorUserId: session.vendorUserId };

  const memberships = await prisma.audienceMember.findMany({
    where: { ...where, policyVersion: { status: "PUBLISHED" } },
    select: { policyVersion: { select: { policyId: true } } },
  });
  return [...new Set(memberships.map((m) => m.policyVersion.policyId))];
}

export function sessionIdentity(session: Session) {
  return session.kind === "employee"
    ? { userId: session.userId as string | undefined, vendorUserId: undefined as string | undefined }
    : { userId: undefined as string | undefined, vendorUserId: session.vendorUserId as string | undefined };
}
