"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";

type LogRow = {
  id: string;
  versionNumber: number;
  name: string;
  type: "Employee" | "Vendor";
  agencyName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  browser: string;
  os: string;
  accessedAt: string;
};

export default function AccessLogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  useEffect(() => {
    fetch(`/api/admin/policies/${id}/access-logs`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs));
  }, [id]);

  return (
    <div>
      <Link href={`/admin/policies/${id}`} className="text-sm text-indigo-600 hover:underline">
        ← Back to policy
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Access Logs</h1>
      <p className="mt-1 text-sm text-slate-500">Every webview open across all versions, with request-level technical detail. Most recent 200 shown.</p>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Accessed at</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Agency</th>
            <th className="px-4 py-2">Version</th>
            <th className="px-4 py-2">IP address</th>
            <th className="px-4 py-2">Browser / OS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs?.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(l.accessedAt).toLocaleString()}</td>
              <td className="px-4 py-2 font-medium text-slate-800">{l.name}</td>
              <td className="px-4 py-2 text-slate-600">{l.type}</td>
              <td className="px-4 py-2 text-slate-600">{l.agencyName ?? "—"}</td>
              <td className="px-4 py-2 text-slate-600">v{l.versionNumber}</td>
              <td className="px-4 py-2 text-slate-600 font-mono text-xs">{l.ipAddress ?? "—"}</td>
              <td className="px-4 py-2 text-slate-600" title={l.userAgent ?? ""}>
                {l.browser} / {l.os}
              </td>
            </tr>
          ))}
          {logs?.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No access recorded yet.
              </td>
            </tr>
          )}
          {logs === null && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                Loading…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
