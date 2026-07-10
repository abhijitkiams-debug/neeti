"use client";

import { useEffect, useState, use as usePromise } from "react";
import { Badge } from "@/components/Badge";

type VendorUser = { id: string; name: string; mobile: string; role: string; geography: string | null; status: string };
type UploadBatch = { id: string; fileName: string; totalRows: number; successCount: number; errorCount: number; errorLog: string; createdAt: string };
type Org = { id: string; name: string; type: string; region: string; category: string; status: string; vendorUsers: VendorUser[]; uploadBatches: UploadBatch[] };

export default function VendorOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [org, setOrg] = useState<Org | null>(null);
  const [uploadResult, setUploadResult] = useState<{ successCount: number; errors: { row: number; reason: string }[] } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await fetch(`/api/vendor-orgs/${id}`);
    if (res.ok) setOrg((await res.json()).org);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function upload(file: File) {
    setUploading(true);
    setUploadResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/vendor-orgs/${id}/users/bulk-upload`, { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      const d = await res.json();
      setUploadResult({ successCount: d.successCount, errors: d.errors });
      await load();
    }
  }

  async function deactivateUser(userId: string) {
    await fetch(`/api/vendor-users/${userId}/deactivate`, { method: "POST" });
    await load();
  }

  if (!org) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{org.name}</h1>
        <Badge status={org.status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {org.type} · {org.region} · {org.category}
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-4">
        <p className="text-sm font-medium text-slate-700">Bulk upload vendor users</p>
        <p className="mt-1 text-xs text-slate-500">CSV or XLSX with columns: name, mobile, role (VENDOR_ADMIN/VENDOR_USER), geography.</p>
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={uploading}
          className="mt-2 text-sm"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        {uploadResult && (
          <div className="mt-3 text-sm">
            <p className="text-emerald-700">{uploadResult.successCount} row(s) imported successfully.</p>
            {uploadResult.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-red-600">
                {uploadResult.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-900">Vendor users ({org.vendorUsers.length})</h2>
      <table className="mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Mobile</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Geography</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {org.vendorUsers.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2">{u.name}</td>
              <td className="px-4 py-2 text-slate-600">{u.mobile}</td>
              <td className="px-4 py-2 text-slate-600">{u.role}</td>
              <td className="px-4 py-2 text-slate-600">{u.geography ?? "—"}</td>
              <td className="px-4 py-2">
                <Badge status={u.status} />
              </td>
              <td className="px-4 py-2">
                {u.status === "ACTIVE" && (
                  <button onClick={() => deactivateUser(u.id)} className="text-xs text-red-600 hover:underline">
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
          {org.vendorUsers.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                No vendor users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
