# Codebase Concerns

**Analysis Date:** 2026-02-10

## Tech Debt

**CORS Configuration Overly Permissive:**
- Issue: `allow_origins=["*"]` allows any origin to access the API
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py` (line 20)
- Impact: In production, this exposes the API to cross-origin requests from any domain, violating security best practices
- Fix approach: Replace wildcard with explicit list of allowed origins: `["http://localhost:8000", "https://frontend-domain.com"]`

**Incomplete Bird Scraping Implementation:**
- Issue: Scraper only loads 10 hardcoded example birds instead of the full 314 NABU bird species
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/scrape_birds.py` (lines 62-125)
- Impact: The app advertises a full bird database but provides minimal data; users will exhaust the bird list quickly
- Fix approach: Implement complete web scraping of NABU portraits or use structured NABU API if available

**Bare Exception Handling:**
- Issue: `except:` clause catches all exceptions indiscriminately (without specifying exception type)
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/rss_parser.py` (line 81)
- Impact: Makes debugging difficult and silently suppresses errors including keyboard interrupts and system errors
- Fix approach: Catch specific exceptions: `except (ValueError, AttributeError):`

**API Endpoints Lack Input Validation:**
- Issue: Bird ID, topic ID, and other parameters are not validated before database queries
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py` (lines 110-204)
- Impact: Malformed requests or negative IDs could cause unexpected database behavior or errors
- Fix approach: Add Pydantic validators to ensure IDs are positive integers and exist before operations

**Hardcoded Database Path:**
- Issue: Database path uses relative path `../data/nettgefluester.db` scattered across multiple files
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/scrape_birds.py` (line 12), `rss_parser.py` (line 11), `init_db.py` (line 9)
- Impact: Path breaks if working directory differs; difficult to configure for deployment
- Fix approach: Use environment variable `DATABASE_URL` or configuration file with absolute paths

**No Database Connection Pooling:**
- Issue: Each request creates a new SQLite connection via `get_db()`
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py` (lines 27-30)
- Impact: High overhead for concurrent requests; inefficient resource usage at scale
- Fix approach: Implement connection pool or use SQLAlchemy with connection management

**Frontend API URL Hardcoded:**
- Issue: API URL is hardcoded as `http://localhost:8000/api` in frontend
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` (line 732)
- Impact: Frontend must be manually edited for each deployment environment (local/staging/production)
- Fix approach: Use environment variable or build-time configuration to set API_URL

## Known Bugs

**Image Load Fallback Placeholder:**
- Symptoms: Bird images fail to load when NABU URLs are broken or slow; placeholder displays instead
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` (line 931)
- Trigger: Network timeout, CORS issue, or NABU image URL changes
- Workaround: The app gracefully falls back to placeholder but users see low-value experience

**Stats Page Shows Placeholder Text:**
- Symptoms: Statistics tab shows "Statistiken werden verfügbar sein..." instead of actual data
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` (lines 1033-1038)
- Trigger: Transcription feature not implemented
- Workaround: Feature is documented as future work; users understand it's incomplete

**RSS Parser Silently Skips Malformed Episodes:**
- Symptoms: Some episodes may be silently skipped without user notification if they lack expected fields
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/rss_parser.py` (lines 42-43, 90-92)
- Trigger: Episodes without episode number pattern `#NNN` in title are ignored
- Workaround: Manual review of RSS feed after parsing

## Security Considerations

**Open CORS Configuration:**
- Risk: Any website can make requests to this API on behalf of users
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py` (lines 17-24)
- Current mitigation: None; app relies on URL obscurity
- Recommendations:
  1. Restrict `allow_origins` to specific frontend domain
  2. Add rate limiting to prevent abuse
  3. Consider CSRF protection if user authentication added later

**No Authentication/Authorization:**
- Risk: Any user with the URL can modify birds, topics, and data
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py` (all endpoints)
- Current mitigation: App is intended for single-user/small group (Philipp & Nadine)
- Recommendations:
  1. Document that this app is for trusted users only
  2. Add optional API key authentication if deployed publicly
  3. If multi-user needed, implement proper user authentication

**SQLite in Production (Deployment):**
- Risk: SQLite is not suitable for concurrent write access in production; data corruption possible under load
- Files: Database configuration throughout backend
- Current mitigation: Low volume (podcast production) reduces risk
- Recommendations:
  1. Monitor database operations; migrate to PostgreSQL if scaling needed
  2. Implement regular backups: `cp data/nettgefluester.db data/nettgefluester.db.backup`
  3. Use mounted volumes on hosting (Railway, Fly.io) for persistence

**No Sanitization of Topic Input:**
- Risk: User-provided topic descriptions and titles could contain XSS payloads or malicious content
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` (lines 959-982)
- Current mitigation: React escapes by default; direct database storage limits exposure
- Recommendations:
  1. Add backend validation to reject HTML/script content
  2. Implement content length limits
  3. Add logging of suspicious inputs

## Performance Bottlenecks

**No Pagination on Bird/Topic Lists:**
- Problem: All birds/topics loaded into memory at once; will become slow with large datasets
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py` (lines 69-77, 148-161)
- Cause: `SELECT * FROM birds` and `SELECT * FROM topics` fetch all rows
- Improvement path:
  1. Add `limit` and `offset` parameters to endpoints
  2. Return paginated results (e.g., 50 items per page)
  3. Update frontend to handle pagination

