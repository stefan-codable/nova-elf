import type { Note, Topic } from "../../shared/types.ts";
import type { Actions } from "../store.ts";
import { cx, firstLine, formatDate } from "../util.ts";
import { Icon } from "./Icon.tsx";

export function NoteList(props: {
  topic: Topic | null;
  notes: Note[];
  topics: Topic[];
  selectedId: string | null;
  query: string;
  actions: Actions;
  onSelect: (note: Note) => void;
  onCreate: () => void;
  onTopicDeleted: () => void;
}) {
  const { topic, notes, actions } = props;

  function remove() {
    if (!topic) return;
    const n = notes.length;
    if (!window.confirm(`Thema „${topic.name}“${n ? ` mit ${n} ${n === 1 ? "Eintrag" : "Einträgen"}` : ""} löschen?\n\nGelöschtes bleibt im Datenordner unter „papierkorb“ erhalten.`)) return;
    void actions.deleteTopic(topic.id).then(props.onTopicDeleted);
  }

  return (
    <section className="list">
      <header className="list-head">
        {topic ? (
          <>
            <input
              key={topic.id}
              className="list-title"
              defaultValue={topic.name}
              aria-label="Name des Themas"
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== topic.name) void actions.updateTopic(topic.id, { name });
                else e.target.value = topic.name;
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <button type="button" className="icon-btn ghost" title="Thema löschen" onClick={remove}>
              <Icon name="trash" />
            </button>
            <button type="button" className="icon-btn primary" title="Neuer Eintrag (⌘/Strg + Alt + N)" onClick={props.onCreate}>
              <Icon name="plus" />
            </button>
          </>
        ) : (
          <span className="list-title static">{props.query ? `Suche: ${props.query}` : "Suche"}</span>
        )}
      </header>

      <div className="list-body">
        {notes.map((n) => {
          const title = n.title || firstLine(n.content) || "Neuer Eintrag";
          const preview = n.title ? firstLine(n.content) : firstLine(n.content.split("\n").slice(1).join("\n"));
          return (
            <button type="button" key={n.id} className={cx("note-item", n.id === props.selectedId && "active")} onClick={() => props.onSelect(n)}>
              <span className="note-item-title">{title}</span>
              <span className="note-item-meta">
                <time>{formatDate(n.date)}</time>
                <span className="note-item-preview">{topic ? preview : props.topics.find((t) => t.id === n.topicId)?.name}</span>
              </span>
              {n.analysis && <span className="note-item-dot" title="Ausgewertet" />}
            </button>
          );
        })}
        {!notes.length && (
          <div className="empty small">
            {topic ? (
              <>
                <p>Noch kein Eintrag zu diesem Thema.</p>
                <button type="button" className="btn" onClick={props.onCreate}>
                  <Icon name="plus" size={14} /> Ersten Eintrag anlegen
                </button>
              </>
            ) : (
              <p>{props.query ? "Nichts gefunden." : "Suchbegriff eingeben."}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
