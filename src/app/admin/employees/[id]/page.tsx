"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";

type Item = { policyId: string; policyTitle: string; family: string; versionNumber: number; publishedAt: string | null; read: boolean; attested: boolean };
type Data = { user: { id: string; name: string; email: string; department: string | null }; items: Item[] };

export default function EmployeeSignoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch(`/api/reports/user/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;

  const attestedCount = data.items.filter((i) => i.attested).length;
  const percent = data.items.length === 0 ? 100 : Math.round((attestedCount / data.items.length) * 100);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/employees" className="text-xs text-indigo-600 hover:underline">
        ← Employees
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{data.user.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.user.email} · {data.user.department ?? "No department"}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-semibold ${percent === 100 ? "text-emerald-600" : percent >= 50 ? "text-amber-600" : "text-red-600"}`}>{percent}%</p>
          <p className="text-xs text-slate-500">
            {attestedCount} / {data.items.length} signed
          </p>
        </div>
      </div>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Policy</th>
            <th className="px-4 py-2">Family</th>
            <th className="px-4 py-2">Version</th>
            <th className="px-4 py-2">Read</th>
            <th className="px-4 py-2">Signed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.items.map((i) => (
            <tr key={`${i.policyId}-${i.versionNumber}`}>
              <td className="px-4 py-2">
                <Link href={`/admin/policies/${i.policyId}`} className="font-medium text-indigo-700 hover:underline">
                  {i.policyTitle}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-600">{i.family}</td>
              <td className="px-4 py-2 text-slate-600">v{i.versionNumber}</td>
              <td className="px-4 py-2">{i.read ? "✓" : <span className="text-slate-400">—</span>}</td>
              <td className="px-4 py-2">
                {i.attested ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Signed</span>
                ) : (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Not signed</span>
                )}
              </td>
            </tr>
          ))}
          {data.items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                No policies currently apply to this employee.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
