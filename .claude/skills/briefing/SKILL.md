---
name: briefing
description: Tages- oder Wochenbriefing für Stefan - Termine aus Outlook, überfällige und fällige Aufgaben, Vorbereitung je Kundentermin aus der Historie in daten/, auf Wunsch Mails ohne Antwort. Nutzen bei "was steht heute an", "Tag vorbereiten", "Woche vorbereiten", "Morgenbriefing", "worauf muss ich mich vorbereiten".
---

# Briefing

## Tag
1. **Termine:** mit Skill `outlook` den Kalender des Tages lesen. Klappt das nicht (nicht angemeldet, Browser zu), ohne Termine weitermachen und das sagen.
2. **Termine einordnen:** je Termin Ordner und Art über `regeln.md`, `personen.md`, `kunden.md`. Unklare Termine gesammelt in **einer** `AskUserQuestion` klären, Antworten mit Skill `lernen` als Regel festhalten.
3. **Vorbereitung je Kunden- oder Bewerbertermin:** `_uebersicht.md` und die letzten zwei Einträge lesen. Drei bis fünf Zeilen: letzter Stand, offene Punkte, was Stefan zugesagt hat, eine sinnvolle Frage. Will Stefan es ausführlich: `sales:call-prep` und als `kunden/<kunde>/JJJJ-MM-TT-vorbereitung-<slug>.md` ablegen.
4. **Aufgaben:** überfällig und heute aus `aufgaben.json`, dazu, was zu den heutigen Terminen passt.
5. **Ungelesene Mails** (Standard, außer `arbeitsweise.md` sagt anderes): mit Skill `outlook` „Ungelesene prüfen“. Je Mail eine Einordnung:
   - `antwort` – Stefan muss antworten oder entscheiden
   - `termin` – Einladung, Terminwunsch, Verschiebung
   - `info` – lesenswert, keine Handlung
   - Newsletter, Werbung, automatische Benachrichtigungen: nur zählen, nicht einzeln aufführen
   Absender über `personen.md`/`kunden.md` einem Ordner zuordnen. Bittet jemand um etwas mit Frist: als Aufgabe vorschlagen (nicht ungefragt anlegen). Neues zu einem Kunden (Zusage, Absage, Termin): anbieten, es mit Skill `erfassen` festzuhalten. Unbekannte, aber offenbar wichtige Absender: mit Skill `lernen` nachfragen, wer das ist.
   **Antwort-Entwürfe:** für jede Mail mit `antwort` mit Skill `outlook` „Antwort-Entwurf“ eine Antwort im Verlauf als Entwurf ablegen (Text per Sonnet-Hilfsagent, alle Mails in einem Auftrag), danach wieder als ungelesen markieren. **Nie senden.** Scheitert eine Mail, ohne Entwurf weiter und den Grund in Schritt 7 nennen.
6. **Ablage:** `daten/briefings/JJJJ-MM-TT.md` (Termine `HH:MM–HH:MM | Titel | Ordner | Art`, Vorbereitung, Mails, Aufgaben) und fürs Cockpit `daten/briefings/JJJJ-MM-TT.json`:
   `{"erstellt": "<ISO-Zeit>", "termine": [{"zeit": "09:30–10:00", "titel": "…", "ordner": "kunden/<kunde>", "art": "Kunde", "vorbereitung": "ein Satz", "link": "<Outlook-Link oder weglassen>"}], "mails": [{"von": "Name (Firma)", "betreff": "…", "eingang": "JJJJ-MM-TT HH:MM", "art": "antwort|termin|info", "kern": "ein Satz, was gewollt ist", "ordner": "kunden/<kunde>|null", "link": "<Outlook-Link oder weglassen>", "entwurf": "liegt in Outlook", "entwurfLink": "<Link auf den Entwurf>"}], "mailsUebrige": 12}`. `entwurf` und `entwurfLink` nur, wenn der Entwurf laut Skill `outlook` geprüft im Verlauf steht, sonst weglassen.
   Mails in der Reihenfolge `antwort`, `termin`, `info`, darin älteste zuerst. Je Termin und Mail den Direktlink aus Skill `outlook` („Direktlinks“) mitschreiben, damit Stefan sie im Cockpit per Klick öffnet. Kein Mailtext, keine Anhänge, keine Adressen. Zeile in `protokoll.md`, danach Skill `cockpit` „Senden“.
7. **Antwort im Chat:** kompakt, Termine chronologisch mit je einer Zeile Vorbereitung, dann Mails mit `antwort`/`termin` (je eine Zeile), Zahl der übrigen, dann Aufgaben. Bei Mails mit Entwurf „Entwurf liegt in Outlook“ dazuschreiben, bei gescheiterten den Grund. Danach anbieten: Vorbereitung vertiefen, Entwürfe überarbeiten oder senden (Skill `outlook`, Senden nur nach Ja zu genau dieser Mail), Aufgaben verschieben.

## Woche
Wie Tag, aber Montag bis Freitag: Termine je Tag, Fristen der Woche, Kunden mit offenem nächstem Schritt, Kunden ohne Kontakt seit über 30 Tagen (Datum aus `_uebersicht.md` bzw. jüngstem Eintrag). Ablage `daten/briefings/JJJJ-Www.md`.

## Nach Terminen
Fragt Stefan „was war heute?“ oder ist ein Termin des Briefings vorbei und nicht erfasst: kurz nachfragen, ob er etwas diktieren will, dann Skill `erfassen`.
