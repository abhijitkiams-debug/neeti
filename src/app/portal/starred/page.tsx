import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionIdentity } from "@/lib/consumption";

export default async function StarredPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { userId, vendorUserId } = sessionIdentity(session);

  const stars = await prisma.star.findMany({
    where: { userId, vendorUserId },
    include: { policy: { include: { family: true, currentVersion: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Starred Policies</h1>
      <ul className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {stars.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">You haven&apos;t starred any policies yet.</li>}
        {stars
          .filter((s) => s.policy.currentVersionId)
          .map((s) => (
            <li key={s.id}>
              <Link href={`/portal/policies/${s.policy.slug}`} className="block px-4 py-4 hover:bg-slate-50">
                <span className="font-medium text-slate-900">{s.policy.title}</span>
                <p className="mt-0.5 text-xs text-slate-500">{s.policy.family.name}</p>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
