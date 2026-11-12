/**
 * Übernimmt Notizen aus der Notizen-App von macOS als Einträge in Nova Elf.
 *
 *   npm run import:notes              Probelauf: zeigt die geplante Zuordnung, schreibt nichts
 *   npm run import:notes -- --apply   übernimmt den zuletzt gezeigten Plan
 *
 * Nova Elf muss laufen (npm start). Notizen, die nach Zugangsdaten aussehen, werden
 * übersprungen: Sie gehen weder an die Claude API noch in den Datenordner.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { AppState, Note, Topic } from "../shared/types.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  // ohne .env meldet der Zuordnungsaufruf den fehlenden Schlüssel
}
const { assignTopics, describeAiError } = await import("../server/ai.ts");

const BASE = `http://localhost:${process.env.PORT || 4311}/api`;
const PLAN_FILE = path.join(root, ".import-plan.json");
const apply = process.argv.includes("--apply");

interface AppleNote {
  id: string;
  title: string;
  date: string;
  locked: boolean;
  html: string | null;
}

interface PlanEntry {
  id: string;
  topic: string;
  group: string;
}

// --- Notizen-App auslesen -------------------------------------------------------

const JXA = `
const app = Application("Notes");
const pad = (n) => String(n).padStart(2, "0");
const out = [];
for (const acc of app.accounts()) {
  for (const folder of acc.folders()) {
    if (/^(Recently Deleted|Zuletzt gelöscht)$/.test(folder.name())) continue;
    const notes = folder.notes;
    const count = notes.length;
    if (!count) continue;
    const ids = notes.id(), names = notes.name(), created = notes.creationDate(), locked = notes.passwordProtected();
    for (let i = 0; i < count; i++) {
      let html = null;
      if (!locked[i]) { try { html = notes[i].body(); } catch (e) {} }
      const d = created[i];
      out.push({ id: ids[i], title: names[i], locked: locked[i], html,
        date: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) });
    }
  }
}
JSON.stringify(out);
`;

async function readAppleNotes(): Promise<AppleNote[]> {
  const { stdout } = await promisify(execFile)("osascript", ["-l", "JavaScript", "-e", JXA], { maxBuffer: 512 * 1024 * 1024 });
  return JSON.parse(stdout) as AppleNote[];
}

// --- HTML der Notizen-App in Stichpunkt-Text ------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1]!.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });

export function htmlToText(html: string): string {
  const lines: string[] = [];
  let depth = 0;
  let prefix = "";
  let text = "";
  /** Leerzeilen entstehen nur aus einem <br> ohne Text davor, nicht aus Listen- und Blockgrenzen. */
  const flush = (blankIfEmpty = false) => {
    if (text.trim()) {
      lines.push(prefix + text.replace(/\s+/g, " ").trim());
      prefix = "";
    } else if (blankIfEmpty && !prefix && depth === 0 && lines.length && lines.at(-1) !== "") {
      lines.push("");
    }
    text = "";
  };
  for (const m of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>|([^<]+)/gi)) {
    if (m[3] !== undefined) {
      text += decode(m[3]);
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2]!.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      flush();
      depth = Math.max(0, depth + (closing ? -1 : 1));
    } else if (tag === "li") {
      flush();
      prefix = closing ? "" : `${"  ".repeat(Math.max(0, depth - 1))}- `;
    } else if (tag === "td" || tag === "th") {
      if (closing) text += "  ";
    } else if (tag === "br") {
      flush(true);
    } else if (["div", "p", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre"].includes(tag)) {
      flush();
    }
  }
  flush();
  return lines.join("\n").trim();
}

// --- Zugangsdaten erkennen (rein lokal) -----------------------------------------

const KNOWN_KEYS =
  /\b(sk-[\w-]{16,}|sk_(live|test)_\w+|pk_(live|test)_\w+|rk_(live|test)_\w+|whsec_\w+|gh[opsur]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[\w-]{10,}|AIza[\w-]{30,}|re_[A-Za-z0-9_]{16,}|eyJ[\w-]{10,}\.[\w-]{10,}\.)/;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const LABELLED =
  /(api[\s_-]?key|schl(ü|ue)ssel|secret|token|passwor[dt]|kennwort|pwd|pass|pin|zugang|login|credentials?|bearer|benutzer|user(name)?)\b[^\n]{0,20}[:=]\s*\S{4,}/i;

function looksRandom(token: string) {
  if (token.length < 20) return false;
  if (/^[0-9a-f]{32,}$/i.test(token)) return true;
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(token)).length;
  return classes === 3 && /^[\w+/=.-]+$/.test(token);
}

