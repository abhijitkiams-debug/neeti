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

const DAY_BUCKETS = [
  { label: "Day 1", minDay: 0, maxDay: 1 },
  { label: "Day 2", minDay: 1, maxDay: 2 },
  { label: "Day 3", minDay: 2, maxDay: 3 },
  { label: "Day 4", minDay: 3, maxDay: 4 },
  { label: "Next week", minDay: 4, maxDay: 11 },
  { label: "Next month", minDay: 11, maxDay: 41 },
  { label: "Later", minDay: 41, maxDay: Infinity },
] as const;

/**
 * Full per-document engagement metrics for a policy version — the fields
 * mirror a familiar "policy report" layout: audience reach, unique
 * engagement, and response-button activity, plus a day-bucketed
 * distribution of when people first responded relative to publish date.
 *
 * A note on field mapping: this build's action bar is Sign (Attestation) /
 * Helpful / Not Helpful / Ask a question — "Accept" below is the Sign
 * click count, and Helpful/Not Helpful/Questions are reported directly
 * rather than invented generic "Interested/Understood" buckets that don't
 * correspond to any real control in the UI.
 */
export async function documentEngagementMetrics(versionId: string) {
  const version = await prisma.policyVersion.findUniqueOrThrow({ where: { id: versionId } });

  const [audience, reads, attestations, accessLogs, feedback, questions] = await Promise.all([
    prisma.audienceMember.findMany({ where: { policyVersionId: versionId } }),
    prisma.readReceipt.findMany({ where: { policyVersionId: versionId } }),
    prisma.attestation.findMany({ where: { policyVersionId: versionId } }),
    prisma.accessLog.findMany({ where: { policyVersionId: versionId } }),
    prisma.policyFeedback.findMany({ where: { policyVersionId: versionId } }),
    prisma.policyQuestion.findMany({ where: { policyVersionId: versionId } }),
  ]);

  const identity = (row: { userId?: string | null; vendorUserId?: string | null }) => row.userId ?? `v:${row.vendorUserId}`;

  const audienceIds = new Set(audience.map(identity));
  const readIds = new Set(reads.map(identity));
  const accessIds = new Set(accessLogs.map(identity));
  const respondentIds = new Set([...attestations, ...feedback, ...questions].map(identity));

  const sentTo = audience.length;
  const readBy = readIds.size;
  const yetToRead = Math.max(0, sentTo - readBy);
  const nonFollowersWhoRead = [...accessIds].filter((id) => !audienceIds.has(id)).length;
  const totalUniqueUsers = new Set([...accessIds, ...readIds, ...respondentIds]).size;
  const totalTimesRead = accessLogs.length;
  const publicPageViews = totalTimesRead; // no unauthenticated public-link viewing in this build
  const uniqueRespondents = respondentIds.size;
  const acceptCount = attestations.length;
  const helpfulCount = feedback.filter((f) => f.helpful).length;
  const notHelpfulCount = feedback.filter((f) => !f.helpful).length;
  const questionsCount = questions.length;
  const totalResponseClicks = acceptCount + helpfulCount + notHelpfulCount + questionsCount;

  // First-response day bucketing, relative to publish date.
  const firstResponseAt = new Map<string, Date>();
  const consider = (id: string, at: Date) => {
    const existing = firstResponseAt.get(id);
    if (!existing || at < existing) firstResponseAt.set(id, at);
  };
  attestations.forEach((a) => consider(identity(a), a.signedAt));
  feedback.forEach((f) => consider(identity(f), f.createdAt));
  questions.forEach((q) => consider(identity(q), q.createdAt));

  const bucketCounts = DAY_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  if (version.publishedAt) {
    for (const at of firstResponseAt.values()) {
      const daysSince = (at.getTime() - version.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
      const idx = DAY_BUCKETS.findIndex((b) => daysSince >= b.minDay && daysSince < b.maxDay);
      if (idx >= 0) bucketCounts[idx].count++;
    }
  }
  const totalBucketed = bucketCounts.reduce((s, b) => s + b.count, 0);
  const responseDistribution = bucketCounts.map((b) => ({
    label: b.label,
    count: b.count,
    percent: totalBucketed > 0 ? Math.round((b.count / totalBucketed) * 100) : 0,
  }));

  return {
    sentTo,
    readBy,
    yetToRead,
    nonFollowersWhoRead,
    totalUniqueUsers,
    totalTimesRead,
    publicPageViews,
    uniqueRespondents,
    accept: acceptCount,
    helpful: helpfulCount,
    notHelpful: notHelpfulCount,
    questionsAsked: questionsCount,
    totalResponseClicks,
    responseDistribution,
  };
}
