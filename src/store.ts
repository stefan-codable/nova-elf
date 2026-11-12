import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, ModelId, Note, NoteImage, Todo, Topic } from "../shared/types.ts";
import { api, shrinkImage } from "./api.ts";
import { today } from "./util.ts";

export type SaveStatus = "saved" | "saving" | "error";
type NotePatch = Partial<Pick<Note, "title" | "content" | "date" | "topicId">>;

/** Hält den gesamten Datenbestand im Browser und schreibt jede Änderung an den lokalen Server. */
export function useStore() {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Getippter Text wird sofort angezeigt und kurz gesammelt, bevor er gespeichert wird.
  const pending = useRef(new Map<string, { patch: NotePatch; timer: number }>());
  const inFlight = useRef(0);

  useEffect(() => {
    api<AppState>("GET", "/state").then(setState, (e: Error) => setLoadError(e.message));
  }, []);

  const update = (fn: (s: AppState) => AppState) => setState((s) => (s ? fn(s) : s));
  const patchNote = (id: string, fn: (n: Note) => Note) => update((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? fn(n) : n)) }));
  const patchTopic = (id: string, fn: (t: Topic) => Topic) => update((s) => ({ ...s, topics: s.topics.map((t) => (t.id === id ? fn(t) : t)) }));

  const fail = useCallback((e: unknown) => {
    setError((e as Error).message);
    throw e;
  }, []);

  const flush = useCallback(async (id: string, keepalive = false) => {
    const entry = pending.current.get(id);
    if (!entry) return;
    window.clearTimeout(entry.timer);
    pending.current.delete(id);
    inFlight.current++;
    try {
      await api("PATCH", `/notes/${id}`, entry.patch, { keepalive });
      inFlight.current--;
      if (!pending.current.size && !inFlight.current) setSaveStatus("saved");
    } catch (e) {
      inFlight.current--;
      // Nichts verlieren: die Änderung bleibt vorgemerkt und geht mit dem nächsten Tastendruck erneut raus.
      const later = pending.current.get(id);
      pending.current.set(id, { patch: { ...entry.patch, ...later?.patch }, timer: later?.timer ?? 0 });
      setSaveStatus("error");
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const flushAll = () => {
      for (const id of [...pending.current.keys()]) void flush(id, true);
    };
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", flushAll);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", flushAll);
    };
  }, [flush]);

  const actions = useMemo(() => {
    const editNote = (id: string, patch: NotePatch) => {
      patchNote(id, (n) => ({ ...n, ...patch, updatedAt: new Date().toISOString() }));
      const prev = pending.current.get(id);
      if (prev) window.clearTimeout(prev.timer);
      pending.current.set(id, { patch: { ...prev?.patch, ...patch }, timer: window.setTimeout(() => void flush(id), 500) });
      setSaveStatus("saving");
    };

    return {
      dismissError: () => setError(null),

      async createTopic(name: string, group: string) {
        const topic = await api<Topic>("POST", "/topics", { name, group }).catch(fail);
        update((s) => ({ ...s, topics: [...s.topics, topic] }));
        return topic;
      },
      async updateTopic(id: string, patch: Partial<Pick<Topic, "name" | "group">>) {
        patchTopic(id, (t) => ({ ...t, ...patch }));
        await api("PATCH", `/topics/${id}`, patch).catch(fail);
      },
      async deleteTopic(id: string) {
        await api("DELETE", `/topics/${id}`).catch(fail);
        update((s) => ({
          ...s,
          topics: s.topics.filter((t) => t.id !== id),
          notes: s.notes.filter((n) => n.topicId !== id),
          todos: s.todos.map((t) => (t.topicId === id ? { ...t, topicId: null, noteId: null } : t)),
        }));
      },

      async createNote(topicId: string) {
        const note = await api<Note>("POST", "/notes", { topicId, date: today() }).catch(fail);
        update((s) => ({ ...s, notes: [...s.notes, note] }));
        return note;
      },
      editNote,
      /** Verschiebt einen Eintrag samt seinen To-dos in ein anderes Thema. */
      async moveNote(id: string, topicId: string) {
        await flush(id);
        await api("PATCH", `/notes/${id}`, { topicId }).catch(fail);
        update((s) => ({
          ...s,
          notes: s.notes.map((n) => (n.id === id ? { ...n, topicId } : n)),
          todos: s.todos.map((t) => (t.noteId === id ? { ...t, topicId } : t)),
        }));
      },
      async deleteNote(id: string) {
        const entry = pending.current.get(id);
        if (entry) window.clearTimeout(entry.timer);
        pending.current.delete(id);
        await api("DELETE", `/notes/${id}`).catch(fail);
        update((s) => ({
          ...s,
          notes: s.notes.filter((n) => n.id !== id),
          todos: s.todos.map((t) => (t.noteId === id ? { ...t, noteId: null } : t)),
        }));
      },

      /** Lädt ein Foto hoch; mit `transcribe` wird es ausgelesen und der Text an den Eintrag angehängt. */
      async addImage(noteId: string, file: File, transcribe: boolean) {
        await flush(noteId);
        const blob = await shrinkImage(file);
        let res: Response;
        try {
          res = await fetch(`/api/notes/${noteId}/images?transcribe=${transcribe ? 1 : 0}`, {
            method: "POST",
            headers: { "Content-Type": blob.type || file.type || "application/octet-stream", "X-Filename": encodeURIComponent(file.name) },
            body: blob,
          });
        } catch {
          return fail(new Error("Der lokale Server antwortet nicht."));
        }
        const data = (await res.json().catch(() => ({}))) as { image?: NoteImage; text?: string; error?: string };
        if (!res.ok || !data.image) return fail(new Error(data.error ?? "Das Foto konnte nicht gespeichert werden."));
        const image = data.image;
        patchNote(noteId, (n) => ({ ...n, images: [...n.images, image] }));
        if (data.text) {
          const note = stateRef.current?.notes.find((n) => n.id === noteId);
          if (note) editNote(noteId, { content: `${note.content.trimEnd()}${note.content.trim() ? "\n\n" : ""}${data.text}\n` });
        }
        if (data.error) setError(`Foto gespeichert, aber nicht ausgelesen: ${data.error}`);
      },
      async removeImage(noteId: string, imageId: string) {
        await flush(noteId);
        await api("DELETE", `/notes/${noteId}/images/${imageId}`).catch(fail);
        patchNote(noteId, (n) => ({ ...n, images: n.images.filter((i) => i.id !== imageId) }));
      },

      async analyzeNote(id: string) {
        await flush(id);
        const res = await api<Note>("POST", `/notes/${id}/analyze`).catch(fail);
        patchNote(id, (n) => ({ ...n, analysis: res.analysis }));
      },
      async analyzeTopic(id: string) {
        await Promise.all([...pending.current.keys()].map((k) => flush(k)));
        const res = await api<Topic>("POST", `/topics/${id}/analyze`).catch(fail);
        patchTopic(id, (t) => ({ ...t, analysis: res.analysis }));
      },

      async addTodo(input: { text: string; due?: string | null; topicId?: string | null; noteId?: string | null; suggestion?: { kind: "note" | "topic"; index: number } }) {
        const res = await api<{ todo: Todo; note?: Note; topic?: Topic }>("POST", "/todos", input).catch(fail);
        update((s) => ({ ...s, todos: [...s.todos, res.todo] }));
        if (res.note) patchNote(res.note.id, (n) => ({ ...n, analysis: res.note!.analysis }));
        if (res.topic) patchTopic(res.topic.id, (t) => ({ ...t, analysis: res.topic!.analysis }));
      },
      async updateTodo(id: string, patch: Partial<Pick<Todo, "text" | "due" | "done">>) {
        update((s) => ({
          ...s,
          todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch, doneAt: patch.done === undefined ? t.doneAt : patch.done ? new Date().toISOString() : null } : t)),
        }));
        await api("PATCH", `/todos/${id}`, patch).catch(fail);
      },
      async deleteTodo(id: string) {
        update((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
        await api("DELETE", `/todos/${id}`).catch(fail);
      },

      async setModel(model: ModelId) {
        update((s) => ({ ...s, settings: { ...s.settings, model } }));
        await api("PATCH", "/settings", { model }).catch(fail);
      },
    };
  }, [fail, flush]);

  return { state, loadError, saveStatus, error, actions };
}

export type Actions = ReturnType<typeof useStore>["actions"];
