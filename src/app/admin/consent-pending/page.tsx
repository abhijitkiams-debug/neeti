import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getPendingConsent } from "@/lib/consent";
import { Badge } from "@/components/Badge";

export default async function ConsentPendingPage() {
  const session = await getSession();
  if (!session || session.kind !== "employee") redirect("/login");

  const rows = await getPendingConsent(session.tenantId);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Consent Pending</h1>
      <p className="mt-1 text-sm text-slate-500">
        Everyone currently targeted by a published policy who has not yet attested — {rows.length} total.
      </p>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Agency</th>
            <th className="px-4 py-2">Document</th>
            <th className="px-4 py-2">Family</th>
            <th className="px-4 py-2">Pending since</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.audienceMemberId} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
              <td className="px-4 py-3">
                <Badge status={r.type} />
              </td>
              <td className="px-4 py-3 text-slate-600">{r.agencyName ?? "—"}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/policies/${r.policyId}`} className="text-indigo-700 hover:underline">
                  {r.documentTitle}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{r.familyName}</td>
              <td className="px-4 py-3 text-slate-500">{new Date(r.sinceDate).toLocaleDateString()}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No pending consent — everyone targeted has attested.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
