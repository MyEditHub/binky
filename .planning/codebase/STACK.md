# Technology Stack

**Analysis Date:** 2026-02-10

## Languages

**Primary:**
- Python 3.9+ - Backend API server and data processing scripts
- HTML - Frontend user interface
- CSS - Frontend styling and animations
- JavaScript (Vanilla + React 18) - Frontend interactivity

**Secondary:**
- Bash - Setup and deployment automation scripts

## Runtime

**Environment:**
- Python 3.9+ (as specified in README requirements)
- Node.js (not used - frontend runs in browser)
- Browser runtime for frontend (React 18 via CDN)

**Package Manager:**
- pip - Python package management
- Lockfile: `requirements.txt` present in `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/`

## Frameworks

**Core:**
- FastAPI 0.109.0 - REST API framework for backend (`/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py`)
- Uvicorn 0.27.0 (with standard extras) - ASGI server for FastAPI
- React 18.0.0 (via CDN from unpkg.com) - Frontend UI framework running in browser

**Testing:**
- Not detected - No test framework configured

**Build/Dev:**
- Babel (standalone) - JavaScript transpilation in browser for React JSX

## Key Dependencies

**Critical:**
- fastapi==0.109.0 - Web framework for building REST API endpoints
- uvicorn[standard]==0.27.0 - ASGI web server to run FastAPI application
- pydantic==2.5.3 - Data validation and serialization with BaseModel for API schemas
- sqlite3 - Built-in Python library for database (file: `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/init_db.py` at line 6)

**Data Processing:**
- feedparser==6.0.11 - Parse RSS/Atom feeds from podcast provider (used in `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/rss_parser.py` line 6)
- beautifulsoup4==4.12.3 - HTML parsing and web scraping (used in `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/scrape_birds.py` line 7)
- requests==2.31.0 - HTTP client library for making web requests (used in `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/scrape_birds.py` line 6)

**Audio/Media:**
- openai-whisper==20231117 - Speech-to-text transcription (prepared for future use, documented in README.md but script not yet created)

**Utilities:**
- python-multipart==0.0.6 - Multipart form data parsing for FastAPI file uploads

## Configuration

**Environment:**
- Configured via hardcoded values and command-line arguments
- API_URL set in `/Users/tmtlxantonio/Desktop/nettgefluester-app/frontend/index.html` (line with `const API_URL = 'http://localhost:8000/api'`)
- Database path: `../data/nettgefluester.db` (relative to backend directory)
- RSS feed URL: Hardcoded in `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/rss_parser.py` line 16 as `https://cdn.julephosting.de/podcasts/1188-nettgefluster-der-podcast-eines-ehepaars/feed.rss`
- NABU scraping URL: Hardcoded in `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/scrape_birds.py` line 18 as `https://www.nabu.de`

**Build:**
- setup.sh - Automated Python environment setup (`/Users/tmtlxantonio/Desktop/nettgefluester-app/setup.sh`)
- start.sh - Server startup script (`/Users/tmtlxantonio/Desktop/nettgefluester-app/start.sh`)

## Platform Requirements

**Development:**
- Python 3.9 or higher
- Pip package manager
- Bash shell (for setup/start scripts)
- Terminal access
- macOS recommended (setup scripts target macOS with `open` command in README.md line 69)

**Production:**
- Docker-ready (deployment documented for Render.com, Railway.app, Fly.io)
- Supports deployment on: Render.com, Railway.app, Fly.io, Vercel (frontend)
- CORS enabled for cross-origin requests in production

## API Server Details

**Host Configuration:**
- Default: `0.0.0.0` (all interfaces)
- Default Port: `8000`
- ASGI Server: Uvicorn

**CORS Middleware:**
- Currently allows all origins (`allow_origins=["*"]`) in development
- Comment in `/Users/tmtlxantonio/Desktop/nettgefluester-app/backend/main.py` line 20 indicates CORS should be more restrictive in production

**API Documentation:**
- Automatic OpenAPI/Swagger UI available at `/docs` endpoint (FastAPI default)

---

*Stack analysis: 2026-02-10*
