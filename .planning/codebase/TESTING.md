# Testing Patterns

**Analysis Date:** 2026-02-10

## Test Framework

**Runner:**
- Not detected - No test framework configured
- No pytest, unittest, vitest, or jest configuration found

**Assertion Library:**
- Not applicable - No testing infrastructure present

**Run Commands:**
- No test command configured
- Application runs directly: `python backend/main.py` for backend (uvicorn), manual testing via browser for frontend

## Test File Organization

**Location:**
- Not detected - No test files present in codebase
- No `tests/` directory, no `__tests__/` directory
- No files matching `test_*.py`, `*_test.py`, `*.test.js`, `*.spec.js` patterns

**Naming:**
- Not applicable - No testing framework configured

**Structure:**
- Not applicable - No test infrastructure

## Test Structure

**Suite Organization:**
- Not applicable - No test framework present

**Patterns:**
- Not applicable - No test framework present

## Mocking

**Framework:**
- Not detected - No mocking library configured (unittest.mock, jest.mock, vitest, etc.)

**Patterns:**
- Not applicable - No tests to mock

**What to Mock:**
- When implementing tests, mock external services:
  - SQLite database connections (use in-memory database for tests)
  - HTTP requests to RSS feeds and web scraping targets
  - FastAPI app dependencies

**What NOT to Mock:**
- When implementing tests, do NOT mock:
  - Core business logic (bird/topic/episode management)
  - Pydantic model validation
  - FastAPI route handlers themselves (test them directly)

## Fixtures and Factories

**Test Data:**
- Not detected - No fixtures or factories present

**Location:**
- Recommended location when implementing: `backend/tests/fixtures.py` or `backend/conftest.py`

## Coverage

**Requirements:**
- Not detected - No coverage requirements or configuration

**View Coverage:**
- No coverage tool configured

## Test Types

**Unit Tests:**
- Not detected
- When implementing: Test individual functions like `get_db()`, `init_database()`, endpoint handlers
- Scope: Single function, mocked dependencies (DB, HTTP)

**Integration Tests:**
- Not detected
- When implementing: Test database operations with actual SQLite in-memory DB
- Scope: Multiple functions working together, simplified database state

**E2E Tests:**
- Not detected
- Frontend would benefit from E2E testing (currently manual browser testing only)
- Recommended: Playwright or Cypress for end-to-end flows (bird selection, topic management, stats viewing)

## Common Patterns

**Async Testing:**
- Backend uses async functions extensively (`async def` endpoints in `main.py`)
- Frontend uses React hooks with async/await
- When implementing tests: Use pytest-asyncio for async function testing
- Example functions to test:
  - `async def get_all_birds()` in `main.py` lines 69-77
  - `async def get_random_bird()` in `main.py` lines 79-91
  - `async def mark_bird_used()` in `main.py` lines 110-121
  - React `useEffect` hooks and async fetches in `frontend/index.html` lines 765-773

**Error Testing:**
- HTTPException raising pattern should be tested
- Example: `raise HTTPException(status_code=404, detail="...")` in `main.py` lines 89, 243
- Should test:
  - 404 responses when resource not found
  - Message propagation to client
- SQL error conditions (duplicate records, constraint violations)

## Testing Gaps

**Critical areas without tests:**
1. **Database Layer:** No tests for SQL queries, migrations, or schema integrity
   - Files: `backend/init_db.py`, `backend/main.py` (all db functions)
   - Risk: Database corruption, data loss, silent failures
   - Priority: High

2. **Data Parsing:** No tests for RSS feed parsing or web scraping
   - Files: `backend/rss_parser.py` (lines 36-107), `backend/scrape_birds.py` (lines 64-125)
   - Risk: Malformed data, parsing failures silently continue
   - Priority: High

3. **API Endpoints:** No tests for route handlers, error cases, or edge conditions
   - Files: `backend/main.py` (all @app routes)
   - Risk: Broken APIs, missing error handling, invalid responses
   - Priority: High

4. **Frontend Components:** No tests for UI, state management, or API integration
   - Files: `frontend/index.html` (React component)
   - Risk: Broken UI flows, state inconsistency, API failure handling
   - Priority: Medium

5. **Error Handling:** No tests for exception paths
   - Example: `scrape_birds.py` line 81-82 has `except: pass` that silently fails
   - Risk: Silent failures during data processing
   - Priority: Medium

## Implementation Recommendations

**Framework choices (when implementing):**
- Backend: pytest + pytest-asyncio for async/FastAPI testing
- Backend: pytest-cov for coverage reporting
- Frontend: Vitest or Jest with React Testing Library
- E2E: Playwright or Cypress

**Suggested first test file:** `backend/tests/test_main.py`
- Test all endpoint handlers with mocked database
- Test error responses (404, validation errors)
- Test async behavior with fixture data

**Database testing strategy:**
- Use SQLite `:memory:` database for unit tests
- Create fixtures that set up test data for each test
- Teardown to ensure no side effects between tests

---

*Testing analysis: 2026-02-10*
