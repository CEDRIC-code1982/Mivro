#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# review-gate.sh — called by .husky/pre-commit.
#
# Agent commits need the reviewer's sealed APPROVED verdict for this exact tree
# (JOURNAL J-034). CLAUDECODE=1 is set by Claude Code in the shells it spawns,
# so the gate applies to the agent and to its subagents, not to Cedric's own
# terminal. The Bash guard refuses `unset CLAUDECODE` and its variants.
#
# The verdict is sealed by scripts/hooks/seal-review.sh (SubagentStop of the
# `reviewer` agent), in a file under .git/ that both guards refuse to write.
#
# Exit 0 = commit allowed, 1 = refused (reason on stderr).
# ---------------------------------------------------------------------------
set -uo pipefail

[ "${CLAUDECODE:-}" = "1" ] || exit 0

SEALED="$(git rev-parse --git-path mivro-review)"
TREE="$(git write-tree)"

if [ ! -f "$SEALED" ]; then
  echo "✖ pre-commit: no reviewer verdict for this change." >&2
  echo "  Run the reviewer subagent on the finished work; commit after it APPROVES." >&2
  exit 1
fi

VERDICT="$(sed -n 's/^verdict=//p' "$SEALED")"
REVIEWED="$(sed -n 's/^tree=//p' "$SEALED")"

if [ "$VERDICT" != "APPROVED" ]; then
  echo "✖ pre-commit: the last review verdict is ${VERDICT:-missing}, not APPROVED." >&2
  echo "  Address the review, then run the reviewer again." >&2
  exit 1
fi

if [ "$REVIEWED" != "$TREE" ]; then
  echo "✖ pre-commit: the APPROVED verdict covers another tree than the one being committed." >&2
  echo "  Something changed after the review, or the commit is partial. Commit exactly what" >&2
  echo "  was reviewed (git add -A), or run the reviewer again on the current tree." >&2
  exit 1
fi
exit 0
