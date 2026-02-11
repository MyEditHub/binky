# Codebase Structure

**Analysis Date:** 2026-02-10

## Directory Layout

```
nettgefluester-app/
├── backend/                    # Python FastAPI server and data utilities
│   ├── main.py                 # API server with all route handlers
│   ├── init_db.py              # Database schema initialization
│   ├── rss_parser.py           # RSS feed fetcher for episodes
│   ├── scrape_birds.py         # NABU bird data ingestion
│   ├── requirements.txt        # Python package dependencies
│   └── venv/                   # Virtual environment (created during setup)
├── frontend/                   # Web user interface
│   └── index.html              # Single HTML file with embedded React, CSS, JS
├── data/                       # Data storage
│   └── nettgefluester.db       # SQLite database (created by init_db.py)
├── .planning/                  # Planning and analysis documents
│   └── codebase/               # Codebase analysis output
├── .git/                       # Git repository metadata
├── README.md                   # Project overview and setup instructions
├── DEPLOYMENT.md               # Deployment guide
├── SCHNELLSTART.md             # German quick start guide
├── BENUTZERHANDBUCH.md         # German user manual
├── setup.sh                    # Setup automation script
└── start.sh                    # Startup script
```

## Directory Purposes

**backend/:**
- Purpose: All Python server code and data pipeline utilities
- Contains: FastAPI application, database initialization, web scrapers, RSS parsers
- Key files: `main.py` (core API), `init_db.py` (schema), `requirements.txt` (dependencies)
- Database connection: Points to `../data/nettgefluester.db`

**frontend/:**
- Purpose: Single-page web application
- Contains: HTML markup, CSS styling, React components (all in one file)
- Key files: `index.html` (2000+ lines, includes all client-side code)
- No build process; served directly via browser or simple HTTP server

**data/:**
- Purpose: Runtime data storage
- Contains: SQLite database file created by `init_db.py`
- Committed to git: No (database is runtime artifact)
- Backed up: Manually (recommended in README)

**.planning/codebase/:**
- Purpose: Generated analysis and planning documents
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Committed: Yes (version control of analysis)

## Key File Locations

**Entry Points:**

- `backend/main.py`: FastAPI application entry point; starts uvicorn server
  - Command: `python main.py` or `uvicorn main:app`
  - Exposes: REST API on http://localhost:8000

- `backend/init_db.py`: Database setup entry point; creates schema and tables
  - Command: `python init_db.py`
  - Effect: Creates `../data/nettgefluester.db` with 4 tables

- `backend/rss_parser.py`: Episode data ingestion; fetches from external RSS
  - Command: `python rss_parser.py`
  - Effect: Populates episodes table from https://cdn.julephosting.de/podcasts/...

- `backend/scrape_birds.py`: Bird data ingestion; loads NABU bird data
  - Command: `python scrape_birds.py`
  - Effect: Populates birds table (currently uses hardcoded example birds)

- `frontend/index.html`: Web UI entry point; loaded by browser
  - Access: File open via browser or HTTP server
  - Effect: Renders React UI connected to backend API

**Configuration:**

- `backend/requirements.txt`: Python package specifications
  - Lines 1-8: Lists 8 dependencies (FastAPI, Uvicorn, Pydantic, feedparser, BeautifulSoup4, requests, Whisper, python-multipart)

- `setup.sh`: Shell script for automated setup (not reviewed but listed)
  - Purpose: Likely automates venv creation, package install, db init

- `.env` file: Not present; hardcoded configuration in source
  - API URL in frontend: Would need manual edit in index.html
  - Database path: Hardcoded as `../data/nettgefluester.db`

**Core Logic:**

- `backend/main.py` (lines 33-61): Pydantic model definitions
  - Bird model: name, scientific_name, description, image_url, used (bool), used_date
  - Topic model: title, description, priority, status, category, created_date
  - Episode model: episode_number, title, publish_date, audio_url, duration_minutes, speaking times, transcription_text, transcribed (bool)

- `backend/main.py` (lines 63-144): Bird endpoints
  - GET `/api/birds`: List all birds
  - GET `/api/birds/random`: Random unused bird
  - GET `/api/birds/stats`: Count totals/used/remaining
  - POST `/api/birds/{id}/mark-used`: Set used flag and date
  - POST `/api/birds/{id}/unmark`: Revert used flag
  - POST `/api/birds/reset`: Clear all used flags

- `backend/main.py` (lines 146-219): Topic endpoints
  - GET `/api/topics`: List with optional status filter
  - POST `/api/topics`: Create new topic
  - PUT `/api/topics/{id}`: Update topic
  - DELETE `/api/topics/{id}`: Delete topic
  - GET `/api/topics/stats`: Count by status

- `backend/main.py` (lines 221-264): Episode endpoints
  - GET `/api/episodes`: List all episodes
  - GET `/api/episodes/{id}`: Get single episode
  - GET `/api/episodes/stats/speaking-time`: Analytics on speaking time

- `backend/init_db.py` (lines 19-71): Database schema
  - birds table: id, name, scientific_name, description, image_url, used (0/1), used_date
  - topics table: id, title, description, priority, status, category, created_date
  - episodes table: id, episode_number, title, publish_date, audio_url, duration_minutes, speaking times, transcription_text, transcribed (0/1)
  - episode_topics junction table: id, episode_id, topic_id, planned, discussed

