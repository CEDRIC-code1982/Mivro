#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-doc-refs.sh — the failure journal stays consistent with its citations.
#
#   1. Entries in docs/harness/JOURNAL-ECHECS.md are numbered J-001, J-002 ...
#      with no gap and no duplicate.
#   2. Every "J-NNN" cited anywhere in the tracked files resolves to an entry.
#
# The journal is where each defect that slipped past the harness is tied to the
# rule that now catches it. A citation to an entry that does not exist is a
# rule whose rationale was lost — or a rule that was never written.
# ---------------------------------------------------------------------------
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

JOURNAL="docs/harness/JOURNAL-ECHECS.md"
[ -f "$JOURNAL" ] || { echo "✖ $JOURNAL is missing"; exit 1; }

# An entry heading is "## J-NNN — title". "## J-014 bis — ..." is an addendum
# to an existing entry, not a new number, so it is not counted.
ENTRIES="$(grep -oE '^## J-[0-9]{3} —' "$JOURNAL" | cut -c4-8)"
FAIL=0

expected=1
DUPES="$(printf '%s\n' "$ENTRIES" | sort | uniq -d)"
if [ -n "$DUPES" ]; then
  echo "✖ duplicate journal entries: $(echo "$DUPES" | tr '\n' ' ')"
  FAIL=1
fi
while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  number=$((10#${entry#J-}))
  if [ "$number" -ne "$expected" ]; then
    printf '✖ journal numbering gap: found %s, expected J-%03d\n' "$entry" "$expected"
    FAIL=1
    expected=$number
  fi
  expected=$((expected + 1))
done <<EOF
$ENTRIES
EOF

# Citations: tracked files plus untracked ones not ignored (work in progress).
# git grep, not xargs grep: it skips ignored files natively and is ~20x faster.
CITED="$(git grep --untracked -h -o -E '(^|[^A-Za-z0-9])J-[0-9]{3}([^0-9]|$)' 2>/dev/null |
  grep -oE 'J-[0-9]{3}' | sort -u)"
while IFS= read -r ref; do
  [ -n "$ref" ] || continue
  case "
$ENTRIES
" in
    *"
$ref
"*) ;;
    *)
      echo "✖ $ref is cited but has no entry in $JOURNAL:"
      git grep --untracked -n -F "$ref" 2>/dev/null | head -5 | sed 's|^|    |'
      FAIL=1
      ;;
  esac
done <<EOF
$CITED
EOF

exit "$FAIL"
