import { useEffect, useMemo, useState } from "react";
import type { Note } from "../shared/types.ts";
import { Assistant } from "./components/Assistant.tsx";
import { Editor } from "./components/Editor.tsx";
import { Home } from "./components/Home.tsx";
import { Icon } from "./components/Icon.tsx";
import { NoteList } from "./components/NoteList.tsx";
import { Sidebar, type Theme, type View } from "./components/Sidebar.tsx";
import { useStore } from "./store.ts";
import { cx } from "./util.ts";

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`nova-elf.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Zustand, der einen Neustart überlebt (Ansicht, Darstellung). Die Inhalte liegen auf dem Server. */
function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => stored(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(`nova-elf.${key}`, JSON.stringify(value));
    } catch {
      // privates Fenster: dann eben ohne Merken
    }
  }, [key, value]);
  return [value, setValue] as const;
}

const newestFirst = (a: Note, b: Note) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function App() {
  const { state, loadError, saveStatus, error, actions } = useStore();
  const [view, setView] = usePersisted<View>("view", { kind: "home" });
  const [noteId, setNoteId] = usePersisted<string | null>("note", null);
  const [assistantOpen, setAssistantOpen] = usePersisted("assistant", true);
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem("nova-elf.theme");
      return t === "light" || t === "dark" ? t : "system";
    } catch {
      return "system";
    }
  });
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("nova-elf.theme", theme);
    } catch {
      // siehe oben
    }
  }, [theme]);

  const topic = view.kind === "topic" ? (state?.topics.find((t) => t.id === view.id) ?? null) : null;

  const listed = useMemo(() => {
    if (!state) return [];
    if (view.kind === "topic") return state.notes.filter((n) => n.topicId === view.id).sort(newestFirst);
    if (view.kind !== "search") return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const topicNames = new Map(state.topics.map((t) => [t.id, t.name.toLowerCase()]));
    return state.notes
      .filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || topicNames.get(n.topicId)?.includes(q))
      .sort(newestFirst);
  }, [state, view, query]);

  const note = listed.find((n) => n.id === noteId) ?? listed[0] ?? null;
  const noteTopic = topic ?? state?.topics.find((t) => t.id === note?.topicId) ?? null;

  async function createNote() {
    if (!topic) return;
    const created = await actions.createNote(topic.id);
    setNoteId(created.id);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === "KeyN") {
        e.preventDefault();
        void createNote();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loadError) {
    return (
      <div className="boot">
        <h1>Nova Elf erreicht den lokalen Server nicht</h1>
        <p>{loadError}</p>
        <p className="muted">Starte ihn im Projektordner mit „npm run dev“ und lade die Seite neu.</p>
      </div>
    );
  }
  if (!state) return <div className="boot muted">Lädt …</div>;

  // Ein gemerktes Thema kann inzwischen gelöscht sein.
  const home = view.kind === "home" || (view.kind === "topic" && !topic);
  const showAssistant = assistantOpen && noteTopic;

  return (
    <div className={cx("app", home && "is-home", !showAssistant && "no-assistant")}>
      <Sidebar state={state} view={home ? { kind: "home" } : view} query={query} theme={theme} actions={actions} onView={setView} onQuery={setQuery} onTheme={setTheme} />

      {home ? (
        <Home
          state={state}
          actions={actions}
          onOpen={(topicId, id) => {
            setView({ kind: "topic", id: topicId });
            if (id) setNoteId(id);
          }}
        />
      ) : (
        <>
          <NoteList
            topic={topic}
            notes={listed}
            topics={state.topics}
            selectedId={note?.id ?? null}
            query={query}
            actions={actions}
            onSelect={(n) => setNoteId(n.id)}
            onCreate={() => void createNote()}
            onTopicDeleted={() => setView({ kind: "home" })}
          />
          {note ? (
            <Editor
              key={note.id}
              note={note}
              topics={state.topics}
              saveStatus={saveStatus}
              aiReady={state.aiReady}
              assistantOpen={assistantOpen}
              actions={actions}
              onToggleAssistant={() => setAssistantOpen((v) => !v)}
              onDeleted={() => setNoteId(null)}
            />
          ) : (
            <section className="editor">
              <div className="empty">
                <p>{topic ? "Wähle einen Eintrag oder lege einen neuen an." : "Kein Eintrag ausgewählt."}</p>
              </div>
            </section>
          )}
          {showAssistant && <Assistant key={noteTopic.id} state={state} topic={noteTopic} note={note} actions={actions} />}
        </>
      )}

      {error && (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" className="icon-btn ghost" onClick={actions.dismissError} title="Schließen">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
