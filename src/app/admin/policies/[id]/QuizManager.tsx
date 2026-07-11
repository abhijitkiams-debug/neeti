"use client";

import { useEffect, useState } from "react";

type Question = {
  id: string;
  questionText: string;
  explanation: string | null;
  sectionAnchor: string | null;
  options: { id: string; text: string; isCorrect: boolean }[];
};

export function QuizManager({ policyId }: { policyId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [sectionAnchor, setSectionAnchor] = useState("");
  const [options, setOptions] = useState([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);

  async function load() {
    const res = await fetch(`/api/quiz/questions?policyId=${policyId}`);
    if (res.ok) setQuestions((await res.json()).questions);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyId]);

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/quiz/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policyId,
        questionText,
        explanation: explanation || undefined,
        sectionAnchor: sectionAnchor || undefined,
        options: options.filter((o) => o.text.trim()),
      }),
    });
    if (res.ok) {
      setQuestionText("");
      setExplanation("");
      setSectionAnchor("");
      setOptions([
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
        { text: "", isCorrect: false },
      ]);
      await load();
    }
  }

  async function removeQuestion(id: string) {
    await fetch(`/api/quiz/questions/${id}`, { method: "DELETE" });
    await load();
  }

  async function generateWithAi() {
    setGenerating(true);
    setGenError(null);
    const res = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId }),
    });
    setGenerating(false);
    if (res.ok) {
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setGenError(typeof d.error === "string" ? d.error : "AI generation failed");
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Micro-Quiz question bank ({questions.length})</h2>
        <div className="flex items-center gap-3">
          <button onClick={generateWithAi} disabled={generating} className="text-sm text-indigo-600 hover:underline disabled:opacity-50">
            {generating ? "Generating…" : "✨ Generate with AI"}
          </button>
          <button onClick={() => setOpen((o) => !o)} className="text-sm text-indigo-600 hover:underline">
            {open ? "Close" : "+ Add question"}
          </button>
        </div>
      </div>
      {genError && <p className="mt-2 text-xs text-red-600">{genError}</p>}

      <ul className="mt-3 space-y-2">
        {questions.map((q) => (
          <li key={q.id} className="rounded-md bg-slate-50 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-slate-800">{q.questionText}</p>
              <button onClick={() => removeQuestion(q.id)} className="shrink-0 text-xs text-red-600 hover:underline">
                Remove
              </button>
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
              {q.options.map((o) => (
                <li key={o.id} className={o.isCorrect ? "font-medium text-emerald-700" : ""}>
                  {o.isCorrect ? "✓ " : "· "}
                  {o.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {questions.length === 0 && <li className="text-sm text-slate-500">No questions yet for this policy.</li>}
      </ul>

      {open && (
        <form onSubmit={addQuestion} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">Question</label>
            <input required value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={o.isCorrect}
                  onChange={() => setOptions((opts) => opts.map((op, idx) => ({ ...op, isCorrect: idx === i })))}
                />
                <input
                  placeholder={`Option ${i + 1}`}
                  value={o.text}
                  onChange={(e) => setOptions((opts) => opts.map((op, idx) => (idx === i ? { ...op, text: e.target.value } : op)))}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Explanation (shown after answering)</label>
              <input value={explanation} onChange={(e) => setExplanation(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Section anchor id (optional, e.g. &quot;scope&quot;)</label>
              <input value={sectionAnchor} onChange={(e) => setSectionAnchor(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
          </div>
          <button type="submit" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
            Save question
          </button>
        </form>
      )}
    </div>
  );
}
