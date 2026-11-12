import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Analysis, ModelId, Note, Todo, Topic } from "../shared/types.ts";

let client: Anthropic | null = null;

export const aiReady = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

function api() {
  if (!aiReady()) throw new AiError("Kein API-Schlüssel hinterlegt. Trage ANTHROPIC_API_KEY in die Datei .env ein und starte neu.");
  return (client ??= new Anthropic());
}

export class AiError extends Error {}

/**
 * Opus und Sonnet können eine Anfrage aus Sicherheitsgründen ablehnen; mit `fallbacks`
 * wiederholt die API sie dann selbst auf einem Ersatzmodell. Haiku kennt das nicht.
 */
function fallbackParams(model: ModelId) {
  if (model === "claude-haiku-5-5") return {};
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
}

const AnalysisSchema = z.object({
  summary: z.string().describe("Zusammenfassung in 2 bis 4 Sätzen: worum ging es, was ist der Stand."),
  insights: z.array(z.string()).describe("Was sich zwischen den Zeilen herauslesen lässt: Bedarf, Chancen, Risiken, Entscheider, Budget- oder Zeitsignale. Je ein Satz."),
  recommendations: z.array(z.string()).describe("Konkrete Empfehlungen für das weitere Vorgehen, je ein Satz, wichtigste zuerst."),
  prepare: z.array(z.string()).describe("Was vor dem nächsten Gespräch oder Termin vorzubereiten ist. Leer, wenn nichts ansteht."),
  todos: z.array(
    z.object({
      text: z.string().describe("Aufgabe für den Nutzer selbst, beginnt mit einem Verb."),
      due: z.string().nullable().describe("Fälligkeit als JJJJ-MM-TT, oder null, wenn sich kein sinnvoller Termin ableiten lässt."),
      reason: z.string().describe("Ein kurzer Satz: warum diese Aufgabe, warum dieser Termin."),
    }),
  ),
});

const SYSTEM = `Du bist der persönliche Assistent eines Geschäftsführers, der Kunden gewinnt, Kundengespräche führt und interne Abstimmungen leitet. Er schreibt seine Gesprächsnotizen knapp und stichpunktartig mit, oft unvollständig und mit Tippfehlern. Du liest diese Notizen und hilfst ihm, nichts liegen zu lassen und den nächsten Schritt früh zu sehen.

Arbeite so, wie ein erfahrener Vertriebs- und Stabsmitarbeiter es täte:
- Stütze dich auf das, was in den Notizen steht. Was du nur vermutest, kennzeichne als Vermutung. Erfinde keine Namen, Zahlen oder Zusagen.
- Sei konkret. "Angebot für die Leasing-Erinnerungen bis Freitag schicken" hilft, "Follow-up machen" nicht.
- Denke voraus: Was erwartet das Gegenüber als Nächstes? Wo droht ein Thema einzuschlafen? Welche Frage ist offen geblieben und entscheidet über den Auftrag?
- To-dos sind Aufgaben für den Nutzer selbst. Leite Fälligkeiten aus dem Gesprächsdatum und dem Inhalt ab: Zugesagtes zeitnah, Nachfassen nach wenigen Werktagen, Vorbereitung rechtzeitig vor einem genannten Termin. Lege Termine auf Werktage. Schlage nur vor, was wirklich etwas bewegt, lieber drei gute als acht beliebige.
- Aufgaben, die schon als offene To-dos vorliegen, wiederholst du nicht.
- Schreibe Deutsch, knapp, ohne Floskeln und ohne Markdown-Formatierung.`;

const weekday = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const renderNote = (n: Note) => `<eintrag datum="${n.date}" titel="${n.title || "Ohne Titel"}">\n${n.content.trim() || "(leer)"}\n</eintrag>`;

function renderTodos(todos: Todo[]) {
  const open = todos.filter((t) => !t.done);
  if (!open.length) return "Keine.";
  return open.map((t) => `- ${t.text}${t.due ? ` (fällig ${t.due})` : ""}`).join("\n");
}

async function analyze(model: ModelId, prompt: string): Promise<Analysis> {
  const res = await api().beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    output_config: { effort: "medium", format: betaZodOutputFormat(AnalysisSchema) },
    ...fallbackParams(model),
  });
  if (res.stop_reason === "refusal") throw new AiError("Das Modell hat die Anfrage abgelehnt.");
  if (res.stop_reason === "max_tokens" || !res.parsed_output) throw new AiError("Die Antwort des Modells war unvollständig. Bitte noch einmal versuchen.");
  return { ...res.parsed_output, model: res.model, createdAt: new Date().toISOString() };
}

