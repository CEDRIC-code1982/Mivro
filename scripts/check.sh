#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check.sh — runs the sensors of scripts/sensors.sh.
#
#   npm run check                          stage "check" (everything but docs)
#   bash scripts/check.sh --stage fast     what the Stop hook runs
#   bash scripts/check.sh --stage push     pre-push and CI
#   bash scripts/check.sh --only lint,arch
#   bash scripts/check.sh --range A...B    diff range for check-diff (repeatable)
#   bash scripts/check.sh --list
#
# Every sensor runs even when an earlier one failed, so a single run gives the
# full picture. Cheap sensors run in parallel, then tests and docs run alone
# (they are CPU-bound and would only slow each other down).
#
# Exit 0 only when every selected sensor is green. An abstention (exit 3 from a
# sensor allowed to abstain) is named in the summary and is NOT a green: it
# fails the run under MIVRO_NO_ABSTAIN=1 (CI), and is tolerated locally.
# ---------------------------------------------------------------------------
set -uo pipefail

# Never read or write Python bytecode: a .pyc planted in the cache would
# replace the source of a guard or of the stdlib (JOURNAL J-052).
export PYTHONDONTWRITEBYTECODE=1 PYTHONPYCACHEPREFIX=/dev/null/mivro-nopyc

cd "$(git rev-parse --show-toplevel)" || exit 1

# shellcheck source=scripts/sensors.sh
. scripts/sensors.sh

STAGE="check"
ONLY=""
RANGES=""
LIST=0
QUIET=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --stage) STAGE="${2:-}"; shift 2 ;;
    --only) ONLY="${2:-}"; shift 2 ;;
    --range) RANGES="$RANGES ${2:-}"; shift 2 ;;
    --list) LIST=1; shift ;;
    --quiet) QUIET=1; shift ;;
    *) echo "check.sh: unknown argument '$1'" >&2; exit 2 ;;
  esac
done
case "$STAGE" in
  fast | check | push) ;;
  *) echo "check.sh: unknown stage '$STAGE' (fast|check|push)" >&2; exit 2 ;;
esac
RANGES="${RANGES# }"
[ -n "$RANGES" ] || RANGES="$(bash scripts/check-diff.sh --print-range 2>/dev/null || echo HEAD)"
export RANGES

# ESLint cache keyed on the rules themselves: a stock cache would keep serving
# results computed by an older version of a local rule.
CACHE_DIR="node_modules/.cache/mivro-harness"
mkdir -p "$CACHE_DIR" 2>/dev/null || true
RULES_KEY="$(cat .eslintrc.js eslint-local-rules.js eslint-rules/*.js 2>/dev/null | shasum | cut -c1-12)"
ESLINT_CACHE="--cache --cache-strategy content --cache-location $CACHE_DIR/eslint-$RULES_KEY"
[ -n "${CI:-}" ] && ESLINT_CACHE=""
export ESLINT_CACHE

# No code preloaded into the tools: NODE_OPTIONS (or a .npmrc `node-options`,
# which npm turns into NODE_OPTIONS) could rewrite any sensor's exit code
# (JOURNAL J-045). Both are emptied for every sensor.
unset NODE_OPTIONS
export npm_config_node_options=""
export NPM_CONFIG_NODE_OPTIONS=""

stage_rank() {
  case "$1" in fast) echo 1 ;; check) echo 2 ;; push) echo 3 ;; esac
}

SELECTED=()
KNOWN_IDS=" "
while IFS= read -r row; do
  [ -n "$row" ] || continue
  IFS='|' read -r id stage abstain label cmd <<<"$row"
  KNOWN_IDS="$KNOWN_IDS$id "
  if [ -n "$ONLY" ]; then
    case ",$ONLY," in *",$id,"*) ;; *) continue ;; esac
  elif [ "$(stage_rank "$stage")" -gt "$(stage_rank "$STAGE")" ]; then
    continue
  fi
  SELECTED+=("$row")
done <<<"$MIVRO_SENSORS"

# An unknown id in --only is an error, never a silent green.
if [ -n "$ONLY" ]; then
  for wanted in ${ONLY//,/ }; do
    case "$KNOWN_IDS" in *" $wanted "*) ;; *) echo "check.sh: unknown sensor '$wanted'" >&2; exit 2 ;; esac
  done
fi

if [ "$LIST" -eq 1 ]; then
  for row in "${SELECTED[@]}"; do
    IFS='|' read -r id stage abstain label cmd <<<"$row"
    printf '%-10s %-6s %s%s\n' "$id" "$stage" "$label" "$([ "$abstain" = 1 ] && echo '  (may abstain)')"
  done
  exit 0
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/mivro.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

run_sensor() {
  local id="$1" cmd="$2" start end
  start=$(date +%s)
  bash -c "$cmd" >"$WORK/$id.out" 2>&1
  echo $? >"$WORK/$id.code"
  end=$(date +%s)
  echo $((end - start)) >"$WORK/$id.time"
}

# Parallel batch: everything except tests and docs.
PIDS=()
for row in "${SELECTED[@]}"; do
  IFS='|' read -r id stage abstain label cmd <<<"$row"
  case "$id" in tests | docs) continue ;; esac
  run_sensor "$id" "$cmd" &
  PIDS+=($!)
done
for pid in "${PIDS[@]:-}"; do
  [ -n "$pid" ] && wait "$pid"
done
for row in "${SELECTED[@]}"; do
  IFS='|' read -r id stage abstain label cmd <<<"$row"
  case "$id" in tests | docs) run_sensor "$id" "$cmd" ;; esac
done

RED=()
ABSTAINED=()
for row in "${SELECTED[@]}"; do
  IFS='|' read -r id stage abstain label cmd <<<"$row"
  code="$(cat "$WORK/$id.code")"
  secs="$(cat "$WORK/$id.time")"
  if [ "$code" -eq 0 ]; then
    [ "$QUIET" -eq 1 ] || printf '  \033[32m✔\033[0m %-10s %s (%ss)\n' "$id" "$label" "$secs"
  elif [ "$code" -eq 3 ] && [ "$abstain" = 1 ]; then
    ABSTAINED+=("$id")
    printf '  \033[33m⊘\033[0m %-10s %s — abstained: %s\n' "$id" "$label" "$(tail -1 "$WORK/$id.out")"
  else
    RED+=("$id")
    printf '  \033[31m✖\033[0m %-10s %s (exit %s, %ss)\n' "$id" "$label" "$code" "$secs"
  fi
done

for id in "${RED[@]:-}"; do
  [ -n "$id" ] || continue
  printf '\n\033[1m--- %s ---\033[0m\n' "$id"
  # The full output matters for a fix; cap it so one noisy tool cannot bury the others.
  head -200 "$WORK/$id.out"
done

if [ "${#RED[@]}" -gt 0 ]; then
  printf '\n\033[31m✖ %d sensor(s) red:\033[0m %s\n' "${#RED[@]}" "${RED[*]}"
  exit 1
fi
if [ "${#ABSTAINED[@]}" -gt 0 ]; then
  if [ "${MIVRO_NO_ABSTAIN:-0}" = 1 ]; then
    printf '\n\033[31m✖ abstention not allowed here:\033[0m %s\n' "${ABSTAINED[*]}"
    exit 1
  fi
  printf '\n\033[33m⊘ green, except abstained:\033[0m %s — not verified on this machine.\n' "${ABSTAINED[*]}"
  exit 0
fi
[ "$QUIET" -eq 1 ] || printf '\n\033[32m✔ all %d sensors green (stage %s)\033[0m\n' "${#SELECTED[@]}" "$STAGE"
exit 0
