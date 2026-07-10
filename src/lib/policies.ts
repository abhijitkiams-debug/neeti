import { prisma } from "./prisma";
import { resolveAudience, type TargetRuleInput } from "./targeting";
import { queueAndSendNotification } from "./notify";
import { writeAuditLog } from "./audit";

export class PolicyStateError extends Error {}

export async function createPolicyWithDraft(params: {
  tenantId: string;
  familyId: string;
  title: string;
  slug: string;
  authorId: string;
  contentHtml: string;
  sourceType: "WYSIWYG" | "DOCX_IMPORT" | "PDF";
  sourceFileUrl?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.policy.create({
      data: { tenantId: params.tenantId, familyId: params.familyId, title: params.title, slug: params.slug },
    });
    const version = await tx.policyVersion.create({
      data: {
        policyId: policy.id,
        versionNumber: 1,
        contentHtml: params.contentHtml,
        sourceType: params.sourceType,
        sourceFileUrl: params.sourceFileUrl,
        status: "DRAFT",
        authorId: params.authorId,
      },
    });
    return { policy, version };
  });
}

/** Starts a new draft version off an existing (usually published) policy. */
export async function createNextDraftVersion(params: { policyId: string; authorId: string; contentHtml: string }) {
  const latest = await prisma.policyVersion.findFirst({
    where: { policyId: params.policyId },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  return prisma.policyVersion.create({
    data: {
      policyId: params.policyId,
      versionNumber,
      contentHtml: params.contentHtml,
      sourceType: "WYSIWYG",
      status: "DRAFT",
      authorId: params.authorId,
    },
  });
}

export async function submitForReview(versionId: string, actorId: string) {
  const version = await prisma.policyVersion.findUniqueOrThrow({ where: { id: versionId } });
  if (!["DRAFT", "REJECTED"].includes(version.status)) {
    throw new PolicyStateError(`Cannot submit a version in status ${version.status}`);
  }
  await prisma.$transaction([
    prisma.policyVersion.update({ where: { id: versionId }, data: { status: "IN_REVIEW" } }),
    prisma.approvalAction.create({ data: { policyVersionId: versionId, actorId, action: "SUBMIT" } }),
  ]);
}

/** Single-level maker-checker: the checker must differ from the maker (author). */
export async function approveVersion(versionId: string, checkerId: string, comment?: string) {
  const version = await prisma.policyVersion.findUniqueOrThrow({ where: { id: versionId } });
  if (version.status !== "IN_REVIEW") throw new PolicyStateError(`Cannot approve a version in status ${version.status}`);
  if (version.authorId === checkerId) throw new PolicyStateError("Maker and checker must be different people");

  await prisma.$transaction([
    prisma.policyVersion.update({
      where: { id: versionId },
      data: { status: "APPROVED", approverId: checkerId, approvalComment: comment },
    }),
    prisma.approvalAction.create({ data: { policyVersionId: versionId, actorId: checkerId, action: "APPROVE", comment } }),
  ]);
}

export async function rejectVersion(versionId: string, checkerId: string, comment: string) {
  const version = await prisma.policyVersion.findUniqueOrThrow({ where: { id: versionId } });
  if (version.status !== "IN_REVIEW") throw new PolicyStateError(`Cannot reject a version in status ${version.status}`);

  await prisma.$transaction([
    prisma.policyVersion.update({
      where: { id: versionId },
      data: { status: "REJECTED", approverId: checkerId, approvalComment: comment },
    }),
    prisma.approvalAction.create({ data: { policyVersionId: versionId, actorId: checkerId, action: "REJECT", comment } }),
  ]);
}

export async function setTargetRules(versionId: string, rules: TargetRuleInput[]) {
  await prisma.$transaction([
    prisma.targetRule.deleteMany({ where: { policyVersionId: versionId } }),
    prisma.targetRule.createMany({
      data: rules.map((r) => ({
        policyVersionId: versionId,
        kind: r.kind,
        attribute: r.attribute ?? null,
        values: JSON.stringify(r.values),
      })),
    }),
  ]);
}

export async function getTargetRules(versionId: string): Promise<TargetRuleInput[]> {
  const rows = await prisma.targetRule.findMany({ where: { policyVersionId: versionId } });
  return rows.map((r) => ({ kind: r.kind as TargetRuleInput["kind"], attribute: r.attribute, values: JSON.parse(r.values) }));
}

export async function previewAudience(tenantId: string, versionId: string) {
  const rules = await getTargetRules(versionId);
  const resolved = await resolveAudience(tenantId, rules);
  return {
    employeeCount: resolved.employeeIds.length,
    vendorCount: resolved.vendorUserIds.length,
    total: resolved.employeeIds.length + resolved.vendorUserIds.length,
  };
}

/**
 * Publishes an approved version: snapshots the resolved audience,
 * flips the policy's currentVersion pointer, expires the previous published
 * version, and fires PUBLISH notifications to every audience member.
 */
export async function publishVersion(params: { tenantId: string; versionId: string; publisherId: string; expiresAt?: Date }) {
  const version = await prisma.policyVersion.findUniqueOrThrow({
    where: { id: params.versionId },
    include: { policy: true },
  });
  if (version.status !== "APPROVED") throw new PolicyStateError(`Cannot publish a version in status ${version.status}`);

  const rules = await getTargetRules(params.versionId);
  const audience = await resolveAudience(params.tenantId, rules);

  await prisma.$transaction(async (tx) => {
    // Publish only ever runs once per version (APPROVED -> PUBLISHED is a
    // one-way transition), so the audience snapshot is guaranteed fresh —
    // no skipDuplicates needed (SQLite's Prisma driver doesn't support it).
    await tx.audienceMember.createMany({
      data: [
        ...audience.employeeIds.map((userId) => ({ policyVersionId: params.versionId, userId })),
        ...audience.vendorUserIds.map((vendorUserId) => ({ policyVersionId: params.versionId, vendorUserId })),
      ],
    });

    await tx.policyVersion.update({
      where: { id: params.versionId },
      data: { status: "PUBLISHED", publishedAt: new Date(), expiresAt: params.expiresAt },
    });

    const previousVersionId = version.policy.currentVersionId;
    await tx.policy.update({ where: { id: version.policyId }, data: { currentVersionId: params.versionId } });

    if (previousVersionId && previousVersionId !== params.versionId) {
      await tx.policyVersion.update({ where: { id: previousVersionId }, data: { status: "EXPIRED" } });
    }
  });

  await notifyAudience({
    tenantId: params.tenantId,
    versionId: params.versionId,
    type: "PUBLISH",
    employeeIds: audience.employeeIds,
    vendorUserIds: audience.vendorUserIds,
  });

  await writeAuditLog({
    tenantId: params.tenantId,
    actorType: "USER",
    actorId: params.publisherId,
    action: "POLICY_PUBLISHED",
    entityType: "PolicyVersion",
    entityId: params.versionId,
    metadata: { policyId: version.policyId, audienceSize: audience.employeeIds.length + audience.vendorUserIds.length },
  });
}

export async function recallVersion(params: { tenantId: string; versionId: string; actorId: string }) {
  const version = await prisma.policyVersion.findUniqueOrThrow({ where: { id: params.versionId } });
  if (version.status !== "PUBLISHED") throw new PolicyStateError("Only a published version can be recalled");

  await prisma.$transaction([
    prisma.policyVersion.update({ where: { id: params.versionId }, data: { status: "RECALLED", recalledAt: new Date() } }),
    prisma.policy.update({ where: { id: version.policyId }, data: { currentVersionId: null } }),
  ]);

  await writeAuditLog({
    tenantId: params.tenantId,
    actorType: "USER",
    actorId: params.actorId,
    action: "POLICY_RECALLED",
    entityType: "PolicyVersion",
    entityId: params.versionId,
    metadata: {},
  });
}

export async function resendAll(params: { tenantId: string; versionId: string }) {
  const members = await prisma.audienceMember.findMany({ where: { policyVersionId: params.versionId } });
  await notifyAudience({
    tenantId: params.tenantId,
    versionId: params.versionId,
    type: "REMINDER",
    employeeIds: members.filter((m) => m.userId).map((m) => m.userId!),
    vendorUserIds: members.filter((m) => m.vendorUserId).map((m) => m.vendorUserId!),
  });
}

export async function remindUnreadOnly(params: { tenantId: string; versionId: string }) {
  const [members, reads] = await Promise.all([
    prisma.audienceMember.findMany({ where: { policyVersionId: params.versionId } }),
    prisma.readReceipt.findMany({ where: { policyVersionId: params.versionId } }),
  ]);
  const readUserIds = new Set(reads.filter((r) => r.userId).map((r) => r.userId));
  const readVendorUserIds = new Set(reads.filter((r) => r.vendorUserId).map((r) => r.vendorUserId));

  const unreadEmployees = members.filter((m) => m.userId && !readUserIds.has(m.userId)).map((m) => m.userId!);
  const unreadVendors = members.filter((m) => m.vendorUserId && !readVendorUserIds.has(m.vendorUserId)).map((m) => m.vendorUserId!);

  await notifyAudience({
    tenantId: params.tenantId,
    versionId: params.versionId,
    type: "REMINDER",
    employeeIds: unreadEmployees,
    vendorUserIds: unreadVendors,
  });

  return { remindedEmployees: unreadEmployees.length, remindedVendors: unreadVendors.length };
}

async function notifyAudience(params: {
  tenantId: string;
  versionId: string;
  type: "PUBLISH" | "REMINDER";
  employeeIds: string[];
  vendorUserIds: string[];
}) {
  const version = await prisma.policyVersion.findUniqueOrThrow({ where: { id: params.versionId }, include: { policy: true } });
  const deepLink = `/policies/${version.policy.slug}`;
  const subject = params.type === "PUBLISH" ? `New policy: ${version.policy.title}` : `Reminder: ${version.policy.title}`;

  const [employees, vendorUsers] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: params.employeeIds } } }),
    prisma.vendorUser.findMany({ where: { id: { in: params.vendorUserIds } } }),
  ]);

  for (const u of employees) {
    await queueAndSendNotification({
      tenantId: params.tenantId,
      type: params.type,
      channel: "EMAIL",
      policyVersionId: params.versionId,
      recipientUserId: u.id,
      to: u.email,
      payload: { subject, body: `${subject}. Open Neeti to review and acknowledge.`, deepLink },
    });
  }

  for (const v of vendorUsers) {
    await queueAndSendNotification({
      tenantId: params.tenantId,
      type: params.type,
      channel: "SMS",
      policyVersionId: params.versionId,
      recipientVendorUserId: v.id,
      to: v.mobile,
      payload: { subject, body: `${subject}. Log in with OTP to review.`, deepLink: `/vendor/login?next=${deepLink}` },
    });
    await queueAndSendNotification({
      tenantId: params.tenantId,
      type: params.type,
      channel: "EMAIL",
      policyVersionId: params.versionId,
      recipientVendorUserId: v.id,
      to: `${v.mobile}@vendor.neeti.local`,
      payload: { subject, body: `${subject}. Log in with OTP to review.`, deepLink: `/vendor/login?next=${deepLink}` },
    });
  }
}

/** Run by a scheduled job (see scripts/expire-policies.ts) to auto-unpublish anything past its expiry. */
export async function autoExpirePastDue(tenantId: string) {
  const due = await prisma.policyVersion.findMany({
    where: { status: "PUBLISHED", expiresAt: { lt: new Date() }, policy: { tenantId } },
    include: { policy: true },
  });
  for (const v of due) {
    await prisma.$transaction([
      prisma.policyVersion.update({ where: { id: v.id }, data: { status: "EXPIRED" } }),
      prisma.policy.update({ where: { id: v.policyId }, data: { currentVersionId: null } }),
    ]);
    await writeAuditLog({
      tenantId,
      actorType: "SYSTEM",
      action: "POLICY_AUTO_EXPIRED",
      entityType: "PolicyVersion",
      entityId: v.id,
      metadata: {},
    });
  }
  return due.length;
}
