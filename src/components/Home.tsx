import { useState } from "react";
import type { AppState, Todo } from "../../shared/types.ts";
import type { Actions } from "../store.ts";
import { ago, cx, daysUntil, formatDate, today } from "../util.ts";
import { Icon } from "./Icon.tsx";
import { TodoAdd, TodoRow } from "./TodoRow.tsx";

const BUCKETS = ["Überfällig", "Heute", "Diese Woche", "Später", "Ohne Termin"] as const;

function bucket(t: Todo): (typeof BUCKETS)[number] {
  if (!t.due) return "Ohne Termin";
  const n = daysUntil(t.due);
  if (n < 0) return "Überfällig";
  if (n === 0) return "Heute";
  return n <= 7 ? "Diese Woche" : "Später";
}

export function Home({ state, actions, onOpen }: { state: AppState; actions: Actions; onOpen: (topicId: string, noteId?: string | null) => void }) {
  const [showDone, setShowDone] = useState(false);
  const open = state.todos.filter((t) => !t.done).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.createdAt.localeCompare(b.createdAt));
  const done = state.todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")).slice(0, 30);
  const topicName = (id: string | null) => state.topics.find((t) => t.id === id)?.name;

  const topics = state.topics
    .map((topic) => {
      const notes = state.notes.filter((n) => n.topicId === topic.id).sort((a, b) => b.date.localeCompare(a.date));
      return { topic, last: notes[0], count: notes.length, open: open.filter((t) => t.topicId === topic.id) };
    })
    .sort((a, b) => (b.last?.date ?? "").localeCompare(a.last?.date ?? ""));

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";
  const overdue = open.filter((t) => bucket(t) === "Überfällig").length;
  const dueToday = open.filter((t) => bucket(t) === "Heute").length;

  const row = (t: Todo) => (
    <TodoRow key={t.id} todo={t} actions={actions} context={topicName(t.topicId)} onOpen={() => t.topicId && onOpen(t.topicId, t.noteId)} />
  );

  return (
    <main className="home">
      <div className="home-inner">
        <header className="home-head">
          <p className="eyebrow">{formatDate(today(), { weekday: true, year: true })}</p>
          <h1>{greeting}.</h1>
          <p className="home-lead">
            {open.length === 0
              ? "Keine offenen To-dos."
              : [
                  overdue ? `${overdue} überfällig` : null,
                  dueToday ? `${dueToday} heute fällig` : null,
                  `${open.length} offen insgesamt`,
                ].filter(Boolean).join(" · ")}
          </p>
        </header>

        <div className="home-grid">
          <section className="card">
            <h2>To-dos</h2>
            {BUCKETS.map((b) => {
              const items = open.filter((t) => bucket(t) === b);
              if (!items.length) return null;
              return (
                <div key={b} className={cx("bucket", b === "Überfällig" && "late")}>
                  <h3>
                    {b} <span>{items.length}</span>
                  </h3>
                  <ul className="todos">{items.map(row)}</ul>
                </div>
              );
            })}
            {!open.length && <p className="muted">Alles erledigt. Neue To-dos entstehen aus den Auswertungen deiner Einträge oder hier unten.</p>}
            <TodoAdd placeholder="To-do hinzufügen" onAdd={(text) => void actions.addTodo({ text })} />
            {done.length > 0 && (
              <div className="bucket done-bucket">
                <button type="button" className="link" onClick={() => setShowDone((v) => !v)}>
                  {showDone ? "Erledigte ausblenden" : `Erledigte anzeigen (${done.length})`}
                </button>
                {showDone && <ul className="todos">{done.map(row)}</ul>}
              </div>
            )}
          </section>

          <section className="card">
            <h2>Themen nach letztem Kontakt</h2>
            {!topics.length && <p className="muted">Lege links unter „Kunden“ oder „Intern“ dein erstes Thema an.</p>}
            <ul className="contacts">
              {topics.map(({ topic, last, count, open: openTodos }) => {
                const days = last ? -daysUntil(last.date) : null;
                const prepare = topic.analysis?.prepare[0] ?? last?.analysis?.prepare[0];
                return (
                  <li key={topic.id}>
                    <button type="button" onClick={() => onOpen(topic.id, last?.id)}>
                      <span className="contact-main">
                        <strong>{topic.name}</strong>
                        <span className="contact-group">{topic.group}</span>
                      </span>
                      <span className="contact-meta">
                        <span className={cx("contact-age", days !== null && days > 21 && "old")}>{last ? `Letzter Eintrag ${ago(last.date)}` : "Noch kein Eintrag"}</span>
                        <span>
                          {count} {count === 1 ? "Eintrag" : "Einträge"}
                          {openTodos.length > 0 && ` · ${openTodos.length} offen`}
                        </span>
                      </span>
                      {prepare && (
                        <span className="contact-prepare">
                          <Icon name="spark" size={13} /> {prepare}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
