# 🌐 Online-Deployment Guide

So stellst du die App kostenlos online, damit Philipp & Nadine von überall darauf zugreifen können.

---

## Option 1: Render.com (Empfohlen - Komplett kostenlos)

### Backend deployen:

1. **Account erstellen**
   - Gehe zu: https://render.com
   - Registriere dich kostenlos

2. **GitHub Repository erstellen**
   - Gehe zu: https://github.com
   - Erstelle ein neues Repository "nettgefluester-backend"
   - Lade den `backend/` Ordner hoch

3. **Web Service erstellen**
   - In Render: "New" → "Web Service"
   - Verbinde dein GitHub Repository
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Region: Frankfurt (EU)
   - Instance Type: **Free**
   - Klicke "Create Web Service"

4. **Umgebungsvariablen** (falls nötig):
   - Keine erforderlich für Basic-Setup

5. **Deploy dauert ~5 Minuten**
   - Notiere die URL: z.B. `https://nettgefluester.onrender.com`

### Frontend deployen:

**Option A: Render Static Site**

1. **Static Site erstellen**
   - In Render: "New" → "Static Site"
   - Verbinde GitHub Repository (frontend/)
   - **Build Command**: (leer lassen)
   - **Publish Directory**: `.`
   - Klicke "Create Static Site"

2. **API URL anpassen**
   - Öffne `frontend/index.html`
   - Ändere Zeile 260:
     ```javascript
     const API_URL = 'https://deine-backend-url.onrender.com/api';
     ```
   - Commit & Push zu GitHub
   - Render deployed automatisch neu

**Option B: Vercel (Noch einfacher für Frontend)**

1. Gehe zu: https://vercel.com
2. "Import Project"
3. Wähle GitHub Repository (frontend/)
4. Click "Deploy"
5. Fertig!

---

## Option 2: Railway.app (Auch kostenlos)

### Vorteil:
- Einfacher als Render
- Automatische Datenbank-Backups

### Schritte:

1. **Account erstellen**
   - https://railway.app
   - Login mit GitHub

2. **Neues Projekt**
   - "New Project"
   - "Deploy from GitHub repo"
   - Wähle dein Repository

3. **Settings anpassen**
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Auto-Deploy aktivieren

4. **Domain**
   - Railway gibt dir automatisch eine URL
   - z.B. `nettgefluester-production.up.railway.app`

---

## Option 3: Fly.io (Mit Datenbank-Persistenz)

### Besonders gut für:
- Datenbank-Backup
- Mehr Kontrolle

### Setup:

1. Installiere Fly CLI:
   ```bash
   brew install flyctl  # Mac
   ```

2. Login:
   ```bash
   fly auth login
   ```

3. App erstellen:
   ```bash
   cd backend
   fly launch
   ```

4. Deploy:
   ```bash
   fly deploy
   ```

---

## Datenbank-Persistenz (Wichtig!)

Bei kostenlosem Hosting wird die Datenbank manchmal zurückgesetzt. Lösungen:

### Option A: PostgreSQL (Render)
- Kostenloser PostgreSQL in Render
-Ändere Backend zu PostgreSQL statt SQLite

### Option B: Regelmäßige Backups
- Lade `data/nettgefluester.db` regelmäßig herunter
- Speichere lokal als Backup

### Option C: Mounted Volume (Railway/Fly)
- Persistent Volume für SQLite
- Daten bleiben erhalten

---

## Nach dem Deployment

### 1. URLs notieren:

- **Backend**: https://deine-app.onrender.com
- **Frontend**: https://deine-app.vercel.app

### 2. API-URL im Frontend aktualisieren:

In `frontend/index.html`:
```javascript
const API_URL = 'https://deine-backend-url.onrender.com/api';
```

### 3. Testen:

1. Öffne Frontend-URL
2. Klicke "Zufallsvogel holen"
3. Prüfe ob Vogel erscheint
4. Teste Themen hinzufügen

### 4. Link teilen:

Sende die **Frontend-URL** an Philipp & Nadine:
```
https://nettgefluester.vercel.app
```

---

## Kosten-Übersicht

| Service | Backend | Frontend | Datenbank | Gesamt |
|---------|---------|----------|-----------|--------|
| **Render** | €0 | €0 | €0 (SQLite) | **€0** |
| **Vercel** | - | €0 | - | **€0** |
| **Railway** | €5/Monat nach 500h | - | €0 | **€5** |
| **Fly.io** | €0 (3GB) | - | €0 | **€0** |

**Empfehlung**: Render (Backend) + Vercel (Frontend) = **€0/Monat**

---

## Wartung

### Neue Episoden hinzufügen:

**Automatisch** (empfohlen):
1. Erstelle GitHub Action (`.github/workflows/sync.yml`):
```yaml
name: Sync Episodes
on:
  schedule:
    - cron: '0 12 * * 1'  # Jeden Montag 12:00
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run RSS Parser
        run: |
          cd backend
          pip install -r requirements.txt
          python rss_parser.py
```

**Manuell**:
- Führe lokal `python rss_parser.py` aus
- Push zu GitHub
- Render deployed automatisch

### Vögel zurücksetzen:
- Im Frontend: "Alle Vögel zurücksetzen"
- Oder API: `POST /api/birds/reset`

---

## Custom Domain (Optional)

Falls du eine eigene Domain willst:

### Bei Render:
1. Settings → Custom Domains
2. Füge deine Domain hinzu (z.B. `nettgefluester.de`)
3. Setze CNAME bei deinem Domain-Provider

### Bei Vercel:
1. Project Settings → Domains
2. Füge Domain hinzu
3. Folge den DNS-Anweisungen

**Kosten**: ~€10/Jahr für .de Domain

---

## Monitoring & Logs

### Render:
- Dashboard → Logs (Live-Logs)
- Metrics → Performance-Daten

### Fehler debuggen:
```bash
# Logs ansehen
curl https://deine-app.onrender.com/api/
```

---

## Sicherheit

### CORS richtig setzen:

In `backend/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://deine-frontend.vercel.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Keine Authentifizierung nötig:
- App ist öffentlich zugänglich
- Nur Philipp & Nadine kennen die URL
- Bei Bedarf: Basic Auth hinzufügen

---

## Nächste Schritte

1. ✅ Backend auf Render deployen
2. ✅ Frontend auf Vercel deployen
3. ✅ URLs testen
4. ✅ Link an Philipp & Nadine senden
5. ⏳ Erste Episode gemeinsam testen

---

## Hilfreiche Links

- Render Docs: https://render.com/docs
- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- GitHub Actions: https://docs.github.com/actions

---

**Viel Erfolg beim Deployment! 🚀**
