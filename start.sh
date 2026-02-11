#!/bin/bash

echo "🎙️ Starte Nettgeflüster App..."
echo ""

# Wechsle zum Backend-Verzeichnis
cd "$(dirname "$0")/backend"

# Prüfe ob virtuelle Umgebung existiert
if [ ! -d "venv" ]; then
    echo "⚠️  Virtuelle Umgebung nicht gefunden!"
    echo "Führe bitte zuerst die Installation durch:"
    echo ""
    echo "  cd backend"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    echo "  python init_db.py"
    echo "  python scrape_birds.py"
    echo "  python rss_parser.py"
    echo ""
    exit 1
fi

# Aktiviere virtuelle Umgebung
source venv/bin/activate

# Prüfe ob Datenbank existiert
if [ ! -f "../data/nettgefluester.db" ]; then
    echo "📦 Initialisiere Datenbank..."
    python init_db.py
    echo ""
    
    echo "🐦 Lade NABU-Vögel..."
    python scrape_birds.py
    echo ""
    
    echo "📡 Lade Podcast-Episoden..."
    python rss_parser.py
    echo ""
fi

echo "✅ Backend läuft auf: http://localhost:8000"
echo "✅ Frontend öffnen: http://localhost:8000/index.html"
echo ""
echo "Drücke CTRL+C zum Beenden"
echo ""

# Starte Server
python main.py
