#!/usr/bin/env bash
# Release helper for the TRMNL Liquid VSCode extension.
#
# Bumps the version, creates a git commit + tag (via `npm version`), and
# publishes to the VSCode Marketplace. Does NOT push to GitHub — do that
# yourself with:
#
#   git push && git push --tags
#
# Usage:
#   scripts/release.sh                # patch (default): 0.1.0 -> 0.1.1
#   scripts/release.sh patch
#   scripts/release.sh minor          # 0.1.0 -> 0.2.0
#   scripts/release.sh major          # 0.1.0 -> 1.0.0
#
# Prerequisites:
#   - Working tree must be clean (commit your changes first)
#   - vsce must be authenticated: `npx @vscode/vsce login objectgraph-llc`

set -euo pipefail

cd "$(dirname "$0")/.."

BUMP="${1:-patch}"

case "$BUMP" in
  patch|minor|major) ;;
  *)
    echo "Error: bump must be patch, minor, or major (got '$BUMP')" >&2
    echo "Usage: $0 [patch|minor|major]" >&2
    exit 1
    ;;
esac

# Bail early if working tree dirty (npm version would error anyway, but
# this gives a clearer message).
if ! git diff-index --quiet HEAD --; then
  echo "✗ Working tree has uncommitted changes. Commit them first." >&2
  git status --short >&2
  exit 1
fi

CURRENT=$(node -p "require('./package.json').version")
echo "→ Current version: $CURRENT"
echo "→ Bump:            $BUMP"
echo
read -r -p "Proceed with bump + Marketplace publish? [y/N] " REPLY
echo
[[ $REPLY =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }

# 1. Bump version. npm version writes package.json + package-lock.json,
#    creates a commit "vX.Y.Z", and creates a tag "vX.Y.Z".
npm version "$BUMP"

NEW=$(node -p "require('./package.json').version")

# 2. Publish to Marketplace. vsce runs `npm run vscode:prepublish`
#    (which runs `npm run build`) automatically.
npx @vscode/vsce publish

echo
echo "✓ Published v$NEW to https://marketplace.visualstudio.com/items?itemName=objectgraph-llc.trmnl-liquid"
echo
echo "Push to GitHub:"
echo "  git push && git push origin v$NEW"
