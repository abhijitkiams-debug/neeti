import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { coveragePercent } from "@/lib/coverage";
import { getPendingConsent } from "@/lib/consent";
import { getExpiringSoon } from "@/lib/policies";

export async function GET() {
  try {
    const session = await requireEmployee(["ADMIN", "PUBLISHER"]);
    const tenantId = session.tenantId;

    const [
      totalPolicies,
      publishedPolicies,
      pendingApprovals,
      totalEmployees,
      totalVendorUsers,
      activeVendorOrgs,
      coverage,
      pendingConsent,
      expiringSoon,
    ] = await Promise.all([
      prisma.policy.count({ where: { tenantId } }),
      prisma.policy.count({ where: { tenantId, currentVersionId: { not: null } } }),
      prisma.policyVersion.count({ where: { status: "IN_REVIEW", policy: { tenantId } } }),
      prisma.user.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.vendorUser.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.vendorOrg.count({ where: { tenantId, status: "ACTIVE" } }),
      coveragePercent(tenantId),
      getPendingConsent(tenantId),
      getExpiringSoon(tenantId, 30),
    ]);

    return NextResponse.json({
      totalPolicies,
      publishedPolicies,
      pendingApprovals,
      totalEmployees,
      totalVendorUsers,
      activeVendorOrgs,
      coveragePercent: coverage,
      pendingConsentCount: pendingConsent.length,
      expiringSoonCount: expiringSoon.length,
    });
  } catch (e) {
    return apiError(e);
  }
}
