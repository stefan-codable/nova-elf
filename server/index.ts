import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { z } from "zod";
import { MODELS, type AppState, type ModelId, type Note, type Todo, type Topic } from "../shared/types.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  // keine .env vorhanden: Notizen funktionieren, die KI-Funktionen bleiben aus
}

const { aiReady, analyzeNote, analyzeTopic, describeAiError, isImageType, transcribe } = await import("./ai.ts");
const { commitNow, db, initGit, load, newId, now, UPLOAD_DIR } = await import("./store.ts");

load();
await initGit();

const PORT = Number(process.env.PORT || 4311);
const app = new Hono();

// Nur der eigene Rechner darf zugreifen. Die Prüfung des Host-Headers verhindert,
// dass eine fremde Webseite den lokalen Server über einen umgebogenen DNS-Namen anspricht.
app.use("*", async (c, next) => {
  const host = (c.req.header("host") ?? "").replace(/:\d+$/, "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return c.text("Nur lokal erreichbar.", 403);
  const origin = c.req.header("origin");
  if (origin && c.req.method !== "GET" && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return c.text("Fremde Herkunft.", 403);
  }
  await next();
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const modelId = z.enum(MODELS.map((m) => m.id) as [ModelId, ...ModelId[]]);

async function body<T extends z.ZodType>(c: { req: { json: () => Promise<unknown> } }, schema: T): Promise<z.infer<T>> {
  return schema.parse(await c.req.json());
}

app.onError((err, c) => {
  if (err instanceof z.ZodError) return c.json({ error: "Ungültige Eingabe." }, 400);
  console.error(err);
  return c.json({ error: (err as Error).message }, 500);
});

const api = new Hono();

api.get("/state", (c) =>
  c.json({ topics: db.topics(), notes: db.notes(), todos: db.todos(), settings: db.settings(), aiReady: aiReady() } satisfies AppState),
);

api.patch("/settings", async (c) => c.json(db.putSettings(await body(c, z.object({ model: modelId })))));

// --- Themen ---------------------------------------------------------------------

api.post("/topics", async (c) => {
  const input = await body(c, z.object({ name: z.string().trim().min(1), group: z.string().trim().min(1) }));
  const topic: Topic = { id: newId(), ...input, createdAt: now() };
  return c.json(db.putTopic(topic));
});

api.patch("/topics/:id", async (c) => {
  const topic = db.topic(c.req.param("id"));
  if (!topic) return c.json({ error: "Thema nicht gefunden." }, 404);
  const patch = await body(c, z.object({ name: z.string().trim().min(1), group: z.string().trim().min(1) }).partial());
  return c.json(db.putTopic({ ...topic, ...patch }));
});

api.delete("/topics/:id", (c) => {
  db.removeTopic(c.req.param("id"));
  return c.json({ ok: true });
});

// --- Einträge -------------------------------------------------------------------

api.post("/notes", async (c) => {
  const input = await body(c, z.object({ topicId: z.string(), date: isoDate, title: z.string().default(""), content: z.string().default("") }));
  if (!db.topic(input.topicId)) return c.json({ error: "Thema nicht gefunden." }, 404);
  const note: Note = { id: newId(), ...input, images: [], createdAt: now(), updatedAt: now() };
  return c.json(db.putNote(note));
});

api.patch("/notes/:id", async (c) => {
  const note = db.note(c.req.param("id"));
  if (!note) return c.json({ error: "Eintrag nicht gefunden." }, 404);
  const patch = await body(c, z.object({ title: z.string(), content: z.string(), date: isoDate, topicId: z.string() }).partial());
  if (patch.topicId && !db.topic(patch.topicId)) return c.json({ error: "Thema nicht gefunden." }, 404);
  return c.json(db.putNote({ ...note, ...patch, updatedAt: now() }));
});

api.delete("/notes/:id", (c) => {
  db.removeNote(c.req.param("id"));
  return c.json({ ok: true });
});

// --- Fotos ----------------------------------------------------------------------

const run = promisify(execFile);

/** iPhone-Fotos (HEIC) kann die API nicht lesen; macOS wandelt sie mit Bordmitteln um. */
async function toJpeg(file: string): Promise<string> {
  if (process.platform !== "darwin") throw new Error("HEIC-Bilder lassen sich nur unter macOS umwandeln.");
  const out = file.replace(/\.[^.]+$/, ".jpg");
  await run("sips", ["-s", "format", "jpeg", "-Z", "2400", file, "--out", out]);
  fs.unlinkSync(file);
  return out;
}

api.post("/notes/:id/images", async (c) => {
  const note = db.note(c.req.param("id"));
  if (!note) return c.json({ error: "Eintrag nicht gefunden." }, 404);
  let type = (c.req.header("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const name = decodeURIComponent(c.req.header("x-filename") ?? "Foto");
  const data = Buffer.from(await c.req.arrayBuffer());
  if (!data.length) return c.json({ error: "Leere Datei." }, 400);

  const heic = type === "image/heic" || type === "image/heif" || /\.hei[cf]$/i.test(name);
  if (!heic && !isImageType(type)) return c.json({ error: "Dieses Bildformat wird nicht unterstützt (JPEG, PNG, WebP, GIF, HEIC)." }, 415);

  const imageId = newId();
  const ext = heic ? "heic" : type.split("/")[1]!.replace("jpeg", "jpg");
  let file = path.join(UPLOAD_DIR, `${imageId}.${ext}`);
  fs.writeFileSync(file, data);
  if (heic) {
    file = await toJpeg(file);
    type = "image/jpeg";
  }

  const image = { id: imageId, file: path.basename(file), name };
  const transcribeWanted = c.req.query("transcribe") !== "0";
  let text = "";
  let error: string | undefined;
  if (transcribeWanted) {
    try {
      if (!isImageType(type)) throw new Error("Bildformat nicht lesbar.");
      text = await transcribe(db.settings().model, fs.readFileSync(file), type);
    } catch (err) {
      error = describeAiError(err);
    }
  }

  // Den Eintrag erst jetzt neu lesen: während der Auswertung kann weitergetippt worden sein.
  const fresh = db.note(note.id);
  if (!fresh) return c.json({ error: "Eintrag wurde inzwischen gelöscht." }, 404);
  db.putNote({ ...fresh, images: [...fresh.images, image], updatedAt: now() });
  return c.json({ image, text, error });
});

api.delete("/notes/:id/images/:imageId", (c) => {
  const note = db.note(c.req.param("id"));
  if (!note) return c.json({ error: "Eintrag nicht gefunden." }, 404);
  return c.json(db.putNote({ ...note, images: note.images.filter((i) => i.id !== c.req.param("imageId")), updatedAt: now() }));
});

// --- Analyse --------------------------------------------------------------------

const byDate = (a: Note, b: Note) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

api.post("/notes/:id/analyze", async (c) => {
  const note = db.note(c.req.param("id"));
  const topic = note && db.topic(note.topicId);
  if (!note || !topic) return c.json({ error: "Eintrag nicht gefunden." }, 404);
  if (!note.content.trim()) return c.json({ error: "Der Eintrag ist noch leer." }, 400);
  const earlier = db.notes().filter((n) => n.topicId === topic.id && n.id !== note.id && byDate(n, note) < 0).sort(byDate);
  const todos = db.todos().filter((t) => t.topicId === topic.id);
  try {
    const analysis = await analyzeNote(db.settings().model, topic, note, earlier, todos);
    const fresh = db.note(note.id);
    if (!fresh) return c.json({ error: "Eintrag wurde inzwischen gelöscht." }, 404);
    // updatedAt bleibt stehen: daran erkennt die Oberfläche, ob die Analyse zum Text passt.
    return c.json(db.putNote({ ...fresh, analysis: { ...analysis, createdAt: now() } }));
  } catch (err) {
    console.error(err);
    return c.json({ error: describeAiError(err) }, 502);
  }
});

api.post("/topics/:id/analyze", async (c) => {
  const topic = db.topic(c.req.param("id"));
  if (!topic) return c.json({ error: "Thema nicht gefunden." }, 404);
  const notes = db.notes().filter((n) => n.topicId === topic.id && n.content.trim()).sort(byDate);
  if (!notes.length) return c.json({ error: "Zu diesem Thema gibt es noch keine Einträge mit Inhalt." }, 400);
  const todos = db.todos().filter((t) => t.topicId === topic.id);
  try {
    const analysis = await analyzeTopic(db.settings().model, topic, notes, todos);
    const fresh = db.topic(topic.id);
    if (!fresh) return c.json({ error: "Thema wurde inzwischen gelöscht." }, 404);
    return c.json(db.putTopic({ ...fresh, analysis }));
  } catch (err) {
    console.error(err);
    return c.json({ error: describeAiError(err) }, 502);
  }
});

// --- To-dos ---------------------------------------------------------------------

api.post("/todos", async (c) => {
  const input = await body(
    c,
    z.object({
      text: z.string().trim().min(1),
      due: isoDate.nullable().default(null),
      topicId: z.string().nullable().default(null),
      noteId: z.string().nullable().default(null),
      /** Übernahme eines Vorschlags: markiert ihn in der Analyse als übernommen. */
      suggestion: z.object({ kind: z.enum(["note", "topic"]), index: z.number().int().min(0) }).optional(),
    }),
  );
  const { suggestion, ...rest } = input;
  const todo: Todo = { id: newId(), ...rest, done: false, doneAt: null, source: suggestion ? "ai" : "manual", createdAt: now() };
  db.putTodo(todo);

  let note: Note | undefined;
  let topic: Topic | undefined;
  const mark = <T extends { analysis?: Note["analysis"] }>(owner: T): T => ({
    ...owner,
    analysis: owner.analysis && {
      ...owner.analysis,
      todos: owner.analysis.todos.map((t, i) => (i === suggestion!.index ? { ...t, adopted: true } : t)),
    },
  });
  if (suggestion?.kind === "note" && todo.noteId) {
    const n = db.note(todo.noteId);
    if (n) note = db.putNote(mark(n));
  } else if (suggestion?.kind === "topic" && todo.topicId) {
    const t = db.topic(todo.topicId);
    if (t) topic = db.putTopic(mark(t));
  }
  return c.json({ todo, note, topic });
});

api.patch("/todos/:id", async (c) => {
  const todo = db.todo(c.req.param("id"));
  if (!todo) return c.json({ error: "To-do nicht gefunden." }, 404);
  const patch = await body(c, z.object({ text: z.string().trim().min(1), due: isoDate.nullable(), done: z.boolean() }).partial());
  const doneAt = patch.done === undefined ? todo.doneAt : patch.done ? now() : null;
  return c.json(db.putTodo({ ...todo, ...patch, doneAt }));
});

api.delete("/todos/:id", (c) => {
  db.removeTodo(c.req.param("id"));
  return c.json({ ok: true });
});

app.route("/api", api);

app.get("/uploads/:file", (c) => {
  const file = path.join(UPLOAD_DIR, path.basename(c.req.param("file")));
  if (!fs.existsSync(file)) return c.notFound();
  const ext = path.extname(file).slice(1);
  return c.body(fs.readFileSync(file), 200, {
    "Content-Type": `image/${ext === "jpg" ? "jpeg" : ext}`,
    "Cache-Control": "private, max-age=31536000, immutable",
  });
});

// Fertig gebaute Oberfläche (npm start). Im Entwicklungsmodus liefert Vite sie aus.
const dist = path.join(root, "dist");
if (fs.existsSync(dist)) {
  app.use("*", serveStatic({ root: path.relative(process.cwd(), dist) || "." }));
  app.get("*", (c) => c.html(fs.readFileSync(path.join(dist, "index.html"), "utf8")));
}

serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" }, () => {
  console.log(`Nova Elf läuft: http://localhost:${PORT}${fs.existsSync(dist) ? "" : "  (Oberfläche im Entwicklungsmodus: http://localhost:4310)"}`);
  if (!aiReady()) console.log("Hinweis: kein ANTHROPIC_API_KEY gesetzt, Analyse und Foto-Auswertung sind aus.");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void commitNow().finally(() => process.exit(0)));
}
