import { prisma } from "./prisma";

export type SignoffItem = {
  policyId: string;
  policyTitle: string;
  family: string;
  versionNumber: number;
  publishedAt: Date | null;
  read: boolean;
  attested: boolean;
};

/** Every policy currently applicable to an employee (via audience targeting), with read/attested status. */
export async function getEmployeeSignoff(userId: string): Promise<SignoffItem[]> {
  const memberships = await prisma.audienceMember.findMany({
    where: { userId },
    include: { policyVersion: { include: { policy: { include: { family: true } } } } },
  });
  const [reads, attestations] = await Promise.all([
    prisma.readReceipt.findMany({ where: { userId } }),
    prisma.attestation.findMany({ where: { userId } }),
  ]);
  return toSignoffItems(memberships, reads, attestations);
}

/** Same as getEmployeeSignoff, for a vendor user. */
export async function getVendorUserSignoff(vendorUserId: string): Promise<SignoffItem[]> {
  const memberships = await prisma.audienceMember.findMany({
    where: { vendorUserId },
    include: { policyVersion: { include: { policy: { include: { family: true } } } } },
  });
  const [reads, attestations] = await Promise.all([
    prisma.readReceipt.findMany({ where: { vendorUserId } }),
    prisma.attestation.findMany({ where: { vendorUserId } }),
  ]);
  return toSignoffItems(memberships, reads, attestations);
}

function toSignoffItems(
  memberships: { policyVersionId: string; policyVersion: { versionNumber: number; publishedAt: Date | null; policy: { id: string; title: string; family: { name: string } } } }[],
  reads: { policyVersionId: string }[],
  attestations: { policyVersionId: string }[]
): SignoffItem[] {
  const readVersionIds = new Set(reads.map((r) => r.policyVersionId));
  const attestedVersionIds = new Set(attestations.map((a) => a.policyVersionId));
  return memberships.map((m) => ({
    policyId: m.policyVersion.policy.id,
    policyTitle: m.policyVersion.policy.title,
    family: m.policyVersion.policy.family.name,
    versionNumber: m.policyVersion.versionNumber,
    publishedAt: m.policyVersion.publishedAt,
    read: readVersionIds.has(m.policyVersionId),
    attested: attestedVersionIds.has(m.policyVersionId),
  }));
}

export function completionPercent(items: { attested: boolean }[]): number {
  if (items.length === 0) return 100;
  return Math.round((items.filter((i) => i.attested).length / items.length) * 100);
}

/** Per-vendor-user sign-off completion, plus the org-wide aggregate, for one vendor org. */
export async function getVendorOrgSignoffSummary(vendorOrgId: string) {
  const vendorUsers = await prisma.vendorUser.findMany({ where: { vendorOrgId, status: "ACTIVE" }, select: { id: true, name: true } });
  const perUser = await Promise.all(
    vendorUsers.map(async (u) => {
      const items = await getVendorUserSignoff(u.id);
      return { vendorUserId: u.id, name: u.name, applicable: items.length, attested: items.filter((i) => i.attested).length, percent: completionPercent(items) };
    })
  );
  const totalApplicable = perUser.reduce((s, u) => s + u.applicable, 0);
  const totalAttested = perUser.reduce((s, u) => s + u.attested, 0);
  return { perUser, totalApplicable, totalAttested, percent: totalApplicable === 0 ? 100 : Math.round((totalAttested / totalApplicable) * 100) };
}

/** Per-employee sign-off completion, plus the tenant-wide aggregate, for internal employees. */
export async function getEmployeeSignoffSummary(tenantId: string) {
  const employees = await prisma.user.findMany({ where: { tenantId, status: "ACTIVE" }, select: { id: true, name: true } });
  const perUser = await Promise.all(
    employees.map(async (u) => {
      const items = await getEmployeeSignoff(u.id);
      return { userId: u.id, name: u.name, applicable: items.length, attested: items.filter((i) => i.attested).length, percent: completionPercent(items) };
    })
  );
  const totalApplicable = perUser.reduce((s, u) => s + u.applicable, 0);
  const totalAttested = perUser.reduce((s, u) => s + u.attested, 0);
  return { perUser, totalApplicable, totalAttested, percent: totalApplicable === 0 ? 100 : Math.round((totalAttested / totalApplicable) * 100) };
}
