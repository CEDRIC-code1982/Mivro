#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-audit.sh — known vulnerabilities in the runtime dependencies.
#
# Same sensor for the pre-push and the CI job `security`, so a red audit shows
# up at pre-push instead of on the first PR (JOURNAL J-040: the job was red
# before it ever ran). Development-only dependencies are left out: they never
# ship in the app.
#
# Some advisories have no fix reachable on the current React Native line
# (JOURNAL J-040, remeasured 2026-10-05). They are accepted BY NAME in
# scripts/audit-accepted.json: one GHSA id, the package, why it does not reach
# the shipped app, and an expiry date. Anything else is red:
#   - a high/critical advisory that is not on the list;
#   - an accepted advisory past its expiry date (re-decide, do not extend blindly);
#   - a malformed list entry.
# An accepted advisory that npm no longer reports is printed as stale: remove
# it at the next harness session.
#
# Exit 0 = nothing unaccepted, 1 = at least one finding, 3 = abstained (no
# network or registry unreachable). CI does not accept the abstention.
# MIVRO_AUDIT_ROOT lets the self-test point the sensor at a doctored manifest.
# ---------------------------------------------------------------------------
set -uo pipefail

# Never read or write Python bytecode: a .pyc planted in the cache would
# replace the source of a guard or of the stdlib (JOURNAL J-052).
export PYTHONDONTWRITEBYTECODE=1 PYTHONPYCACHEPREFIX=/dev/null/mivro-nopyc

HARNESS="$(cd "$(dirname "$0")" && pwd)"
ROOT="${MIVRO_AUDIT_ROOT:-$(git rev-parse --show-toplevel)}"
cd "$ROOT" || exit 1

OUT="$(npm audit --omit=dev --json 2>/dev/null)"
printf '%s' "$OUT" | python3 "$HARNESS/check-audit-verdict.py" "$HARNESS/audit-accepted.json"
