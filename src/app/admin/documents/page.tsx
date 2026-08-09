"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { formatDate } from "@/lib/dates";

type Doc = {
  id: string;
  title: string;
  family: string;
  status: string;
  versionNumber: number;
  totalVersions: number;
  publishedAt: string | null;
  expiresAt: string | null;
  scope: string;
  updatedAt: string;
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [scopeFilter, setScopeFilter] = useState("");

  useEffect(() => {
    fetch("/api/admin/documents")
      .then((r) => r.json())
      .then((d) => setDocs(d.documents));
  }, []);

  const filtered = scopeFilter ? docs.filter((d) => d.scope === scopeFilter) : docs;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Document Register</h1>
        <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All scopes</option>
          <option value="Mandatory">Mandatory</option>
          <option value="Recommended">Recommended</option>
          <option value="Optional">Optional</option>
        </select>
      </div>
      <p className="mt-1 text-sm text-slate-500">Every policy document with its live status and governance scope, for Admin/Management review.</p>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2">Family</th>
            <th className="px-4 py-2">Scope</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Version</th>
            <th className="px-4 py-2">Published</th>
            <th className="px-4 py-2">Expires</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/admin/policies/${d.id}`} className="font-medium text-indigo-700 hover:underline">
                  {d.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{d.family}</td>
              <td className="px-4 py-3">
                <Badge status={d.scope} />
              </td>
              <td className="px-4 py-3">
                <Badge status={d.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">
                v{d.versionNumber} ({d.totalVersions} total)
              </td>
              <td className="px-4 py-3 text-slate-500">{d.publishedAt ? formatDate(d.publishedAt) : "—"}</td>
              <td className="px-4 py-3 text-slate-500">{d.expiresAt ? formatDate(d.expiresAt) : "—"}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No documents match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
