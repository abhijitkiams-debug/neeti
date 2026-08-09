"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { formatDate } from "@/lib/dates";

type Question = {
  id: string;
  questionText: string;
  status: string;
  answerText: string | null;
  answeredByName: string | null;
  askedByName: string;
  askedByType: "Employee" | "Vendor";
  agencyName: string | null;
  createdAt: string;
};

export function QuestionsPanel({ policyId }: { policyId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch(`/api/admin/policies/${policyId}/questions`);
    if (res.ok) setQuestions((await res.json()).questions);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyId]);

  async function submitAnswer(id: string) {
    const answerText = drafts[id]?.trim();
    if (!answerText) return;
    await fetch(`/api/admin/questions/${id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerText }),
    });
    await load();
  }

  if (questions.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Questions ({questions.length})</h2>
      <ul className="mt-3 space-y-3">
        {questions.map((q) => (
          <li key={q.id} className="rounded-md bg-slate-50 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-slate-800">{q.questionText}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {q.askedByName} <Badge status={q.askedByType} /> {q.agencyName && <span>· {q.agencyName}</span>} ·{" "}
                  {formatDate(q.createdAt)}
                </p>
              </div>
              <Badge status={q.status} />
            </div>
            {q.status === "ANSWERED" ? (
              <p className="mt-2 rounded bg-white px-2 py-1.5 text-slate-700">
                <span className="font-medium">{q.answeredByName}:</span> {q.answerText}
              </p>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  value={drafts[q.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                  placeholder="Write an answer…"
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <button onClick={() => submitAnswer(q.id)} className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500">
                  Answer
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
