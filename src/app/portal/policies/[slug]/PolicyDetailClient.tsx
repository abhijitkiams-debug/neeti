"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LANGUAGES } from "@/lib/enums";

// pdfjs-dist crashes at module-evaluation time under the webpack dev
// compiler if imported eagerly, which would break every policy page (not
// just PDF ones) since this file is loaded for all of them. Load it lazily,
// client-side only, and only once a PDF-sourced policy actually needs it.
const PdfViewer = dynamic(() => import("@/components/PdfViewer").then((m) => m.PdfViewer), { ssr: false });

type PolicyData = {
  policy: {
    slug: string;
    title: string;
    family: string;
    contentHtml: string;
    versionNumber: number;
    publishedAt: string | null;
    sourceType: string;
    sourceFileUrl: string | null;
  };
  language: string;
  availableLanguages: string[];
  hasRead: boolean;
  hasAttested: boolean;
  starred: boolean;
};

export function PolicyDetailClient({
  slug,
  sessionKind,
  title,
  family,
  quizCount,
}: {
  slug: string;
  sessionKind: "employee" | "vendor";
  title: string;
  family: string;
  quizCount: number;
}) {
  const [data, setData] = useState<PolicyData | null>(null);
  const [starred, setStarred] = useState(false);
  const [lang, setLang] = useState("en");

  useEffect(() => {
    fetch(`/api/consumption/policies/${slug}${lang !== "en" ? `?lang=${lang}` : ""}`)
      .then((r) => r.json())
      .then((d: PolicyData) => {
        setData(d);
        setStarred(d.starred);
      });
  }, [slug, lang]);

  useEffect(() => {
    fetch(`/api/consumption/policies/${slug}/read`, { method: "POST" });
  }, [slug]);

  async function toggleStar() {
    const res = await fetch(`/api/consumption/policies/${slug}/star`, { method: "POST" });
    const d = await res.json();
    setStarred(d.starred);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">{family}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
          {data && (
            <p className="mt-1 text-sm text-slate-500">
              Version {data.policy.versionNumber} · Published{" "}
              {data.policy.publishedAt ? new Date(data.policy.publishedAt).toLocaleDateString() : ""}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {data && data.availableLanguages.length > 1 && (
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {LANGUAGES.filter((l) => data.availableLanguages.includes(l.code)).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName === l.englishName ? l.englishName : `${l.nativeName} (${l.englishName})`}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={toggleStar}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              starred ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {starred ? "★ Starred" : "☆ Star"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        {!data && <p className="text-sm text-slate-500">Loading…</p>}
        {data && data.policy.sourceType === "PDF" && data.policy.sourceFileUrl ? (
          <PdfViewer fileUrl={data.policy.sourceFileUrl} />
        ) : (
          data && (
            <article className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: data.policy.contentHtml }} />
          )
        )}
      </div>

      {quizCount > 0 && (
        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          This policy has {quizCount} question(s) in the Daily Micro-Quiz.{" "}
          <Link href="/portal/quiz" className="font-medium underline">
            Go to today&apos;s quiz
          </Link>
        </div>
      )}

      {data && (
        <ActionBar
          slug={slug}
          sessionKind={sessionKind}
          hasAttested={data.hasAttested}
          onAttested={() => setData({ ...data, hasAttested: true })}
        />
      )}
    </div>
  );
}

function ActionBar({
  slug,
  sessionKind,
  hasAttested,
  onAttested,
}: {
  slug: string;
  sessionKind: "employee" | "vendor";
  hasAttested: boolean;
  onAttested: () => void;
}) {
  return (
    <div className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-3">
      <SignColumn slug={slug} sessionKind={sessionKind} hasAttested={hasAttested} onAttested={onAttested} />
      <FeedbackColumn slug={slug} />
      <QuestionColumn slug={slug} />
    </div>
  );
}

function SignColumn({
  slug,
  sessionKind,
  hasAttested,
  onAttested,
}: {
  slug: string;
  sessionKind: "employee" | "vendor";
  hasAttested: boolean;
  onAttested: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p className="text-sm text-slate-700">{hasAttested ? "You have signed this document" : "You are requested to sign this document"}</p>
      {hasAttested ? (
        <p className="mt-2 inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
          ✓ Signed
        </p>
      ) : expanded ? (
        <AttestForm slug={slug} sessionKind={sessionKind} onDone={onAttested} />
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign
        </button>
      )}
    </div>
  );
}

function AttestForm({ slug, sessionKind, onDone }: { slug: string; sessionKind: "employee" | "vendor"; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    setLoading(true);
    const res = await fetch(`/api/consumption/policies/${slug}/attest-otp`, { method: "POST" });
    setLoading(false);
    const d = await res.json();
    setDevCode(d.devCode ?? null);
    setOtpRequested(true);
  }

  async function submitEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/consumption/policies/${slug}/attest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Attestation failed");
      return;
    }
    onDone();
  }

  async function submitVendor(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/consumption/policies/${slug}/attest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Attestation failed");
      return;
    }
    onDone();
  }

  if (sessionKind === "employee") {
    return (
      <form onSubmit={submitEmployee} className="mt-2 space-y-2">
        <label className="block text-xs font-medium text-slate-600">Re-enter your password to e-sign</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
          I acknowledge
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    );
  }

  if (!otpRequested) {
    return (
      <button onClick={requestOtp} disabled={loading} className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        Send OTP to sign
      </button>
    );
  }

  return (
    <form onSubmit={submitVendor} className="mt-2 space-y-2">
      {devCode && (
        <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Dev mode OTP: <strong>{devCode}</strong>
        </p>
      )}
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="6-digit code"
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm tracking-widest"
      />
      <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        I acknowledge
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

function FeedbackColumn({ slug }: { slug: string }) {
  const [choice, setChoice] = useState<"helpful" | "not_helpful" | null>(null);

  async function send(helpful: boolean) {
    setChoice(helpful ? "helpful" : "not_helpful");
    await fetch(`/api/consumption/policies/${slug}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ helpful }),
    });
  }

  return (
    <div>
      <p className="text-sm text-slate-700">Want to give feedback?</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => send(true)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            choice === "helpful" ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          Helpful
        </button>
        <button
          onClick={() => send(false)}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            choice === "not_helpful" ? "border-red-400 bg-red-50 text-red-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          Not Helpful
        </button>
      </div>
      {choice && <p className="mt-1 text-xs text-slate-400">Thanks for the feedback.</p>}
    </div>
  );
}

function QuestionColumn({ slug }: { slug: string }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await fetch(`/api/consumption/policies/${slug}/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionText: text }),
    });
    setSent(true);
    setText("");
  }

  return (
    <div>
      <p className="text-sm text-slate-700">Have a doubt?</p>
      {sent ? (
        <p className="mt-2 text-xs text-emerald-700">✓ Your question was sent. You&apos;ll see the answer here once it&apos;s addressed.</p>
      ) : expanded ? (
        <form onSubmit={submit} className="mt-2 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Type your question…"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Send
          </button>
        </form>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 rounded-md border border-slate-900 bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Ask a question
        </button>
      )}
    </div>
  );
}
