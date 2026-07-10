"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RBI_TAGS } from "@/lib/enums";

type Circular = {
  id: string;
  title: string;
  sourceUrl: string;
  pdfUrl: string | null;
  publishedDate: string | null;
  summary: string | null;
  tags: string[];
  importedAsPolicyId: string | null;
  implementationDeadline: string | null;
};
type Family = { id: string; name: string };

export default function RbiPage() {
  const router = useRouter();
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [tag, setTag] = useState("");
  const [scraping, setScraping] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [importFamilyId, setImportFamilyId] = useState("");

  async function load() {
    const res = await fetch(`/api/rbi${tag ? `?tag=${tag}` : ""}`);
    if (res.ok) setCirculars((await res.json()).circulars);
  }

  useEffect(() => {
    load();
    fetch("/api/policy-families")
      .then((r) => r.json())
      .then((d) => {
        setFamilies(d.families);
        if (d.families[0]) setImportFamilyId(d.families[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  async function runScrape() {
    setScraping(true);
    const res = await fetch("/api/rbi/scrape", { method: "POST" });
    setScraping(false);
    if (res.ok) await load();
    else alert("Scrape failed — the RBI site may be unreachable from this environment.");
  }

  async function importAsPolicy(id: string) {
    const res = await fetch(`/api/rbi/${id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId: importFamilyId }),
    });
    if (res.ok) {
      const { policy } = await res.json();
      router.push(`/admin/policies/${policy.id}`);
    }
  }

  async function setDeadline(id: string, value: string) {
    await fetch(`/api/rbi/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ implementationDeadline: value ? new Date(value).toISOString() : null }),
    });
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">RBI Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Scraped from rbi.org.in, auto-tagged, and available to seed new internal policies.</p>
        </div>
        <button onClick={runScrape} disabled={scraping} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
          {scraping ? "Scraping…" : "Scrape now"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-xs font-medium text-slate-600">Filter by tag:</label>
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">
          <option value="">All</option>
          {RBI_TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="ml-4 text-xs font-medium text-slate-600">Import into family:</label>
        <select value={importFamilyId} onChange={(e) => setImportFamilyId(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {circulars.map((c) => (
          <li key={c.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">
                  {c.title}
                </a>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.publishedDate ? new Date(c.publishedDate).toLocaleDateString() : "Undated"} ·{" "}
                  {c.tags.map((t) => (
                    <span key={t} className="mr-1 rounded-full bg-slate-100 px-2 py-0.5">
                      {t}
                    </span>
                  ))}
                </p>
                {c.summary && <p className="mt-1 text-sm text-slate-600">{c.summary}</p>}
              </div>
              <div className="shrink-0 space-y-2 text-right">
                <button
                  onClick={() => importAsPolicy(c.id)}
                  disabled={!!c.importedAsPolicyId}
                  className="block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {c.importedAsPolicyId ? "Imported" : "Import as draft policy"}
                </button>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500">Implementation deadline</label>
                  <input
                    type="date"
                    defaultValue={c.implementationDeadline ? c.implementationDeadline.slice(0, 10) : ""}
                    onBlur={(e) => setDeadline(c.id, e.target.value)}
                    className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </div>
              </div>
            </div>
          </li>
        ))}
        {circulars.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">No circulars yet — click &quot;Scrape now&quot;.</li>}
      </ul>
    </div>
  );
}
