import { prisma } from "./prisma";
import type { TargetKind } from "./enums";

export type TargetRuleInput = {
  kind: TargetKind;
  attribute?: string | null;
  values: string[];
};

export type ResolvedAudience = {
  employeeIds: string[];
  vendorUserIds: string[];
};

/**
 * Resolves a set of targeting rules into concrete employee/vendor-user ids.
 * Rules are OR'd together (matching any rule includes the person); within
 * an attribute rule, listed values are also OR'd.
 */
export async function resolveAudience(tenantId: string, rules: TargetRuleInput[]): Promise<ResolvedAudience> {
  const employeeIds = new Set<string>();
  const vendorUserIds = new Set<string>();

  for (const rule of rules) {
    if (rule.kind === "EMPLOYEE_ATTRIBUTE" && rule.attribute) {
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
          [rule.attribute]: { in: rule.values },
        },
        select: { id: true },
      });
      users.forEach((u) => employeeIds.add(u.id));
    }

    if (rule.kind === "VENDOR_ATTRIBUTE" && rule.attribute) {
      if (rule.attribute === "vendorOrg") {
        const vendorUsers = await prisma.vendorUser.findMany({
          where: { tenantId, status: "ACTIVE", vendorOrgId: { in: rule.values } },
          select: { id: true },
        });
        vendorUsers.forEach((v) => vendorUserIds.add(v.id));
      } else if (rule.attribute === "category" || rule.attribute === "region") {
        const orgs = await prisma.vendorOrg.findMany({
          where: { tenantId, status: "ACTIVE", [rule.attribute]: { in: rule.values } },
          select: { id: true },
        });
        const vendorUsers = await prisma.vendorUser.findMany({
          where: { tenantId, status: "ACTIVE", vendorOrgId: { in: orgs.map((o) => o.id) } },
          select: { id: true },
        });
        vendorUsers.forEach((v) => vendorUserIds.add(v.id));
      } else if (rule.attribute === "role" || rule.attribute === "geography") {
        const vendorUsers = await prisma.vendorUser.findMany({
          where: { tenantId, status: "ACTIVE", [rule.attribute]: { in: rule.values } },
          select: { id: true },
        });
        vendorUsers.forEach((v) => vendorUserIds.add(v.id));
      }
    }

    if (rule.kind === "NAMED_EMPLOYEE" || rule.kind === "CUSTOM_LIST_EMPLOYEE") {
      const users = await prisma.user.findMany({
        where: { tenantId, status: "ACTIVE", id: { in: rule.values } },
        select: { id: true },
      });
      users.forEach((u) => employeeIds.add(u.id));
    }

    if (rule.kind === "NAMED_VENDOR_USER" || rule.kind === "CUSTOM_LIST_VENDOR") {
      const vendorUsers = await prisma.vendorUser.findMany({
        where: { tenantId, status: "ACTIVE", id: { in: rule.values } },
        select: { id: true },
      });
      vendorUsers.forEach((v) => vendorUserIds.add(v.id));
    }
  }

  return { employeeIds: [...employeeIds], vendorUserIds: [...vendorUserIds] };
}
