"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { WysiwygEditor } from "@/components/WysiwygEditor";
import { TargetingEditor, type TargetRule } from "./TargetingEditor";
import { QuizManager } from "./QuizManager";
import { EngagementMetrics } from "./EngagementMetrics";
import { QuestionsPanel } from "./QuestionsPanel";

type Version = {
  id: string;
  versionNumber: number;
  status: string;
  contentHtml: string;
  sourceType: string;
  sourceFileUrl: string | null;
  authorId: string;
  author: { name: string };
  approver: { name: string } | null;
  approvalComment: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  targetRules: { kind: string; attribute: string | null; values: string }[];
  _count: { audienceMembers: number; readReceipts: number; attestations: number };
};

type PolicyData = {
  id: string;
  title: string;
  slug: string;
  family: { name: string };
  currentVersionId: string | null;
  versions: Version[];
};

const CAN_AUTHOR = ["AUTHOR", "ADMIN"];
const CAN_PUBLISH = ["PUBLISHER", "ADMIN"];

export function PolicyWorkflowClient({ policyId, currentUserId, role }: { policyId: string; currentUserId: string; role: string }) {
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/policies/${policyId}`);
    const d = await res.json();
    setPolicy(d.policy);
    const latest = d.policy.versions[0];
    setSelectedVersionId((prev) => prev ?? latest?.id ?? null);
    return d.policy as PolicyData;
  }, [policyId]);

  useEffect(() => {
    load();
  }, [load]);

  const version = policy?.versions.find((v) => v.id === selectedVersionId) ?? policy?.versions[0];

  useEffect(() => {
    if (version) setContent(version.contentHtml);
  }, [version?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!policy || !version) return <p className="text-sm text-slate-500">Loading…</p>;

  const isEditable = ["DRAFT", "REJECTED"].includes(version.status);
  const isMaker = version.authorId === currentUserId;

  async function call(path: string, body?: unknown, method: "POST" | "PATCH" = "POST") {
    setBusy(true);
    setMessage(null);
    const res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMessage(typeof d.error === "string" ? d.error : JSON.stringify(d.error) || "Action failed");
      return false;
    }
    await load();
    return true;
  }

  async function saveContent() {
    setBusy(true);
    const res = await fetch(`/api/policies/${policyId}/versions/${version!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentHtml: content }),
    });
    setBusy(false);
    if (res.ok) {
      setMessage("Saved.");
      await load();
    }
  }

  async function uploadDocx(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    const res = await fetch(`/api/policies/${policyId}/versions/${version!.id}/docx-import`, { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) await load();
  }

  async function uploadPdf(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    const res = await fetch(`/api/policies/${policyId}/versions/${version!.id}/pdf-import`, { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) await load();
  }

  async function importFromLink() {
    if (!importUrl.trim()) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/policies/${policyId}/versions/${version!.id}/url-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: importUrl.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setImportUrl("");
      setMessage("Content imported. Family, targeting, and title were left untouched.");
      await load();
    } else {
      const d = await res.json().catch(() => ({}));
      setMessage(typeof d.error === "string" ? d.error : "Import failed");
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">{policy.family.name}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{policy.title}</h1>
          <p className="mt-1 text-xs text-slate-500">/portal/policies/{policy.slug}</p>
        </div>
        {policy.currentVersionId && (
          <a
            href={`/portal/policies/${policy.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-indigo-600 hover:underline"
          >
            View live →
          </a>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <select
          value={version.id}
          onChange={(e) => setSelectedVersionId(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {policy.versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.versionNumber} — {v.status}
              {v.id === policy.currentVersionId ? " (live)" : ""}
            </option>
          ))}
        </select>
        <Badge status={version.status} />
        <span className="text-xs text-slate-500">by {version.author.name}</span>
      </div>

      {message && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p>}

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        {version.sourceType === "PDF" && version.sourceFileUrl ? (
          <p className="text-sm text-slate-600">
            PDF-sourced version.{" "}
            <a href={version.sourceFileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              View file
            </a>
          </p>
        ) : (
          <WysiwygEditor content={content} onChange={setContent} editable={isEditable && CAN_AUTHOR.includes(role)} />
        )}

        {isEditable && CAN_AUTHOR.includes(role) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={saveContent} disabled={busy} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
              Save draft
            </button>
            <label className="text-xs text-slate-500">
              Upload .doc/.docx:{" "}
              <input type="file" accept=".docx,.doc" className="text-xs" onChange={(e) => e.target.files?.[0] && uploadDocx(e.target.files[0])} />
            </label>
            <label className="text-xs text-slate-500">
              Upload .pdf:{" "}
              <input type="file" accept=".pdf" className="text-xs" onChange={(e) => e.target.files?.[0] && uploadPdf(e.target.files[0])} />
            </label>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              Import from link:{" "}
              <input
                type="url"
                placeholder="Google Doc share link or public doc URL"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                className="w-64 rounded border border-slate-300 px-2 py-1 text-xs"
              />
              <button type="button" onClick={importFromLink} disabled={busy || !importUrl.trim()} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Fetch
              </button>
            </span>
            <button
              onClick={() => call(`/api/policies/${policyId}/versions/${version.id}/submit`)}
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              Submit for review
            </button>
          </div>
        )}
      </div>

      {version.status === "IN_REVIEW" && CAN_PUBLISH.includes(role) && (
        <ApprovalPanel
          disabled={busy || isMaker}
          disabledReason={isMaker ? "Maker and checker must be different people." : undefined}
          onApprove={(comment) => call(`/api/policies/${policyId}/versions/${version.id}/approve`, { comment })}
          onReject={(comment) => call(`/api/policies/${policyId}/versions/${version.id}/reject`, { comment })}
        />
      )}

      {version.approvalComment && (
        <p className="mt-3 text-sm text-slate-500">
          <strong>{version.approver?.name}:</strong> {version.approvalComment}
        </p>
      )}

      {["APPROVED", "DRAFT", "IN_REVIEW", "REJECTED"].includes(version.status) && CAN_PUBLISH.includes(role) && (
        <TargetingEditor
          policyId={policyId}
          versionId={version.id}
          initialRules={version.targetRules.map((r) => ({ kind: r.kind as TargetRule["kind"], attribute: r.attribute, values: JSON.parse(r.values) }))}
          canPublish={version.status === "APPROVED"}
          onPublished={load}
        />
      )}

      {version.status === "PUBLISHED" && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            Published to {version._count.audienceMembers} recipients · {version._count.readReceipts} read · {version._count.attestations} attested
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CAN_PUBLISH.includes(role) && (
              <>
                <button onClick={() => call(`/api/policies/${policyId}/versions/${version.id}/recall`)} disabled={busy} className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                  Recall / Unpublish
                </button>
                <button onClick={() => call(`/api/policies/${policyId}/versions/${version.id}/resend`)} disabled={busy} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Resend to all
                </button>
                <button onClick={() => call(`/api/policies/${policyId}/versions/${version.id}/remind`)} disabled={busy} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Remind unread only
                </button>
              </>
            )}
            {CAN_AUTHOR.includes(role) && (
              <button
                onClick={async () => {
                  const ok = await call(`/api/policies/${policyId}/versions/new`);
                  if (ok) setSelectedVersionId(null);
                }}
                disabled={busy}
                className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Start new revision
              </button>
            )}
            <Link href={`/admin/reports?versionId=${version.id}`} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              View report →
            </Link>
            <Link href={`/admin/policies/${policyId}/access-logs`} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Access logs →
            </Link>
          </div>

          {CAN_PUBLISH.includes(role) && (
            <ExpiryEditor
              currentExpiresAt={version.expiresAt}
              busy={busy}
              onChange={(iso) => call(`/api/policies/${policyId}/versions/${version.id}/expiry`, { expiresAt: iso }, "PATCH")}
            />
          )}
        </div>
      )}

      {version.status === "PUBLISHED" && <EngagementMetrics versionId={version.id} />}

      {CAN_AUTHOR.includes(role) && <QuizManager policyId={policyId} />}

      {CAN_PUBLISH.includes(role) && <QuestionsPanel policyId={policyId} />}
    </div>
  );
}

function ExpiryEditor({
  currentExpiresAt,
  busy,
  onChange,
}: {
  currentExpiresAt: string | null;
  busy: boolean;
  onChange: (iso: string | null) => void;
}) {
  const [value, setValue] = useState(currentExpiresAt ? currentExpiresAt.slice(0, 10) : "");

  return (
    <div className="mt-3 flex items-end gap-3 border-t border-emerald-200 pt-3">
      <div>
        <label className="block text-xs font-medium text-emerald-800">Expiry date</label>
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <button
        disabled={busy}
        onClick={() => onChange(value ? new Date(value).toISOString() : null)}
        className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        Save expiry
      </button>
      {currentExpiresAt && (
        <button disabled={busy} onClick={() => onChange(null)} className="text-xs text-red-600 hover:underline">
          Clear expiry
        </button>
      )}
    </div>
  );
}

function ApprovalPanel({
  disabled,
  disabledReason,
  onApprove,
  onReject,
}: {
  disabled: boolean;
  disabledReason?: string;
  onApprove: (comment: string) => void;
  onReject: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-800">This version is awaiting checker approval.</p>
      {disabledReason && <p className="mt-1 text-xs text-amber-700">{disabledReason}</p>}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (required to reject)"
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        rows={2}
      />
      <div className="mt-2 flex gap-2">
        <button disabled={disabled} onClick={() => onApprove(comment)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
          Approve
        </button>
        <button
          disabled={disabled || !comment.trim()}
          onClick={() => onReject(comment)}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
