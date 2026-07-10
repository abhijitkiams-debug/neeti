const COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-sky-100 text-sky-800",
  REJECTED: "bg-red-100 text-red-700",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  RECALLED: "bg-orange-100 text-orange-800",
  EXPIRED: "bg-slate-200 text-slate-600",
  NOT_STARTED: "bg-slate-100 text-slate-600",
  EXPIRING: "bg-amber-100 text-amber-800",
  OVERDUE_FOR_REVIEW: "bg-red-100 text-red-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  DEACTIVATED: "bg-slate-200 text-slate-600",
  Mandatory: "bg-red-50 text-red-700",
  Recommended: "bg-sky-50 text-sky-700",
  Optional: "bg-slate-100 text-slate-600",
  Employee: "bg-indigo-50 text-indigo-700",
  Vendor: "bg-teal-50 text-teal-700",
  OPEN: "bg-amber-100 text-amber-800",
  ANSWERED: "bg-emerald-100 text-emerald-800",
};

export function Badge({ status }: { status: string }) {
  const cls = COLORS[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
