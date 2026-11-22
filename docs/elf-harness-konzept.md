# Nova Elf als Harness: Konzept

Stand 22.11.2026. Noch nichts gebaut. Ersetzt für den Anfang den Server-und-Slack-Weg aus `nova-harness/berichte/nova-elf-online-konzept-2026-11-19.md` (der bleibt als spätere Ausbaustufe, falls Elf rund um die Uhr laufen muss).

## 1. Die Idee in einem Absatz

Nova Elf wird kein weiteres Programm, sondern ein Arbeitsordner, den Claude Code in der Desktop-App bedient, wie den Nova Harness. Du öffnest eine Session in `~/Sites/nova-elf`, diktierst oder fügst ein, und Elf ordnet ein, fasst zusammen, leitet To-dos ab, fragt bei Unklarem einmal nach und merkt sich die Antwort. Die Daten liegen als lesbare Dateien mit eigenem Git im Ordner. Outlook und Kalender liest Elf über den eingebauten Browser. Ein Artefakt („Cockpit“) zeigt To-dos, Kunden und Termine zum Lesen, Abhaken und Sortieren. Alles läuft über das Abo, ohne API-Schlüssel, ohne Server, ohne Slack.

## 2. Was geprüft ist

- **Bestand:** 47 Einträge in 25 Themen (19 Kunden, 5 Intern, 1 Privat), 4 offene To-dos, alles JSON unter `data/` mit eigenem Git. Übernahme ist ein Skript-Lauf.
- **Outlook über den Browser:** Der eingebaute Browser erreicht Outlook im Web (`outlook.office.com` leitet auf `outlook.cloud.microsoft`) und landet bei der Microsoft-Anmeldung. Heißt: einmal selbst anmelden, danach kann Elf Kalender und Postfach lesen. Alternativ „Claude in Chrome“, dort bist du vermutlich schon angemeldet.
- **Mails senden:** geht technisch. Elf schreibt den Entwurf, zeigt ihn dir und sendet erst nach deinem „Ja“ für genau diese Mail. Das ist eine feste Sicherheitsregel von Claude und bleibt so. Variante: Elf legt den Entwurf in Outlook ab, du klickst selbst auf Senden.
- **Cockpit-Artefakt:** Artefakte können eine eigene kleine Datenbank haben, die die Seite und Claude beide lesen und schreiben. Damit fließen Haken und Sortierungen aus dem Cockpit zurück zu Elf. Dazu kann das Cockpit selbst diktieren (Spracheingabe im Browser bzw. in der Desktop-App).
- **Abo:** Claude Code in der Desktop-App zählt aufs Team-Abo. Keine API-Kosten, solange kein `ANTHROPIC_API_KEY` im Spiel ist.
- **Handy:** Über Remote Control lässt sich eine laufende Desktop-Session aus der Claude-App am Handy weiterführen (Mac muss wach sein). Das Cockpit ist am Handy lesbar. Das ersetzt den Slack-Bot für den Anfang.

## 3. Aufbau im Ordner `~/Sites/nova-elf`

