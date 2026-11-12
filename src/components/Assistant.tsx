import { useState } from "react";
import { MODELS, type Analysis, type AppState, type ModelId, type Note, type Topic } from "../../shared/types.ts";
import type { Actions } from "../store.ts";
import { cx, dueLabel, timeOfDay } from "../util.ts";
import { Icon } from "./Icon.tsx";
import { TodoAdd, TodoRow } from "./TodoRow.tsx";

type Scope = "note" | "topic";

export function Assistant({ state, topic, note, actions }: { state: AppState; topic: Topic; note: Note | null; actions: Actions }) {
  const [scope, setScope] = useState<Scope>("note");
  const [running, setRunning] = useState<string | null>(null);
  const active: Scope = note ? scope : "topic";

  const analysis = active === "note" ? note?.analysis : topic.analysis;
  const key = active === "note" ? note!.id : topic.id;
  const topicNotes = state.notes.filter((n) => n.topicId === topic.id);
  const stale =
    analysis &&
    (active === "note" ? note!.updatedAt > analysis.createdAt : topicNotes.some((n) => n.updatedAt > analysis.createdAt || n.createdAt > analysis.createdAt));
  const empty = active === "note" ? !note!.content.trim() : !topicNotes.some((n) => n.content.trim());
  const todos = state.todos
    .filter((t) => (active === "note" ? t.noteId === note!.id : t.topicId === topic.id))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? "9999").localeCompare(b.due ?? "9999"));

  async function run() {
    setRunning(key);
    try {
      await (active === "note" ? actions.analyzeNote(key) : actions.analyzeTopic(key));
    } catch {
      // Meldung erscheint über die Fehlerleiste
    } finally {
      setRunning(null);
    }
  }

  const adopt = (a: Analysis, index: number) => {
    const s = a.todos[index]!;
    return actions.addTodo({ text: s.text, due: s.due, topicId: topic.id, noteId: active === "note" ? note!.id : null, suggestion: { kind: active, index } });
  };

  const busy = running === key;

  return (
    <aside className="assistant">
      <header className="assistant-head">
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={active === "note"} disabled={!note} className={cx(active === "note" && "active")} onClick={() => setScope("note")}>
            Eintrag
          </button>
          <button type="button" role="tab" aria-selected={active === "topic"} className={cx(active === "topic" && "active")} onClick={() => setScope("topic")}>
            Thema
          </button>
        </div>
        <button type="button" className="btn accent" onClick={() => void run()} disabled={busy || empty || !state.aiReady}>
          <Icon name={analysis ? "refresh" : "spark"} size={14} />
          {busy ? "Liest …" : analysis ? "Neu auswerten" : "Auswerten"}
        </button>
      </header>

      <div className="assistant-body">
        {!state.aiReady && (
          <p className="notice">
            Für Auswertungen fehlt der API-Schlüssel. Trage <code>ANTHROPIC_API_KEY</code> in die Datei <code>.env</code> ein und starte Nova Elf neu.
          </p>
        )}

        {busy && !analysis && <Skeleton />}

        {!analysis && !busy && state.aiReady && (
          <div className="empty small">
            <p>
              {empty
                ? "Sobald hier Notizen stehen, kann ich sie zusammenfassen und Vorschläge machen."
                : active === "note"
                  ? "Ich fasse diesen Eintrag zusammen, lese heraus, was wichtig ist, und schlage To-dos mit Termin vor."
                  : `Ich gebe einen Überblick über alle ${topicNotes.length} Einträge zu „${topic.name}“ und sage, was als Nächstes ansteht.`}
            </p>
          </div>
        )}

        {analysis && (
          <div className={cx("analysis", busy && "refreshing")}>
            {stale && !busy && <p className="notice">Die Notizen wurden seit dieser Auswertung geändert.</p>}

            <Block title="Zusammenfassung">
              <p>{analysis.summary}</p>
            </Block>

            {analysis.todos.length > 0 && (
              <Block title="Vorgeschlagene To-dos">
                <ul className="suggestions">
                  {analysis.todos.map((s, i) => (
                    <li key={i} className={cx(s.adopted && "adopted")}>
                      <div>
                        <strong>{s.text}</strong>
                        <span className="suggestion-meta">
                          {s.due && <span className="suggestion-due">{dueLabel(s.due)}</span>}
                          {s.reason}
                        </span>
                      </div>
                      <button type="button" className="icon-btn" disabled={s.adopted} title={s.adopted ? "Übernommen" : "Als To-do übernehmen"} onClick={() => void adopt(analysis, i)}>
                        <Icon name={s.adopted ? "check" : "plus"} size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            <ListBlock title="Empfehlungen" items={analysis.recommendations} />
            <ListBlock title="Vorbereiten" items={analysis.prepare} />
            <ListBlock title="Herausgelesen" items={analysis.insights} />

            <p className="analysis-meta">
              {MODELS.find((m) => analysis.model.startsWith(m.id))?.label ?? analysis.model} · {timeOfDay(analysis.createdAt)}
            </p>
          </div>
        )}

        <Block title={active === "note" ? "To-dos aus diesem Eintrag" : "To-dos zum Thema"}>
          <ul className="todos">
            {todos.map((t) => (
              <TodoRow key={t.id} todo={t} actions={actions} />
            ))}
          </ul>
          <TodoAdd placeholder="To-do hinzufügen" onAdd={(text) => void actions.addTodo({ text, topicId: topic.id, noteId: active === "note" ? note!.id : null })} />
        </Block>
      </div>

      <footer className="assistant-foot">
        <label>
          Modell
          <select value={state.settings.model} onChange={(e) => void actions.setModel(e.target.value as ModelId)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} – {m.hint}
              </option>
            ))}
          </select>
        </label>
      </footer>
    </aside>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <Block title={title}>
      <ul className="points">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </Block>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" aria-label="Auswertung läuft">
      {[92, 100, 74, 0, 60, 88, 0, 96, 70].map((w, i) => (w ? <span key={i} style={{ width: `${w}%` }} /> : <i key={i} />))}
    </div>
  );
}
