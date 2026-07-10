import { prisma } from "./prisma";
import { sha256 } from "./hash";

/**
 * Tamper-evident audit trail: each row's hash covers its own fields plus
 * the previous row's hash, forming a chain per tenant. Any row edited or
 * deleted after the fact breaks the chain for every row after it, which
 * a periodic verify job (verifyAuditChain) can detect.
 */
export async function writeAuditLog(params: {
  tenantId: string;
  actorType: "USER" | "VENDOR_USER" | "SYSTEM";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const last = await prisma.auditLog.findFirst({
    where: { tenantId: params.tenantId },
    orderBy: { createdAt: "desc" },
  });
  const prevHash = last?.hash ?? "GENESIS";
  const metadataJson = JSON.stringify(params.metadata ?? {});
  const hash = sha256(
    [prevHash, params.tenantId, params.actorType, params.actorId ?? "", params.action, params.entityType, params.entityId, metadataJson].join("|")
  );

  return prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      actorType: params.actorType,
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: metadataJson,
      prevHash,
      hash,
    },
  });
}

export async function verifyAuditChain(tenantId: string) {
  const rows = await prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  let prevHash = "GENESIS";
  for (const row of rows) {
    const expected = sha256(
      [prevHash, row.tenantId, row.actorType, row.actorId ?? "", row.action, row.entityType, row.entityId, row.metadata].join("|")
    );
    if (expected !== row.hash || row.prevHash !== prevHash) {
      return { valid: false, brokenAt: row.id };
    }
    prevHash = row.hash;
  }
  return { valid: true as const };
}
