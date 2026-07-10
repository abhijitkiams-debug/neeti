import { prisma } from "./prisma";

export async function policyVersionSummary(versionId: string) {
  const [audience, reads, attestations] = await Promise.all([
    prisma.audienceMember.findMany({
      where: { policyVersionId: versionId },
      include: { user: true, vendorUser: { include: { vendorOrg: true } } },
    }),
    prisma.readReceipt.findMany({ where: { policyVersionId: versionId } }),
    prisma.attestation.findMany({ where: { policyVersionId: versionId } }),
  ]);

  const readUserIds = new Set(reads.filter((r) => r.userId).map((r) => r.userId));
  const readVendorUserIds = new Set(reads.filter((r) => r.vendorUserId).map((r) => r.vendorUserId));
  const attestedUserIds = new Set(attestations.filter((a) => a.userId).map((a) => a.userId));
  const attestedVendorUserIds = new Set(attestations.filter((a) => a.vendorUserId).map((a) => a.vendorUserId));

  const employees = audience.filter((a) => a.userId);
  const vendors = audience.filter((a) => a.vendorUserId);

  const perVendorOrg = new Map<string, { orgName: string; total: number; read: number; attested: number }>();
  for (const v of vendors) {
    const org = v.vendorUser!.vendorOrg;
    const bucket = perVendorOrg.get(org.id) ?? { orgName: org.name, total: 0, read: 0, attested: 0 };
    bucket.total++;
    if (readVendorUserIds.has(v.vendorUserId!)) bucket.read++;
    if (attestedVendorUserIds.has(v.vendorUserId!)) bucket.attested++;
    perVendorOrg.set(org.id, bucket);
  }

  return {
    employee: {
      total: employees.length,
      read: employees.filter((e) => readUserIds.has(e.userId!)).length,
      attested: employees.filter((e) => attestedUserIds.has(e.userId!)).length,
    },
    vendor: {
      total: vendors.length,
      read: vendors.filter((v) => readVendorUserIds.has(v.vendorUserId!)).length,
      attested: vendors.filter((v) => attestedVendorUserIds.has(v.vendorUserId!)).length,
      byOrg: [...perVendorOrg.entries()].map(([vendorOrgId, stats]) => ({ vendorOrgId, ...stats })),
    },
    unreadEmployees: employees.filter((e) => !readUserIds.has(e.userId!)).map((e) => e.user!),
    unreadVendorUsers: vendors.filter((v) => !readVendorUserIds.has(v.vendorUserId!)).map((v) => v.vendorUser!),
  };
}

export async function policyVersionExportRows(versionId: string) {
  const audience = await prisma.audienceMember.findMany({
    where: { policyVersionId: versionId },
    include: { user: true, vendorUser: { include: { vendorOrg: true } } },
  });
  const [reads, attestations] = await Promise.all([
    prisma.readReceipt.findMany({ where: { policyVersionId: versionId } }),
    prisma.attestation.findMany({ where: { policyVersionId: versionId } }),
  ]);
  const readByUser = new Map(reads.filter((r) => r.userId).map((r) => [r.userId, r.readAt]));
  const readByVendor = new Map(reads.filter((r) => r.vendorUserId).map((r) => [r.vendorUserId, r.readAt]));
  const attestByUser = new Map(attestations.filter((a) => a.userId).map((a) => [a.userId, a]));
  const attestByVendor = new Map(attestations.filter((a) => a.vendorUserId).map((a) => [a.vendorUserId, a]));

  return audience.map((a) => {
    const isEmployee = !!a.userId;
    const readAt = isEmployee ? readByUser.get(a.userId!) : readByVendor.get(a.vendorUserId!);
    const attestation = isEmployee ? attestByUser.get(a.userId!) : attestByVendor.get(a.vendorUserId!);
    return {
      type: isEmployee ? "Employee" : "Vendor",
      name: isEmployee ? a.user!.name : a.vendorUser!.name,
      identifier: isEmployee ? a.user!.email : a.vendorUser!.mobile,
      org: isEmployee ? a.user!.department ?? "" : a.vendorUser!.vendorOrg.name,
      read: readAt ? "Yes" : "No",
      readAt: readAt ? readAt.toISOString() : "",
      attested: attestation ? "Yes" : "No",
      attestedAt: attestation ? attestation.signedAt.toISOString() : "",
      attestationMethod: attestation?.method ?? "",
    };
  });
}

export function rowsToCsv(rows: Record<string, string>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}
