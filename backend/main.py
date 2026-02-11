"""
Nettgeflüster Backend API
Handles birds, episodes, topics, and statistics
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import sqlite3
import json
import random

app = FastAPI(title="Nettgeflüster API")

# CORS für Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Produktion spezifischer machen
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Datenbank-Verbindung
def get_db():
    conn = sqlite3.connect('../data/nettgefluester.db')
    conn.row_factory = sqlite3.Row
    return conn

# Pydantic Models
class Bird(BaseModel):
    id: Optional[int] = None
    name: str
    scientific_name: str
    description: str
    image_url: str
    used: bool = False
    used_date: Optional[str] = None

class Topic(BaseModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    priority: str = "medium"  # low, medium, high
    status: str = "backlog"  # backlog, planned, discussed, skipped
    category: Optional[str] = None
    created_date: Optional[str] = None

class Episode(BaseModel):
    id: Optional[int] = None
    episode_number: int
    title: str
    publish_date: str
    audio_url: str
    duration_minutes: Optional[int] = None
    philipp_speaking_time: Optional[int] = None
    nadine_speaking_time: Optional[int] = None
    transcription_text: Optional[str] = None
    transcribed: bool = False

# === VOGEL ENDPOINTS ===

@app.get("/")
async def root():
    return {"message": "Nettgeflüster API läuft! 🎙️"}

@app.get("/api/birds", response_model=List[Bird])
async def get_all_birds():
    """Alle Vögel abrufen"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM birds ORDER BY name")
    birds = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return birds

@app.get("/api/birds/random")
async def get_random_bird():
    """Zufälligen unbenutzten Vogel abrufen"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM birds WHERE used = 0")
    unused_birds = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    if not unused_birds:
        raise HTTPException(status_code=404, detail="Alle Vögel wurden bereits benutzt!")
    
    return random.choice(unused_birds)

@app.get("/api/birds/stats")
async def get_bird_stats():
    """Vogel-Statistiken"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM birds")
    total = cursor.fetchone()['total']
    cursor.execute("SELECT COUNT(*) as used FROM birds WHERE used = 1")
    used = cursor.fetchone()['used']
    conn.close()
    
    return {
        "total": total,
        "used": used,
        "remaining": total - used
    }

@app.post("/api/birds/{bird_id}/mark-used")
async def mark_bird_used(bird_id: int):
    """Vogel als benutzt markieren"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE birds SET used = 1, used_date = ? WHERE id = ?",
        (datetime.now().isoformat(), bird_id)
    )
    conn.commit()
    conn.close()
    return {"message": "Vogel als benutzt markiert"}

@app.post("/api/birds/{bird_id}/unmark")
async def unmark_bird(bird_id: int):
    """Vogel-Markierung rückgängig machen"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE birds SET used = 0, used_date = NULL WHERE id = ?",
        (bird_id,)
    )
    conn.commit()
    conn.close()
    return {"message": "Vogel-Markierung entfernt"}

@app.post("/api/birds/reset")
async def reset_all_birds():
    """Alle Vögel zurücksetzen"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE birds SET used = 0, used_date = NULL")
    conn.commit()
    conn.close()
    return {"message": "Alle Vögel zurückgesetzt"}

# === THEMEN ENDPOINTS ===

@app.get("/api/topics", response_model=List[Topic])
async def get_all_topics(status: Optional[str] = None):
    """Alle Themen abrufen (optional nach Status filtern)"""
    conn = get_db()
    cursor = conn.cursor()
    
    if status:
        cursor.execute("SELECT * FROM topics WHERE status = ? ORDER BY created_date DESC", (status,))
    else:
        cursor.execute("SELECT * FROM topics ORDER BY created_date DESC")
    
    topics = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return topics

@app.post("/api/topics")
async def create_topic(topic: Topic):
    """Neues Thema erstellen"""
    conn = get_db()
    cursor = conn.cursor()
    
    topic.created_date = datetime.now().isoformat()
    
    cursor.execute(
        """INSERT INTO topics (title, description, priority, status, category, created_date)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (topic.title, topic.description, topic.priority, topic.status, topic.category, topic.created_date)
    )
    conn.commit()
    topic_id = cursor.lastrowid
    conn.close()
    
    return {"id": topic_id, "message": "Thema erstellt"}

@app.put("/api/topics/{topic_id}")
async def update_topic(topic_id: int, topic: Topic):
    """Thema aktualisieren"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """UPDATE topics 
           SET title = ?, description = ?, priority = ?, status = ?, category = ?
           WHERE id = ?""",
        (topic.title, topic.description, topic.priority, topic.status, topic.category, topic_id)
    )
    conn.commit()
    conn.close()
    return {"message": "Thema aktualisiert"}

@app.delete("/api/topics/{topic_id}")
async def delete_topic(topic_id: int):
    """Thema löschen"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM topics WHERE id = ?", (topic_id,))
    conn.commit()
    conn.close()
    return {"message": "Thema gelöscht"}

@app.get("/api/topics/stats")
async def get_topic_stats():
    """Themen-Statistiken"""
    conn = get_db()
    cursor = conn.cursor()
    
    stats = {}
    for status in ['backlog', 'planned', 'discussed', 'skipped']:
        cursor.execute("SELECT COUNT(*) as count FROM topics WHERE status = ?", (status,))
        stats[status] = cursor.fetchone()['count']
    
    conn.close()
    return stats

# === EPISODEN ENDPOINTS ===

@app.get("/api/episodes", response_model=List[Episode])
async def get_all_episodes():
    """Alle Episoden abrufen"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM episodes ORDER BY episode_number DESC")
    episodes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return episodes

@app.get("/api/episodes/{episode_id}")
async def get_episode(episode_id: int):
    """Einzelne Episode abrufen"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM episodes WHERE id = ?", (episode_id,))
    episode = cursor.fetchone()
    conn.close()
    
    if not episode:
        raise HTTPException(status_code=404, detail="Episode nicht gefunden")
    
    return dict(episode)

@app.get("/api/episodes/stats/speaking-time")
async def get_speaking_time_stats():
    """Redezeit-Statistiken"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT 
           COUNT(*) as total_episodes,
           AVG(philipp_speaking_time) as avg_philipp,
           AVG(nadine_speaking_time) as avg_nadine,
           SUM(philipp_speaking_time) as total_philipp,
           SUM(nadine_speaking_time) as total_nadine
           FROM episodes 
           WHERE transcribed = 1"""
    )
    stats = dict(cursor.fetchone())
    conn.close()
    return stats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
