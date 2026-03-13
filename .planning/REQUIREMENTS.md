# Requirements: Binky v0.3.0 — Transkript-Suche & Themenverknüpfung

**Defined:** 2026-03-04
**Core Value:** Podcast hosts can find any spoken moment across all episodes and discover when topics recur across recordings.

## v0.3.0 Requirements

### Full-Text Search (SRCH)

- [x] **SRCH-01**: User can search across all episode transcripts by keyword or phrase from a dedicated search page
- [x] **SRCH-02**: Search results show episode title, speaker label (if available), and a text snippet with the match highlighted
- [x] **SRCH-03**: User can click a search result to open that episode's transcript scrolled to the matching segment
- [x] **SRCH-04**: Search handles German text correctly (umlauts: ä, ö, ü, ß)
- [ ] **SRCH-05**: Search results also include episode titles and AI-generated topic summaries

### Cross-Episode Topic Linking (LINK)

- [ ] **LINK-01**: In the topics view, each episode topic shows other episodes where the same theme appears
- [ ] **LINK-02**: User can navigate from a cross-episode topic link directly to that episode's content
- [ ] **LINK-03**: Cross-episode connections are derived automatically from transcript content (no manual tagging)

## Future Requirements

### User Interface
- **UI-04**: Audio playback controls for episodes in app
- **UI-05**: Respect system appearance — follow macOS dark/light mode via `prefers-color-scheme`
- **UI-06**: Keyboard shortcuts for common actions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud search index | Local-only — SQLite FTS5 sufficient for 55+ episodes |
| Fuzzy/semantic search | FTS5 keyword matching adequate for German transcripts |
| Manual topic tagging | Auto-detection only — hosts shouldn't need to tag |
| Search across birds/analytics | Transcript and topic content only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SRCH-01 | Phase 11 | Complete |
| SRCH-04 | Phase 11 | Complete |
| SRCH-05 | Phase 11 → Phase 14 (gap closure) | Pending |
| SRCH-02 | Phase 12 | Complete |
| SRCH-03 | Phase 12 | Complete |
| LINK-01 | Phase 13 → Phase 14 (gap closure) | Pending |
| LINK-02 | Phase 13 → Phase 14 (gap closure) | Pending |
| LINK-03 | Phase 13 → Phase 14 (gap closure) | Pending |

**Coverage:**
- v0.3.0 requirements: 8 total
- Mapped to phases: 8/8 (100%)
- Unmapped: 0
- Pending (gap closure Phase 14): 4 (SRCH-05, LINK-01, LINK-02, LINK-03)

---
*Requirements defined: 2026-03-04*
*Traceability updated: 2026-03-04*
