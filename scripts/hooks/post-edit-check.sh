#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# PostToolUse hook — runs after Write/Edit on a code file.
#
#   1. tsc --noEmit    project-wide, incremental so it stays ~1.4 s   (TS only)
#   2. depcruise       layer boundaries, on the edited module only  ~0.9 s
#   3. eslint --fix    the edited file only, zero warning allowed   ~1.7 s
#
# Steps 1 and 2 run concurrently, so the wall clock is max(1.4, 0.9) + 1.7,
# which keeps the whole hook around 3 s. Step 3 runs last because it rewrites
# the file, and must not race with a reader.
#
# Silent on success. On failure: exit 2 so Claude Code feeds stderr back to the
# agent, with the full compiler / cruiser / linter output.
#
# Reads the tool payload as JSON on stdin.
# ---------------------------------------------------------------------------
set -uo pipefail

# --- extract the edited path from the hook payload -------------------------
PAYLOAD="$(cat)"
FILE="$(printf '%s' "$PAYLOAD" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
ti = data.get("tool_input") or {}
print(ti.get("file_path") or ti.get("notebook_path") or "")
' 2>/dev/null)"

IS_TS=0
case "$FILE" in
  *.ts | *.tsx) IS_TS=1 ;;
  *.js | *.jsx | *.mjs | *.cjs) ;;
  *) exit 0 ;;
esac

[ -f "$FILE" ] || exit 0

# The repo that owns the edited file, NOT $CLAUDE_PROJECT_DIR: that one stays on
# the main checkout, so an edit made from a worktree used to be checked against
# the main tree — silently green whatever the worktree contained (JOURNAL J-027).
ROOT="$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$ROOT" || exit 0

if [ ! -d "$ROOT/node_modules" ]; then
  MAIN="${CLAUDE_PROJECT_DIR:-}"
  {
    echo "✖ Harness check could not run: $ROOT has no node_modules (fresh worktree?)."
    if [ -n "$MAIN" ] && [ -d "$MAIN/node_modules" ] && [ "$MAIN" != "$ROOT" ]; then
      echo "Link the main checkout's dependencies, then re-save the file:"
      echo "  ln -s \"$MAIN/node_modules\" \"$ROOT/node_modules\""
    else
      echo "Run 'npm ci' in $ROOT, then re-save the file."
    fi
  } >&2
  exit 2
fi

# Path relative to the repo root: depcruise resolves its rules against it.
REL_FILE="${FILE#"$ROOT"/}"

CACHE_DIR="$ROOT/node_modules/.cache/mivro-harness"
mkdir -p "$CACHE_DIR" 2>/dev/null || true
TSBUILDINFO="$CACHE_DIR/tsc.tsbuildinfo"
LOCK="$CACHE_DIR/tsc.lock"
TSC_LOG="$(mktemp)"
DC_LOG="$(mktemp)"
trap 'rm -f "$TSC_LOG" "$DC_LOG"; rmdir "$LOCK" 2>/dev/null || true' EXIT

# --- step 1: typecheck (background) ---------------------------------------
# Parallel edits would race on the same .tsbuildinfo, so take a short lock and
# fall back to a non-incremental run rather than corrupting the cache.
run_typecheck() {
  local waited=0
  while ! mkdir "$LOCK" 2>/dev/null; do
    # Reap a lock left behind by a killed process.
    if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +2 2>/dev/null)" ]; then
      rmdir "$LOCK" 2>/dev/null || true
      continue
    fi
    waited=$((waited + 1))
    if [ "$waited" -gt 60 ]; then
      npx --no-install tsc --noEmit >"$TSC_LOG" 2>&1
      return $?
    fi
    sleep 0.2
  done

  npx --no-install tsc --noEmit --incremental --tsBuildInfoFile "$TSBUILDINFO" >"$TSC_LOG" 2>&1
  local code=$?
  # A cache written by another TS version makes tsc bail out; rebuild once.
  # Substring-match with `case`, not `grep -q`, which would exit early and turn
  # a SIGPIPE into a false failure under `pipefail`.
  if [ "$code" -ne 0 ] && case "$(cat "$TSC_LOG")" in *tsbuildinfo*) true ;; *) false ;; esac; then
    rm -f "$TSBUILDINFO"
    npx --no-install tsc --noEmit --incremental --tsBuildInfoFile "$TSBUILDINFO" >"$TSC_LOG" 2>&1
    code=$?
  fi

  rmdir "$LOCK" 2>/dev/null || true
  return $code
}

TSC_PID=""
if [ "$IS_TS" -eq 1 ]; then
  run_typecheck &
  TSC_PID=$!
fi

# --- step 2: architecture, edited module only (background) ----------------
# Production code under src/ only: .dependency-cruiser.js already excludes
# tests and ambient declarations, so cruising them would be a no-op.
DC_PID=""
case "$REL_FILE" in
  *.test.ts | *.test.tsx | *.d.ts | src/test-utils/*) ;;
  src/*)
    npx --no-install depcruise "$REL_FILE" --config .dependency-cruiser.js >"$DC_LOG" 2>&1 &
    DC_PID=$!
    ;;
  *) ;;
esac

TSC_CODE=0
if [ -n "$TSC_PID" ]; then
  wait "$TSC_PID"
  TSC_CODE=$?
fi

DC_CODE=0
if [ -n "$DC_PID" ]; then
  wait "$DC_PID"
  DC_CODE=$?
fi

# --- step 3: lint + autofix on the touched file ---------------------------
# --max-warnings 0: a warning is a finding, not a suggestion (JOURNAL J-032).
# Root config only: a nested config cannot soften the verdict (J-043).
ESLINT_OUT="$(npx --no-install eslint --no-eslintrc -c .eslintrc.js --fix --max-warnings 0 "$FILE" 2>&1)"
ESLINT_CODE=$?

if [ "$TSC_CODE" -eq 0 ] && [ "$DC_CODE" -eq 0 ] && [ "$ESLINT_CODE" -eq 0 ]; then
  exit 0
fi

{
  echo "✖ Harness check failed after editing $REL_FILE"
  if [ "$TSC_CODE" -ne 0 ]; then
    echo
    echo "--- tsc --noEmit (exit $TSC_CODE) ---"
    cat "$TSC_LOG"
  fi
  if [ "$DC_CODE" -ne 0 ]; then
    echo
    echo "--- check:arch on $REL_FILE (exit $DC_CODE) ---"
    cat "$DC_LOG"
    echo
    echo "A layer boundary was crossed. Depend on a port from services/domain and"
    echo "let serviceContainer wire the adapter; see .dependency-cruiser.js."
  fi
  if [ "$ESLINT_CODE" -ne 0 ]; then
    echo
    echo "--- eslint --fix $REL_FILE (exit $ESLINT_CODE) ---"
    printf '%s\n' "$ESLINT_OUT"
    echo
    echo "Remaining problems are NOT auto-fixable. Fix the code — do not silence"
    echo "the tool: check-diff blocks a suppression comment or a cast to any."
  fi
} >&2

exit 2
