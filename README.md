# 🎙️ Nettgeflüster App

Vogel-Randomizer und Themen-Manager für den Nettgeflüster Podcast von Philipp und Nadine Steuer.

## 📋 Features

- **🐦 Vogel-Randomizer**: Zufällige Auswahl aus NABU-Vogelporträts für "Vogel der Woche"
- **📋 Themen-Backlog**: Verwalte Themen für zukünftige Episoden
- **📊 Statistiken**: Redezeit-Analyse nach Transkription
- **🎯 Episode-Management**: Automatischer RSS-Feed Import

## 🚀 Installation

### Voraussetzungen

- **Python 3.9+** installiert
- **Mac** (für Admin-App)
- Internetverbindung

### Schritt 1: Dateien herunterladen

1. Lade die ZIP-Datei herunter
2. Entpacke sie in einen Ordner deiner Wahl
3. Öffne Terminal (Spotlight → "Terminal" eingeben)

### Schritt 2: Backend einrichten

```bash
# Navigiere zum Backend-Ordner
cd ~/Downloads/nettgefluester-app/backend

# Erstelle virtuelle Umgebung
python3 -m venv venv

# Aktiviere virtuelle Umgebung
source venv/bin/activate

# Installiere Abhängigkeiten
pip install -r requirements.txt

# Initialisiere Datenbank
python init_db.py

# Lade NABU-Vögel
python scrape_birds.py

# Lade Podcast-Episoden (2025-2026)
python rss_parser.py
```

### Schritt 3: Server starten

```bash
# Starte den Backend-Server
python main.py
```

Der Server läuft jetzt auf: `http://localhost:8000`

### Schritt 4: Frontend öffnen

1. Öffne einen neuen Terminal-Tab (CMD + T)
2. Navigiere zum Frontend-Ordner:
   ```bash
   cd ~/Downloads/nettgefluester-app/frontend
   ```
3. Öffne `index.html` im Browser:
   ```bash
   open index.html
   ```

## 📱 Für Philipp & Nadine (Nutzung während Aufnahme)

### Vogel der Woche auswählen:

1. Öffne die Website im Browser
2. Klicke auf "🐦 Vogel der Woche"
3. Klicke "🎲 Zufallsvogel holen"
4. Sprich über den Vogel im Podcast
5. Klicke "✓ Als benutzt markieren"

### Themen verwalten:

1. Gehe zu "📋 Themen-Backlog"
2. Füge neue Themen hinzu
3. Setze Priorität (Hoch/Mittel/Niedrig)
4. Plane Themen für kommende Episoden

## 🔧 Admin-Funktionen (Für dich)

### Episoden transkribieren:

```bash
# Aktiviere virtuelle Umgebung
cd ~/Downloads/nettgefluester-app/backend
source venv/bin/activate

# Starte Transkription (kommt in nächster Version)
python transcribe.py
```

### Neue Episoden abrufen:

```bash
python rss_parser.py
```

### Alle Vögel zurücksetzen:

Im Frontend: Gehe zu "Vogel der Woche" → "🔄 Alle Vögel zurücksetzen"

## 📁 Projektstruktur

```
nettgefluester-app/
├── backend/                 # Python API Server
│   ├── main.py             # FastAPI Hauptserver
│   ├── init_db.py          # Datenbank-Setup
│   ├── scrape_birds.py     # NABU-Scraper
│   ├── rss_parser.py       # RSS-Feed Parser
│   └── requirements.txt    # Python-Pakete
├── frontend/               # Web-Interface
│   └── index.html         # Haupt-Webseite
└── data/                  # Datenbank & Daten
    └── nettgefluester.db  # SQLite Datenbank
```

## 🌐 Online-Deployment (Optional)

### Kostenlos hosten auf Render.com:

1. Erstelle Account auf [render.com](https://render.com)
2. Verknüpfe GitHub Repository
3. Deploy Backend als "Web Service"
4. Deploy Frontend als "Static Site"
5. Teile die URL mit Philipp & Nadine

**Kosten: €0/Monat** (Free Tier)

## 🐛 Problembehebung

### "Module not found" Fehler:
```bash
# Stelle sicher, dass virtuelle Umgebung aktiviert ist
source venv/bin/activate
pip install -r requirements.txt
```

### "Port already in use":
```bash
# Finde Prozess auf Port 8000
lsof -ti:8000 | xargs kill -9

# Oder ändere Port in main.py (letzte Zeile)
uvicorn.run(app, host="0.0.0.0", port=8001)
```

### Frontend lädt nicht:
- Stelle sicher, dass Backend läuft (http://localhost:8000)
- Ändere API_URL in index.html wenn nötig

### Keine Vögel in Datenbank:
```bash
python scrape_birds.py
```

## 📝 API-Endpunkte

- `GET /api/birds` - Alle Vögel
- `GET /api/birds/random` - Zufälliger Vogel
- `POST /api/birds/{id}/mark-used` - Vogel markieren
- `GET /api/topics` - Alle Themen
- `POST /api/topics` - Neues Thema erstellen
- `GET /api/episodes` - Alle Episoden

Vollständige API-Dokumentation: http://localhost:8000/docs

## 🎯 Nächste Schritte

1. ✅ Datenbank einrichten
2. ✅ Vögel laden
3. ✅ Episoden importieren
4. ⏳ Episoden transkribieren (mit Whisper)
5. ⏳ Redezeit-Statistiken generieren
6. ⏳ Online deployen

## 💡 Tipps

- **Backup**: Kopiere `data/nettgefluester.db` regelmäßig
- **Updates**: Führe `python rss_parser.py` wöchentlich aus
- **Mobile**: Die Website funktioniert auch auf Tablets/Phones

## 📞 Support

Bei Fragen oder Problemen:
1. Prüfe die Konsole auf Fehlermeldungen
2. Starte Backend neu
3. Prüfe ob alle Pakete installiert sind

## 📜 Lizenz

Privates Projekt für Nettgeflüster Podcast.
NABU-Daten & Bilder © NABU Deutschland

---

Viel Erfolg mit der App! 🎉
