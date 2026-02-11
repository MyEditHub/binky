"""
RSS Feed Parser für Nettgeflüster Podcast
Lädt Episoden von 2025 und 2026
"""

import feedparser
import sqlite3
from datetime import datetime
import re

def parse_rss_feed(db_path='../data/nettgefluester.db'):
    """RSS Feed parsen und Episoden speichern"""
    
    print("📡 Lade Nettgeflüster RSS Feed...")
    
    rss_url = "https://cdn.julephosting.de/podcasts/1188-nettgefluster-der-podcast-eines-ehepaars/feed.rss"
    
    try:
        # Feed laden
        feed = feedparser.parse(rss_url)
        
        if not feed.entries:
            print("❌ Keine Episoden im Feed gefunden")
            return
        
        print(f"📋 {len(feed.entries)} Episoden im Feed gefunden")
        
        # Datenbank öffnen
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Nur Episoden von 2025 und 2026
        target_years = [2025, 2026]
        saved_count = 0
        
        for entry in feed.entries:
            try:
                # Episoden-Nummer aus Titel extrahieren
                title = entry.title
                episode_match = re.search(r'#(\d+)', title)
                
                if not episode_match:
                    continue
                
                episode_number = int(episode_match.group(1))
                
                # Datum parsen
                published = entry.get('published_parsed')
                if published:
                    publish_date = datetime(*published[:6])
                    
                    # Nur 2025 und 2026
                    if publish_date.year not in target_years:
                        continue
                    
                    publish_date_str = publish_date.strftime('%Y-%m-%d')
                else:
                    continue
                
                # Audio URL
                audio_url = None
                if hasattr(entry, 'enclosures') and entry.enclosures:
                    audio_url = entry.enclosures[0].get('href', '')
                
                # Dauer (in Sekunden, umrechnen in Minuten)
                duration_minutes = None
                if hasattr(entry, 'itunes_duration'):
                    try:
                        # Format kann sein: "3600" (Sekunden) oder "1:00:00"
                        duration_str = entry.itunes_duration
                        if ':' in duration_str:
                            parts = duration_str.split(':')
                            if len(parts) == 3:  # HH:MM:SS
                                hours, minutes, seconds = map(int, parts)
                                duration_minutes = hours * 60 + minutes
                            elif len(parts) == 2:  # MM:SS
                                minutes, seconds = map(int, parts)
                                duration_minutes = minutes
                        else:
                            duration_minutes = int(duration_str) // 60
                    except:
                        pass
                
                # Prüfen ob Episode bereits existiert
                cursor.execute(
                    "SELECT id FROM episodes WHERE episode_number = ?",
                    (episode_number,)
                )
                
                if cursor.fetchone():
                    # Episode existiert bereits, überspringen
                    continue
                
                # Episode speichern
                cursor.execute(
                    """INSERT INTO episodes 
                       (episode_number, title, publish_date, audio_url, duration_minutes, transcribed)
                       VALUES (?, ?, ?, ?, ?, 0)""",
                    (episode_number, title, publish_date_str, audio_url, duration_minutes)
                )
                
                saved_count += 1
                print(f"  ✅ Episode #{episode_number}: {title[:50]}...")
                
            except Exception as e:
                print(f"  ⚠️  Fehler bei Episode: {e}")
                continue
        
        conn.commit()
        conn.close()
        
        print(f"\n✅ {saved_count} neue Episoden gespeichert!")
        
    except Exception as e:
        print(f"❌ Fehler beim Laden des Feeds: {e}")

if __name__ == "__main__":
    parse_rss_feed()
