"use client";

import { useEffect, useState } from "react";

type Reviewer = {
  id: string;
  status: string;
  comment: string | null;
  respondedAt: string | null;
  reviewer: { id: string; name: string; email: string };
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  APPROVED: "bg-emerald-100 text-emerald-700",
  CHANGES_REQUESTED: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
};

export function ReviewersPanel({ policyId, versionId, currentUserId, canManage }: { policyId: string; versionId: string; currentUserId: string; canManage: boolean }) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");

  async function load() {
    const res = await fetch(`/api/policies/${policyId}/versions/${versionId}/reviewers`);
    if (res.ok) setReviewers((await res.json()).reviewers);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  async function addReviewers(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const list = emails.split(",").map((e) => e.trim()).filter(Boolean);
    const res = await fetch(`/api/policies/${policyId}/versions/${versionId}/reviewers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: list }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.error === "string" ? d.error : "Could not add reviewers");
      return;
    }
    const d = await res.json();
    if (d.unmatchedEmails?.length) {
      setError(`No Neeti account found for: ${d.unmatchedEmails.join(", ")} — reviewers must already have an account.`);
    }
    setEmails("");
    setOpen(false);
    await load();
  }

  async function removeReviewer(assignmentId: string) {
    await fetch(`/api/policies/${policyId}/versions/${versionId}/reviewers/${assignmentId}`, { method: "DELETE" });
    await load();
  }

  async function respond(status: "APPROVED" | "CHANGES_REQUESTED") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/policies/${policyId}/versions/${versionId}/reviewers/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comment: comment || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.error === "string" ? d.error : "Could not record your review");
      return;
    }
    setComment("");
    await load();
  }

  const myAssignment = reviewers.find((r) => r.reviewer.id === currentUserId);
  const respondedCount = reviewers.filter((r) => r.status !== "PENDING").length;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Review tracker ({respondedCount} / {reviewers.length} responded)
        </h2>
        {canManage && (
          <button onClick={() => setOpen((o) => !o)} className="text-sm text-indigo-600 hover:underline">
            {open ? "Close" : "+ Add reviewers"}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Advisory sign-off from named reviewers — separate from the maker-checker approval step above. Reviewers must log in to respond.
      </p>

      {error && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}

      <ul className="mt-3 space-y-2">
        {reviewers.map((r) => (
          <li key={r.id} className={`rounded-md p-3 text-sm ${r.status === "CHANGES_REQUESTED" ? "bg-red-50" : "bg-slate-50"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-medium text-slate-800">{r.reviewer.name}</span>
                <span className="ml-2 text-xs text-slate-500">{r.reviewer.email}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                {canManage && (
                  <button onClick={() => removeReviewer(r.id)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                )}
              </div>
            </div>
            {r.status === "CHANGES_REQUESTED" && r.comment && (
              <p className="mt-2 rounded border border-red-200 bg-white px-2 py-1.5 text-xs text-red-800">
                <strong>Observation:</strong> {r.comment}
              </p>
            )}
            {r.status === "APPROVED" && r.comment && <p className="mt-2 text-xs text-emerald-700">{r.comment}</p>}
          </li>
        ))}
        {reviewers.length === 0 && <li className="text-sm text-slate-500">No reviewers added yet.</li>}
      </ul>

      {open && canManage && (
        <form onSubmit={addReviewers} className="mt-4 space-y-2 border-t border-slate-200 pt-4">
          <label className="block text-xs font-medium text-slate-600">Reviewer emails (comma-separated, must already have a Neeti account)</label>
          <input
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="publisher@acme.test, author@acme.test"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
            Send review requests
          </button>
        </form>
      )}

      {myAssignment && myAssignment.status === "PENDING" && (
        <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-sm font-medium text-indigo-800">You&apos;ve been asked to review this version.</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Observation (required if requesting changes)"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => respond("APPROVED")} disabled={busy} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
              Approve
            </button>
            <button onClick={() => respond("CHANGES_REQUESTED")} disabled={busy} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60">
              Request changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
