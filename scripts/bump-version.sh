#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/bump-version.sh <version>"
  echo "Example: ./scripts/bump-version.sh 0.2.0"
  exit 1
fi

# Validate semver format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be in semver format (X.Y.Z)"
  exit 1
fi

echo "Bumping version to $VERSION..."

# Update package.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
echo "  ✓ Updated package.json"

# Update tauri.conf.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
echo "  ✓ Updated src-tauri/tauri.conf.json"

# Update Cargo.toml (first version line only)
sed -i '' "0,/^version = \".*\"$/s//version = \"$VERSION\"/" src-tauri/Cargo.toml
echo "  ✓ Updated src-tauri/Cargo.toml"

echo ""
echo "Version bumped to $VERSION"
echo "Next: git add -A && git commit -m 'chore: bump version to v$VERSION'"
