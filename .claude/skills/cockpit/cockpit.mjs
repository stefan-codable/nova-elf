#!/usr/bin/env node
// Abgleich daten/ <-> Cockpit-Datenbank. Rechnet nur; die Datenbank liest und schreibt Claude mit ArtifactData.
//   node cockpit.mjs holen <ist-ordner>   Cockpit-Änderungen (Haken, Datum, Reihenfolge, Eingang) nach daten/ übernehmen
//   node cockpit.mjs senden <ist-ordner>  Stand aus daten/ als Schreibplan für die Datenbank vorbereiten
// <ist-ordner> = out_dir eines ArtifactData-list (Dateien <ordner>/<collection>/<id>.json).
// Ergebnis: .cockpit/plan.json = { batches: [[{op, collection, doc_id, file_path?, if_version?}, ...]], info }.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."));
const D = join(ROOT, "daten");
const WORK = join(ROOT, ".cockpit");
const SOLL = join(WORK, "soll");
const PLAN = join(WORK, "plan.json");
const [cmd, istArg] = process.argv.slice(2);

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const write = (p, s) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s); };
const now = () => new Date().toISOString();
const heute = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

// --- Ist-Stand aus ArtifactData out_dir lesen. Die Dateien enthalten keine Version: Claude trägt sie
// aus dem list-Ergebnis in <ist-ordner>/versionen.json ein ({"aufgaben/<id>": 3}) oder ersetzt "AUS_LISTE" im Plan. ---
let _v;
const versionen = () => (_v ??= istArg && existsSync(join(resolve(istArg), "versionen.json")) ? readJson(join(resolve(istArg), "versionen.json")) : {});
function ist(collection) {
  const dir = istArg ? join(resolve(istArg), collection) : null;
  const out = new Map();
  if (!dir || !existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const raw = readJson(join(dir, f));
    const id = raw.doc_id ?? raw.id ?? f.replace(/\.json$/, "");
    const version = raw.version ?? raw._version ?? raw.__version__ ?? raw.meta?.version ?? versionen()[`${collection}/${id}`] ?? "AUS_LISTE";
    const data = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : raw;
    out.set(id, { version, data });
  }
  return out;
}

// --- Markdown-Abschnitte einer _uebersicht.md ---
function abschnitte(md) {
  const kopf = {}; let body = md;
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (m) { body = md.slice(m[0].length); for (const l of m[1].split("\n")) { const i = l.indexOf(":"); if (i > 0) kopf[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"(.*)"$/, "$1"); } }
  const teile = {}; let akt = null;
  for (const l of body.split("\n")) {
    const h = l.match(/^##\s+(.*)$/);
    if (h) { akt = h[1].trim(); teile[akt] = []; continue; }
    if (akt) teile[akt].push(l);
  }
  const text = (k) => (teile[k] || []).join("\n").trim().replace(/^\(noch nicht zusammengefasst\)$/, "");
  const liste = (k) => (teile[k] || []).filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim());
  return { kopf, text, liste };
}

