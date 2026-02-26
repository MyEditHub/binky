#!/bin/bash

# Check for flags
RELEASE=false
RETAG=false
VERSION_ARG=""
for arg in "$@"; do
  if [ "$arg" = "--release" ]; then
    RELEASE=true
  elif [ "$arg" = "--retag" ]; then
    RETAG=true
  else
    VERSION_ARG="$arg"
  fi
done

# Handle --retag flag (re-release same version without bumping)
if [ "$RETAG" = true ]; then
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  TAG="v$CURRENT_VERSION"

  echo "Re-tagging $TAG..."

  # Delete local tag if exists
  if git tag -l | grep -q "^$TAG$"; then
    git tag -d "$TAG"
    echo "  Deleted local tag"
  fi

  # Delete remote tag if exists
  if git ls-remote --tags origin | grep -q "refs/tags/$TAG"; then
    git push origin ":refs/tags/$TAG"
    echo "  Deleted remote tag"
  fi

  # Create and push new tag
  git tag "$TAG"
  git push origin "$TAG"

  echo ""
  echo "Re-tagged $TAG! Build triggered on GitHub Actions."
  exit 0
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Parse current version into parts
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Determine new version based on argument
case "$VERSION_ARG" in
  major)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
  minor)
    NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
    ;;
  patch|"")
    NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
    ;;
  *)
    # Assume it's an explicit version number (e.g. 0.2.0)
    if ! [[ "$VERSION_ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "Error: Version must be major, minor, patch, or X.Y.Z"
      exit 1
    fi
    NEW_VERSION=$VERSION_ARG
    ;;
esac

echo "Updating version from $CURRENT_VERSION to $NEW_VERSION..."

# Update package.json
npm version $NEW_VERSION --no-git-tag-version
echo "  Updated package.json"

# Update tauri.conf.json
sed -i '' "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
echo "  Updated src-tauri/tauri.conf.json"

# Update Cargo.toml (first version line only, in [package] section)
sed -i '' "0,/^version = \".*\"$/s//version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
echo "  Updated src-tauri/Cargo.toml"

# Update README.md changelog from NEXT_RELEASE.md (if it has real content)
if ! grep -q "### v$NEW_VERSION" README.md; then
  TODAY=$(date +%Y-%m-%d)

  HAS_CONTENT=false
  if [ -f "NEXT_RELEASE.md" ]; then
    REAL_NOTES=$(grep "^- " NEXT_RELEASE.md 2>/dev/null | grep -v "^- TODO$" | grep -v "^- Neue Features$" | grep -v "^- Änderungen$" | grep -v "^- Bugfixes$")
    if [ -n "$REAL_NOTES" ]; then
      HAS_CONTENT=true
    fi
  fi

  if [ "$HAS_CONTENT" = true ]; then
    RELEASE_NOTES=$(tail -n +2 NEXT_RELEASE.md | grep -v "^# " | grep -v "^Trag" | grep -v "^- TODO$" | grep -v "^- Neue Features$" | grep -v "^- Änderungen$" | grep -v "^- Bugfixes$" | sed '/^$/N;/^\n$/d')

    CHANGELOG_LINE=$(grep -n "^## 📝 Changelog" README.md | head -1 | cut -d: -f1)
    {
      head -n "$CHANGELOG_LINE" README.md
      echo ""
      echo "### v$NEW_VERSION ($TODAY)"
      echo ""
      echo "$RELEASE_NOTES"
      echo ""
      tail -n +"$((CHANGELOG_LINE + 1))" README.md
    } > README.tmp && mv README.tmp README.md

    # Reset NEXT_RELEASE.md to template
    cat > NEXT_RELEASE.md << 'TEMPLATE'
# Nächste Version

Trag deine Änderungen hier ein, bevor du bump-version.sh ausführst.

- TODO
TEMPLATE

    echo "  Updated README.md (from NEXT_RELEASE.md)"
  else
    # Fallback: add placeholder entry
    CHANGELOG_LINE=$(grep -n "^## 📝 Changelog" README.md | head -1 | cut -d: -f1)
    {
      head -n "$CHANGELOG_LINE" README.md
      echo ""
      echo "### v$NEW_VERSION ($TODAY)"
      echo ""
      echo "- TODO: Changelog eintragen"
      echo ""
      tail -n +"$((CHANGELOG_LINE + 1))" README.md
    } > README.tmp && mv README.tmp README.md
    echo "  Updated README.md (placeholder — fill in NEXT_RELEASE.md next time)"
  fi
fi

echo ""
echo "Version bumped to $NEW_VERSION"

# If --release flag is set, commit, tag, and push
if [ "$RELEASE" = true ]; then
  echo ""
  echo "Committing..."
  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml README.md NEXT_RELEASE.md 2>/dev/null || true
  git commit -m "chore: bump version to v$NEW_VERSION"

  echo "Creating tag..."
  git tag "v$NEW_VERSION"

  echo "Pushing..."
  git push && git push origin "v$NEW_VERSION"

  echo ""
  echo "Released v$NEW_VERSION! Build triggered on GitHub Actions."
else
  echo ""
  echo "Next steps:"
  echo "  1. Edit README.md changelog entry for v$NEW_VERSION (or prefill NEXT_RELEASE.md before bumping)"
  echo "  2. git add . && git commit -m 'chore: bump version to v$NEW_VERSION'"
  echo "  3. git tag v$NEW_VERSION && git push && git push origin v$NEW_VERSION"
  echo ""
  echo "Or automate: ./scripts/bump-version.sh $VERSION_ARG --release"
fi
