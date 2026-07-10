import { prisma } from "./prisma";

export type PendingConsentRow = {
  audienceMemberId: string;
  name: string;
  type: "Employee" | "Vendor";
  agencyName: string | null;
  policyId: string;
  documentTitle: string;
  familyName: string;
  sinceDate: Date;
};

/** Audience members of currently-published versions who have not yet attested. */
export async function getPendingConsent(tenantId: string): Promise<PendingConsentRow[]> {
  const members = await prisma.audienceMember.findMany({
    where: {
      policyVersion: { status: "PUBLISHED", policy: { tenantId } },
    },
    include: {
      user: true,
      vendorUser: { include: { vendorOrg: true } },
      policyVersion: { include: { policy: { include: { family: true } }, attestations: true } },
    },
  });

  const rows: PendingConsentRow[] = [];
  for (const m of members) {
    const attested = m.policyVersion.attestations.some(
      (a) => (m.userId && a.userId === m.userId) || (m.vendorUserId && a.vendorUserId === m.vendorUserId)
    );
    if (attested) continue;

    if (m.userId && m.user) {
      rows.push({
        audienceMemberId: m.id,
        name: m.user.name,
        type: "Employee",
        agencyName: null,
        policyId: m.policyVersion.policyId,
        documentTitle: m.policyVersion.policy.title,
        familyName: m.policyVersion.policy.family.name,
        sinceDate: m.addedAt,
      });
    } else if (m.vendorUserId && m.vendorUser) {
      rows.push({
        audienceMemberId: m.id,
        name: m.vendorUser.name,
        type: "Vendor",
        agencyName: m.vendorUser.vendorOrg.name,
        policyId: m.policyVersion.policyId,
        documentTitle: m.policyVersion.policy.title,
        familyName: m.policyVersion.policy.family.name,
        sinceDate: m.addedAt,
      });
    }
  }

  return rows.sort((a, b) => a.sinceDate.getTime() - b.sinceDate.getTime());
}
