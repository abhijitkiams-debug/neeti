"use client";

import { useEffect, useState } from "react";

type Metrics = {
  sentTo: number;
  readBy: number;
  yetToRead: number;
  nonFollowersWhoRead: number;
  totalUniqueUsers: number;
  totalTimesRead: number;
  publicPageViews: number;
  uniqueRespondents: number;
  accept: number;
  helpful: number;
  notHelpful: number;
  questionsAsked: number;
  totalResponseClicks: number;
  responseDistribution: { label: string; count: number; percent: number }[];
};

const ROWS: [keyof Metrics, string][] = [
  ["sentTo", "Sent to"],
  ["readBy", "Read by"],
  ["yetToRead", "Yet to read"],
  ["nonFollowersWhoRead", "Non-audience who read it"],
  ["totalUniqueUsers", "Total unique users"],
  ["totalTimesRead", "Total times read"],
  ["publicPageViews", "Public page views"],
  ["uniqueRespondents", "Unique respondents"],
  ["accept", "Accept (Sign)"],
  ["helpful", "Helpful"],
  ["notHelpful", "Not helpful"],
  ["questionsAsked", "Questions asked"],
  ["totalResponseClicks", "Total response button clicks"],
];

export function EngagementMetrics({ versionId }: { versionId: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    fetch(`/api/reports/policy-version/${versionId}/engagement`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMetrics);
  }, [versionId]);

  if (!metrics) return null;
  const maxPercent = Math.max(1, ...metrics.responseDistribution.map((b) => b.percent));

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Document report metrics</h2>
      <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
        {ROWS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between border-b border-slate-100 py-1.5">
            <span className="text-slate-500">{label}</span>
            <span className="font-medium text-slate-900">{metrics[key] as number}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">First-response timing</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        {metrics.responseDistribution.map((b) => (
          <div key={b.label} className="flex flex-1 flex-col items-center">
            <div className="flex h-20 w-full items-end justify-center">
              <div
                className="w-6 rounded-t bg-indigo-500"
                style={{ height: `${Math.max(4, (b.percent / maxPercent) * 80)}px` }}
                title={`${b.count} response(s)`}
              />
            </div>
            <p className="mt-1 text-xs font-medium text-slate-700">{b.percent}%</p>
            <p className="text-[11px] text-slate-400">{b.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