function sollBauen() {
  rmSync(SOLL, { recursive: true, force: true });
  const docs = { aufgaben: new Map(), kunden: new Map(), meta: new Map() };
  const namen = new Map();

  for (const bereich of ["kunden", "intern", "privat"]) {
    const p = join(D, bereich);
    if (!existsSync(p)) continue;
    for (const e of readdirSync(p, { withFileTypes: true }).filter((x) => x.isDirectory())) {
      const ordner = `${bereich}/${e.name}`;
      const { kopf, text, liste } = abschnitte(read(join(p, e.name, "_uebersicht.md")));
      const daten = readdirSync(join(p, e.name)).map((f) => f.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1]).filter(Boolean).sort();
      const name = kopf.name || e.name;
      namen.set(ordner, name);
      docs.kunden.set(`${bereich}--${e.name}`, {
        name, bereich, ordner,
        stand: text("Stand"), naechster: text("Nächster Schritt"),
        offen: liste("Offene Punkte"), ansprechpartner: liste("Ansprechpartner"),
        letzterKontakt: daten.at(-1) ?? null,
      });
    }
  }

  const aufgaben = JSON.parse(read(join(D, "aufgaben.json")) || "[]");
  const grenze = new Date(Date.now() - 30 * 86400000).toISOString();
  for (const a of aufgaben) {
    if (a.erledigt && (a.erledigtAm || "") < grenze) continue; // altes Erledigtes bleibt nur in daten/
    docs.aufgaben.set(a.id, {
      text: a.text, faellig: a.faellig ?? null, erledigt: !!a.erledigt, erledigtAm: a.erledigtAm ?? null,
      ordner: a.ordner ?? null, kunde: a.ordner ? namen.get(a.ordner) ?? a.ordner : null,
      reihenfolge: a.reihenfolge ?? 0, quelle: a.quelle ?? null, ausCockpit: false,
    });
  }

  // Briefing von heute, sonst das nächste vorbereitete (z. B. Sonntagabend für Montag).
  const bdir = join(D, "briefings");
  const bdatum = existsSync(bdir)
    ? readdirSync(bdir).map((f) => /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1]).filter((d) => d && d >= heute()).sort()[0]
    : undefined;
  docs.meta.set("heute", bdatum ? { datum: bdatum, ...readJson(join(bdir, `${bdatum}.json`)) } : { datum: null, termine: [] });
  const offen = aufgaben.filter((a) => !a.erledigt).length;
  const rf = read(join(D, "wissen", "rueckfragen.md")).split("\n").filter((l) => /^\d+\.\s/.test(l)).length;
  docs.meta.set("stand", { offeneAufgaben: offen, rueckfragen: rf });
  return docs;
}

// Die Datenbank liefert Schlüssel alphabetisch sortiert: kanonisch vergleichen.
const kanon = (x) => Array.isArray(x) ? x.map(kanon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, kanon(x[k])])) : x;
const gleich = (a, b) => JSON.stringify(kanon(a)) === JSON.stringify(kanon(b));
const ohne = (o, ...keys) => { const c = { ...o }; for (const k of keys) delete c[k]; return c; };

function planSchreiben(writes, info) {
  const batches = [];
  for (let i = 0; i < writes.length; i += 50) batches.push(writes.slice(i, i + 50));
  write(PLAN, JSON.stringify({ batches, info }, null, 2));
  console.log(JSON.stringify({ plan: PLAN, schreibvorgaenge: writes.length, batches: batches.length, ...info }));
}

