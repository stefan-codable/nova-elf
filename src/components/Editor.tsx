import { useRef, useState } from "react";
import type { Note, Topic } from "../../shared/types.ts";
import type { Actions, SaveStatus } from "../store.ts";
import { cx, groupNames, timeOfDay } from "../util.ts";
import { Icon } from "./Icon.tsx";

const BULLET = /^(\s*)((?:[-*•–]|\d+\.)\s+)?/;

/** Listen-Komfort wie in einer Notiz-App: Enter führt den Stichpunkt fort, Tab rückt ein. */
function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>, commit: (value: string) => void) {
  const el = e.currentTarget;
  const { selectionStart: start, selectionEnd: end, value } = el;
  if (e.nativeEvent.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === "Enter" && !e.shiftKey && start === end) {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const line = value.slice(lineStart, start);
    const [prefix = "", indent = "", bullet = ""] = BULLET.exec(line) ?? [];
    if (!prefix) return;
    e.preventDefault();
    if (bullet && line.length === prefix.length) {
      // Leerer Stichpunkt: Enter beendet die Liste, statt einen weiteren leeren Punkt anzulegen.
      el.setRangeText("", lineStart, start, "end");
    } else {
      const next = /^\d+\./.test(bullet) ? `${parseInt(bullet, 10) + 1}. ` : bullet;
      el.setRangeText(`\n${indent}${next}`, start, end, "end");
    }
    commit(el.value);
  }

  if (e.key === "Tab") {
    e.preventDefault();
    const blockStart = value.lastIndexOf("\n", start - 1) + 1;
    const nl = value.indexOf("\n", end);
    const blockEnd = nl === -1 ? value.length : nl;
    const lines = value.slice(blockStart, blockEnd).split("\n");
    const changed = lines.map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, "") : `  ${l}`));
    const firstDelta = changed[0]!.length - lines[0]!.length;
    const totalDelta = changed.join("\n").length - (blockEnd - blockStart);
    el.setRangeText(changed.join("\n"), blockStart, blockEnd, "preserve");
    el.setSelectionRange(Math.max(blockStart, start + firstDelta), end + totalDelta);
    commit(el.value);
  }
}

const NEW_TOPIC = "__new__";

export function Editor(props: {
  note: Note;
  topics: Topic[];
  saveStatus: SaveStatus;
  aiReady: boolean;
  assistantOpen: boolean;
  actions: Actions;
  onToggleAssistant: () => void;
  onDeleted: () => void;
  onMoved: (topicId: string) => void;
}) {
  const { note, actions } = props;
  const [busy, setBusy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addFiles(files: Iterable<File>) {
    for (const file of files) {
      if (!file.type.startsWith("image/") && !/\.hei[cf]$/i.test(file.name)) continue;
      setBusy((n) => n + 1);
      try {
        await actions.addImage(note.id, file, props.aiReady);
      } catch {
        // Meldung erscheint über die Fehlerleiste
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  /** Verschiebt den Eintrag in ein anderes Thema; "Neues Thema …" legt es im selben Ordner an. */
  async function move(target: string) {
    let topicId = target;
    if (target === NEW_TOPIC) {
      const name = window.prompt("Name des neuen Themas")?.trim();
      if (!name) return;
      const group = props.topics.find((t) => t.id === note.topicId)?.group ?? "Intern";
      topicId = (await actions.createTopic(name, group)).id;
    }
    await actions.moveNote(note.id, topicId);
    props.onMoved(topicId);
  }

  function remove() {
    if (!window.confirm("Diesen Eintrag löschen?\n\nEr bleibt im Datenordner unter „papierkorb“ erhalten.")) return;
    void actions.deleteNote(note.id).then(props.onDeleted);
  }

  return (
    <section
      className={cx("editor", dragging && "dragging")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void addFiles(e.dataTransfer.files);
      }}
    >
      <header className="editor-bar">
        <input
          className="date-input"
          type="date"
          aria-label="Datum des Gesprächs"
          value={note.date}
          onChange={(e) => e.target.value && actions.editNote(note.id, { date: e.target.value })}
        />
        <select
          className="topic-select"
          aria-label="Thema des Eintrags"
          title="In ein anderes Thema verschieben"
          value={note.topicId}
          onChange={(e) => void move(e.target.value)}
        >
          {groupNames(props.topics).map((group) => (
            <optgroup key={group} label={group}>
              {props.topics
                .filter((t) => t.group === group)
                .sort((a, b) => a.name.localeCompare(b.name, "de"))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </optgroup>
          ))}
          <option value={NEW_TOPIC}>Neues Thema …</option>
        </select>
        <span className={cx("save-state", props.saveStatus)} aria-live="polite">
          {props.saveStatus === "saving" ? "Speichert …" : props.saveStatus === "error" ? "Nicht gespeichert" : "Gespeichert"}
        </span>
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={() => fileInput.current?.click()} disabled={busy > 0} title={props.aiReady ? "Foto hochladen und als Text übernehmen" : "Foto anhängen"}>
          <Icon name="image" /> {busy > 0 ? "Foto wird ausgelesen …" : "Foto"}
        </button>
        <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <button type="button" className="icon-btn ghost" title="Eintrag löschen" onClick={remove}>
          <Icon name="trash" />
        </button>
        <button type="button" className={cx("icon-btn ghost", props.assistantOpen && "on")} title="Assistent ein- oder ausblenden" onClick={props.onToggleAssistant}>
          <Icon name="panel" />
        </button>
      </header>

      <div className="editor-scroll">
        <input
          className="title-input"
          placeholder="Titel"
          value={note.title}
          onChange={(e) => actions.editNote(note.id, { title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            (e.currentTarget.nextElementSibling as HTMLTextAreaElement | null)?.focus();
          }}
        />
        <textarea
          key={note.id}
          className="content-input"
          placeholder={"Notizen eintippen …\n\n- Stichpunkte mit „- “ beginnen\n- Tab rückt ein\n- Foto hierher ziehen oder einfügen"}
          value={note.content}
          spellCheck
          autoFocus={!note.content}
          onChange={(e) => actions.editNote(note.id, { content: e.target.value })}
          onKeyDown={(e) => handleKey(e, (content) => actions.editNote(note.id, { content }))}
          onPaste={(e) => {
            const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
            if (!files.length) return;
            e.preventDefault();
            void addFiles(files);
          }}
        />
        {note.images.length > 0 && (
          <div className="images">
            {note.images.map((img) => (
              <figure key={img.id}>
                <a href={`/uploads/${img.file}`} target="_blank" rel="noreferrer" title={img.name}>
                  <img src={`/uploads/${img.file}`} alt={img.name} loading="lazy" />
                </a>
                <button type="button" className="icon-btn" title="Foto entfernen" onClick={() => void actions.removeImage(note.id, img.id)}>
                  <Icon name="x" size={12} />
                </button>
              </figure>
            ))}
          </div>
        )}
      </div>

      <footer className="editor-foot">Zuletzt geändert {timeOfDay(note.updatedAt)}</footer>
      {dragging && <div className="drop-hint">Foto ablegen{props.aiReady ? " – der Text wird übernommen" : ""}</div>}
    </section>
  );
}
