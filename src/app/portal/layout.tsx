import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/LogoutButton";
import { SearchBox } from "./SearchBox";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const families = await prisma.policyFamily.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { sortOrder: "asc" },
  });

  const displayName = session.name;
  const orgLabel = session.kind === "employee" ? "Employee Portal" : "Vendor Portal";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="text-lg font-semibold text-indigo-700">
              Neeti
            </Link>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{orgLabel}</span>
          </div>
          <SearchBox />
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">{displayName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        <aside className="w-56 shrink-0 space-y-6">
          <nav className="space-y-1 text-sm">
            <Link href="/portal" className="block rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
              Feed
            </Link>
            <Link href="/portal/starred" className="block rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
              Starred
            </Link>
            <Link href="/portal/quiz" className="block rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100">
              Daily Micro-Quiz
            </Link>
          </nav>
          <div>
            <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Folders</h3>
            <nav className="mt-1 space-y-1 text-sm">
              {families.map((f) => (
                <Link
                  key={f.id}
                  href={`/portal?familyId=${f.id}`}
                  className="block rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100"
                >
                  {f.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
