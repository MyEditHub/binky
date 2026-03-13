# Binky 🐌

Euer Werkzeug für die Nettgeflüster-Sendungsvorbereitung. Vogel der Woche, Wort-Tracker und offene Themen — alles an einem Ort.

## ✨ Features

### 🎙️ Episoden & Transkription

- Automatischer Import aller Episoden via RSS-Feed
- Lokale Offline-Transkription — keine Cloud, keine Kosten
- Transkript-Viewer mit Volltextsuche

### 📊 Sprecher-Analyse

- Wer redet wie viel? Redeanteil pro Sprecher in Prozent
- Trend über alle Episoden auf einen Blick
- Sprecher-Segmente manuell korrigierbar

### 📝 Themen-Backlog

- Offene Themen aus Episoden automatisch erkennen (mit OpenAI)
- Status verwalten: Offen → Erledigt
- Nach Episode gruppiert oder als Liste

### 💬 Wort-Tracker

- Eigene Wort-Kategorien anlegen (z. B. „Peniswitze", „Hunde")
- Zählt alle Treffer über alle Episoden
- Visualisierung als Balkendiagramm

### 🐦 Vogel der Woche

- Zufälliger Vogel aus der NABU-Datenbank
- Zeigt alle Infos zum Vorlesen direkt in der Sendung
- Verlauf: welcher Vogel kam in welcher Episode

## 📥 Download

