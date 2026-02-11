#!/bin/bash

echo "🎙️ Nettgeflüster App - Schnell-Installation"
echo "==========================================="
echo ""

# Prüfe Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 ist nicht installiert!"
    echo "Bitte installiere Python von: https://www.python.org/downloads/"
    exit 1
fi

echo "✅ Python gefunden: $(python3 --version)"
echo ""

# Wechsle zum Backend
cd "$(dirname "$0")/backend"

echo "📦 Erstelle virtuelle Umgebung..."
python3 -m venv venv
echo "✅ Virtuelle Umgebung erstellt"
echo ""

echo "📥 Aktiviere virtuelle Umgebung..."
source venv/bin/activate
echo "✅ Aktiviert"
echo ""

echo "📥 Installiere Pakete (das kann einige Minuten dauern)..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "✅ Pakete installiert"
echo ""

echo "🗄️  Initialisiere Datenbank..."
python init_db.py
echo ""

echo "🐦 Lade NABU-Vögel..."
python scrape_birds.py
echo ""

echo "📡 Lade Podcast-Episoden (2025-2026)..."
python rss_parser.py
echo ""

echo "=========================================="
echo "✅ Installation abgeschlossen!"
echo ""
echo "🚀 Zum Starten:"
echo "   ./start.sh"
echo ""
echo "Oder manuell:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "Dann öffne: frontend/index.html im Browser"
echo "=========================================="
