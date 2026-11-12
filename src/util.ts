const pad = (n: number) => String(n).padStart(2, "0");

export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDay(new Date());
const parse = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

/** Ganze Tage von heute bis zum Datum; negativ = Vergangenheit. */
export const daysUntil = (iso: string) => Math.round((parse(iso).getTime() - parse(today()).getTime()) / 86_400_000);

export function formatDate(iso: string, opts: { year?: boolean; weekday?: boolean } = {}) {
  const d = parse(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("de-DE", {
    weekday: opts.weekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: opts.year || !sameYear ? "numeric" : undefined,
  });
}

/** "heute", "gestern", "vor 12 Tagen", "vor 3 Wochen" … */
export function ago(iso: string) {
  const n = -daysUntil(iso);
  if (n < 0) return n === -1 ? "morgen" : `in ${-n} Tagen`;
  if (n === 0) return "heute";
  if (n === 1) return "gestern";
  if (n < 14) return `vor ${n} Tagen`;
  if (n < 60) return `vor ${Math.round(n / 7)} Wochen`;
  return `vor ${Math.round(n / 30)} Monaten`;
}

export function dueLabel(iso: string) {
  const n = daysUntil(iso);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "gestern";
  if (n < 0) return `${-n} Tage überfällig`;
  return formatDate(iso, { weekday: true });
}

export function timeOfDay(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Erste Zeile mit Inhalt, ohne Aufzählungszeichen: Vorschau und Ersatztitel. */
export function firstLine(text: string) {
  for (const line of text.split("\n")) {
    const clean = line.replace(/^\s*([-*•–]|\d+\.)\s+/, "").trim();
    if (clean) return clean;
  }
  return "";
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const DEFAULT_GROUPS = ["Kunden", "Intern"];

/** Ordner der linken Spalte: die festen zuerst, dann alle, die in Themen vorkommen. */
export const groupNames = (topics: { group: string }[]) => [...new Set([...DEFAULT_GROUPS, ...topics.map((t) => t.group)])];

/** Sortiert Themen nach letzter Aktivität: jüngstes Gesprächsdatum zuerst, Themen ohne Einträge nach Anlagedatum. */
export function byLastActivity<T extends { id: string; createdAt: string }>(topics: T[], notes: { topicId: string; date: string; updatedAt: string }[]): T[] {
  const last = new Map<string, string>();
  for (const n of notes) {
    const key = `${n.date} ${n.updatedAt}`;
    if (key > (last.get(n.topicId) ?? "")) last.set(n.topicId, key);
  }
  const keyOf = (t: T) => last.get(t.id) ?? t.createdAt.slice(0, 10);
  return [...topics].sort((a, b) => keyOf(b).localeCompare(keyOf(a)));
}
