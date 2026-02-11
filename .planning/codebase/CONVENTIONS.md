# Coding Conventions

**Analysis Date:** 2026-02-10

## Naming Patterns

**Files:**
- Python files: `lowercase_with_underscores.py` (e.g., `main.py`, `init_db.py`, `rss_parser.py`, `scrape_birds.py`)
- HTML files: `index.html`
- Database schema files follow similar pattern

**Functions:**
- Python functions: `snake_case` (e.g., `get_db()`, `get_all_birds()`, `get_random_bird()`, `mark_bird_used()`, `init_database()`, `parse_rss_feed()`, `scrape_nabu_birds()`)
- React components: `PascalCase` or arrow functions (e.g., `function App()`, `const App = () => {...}`)
- JavaScript/React handlers: `camelCase` (e.g., `getRandomBird()`, `loadBirdStats()`, `handleMarkUsed()`)

**Variables:**
- Python: `snake_case` for all variables (e.g., `conn`, `cursor`, `bird_links`, `episode_number`, `publish_date_str`, `target_years`)
- React/JavaScript: `camelCase` (e.g., `activeTab`, `birdStats`, `currentBird`, `setLoading`, `newTopic`)
- Constants in Python: `UPPERCASE_WITH_UNDERSCORES` for configuration constants (e.g., `API_URL`, `CORS` settings)

**Types/Models:**
- Pydantic models: `PascalCase` (e.g., `Bird`, `Topic`, `Episode`)
- Database tables: `lowercase` plural (e.g., `birds`, `topics`, `episodes`, `episode_topics`)
- Database columns: `snake_case` (e.g., `scientific_name`, `image_url`, `used_date`, `episode_number`, `transcription_text`)

## Code Style

**Formatting:**
- Python: Uses standard Python formatting with 4-space indentation (implicit convention, no linter configured)
- JavaScript/React: Inline Babel (no build process)
- HTML/CSS: Inline styles within HTML file
- No explicit formatter (prettier/black) configured

**Linting:**
- No linter configured (no .eslintrc, .pylintrc, or similar)
- Imports follow standard Python conventions: stdlib first, then third-party

## Import Organization

**Order:**
1. Standard library imports (e.g., `sqlite3`, `os`, `json`, `datetime`, `re`, `random`)
2. Third-party framework imports (e.g., `from fastapi import FastAPI`)
3. Third-party data handling (e.g., `from pydantic import BaseModel`, `import feedparser`, `from bs4 import BeautifulSoup`)
4. Utility imports (e.g., `import requests`)

**Path Aliases:**
- Not used in this codebase
- Relative imports used for database connections: `'../data/nettgefluester.db'`

## Error Handling

**Patterns:**
- FastAPI: Use `HTTPException` with status codes and detail messages
  - `raise HTTPException(status_code=404, detail="Alle Vögel wurden bereits benutzt!")`
  - `raise HTTPException(status_code=404, detail="Episode nicht gefunden")`
- Data parsing: Try-except blocks with pass or continue to skip invalid entries
  - `try: ... except: pass` for non-critical failures (e.g., duration parsing in `rss_parser.py`)
  - `try-except-continue` for loop iterations
- HTTP requests: Use `response.raise_for_status()` to check status
- SQL operations: No explicit error handling shown; assumes database exists
- User input: Check for existence of data before processing (`if not feed.entries:`, `if not unused_birds:`)

**Location examples:**
- `main.py` lines 88-89: HTTPException for missing birds
- `main.py` lines 242-243: HTTPException for missing episodes
- `rss_parser.py` lines 81-82, 105-107: Exception handling for parsing
- `scrape_birds.py` lines 143-144: Exception handling for scraping

## Logging

**Framework:** `print()` statements (no logging library configured)

**Patterns:**
- Use emoji + status messages for user feedback (e.g., `print("✅ Datenbank erfolgreich initialisiert!")`, `print("❌ Fehler beim Laden des Feeds: {e}")`)
- Info level: `print(f"📡 Lade Nettgeflüster RSS Feed...")`, `print(f"📋 {len(feed.entries)} Episoden im Feed gefunden")`
- Warning level: `print(f"⚠️  {existing_count} Vögel bereits in Datenbank")`
- Error level: `print(f"❌ Fehler beim Scraping: {e}")`
- Progress: `print(f"  ✅ Episode #{episode_number}: {title[:50]}...")`
- Console errors in React: `console.error('Fehler beim Laden der Statistiken:', err)`

## Comments

**When to Comment:**
- Module docstrings at file top (used in all backend files: `"""Module description"""`):
  - `main.py`: "Nettgeflüster Backend API"
  - `init_db.py`: "Datenbank-Initialisierung für Nettgeflüster"
  - `rss_parser.py`: "RSS Feed Parser für Nettgeflüster Podcast"
  - `scrape_birds.py`: "NABU Vogel-Scraper"
- Inline comments for complex logic or non-obvious code sections
- Database structure comments in `init_db.py`: `# Vögel Tabelle`, `# Themen Tabelle`, etc.
- Example: `# Episoden-Nummer aus Titel extrahieren` in `rss_parser.py` line 38
- Example: `# CORS für Frontend` in `main.py` line 17

**JSDoc/TSDoc:**
- Not used
- Pydantic models use docstrings on async endpoint functions in FastAPI:
  - `async def get_all_birds(): """Alle Vögel abrufen"""`
  - Pattern: Triple-quoted docstrings describing endpoint purpose in German

## Function Design

**Size:**
- Backend functions typically 10-30 lines for endpoint handlers
- Database query functions are compact (3-15 lines)
- Parsing functions are medium (40-80 lines including loops and error handling)

**Parameters:**
- Optional parameters use type hints with defaults: `status: Optional[str] = None`
- Pydantic models used for request bodies: `async def create_topic(topic: Topic):`
- Path parameters extracted from route: `async def mark_bird_used(bird_id: int):`

**Return Values:**
- FastAPI endpoints return Pydantic models directly: `response_model=List[Bird]`
- Dict responses for simple results: `return {"message": "...", "id": topic_id}`
- Status responses use consistent format: `{"message": "Thema erstellt"}`

## Module Design

**Exports:**
- Python scripts have conditional main execution: `if __name__ == "__main__":`
- No explicit module exports; scripts run functions directly in main block
- FastAPI app is module-level singleton: `app = FastAPI(title="Nettgeflüster API")`

**Barrel Files:**
- Not used in this codebase
- Each module is self-contained and single-purpose

---

*Convention analysis: 2026-02-10*
