"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Question = {
  assignmentId: string;
  order: number;
  questionText: string;
  policySlug: string;
  policyTitle: string;
  sectionAnchor: string | null;
  options: { id: string; text: string }[];
  answered: boolean;
  answeredOptionId: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
};

export function QuizClient() {
  const [questions, setQuestions] = useState<Question[] | null>(null);

  useEffect(() => {
    fetch("/api/quiz/today")
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions));
  }, []);

  async function answer(assignmentId: string, optionId: string) {
    const res = await fetch("/api/quiz/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, optionId }),
    });
    if (!res.ok) return;
    const { result } = await res.json();
    setQuestions((qs) => qs?.map((q) => (q.assignmentId === assignmentId ? result : q)) ?? null);
  }

  if (questions === null) return <p className="mt-6 text-sm text-slate-500">Loading…</p>;
  if (questions.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        No quiz questions are available yet for your assigned policies.
      </p>
    );
  }

  const answeredCount = questions.filter((q) => q.answered).length;
  const correctCount = questions.filter((q) => q.isCorrect).length;

  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-slate-600">
        {answeredCount}/{questions.length} answered · {correctCount} correct so far
      </p>
      {questions.map((q, i) => (
        <div key={q.assignmentId} className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            Question {i + 1} · from {q.policyTitle}
          </p>
          <p className="mt-1 font-medium text-slate-900">{q.questionText}</p>
          <div className="mt-3 space-y-2">
            {q.options.map((o) => {
              const isSelected = q.answeredOptionId === o.id;
              const showCorrectness = q.answered;
              const isCorrectOption = showCorrectness && isSelected && q.isCorrect;
              const isWrongOption = showCorrectness && isSelected && !q.isCorrect;
              return (
                <button
                  key={o.id}
                  disabled={q.answered}
                  onClick={() => answer(q.assignmentId, o.id)}
                  className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${
                    isCorrectOption
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                      : isWrongOption
                        ? "border-red-400 bg-red-50 text-red-800"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50 disabled:hover:bg-transparent"
                  }`}
                >
                  {o.text}
                </button>
              );
            })}
          </div>
          {q.answered && (
            <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
              <p className={q.isCorrect ? "font-medium text-emerald-700" : "font-medium text-red-700"}>
                {q.isCorrect ? "Correct!" : "Not quite."}
              </p>
              {q.explanation && <p className="mt-1 text-slate-600">{q.explanation}</p>}
              <Link
                href={`/portal/policies/${q.policySlug}${q.sectionAnchor ? `#${q.sectionAnchor}` : ""}`}
                className="mt-1 inline-block text-indigo-600 hover:underline"
              >
                Review this section →
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
