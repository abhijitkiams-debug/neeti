import { prisma } from "./prisma";
import type { Session } from "./auth";

const STAFF_ROLES = ["ADMIN", "PUBLISHER", "AUTHOR"];

/** Policy ids the current session is entitled to see in the consumption portal —
 * i.e. they are an AudienceMember of that policy's currently published version.
 * This is the hard tenant/audience isolation boundary: vendor users only ever
 * see their own assigned policies, never another vendor org's or the full catalog.
 *
 * Exception: Admin/Publisher/Author staff can preview any published policy in
 * their own tenant regardless of targeting — otherwise "View live" from the
 * admin console 404s for anyone not personally in the audience, which is most
 * staff most of the time. */
export async function visiblePolicyIdsFor(session: Session): Promise<string[]> {
  if (session.kind === "employee" && STAFF_ROLES.includes(session.role)) {
    const policies = await prisma.policy.findMany({
      where: { tenantId: session.tenantId, currentVersionId: { not: null } },
      select: { id: true },
    });
    return policies.map((p) => p.id);
  }

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