- `backend/rss_parser.py` (lines 11-118): RSS feed parsing
  - Fetches from Julephosting RSS feed
  - Extracts episode number, title, date, audio URL, duration
  - Filters to 2025-2026 only
  - Parses iTunes duration format (seconds or HH:MM:SS)

- `backend/scrape_birds.py` (lines 12-147): Bird data loading
  - Intended to scrape NABU.de, currently uses hardcoded birds
  - 10 example birds provided (lines 64-125)
  - Checks for existing data before inserting

**Testing:**

- No test files present in codebase
- Manual testing via browser or curl

**Documentation:**

- `README.md`: Setup, usage, features, API endpoints, troubleshooting
- `DEPLOYMENT.md`: Online deployment guide (Render.com)
- `SCHNELLSTART.md`: German quick start
- `BENUTZERHANDBUCH.md`: German user manual
- `/docs` endpoint: Auto-generated Swagger UI from FastAPI

## Naming Conventions

**Files:**

- Snake_case for Python files: `main.py`, `init_db.py`, `rss_parser.py`, `scrape_birds.py`
- Lowercase with underscores for utilities; main entry points unprefixed
- No test file naming convention (no tests exist)

**Directories:**

- Lowercase plurals for functional areas: `backend/`, `frontend/`, `data/`
- Hidden directories with dot prefix: `.git/`, `.planning/`, `.claude/`

**Python Functions:**

- Snake_case throughout: `get_db()`, `init_database()`, `parse_rss_feed()`, `scrape_nabu_birds()`
- Descriptive names indicating action: `get_*`, `parse_*`, `scrape_*`
- No async function prefixes; async functions marked with `async def` keyword

**Python Classes:**

- PascalCase for Pydantic models: `Bird`, `Topic`, `Episode`
- FastAPI app singleton: `app = FastAPI(...)`

**Database Tables:**

- Lowercase plurals: `birds`, `topics`, `episodes`, `episode_topics`
- Foreign keys: `episode_id`, `topic_id` (table_name + `_id`)

**API Endpoints:**

- Lowercase path segments: `/api/birds`, `/api/topics`, `/api/episodes`
- Resource-based naming: plural nouns for collections
- Action-based sub-paths: `/api/birds/random`, `/api/birds/stats`, `/api/topics/stats`
- Resource IDs in path: `/api/birds/{bird_id}`, `/api/topics/{topic_id}`
- HTTP methods follow REST semantics: GET (read), POST (create), PUT (update), DELETE (delete)

**Frontend Elements:**

- CSS custom properties with double-dash: `--primary`, `--shadow`, `--gradient`
- CSS classes appear to use kebab-case (typical for HTML)
- React component state via `useState` hook

## Where to Add New Code

**New Feature (e.g., new resource type):**
- Add Pydantic model in `backend/main.py` (lines 30-61 area)
- Add table schema in `backend/init_db.py` (after line 58)
- Add route handlers in `backend/main.py` (after line 264, in new endpoint section)
- Add frontend form/display in `backend/frontend/index.html` (new section in React component)
- If external data needed, create new `backend/your_ingestion.py` script

**New Endpoint:**
- Add function in `backend/main.py` after existing endpoints (line 264 or in appropriate section)
- Use `@app.get()`, `@app.post()`, `@app.put()`, `@app.delete()` decorators
- Follow response_model pattern: `response_model=List[YourModel]` or single model
- Add docstring for auto-documentation

**Database Migration:**
- Create new migration script: `backend/migrate_v2.py`
- Add schema changes in migration script
- Document in README.md setup section
- Call after `python init_db.py`

**Utility Function:**
- If reusable across multiple endpoints: Add to `backend/main.py` before routes
- If specific to data ingestion: Create new `backend/your_utility.py` file
- If frontend-specific: Add JavaScript function in `frontend/index.html` script section

**Error Handling Addition:**
- Backend: Add try-except in relevant route or utility function
- Log via print() with emoji prefix (✅, ❌, ⚠️)
- Return HTTPException for API errors with appropriate status_code and detail

**Testing:**
- No test framework integrated; would need to add pytest or unittest setup
- Tests could be placed in `backend/tests/` directory
- Update `backend/requirements.txt` to include test dependencies

## Special Directories

**data/:**
- Purpose: Runtime database storage
- Generated: Yes (by `init_db.py`)
- Committed: No (should be in .gitignore, database file is runtime artifact)
- Shared: Between all backend processes
- Backup: Manual (copy `nettgefluester.db` regularly as noted in README)

**venv/ (inside backend/):**
- Purpose: Python virtual environment with isolated package installation
- Generated: Yes (by `python3 -m venv venv`)
- Committed: No (should be in .gitignore)
- Activation: `source backend/venv/bin/activate` on macOS/Linux

**.planning/codebase/:**
- Purpose: Generated analysis documents for code planning
- Generated: Yes (by GSD mapping commands)
- Committed: Yes (version control of planning decisions)
- Documents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

**.claude/:**
- Purpose: Claude IDE metadata
- Generated: Yes (by Claude IDE)
- Committed: Likely (if checked in)

---

*Structure analysis: 2026-02-10*
