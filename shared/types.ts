export const MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", hint: "gründlich" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "ausgewogen" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", hint: "schnell, günstig" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export interface Topic {
  id: string;
  name: string;
  /** Ordner in der linken Spalte, z. B. "Kunden" oder "Intern". */
  group: string;
  createdAt: string;
  analysis?: Analysis;
}

export interface NoteImage {
  id: string;
  file: string;
  name: string;
}

export interface Note {
  id: string;
  topicId: string;
  title: string;
  /** Datum des Gesprächs, JJJJ-MM-TT. */
  date: string;
  content: string;
  images: NoteImage[];
  createdAt: string;
  updatedAt: string;
  analysis?: Analysis;
  /** Herkunft eines importierten Eintrags; verhindert Dubletten bei erneutem Import. */
  source?: NoteSource;
}

export interface NoteSource {
  kind: "apple-notes";
  id: string;
}

export interface SuggestedTodo {
  text: string;
  due: string | null;
  reason: string;
  adopted?: boolean;
}

export interface Analysis {
  summary: string;
  insights: string[];
  recommendations: string[];
  prepare: string[];
  todos: SuggestedTodo[];
  model: string;
  createdAt: string;
}

export interface Todo {
  id: string;
  text: string;
  due: string | null;
  done: boolean;
  doneAt: string | null;
  topicId: string | null;
  noteId: string | null;
  source: "ai" | "manual";
  createdAt: string;
}

export interface Settings {
  model: ModelId;
}

export interface AppState {
  topics: Topic[];
  notes: Note[];
  todos: Todo[];
  settings: Settings;
  aiReady: boolean;
}
