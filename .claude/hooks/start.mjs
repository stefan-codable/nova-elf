#!/usr/bin/env node
// Session-Start für Elf: Datum, Kurzprofil, Ordner, fällige Aufgaben, Eingang, offene Rückfragen.
// Gibt additionalContext aus (Claude Code kappt bei 10.000 Zeichen, Budget hier 9.000).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.CLAUDE_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const D = join(root, "daten");
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const cut = (s, max) => (s.length <= max ? s : s.slice(0, max).replace(/\n[^\n]*$/, "") + "\n[… gekürzt, ganze Datei lesen]");

const now = new Date();
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const heute = iso(now);
const in7 = iso(new Date(now.getTime() + 7 * 86400000));
const tag = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const out = [];
out.push(`Elf ist aktiv. Heute ist ${tag} (${heute}). Regeln und Ablage: CLAUDE.md.`);

if (!existsSync(D)) {
  out.push("Achtung: daten/ fehlt. Nichts anlegen, Stefan fragen.");
} else {
  const profil = read(join(D, "wissen", "kurzprofil.md")).trim();
  out.push(profil ? `\n## Kurzprofil (daten/wissen/kurzprofil.md)\n${cut(profil, 3000)}` : "\nKurzprofil fehlt noch (daten/wissen/kurzprofil.md).");

  // Ordner je Bereich
  const ordner = [];
  for (const bereich of ["kunden", "intern", "privat"]) {
    const p = join(D, bereich);
    if (!existsSync(p)) continue;
    const namen = readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    if (namen.length) ordner.push(`- ${bereich}: ${namen.join(", ")}`);
  }
  if (ordner.length) out.push(`\n## Ordner\n${cut(ordner.join("\n"), 1500)}`);

  // Aufgaben
  let aufgaben = [];
  try { aufgaben = JSON.parse(read(join(D, "aufgaben.json")) || "[]"); } catch { out.push("\nAchtung: aufgaben.json ist kein gültiges JSON."); }
  const offen = aufgaben.filter((a) => !a.erledigt);
  const zeile = (a) => `- ${a.faellig ?? "ohne Datum"} | ${a.text}${a.ordner ? ` [${a.ordner}]` : ""} (id ${a.id})`;
  const ueber = offen.filter((a) => a.faellig && a.faellig < heute).sort((a, b) => a.faellig.localeCompare(b.faellig));
  const heuteF = offen.filter((a) => a.faellig === heute);
  const bald = offen.filter((a) => a.faellig && a.faellig > heute && a.faellig <= in7).sort((a, b) => a.faellig.localeCompare(b.faellig));
  const ohne = offen.filter((a) => !a.faellig).length;
  const teile = [];
  if (ueber.length) teile.push(`Überfällig (${ueber.length}):\n${ueber.slice(0, 15).map(zeile).join("\n")}`);
  if (heuteF.length) teile.push(`Heute (${heuteF.length}):\n${heuteF.map(zeile).join("\n")}`);
  if (bald.length) teile.push(`Nächste 7 Tage (${bald.length}):\n${bald.slice(0, 15).map(zeile).join("\n")}`);
  out.push(`\n## Aufgaben (${offen.length} offen, ${ohne} ohne Datum)\n${teile.length ? cut(teile.join("\n"), 2500) : "Nichts fällig in den nächsten 7 Tagen."}`);

  // Eingang
  const eingang = read(join(D, "eingang.md")).split("\n").filter((l) => /^- \d{4}-\d{2}-\d{2}/.test(l));
  if (eingang.length) out.push(`\n## Eingang: ${eingang.length} Punkt(e) noch nicht einsortiert (daten/eingang.md). Anbieten, sie mit Skill erfassen einzusortieren.`);

  // Cockpit
  if (existsSync(join(root, ".claude", "skills", "cockpit", "artefakt.json"))) {
    out.push("\n## Cockpit: Bevor du auf Stefans erste Nachricht eingehst, Skill cockpit „Holen“ ausführen (Haken, Verschiebungen und Eingang aus dem Cockpit). Nach Änderungen an Aufgaben, Übersichten oder Briefing am Ende der Antwort „Senden“.");
  }

  // Offene Rückfragen
  const rf = read(join(D, "wissen", "rueckfragen.md")).split("\n").filter((l) => /^\d+\.\s/.test(l));
  if (rf.length) out.push(`\n## Offene Rückfragen: ${rf.length} (daten/wissen/rueckfragen.md). Bei passender Gelegenheit zwei bis vier davon mit AskUserQuestion stellen, Antworten mit Skill lernen einarbeiten und die Frage aus der Liste nehmen.`);
}

const ctx = cut(out.join("\n"), 9000);
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: ctx } }));
