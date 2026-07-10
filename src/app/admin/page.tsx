import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { coveragePercent } from "@/lib/coverage";
import { StatCard } from "@/components/StatCard";

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || session.kind !== "employee") redirect("/login");
  const tenantId = session.tenantId;

  const [totalPolicies, publishedPolicies, pendingApprovals, totalEmployees, totalVendorUsers, activeVendorOrgs, coverage, recentPolicies] =
    await Promise.all([
      prisma.policy.count({ where: { tenantId } }),
      prisma.policy.count({ where: { tenantId, currentVersionId: { not: null } } }),
      prisma.policyVersion.count({ where: { status: "IN_REVIEW", policy: { tenantId } } }),
      prisma.user.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.vendorUser.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.vendorOrg.count({ where: { tenantId, status: "ACTIVE" } }),
      coveragePercent(tenantId),
      prisma.policy.findMany({ where: { tenantId }, include: { family: true, currentVersion: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
    ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Admin Dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total policies" value={totalPolicies} />
        <StatCard label="Published" value={publishedPolicies} accent="text-emerald-600" />
        <StatCard label="Pending approval" value={pendingApprovals} accent="text-amber-600" />
        <StatCard label="Mandatory coverage %" value={`${coverage}%`} accent={coverage >= 80 ? "text-emerald-600" : "text-red-600"} />
        <StatCard label="Active employees" value={totalEmployees} />
        <StatCard label="Active vendor users" value={totalVendorUsers} />
        <StatCard label="Active vendor orgs" value={activeVendorOrgs} />
        <Link href="/admin/coverage" className="flex flex-col justify-center rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
          View coverage checklist →
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-900">Recently updated policies</h2>
      <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {recentPolicies.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/policies/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
              <span className="font-medium text-slate-900">{p.title}</span>
              <span className="text-xs text-slate-500">{p.family.name}</span>
            </Link>
          </li>
        ))}
        {recentPolicies.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No policies yet.</li>}
      </ul>
    </div>
  );
}
