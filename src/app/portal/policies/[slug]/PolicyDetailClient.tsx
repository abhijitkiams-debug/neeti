"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PdfViewer } from "@/components/PdfViewer";

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

  useEffect(() => {
    fetch(`/api/consumption/policies/${slug}`)
      .then((r) => r.json())
      .then((d: PolicyData) => {
        setData(d);
        setStarred(d.starred);
      });
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
        <button
          onClick={toggleStar}
          className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium ${
            starred ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {starred ? "★ Starred" : "☆ Star"}
        </button>
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

      {data && !data.hasAttested && (
        <AttestPanel slug={slug} sessionKind={sessionKind} onDone={() => setData({ ...data, hasAttested: true })} />
      )}
      {data?.hasAttested && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ You have acknowledged this policy.
        </div>
      )}
    </div>
  );
}

function AttestPanel({ slug, sessionKind, onDone }: { slug: string; sessionKind: "employee" | "vendor"; onDone: () => void }) {
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

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-900">Acknowledge this policy</h2>

      {sessionKind === "employee" ? (
        <form onSubmit={submitEmployee} className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600">Re-enter your password to e-sign</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            I acknowledge
          </button>
        </form>
      ) : !otpRequested ? (
        <button
          onClick={requestOtp}
          disabled={loading}
          className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          Send OTP to acknowledge
        </button>
      ) : (
        <form onSubmit={submitVendor} className="mt-3 flex items-end gap-3">
          {devCode && (
            <p className="w-full rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Dev mode OTP: <strong>{devCode}</strong>
            </p>
          )}
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600">Enter the 6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm tracking-widest"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            I acknowledge
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
