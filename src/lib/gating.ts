import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import type { Session } from "./auth";

export type BlockingPolicy = { policyId: string; slug: string; title: string };

/**
 * Roles this hard-gate applies to. Field Executives and Callers are the
 * "start work" roles the request named — general vendor users/admins and
 * employees only get the repeat-reminder-email treatment (see
 * scripts/remind-mandatory-unsigned.ts), not a portal block, since there's
 * no real notion of "starting work" to gate for them in this app.
 */
const BLOCKED_VENDOR_ROLES = ["FIELD_EXECUTIVE", "CALLER"];

/**
 * Published, mandatory policies currently targeted at this vendor user that
 * they haven't attested yet. A non-empty result means the portal should
 * redirect them to /portal/sign-required instead of the normal feed.
 */
export async function getBlockingMandatoryPolicies(vendorUserId: string, role: string): Promise<BlockingPolicy[]> {
  if (!BLOCKED_VENDOR_ROLES.includes(role)) return [];

  const memberships = await prisma.audienceMember.findMany({
    where: { vendorUserId, policyVersion: { status: "PUBLISHED", mandatory: true } },
    include: {
      policyVersion: {
        include: {
          policy: { select: { id: true, slug: true, title: true } },
          attestations: { where: { vendorUserId }, select: { id: true } },
        },
      },
    },
  });

  return memberships
    .filter((m) => m.policyVersion.attestations.length === 0)
    .map((m) => ({ policyId: m.policyVersion.policy.id, slug: m.policyVersion.policy.slug, title: m.policyVersion.policy.title }));
}

/**
 * Called at the top of every portal page except /portal/policies/[slug]
 * (where a blocked user needs to actually go sign) and /portal/sign-required
 * itself. Redirects a blocked Field Executive/Caller there instead of
 * letting them into the feed/quiz/starred/search pages.
 */
export async function requirePortalAccess(session: Session): Promise<void> {
  if (session.kind !== "vendor") return;
  const blocking = await getBlockingMandatoryPolicies(session.vendorUserId, session.role);
  if (blocking.length > 0) redirect("/portal/sign-required");
}