**Aktuelle Version:** [Releases](https://github.com/MyEditHub/binky/releases)

### Systemvoraussetzungen

- macOS 12.0 (Monterey) oder neuer
- ca. 50 MB Speicherplatz (+ Whisper-Modell nach Wahl)

## 🚀 Installation

1. Lade die aktuelle `.pkg`-Datei von [GitHub Releases](https://github.com/MyEditHub/binky/releases) herunter
2. Öffne die `.pkg`-Datei und folge dem Installationsassistenten
3. Starte die App — macOS fragt beim ersten Start nach Erlaubnis: **Systemeinstellungen → Datenschutz & Sicherheit → „Trotzdem öffnen"**

## 🎯 Erste Schritte

### Episoden laden

1. Öffne **Einstellungen** und stelle sicher, dass ein Whisper-Modell heruntergeladen ist
2. Wechsle zu **Episoden** und klicke auf **Synchronisieren**
3. Wähle eine Episode und klicke auf **Transkribieren**

### Vogel der Woche ziehen

1. Wechsle zu **Vogel-Randomizer**
2. Klicke auf **Neuen Vogel ziehen**
3. Decke den Vogel auf und lies die NABU-Infos direkt in der Sendung vor
4. Markiere ihn danach als **Verwendet**

### Themen analysieren

1. Stelle in **Einstellungen → OpenAI** deinen API-Schlüssel ein
2. Wechsle zu **Themen** — Binky analysiert automatisch alle transkribierten Episoden
3. Erkannte Themen erscheinen unter **Offen**; erledige oder stelle sie zurück

### Wort-Tracker einrichten

1. Gehe zu **Einstellungen → Wort-Tracker**
2. Lege Kategorien mit Varianten an (z. B. Kategorie „Hunde" mit Varianten „Hund", „Wau", „Bello")
3. Die Gesamtanzahl aller Treffer siehst du unter **Statistiken**

## 📝 Changelog

### v0.2.6 (2026-03-12)

- commited changes

### v0.2.5 (2026-03-12)

### Fixed

- Speaker identification now uses a 4-wave detection strategy: intro pattern, first-person anchors ("Ich bin Philipp"), direct address ("Hey Nadine"), and positional fallback — correctly assigns speakers even when the name appears late in the episode
- Speaker detection is now idempotent: re-running "Sprecher erkennen" always produces the same result instead of flipping speakers on every run
- Added "Wie immer gegenüber" and "wunderschöne, einzigartige" as recognised intro patterns for episodes that don't use the standard intro
- Intro detection now scans the next 3 segments after the intro phrase, fixing episodes where Whisper splits the intro and the host name into separate segments
- Fixed diarization queue race condition where episodes could get stuck after a batch completed
- Reverted embedding model to wespeaker (NeMo TitaNet Large was CPU-only single-threaded: 6+ hours per episode)

### v0.2.4 (2026-03-03)

### Added

- Diarisierungsmodell-Manager in den Einstellungen — Modelle herunterladen und löschen direkt in der App
- Episoden mit Status „Nicht analysiert" können jetzt in der Analyse-Ansicht angeklickt und neu diarisiert werden

### Changed

- Sprecher-Erkennungsmodell gewechselt zu NeMo TitaNet Large für bessere Sprecher-Trennung
- Sprecher-Erkennung nutzt jetzt das Intro-Muster („Neue Woche, neue Folge…") statt Namens-Zählung — zuverlässiger bei Hosts, die sich gegenseitig erwähnen
- Transkript-Anzeige zeigt Sprecher-Wechsel jetzt in chronologischer Reihenfolge (Whisper-Segmente als Anzeigeeinheit)

### Fixed

- Doppelte Sätze im Transkript: Whisper-Segmente wurden mehreren Diarisierungs-Fenstern gleichzeitig zugewiesen
- Große Sprecher-Blöcke statt feiner Wechsel: Scoring bevorzugt jetzt Whisper-Abdeckung als primäres Kriterium
- Sprecher-Korrekturen wurden bei erneutem Öffnen der Analyse-Seite zurückgesetzt
- Fortschritts-Banner blieb nach abgeschlossener Diarisierung stehen
- Transkript zeigte veraltete Sprecher-Zuordnung nach „Sprecher erkennen" ohne Seiten-Wechsel

### v0.2.3 (2026-03-02)

### Added

- Analytik: Schaltfläche „Sprecher erkennen" erkennt automatisch per Transkripttext, ob Sprecher 0 und Sprecher 1 vertauscht sind, und korrigiert alle betroffenen Episoden auf einmal

### v0.2.0 (2026-03-01)

### Added

- Transkripte zeigen jetzt, wer was gesagt hat: Jeder Absatz hat ein farbiges Label mit dem Namen des Sprechers (Nadine oder Philipp)
- Aufeinanderfolgende Sätze desselben Sprechers werden automatisch zu einem Block zusammengefasst — kein Wechsel mitten im Gedanken
- Suche im Transkript funktioniert auch in der neuen Sprecher-Ansicht mit Navigation zwischen Treffern

### Fixed

- Themen-Seite war unter bestimmten Umständen nicht erreichbar
- Vogel-Datenbank: Fehler in Migration behoben, der Vogelnamen nicht korrekt zuordnen konnte

### v0.1.3 (2026-02-27)

### Changed

- Release-Seite zeigt jetzt strukturierte Versionshinweise mit Download-Tabelle und Installationsanleitung

### Fixed

- (none)

### v0.1.2 (2026-02-26)

- Release-Pipeline stabilisiert — Builds laufen jetzt zuverlässig durch

### v0.1.1 (2026-02-26)

- Nur noch `.pkg`-Installer verfügbar — einfachere Installation ohne manuelles Drag & Drop
- Auto-Update-Signierung korrigiert — Updates werden jetzt korrekt verifiziert und eingespielt

### v0.1.0

- Erster Release
- Episoden-Import via RSS, lokale Transkription mit Whisper
- Sprecher-Analyse mit automatischer Diarisierung
- Themen-Backlog mit OpenAI-Analyse
- Wort-Tracker mit Balkendiagramm
- Vogel-Randomizer mit NABU-Datenbank und Verlauf
- Auto-Update via GitHub Releases

## 📄 Lizenz

Privates Projekt — Nettgeflüster Podcast.

---

**Für Philipp & Nadine.**
