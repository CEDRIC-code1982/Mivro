#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SubagentStart hook, matcher "reviewer" — a new review voids the old seal and
# records the tree it is about to read.
#
# 1. Until this review ends and scripts/hooks/seal-review.sh reads its verdict,
#    no approval exists: a commit can never slip through on an older APPROVED
#    while a newer review is running or after it was interrupted (J-037).
# 2. The tree at the START is recorded in a pending file named after THIS
#    review's agent_id. The seal is only granted to that same review, if the
#    tree at its end is the same AND no file changed in between (ctime): two
#    parallel reviews used to share one pending file, and a change reverted
#    before the end (ABA) used to look like no change (JOURNAL J-043).
# 3. A stale DONE-CONTRACT (scripts/check-contract.sh) is told to the reviewer
#    as additional context, so that it answers NO_CONTRACT at once (J-022).
# Everything lives under .git/, which the guards protect.
# ---------------------------------------------------------------------------
set -uo pipefail

# Never read or write Python bytecode: a .pyc planted in the cache would
# replace the source of a guard or of the stdlib (JOURNAL J-052).
export PYTHONDONTWRITEBYTECODE=1 PYTHONPYCACHEPREFIX=/dev/null/mivro-nopyc

HOOKS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD="$(cat)"
FIELDS="$(printf '%s' "$PAYLOAD" | python3 -c '
import json, re, sys
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
print(data.get("cwd") or "")
print(re.sub(r"[^A-Za-z0-9_-]", "", str(data.get("agent_id") or "unknown")))
' 2>/dev/null)"
CWD="$(printf '%s\n' "$FIELDS" | sed -n 1p)"
AGENT_ID="$(printf '%s\n' "$FIELDS" | sed -n 2p)"
[ -n "$CWD" ] || CWD="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)" || exit 0

rm -f "$(git rev-parse --git-path mivro-review)"
PENDING="$(git rev-parse --git-path "mivro-review.pending.${AGENT_ID:-unknown}")"
printf 'start_tree=%s\nstarted=%s\n' "$(bash "$HOOKS/tree-hash.sh")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$PENDING"

# 3. A stale contract (it names another branch) costs a whole review: tell the
#    reviewer before its first prompt. A SubagentStart hook cannot block; it
#    can only add context to the subagent (JOURNAL J-022).
CONTRACT_CHECK="$HOOKS/../check-contract.sh"
[ -f "$CONTRACT_CHECK" ] && ! STALE="$(bash "$CONTRACT_CHECK" 2>&1)" && MIVRO_STALE="$STALE" python3 -I -B -c '
import json, os
note = ("HARNESS: " + os.environ["MIVRO_STALE"] + "\nThe contract in place is not the one of this "
        "branch: answer VERDICT: NO_CONTRACT (step 0).")
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SubagentStart", "additionalContext": note}}))
'
exit 0
