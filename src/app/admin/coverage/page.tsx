"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";

type Item = {
  id: string;
  itemName: string;
  mandatory: boolean;
  status: string;
  family: { name: string } | null;
  linkedPolicy: { id: string; title: string } | null;
};

export default function CoveragePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [coveragePercent, setCoveragePercent] = useState(0);
  const [policies, setPolicies] = useState<{ id: string; title: string }[]>([]);
  const [newItem, setNewItem] = useState("");

  async function load() {
    const res = await fetch("/api/coverage");
    if (res.ok) {
      const d = await res.json();
      setItems(d.items);
      setCoveragePercent(d.coveragePercent);
    }
    const pRes = await fetch("/api/policies");
    if (pRes.ok) setPolicies((await pRes.json()).policies.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })));
  }

  useEffect(() => {
    load();
  }, []);

  async function seedTemplate() {
    await fetch("/api/coverage/seed", { method: "POST" });
    await load();
  }

  async function linkPolicy(itemId: string, linkedPolicyId: string) {
    await fetch(`/api/coverage/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedPolicyId: linkedPolicyId || null }),
    });
    await load();
  }

  async function addCustomItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    await fetch("/api/coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName: newItem, mandatory: false }),
    });
    setNewItem("");
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Policy Coverage Checklist</h1>
          <p className="mt-1 text-sm text-slate-500">Mandatory items published: {coveragePercent}%</p>
        </div>
        <button onClick={seedTemplate} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Seed Collections & Recovery template
        </button>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-emerald-500" style={{ width: `${coveragePercent}%` }} />
      </div>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2">Family</th>
            <th className="px-4 py-2">Scope</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Linked policy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((it) => (
            <tr key={it.id}>
              <td className="px-4 py-2 font-medium text-slate-800">{it.itemName}</td>
              <td className="px-4 py-2 text-slate-600">{it.family?.name ?? "—"}</td>
              <td className="px-4 py-2">
                <Badge status={it.mandatory ? "Mandatory" : "Recommended"} />
              </td>
              <td className="px-4 py-2">
                <Badge status={it.status} />
              </td>
              <td className="px-4 py-2">
                <select
                  value={it.linkedPolicy?.id ?? ""}
                  onChange={(e) => linkPolicy(it.id, e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="">— none —</option>
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                {it.linkedPolicy && (
                  <Link href={`/admin/policies/${it.linkedPolicy.id}`} className="ml-2 text-xs text-indigo-600 hover:underline">
                    Open →
                  </Link>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                No checklist items yet. Seed the Collections & Recovery template above, or add a custom item below.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form onSubmit={addCustomItem} className="mt-4 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add tenant-specific checklist item…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          Add
        </button>
      </form>
    </div>
  );
}
