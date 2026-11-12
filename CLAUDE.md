# Nova Elf

Lokale Ein-Nutzer-App für Gesprächsnotizen mit KI-Auswertung. Überblick und Bedienung: `README.md`.

- Stack: TypeScript strict, React + Vite (Oberfläche), Hono (Server), Zod, `@anthropic-ai/sdk`. Kein CSS-Framework, Gestaltung über Variablen in `src/styles.css` (hell und dunkel).
- Nur Desktop. Keine mobile Ansicht bauen.
- Oberflächentexte Deutsch, Code und Bezeichner Englisch.
- Daten sind Dateien unter `data/` (nicht versioniert im Code-Repo, eigenes Git im Ordner). Kein Datenbankserver einführen, solange nur ein Nutzer lokal arbeitet.
- Der Server bindet nur an 127.0.0.1 und prüft Host und Origin. Das nicht lockern.
- Nichts endgültig löschen: Einträge und Themen wandern nach `data/papierkorb/`.
- Getippter Text darf nie durch eine Serverantwort überschrieben werden (siehe `src/store.ts`: Antworten liefern nur `analysis` bzw. Bilder zurück in den Zustand).
- Prüfen vor Abgabe: `npm run build` (Typprüfung und Bau), danach die App im Browser durchklicken.
