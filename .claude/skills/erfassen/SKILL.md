---
name: erfassen
description: Nimmt alles Neue von Stefan auf und legt es richtig ab - Diktat, Terminprotokoll, Telefonnotiz, Transkript, Foto von Notizen, Kurzinfo oder Aufgabe. Erzeugt bei Terminen Zusammenfassung, Entscheidungen und To-dos, aktualisiert die Kundenübersicht und fragt bei Unklarheit einmal nach. Nutzen bei "notier", "hatte gerade ein Gespräch/Termin mit", eingefügten Notizen oder Transkripten, Fotos von Mitschriften und beim Abarbeiten von daten/eingang.md.
---

# Erfassen

## 1. Kontext laden
`daten/wissen/regeln.md`, `personen.md`, `kunden.md`, `glossar.md` lesen. Sie entscheiden Zuordnung und Schreibweisen.

## 2. Art erkennen (eine Eingabe kann mehrere Teile haben)
- **Termin, Telefonat, interne Runde, Transkript** → Eintrag mit Auswertung (Schritt 4)
- **Kurzinfo** über Person, Kunde, Vorliebe → Skill `lernen`
- **Aufgabe** → nur `aufgaben.json`
- **Frage** → beantworten, nichts ablegen
- **Foto** → Text erkennen, Bild nach `daten/anhaenge/<id>.<ext>` kopieren, dann wie Termin bzw. Notiz
- Sagt Stefan „später“ oder bleibt etwas nach der Rückfrage offen → eine Zeile oben in `daten/eingang.md` (`- JJJJ-MM-TT HH:MM | Quelle | Text`)

## 3. Zuordnen
Ordner über `regeln.md`, Namen in `personen.md` und `kunden.md`, Firmennamen im Text. Datum aus dem Text, sonst heute; „gestern“, „Montag“ in ein Datum umrechnen.
Unsicher bei Ordner, Termin-Art (Kunde, intern Geschäftsführung, intern Management, Team, privat), unbekannter Person oder Datum → **eine** `AskUserQuestion` mit allen Unklarheiten, passende Ordner als Knöpfe. Danach jede Antwort sofort mit Skill `lernen` als Regel bzw. Person festhalten.
Neuer Kunde oder neues Thema: Ordner `daten/<bereich>/<slug>/` mit `_uebersicht.md` (Kopf `name`, `art`, `angelegt`; Abschnitte Stand, Nächster Schritt, Offene Punkte, Ansprechpartner) und Zeile in `kunden.md`.

## 4. Eintrag schreiben
Datei `daten/<ordner>/JJJJ-MM-TT-<slug>.md` (Kleinbuchstaben, ae/oe/ue/ss, Bindestriche; gibt es sie schon, `-2` anhängen). Ergänzt Stefan einen schon erfassten Termin, die bestehende Datei erweitern.

```
---
id: <12 Zeichen hex>
datum: JJJJ-MM-TT
titel: "<sprechender Titel>"
art: termin | telefonat | interne-runde | kennenlernen | transkript | notiz
teilnehmer: [Name, Name]
quelle: diktat | text | foto | transkript | outlook
---
# <Titel>

## Zusammenfassung
3–5 Sätze: Anlass, Kern, Ergebnis.

## Entscheidungen
- …

## To-dos
- Stefan: … (bis JJJJ-MM-TT)
- <Name>: … (bis …)

## Offene Fragen
- …

## Notizen
<Stefans Originaltext unverändert; bei Transkripten das ganze Transkript>
```
Leere Abschnitte weglassen. Der Originaltext geht nie verloren.

## 5. Aufgaben
Stefans eigene To-dos nach `daten/aufgaben.json` (neue `id` 12 Zeichen hex, `quelle: "elf"`, `ordner`, `eintrag`, `reihenfolge` = höchste + 1, `erstellt` ISO-Zeit). Frist nur, wenn genannt oder klar ableitbar. To-dos anderer bleiben im Eintrag und kommen unter „Offene Punkte“ der Übersicht als „wartet auf <Name>: …“.

## 6. Übersicht und Wissen
`_uebersicht.md` des Ordners nachziehen: Stand (mit Datum), Nächster Schritt, Offene Punkte, Ansprechpartner. Neue Personen mit Rolle in `personen.md`.

## 7. Abschluss
Zeile oben in `daten/protokoll.md`. Antwort an Stefan, höchstens 6 Zeilen: Pfad, ein Satz Kern, seine neuen To-dos mit Frist. Bei Kundenterminen anbieten: Follow-up-Mail entwerfen (`sales:call-summary`, nur Mail-Teil, Ton aus `arbeitsweise.md`).
