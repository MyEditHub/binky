Release a new version of Binky. Usage:

- `/bump patch` — Bugfixes, kleine Korrekturen (0.1.1 → 0.1.2)
- `/bump minor` — Neue Features (0.1.1 → 0.2.0)
- `/bump major` — Großer Umbau (0.1.1 → 1.0.0)
- `/bump 0.2.1` — Explizite Versionsnummer
- `/bump --retag` — Selbe Version nochmal bauen (z.B. nach CI-Fehler)

**If `$ARGUMENTS` is `--retag`:**
Tell the user to run:
```bash
./scripts/bump-version.sh --retag
```
No changelog needed for a retag.

**Otherwise:**
1. Look at the recent git log (`git log --oneline -20`) and uncommitted changes (`git diff --stat HEAD`) to understand what changed since the last release.
2. Fill `NEXT_RELEASE.md` with 2–4 concise German bullet points summarising the user-facing changes. Match the tone of existing README.md changelog entries. Skip internal CI/tooling changes unless they directly affect the user.
3. Tell the user to review `NEXT_RELEASE.md` and then run:

```bash
./scripts/bump-version.sh $ARGUMENTS --release
```

If `$ARGUMENTS` is empty, default to `patch`.
