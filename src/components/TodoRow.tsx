import { useRef } from "react";
import type { Todo } from "../../shared/types.ts";
import type { Actions } from "../store.ts";
import { cx, daysUntil, dueLabel } from "../util.ts";
import { Icon } from "./Icon.tsx";

/** Fälligkeit als Knopf; ein Klick öffnet den Datumswähler des Systems. */
export function DueButton({ due, done, onChange }: { due: string | null; done?: boolean; onChange: (due: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const late = due && !done && daysUntil(due) < 0;
  const soon = due && !done && daysUntil(due) === 0;
  return (
    <span className="due">
      <button type="button" className={cx("due-btn", late && "late", soon && "soon", !due && "unset")} onClick={() => input.current?.showPicker()} title="Fälligkeit ändern">
        {due ? dueLabel(due) : <Icon name="calendar" size={14} />}
      </button>
      <input ref={input} type="date" tabIndex={-1} aria-label="Fälligkeit" value={due ?? ""} onChange={(e) => onChange(e.target.value || null)} />
    </span>
  );
}

export function TodoRow({ todo, actions, context, onOpen }: { todo: Todo; actions: Actions; context?: string; onOpen?: () => void }) {
  return (
    <li className={cx("todo", todo.done && "done")}>
      <input type="checkbox" checked={todo.done} onChange={(e) => void actions.updateTodo(todo.id, { done: e.target.checked })} aria-label="Erledigt" />
      <div className="todo-body">
        <span className="todo-text">{todo.text}</span>
        {context && (
          <button type="button" className="chip" onClick={onOpen}>
            {context}
          </button>
        )}
      </div>
      <DueButton due={todo.due} done={todo.done} onChange={(due) => void actions.updateTodo(todo.id, { due })} />
      <button type="button" className="icon-btn ghost todo-del" onClick={() => void actions.deleteTodo(todo.id)} title="Löschen">
        <Icon name="x" size={14} />
      </button>
    </li>
  );
}

export function TodoAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  return (
    <form
      className="todo-add"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("text") as HTMLInputElement;
        if (!input.value.trim()) return;
        onAdd(input.value.trim());
        input.value = "";
      }}
    >
      <Icon name="plus" size={14} />
      <input name="text" placeholder={placeholder} autoComplete="off" />
    </form>
  );
}
