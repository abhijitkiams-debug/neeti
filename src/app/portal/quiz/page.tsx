import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requirePortalAccess } from "@/lib/gating";
import { QuizClient } from "./QuizClient";

export default async function QuizPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  await requirePortalAccess(session);
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Daily Micro-Quiz</h1>
      <p className="mt-1 text-sm text-slate-500">A handful of quick questions drawn from your assigned policies.</p>
      <QuizClient />
    </div>
  );
}
