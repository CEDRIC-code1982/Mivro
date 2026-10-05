#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# tree-hash.sh — the git tree of the WHOLE working tree, as a commit would see
# it after `git add -A`: tracked and untracked files, ignored ones excepted.
# Hashed through a throw-away index, so the real index is never touched.
#
# Shared by reset-review.sh (tree at the start of a review), seal-review.sh
# (tree at its end) and, indirectly, review-gate.sh (tree being committed).
# Run from inside the repository.
# ---------------------------------------------------------------------------
set -uo pipefail

TMP_INDEX="$(mktemp)"
trap 'rm -f "$TMP_INDEX"' EXIT
rm -f "$TMP_INDEX"
GIT_INDEX_FILE="$TMP_INDEX" git read-tree HEAD 2>/dev/null || true
GIT_INDEX_FILE="$TMP_INDEX" git add -A 2>/dev/null
GIT_INDEX_FILE="$TMP_INDEX" git write-tree
