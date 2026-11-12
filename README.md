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

- **Links:** Start, Suche, Ordner mit Themen; je Ordner steht das Thema mit dem jüngsten Eintrag oben. Das Plus neben einem Ordner legt ein Thema an.
- **Zweite Spalte:** Einträge des Themas, neueste zuerst. Der Themenname lässt sich dort direkt ändern, daneben wechselt die Auswahl den Ordner des Themas oder legt über „Neuer Ordner …“ einen an. Der Papierkorb, der beim Überfahren eines Eintrags erscheint, löscht ihn.
- **Dritte Spalte:** der Eintrag. Jede Eingabe wird nach einer halben Sekunde gespeichert. `- ` beginnt einen Stichpunkt, Enter führt ihn fort, Tab und Umschalt+Tab rücken ein und aus. Fotos per Knopf, Ziehen oder Einfügen; der erkannte Text wird unten angehängt. Die Themenauswahl neben dem Datum verschiebt den Eintrag samt seinen To-dos in ein anderes Thema.
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

## Import aus der Notizen-App

Übernimmt Notizen aus der Notizen-App von macOS als Einträge. Nova Elf muss dabei laufen.

```bash
npm run import:notes
```

zeigt, welche Notiz in welches Thema käme, und schreibt nichts. Die Zuordnung zu Themen schlägt die KI vor; vorhandene Themen werden wiederverwendet.

```bash
npm run import:notes -- --apply
```

übernimmt den zuletzt gezeigten Plan. Jeder Eintrag merkt sich seine Herkunft, ein erneuter Lauf holt nur neue Notizen und keine, die in Nova Elf gelöscht wurden; spätere Änderungen an schon übernommenen Notizen werden nicht nachgezogen. Notizen, die nach Zugangsdaten aussehen (API-Schlüssel, Passwörter, zufällige Zeichenfolgen), sowie gesperrte Notizen werden übersprungen: Sie gehen weder an die Claude API noch in den Datenordner. Die Prüfung läuft lokal und ist bewusst streng. Bilder in Notizen werden nicht übernommen.

## Aufbau

```
server/index.ts   Hono-Server, nur an 127.0.0.1 gebunden: API, Fotos, gebaute Oberfläche
server/store.ts   Dateiablage und Git-Sicherung
server/ai.ts      Aufrufe der Claude API (Auswertung, Foto-Erkennung), Prompts
shared/types.ts   gemeinsame Typen, Modellliste
scripts/         Import aus der Notizen-App
src/              Oberfläche (React, Vite), Gestaltung in src/styles.css
```

## Modelle

Standard ist Opus 5.5. Vergleich vom 12.11.2026 an einer Testnotiz (13 Stichpunkte, je zwei Läufe, Preise laut Anthropic-Preisliste):

| Modell | Dauer Auswertung | Kosten je Auswertung | Eindruck |
| --- | --- | --- | --- |
| Opus 5.5 | 22 bis 26 s | ca. 0,06 $ | vollständigste To-dos, Termine mit Puffer vor Fristen |
| Sonnet 5.5 | 13 s | ca. 0,02 $ | nah an Opus, lässt gelegentlich ein To-do aus |
| Haiku 5.5 | 12 bis 13 s | ca. 0,002 $ | brauchbar, aber dünner; bei Fotos kleine Abweichungen vom Original |

Jeder KI-Aufruf schreibt eine Zeile mit Modell, Dauer und Tokenverbrauch ins Server-Protokoll (`[ai] …`).

## Offen

- Outlook-Kalender anbinden (Termine auf der Startseite, Vorbereitung je Termin).
- Freie Aufträge an den Assistenten („erstelle daraus ein Angebot“).