/** Liefert die Art des Fundes, nie den Fund selbst. */
export function secretReason(text: string): string | null {
  if (KNOWN_KEYS.test(text)) return "API-Schlüssel";
  if (PRIVATE_KEY.test(text)) return "privater Schlüssel";
  if (LABELLED.test(text)) return "beschriftete Zugangsdaten";
  for (const word of text.split(/\s+/)) {
    for (const part of /^https?:\/\//i.test(word) ? word.split(/[/?&=#]/) : [word]) {
      if (looksRandom(part.replace(/^[("'`]+|[)"'`,.;]+$/g, ""))) return "zufällig aussehende Zeichenfolge";
    }
  }
  return null;
}

// --- Nova Elf -------------------------------------------------------------------

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error(`Nova Elf ist unter ${BASE} nicht erreichbar. Bitte zuerst "npm start" ausführen.`);
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data;
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function main() {
  const state = await call<AppState>("GET", "/state");
  const imported = new Set(state.notes.flatMap((n) => (n.source?.kind === "apple-notes" ? [n.source.id] : [])));

  console.log("Lese Notizen-App …");
  const all = await readAppleNotes();
  const skipped: { title: string; reason: string }[] = [];
  const ready: (AppleNote & { content: string })[] = [];
  let known = 0;
  for (const n of all) {
    if (imported.has(n.id)) {
      known++;
      continue;
    }
    const safeTitle = secretReason(n.title) ? "(Titel verborgen)" : n.title;
    if (n.locked || n.html === null) {
      skipped.push({ title: safeTitle, reason: "gesperrt oder nicht lesbar" });
      continue;
    }
    let content = htmlToText(n.html);
    const firstLine = content.split("\n", 1)[0] ?? "";
    if (firstLine.trim() === n.title.trim()) content = content.slice(firstLine.length).trim();
    const reason = secretReason(`${n.title}\n${content}`);
    if (reason) {
      skipped.push({ title: safeTitle, reason });
      continue;
    }
    if (!content && !n.title.trim()) {
      skipped.push({ title: "(leer)", reason: "leer" });
      continue;
    }
    ready.push({ ...n, content });
  }

  console.log(`${all.length} Notizen gefunden, ${known} bereits übernommen, ${skipped.length} übersprungen, ${ready.length} zu übernehmen.`);
  if (skipped.length) {
    console.log("\nÜbersprungen (bleiben nur in der Notizen-App):");
    for (const s of skipped) console.log(`  - ${short(s.title, 60)}  [${s.reason}]`);
  }
  if (!ready.length) return;

  // Plan: aus dem letzten Probelauf, sonst neu zuordnen lassen.
  let plan = new Map<string, PlanEntry>();
  if (apply && fs.existsSync(PLAN_FILE)) {
    for (const e of JSON.parse(fs.readFileSync(PLAN_FILE, "utf8")) as PlanEntry[]) plan.set(e.id, e);
  }
  const open = ready.filter((n) => !plan.has(n.id));
  if (open.length) {
    console.log(`\nLasse ${open.length} Notizen Themen zuordnen (${state.settings.model}) …`);
    const topics: Pick<Topic, "name" | "group">[] = state.topics.map(({ name, group }) => ({ name, group }));
    for (let at = 0; at < open.length; at += 40) {
      const chunk = open.slice(at, at + 40);
      const items = chunk.map((n, i) => ({ index: i + 1, title: n.title, date: n.date, excerpt: short(n.content, 600) }));
      const result = await assignTopics(state.settings.model, topics, items);
      for (const a of result) {
        const note = chunk[a.index - 1];
        if (!note) continue;
        plan.set(note.id, { id: note.id, topic: a.topic.trim(), group: a.group });
        if (!topics.some((t) => t.name === a.topic.trim())) topics.push({ name: a.topic.trim(), group: a.group });
      }
    }
  }
  const missing = ready.filter((n) => !plan.has(n.id));
  for (const n of missing) plan.set(n.id, { id: n.id, topic: "Sonstiges", group: "Intern" });

  const byTopic = new Map<string, typeof ready>();
  for (const n of ready) {
    const p = plan.get(n.id)!;
    const key = `${p.group} / ${p.topic}`;
    byTopic.set(key, [...(byTopic.get(key) ?? []), n]);
  }
  console.log("\nGeplante Zuordnung:");
  for (const [key, notes] of [...byTopic].sort(([a], [b]) => a.localeCompare(b, "de"))) {
    console.log(`\n${key}`);
    for (const n of notes.sort((a, b) => a.date.localeCompare(b.date))) console.log(`  ${n.date}  ${short(n.title, 70)}`);
  }

  if (!apply) {
    fs.writeFileSync(PLAN_FILE, JSON.stringify([...plan.values()], null, 2));
    console.log('\nProbelauf, nichts geschrieben. Übernehmen mit: npm run import:notes -- --apply');
    return;
  }

  const topicIds = new Map(state.topics.map((t) => [`${t.group} / ${t.name}`, t.id]));
  let created = 0;
  for (const n of ready) {
    const p = plan.get(n.id)!;
    const key = `${p.group} / ${p.topic}`;
    let topicId = topicIds.get(key);
    if (!topicId) {
      topicId = (await call<Topic>("POST", "/topics", { name: p.topic, group: p.group })).id;
      topicIds.set(key, topicId);
    }
    await call<Note>("POST", "/notes", { topicId, date: n.date, title: n.title, content: n.content, source: { kind: "apple-notes", id: n.id } });
    created++;
  }
  fs.rmSync(PLAN_FILE, { force: true });
  console.log(`\n${created} Einträge in ${byTopic.size} Themen übernommen.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((err) => {
  console.error(err instanceof Error && err.message.startsWith("Nova Elf") ? err.message : describeAiError(err));
  process.exit(1);
});
