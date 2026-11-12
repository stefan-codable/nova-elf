# Nova Elf

Der kleine Helfer für Gesprächsnotizen: Themen anlegen (Kunden, Intern), Einträge chronologisch mittippen oder als Foto hochladen, und daraus Zusammenfassung, Empfehlungen und To-dos mit Termin ableiten lassen. Läuft vollständig auf dem eigenen Rechner; nur für Auswertung und Foto-Erkennung geht der jeweilige Text bzw. das Bild an die Claude API.

## Start

Voraussetzung: Node.js ab Version 22.

```bash
npm install
```

```bash
cp .env.example .env
```

In `.env` den `ANTHROPIC_API_KEY` eintragen (ohne Schlüssel funktioniert alles außer Auswertung und Foto-Erkennung). Dann:

```bash
npm start
```

Die App läuft unter http://localhost:4311. Zum Entwickeln stattdessen `npm run dev` (Oberfläche mit Live-Aktualisierung unter http://localhost:4310).

## Bedienung

- **Links:** Start, Suche, Ordner mit Themen. Das Plus neben einem Ordner legt ein Thema an.
- **Zweite Spalte:** Einträge des Themas, neueste zuerst. Der Themenname lässt sich dort direkt ändern.
- **Dritte Spalte:** der Eintrag. Jede Eingabe wird nach einer halben Sekunde gespeichert. `- ` beginnt einen Stichpunkt, Enter führt ihn fort, Tab und Umschalt+Tab rücken ein und aus. Fotos per Knopf, Ziehen oder Einfügen; der erkannte Text wird unten angehängt.
- **Vierte Spalte:** der Assistent, wahlweise für den Eintrag oder das ganze Thema. Vorgeschlagene To-dos übernimmt das Plus. Unten lässt sich das Modell wechseln (Opus 5.5, Sonnet 5.5, Haiku 5.5).
- **Start:** offene To-dos nach Fälligkeit und alle Themen nach letztem Kontakt.
- Neuer Eintrag: ⌘/Strg + Alt + N.

## Daten

Alles liegt als lesbare Dateien im Ordner `data/` (anderer Ort über `NOVA_ELF_DATA`):

```
data/topics.json      Themen samt Themen-Auswertung
data/notes/<id>.json  ein Eintrag je Datei, samt Auswertung
data/todos.json       To-dos
data/uploads/         Fotos
data/papierkorb/      Gelöschtes (wird nie automatisch geleert)
```

`data/` ist ein eigenes Git-Repository. Nova Elf legt 30 Sekunden nach der letzten Änderung und beim Beenden einen Stand an; ältere Fassungen lassen sich mit `git log` und `git checkout` im Datenordner zurückholen. Für eine Sicherung außerhalb des Rechners ein privates Repository als `origin` eintragen, dann wird nach jedem Stand dorthin übertragen:

```bash
cd data && git remote add origin git@github.com:<konto>/nova-elf-daten.git
```

`data/` und `.env` sind vom Code-Repository ausgenommen, Notizen und Schlüssel landen also nie im Code.

## Aufbau

```
server/index.ts   Hono-Server, nur an 127.0.0.1 gebunden: API, Fotos, gebaute Oberfläche
server/store.ts   Dateiablage und Git-Sicherung
server/ai.ts      Aufrufe der Claude API (Auswertung, Foto-Erkennung), Prompts
shared/types.ts   gemeinsame Typen, Modellliste
src/              Oberfläche (React, Vite), Gestaltung in src/styles.css
```

## Offen

- Outlook-Kalender anbinden (Termine auf der Startseite, Vorbereitung je Termin).
- Freie Aufträge an den Assistenten („erstelle daraus ein Angebot“).
- Vergleich der drei Modelle an echten Notizen, um das Standardmodell festzulegen.
