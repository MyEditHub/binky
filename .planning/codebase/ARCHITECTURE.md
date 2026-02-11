# Architecture

**Analysis Date:** 2026-02-10

## Pattern Overview

**Overall:** Layered monolithic architecture with separation of concerns between data access, business logic, and HTTP API.

**Key Characteristics:**
- REST API backend with FastAPI framework
- SQLite database with direct SQL queries
- Standalone utilities for data ingestion (scraping, RSS parsing)
- Single-page frontend with React via CDN

## Layers

**API Layer:**
- Purpose: HTTP endpoints for frontend consumption and external clients
- Location: `backend/main.py` (lines 65-265)
- Contains: FastAPI route handlers for Birds, Topics, and Episodes resources
- Depends on: Pydantic models for request/response validation, SQLite database
- Used by: Frontend application via fetch/AJAX calls

**Data Models:**
- Purpose: Define request/response schemas and validation
- Location: `backend/main.py` (lines 33-61)
- Contains: Pydantic BaseModel classes for Bird, Topic, and Episode
- Depends on: Pydantic library
- Used by: API layer for request validation and response serialization

**Database Access:**
- Purpose: Direct SQLite interaction for CRUD operations
- Location: `backend/main.py` (lines 27-30), all route handlers
- Contains: SQLite connection management and raw SQL execution
- Depends on: sqlite3 standard library
- Used by: All API routes for persistence

**Database Schema:**
- Purpose: Define data structure and relationships
- Location: `backend/init_db.py` (lines 19-71)
- Contains: Four tables (birds, topics, episodes, episode_topics) with schema creation
- Depends on: SQLite
- Used by: Database access layer

**Data Ingestion:**
- Purpose: Populate database from external sources
- Location: `backend/scrape_birds.py`, `backend/rss_parser.py`
- Contains: Web scraping and RSS feed parsing utilities
- Depends on: requests, BeautifulSoup, feedparser libraries
- Used by: Manual execution during setup and maintenance

**Frontend:**
- Purpose: User interface and client-side logic
- Location: `frontend/index.html`
- Contains: HTML, inline CSS, and React components via Babel transpilation
- Depends on: React 18, React DOM, Babel standalone
- Used by: End users via web browser

## Data Flow

**Bird Selection Flow (User perspective):**

1. User clicks "Get Random Bird" in frontend
2. Frontend calls `GET /api/birds/random` via fetch
3. FastAPI route in `main.py` executes query: `SELECT * FROM birds WHERE used = 0`
4. Random bird selected from results and returned as JSON
5. Frontend displays bird data (name, scientific name, description, image)
6. User clicks "Mark as Used"
7. Frontend calls `POST /api/birds/{bird_id}/mark-used`
8. Route updates database: `UPDATE birds SET used = 1, used_date = ?`
9. UI reflects change and stats update

**Topic Management Flow:**

1. User creates topic via form in frontend
2. Frontend POSTs to `POST /api/topics` with Topic data
3. Route validates with Pydantic and inserts: `INSERT INTO topics (...)`
4. Topic ID returned to frontend
5. Listing refreshes from `GET /api/topics` with optional status filter
6. Topics can be updated via `PUT /api/topics/{topic_id}` or deleted via `DELETE`

**Episode Feed Ingestion Flow (Admin operation):**

1. Admin runs `python rss_parser.py` from backend directory
2. Script fetches RSS from: https://cdn.julephosting.de/podcasts/1188-nettgefluster-der-podcast-eines-ehepaars/feed.rss
3. Parses entries and extracts: episode number, title, publish date, audio URL, duration
4. Filters to only 2025-2026 episodes (lines 32-54 in rss_parser.py)
5. Inserts into episodes table with `INSERT INTO episodes (...)`
6. Duplicates skipped via `SELECT id FROM episodes WHERE episode_number = ?` check

**State Management:**

- **Frontend state:** React component state (useState) for form inputs and UI toggles
- **Persistent state:** SQLite database with no caching layer
- **Session state:** None (stateless API)
- **In-memory state during data ingestion:** Temporary lists for validation and deduplication

## Key Abstractions

