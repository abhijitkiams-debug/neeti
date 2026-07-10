import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { coveragePercent } from "@/lib/coverage";
import { getPendingConsent } from "@/lib/consent";
import { getExpiringSoon } from "@/lib/policies";
import { daysUntil } from "@/lib/dates";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || session.kind !== "employee") redirect("/login");
  const tenantId = session.tenantId;

  const [
    totalPolicies,
    publishedPolicies,
    pendingApprovals,
    totalEmployees,
    totalVendorUsers,
    activeVendorOrgs,
    coverage,
    recentPolicies,
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
    prisma.policy.findMany({ where: { tenantId }, include: { family: true, currentVersion: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
    getPendingConsent(tenantId),
    getExpiringSoon(tenantId, 30),
  ]);

  const latestRbi = await prisma.rbiCircular.findMany({ orderBy: { scrapedAt: "desc" }, take: 3 });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Admin Dashboard</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total policies" value={totalPolicies} />
        <StatCard label="Published" value={publishedPolicies} accent="text-emerald-600" />
        <StatCard label="Pending approval" value={pendingApprovals} accent="text-amber-600" />
        <StatCard label="Mandatory coverage %" value={`${coverage}%`} accent={coverage >= 80 ? "text-emerald-600" : "text-red-600"} />
        <Link href="/admin/consent-pending" className="rounded-lg border border-slate-200 bg-white p-4 hover:border-red-300 hover:bg-red-50">
          <p className="text-2xl font-semibold text-red-600">{pendingConsent.length}</p>
          <p className="mt-1 text-xs text-slate-500">Pending consent — click to view →</p>
        </Link>
        <StatCard label="Active employees" value={totalEmployees} />
        <StatCard label="Active vendor users" value={totalVendorUsers} />
        <StatCard label="Active vendor orgs" value={activeVendorOrgs} />
        <Link href="/admin/coverage" className="flex flex-col justify-center rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
          View coverage checklist →
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Expiring soon (next 30 days)</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {expiringSoon.map((e) => (
              <li key={e.versionId}>
                <Link href={`/admin/policies/${e.policyId}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <span>
                    <span className="font-medium text-slate-900">{e.title}</span>
                    <span className="ml-2 text-xs text-slate-500">{e.familyName}</span>
                  </span>
                  <span className={`text-xs font-medium ${e.daysRemaining <= 7 ? "text-red-600" : "text-amber-600"}`}>
                    {e.daysRemaining <= 0 ? "Expires today" : `${e.daysRemaining}d left`}
                  </span>
                </Link>
              </li>
            ))}
            {expiringSoon.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Nothing expiring soon.</li>}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recently updated policies</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {recentPolicies.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/policies/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <span className="font-medium text-slate-900">{p.title}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {p.family.name}
                    {p.currentVersion && <Badge status={p.currentVersion.status} />}
                  </span>
                </Link>
              </li>
            ))}
            {recentPolicies.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No policies yet.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Latest RBI notifications</h2>
          <Link href="/admin/rbi" className="text-xs text-indigo-600 hover:underline">
            View all →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {latestRbi.map((c) => {
            const tags = JSON.parse(c.tags) as string[];
            const daysLeft = daysUntil(c.implementationDeadline);
            return (
              <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                    {c.title}
                  </a>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {c.publishedDate ? new Date(c.publishedDate).toLocaleDateString() : "Undated"} ·{" "}
                    {tags.map((t) => (
                      <span key={t} className="mr-1 rounded-full bg-slate-100 px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {c.implementationDeadline ? (
                    <span className={`text-xs font-medium ${daysLeft !== null && daysLeft <= 14 ? "text-red-600" : "text-amber-600"}`}>
                      Implement by {new Date(c.implementationDeadline).toLocaleDateString()}
                      {daysLeft !== null && daysLeft >= 0 ? ` (${daysLeft}d left)` : daysLeft !== null ? " (overdue)" : ""}
                    </span>
                  ) : (
                    <Link href="/admin/rbi" className="text-xs text-slate-400 hover:text-indigo-600 hover:underline">
                      Set deadline →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
          {latestRbi.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              No RBI notifications scraped yet — visit{" "}
              <Link href="/admin/rbi" className="text-indigo-600 hover:underline">
                RBI Notifications
              </Link>{" "}
              and click &quot;Scrape now&quot;.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
