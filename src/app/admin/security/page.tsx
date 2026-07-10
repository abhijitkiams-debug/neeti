"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; cidr: string; label: string | null };

export default function SecurityPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; brokenAt?: string } | null>(null);

  async function load() {
    const res = await fetch("/api/admin/security/ip-allowlist");
    if (res.ok) setEntries((await res.json()).entries);
  }

  useEffect(() => {
    load();
  }, []);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/security/ip-allowlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cidr, label: label || undefined }),
    });
    setCidr("");
    setLabel("");
    await load();
  }

  async function removeEntry(id: string) {
    await fetch(`/api/admin/security/ip-allowlist/${id}`, { method: "DELETE" });
    await load();
  }

  async function verify() {
    const res = await fetch("/api/admin/security/audit-verify");
    setVerifyResult(await res.json());
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Security Baseline</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <ul className="list-disc space-y-1 pl-5">
          <li>TLS 1.2+ enforced at the reverse proxy/load balancer in production.</li>
          <li>AES-256 at rest via the managed database&apos;s disk encryption (Postgres in production).</li>
          <li>Tamper-proof audit log: hash-chained rows — verify below.</li>
          <li>RBAC roles: Admin, Publisher, Author, Employee, Vendor Admin, Vendor User.</li>
          <li>Downloads are disabled by default for vendor users (no export/CSV endpoints are exposed to the vendor role).</li>
          <li>Optional IP allow-listing below applies to the Admin/Publisher console only — never to the consumption portal.</li>
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Admin console IP allow-list</h2>
        <form onSubmit={addEntry} className="mt-3 flex gap-2">
          <input required placeholder="CIDR e.g. 203.0.113.0/24" value={cidr} onChange={(e) => setCidr(e.target.value)} className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="w-40 rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
            Add
          </button>
        </form>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-1.5">
              <span>
                {e.cidr} {e.label && <span className="text-slate-400">({e.label})</span>}
              </span>
              <button onClick={() => removeEntry(e.id)} className="text-xs text-red-600 hover:underline">
                Remove
              </button>
            </li>
          ))}
          {entries.length === 0 && <li className="py-2 text-slate-500">No restrictions — console reachable from any IP.</li>}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Audit log integrity</h2>
        <p className="mt-1 text-xs text-slate-500">Verifies the hash chain across every audit log row for this tenant.</p>
        <button onClick={verify} className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Run verification
        </button>
        {verifyResult && (
          <p className={`mt-2 text-sm ${verifyResult.valid ? "text-emerald-700" : "text-red-700"}`}>
            {verifyResult.valid ? "✓ Chain intact — no tampering detected." : `✗ Chain broken at row ${verifyResult.brokenAt}`}
          </p>
        )}
      </div>
    </div>
  );
}