```
CLAUDE.md                 Elf: Rolle, Regeln, Ablauf (statt der heutigen Entwicklerregeln)
.claude/
  settings.json           Session-Start-Hook, Rechte
  hooks/start.sh          lädt Kurzprofil, Fälliges, Eingang (unter 9.500 Zeichen)
  skills/
    erfassen/             alles Neue: Diktat, Terminnotiz, Transkript, Foto
    briefing/             Tag oder Woche: Termine, Fälliges, offene Mails, Vorbereitung
    outlook/              Postfach und Kalender lesen, Entwürfe, Senden nach Ja
    cockpit/              Artefakt füllen, Haken und Eingang zurückholen
    lernen/               Wissen pflegen, Regeln aufräumen
daten/                    eigenes Git, privates Remote als Sicherung (nicht im Code-Repo)
  wissen/
    kurzprofil.md         wer du bist, Rolle, Team, wichtigste Kunden (wird immer geladen)
    personen.md           Mitarbeiter, Geschäftsführung, Ansprechpartner je Kunde
    kunden.md             Kundenliste mit Kürzel, Ordner, Status, Ansprechpartner
    regeln.md             gelernte Zuordnungen („Jour fixe mit X = intern, Geschäftsführung“)
    arbeitsweise.md       wie du Zusammenfassungen, To-dos, Mails haben willst
  kunden/<kunde>/
    _uebersicht.md        Stand, nächster Schritt, offene Punkte (von Elf gepflegt)
    2026-11-12-workshop.md
  intern/<thema>/…
  privat/…
  aufgaben.json           To-dos (strukturiert, weil das Cockpit sie abgleicht)
  eingang.md              noch nicht Einsortiertes
  protokoll.md            was Elf wann geändert hat, je Zeile
docs/entwicklung.md       die bisherigen Regeln für die Web-App
```

Einträge werden Markdown mit kurzem Kopf (`datum`, `art`, `teilnehmer`, `quelle`, `id`), damit Claude sie direkt lesen, durchsuchen und ergänzen kann. To-dos bleiben JSON (`id`, `text`, `faellig`, `erledigt`, `kunde`, `quelle`, `reihenfolge`), weil sie mit dem Cockpit abgeglichen werden.

## 4. So arbeitest du mit Elf

**Erfassen.** Du diktierst oder fügst etwas ein. Elf erkennt die Art:
- Terminnotiz oder Transkript → Zusammenfassung, Entscheidungen, To-dos mit Termin und Verantwortlichem, Eintrag im richtigen Kunden- oder Internordner, `_uebersicht.md` des Kunden aktualisiert.
- Kurzinfo („X ist jetzt Ansprechpartner bei Y“) → ins Wissen.
- Aufgabe → To-do.
- Frage → Antwort aus dem Bestand mit Verweis auf den Eintrag.

**Rückfragen statt Raten.** Ist etwas unklar, fragt Elf einmal mit Knöpfen nach, zum Beispiel: „Termin mit Anna und Jens: Kunde, intern Geschäftsführung, intern Management oder Team?“ Unbekannte Person: „Wer ist das?“ Die Antwort landet in `personen.md` oder `regeln.md`. Beim nächsten Mal fragt Elf nicht mehr. So wird Elf mit jeder Woche treffsicherer.

**Briefing.** „Was steht heute an?“ Elf liest den Kalender in Outlook, legt die fälligen To-dos daneben und bereitet jeden Termin aus der Kundenhistorie vor (letzter Stand, offene Punkte, was du zusagen wolltest). Nach dem Termin diktierst du kurz, Elf erfasst.

**Mails.** „Was muss ich beantworten?“ Elf geht das Postfach durch, nennt, was eine Antwort von dir braucht, und schlägt Entwürfe in deinem Ton vor. Senden nur nach Ja.

**Ein Chat, kein Gedächtnisverlust.** Alles Wichtige steht in Dateien. Eine neue Session weiß über den Start-Hook sofort, wer du bist, was fällig ist und was im Eingang liegt. Vorschlag: eine angeheftete Session „Elf“ für den Alltag, bei Bedarf neue Sessions für größere Themen, alle in einer Seitenleisten-Gruppe.

## 4a. Werkzeugkasten: Vorbereiten mit vorhandenen Skills

Elf bereitet vor, die anderen Projekte setzen um. Jede Arbeit nutzt das Wissen aus `daten/` (Kundenhistorie, Termine, Personen). Recherche vom 22.11.2026: Alles Nötige ist schon installiert (Org-Plugins Sales, Marketing, Small Business, Anthropic-Formate, Artefakt-Typen). Installiert wird nichts Neues.

