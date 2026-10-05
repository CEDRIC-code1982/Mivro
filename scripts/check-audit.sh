#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-audit.sh — known vulnerabilities in the runtime dependencies.
#
# Same command as the CI job `security`, so a red audit shows up at pre-push
# instead of on the first PR (JOURNAL J-040: the job was red before it ever ran).
# Development-only dependencies are left out: they never ship in the app.
#
# Exit 0 = no high/critical advisory, 1 = at least one, 3 = abstained (no
# network or registry unreachable). CI does not accept the abstention.
# ---------------------------------------------------------------------------
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

OUT="$(npm audit --omit=dev --audit-level=high 2>&1)"
CODE=$?
if [ "$CODE" -eq 0 ]; then
  exit 0
fi
case "$OUT" in
  *ENOTFOUND* | *ECONNREFUSED* | *ETIMEDOUT* | *EAI_AGAIN* | *"network"*"request"*)
    echo "npm registry unreachable"
    exit 3
    ;;
esac
printf '%s\n' "$OUT" | tail -40
cat <<'MSG'

Fix: `npm audit fix` (never --force) in a dedicated branch, then a native
rebuild — the app's lockfile moves. A package that must be added or bumped
across a major is Cedric's call (scripts/allowed-dependencies.json).
MSG
exit 1