**Pydantic Models:**
- Purpose: Validate and serialize data between JSON and Python objects
- Examples: `Bird` (lines 33-40), `Topic` (lines 42-49), `Episode` (lines 51-61) in `backend/main.py`
- Pattern: Class inheritance from BaseModel with type-annotated fields and optional defaults

**Database Connection Pattern:**
- Purpose: Centralize database access with proper resource cleanup
- Example: `get_db()` function (lines 27-30) in `backend/main.py`
- Pattern: Factory function returning connection object; caller responsible for close()
- Issue: No context manager or connection pooling; each request opens new connection

**REST Resource Endpoints:**
- Purpose: Expose CRUD operations over HTTP
- Examples: `/api/birds`, `/api/topics`, `/api/episodes` with GET/POST/PUT/DELETE methods
- Pattern: Standard RESTful naming (resource plurals, method semantics)

## Entry Points

**Backend Server:**
- Location: `backend/main.py` (lines 266-268)
- Triggers: `python main.py` or `uvicorn main:app --reload`
- Responsibilities: Initialize FastAPI app, register CORS middleware, start uvicorn server on port 8000

**Database Initialization:**
- Location: `backend/init_db.py` (line 79-80)
- Triggers: `python init_db.py` during setup
- Responsibilities: Create SQLite database file, create tables, establish initial schema

**Data Ingestion - Birds:**
- Location: `backend/scrape_birds.py` (line 146-147)
- Triggers: `python scrape_birds.py` after init_db
- Responsibilities: Query NABU website (or use example data), validate, insert bird records

**Data Ingestion - Episodes:**
- Location: `backend/rss_parser.py` (line 117-118)
- Triggers: `python rss_parser.py` during setup and weekly maintenance
- Responsibilities: Fetch RSS feed, parse XML, extract episode metadata, insert new episodes

**Frontend:**
- Location: `frontend/index.html` (line 1)
- Triggers: Browser opens file or serves from HTTP server
- Responsibilities: Render React UI, establish fetch connection to backend API, handle user interactions

## Error Handling

**Strategy:** Mix of try-except blocks in data ingestion, HTTP exceptions in API layer, and minimal frontend error handling.

**Patterns:**

**API Errors:**
- File: `backend/main.py`
- Pattern: Raise `HTTPException(status_code, detail)` in route handlers
- Example (line 89): `raise HTTPException(status_code=404, detail="Alle Vögel wurden bereits benutzt!")`
- Caught by FastAPI and returned as JSON with appropriate HTTP status

**Data Ingestion Errors:**
- File: `backend/rss_parser.py` (lines 114-115), `backend/scrape_birds.py` (lines 143-144)
- Pattern: Outer try-except prints error message, inner try-except skips individual items
- Example: `except Exception as e: print(f"❌ Fehler beim Laden des Feeds: {e}")`
- No retries or recovery; execution stops or continues based on placement

**Silent Failures in Scraping:**
- File: `backend/scrape_birds.py` (line 81)
- Pattern: Bare except clause with pass statement
- Issue: Duration parsing failures silently set duration_minutes to None
- No logging mechanism to diagnose parsing problems

## Cross-Cutting Concerns

**Logging:**
- No structured logging framework; uses print() statements with emoji prefixes (✅, ❌, 📡, etc.)
- No log levels or centralized configuration
- Files affected: `backend/rss_parser.py`, `backend/scrape_birds.py`, `backend/init_db.py`

**Validation:**
- Pydantic models validate API request data (type checking, optional fields)
- No business logic validation (e.g., duplicate topic titles, feed URL availability)
- File: `backend/main.py` (lines 33-61)

**Authentication:**
- None implemented
- CORS allows all origins (line 20: `allow_origins=["*"]`)
- No API key, JWT, or user identity tracking
- Security gap: Any client can call any endpoint, modify any data

**Database Transactions:**
- Implicit auto-commit after cursor.execute() + conn.commit()
- No explicit transaction boundaries or rollback handling
- File: All route handlers in `backend/main.py`

**API Documentation:**
- FastAPI generates automatic OpenAPI/Swagger docs at `/docs` (not explicitly configured)
- Title set to "Nettgeflüster API" (line 15 in main.py)
- Endpoint docstrings used as descriptions (lines 71, 81, etc.)

---

*Architecture analysis: 2026-02-10*