if (cmd === "senden") {
  const istA = ist("aufgaben"), istE = ist("eingang");
  const offenA = [...istA.values()].filter((x) => x.data.ausCockpit).length;
  const offenE = [...istE.values()].filter((x) => x.data.status === "neu").length;
  if (offenA || offenE) { console.error(`Zuerst holen: ${offenA} Aufgabe(n) und ${offenE} Eingang-Punkt(e) aus dem Cockpit sind noch nicht übernommen.`); process.exit(2); }
  const soll = sollBauen();
  const writes = [];
  const info = { neu: 0, geaendert: 0, geloescht: 0, unveraendert: 0 };
  for (const [col, map] of Object.entries(soll)) {
    const vorhanden = ist(col);
    for (const [id, data] of map) {
      const v = vorhanden.get(id);
      const body = col === "meta" && id === "stand" ? { ...data, aktualisiert: now() } : data;
      const vergleich = (x) => ohne(x, "aktualisiert", "geaendertAm");
      if (v && gleich(vergleich(v.data), vergleich(body)) && !(col === "meta" && id === "stand")) { info.unveraendert++; continue; }
      const fp = join(SOLL, col, `${id}.json`);
      write(fp, JSON.stringify(body));
      writes.push({ op: "set", collection: col, doc_id: id, file_path: fp, ...(v ? { if_version: v.version } : {}) });
      v ? info.geaendert++ : info.neu++;
    }
    if (col !== "meta") for (const [id, v] of vorhanden) if (!map.has(id)) { writes.push({ op: "delete", collection: col, doc_id: id, if_version: v.version }); info.geloescht++; }
  }
  // meta/stand zuletzt, damit der Zeitstempel erst nach den Daten springt
  writes.sort((a, b) => (a.collection === "meta") - (b.collection === "meta"));
  planSchreiben(writes, info);
} else if (cmd === "holen") {
  const pfad = join(D, "aufgaben.json");
  const aufgaben = JSON.parse(read(pfad) || "[]");
  const byId = new Map(aufgaben.map((a) => [a.id, a]));
  const writes = []; const protokoll = []; const info = { aufgaben: 0, eingang: 0, unbekannt: 0 };
  for (const [id, v] of ist("aufgaben")) {
    if (!v.data.ausCockpit) continue;
    const a = byId.get(id);
    if (!a) { info.unbekannt++; continue; }
    const vorher = { erledigt: a.erledigt, faellig: a.faellig, reihenfolge: a.reihenfolge };
    a.erledigt = !!v.data.erledigt; a.erledigtAm = v.data.erledigtAm ?? null;
    a.faellig = v.data.faellig ?? null; a.reihenfolge = v.data.reihenfolge ?? a.reihenfolge;
    const was = [];
    if (vorher.erledigt !== a.erledigt) was.push(a.erledigt ? "erledigt" : "wieder offen");
    if (vorher.faellig !== a.faellig) was.push(`fällig ${a.faellig ?? "ohne Datum"}`);
    if (vorher.reihenfolge !== a.reihenfolge) was.push("Reihenfolge");
    if (was.length) protokoll.push(`Cockpit: „${a.text.slice(0, 60)}“ ${was.join(", ")}`);
    writes.push({ op: "update", collection: "aufgaben", doc_id: id, data: { ausCockpit: false }, if_version: v.version });
    info.aufgaben++;
  }
  writeFileSync(pfad, JSON.stringify(aufgaben, null, 2) + "\n");

  const neu = [...ist("eingang")].filter(([, v]) => v.data.status === "neu").sort((a, b) => (a[1].data.erstellt || "").localeCompare(b[1].data.erstellt || ""));
  if (neu.length) {
    const ep = join(D, "eingang.md"); const md = read(ep);
    const zeilen = neu.map(([, v]) => { const t = new Date(v.data.erstellt || Date.now()); const s = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString(); return `- ${s.slice(0, 10)} ${s.slice(11, 16)} | Cockpit | ${String(v.data.text || "").replace(/\s*\n\s*/g, " / ")}`; });
    const i = md.search(/^- \d{4}-/m);
    writeFileSync(ep, i < 0 ? md.replace(/\n*$/, "\n\n") + zeilen.reverse().join("\n") + "\n" : md.slice(0, i) + zeilen.reverse().join("\n") + "\n" + md.slice(i));
    for (const [id, v] of neu) writes.push({ op: "delete", collection: "eingang", doc_id: id, if_version: v.version });
    protokoll.push(`Cockpit: ${neu.length} Punkt(e) in den Eingang übernommen`);
    info.eingang = neu.length;
  }
  if (protokoll.length) {
    const pp = join(D, "protokoll.md"); const md = read(pp); const i = md.search(/^- \d{4}-/m);
    const zeilen = protokoll.map((p) => `- ${heute()} | ${p} | aufgaben.json, eingang.md`).join("\n") + "\n";
    writeFileSync(pp, i < 0 ? md + zeilen : md.slice(0, i) + zeilen + md.slice(i));
  }
  planSchreiben(writes, info);
} else {
  console.error("Aufruf: node cockpit.mjs holen|senden <ist-ordner>");
  process.exit(1);
}
