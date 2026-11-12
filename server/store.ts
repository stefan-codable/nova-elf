import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Note, Settings, Todo, Topic } from "../shared/types.ts";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.resolve(process.env.NOVA_ELF_DATA || path.join(here, "..", "data"));
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const NOTES_DIR = path.join(DATA_DIR, "notes");
const TRASH_DIR = path.join(DATA_DIR, "papierkorb");

const topics = new Map<string, Topic>();
const notes = new Map<string, Note>();
const todos = new Map<string, Todo>();
let settings: Settings = { model: "claude-opus-5-5" };

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw new Error(`Datei ${file} ist nicht lesbar: ${(err as Error).message}`);
  }
}

/** Erst in eine Nachbardatei schreiben, dann umbenennen: nie eine halb geschriebene Datei. */
function writeJson(file: string, value: unknown) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, file);
  scheduleCommit();
}

export function load() {
  for (const dir of [DATA_DIR, UPLOAD_DIR, NOTES_DIR, TRASH_DIR]) fs.mkdirSync(dir, { recursive: true });
  for (const t of readJson<Topic[]>(path.join(DATA_DIR, "topics.json"), [])) topics.set(t.id, t);
  for (const t of readJson<Todo[]>(path.join(DATA_DIR, "todos.json"), [])) todos.set(t.id, t);
  settings = { ...settings, ...readJson<Partial<Settings>>(path.join(DATA_DIR, "settings.json"), {}) };
  for (const f of fs.readdirSync(NOTES_DIR)) {
    if (!f.endsWith(".json")) continue;
    const n = readJson<Note | null>(path.join(NOTES_DIR, f), null);
    if (n) notes.set(n.id, n);
  }
}

const saveTopics = () => writeJson(path.join(DATA_DIR, "topics.json"), [...topics.values()]);
const saveTodos = () => writeJson(path.join(DATA_DIR, "todos.json"), [...todos.values()]);
const notePath = (id: string) => path.join(NOTES_DIR, `${id}.json`);

export const newId = () => crypto.randomUUID().replaceAll("-", "").slice(0, 12);
export const now = () => new Date().toISOString();

export const db = {
  topics: () => [...topics.values()],
  notes: () => [...notes.values()],
  todos: () => [...todos.values()],
  settings: () => settings,

  topic: (id: string) => topics.get(id),
  note: (id: string) => notes.get(id),
  todo: (id: string) => todos.get(id),

  putTopic(t: Topic) {
    topics.set(t.id, t);
    saveTopics();
    return t;
  },
  putNote(n: Note) {
    notes.set(n.id, n);
    writeJson(notePath(n.id), n);
    return n;
  },
  putTodo(t: Todo) {
    todos.set(t.id, t);
    saveTodos();
    return t;
  },
  putSettings(s: Settings) {
    settings = s;
    writeJson(path.join(DATA_DIR, "settings.json"), s);
    return s;
  },

  /** Gelöschtes landet im Ordner "papierkorb" und bleibt dort liegen. */
  removeNote(id: string) {
    if (!notes.delete(id)) return;
    fs.renameSync(notePath(id), path.join(TRASH_DIR, `notiz-${id}-${Date.now()}.json`));
    for (const t of todos.values()) if (t.noteId === id) t.noteId = null;
    saveTodos();
  },
  removeTopic(id: string) {
    const topic = topics.get(id);
    if (!topic) return;
    for (const n of [...notes.values()]) if (n.topicId === id) db.removeNote(n.id);
    for (const t of todos.values()) if (t.topicId === id) t.topicId = null;
    fs.writeFileSync(path.join(TRASH_DIR, `thema-${id}-${Date.now()}.json`), JSON.stringify(topic, null, 2));
    topics.delete(id);
    saveTopics();
    saveTodos();
  },
  removeTodo(id: string) {
    if (todos.delete(id)) saveTodos();
  },
};

// --- Sicherung: der Datenordner ist ein eigenes Git-Repository -----------------

let gitOk = false;
let timer: NodeJS.Timeout | null = null;
const git = (...args: string[]) => run("git", args, { cwd: DATA_DIR });

export async function initGit() {
  try {
    if (!fs.existsSync(path.join(DATA_DIR, ".git"))) {
      await git("init", "-q", "-b", "main");
      fs.writeFileSync(path.join(DATA_DIR, ".gitignore"), "*.tmp\n.DS_Store\n");
    }
    gitOk = true;
    await commitNow();
  } catch (err) {
    console.warn(`Git-Sicherung nicht aktiv: ${(err as Error).message}`);
  }
}

function scheduleCommit() {
  if (!gitOk) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void commitNow(), 30_000);
}

export async function commitNow() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!gitOk) return;
  try {
    await git("add", "-A");
    const { stdout } = await git("status", "--porcelain");
    if (!stdout.trim()) return;
    await git(
      "-c", "user.name=Nova Elf", "-c", "user.email=nova-elf@localhost", "-c", "commit.gpgsign=false",
      "commit", "-q", "-m", `Stand ${new Date().toLocaleString("de-DE")}`,
    );
    // Liegt ein Remote namens "origin" vor, wird dorthin gesichert; Fehler (offline) sind unkritisch.
    const remotes = (await git("remote")).stdout;
    if (remotes.split("\n").includes("origin")) await git("push", "-q", "origin", "HEAD").catch(() => {});
  } catch (err) {
    console.warn(`Git-Sicherung fehlgeschlagen: ${(err as Error).message}`);
  }
}
