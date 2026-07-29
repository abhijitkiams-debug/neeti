import Link from "next/link";

const CARDS = [
  { href: "/admin/security", title: "Security", description: "IP allow-listing for the admin console, audit log integrity verification." },
  { href: "/admin/employee-orgs", title: "Employee Orgs", description: "Manage the catalog of internal business units/departments." },
  { href: "/admin/vendors", title: "Vendor Orgs", description: "Manage vendor/agency organizations and their users." },
  { href: "/admin/employees", title: "Employees", description: "Add employees manually and manage their access." },
];

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Tenant-wide configuration: security, and the identity catalogs used across the platform.</p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:bg-indigo-50">
            <p className="font-medium text-slate-900">{c.title}</p>
            <p className="mt-1 text-sm text-slate-500">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
