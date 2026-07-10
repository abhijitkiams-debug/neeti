/** Whole days from now until `date` (negative if already past). Defined
 * outside any component body — the react-hooks purity rule flags `Date.now()`
 * called directly inside a component render, even hoisted to a local const. */
export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
