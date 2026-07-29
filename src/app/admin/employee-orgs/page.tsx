"use client";

import { useEffect, useState } from "react";

type EmployeeOrg = { id: string; name: string; description: string | null; createdAt: string };

export default function EmployeeOrgsPage() {
  const [orgs, setOrgs] = useState<EmployeeOrg[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/employee-orgs");
    if (res.ok) setOrgs((await res.json()).orgs);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/employee-orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || undefined }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.error === "string" ? d.error : "Could not create employee org");
      return;
    }
    setName("");
    setDescription("");
    setOpen(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this employee org?")) return;
    await fetch(`/api/employee-orgs/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Employee Orgs</h1>
          <p className="mt-1 text-sm text-slate-500">
            A managed catalog of internal business units/departments — the counterpart to Vendor Orgs. Employees still record their department as
            free text (for backward compatibility with existing targeting); this gives Admins a consistent list to draw from.
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {open ? "Cancel" : "+ New Employee Org"}
        </button>
      </div>

      {open && (
        <form onSubmit={create} className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input required placeholder="Name (e.g. Collections)" value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-2 rounded border border-slate-300 px-2 py-1.5 text-sm" />
          {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
          <button type="submit" className="col-span-3 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
            Create
          </button>
        </form>
      )}

      <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {orgs.map((o) => (
          <li key={o.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{o.name}</p>
              {o.description && <p className="text-xs text-slate-500">{o.description}</p>}
            </div>
            <button onClick={() => remove(o.id)} className="text-xs text-red-600 hover:underline">
              Delete
            </button>
          </li>
        ))}
        {orgs.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No employee orgs yet.</li>}
      </ul>
    </div>
  );
}
