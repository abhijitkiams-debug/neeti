"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function VendorLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/vendor/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }
    const data = await res.json();
    setDevCode(data.devCode ?? null);
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/vendor/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, code }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Invalid code");
      return;
    }
    router.push("/portal");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Neeti — Vendor Sign In</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with a one-time code sent to your registered mobile number.</p>

        {step === "mobile" ? (
          <form onSubmit={requestOtp} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Mobile number</label>
              <input
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="98000 00001"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-6 space-y-4">
            {devCode && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Dev mode — no SMS gateway configured. Your OTP is <strong>{devCode}</strong>.
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify & Sign in"}
            </button>
            <button type="button" onClick={() => setStep("mobile")} className="w-full text-center text-xs text-slate-500 hover:text-slate-700">
              Use a different number
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Employee?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
