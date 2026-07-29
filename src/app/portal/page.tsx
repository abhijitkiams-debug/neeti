import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visiblePolicyIdsFor, sessionIdentity } from "@/lib/consumption";
import { requirePortalAccess } from "@/lib/gating";

export default async function PortalFeedPage({ searchParams }: { searchParams: Promise<{ familyId?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  await requirePortalAccess(session);
  const { familyId } = await searchParams;

  const ids = await visiblePolicyIdsFor(session);
  const policies = await prisma.policy.findMany({
    where: { id: { in: ids }, familyId },
    include: { family: true, currentVersion: true },
  });
  policies.sort((a, b) => (b.currentVersion?.publishedAt?.getTime() ?? 0) - (a.currentVersion?.publishedAt?.getTime() ?? 0));

  const { userId, vendorUserId } = sessionIdentity(session);
  const versionIds = policies.map((p) => p.currentVersionId).filter((x): x is string => !!x);
  const reads = await prisma.readReceipt.findMany({ where: { policyVersionId: { in: versionIds }, userId, vendorUserId } });
  const readVersionIds = new Set(reads.map((r) => r.policyVersionId));

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Policy Feed</h1>
      <p className="mt-1 text-sm text-slate-500">Chronological feed of policies published to you.</p>

      <ul className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {policies.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No policies published to you yet.</li>}
        {policies.map((p) => {
          const unread = p.currentVersionId ? !readVersionIds.has(p.currentVersionId) : false;
          return (
            <li key={p.id}>
              <Link href={`/portal/policies/${p.slug}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-label="unread" />}
                    <span className="truncate font-medium text-slate-900">{p.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.family.name} · v{p.currentVersion?.versionNumber} ·{" "}
                    {p.currentVersion?.publishedAt ? new Date(p.currentVersion.publishedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                {unread && <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">Unread</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
