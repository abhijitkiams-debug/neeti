/** Whole days from now until `date` (negative if already past). Defined
 * outside any component body — the react-hooks purity rule flags `Date.now()`
 * called directly inside a component render, even hoisted to a local const. */
export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Fixed locale + timezone so Client Components render the same date string
 * on the server (SSR) and the browser (hydration) — `toLocaleDateString()`
 * with no arguments follows the runtime's default locale/timezone, which
 * differs between the two and breaks hydration. */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
