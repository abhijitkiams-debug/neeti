"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { VENDOR_ORG_TYPES } from "@/lib/enums";

type VendorOrg = {
  id: string;
  name: string;
  type: string;
  region: string;
  category: string;
  status: string;
  _count: { vendorUsers: number };
};

export default function VendorsPage() {
  const [orgs, setOrgs] = useState<VendorOrg[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(VENDOR_ORG_TYPES[0]);
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/vendor-orgs");
    if (res.ok) setOrgs((await res.json()).orgs);
  }

  useEffect(() => {
    load();
  }, []);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/vendor-orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, region, category }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.error === "string" ? d.error : "Could not create vendor org");
      return;
    }
    setName("");
    setRegion("");
    setCategory("");
    setOpen(false);
    await load();
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this vendor org? All its vendor users will lose access immediately.")) return;
    await fetch(`/api/vendor-orgs/${id}/deactivate`, { method: "POST" });
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Vendor Organizations</h1>
        <button onClick={() => setOpen((o) => !o)} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {open ? "Cancel" : "+ New Vendor Org"}
        </button>
      </div>

      {open && (
        <form onSubmit={createOrg} className="mt-4 grid grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            {VENDOR_ORG_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input required placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input required placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          {error && <p className="col-span-4 text-sm text-red-600">{error}</p>}
          <button type="submit" className="col-span-4 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
            Create
          </button>
        </form>
      )}

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Region</th>
            <th className="px-4 py-2">Category</th>
            <th className="px-4 py-2">Users</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orgs.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/admin/vendors/${o.id}`} className="font-medium text-indigo-700 hover:underline">
                  {o.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{o.type}</td>
              <td className="px-4 py-3 text-slate-600">{o.region}</td>
              <td className="px-4 py-3 text-slate-600">{o.category}</td>
              <td className="px-4 py-3 text-slate-600">{o._count.vendorUsers}</td>
              <td className="px-4 py-3">
                <Badge status={o.status} />
              </td>
              <td className="px-4 py-3">
                {o.status === "ACTIVE" && (
                  <button onClick={() => deactivate(o.id)} className="text-xs text-red-600 hover:underline">
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
          {orgs.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No vendor organizations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
