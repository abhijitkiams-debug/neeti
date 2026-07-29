"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { EMPLOYEE_ROLES } from "@/lib/enums";

type Employee = {
  id: string;
  employeeId: string | null;
  email: string;
  name: string;
  role: string;
  department: string | null;
  location: string | null;
  grade: string | null;
  designation: string | null;
  status: string;
  authSource: string;
};

const emptyForm = {
  employeeId: "",
  email: "",
  name: "",
  role: EMPLOYEE_ROLES[3] as string, // EMPLOYEE
  department: "",
  location: "",
  grade: "",
  designation: "",
  password: "",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/employees");
    if (res.ok) setEmployees((await res.json()).employees);
  }

  useEffect(() => {
    load();
  }, []);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.error === "string" ? d.error : "Could not create employee");
      return;
    }
    setForm(emptyForm);
    setOpen(false);
    await load();
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this employee? They will lose access immediately.")) return;
    await fetch(`/api/employees/${id}/deactivate`, { method: "POST" });
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Employees</h1>
        <button onClick={() => setOpen((o) => !o)} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {open ? "Cancel" : "+ Add employee"}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        No AD sync is wired up in this build (see README) — employees are seeded or added manually here.
      </p>

      {open && (
        <form onSubmit={createEmployee} className="mt-4 grid grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input required type="email" placeholder="Work email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input placeholder="Employee ID" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            {EMPLOYEE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input placeholder="Grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
          <input required type="password" minLength={8} placeholder="Initial password (min 8 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="col-span-2 rounded border border-slate-300 px-2 py-1.5 text-sm" />
          {error && <p className="col-span-4 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="col-span-4 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            {saving ? "Creating…" : "Create employee"}
          </button>
        </form>
      )}

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Employee ID</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Department</th>
            <th className="px-4 py-2">Grade</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {employees.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-2 font-medium text-slate-800">{e.name}</td>
              <td className="px-4 py-2 text-slate-600">{e.employeeId ?? "—"}</td>
              <td className="px-4 py-2 text-slate-600">{e.email}</td>
              <td className="px-4 py-2 text-slate-600">{e.role}</td>
              <td className="px-4 py-2 text-slate-600">{e.department ?? "—"}</td>
              <td className="px-4 py-2 text-slate-600">{e.grade ?? "—"}</td>
              <td className="px-4 py-2">
                <Badge status={e.status} />
              </td>
              <td className="px-4 py-2">
                {e.status === "ACTIVE" && (
                  <button onClick={() => deactivate(e.id)} className="text-xs text-red-600 hover:underline">
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                No employees yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