export function analyzeNote(model: ModelId, topic: Topic, note: Note, earlier: Note[], todos: Todo[]) {
  const today = new Date().toISOString().slice(0, 10);
  const history = earlier.length
    ? `Frühere Einträge zu diesem Thema, zum Verständnis des Verlaufs (älteste zuerst):\n\n${earlier.map(renderNote).join("\n\n")}\n\n`
    : "";
  return analyze(
    model,
    `Heute ist ${weekday(today)} (${today}).
Thema: ${topic.name} (Ordner: ${topic.group})

${history}Dieser Eintrag ist auszuwerten:

${renderNote(note)}

Bereits offene To-dos zu diesem Thema:
${renderTodos(todos)}

Werte den Eintrag aus. Die Zusammenfassung und die To-dos beziehen sich auf diesen Eintrag; die früheren Einträge dienen nur als Hintergrund.`,
  );
}

export function analyzeTopic(model: ModelId, topic: Topic, notes: Note[], todos: Todo[]) {
  const today = new Date().toISOString().slice(0, 10);
  return analyze(
    model,
    `Heute ist ${weekday(today)} (${today}).
Thema: ${topic.name} (Ordner: ${topic.group})

Alle Einträge zu diesem Thema (älteste zuerst):

${notes.map(renderNote).join("\n\n")}

Bereits offene To-dos zu diesem Thema:
${renderTodos(todos)}

Gib einen Überblick über das gesamte Thema: Wo stehen wir, wie hat es sich entwickelt, was ist seit dem letzten Kontakt liegen geblieben, und was ist jetzt der sinnvollste nächste Schritt? Berücksichtige, wie lange der letzte Eintrag zurückliegt.`,
  );
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
export const isImageType = (t: string): t is ImageType => (IMAGE_TYPES as readonly string[]).includes(t);

export async function transcribe(model: ModelId, data: Buffer, mediaType: ImageType): Promise<string> {
  const res = await api().beta.messages.create({
    model,
    max_tokens: 16000,
    output_config: { effort: "low" },
    system:
      "Du überträgst fotografierte Gesprächsnotizen (Handschrift, Whiteboard, Bildschirmfoto) in Text. Gib ausschließlich den übertragenen Text aus, ohne Einleitung und ohne Kommentar.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: data.toString("base64") } },
          {
            type: "text",
            text: `Übertrage die Notizen auf dem Bild vollständig und wortgetreu.
- Behalte die Gliederung bei: Stichpunkte als "- ", Unterpunkte mit zwei Leerzeichen eingerückt, Überschriften als eigene Zeile.
- Korrigiere nichts inhaltlich und ergänze nichts. Offensichtliche Abkürzungen bleiben, wie sie sind.
- Was du nicht entziffern kannst, markierst du als [unleserlich]; bei unsicheren Wörtern setzt du ein [?] dahinter.
- Skizzen oder Pfeile beschreibst du knapp in eckigen Klammern, wenn sie Inhalt tragen.
- Enthält das Bild keine Notizen, beschreibe in einem Satz in eckigen Klammern, was zu sehen ist.`,
          },
        ],
      },
    ],
    ...fallbackParams(model),
  });
  if (res.stop_reason === "refusal") throw new AiError("Das Modell hat die Auswertung des Bildes abgelehnt.");
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
}

/** Macht aus SDK-Fehlern eine Meldung, die in der Oberfläche etwas sagt. */
export function describeAiError(err: unknown): string {
  if (err instanceof AiError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "Der API-Schlüssel wurde abgelehnt. Bitte ANTHROPIC_API_KEY in .env prüfen.";
  if (err instanceof Anthropic.PermissionDeniedError) return "Der API-Schlüssel hat keinen Zugriff auf dieses Modell.";
  if (err instanceof Anthropic.NotFoundError) return "Das gewählte Modell ist für diesen Schlüssel nicht verfügbar.";
  if (err instanceof Anthropic.RateLimitError) return "Zu viele Anfragen. Bitte kurz warten und noch einmal versuchen.";
  if (err instanceof Anthropic.APIConnectionError) return "Keine Verbindung zur Claude API. Besteht eine Internetverbindung?";
  if (err instanceof Anthropic.APIError) return `Die Claude API meldet einen Fehler (${err.status ?? "?"}): ${err.message}`;
  return `Unerwarteter Fehler: ${(err as Error).message}`;
}
