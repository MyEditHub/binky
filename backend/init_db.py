"""
Datenbank-Initialisierung für Nettgeflüster
Erstellt alle Tabellen und Grunddaten
"""

import sqlite3
import os

def init_database(db_path='../data/nettgefluester.db'):
    """Datenbank und Tabellen erstellen"""
    
    # Erstelle data Ordner falls nicht vorhanden
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Vögel Tabelle
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS birds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            scientific_name TEXT,
            description TEXT,
            image_url TEXT,
            used INTEGER DEFAULT 0,
            used_date TEXT
        )
    """)
    
    # Themen Tabelle
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'backlog',
            category TEXT,
            created_date TEXT
        )
    """)
    
    # Episoden Tabelle
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS episodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_number INTEGER NOT NULL,
            title TEXT NOT NULL,
            publish_date TEXT,
            audio_url TEXT,
            duration_minutes INTEGER,
            philipp_speaking_time INTEGER,
            nadine_speaking_time INTEGER,
            transcription_text TEXT,
            transcribed INTEGER DEFAULT 0
        )
    """)
    
    # Episode-Topics Verknüpfungstabelle
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS episode_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_id INTEGER,
            topic_id INTEGER,
            planned INTEGER DEFAULT 0,
            discussed INTEGER DEFAULT 0,
            FOREIGN KEY (episode_id) REFERENCES episodes (id),
            FOREIGN KEY (topic_id) REFERENCES topics (id)
        )
    """)
    
    conn.commit()
    conn.close()
    
    print("✅ Datenbank erfolgreich initialisiert!")
    print(f"📁 Speicherort: {os.path.abspath(db_path)}")

if __name__ == "__main__":
    init_database()
