import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/Badge";

export default async function AdminPoliciesPage() {
  const session = await getSession();
  if (!session || session.kind !== "employee") redirect("/login");

  const policies = await prisma.policy.findMany({
    where: { tenantId: session.tenantId },
    include: { family: true, currentVersion: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Policies</h1>
        <Link href="/admin/policies/new" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + New Policy
        </Link>
      </div>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Family</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Version</th>
            <th className="px-4 py-2">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {policies.map((p) => {
            const latest = p.versions[0];
            const status = p.currentVersion?.status ?? latest?.status ?? "DRAFT";
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/policies/${p.id}`} className="font-medium text-indigo-700 hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.family.name}</td>
                <td className="px-4 py-3">
                  <Badge status={status} />
                </td>
                <td className="px-4 py-3 text-slate-600">v{latest?.versionNumber ?? 1}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(p.updatedAt).toLocaleDateString()}</td>
              </tr>
            );
          })}
          {policies.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No policies yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