| Arbeit | Skill | Ergebnis |
|---|---|---|
| Termin vorbereiten | `sales:call-prep` | Briefing je Termin: Teilnehmer, Historie, offene Punkte, Fragen |
| Nach dem Termin | `erfassen` (Elf), Follow-up-Mail mit `sales:call-summary` | Eintrag, To-dos, Mail-Entwurf |
| Recherche Firma oder Person | `sales:account-research` | Steckbrief mit Quellen |
| Wettbewerb, Markt | `marketing:competitive-brief` | Vergleich mit Quellen |
| Angebot | `small-business:proposal-builder` | Angebot aus Gesprächsnotizen, Preise nur aus Preisliste und früheren Angeboten, als Docs-Artefakt (Export .docx/PDF) oder `anthropic-skills:docx` mit Nova-Vorlage |
| Kalkulation | Sheets-Artefakt oder `anthropic-skills:xlsx` | Tabelle mit Formeln |
| Präsentation | Inhalt mit `sales:create-an-asset` (keine erfundenen Zahlen), Ausgabe als Slides-Artefakt (Download .pptx/PDF) oder `anthropic-skills:pptx` mit Nova-Vorlage | Deck |
| Marketingplan | `marketing:campaign-plan`, Positionierung `product-marketing`, Texte `copywriting` + `emil-unslop-writing` | Plan mit Kanälen, Zeitplan, Kennzahlen |
| Kundenplan für wichtige Kunden | `sales:account-plan`, `sales:stakeholder-map` | Plan und Entscheiderkarte |
| Ausschreibung, PDF lesen | `anthropic-skills:pdf` | Auszug, Anforderungen |
| Umsetzen in einem Projekt | Übergabe-Brief, dann `/nova:run <projekt>` in eigener Session | Elf baut nichts selbst |

Die Sales-Skills sprechen von „CRM“. Für Elf heißt das: `daten/kunden/` und `daten/wissen/`. Ergebnisse landen beim Kunden (`daten/kunden/<kunde>/`) oder unter `daten/arbeit/`.

Bewusst nicht genutzt: `productivity:memory-management` und `task-management` (Elf hat eigenes Gedächtnis und eigene Aufgaben), `sales:daily-briefing` (auf CRM-Pipeline gebaut, Elf hat eigenes `briefing`), `nimble:*` (nicht angemeldet, eigener Dienst), Exa Deep Research (eigener API-Schlüssel), `humanize-writing` (doppelt zu `emil-unslop-writing`), Agency MCP und meeting-prep-agent (andere Branchen bzw. fremde Konten).

Damit Angebote und Präsentationen wirklich gut werden, braucht Elf Material von dir in `daten/vorlagen/`: Preisliste oder Tagessätze, zwei bis drei frühere Angebote, Angebotsvorlage, Präsentationsvorlage oder CI, Leistungsbeschreibung von Nova.

## 5. Das Cockpit (Artefakt)

- **Zeigt:** Heute (Termine aus dem letzten Briefing, fällige und überfällige To-dos), alle To-dos nach Kunde, Kundenliste mit letztem Kontakt und nächstem Schritt, Eingang.
- **Kann:** abhaken, sortieren, verschieben (Morgen, Nächste Woche), schnell etwas diktieren oder tippen (landet im Eingang), Outlook öffnen, „Im Chat besprechen“ (kopiert eine fertige Anfrage für die Elf-Session).
- **Datenfluss:** Elf schreibt nach jeder Änderung die Daten in die Datenbank des Artefakts. Was du im Cockpit tust, steht dort ebenfalls. Beim Start einer Session (oder auf „sync“) holt Elf Haken, Reihenfolge und Eingang zurück in die Dateien. Wahrheit bleiben die Dateien mit Git.
- **Was hineingeht:** Zusammenfassungen, To-dos, Kundenstand. Die vollständigen Notizen bleiben lokal. Das Artefakt ist privat, liegt aber bei claude.ai, wie deine Chats auch.

## 6. Outlook: zwei Wege

