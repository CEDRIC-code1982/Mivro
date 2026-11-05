#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-contract.sh — the DONE-CONTRACT in place is the contract of this branch.
#
# The "**Branche** :" line of docs/harness/DONE-CONTRACT.md must name the
# current branch (its first name in backticks). Otherwise the contract is the
# one of an earlier task: two reviews came back NO_CONTRACT on 2026-10-28, on
# harness/j-022-regles-affirmations-docs, because the contract still named
# harness/ouvrir-github-au-sandbox, already committed (JOURNAL J-022).
#
# Green, without object (exit 0, not an abstention: under MIVRO_NO_ABSTAIN=1 an
# abstention fails the CI run):
#   - outside an agent session (neither CLAUDECODE nor CLAUDE_PROJECT_DIR set):
#     Cedric's own pre-push and the CI, where a contract delivered on develop
#     names its old branch;
#   - a detached HEAD (the CI of a pull_request), develop and main;
#   - no contract, or the blank template: a copy of
#     docs/harness/DONE-CONTRACT.modele.md, or no "**Branche**" line, or a
#     line with no name in backticks, or a "<...>" placeholder.
#
# Run as the "contract" sensor (stage fast, so by the Stop hook at every turn)
# and by scripts/hooks/reset-review.sh before a review, which tells the
# reviewer that the contract is stale (a SubagentStart hook cannot block).
# MIVRO_CONTRACT_BRANCH replaces the current branch (self-test).
# Exit 0 = contract of this branch or without object, 1 = stale contract.
# ---------------------------------------------------------------------------
set -uo pipefail

[ -n "${CLAUDECODE:-}${CLAUDE_PROJECT_DIR:-}" ] || exit 0
cd "$(git rev-parse --show-toplevel)" || exit 1

CONTRACT="docs/harness/DONE-CONTRACT.md"
TEMPLATE="docs/harness/DONE-CONTRACT.modele.md"
BRANCH="${MIVRO_CONTRACT_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null)}"
case "$BRANCH" in "" | HEAD | develop | main) exit 0 ;; esac
[ -f "$CONTRACT" ] || exit 0
# The versioned blank template (lot E).
cmp -s "$CONTRACT" "$TEMPLATE" && exit 0
grep -q '^\*\*Branche\*\*' "$CONTRACT" || exit 0

# The "**Branche**" paragraph, up to the next blank line: Prettier may wrap it
# before the first name in backticks.
BT='`'
NAMED="$(awk '
  /^\*\*Branche\*\*/ { inside = 1 }
  inside && /^[[:space:]]*$/ { exit }
  inside { printf "%s ", $0 }
' "$CONTRACT" | sed -nE "s/^[^${BT}]*${BT}([^${BT}]+)${BT}.*/\\1/p")"

case "$NAMED" in
  # A line left to fill ("**Branche** :" or "`<branche>`") is the blank template.
  "" | *"<"*) exit 0 ;;
  "$BRANCH") exit 0 ;;
esac
echo "✖ $CONTRACT is stale: its **Branche** line names '${NAMED:-nothing}', the current branch is '$BRANCH'."
echo "  Fill the contract of this task (or reset it to its blank template) before working on it."
exit 1
