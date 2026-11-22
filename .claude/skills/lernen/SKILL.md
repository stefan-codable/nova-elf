---
name: lernen
description: Pflegt Elfs Wissen über Stefan, sein Team, Kunden, Zuordnungsregeln, Abkürzungen und Arbeitsweise. Nutzen bei "merk dir", Korrekturen ("nein, das war intern"), Antworten auf Rückfragen, neuen Personen oder Kunden, Umbenennen oder Zusammenlegen von Kunden/Themen und bei "Wissen aufräumen".
---

# Lernen

## Wohin was gehört (`daten/wissen/`)
| Wissen | Datei | Form |
|---|---|---|
| Person | `personen.md` | `- Name – Firma/Nova – Rolle – seit/Quelle` im passenden Abschnitt |
| Kunde | `kunden.md` + Ordner `kunden/<slug>/` | Tabellenzeile |
| Zuordnung | `regeln.md` | `- Wenn <Erkennungsmerkmal>, dann <Ordner/Art> (gelernt JJJJ-MM-TT)` |
| Vorliebe, Ton, Format | `arbeitsweise.md` | Stichpunkt unter passender Überschrift (Mails, Zusammenfassungen, Angebote, Präsentationen, Termine) |
| Abkürzung, Kürzel, Spitzname | `glossar.md` | `- KÜRZEL: Bedeutung` |
| Kernfakten (Rolle, Firma, Team, Top-Kunden) | `kurzprofil.md` | höchstens 2.500 Zeichen, wird bei jedem Start geladen |

## Regeln
1. Erst die Datei lesen, dann ändern. Bestehende Zeile anpassen statt eine zweite anlegen. Widerspricht Neues dem Alten, gilt das Neue; das Alte mit Datum ins Protokoll.
2. Regeln konkret formulieren: woran erkennt man den Fall (Name, Teilnehmerkreis, Betreff, Wochentag)? Eine Regel, die nur ein Mal passt, ist eine Person oder ein Glossareintrag.
3. Beantwortete Frage aus `rueckfragen.md` streichen (Nummern neu zählen).
4. **Korrektur einer Zuordnung:** betroffene Einträge mit `git -C daten mv` in den richtigen Ordner, in `aufgaben.json` `ordner` und `eintrag` anpassen, beide Übersichten nachziehen, Regel festhalten.
5. **Kunde umbenennen oder zusammenlegen:** Ordner verschieben bzw. Einträge zusammenführen, Übersichten zusammenführen, `aufgaben.json` und `kunden.md` anpassen. Leere Ordner nach `papierkorb/`.
6. Zeile oben in `protokoll.md`. Kurz bestätigen, was gelernt wurde (ein Satz).

## Aufräumen (auf Zuruf oder wenn `regeln.md` über 80 Zeilen hat)
Doppelte und überholte Regeln zusammenfassen, `kurzprofil.md` unter 2.500 Zeichen halten, Personen ohne Bezug seit einem Jahr unter „Ehemalig“. Vorher Stefan eine Liste der geplanten Änderungen zeigen.
