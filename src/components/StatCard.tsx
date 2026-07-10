export function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className={`text-2xl font-semibold ${accent ?? "text-slate-900"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
