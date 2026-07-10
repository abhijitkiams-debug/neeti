import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/policies", label: "Policies" },
  { href: "/admin/documents", label: "Document Register" },
  { href: "/admin/coverage", label: "Coverage Checklist" },
  { href: "/admin/vendors", label: "Vendor Orgs" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/rbi", label: "RBI Notifications" },
  { href: "/admin/security", label: "Security" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.kind !== "employee" || !["ADMIN", "PUBLISHER", "AUTHOR"].includes(session.role)) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-lg font-semibold text-indigo-700">
              Neeti Admin
            </Link>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{session.role}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/portal" className="text-slate-500 hover:text-slate-800">
              Consumption portal ↗
            </Link>
            <span className="text-slate-600">{session.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <aside className="w-56 shrink-0">
          <nav className="space-y-1 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
