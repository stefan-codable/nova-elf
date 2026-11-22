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
5. **Mails** nur auf Wunsch oder wenn Stefan es in `arbeitsweise.md` so festgelegt hat: mit Skill `outlook` ungelesene und markierte Mails seit gestern prüfen, nennen, was eine Antwort von ihm braucht.
6. **Ablage:** `daten/briefings/JJJJ-MM-TT.md` (Termine `HH:MM–HH:MM | Titel | Ordner | Art`, Vorbereitung, Aufgaben) und fürs Cockpit `daten/briefings/JJJJ-MM-TT.json`: `{"erstellt": "<ISO-Zeit>", "termine": [{"zeit": "09:30–10:00", "titel": "…", "ordner": "kunden/<kunde>", "art": "Kunde", "vorbereitung": "ein Satz"}]}`. Zeile in `protokoll.md`, danach Skill `cockpit` „Senden“.
7. **Antwort im Chat:** kompakt, Termine chronologisch mit je einer Zeile Vorbereitung, dann Aufgaben. Danach anbieten: Vorbereitung vertiefen, Aufgaben verschieben.

## Woche
Wie Tag, aber Montag bis Freitag: Termine je Tag, Fristen der Woche, Kunden mit offenem nächstem Schritt, Kunden ohne Kontakt seit über 30 Tagen (Datum aus `_uebersicht.md` bzw. jüngstem Eintrag). Ablage `daten/briefings/JJJJ-Www.md`.

## Nach Terminen
Fragt Stefan „was war heute?“ oder ist ein Termin des Briefings vorbei und nicht erfasst: kurz nachfragen, ob er etwas diktieren will, dann Skill `erfassen`.
