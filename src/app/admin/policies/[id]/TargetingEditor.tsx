"use client";

import { useEffect, useState } from "react";
import { EMPLOYEE_TARGET_ATTRIBUTES, VENDOR_TARGET_ATTRIBUTES } from "@/lib/enums";

export type TargetRule = {
  kind: "EMPLOYEE_ATTRIBUTE" | "VENDOR_ATTRIBUTE" | "NAMED_EMPLOYEE" | "NAMED_VENDOR_USER" | "CUSTOM_LIST_EMPLOYEE" | "CUSTOM_LIST_VENDOR";
  attribute: string | null;
  values: string[];
};

type VendorOrg = { id: string; name: string };

export function TargetingEditor({
  policyId,
  versionId,
  initialRules,
  canPublish,
  onPublished,
}: {
  policyId: string;
  versionId: string;
  initialRules: TargetRule[];
  canPublish: boolean;
  onPublished: () => void;
}) {
  const [rules, setRules] = useState<TargetRule[]>(initialRules);
  const [vendorOrgs, setVendorOrgs] = useState<VendorOrg[]>([]);
  const [preview, setPreview] = useState<{ employeeCount: number; vendorCount: number; total: number } | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vendor-orgs")
      .then((r) => r.json())
      .then((d) => setVendorOrgs(d.orgs ?? []));
  }, []);

  useEffect(() => {
    setRules(initialRules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  function addRule(kind: TargetRule["kind"]) {
    setRules((r) => [...r, { kind, attribute: kind.includes("EMPLOYEE") ? "department" : kind.includes("VENDOR") ? "vendorOrg" : null, values: [] }]);
  }
  function updateRule(i: number, patch: Partial<TargetRule>) {
    setRules((r) => r.map((rule, idx) => (idx === i ? { ...rule, ...patch } : rule)));
  }
  function removeRule(i: number) {
    setRules((r) => r.filter((_, idx) => idx !== i));
  }

  // NAMED_EMPLOYEE / NAMED_VENDOR_USER rules are entered as emails/mobiles
  // for usability, then resolved to internal ids here before persisting —
  // resolveAudience() only ever matches against ids.
  async function resolveNamedRules(input: TargetRule[]): Promise<TargetRule[]> {
    const emailRule = input.find((r) => r.kind === "NAMED_EMPLOYEE");
    const mobileRule = input.find((r) => r.kind === "NAMED_VENDOR_USER");
    if (!emailRule && !mobileRule) return input;

    const res = await fetch("/api/directory/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: emailRule?.values ?? [], mobiles: mobileRule?.values ?? [] }),
    });
    if (!res.ok) return input;
    const resolved = await res.json();
    return input.map((r) => {
      if (r === emailRule) return { ...r, values: resolved.employeeIds };
      if (r === mobileRule) return { ...r, values: resolved.vendorUserIds };
      return r;
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const resolvedRules = await resolveNamedRules(rules);
    const res = await fetch(`/api/policies/${policyId}/versions/${versionId}/targeting`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: resolvedRules }),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Could not save targeting rules");
      return;
    }
    setMessage("Targeting saved.");
    await loadPreview();
  }

  async function loadPreview() {
    const res = await fetch(`/api/policies/${policyId}/versions/${versionId}/audience-preview`);
    if (res.ok) setPreview(await res.json());
  }

  async function publish() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/policies/${policyId}/versions/${versionId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMessage(d.error ?? "Could not publish");
      return;
    }
    onPublished();
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Targeting</h2>
      <div className="mt-3 space-y-3">
        {rules.map((rule, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2">
            <span className="text-xs font-medium text-slate-500">{rule.kind.replaceAll("_", " ")}</span>
            {rule.kind === "EMPLOYEE_ATTRIBUTE" && (
              <select value={rule.attribute ?? ""} onChange={(e) => updateRule(i, { attribute: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm">
                {EMPLOYEE_TARGET_ATTRIBUTES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            )}
            {rule.kind === "VENDOR_ATTRIBUTE" && (
              <select value={rule.attribute ?? ""} onChange={(e) => updateRule(i, { attribute: e.target.value, values: [] })} className="rounded border border-slate-300 px-2 py-1 text-sm">
                {VENDOR_TARGET_ATTRIBUTES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            )}
            {rule.kind === "VENDOR_ATTRIBUTE" && rule.attribute === "vendorOrg" ? (
              <select
                multiple
                value={rule.values}
                onChange={(e) => updateRule(i, { values: Array.from(e.target.selectedOptions).map((o) => o.value) })}
                className="min-w-[180px] rounded border border-slate-300 px-2 py-1 text-sm"
              >
                {vendorOrgs.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                placeholder="comma-separated values"
                defaultValue={rule.values.join(", ")}
                onBlur={(e) => updateRule(i, { values: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
                className="flex-1 min-w-[160px] rounded border border-slate-300 px-2 py-1 text-sm"
              />
            )}
            <button onClick={() => removeRule(i)} className="text-xs text-red-600 hover:underline">
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <button onClick={() => addRule("EMPLOYEE_ATTRIBUTE")} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
          + Employee attribute rule
        </button>
        <button onClick={() => addRule("VENDOR_ATTRIBUTE")} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
          + Vendor attribute rule
        </button>
        <button onClick={() => addRule("NAMED_EMPLOYEE")} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
          + Named employees (emails)
        </button>
        <button onClick={() => addRule("NAMED_VENDOR_USER")} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
          + Named vendor users (mobiles)
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
          Save targeting
        </button>
        <button onClick={loadPreview} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Preview audience
        </button>
        {preview && (
          <span className="text-sm text-slate-600">
            {preview.total} recipients ({preview.employeeCount} employees, {preview.vendorCount} vendor users)
          </span>
        )}
      </div>

      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}

      {canPublish && (
        <div className="mt-4 flex items-end gap-3 border-t border-slate-200 pt-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Expiry (optional)</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm" />
          </div>
          <button onClick={publish} disabled={saving} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
            Publish
          </button>
        </div>
      )}
    </div>
  );
}
