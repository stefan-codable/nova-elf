// Einmaliger Umzug: Web-App-Daten (data/, JSON) -> Elf-Ablage (daten/, Markdown + aufgaben.json).
// Liest data/ nur, schreibt nur in daten/. Bricht ab, wenn daten/ schon Einträge hat.
// Aufruf: node scripts/elf-umzug.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "data");
const DST = join(root, "daten");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const write = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };

if (existsSync(join(DST, "aufgaben.json"))) {
  console.error("daten/aufgaben.json existiert schon. Umzug läuft nur einmal.");
  process.exit(1);
}

const slug = (s) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "ohne-titel";

const GROUP = { Kunden: "kunden", Intern: "intern", Privat: "privat" };
const ART = { kunden: "kunde", intern: "intern", privat: "privat" };

const topics = readJson(join(SRC, "topics.json"));
const todos = readJson(join(SRC, "todos.json"));
const notes = readdirSync(join(SRC, "notes")).filter((f) => f.endsWith(".json")).map((f) => readJson(join(SRC, "notes", f)));

// Thema -> Ordner
const folderOf = new Map();
for (const t of topics) {
  const g = GROUP[t.group] ?? slug(t.group);
  folderOf.set(t.id, `${g}/${slug(t.name)}`);
}

const list = (title, items) => (items?.length ? `\n**${title}**\n${items.map((x) => `- ${x}`).join("\n")}\n` : "");
const analysisMd = (a, heading) => {
  if (!a) return "";
  const todosTxt = (a.todos ?? []).map((t) => `${t.text}${t.due ? ` (bis ${t.due})` : ""}`);
  return `\n\n## ${heading} (${a.model}, ${a.createdAt.slice(0, 10)})\n\n**Zusammenfassung:** ${a.summary}\n` +
    list("Erkenntnisse", a.insights) + list("Empfehlungen", a.recommendations) +
    list("Vorbereiten", a.prepare) + list("Vorgeschlagene To-dos", todosTxt);
};

// Einträge
const noteFile = new Map();
const used = new Set();
let imgCount = 0;
for (const n of notes.sort((a, b) => a.date.localeCompare(b.date))) {
  const folder = folderOf.get(n.topicId) ?? "eingang-unklar";
  let base = `${folder}/${n.date}-${slug(n.title)}`;
  let name = `${base}.md`;
  for (let i = 2; used.has(name); i++) name = `${base}-${i}.md`;
  used.add(name);
  noteFile.set(n.id, name);

  const bilder = [];
  for (const img of n.images ?? []) {
    const from = join(SRC, "uploads", img.file);
    if (existsSync(from)) {
      mkdirSync(join(DST, "anhaenge"), { recursive: true });
      copyFileSync(from, join(DST, "anhaenge", img.file));
      bilder.push(`anhaenge/${img.file}`);
      imgCount++;
    }
  }
  const quelle = n.source?.kind === "apple-notes" ? "apple-notes" : "nova-elf";
  const head = [
    "---",
    `id: ${n.id}`,
    `datum: ${n.date}`,
    `titel: ${JSON.stringify(n.title)}`,
    "art: notiz",
    `quelle: ${quelle}`,
    ...(bilder.length ? [`bilder: [${bilder.join(", ")}]`] : []),
    "---",
    "",
  ].join("\n");
  write(join(DST, name), `${head}# ${n.title}\n\n${n.content.trim()}\n${analysisMd(n.analysis, "Auswertung Nova Elf")}`);
}

// Übersicht je Thema
for (const t of topics) {
  const folder = folderOf.get(t.id);
  const art = ART[folder.split("/")[0]] ?? "sonstiges";
  write(join(DST, folder, "_uebersicht.md"),
    `---\nname: ${JSON.stringify(t.name)}\nart: ${art}\nangelegt: ${t.createdAt.slice(0, 10)}\n---\n# ${t.name}\n\n` +
    `## Stand\n\n(noch nicht zusammengefasst)\n\n## Nächster Schritt\n\n## Offene Punkte\n\n## Ansprechpartner\n` +
    analysisMd(t.analysis, "Themen-Auswertung Nova Elf"));
}

// Aufgaben
const aufgaben = todos.map((t, i) => ({
  id: t.id,
  text: t.text,
  faellig: t.due,
  erledigt: t.done,
  erledigtAm: t.doneAt,
  ordner: t.topicId ? folderOf.get(t.topicId) ?? null : null,
  eintrag: t.noteId ? noteFile.get(t.noteId) ?? null : null,
  quelle: t.source === "ai" ? "ki" : "manuell",
  reihenfolge: i + 1,
  erstellt: t.createdAt,
}));
write(join(DST, "aufgaben.json"), JSON.stringify(aufgaben, null, 2) + "\n");

write(join(DST, "eingang.md"), "# Eingang\n\nNoch nicht Einsortiertes, neuestes oben. Format: `- JJJJ-MM-TT HH:MM | Quelle | Text`\n\n");
write(join(DST, "protokoll.md"), `# Protokoll\n\nWas Elf geändert hat, neueste Zeile oben. Format: \`- JJJJ-MM-TT | Aktion | Datei(en)\`\n\n- ${new Date().toISOString().slice(0, 10)} | Umzug aus der Web-App: ${notes.length} Einträge, ${topics.length} Themen, ${todos.length} Aufgaben, ${imgCount} Bilder | alle\n`);
write(join(DST, ".gitignore"), ".DS_Store\n*.tmp\n");

console.log(`Umzug fertig: ${notes.length} Einträge, ${topics.length} Themen, ${todos.length} Aufgaben, ${imgCount} Bilder -> daten/`);
