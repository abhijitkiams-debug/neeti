"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type PolicyOption = { id: string; title: string; versions: { id: string; versionNumber: number; status: string }[] };
type Summary = {
  employee: { total: number; read: number; attested: number };
  vendor: { total: number; read: number; attested: number; byOrg: { vendorOrgId: string; orgName: string; total: number; read: number; attested: number }[] };
};
type QuizReport = { byUser: { name: string; team: string; answered: number; correct: number; accuracy: number }[]; byTeam: { team: string; answered: number; correct: number; accuracy: number }[] };

function ReportsInner() {
  const searchParams = useSearchParams();
  const [policies, setPolicies] = useState<PolicyOption[]>([]);
  const [versionId, setVersionId] = useState(searchParams.get("versionId") ?? "");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [quiz, setQuiz] = useState<QuizReport | null>(null);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((d) => setPolicies(d.policies));
    fetch("/api/reports/quiz")
      .then((r) => r.json())
      .then(setQuiz);
  }, []);

  useEffect(() => {
    if (!versionId) {
      setSummary(null);
      return;
    }
    fetch(`/api/reports/policy-version/${versionId}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary);
  }, [versionId]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Reports</h1>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Attestation dashboard</h2>
        <select value={versionId} onChange={(e) => setVersionId(e.target.value)} className="mt-2 rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Select a policy version…</option>
          {policies.map((p) =>
            p.versions.map((v) => (
              <option key={v.id} value={v.id}>
                {p.title} — v{v.versionNumber} ({v.status})
              </option>
            ))
          )}
        </select>

        {summary && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Employees</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {summary.employee.read}/{summary.employee.total} read · {summary.employee.attested}/{summary.employee.total} attested
                </p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase text-slate-500">Vendor users</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {summary.vendor.read}/{summary.vendor.total} read · {summary.vendor.attested}/{summary.vendor.total} attested
                </p>
              </div>
            </div>

            {summary.vendor.byOrg.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Per vendor org</p>
                <table className="mt-1 w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {summary.vendor.byOrg.map((o) => (
                      <tr key={o.vendorOrgId}>
                        <td className="py-1.5 text-slate-700">{o.orgName}</td>
                        <td className="py-1.5 text-slate-500">
                          {o.read}/{o.total} read
                        </td>
                        <td className="py-1.5 text-slate-500">
                          {o.attested}/{o.total} attested
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <a href={`/api/reports/policy-version/${versionId}/export`} className="inline-block rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Export CSV
            </a>
          </div>
        )}
      </div>

      {quiz && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Quiz scores by team</h2>
            <table className="mt-2 w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {quiz.byTeam.map((t) => (
                  <tr key={t.team}>
                    <td className="py-1.5 text-slate-700">{t.team}</td>
                    <td className="py-1.5 text-right text-slate-500">
                      {t.correct}/{t.answered} ({t.accuracy}%)
                    </td>
                  </tr>
                ))}
                {quiz.byTeam.length === 0 && (
                  <tr>
                    <td className="py-4 text-center text-slate-500">No quiz activity yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Quiz scores by user</h2>
            <table className="mt-2 w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {quiz.byUser.map((u, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-slate-700">
                      {u.name} <span className="text-xs text-slate-400">({u.team})</span>
                    </td>
                    <td className="py-1.5 text-right text-slate-500">
                      {u.correct}/{u.answered} ({u.accuracy}%)
                    </td>
                  </tr>
                ))}
                {quiz.byUser.length === 0 && (
                  <tr>
                    <td className="py-4 text-center text-slate-500">No quiz activity yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <ReportsInner />
    </Suspense>
  );
}