| | A: Browser (sofort) | B: Microsoft-365-Connector (später) |
|---|---|---|
| Einrichtung | einmal im eingebauten Browser anmelden | Zustimmung eures Microsoft-Admins |
| Lesen | Kalender und Postfach über die Weboberfläche | Suche in Mails und Kalender, deutlich robuster und schneller |
| Senden | Entwurf, Senden nach Ja | nach meinem Stand nur lesend, Senden weiter über A |
| Grenzen | nur bei offener App, langsamer, kann bei Outlook-Umbauten haken | Admin nötig |

Empfehlung: mit A starten, B beim Admin anfragen. Der Skill `outlook` kapselt beides, der Rest merkt den Wechsel nicht.

## 7. Und die Web-App?

Entschieden (22.11.2026): einfrieren. Outlook vorerst ohne Connector, nur über den Browser. Die App dient nur noch für den einmaligen Import und zum Nachschlagen, bis das Cockpit steht. Ihre Regeln wandern nach `docs/entwicklung.md`. Weiterentwicklung der App lohnt nicht, solange Chat und Cockpit alles abdecken. Wird sie doch wieder gebraucht, liest sie später dieselben Markdown-Dateien.

## 8. Bauabschnitte

| # | Abschnitt | Fertig, wenn |
|---|---|---|
| 1 | Gerüst und Umzug: `CLAUDE.md`, Ordner, Hook, Import der 47 Einträge und 4 To-dos nach Markdown/JSON, Personen- und Kundenliste aus dem Bestand vorschlagen, du bestätigst | Eine neue Session in `nova-elf` kennt dich, deine Kunden und das Fällige ohne Nachfrage |
| 2 | Erfassen und Lernen: Skills `erfassen` und `lernen`, Rückfragen mit Knöpfen, Regeln | Ein diktiertes Terminprotokoll steht mit Zusammenfassung und To-dos im richtigen Ordner; eine Rückfrage wird beim zweiten Mal nicht mehr gestellt |
| 3 | Cockpit: Artefakt mit Datenbank, Abgleich in beide Richtungen | Ein Haken im Cockpit ist nach dem nächsten Session-Start in `aufgaben.json` erledigt |
| 4 | Outlook über den Browser: Kalender, Briefing, Postfach, Entwürfe | „Was steht heute an?“ liefert deine Termine mit Vorbereitung |
| 5 | Optional: Connector, Briefing per Zeitplan am Morgen, Handy über Remote Control einrichten | nach Bedarf |

Stand 22.11.2026: Abschnitte 1 bis 3 gebaut (Cockpit: https://claude.ai/artifact/NPBMNuFmJfhHcwz763DcC3), Abschnitt 4 als Skill geschrieben, aber noch nicht mit echtem Outlook getestet.

Ursprünglich geplant: Bau über den Nova Harness (`/nova:onboard nova-elf`, dann je Abschnitt `/nova:run nova-elf …`). Abschnitt 1 und 2 brauchen kein Outlook.

## 9. Offene Punkte

- **Microsoft-Admin:** Wer erteilt die Zustimmung für den Connector? Bist du das selbst?
- **Harness-Hook:** Der Session-Start-Hook des Nova Harness meldet sich auch in `nova-elf`. Er bekommt eine Ausnahme, damit in Elf-Sessions nur der Elf-Kontext geladen wird.
- **Briefing per Zeitplan:** Ob ein geplanter Lauf der Desktop-App den Browser nutzen darf, zeigt erst der Test in Abschnitt 5.
- **Verbrauch:** Outlook über den Browser kostet mehr Abo als ein Connector (ganze Seiten statt Treffer). Wird in Abschnitt 4 beobachtet.

## 10. Bewusst nicht dabei

- Eigener Server, Slack-Bot, API-Schlüssel (siehe Konzept vom 19.11., bleibt als Ausbaustufe).
- Automatisches Senden von Mails ohne dein Ja.
- Mehrere Nutzer.
