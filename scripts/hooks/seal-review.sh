#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SubagentStop hook, matcher "reviewer" — seals the reviewer's verdict.
#
# The verdict is read from the reviewer's OWN final message, never from a file
# the main agent could write: the first version sealed whatever `.pending`
# verdict it found (JOURNAL J-037). Source, in order:
#   1. `last_assistant_message` of the SubagentStop payload;
#   2. the reviewer's transcript (`agent_transcript_path`), last assistant
#      entry carrying a `VERDICT:` line — in case the final report went through
#      a hand-back tool rather than a plain message.
# Both are written by Claude Code; the transcripts are protected by the guards.
#
# Sealed only when:
#   - agent_type is `reviewer` and the verdict is `APPROVED`;
#   - the tree now is the tree recorded at THIS review's SubagentStart
#     (reset-review.sh, pending file named after agent_id), and no file of the
#     tree changed since — ctime, so a change reverted before the end (ABA)
#     still counts (JOURNAL J-042, J-043).
# The seal stamps that tree. scripts/review-gate.sh (pre-commit) accepts an
# agent commit only when its tree is that exact tree.
#
# Any other outcome removes the seal: a review that ended without approving
# invalidates the old approval.
# ---------------------------------------------------------------------------
set -uo pipefail

# Never read or write Python bytecode: a .pyc planted in the cache would
# replace the source of a guard or of the stdlib (JOURNAL J-052).
export PYTHONDONTWRITEBYTECODE=1 PYTHONPYCACHEPREFIX=/dev/null/mivro-nopyc

HOOKS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD="$(cat)"
FIELDS="$(printf '%s' "$PAYLOAD" | python3 -c '
import json, re, sys

VERDICT = re.compile(r"^\W*VERDICT\W*:?[\s*`_]*([A-Z][A-Z_]+)", re.MULTILINE)

def verdicts_in(text):
    return VERDICT.findall(text or "")

try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
found = verdicts_in(data.get("last_assistant_message"))
path = data.get("agent_transcript_path") or ""
if not found and path:
    # Fallback: the LAST assistant entry only — its text, or the report of a
    # hand-back tool. Never a verdict-shaped line quoted earlier in a test
    # command or a tool input (J-044).
    last = None
    try:
        for line in open(path, encoding="utf-8"):
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if entry.get("type") == "assistant":
                last = entry
    except OSError:
        last = None
    for block in ((last or {}).get("message") or {}).get("content") or []:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text":
            found = found or verdicts_in(block.get("text"))
        elif block.get("type") == "tool_use" and "handback" in str(block.get("name", "")).lower():
            # The text of the report itself, NOT a JSON dump: json.dumps put `{"message": "`
            # in front of line 1, so the verdict line never matched (J-045).
            payload = block.get("input") or {}
            texts = [v for v in (payload.values() if isinstance(payload, dict) else [payload]) if isinstance(v, str)]
            for text in texts:
                found = found or verdicts_in(text)
print(data.get("cwd") or "")
print(data.get("agent_type") or "")
# The FIRST verdict line: the reviewer is told to put its verdict at the top;
# a verdict-shaped line quoted lower down (a fixture, an example) never counts (J-045).
print(found[0] if found else "NONE")
print(re.sub(r"[^A-Za-z0-9_-]", "", str(data.get("agent_id") or "unknown")))
' 2>/dev/null)"
CWD="$(printf '%s\n' "$FIELDS" | sed -n 1p)"
AGENT="$(printf '%s\n' "$FIELDS" | sed -n 2p)"
VERDICT="$(printf '%s\n' "$FIELDS" | sed -n 3p)"
AGENT_ID="$(printf '%s\n' "$FIELDS" | sed -n 4p)"
[ -n "$CWD" ] || CWD="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)" || exit 0

SEALED="$(git rev-parse --git-path mivro-review)"
PENDING="$(git rev-parse --git-path "mivro-review.pending.${AGENT_ID:-unknown}")"
START_TREE="$(sed -n 's/^start_tree=//p' "$PENDING" 2>/dev/null)"
# Did any file of the tree change after this review started? ctime moves on
# every content change and cannot be set back by `touch`.
CHANGED_DURING=1
if [ -f "$PENDING" ]; then
  CHANGED_DURING="$(git ls-files -z -co --exclude-standard | python3 -c '
import os, sys
since = os.stat(sys.argv[1]).st_ctime_ns
names = [n for n in sys.stdin.buffer.read().decode().split("\0") if n]
changed = any(os.path.exists(n) and os.lstat(n).st_ctime_ns > since for n in names)
print(1 if changed else 0)
' "$PENDING" 2>/dev/null || echo 1)"
fi
rm -f "$SEALED" "$PENDING"

if [ "$AGENT" != "reviewer" ] || [ "$VERDICT" != "APPROVED" ]; then
  exit 0
fi

TREE="$(bash "$HOOKS/tree-hash.sh")"
if [ -z "$START_TREE" ] || [ "$START_TREE" != "$TREE" ] || [ "$CHANGED_DURING" != 0 ]; then
  # The tree moved during the review (or the start was never recorded): the
  # APPROVED covers something else than what is on disk now.
  exit 0
fi

printf 'verdict=%s\ntree=%s\nsealed=%s\n' "$VERDICT" "$TREE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$SEALED"
exit 0
