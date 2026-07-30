import { prisma } from "./prisma";
import { queueAndSendNotification } from "./notify";

export class ReviewError extends Error {}

/**
 * Invites employees (by email — must already be Neeti accounts, since
 * reviewing requires logging in) to review a policy version. Existing
 * assignments are left untouched (no duplicate invite/reset on re-add).
 * Each new reviewer gets an email notification with a deep link into the
 * admin policy page — they still have to log in there to actually respond.
 */
export async function addReviewers(params: { tenantId: string; versionId: string; reviewerEmails: string[]; invitedById: string }) {
  const version = await prisma.policyVersion.findFirstOrThrow({
    where: { id: params.versionId, policy: { tenantId: params.tenantId } },
    include: { policy: true },
  });

  const emails = [...new Set(params.reviewerEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const users = await prisma.user.findMany({ where: { tenantId: params.tenantId, email: { in: emails } } });
  const foundEmails = new Set(users.map((u) => u.email.toLowerCase()));
  const unmatched = emails.filter((e) => !foundEmails.has(e));

  const created = [];
  for (const user of users) {
    const existing = await prisma.policyReviewAssignment.findUnique({
      where: { policyVersionId_reviewerId: { policyVersionId: params.versionId, reviewerId: user.id } },
    });
    if (existing) continue;

    const assignment = await prisma.policyReviewAssignment.create({
      data: { policyVersionId: params.versionId, reviewerId: user.id, invitedById: params.invitedById },
    });
    created.push(assignment);

    await queueAndSendNotification({
      tenantId: params.tenantId,
      type: "REVIEW_REQUEST",
      channel: "EMAIL",
      policyVersionId: params.versionId,
      recipientUserId: user.id,
      to: user.email,
      payload: {
        subject: `Review requested: ${version.policy.title}`,
        body: `You've been asked to review "${version.policy.title}" (v${version.versionNumber}). Log in to Neeti to approve or request changes.`,
        deepLink: `/admin/policies/${version.policy.id}`,
      },
    });
  }

  return { created, unmatchedEmails: unmatched };
}

export async function removeReviewer(params: { tenantId: string; assignmentId: string }) {
  const assignment = await prisma.policyReviewAssignment.findFirstOrThrow({
    where: { id: params.assignmentId, policyVersion: { policy: { tenantId: params.tenantId } } },
  });
  await prisma.policyReviewAssignment.delete({ where: { id: assignment.id } });
}

export async function respondToReview(params: {
  tenantId: string;
  versionId: string;
  reviewerId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
  comment?: string;
}) {
  const assignment = await prisma.policyReviewAssignment.findFirst({
    where: { policyVersionId: params.versionId, reviewerId: params.reviewerId, policyVersion: { policy: { tenantId: params.tenantId } } },
  });
  if (!assignment) throw new ReviewError("You are not assigned as a reviewer on this version.");
  if (params.status === "CHANGES_REQUESTED" && !params.comment?.trim()) {
    throw new ReviewError("A comment describing the observation is required when requesting changes.");
  }

  return prisma.policyReviewAssignment.update({
    where: { id: assignment.id },
    data: { status: params.status, comment: params.comment || null, respondedAt: new Date() },
  });
}
