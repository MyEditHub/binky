# External Integrations

**Analysis Date:** 2026-02-10

## APIs & External Services

**RSS Feed Provider:**
- Julep Hosting - Nettgeflüster Podcast RSS feed
  - URL: `https://cdn.julephosting.de/podcasts/1188-nettgefluster-der-podcast-eines-ehepaars/feed.rss`
  - SDK/Client: feedparser (Python library)
  - Used by: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/rss_parser.py`
  - Purpose: Automatically fetch podcast episodes for the current year (2025-2026)
  - Data extracted: Episode title, number, publish date, audio URL, duration

**Web Scraping (NABU):**
- NABU Deutschland - Bird portrait database
  - URL: `https://www.nabu.de/tiere-und-pflanzen/voegel/portraets/index.html`
  - SDK/Client: beautifulsoup4 + requests
  - Used by: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/scrape_birds.py`
  - Purpose: Fetch bird species information and images for "Vogel der Woche" (Bird of the Week)
  - Note: Currently uses 10 example birds (line 64-125 in scrape_birds.py); full scraping of 314 birds documented as future enhancement

**Frontend CDN Resources:**
- Google Fonts - Typography
  - URL: `https://fonts.googleapis.com/css2?family=Righteous&family=Poppins:wght@300;400;500;600;700&display=swap`
  - Used in: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` line 7

- React 18 Production Build - UI Framework
  - URL: `https://unpkg.com/react@18/umd/react.production.min.js`
  - Used in: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` line 8

- React DOM - React renderer
  - URL: `https://unpkg.com/react-dom@18/umd/react-dom.production.min.js`
  - Used in: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` line 9

- Babel Standalone - JSX transpiler
  - URL: `https://unpkg.com/@babel/standalone/babel.min.js`
  - Used in: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` line 10

## Data Storage

**Databases:**
- SQLite 3 (file-based)
  - Location: `../data/nettgefluester.db` (relative to backend)
  - Absolute path: `/Users/tmtlxantonio/Desktop/nettgefluester-app/data/nettgefluester.db`
  - Connection: Direct file connection via Python `sqlite3` module (built-in)
  - ORM: None - raw SQL queries with cursor operations
  - Tables:
    - `birds` - Bird species with usage tracking
    - `topics` - Podcast topic ideas with priority/status
    - `episodes` - Podcast episode metadata and transcription status
    - `episode_topics` - Junction table linking episodes to topics
  - Schema init: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/init_db.py`

**File Storage:**
- Local filesystem only
  - Database file stored in `/data/` subdirectory (auto-created by init_db.py line 13)
  - Bird images hosted externally at NABU.de URLs (stored as URLs in database, not as files)
  - Audio files hosted on Julep Hosting CDN (stored as URLs in database)

**Caching:**
- None detected - No caching layer configured

## Authentication & Identity

**Auth Provider:**
- Custom/None - No authentication implemented
- Implementation: Open endpoints with CORS for all origins (line 18-24 in `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py`)
- Security model: Relies on knowledge of URL (for Philipp & Nadine)
- Note: DEPLOYMENT.md line 268 states "Keine Authentifizierung nötig" (No authentication needed) - only users with URL can access

## Monitoring & Observability

**Error Tracking:**
- None detected - No error tracking service configured

**Logs:**
- Console output only
  - Backend: Print statements in scripts (e.g., rss_parser.py, scrape_birds.py, init_db.py)
  - Frontend: Browser console for JavaScript errors
  - Deployment: Service provider logs (Render/Railway/Fly provide access to stdout/stderr)

## CI/CD & Deployment

**Hosting:**
- Multiple options supported (see DEPLOYMENT.md):
  - Render.com (Recommended - free)
  - Railway.app (Free with 500h limits)
  - Fly.io (Free with 3GB)
  - Vercel (Frontend only)

**CI Pipeline:**
- GitHub Actions (documented for future use in DEPLOYMENT.md lines 189-205)
- Example workflow provided for automatic RSS feed sync on schedule

**Backend Deployment:**
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Frontend Deployment:**
- Static site hosting (no build step required - plain HTML/CSS/JS)
- Render or Vercel recommended

## Environment Configuration

**Required env vars:**
- Currently: None required for basic local operation
- For production deployment:
  - `PORT` - Set automatically by hosting provider (Render, Railway, etc.)

**Optional env vars:**
- Not currently implemented, but recommended for production:
  - Database path (currently hardcoded)
  - API URL (currently hardcoded in frontend HTML)
  - CORS allowed origins (currently "*")

**Secrets location:**
- No secrets currently used
- DEPLOYMENT.md recommends setting CORS origins to specific URLs in production (lines 252-266)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected - Application only makes outbound HTTP requests to read data from RSS feeds and scrape NABU website

## Data Flow

**Episode Import:**
1. Backend scheduled task or manual trigger: `python rss_parser.py`
2. Fetch RSS from: `https://cdn.julephosting.de/podcasts/1188-nettgefluster-der-podcast-eines-ehepaars/feed.rss`
3. Parse feed with feedparser library
4. Extract episode number, title, date, audio URL, duration
5. Store in SQLite `episodes` table (skip if already exists)

**Bird Data Load:**
1. Backend setup: `python scrape_birds.py`
2. Scrape NABU website: `https://www.nabu.de/tiere-und-pflanzen/voegel/portraets/index.html`
3. Parse HTML with BeautifulSoup
4. Currently loads 10 example birds (production would need full scraping implementation)
5. Store in SQLite `birds` table

**Frontend to Backend:**
1. Frontend loaded from `index.html` (served locally or via static host)
2. Fetch requests to `http://localhost:8000/api/` (or production URL)
3. Endpoints:
   - `GET /api/birds` - All birds
   - `GET /api/birds/random` - Random unused bird
   - `GET /api/birds/stats` - Bird usage statistics
   - `POST /api/birds/{id}/mark-used` - Mark bird as used
   - `POST /api/birds/reset` - Reset all bird usage
   - `GET /api/topics` - Topics with optional status filter
   - `POST /api/topics` - Create new topic
   - `PUT /api/topics/{id}` - Update topic
   - `DELETE /api/topics/{id}` - Delete topic
   - `GET /api/episodes` - All episodes
   - `GET /api/episodes/{id}` - Single episode
   - `GET /api/episodes/stats/speaking-time` - Speaking time statistics

## Future Integrations (Not Yet Implemented)

**Speech-to-Text (Planned):**
- OpenAI Whisper 20231117 - Already in requirements.txt for future episode transcription
- Documentation mentions transcribe.py script (not yet created) in README.md line 99

**Potential Future Integrations:**
- PostgreSQL (for when SQLite persistence is needed on serverless platforms)
- S3/Cloud Storage (for database backups in production)

---

*Integration audit: 2026-02-10*
