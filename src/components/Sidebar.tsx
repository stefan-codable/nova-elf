import { useState } from "react";
import type { AppState } from "../../shared/types.ts";
import type { Actions } from "../store.ts";
import { cx, daysUntil } from "../util.ts";
import { Icon } from "./Icon.tsx";

export type View = { kind: "home" } | { kind: "topic"; id: string } | { kind: "search" };
export type Theme = "system" | "light" | "dark";

const DEFAULT_GROUPS = ["Kunden", "Intern"];
const themeLabel: Record<Theme, string> = { system: "Automatisch", light: "Hell", dark: "Dunkel" };
const themeIcon = { system: "auto", light: "sun", dark: "moon" } as const;

export function Sidebar(props: {
  state: AppState;
  view: View;
  query: string;
  theme: Theme;
  actions: Actions;
  onView: (v: View) => void;
  onQuery: (q: string) => void;
  onTheme: (t: Theme) => void;
}) {
  const { state, view, actions } = props;
  const [adding, setAdding] = useState<string | null>(null);

  const groups = [...new Set([...DEFAULT_GROUPS, ...state.topics.map((t) => t.group)])];
  const openTodos = state.todos.filter((t) => !t.done);
  const dueNow = openTodos.filter((t) => t.due && daysUntil(t.due) <= 0).length;

  async function submit(e: React.FormEvent<HTMLFormElement>, group: string) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("name")?.toString().trim();
    setAdding(null);
    if (!name) return;
    const topic = await actions.createTopic(name, group);
    props.onView({ kind: "topic", id: topic.id });
  }

  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        Nova Elf
      </div>

      <label className="search">
        <Icon name="search" size={14} />
        <input
          placeholder="Suchen"
          value={props.query}
          onChange={(e) => {
            props.onQuery(e.target.value);
            if (e.target.value && view.kind !== "search") props.onView({ kind: "search" });
          }}
          onFocus={() => props.query && props.onView({ kind: "search" })}
        />
      </label>

      <button type="button" className={cx("nav-item", view.kind === "home" && "active")} onClick={() => props.onView({ kind: "home" })}>
        <Icon name="home" />
        <span className="nav-label">Start</span>
        {dueNow > 0 && <span className="badge alert">{dueNow}</span>}
      </button>

      <div className="groups">
        {groups.map((group) => {
          const topics = state.topics.filter((t) => t.group === group).sort((a, b) => a.name.localeCompare(b.name, "de"));
          return (
            <section key={group}>
              <header className="group-head">
                <span>{group}</span>
                <button type="button" className="icon-btn ghost" title={`Thema in „${group}“ anlegen`} onClick={() => setAdding(group)}>
                  <Icon name="plus" size={14} />
                </button>
              </header>
              {topics.map((t) => {
                const count = state.notes.filter((n) => n.topicId === t.id).length;
                return (
                  <button
                    type="button"
                    key={t.id}
                    className={cx("nav-item", view.kind === "topic" && view.id === t.id && "active")}
                    onClick={() => props.onView({ kind: "topic", id: t.id })}
                  >
                    <Icon name="folder" />
                    <span className="nav-label">{t.name}</span>
                    <span className="badge">{count}</span>
                  </button>
                );
              })}
              {adding === group && (
                <form className="topic-form" onSubmit={(e) => void submit(e, group)}>
                  <input name="name" autoFocus placeholder={group === "Kunden" ? "Kundenname" : "Thema"} onBlur={(e) => !e.target.value && setAdding(null)} onKeyDown={(e) => e.key === "Escape" && setAdding(null)} />
                </form>
              )}
              {!topics.length && adding !== group && <p className="group-empty">Noch kein Thema</p>}
            </section>
          );
        })}
        <button
          type="button"
          className="nav-item subtle"
          onClick={() => {
            const name = window.prompt("Name des neuen Ordners");
            if (name?.trim()) setAdding(name.trim());
          }}
        >
          <Icon name="plus" />
          <span className="nav-label">Neuer Ordner</span>
        </button>
        {adding && !groups.includes(adding) && (
          <section>
            <header className="group-head">
              <span>{adding}</span>
            </header>
            <form className="topic-form" onSubmit={(e) => void submit(e, adding)}>
              <input name="name" autoFocus placeholder="Erstes Thema" onKeyDown={(e) => e.key === "Escape" && setAdding(null)} />
            </form>
          </section>
        )}
      </div>

      <footer className="sidebar-foot">
        <button
          type="button"
          className="nav-item subtle"
          title="Darstellung wechseln"
          onClick={() => props.onTheme(props.theme === "system" ? "light" : props.theme === "light" ? "dark" : "system")}
        >
          <Icon name={themeIcon[props.theme]} />
          <span className="nav-label">{themeLabel[props.theme]}</span>
        </button>
      </footer>
    </nav>
  );
}
