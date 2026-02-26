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

### v0.1.0

### v0.1.1 (2026-02-26)

- Nur noch `.pkg`-Installer verfügbar — einfachere Installation ohne manuelles Drag & Drop
- Auto-Update-Signierung korrigiert — Updates werden jetzt korrekt verifiziert und eingespielt


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
