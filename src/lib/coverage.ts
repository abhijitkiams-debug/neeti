import { prisma } from "./prisma";
import { COLLECTIONS_RECOVERY_CHECKLIST } from "./seed-data/collections-recovery-checklist";
import type { CoverageStatus } from "./enums";

const EXPIRING_WINDOW_DAYS = 30;

export async function seedCollectionsRecoveryTemplate(tenantId: string) {
  const family = await prisma.policyFamily.upsert({
    where: { tenantId_name: { tenantId, name: "Collections" } },
    update: {},
    create: { tenantId, name: "Collections", description: "Collections & Recovery policies" },
  });

  const already = await prisma.coverageChecklistItem.findFirst({
    where: { tenantId, sourceTemplate: "COLLECTIONS_RECOVERY" },
  });
  if (already) return { created: 0 };

  await prisma.coverageChecklistItem.createMany({
    data: COLLECTIONS_RECOVERY_CHECKLIST.map((item) => ({
      tenantId,
      familyId: family.id,
      itemName: item.itemName,
      mandatory: item.mandatory,
      sourceTemplate: "COLLECTIONS_RECOVERY",
    })),
  });
  return { created: COLLECTIONS_RECOVERY_CHECKLIST.length };
}

export async function deriveCoverageStatus(item: {
  statusOverride: string | null;
  linkedPolicyId: string | null;
  reviewDueAt: Date | null;
}): Promise<CoverageStatus> {
  if (item.statusOverride) return item.statusOverride as CoverageStatus;
  if (!item.linkedPolicyId) return "NOT_STARTED";

  const policy = await prisma.policy.findUnique({
    where: { id: item.linkedPolicyId },
    include: { currentVersion: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!policy) return "NOT_STARTED";

  if (item.reviewDueAt && item.reviewDueAt < new Date()) return "OVERDUE_FOR_REVIEW";

  if (policy.currentVersion) {
    if (policy.currentVersion.expiresAt) {
      const daysToExpiry = (policy.currentVersion.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToExpiry <= EXPIRING_WINDOW_DAYS) return "EXPIRING";
    }
    return "PUBLISHED";
  }

  const latest = policy.versions[0];
  if (!latest) return "NOT_STARTED";
  if (latest.status === "IN_REVIEW" || latest.status === "APPROVED") return "IN_REVIEW";
  if (latest.status === "DRAFT" || latest.status === "REJECTED") return "DRAFT";
  return "NOT_STARTED";
}

export async function coveragePercent(tenantId: string) {
  const items = await prisma.coverageChecklistItem.findMany({ where: { tenantId, mandatory: true } });
  if (items.length === 0) return 100;
  const statuses = await Promise.all(items.map(deriveCoverageStatus));
  const published = statuses.filter((s) => s === "PUBLISHED" || s === "EXPIRING").length;
  return Math.round((published / items.length) * 100);
}
