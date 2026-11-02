#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-docs-facts.sh — what the context docs still ask to do matches the repo.
#
#   1. A script declared replaced in any Markdown file ("au lieu de
#      `scripts/X`") is no longer prescribed by an open step of the RUNBOOK.
#   2. No open item — a "- [ ]" box of the TODO or the RUNBOOK, or an open
#      numbered step of the RUNBOOK — names a harness/* branch that is already
#      merged in the history of HEAD.
#
# Both come from the reviews of J-057 (JOURNAL J-022): step 5 of the RUNBOOK
# still prescribed scripts/setup-branch-protection.sh after the TODO declared
# it replaced by a ruleset, and harness/en-attente-5-8 stayed "to do" in the
# TODO and the RUNBOOK after PR #3 merged it. npm run check was green on both.
#
# An item is the start line plus the indented lines that follow it, up to the
# next item or unindented line (Prettier wraps prose). An item whose title starts with "~~" is done and skipped;
# elsewhere, "~~...~~" spans are struck text and ignored, and so is the
# declaration "au lieu de `scripts/X`" itself.
#
# Limits, by construction: a replacement made only on GitHub, never written in
# a document, cannot be seen (the ruleset of 2026-10-26); a branch merged after
# HEAD forked from develop is not in the history of HEAD yet; a done step
# whose title is struck but whose remainder is still open is skipped whole.
# A branch that names itself in an open item is green on its own PR (the CI
# HEAD is "Merge <sha> into <sha>") and turns red only once merged, on develop
# and every branch cut from it. Items are cut by indentation only: a checked
# "- [x]" sub-item belongs to its open parent, any numbered list of the
# RUNBOOK is a list of steps, an unindented code fence closes the step, and a
# title in "**~~...~~**" is not seen as done. Striking the text is the way out.
# ---------------------------------------------------------------------------
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

RUNBOOK="docs/context/RUNBOOK.md"
TODO="docs/context/TODO.md"
for doc in "$RUNBOOK" "$TODO"; do
  [ -f "$doc" ] || {
    echo "✖ $doc is missing"
    exit 1
  }
done

# Scripts declared replaced. Line breaks are folded first: Prettier may wrap a
# declaration between "au lieu de" and the path.
BT='`'
REPLACED="$(git ls-files -co --exclude-standard -- '*.md' | while IFS= read -r doc; do
  [ -f "$doc" ] && cat "$doc"
done | tr '\n' ' ' | grep -oE "[Aa]u lieu de[* ]*${BT}scripts/[^${BT} ]+${BT}" |
  grep -oE "scripts/[^${BT}]+" | sort -u)"

# harness/* branches merged in the history of HEAD, by their merge subject:
# GitHub ("Merge pull request #N from owner/branch") or local ("Merge branch").
# HEAD, not develop: under a CI pull_request run there is no local develop, and
# HEAD is the merge of the PR into it.
MERGED="$(git log --merges --format=%s HEAD 2>/dev/null |
  sed -nE -e 's|^Merge pull request #[0-9]+ from [^/ ]+/(harness/[^ ]+).*|\1|p' \
    -e "s|^Merge branch '(harness/[^']+)'.*|\\1|p" | sort -u)"

# Passed through the environment: a newline in `awk -v` is an error in BWK awk.
MIVRO_REPLACED="$REPLACED" MIVRO_MERGED="$MERGED" MIVRO_RUNBOOK="$RUNBOOK" awk '
  # needle cited in text as a whole name, not as part of a longer one
  function cites(text, needle, pos, at, before, after) {
    pos = 0
    while ((at = index(substr(text, pos + 1), needle)) > 0) {
      pos += at
      before = pos > 1 ? substr(text, pos - 1, 1) : " "
      after = substr(text, pos + length(needle), 1)
      if (before == "/" && pos > 2 && substr(text, pos - 2, 1) == ".") before = " "
      if (before !~ /[A-Za-z0-9_.\/-]/ && after !~ /[A-Za-z0-9_\/-]/) return 1
    }
    return 0
  }
  function flush(i) {
    if (!open_item) return
    open_item = 0
    if (title ~ /^~~/) return
    gsub(/~~[^~]*~~/, "", text)
    gsub(/[Aa]u lieu de[* ]*`scripts\/[^`]*`/, "", text)
    if (file == ENVIRON["MIVRO_RUNBOOK"]) {
      for (i = 1; i <= n_replaced; i++) {
        if (cites(text, replaced[i])) {
          printf "✖ %s:%d: an open step prescribes %s, declared replaced (\"au lieu de\") in a doc\n", file, start, replaced[i]
          bad = 1
        }
      }
    }
    for (i = 1; i <= n_merged; i++) {
      if (cites(text, merged[i])) {
        printf "✖ %s:%d: an open item names %s, already merged in the history of HEAD\n", file, start, merged[i]
        bad = 1
      }
    }
  }
  function begin(rest) {
    flush()
    open_item = 1
    start = FNR
    title = rest
    text = rest
  }
  BEGIN {
    n_replaced = split(ENVIRON["MIVRO_REPLACED"], replaced, "\n")
    n_merged = split(ENVIRON["MIVRO_MERGED"], merged, "\n")
  }
  FNR == 1 { flush(); file = FILENAME }
  /^ *- \[ \] / { line = $0; sub(/^ *- \[ \] */, "", line); begin(line); next }
  file == ENVIRON["MIVRO_RUNBOOK"] && /^ *[0-9]+\. / { line = $0; sub(/^ *[0-9]+\. */, "", line); begin(line); next }
  # an unindented line closes the item; indented ones, sub-bullets and blank
  # lines between them stay in it (a step may hold paragraphs and commands)
  /^[ \t]*$/ { next }
  /^[^ \t]/ { flush(); next }
  open_item { line = $0; sub(/^[ \t]+/, "", line); text = text " " line }
  END { flush(); exit bad }
' "$RUNBOOK" "$TODO"
