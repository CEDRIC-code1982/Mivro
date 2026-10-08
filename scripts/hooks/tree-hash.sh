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

# An empty GIT_INDEX_FILE is the REAL index: without this exit, a failed mktemp
# (the Bash sandbox, JOURNAL J-051) made `git add -A` stage the whole tree.
TMP_INDEX="$(mktemp "${TMPDIR:-/tmp}/mivro.XXXXXX")" || exit 1
[ -n "$TMP_INDEX" ] || exit 1
trap 'rm -f "$TMP_INDEX"' EXIT
rm -f "$TMP_INDEX"
GIT_INDEX_FILE="$TMP_INDEX" git read-tree HEAD 2>/dev/null || true
GIT_INDEX_FILE="$TMP_INDEX" git add -A 2>/dev/null
GIT_INDEX_FILE="$TMP_INDEX" git write-tree
