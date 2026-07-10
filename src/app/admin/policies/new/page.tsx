"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WysiwygEditor } from "@/components/WysiwygEditor";

type Family = { id: string; name: string };

export default function NewPolicyPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyId, setFamilyId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("<p>Start writing your policy…</p>");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/policy-families")
      .then((r) => r.json())
      .then((d) => {
        setFamilies(d.families);
        if (d.families[0]) setFamilyId(d.families[0].id);
      });
  }, []);

  function onTitleChange(v: string) {
    setTitle(v);
    setSlug(
      v
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    );
  }

  async function onDocxUpload(file: File) {
    // Create the draft first with placeholder content, then run docx import against it.
    const createRes = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId, title: title || file.name, slug: slug || file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"), contentHtml: "<p></p>" }),
    });
    if (!createRes.ok) {
      setError("Could not create policy for import");
      return;
    }
    const { policy, version } = await createRes.json();
    const fd = new FormData();
    fd.append("file", file);
    const importRes = await fetch(`/api/policies/${policy.id}/versions/${version.id}/docx-import`, { method: "POST", body: fd });
    if (!importRes.ok) {
      setError("docx import failed");
      return;
    }
    router.push(`/admin/policies/${policy.id}`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId, title, slug, contentHtml: content }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.error === "string" ? d.error : "Could not create policy");
      return;
    }
    const { policy } = await res.json();
    router.push(`/admin/policies/${policy.id}`);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900">New Policy</h1>

      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm">
        <p className="font-medium text-slate-700">Or pull in an existing document</p>
        <p className="mt-1 text-slate-500">Upload a .docx file — it will be auto-converted to a web article you can refine below.</p>
        <input
          type="file"
          accept=".docx"
          className="mt-2 text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onDocxUpload(f);
          }}
        />
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Family</label>
            <select value={familyId} onChange={(e) => setFamilyId(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">URL slug</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input value={title} onChange={(e) => onTitleChange(e.target.value)} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Content</label>
          <div className="mt-1">
            <WysiwygEditor content={content} onChange={setContent} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
          Create draft
        </button>
      </form>
    </div>
  );
}