**No Database Indexes:**
- Problem: Queries without indexes are inefficient; will slow down as data grows
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/init_db.py` (lines 19-71)
- Cause: Table definitions lack indexes on frequently queried columns
- Improvement path:
  1. Add index on `birds.used` (used for filtering unused birds)
  2. Add index on `topics.status` (used for status filtering)
  3. Add index on `episodes.episode_number` (used for lookups)
  4. Execute: `CREATE INDEX IF NOT EXISTS idx_birds_used ON birds(used);`

**Large Single HTML File:**
- Problem: Frontend is a 1,048-line single HTML file with embedded React; no code splitting or optimization
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` (entire file)
- Cause: Browser must parse and execute entire file on page load
- Improvement path:
  1. Split into separate JS/CSS files
  2. Minify and compress assets
  3. Use a build tool (Webpack, Vite) for optimization
  4. Currently acceptable for small app, but impacts perceived performance

## Fragile Areas

**Bird Database Reset Endpoint (No Confirmation):**
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py` (lines 136-144)
- Why fragile: Endpoint exists but frontend only has client-side confirmation; accidental API calls via tools like curl would reset data without warning
- Safe modification: Add server-side confirmation token or require POST with specific header; implement soft delete/archive pattern instead
- Test coverage: No automated tests for this endpoint

**RSS Parser Date Parsing (Locale Dependent):**
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/rss_parser.py` (lines 48-56)
- Why fragile: Uses `datetime(*published[:6])` which assumes standard tuple unpacking; if RSS structure changes, silently fails
- Safe modification: Add explicit feed parsing library instead of raw tuple unpacking; validate parsed dates
- Test coverage: No tests for different RSS feed formats

**Frontend State Management (No Persistence):**
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` (lines 734-748)
- Why fragile: All React state is in-memory; page refresh loses current bird selection and form data
- Safe modification: Add localStorage for form state and current bird; or implement server-side session
- Test coverage: No automated frontend tests

**Episode-Topic Relationship Unused:**
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/init_db.py` (lines 61-71)
- Why fragile: `episode_topics` junction table exists but is never populated or queried; dead code
- Safe modification: Either remove unused table or implement endpoints to link topics to episodes
- Test coverage: No tests validate this relationship

## Scaling Limits

**Bird List Exhaustion:**
- Current capacity: 10 birds (hardcoded examples)
- Limit: Users run out of birds after 10 episodes (if no reset)
- Scaling path: Implement full NABU scraper to load 314+ birds (see Tech Debt section)

**Single-File Database (SQLite):**
- Current capacity: Suitable for < 1000 topics/episodes
- Limit: SQLite struggles with concurrent writes; poor for multi-user deployments
- Scaling path: Migrate to PostgreSQL when: (1) multiple producers edit data, (2) response time degrades, (3) simultaneous users > 5

**Hardcoded RSS Feed URL:**
- Current capacity: Parses one RSS feed (Nettgeflüster podcast)
- Limit: Cannot aggregate or manage multiple podcasts
- Scaling path: If feature needed, refactor to accept configurable feed URL via admin panel

**Frontend React in Single File:**
- Current capacity: ~1000 lines of React/JSX in one HTML file
- Limit: Becomes unmaintainable and slow to load as features added
- Scaling path: Migrate to modern build setup (Create React App, Vite) if UI complexity grows

## Dependencies at Risk

**Hardcoded Package Versions (No Updates):**
- Risk: Security patches not applied; known vulnerabilities may exist
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/requirements.txt`
- Impacted packages:
  - `fastapi==0.109.0` (Feb 2024 version; may have unpatched CVEs)
  - `requests==2.31.0` (known issues with proxies/timeouts)
  - `openai-whisper==20231117` (large dependency, slow downloads)
- Migration plan:
  1. Update to latest patch versions quarterly
  2. Use `pip-audit` to check for CVEs: `pip install pip-audit && pip-audit`
  3. Set up Dependabot on GitHub to auto-generate update PRs

**openai-whisper Not Used:**
- Risk: Dependency listed but transcription feature not implemented
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/requirements.txt` (line 7)
- Impact: Adds 100MB+ to deployment; slows startup time
- Migration plan: Remove until transcription feature is actually implemented

**BeautifulSoup Used Inefficiently:**
- Risk: Full HTML parsing for simple link extraction; overkill for current use case
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/scrape_birds.py` (lines 22-38)
- Impact: Adds parsing dependency without full benefit
- Migration plan: Consider simpler approach or actual full scraper if birds expanded

## Missing Critical Features

**No Transcription (Partially Abandoned):**
- Problem: README promises transcription, but feature doesn't exist
- Blocks: Speaking time statistics, voice analysis
- Implementation gap: `transcribe.py` referenced in README but not in codebase

**No Backup/Export Feature:**
- Problem: Database can be lost; no download/export capability
- Blocks: Data recovery, offline access, format migration
- Recommendation: Add `/api/export/topics` and `/api/export/birds` endpoints

**No Search Functionality:**
- Problem: Topics and birds cannot be searched; navigation poor for large lists
- Blocks: Finding specific topics or birds in growing database
- Recommendation: Add full-text search endpoints

## Test Coverage Gaps

**No Automated Tests:**
- What's not tested: All backend endpoints, database operations, edge cases
- Files: No test files found in repository
- Risk: Regressions undetected; bird reset endpoint could corrupt data silently
- Priority: High

**No Frontend Integration Tests:**
- What's not tested: Form submissions, API error handling, loading states
- Files: Single HTML file; no test infrastructure
- Risk: UI bugs discovered only in manual testing
- Priority: High

**No API Contract Tests:**
- What's not tested: Response schemas, status codes, error messages
- Files: API endpoints in `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py`
- Risk: Frontend expects certain response structure; changes break silently
- Priority: Medium

**No Database Migration Tests:**
- What's not tested: Schema changes, data integrity, SQLite upgrades
- Files: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/init_db.py`
- Risk: Future schema changes may fail on existing databases
- Priority: Medium

---

*Concerns audit: 2026-02-10*
