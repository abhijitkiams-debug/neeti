import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBlockingMandatoryPolicies } from "@/lib/gating";

// Does NOT call requirePortalAccess — that would redirect back here.
// If nothing is actually blocking this session (already signed everything,
// or not a gated role), send them on to the normal feed instead of showing
// an empty gate.
export default async function SignRequiredPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const blocking = session.kind === "vendor" ? await getBlockingMandatoryPolicies(session.vendorUserId, session.role) : [];
  if (blocking.length === 0) redirect("/portal");

  return (
    <div className="max-w-xl">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-900">Sign-off required before you can start work</h1>
        <p className="mt-2 text-sm text-amber-800">
          The following document{blocking.length > 1 ? "s are" : " is"} mandatory and must be signed before you can access the rest of the
          portal.
        </p>
        <ul className="mt-4 space-y-2">
          {blocking.map((b) => (
            <li key={b.policyId} className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-4 py-3">
              <span className="font-medium text-slate-800">{b.title}</span>
              <Link href={`/portal/policies/${b.slug}`} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
                Review & sign →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
