#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-diff.sh — diff-scoped quality gate.
#
# Fails when the diff INTRODUCES one of the escape hatches banned by the
# harness. Only ADDED lines of .ts/.tsx/.js/.jsx files are inspected, so
# pre-existing code never blocks a commit.
#
# Usage:
#   scripts/check-diff.sh              # working tree vs HEAD, else branch vs upstream
#   scripts/check-diff.sh <base>       # explicit base (rev or rev range)
#
# Exit codes: 0 = clean, 1 = at least one banned pattern introduced.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

resolve_range() {
  if [ "$#" -ge 1 ] && [ -n "${1:-}" ]; then
    printf '%s' "$1"
    return
  fi
  # Uncommitted work takes priority: that is what the agent just wrote.
  if ! git diff --quiet HEAD -- 2>/dev/null; then
    printf 'HEAD'
    return
  fi
  # Otherwise compare the branch against its upstream, then against main.
  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    printf '%s' "$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}')...HEAD"
    return
  fi
  if git rev-parse --verify --quiet main >/dev/null 2>&1; then
    printf 'main...HEAD'
    return
  fi
  printf 'HEAD~1...HEAD'
}

RANGE="$(resolve_range "${1:-}")"

DIFF="$(git diff --unified=0 --no-color "$RANGE" -- '*.ts' '*.tsx' '*.js' '*.jsx' || true)"

# In working-tree mode, a brand new file is untracked and therefore absent from
# `git diff HEAD`. Synthesise a full-file diff for those so freshly written code
# is inspected too. Skipped for commit ranges (untracked files are not pushed).
if [ "$RANGE" = "HEAD" ]; then
  while IFS= read -r untracked; do
    [ -n "$untracked" ] || continue
    DIFF="$DIFF
$(git diff --unified=0 --no-color --no-index -- /dev/null "$untracked" || true)"
  done <<UNTRACKED
$(git ls-files --others --exclude-standard -- '*.ts' '*.tsx' '*.js' '*.jsx')
UNTRACKED
fi

# Cheap short-circuit. Deliberately NOT `printf | grep -q`: grep exits on the
# first match, printf then dies of SIGPIPE, and with `set -o pipefail` that
# non-zero status made the guard swallow every large diff. Deliberately NOT a
# `${DIFF//[[:space:]]/}` substitution either: quadratic on macOS bash 3.2.
# awk below handles a whitespace-only diff correctly on its own.
if [ -z "$DIFF" ]; then
  exit 0
fi

REPORT="$(printf '%s\n' "$DIFF" | awk '
  function report(label,  _) {
    printf "  %s:%d  [%s]\n%s      %s\n", file, lineno, label, "", body
    violations++
  }
  /^\+\+\+ b\// { file = substr($0, 7); next }
  /^\+\+\+ \/dev\/null/ { file = ""; next }
  /^@@/ {
    # @@ -a,b +c,d @@  -> new-file start line is c
    match($0, /\+[0-9]+/)
    lineno = substr($0, RSTART + 1, RLENGTH - 1) + 0
    next
  }
  /^\+/ {
    if (file == "") next
    body = substr($0, 2)
    if (body ~ /(^|[^A-Za-z0-9_$.])as[ \t]+any([^A-Za-z0-9_$]|$)/) report("as any")
    else if (body ~ /:[ \t]*any([^A-Za-z0-9_$]|$)/)                report(": any")
    else if (body ~ /<any>/ || body ~ /(^|[^A-Za-z0-9_$.])any\[\]/) report("any type")
    else if (body ~ /@ts-ignore/)                                  report("@ts-ignore")
    else if (body ~ /@ts-nocheck/)                                 report("@ts-nocheck")
    else if (body ~ /eslint-disable/)                              report("eslint-disable")
    else if (body ~ /\.skip[ \t]*\(/)                              report(".skip(")
    else if (body ~ /(^|[^A-Za-z0-9_$.])(xit|xdescribe)[ \t]*\(/)  report("xit( / xdescribe(")
    lineno++
    next
  }
  END { if (violations > 0) exit 9 }
' && printf 'CLEAN')" || true

if [ "$REPORT" = "CLEAN" ] || [ -z "$REPORT" ]; then
  exit 0
fi

cat >&2 <<MSG
✖ check-diff: banned escape hatch introduced (range: $RANGE)

$REPORT
Banned in added code: 'as any', ': any', '@ts-ignore', '@ts-nocheck',
'eslint-disable', '.skip(', 'xit(' / 'xdescribe('.

Fix the type instead of silencing the tool:
  - unknown + a Zod schema for external data (TS-004)
  - a narrowing type guard instead of a cast
  - a real fix instead of a skipped test
MSG
exit 1
