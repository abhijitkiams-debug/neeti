import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visiblePolicyIdsFor } from "@/lib/consumption";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const ids = query ? await visiblePolicyIdsFor(session) : [];
  const results = query
    ? await prisma.policy.findMany({
        where: {
          id: { in: ids },
          OR: [{ title: { contains: query } }, { currentVersion: { contentHtml: { contains: query } } }],
        },
        include: { family: true, currentVersion: true },
      })
    : [];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Search results for &ldquo;{query}&rdquo;</h1>
      <ul className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No matching policies found.</li>}
        {results.map((p) => (
          <li key={p.id}>
            <Link href={`/portal/policies/${p.slug}`} className="block px-4 py-4 hover:bg-slate-50">
              <span className="font-medium text-slate-900">{p.title}</span>
              <p className="mt-0.5 text-xs text-slate-500">{p.family.name}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
