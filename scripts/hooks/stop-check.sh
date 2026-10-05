#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Stop / SubagentStop hook — the agent cannot end its turn on a red tree.
#
# When the working tree has uncommitted changes, runs the "fast" stage of
# scripts/sensors.sh (typecheck, lint, format, arch, check-diff, lock, native,
# deps, journal refs, scripts). Red: exit 2, and Claude Code hands the report
# back to the agent, which has to keep working. The PostToolUse hook only sees
# files touched through Edit/Write; this one also sees what Bash wrote, deleted
# or moved (JOURNAL J-034).
#
# Loop guard: an agent that cannot make the tree green must still be able to
# hand the problem to Cedric. After 3 blocked stops with no change to the tree,
# or 8 in a row whatever the changes, the stop is allowed — with a message
# shown to Cedric naming the red sensors. It never lets a red tree pass
# silently.
#
# Budget: the fast stage runs its sensors in parallel; measured in
# docs/harness/INVENTAIRE.md.
# ---------------------------------------------------------------------------
set -uo pipefail

PAYLOAD="$(cat)"
CWD="$(printf '%s' "$PAYLOAD" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("cwd") or "")
except Exception:
    print("")
' 2>/dev/null)"
[ -n "$CWD" ] || CWD="${CLAUDE_PROJECT_DIR:-$PWD}"

ROOT="$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$ROOT" || exit 0
[ -f scripts/check.sh ] || exit 0

# Nothing uncommitted: nothing new to judge (commits went through the git hooks).
[ -n "$(git status --porcelain 2>/dev/null)" ] || exit 0

STATE="$(git rev-parse --git-path mivro-stop-state)"
# The content of untracked files counts: fixing a brand-new file must count as
# a change, not as a fourth attempt on the same tree.
KEY="$({
  git status --porcelain
  git diff HEAD 2>/dev/null
  git ls-files -o --exclude-standard -z | xargs -0 shasum 2>/dev/null
} | shasum | cut -c1-16)"

LAST_KEY=""
SAME=0
TOTAL=0
RELEASED=0
if [ -f "$STATE" ]; then
  read -r LAST_KEY SAME TOTAL RELEASED <"$STATE" || true
fi
RELEASED="${RELEASED:-0}"

release() {
  python3 -c '
import json, sys
print(json.dumps({"systemMessage": "⚠ Mivro harness: turn ended with RED sensors (" + sys.argv[1] + "). The agent could not make them green; review before trusting this state."}))
' "${1:-unknown}"
  exit 0
}

# Already let through on this exact tree: Cedric has been warned once, blocking
# again would only burn three more attempts per turn (EN-ATTENTE §14).
if [ "$RELEASED" = 1 ] && [ "$KEY" = "$LAST_KEY" ]; then
  release "unchanged since the last warning"
fi

# MIVRO_STOP_ONLY narrows the sensors for the self-test only. It is read from
# the hook's environment, which the agent's Bash tool cannot set.
ONLY=()
[ -n "${MIVRO_STOP_ONLY:-}" ] && ONLY=(--only "$MIVRO_STOP_ONLY")
# ${ONLY[@]+...}: an empty array under `set -u` is an error in macOS bash 3.2.
REPORT="$(bash scripts/check.sh --stage fast ${ONLY[@]+"${ONLY[@]}"} --quiet 2>&1)"
CODE=$?

if [ "$CODE" -eq 0 ]; then
  rm -f "$STATE"
  exit 0
fi

if [ "$KEY" = "$LAST_KEY" ]; then SAME=$((SAME + 1)); else SAME=1; fi
TOTAL=$((TOTAL + 1))

RED="$(printf '%s\n' "$REPORT" | sed -n 's/.*sensor(s) red:[^ ]* *//p' | tail -1)"

if [ "$SAME" -gt 3 ] || [ "$TOTAL" -gt 8 ]; then
  # Keep the key, marked released, so the same tree is not blocked again; reset
  # TOTAL, so a NEW red tree gets its 3 attempts instead of an instant release.
  printf '%s %s 0 1\n' "$KEY" "$SAME" >"$STATE"
  release "$RED"
fi
printf '%s %s %s 0\n' "$KEY" "$SAME" "$TOTAL" >"$STATE"

{
  echo "✖ The harness is red — you cannot end your turn on this tree."
  echo
  printf '%s\n' "$REPORT" | head -150
  echo
  echo "Fix the cause (do not silence a tool, do not touch harness files). If it truly"
  echo "cannot be fixed without Cedric, say so explicitly in your final message: after"
  echo "3 attempts on an unchanged tree the stop is let through, with a warning to him."
} >&2
exit 2
