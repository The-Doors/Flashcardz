export const DAY_MS = 86_400_000;

const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function formatWorkedOn(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS,
  );

  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export const fullDate = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

export const cardLabel = (n: number): string =>
  `${n} ${n === 1 ? "card" : "cards"}`;
