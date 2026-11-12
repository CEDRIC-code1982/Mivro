#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ci-local.sh — the `check.yml` CI, replayed on this machine.
#
#   npm run ci:local                 the four steps of the `battery` and
#                                    `security` jobs, on <base>...HEAD
#   npm run ci:local -- --install    same, after `npm ci` (+ docs-site)
#
# Why: while GitHub Actions does not start any job (account locked, 2026-11-12),
# a PR has no check at all. This runs what check.yml runs, with the same
# arguments, so a branch can be judged before it is pushed.
#
# The steps, in check.yml order (the self-test, section 10, fails when a `run:`
# command of check.yml other than Install and Diff range has no counterpart
# here, so the two cannot drift apart):
#   1. sensors, stage push, on the PR range, abstentions refused
#   2. harness self-test
#   3. J-051 probe: a copy of the self-test with a dead call must count it
#   4. npm audit on the runtime dependencies
# Not replayed: gitleaks (GitHub action, needs the API) and harness-guard,
# which only prints whether the range needs Cedric's `harness-change` label.
#
# Range: like a pull_request run, <base>...HEAD where base is the merge base
# with origin/develop (origin/main as a fallback), after a `git fetch origin`
# that may fail offline or under the Claude Code sandbox: the last known
# origin/develop is used then, with a warning.
#
# Every step runs even after a failure; a summary closes the run. Exit 0 only
# when every step is green (an abstention, exit 3, is red as in CI); exit 2 on
# a usage error or when no base can be found.
# ---------------------------------------------------------------------------
set -uo pipefail
# Never read or write Python bytecode: a .pyc planted in the cache would
# replace the source of a guard or of the stdlib (JOURNAL J-052).
export PYTHONDONTWRITEBYTECODE=1 PYTHONPYCACHEPREFIX=/dev/null/mivro-nopyc

# The script's own path, frozen before the `cd`: `usage` reads its header, and
# a relative $0 resolved after the `cd` printed nothing, with exit 0 (review 1).
SELF="$(cd "$(dirname "$0")" && pwd -P)/$(basename "$0")"
cd "$(git rev-parse --show-toplevel)" || exit 2

usage() {
  sed -n '3,8p' "$SELF" | sed 's/^# \{0,1\}//'
}

INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=1 ;;
    -h | --help) usage; exit 0 ;;
    *) printf 'ci-local: unknown option %s\n' "$arg" >&2; usage >&2; exit 2 ;;
  esac
done

ESC=$'\033'
if [ -t 1 ]; then
  TTY=1
  BOLD="${ESC}[1m" DIM="${ESC}[2m" RED="${ESC}[31m" GREEN="${ESC}[32m" YELLOW="${ESC}[33m" RESET="${ESC}[0m"
else
  TTY=0
  BOLD="" DIM="" RED="" GREEN="" YELLOW="" RESET=""
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/mivro-ci-local.XXXXXX")" || {
  echo "✖ cannot create a temporary directory under ${TMPDIR:-/tmp}" >&2
  exit 2
}
trap 'rm -rf "$WORK"' EXIT

info() { printf '  %s\n' "$1"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

fmt_duration() { # fmt_duration <seconds>
  if [ "$1" -ge 60 ]; then printf '%d min %02d s' $(($1 / 60)) $(($1 % 60)); else printf '%d s' "$1"; fi
}

# --- Range --------------------------------------------------------------------
printf '%s━━ CI locale — check.yml ━━%s\n' "$BOLD" "$RESET"
FETCHED=0
git fetch --quiet origin 2>"$WORK/fetch.err" && FETCHED=1
HEAD_SHA="$(git rev-parse HEAD)"
BASE="" BASE_REF=""
for ref in origin/develop origin/main; do
  if BASE="$(git merge-base "$HEAD_SHA" "$ref" 2>/dev/null)" && [ -n "$BASE" ]; then
    BASE_REF="$ref"
    break
  fi
done
if [ "$FETCHED" = 1 ]; then
  info "git fetch origin : à jour"
else
  # Name the real cause and the ref the range falls back on (review 1). The
  # first line carries the cause; git's last one is often "and the repository
  # exists.".
  FETCH_WHY="$(grep -v '^[[:space:]]*$' "$WORK/fetch.err" | head -1)"
  warn "git fetch origin impossible : ${FETCH_WHY:-cause inconnue}"
  [ -n "$BASE_REF" ] && warn "plage calculée sur le dernier $BASE_REF connu, peut-être en retard sur GitHub"
fi
if [ -z "$BASE" ]; then
  printf '%s✖ ni origin/develop ni origin/main : aucune base pour la plage%s\n' "$RED" "$RESET" >&2
  exit 2
fi
RANGE="$BASE...$HEAD_SHA"
info "branche : $(git rev-parse --abbrev-ref HEAD)"
info "base    : $BASE_REF"
info "plage   : $(git rev-parse --short "$BASE")...$(git rev-parse --short "$HEAD_SHA") ($(git rev-list --count "$RANGE") commit(s))"
if [ -n "$(git status --porcelain)" ]; then
  warn "arbre de travail modifié : les capteurs le lisent, la CI GitHub ne verrait que les commits"
fi

# --- harness-guard, information only ------------------------------------------
# Same judgment as harness-guard.yml: harness_paths and the protected list AS
# ON THE BASE, loaded by path (never by name, EN-ATTENTE §2a, lot B).
git diff --name-only --no-renames "$RANGE" >"$WORK/changed.txt" 2>/dev/null
mkdir -p "$WORK/base"
if git show "$BASE:scripts/hooks/harness_paths.py" >"$WORK/base/harness_paths.py" 2>/dev/null &&
  git show "$BASE:scripts/harness-protected.txt" >"$WORK/base/harness-protected.txt" 2>/dev/null; then
  python3 -I -B -X pycache_prefix=/dev/null/mivro-nopyc - "$WORK/base" "$WORK/changed.txt" <<'PY' >"$WORK/harness.txt" 2>"$WORK/harness.err"
import importlib.util
import sys

base, changed = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location("harness_paths", f"{base}/harness_paths.py")
harness_paths = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harness_paths)

patterns = harness_paths.load_patterns(f"{base}/harness-protected.txt")
always = (".github/", "scripts/harness.lock", "scripts/harness-protected.txt")
is_harness = getattr(harness_paths, "is_harness", None)

for path in open(changed, encoding="utf-8").read().splitlines():
    if path.startswith(always) or harness_paths.matches(path, patterns):
        print(path)
    elif is_harness is not None and is_harness(path, patterns):
        print(path)
PY
  GUARD_RC=$?
  # A crash of the evaluation printed nothing, which read as "no harness file"
  # (review 1): it is reported as not evaluated instead.
  if [ "$GUARD_RC" -ne 0 ]; then
    GUARD_WHY="$(grep -v '^[[:space:]]*$' "$WORK/harness.err" | tail -1)"
    warn "harness-guard : non évalué, python3 a échoué (exit $GUARD_RC${GUARD_WHY:+ : $GUARD_WHY})"
  elif [ -s "$WORK/harness.txt" ]; then
    info "${YELLOW}harness-guard${RESET} : label harness-change requis sur la PR ($(wc -l <"$WORK/harness.txt" | tr -d ' ') fichier(s) du harness)"
    sed -n '1,8p' "$WORK/harness.txt" | sed "s/^/      ${DIM}/;s/\$/${RESET}/"
  else
    info "harness-guard : aucun fichier du harness dans la plage"
  fi
else
  warn "harness-guard : harness_paths absent de la base, non évalué"
fi

# --- Steps --------------------------------------------------------------------
TOTAL=4
[ "$INSTALL" = 1 ] && TOTAL=5
STEP=0
NAMES=()
CODES=()
TIMES=()

run_step() { # run_step <title> <command...>
  local title="$1" start rc
  shift
  STEP=$((STEP + 1))
  printf '\n%s━━ [%d/%d] %s ━━%s\n' "$BOLD" "$STEP" "$TOTAL" "$title" "$RESET"
  start=$SECONDS
  if [ "$TTY" = 1 ]; then
    "$@"
    rc=$?
  else
    # check.sh and the self-test colour their output unconditionally: off a
    # terminal, their escape sequences are stripped here, the children left
    # untouched, and the step keeps its own exit code (review 1, criterion 3).
    "$@" 2>&1 | sed "s/${ESC}\[[0-9;]*m//g"
    rc=${PIPESTATUS[0]}
  fi
  NAMES+=("$title")
  CODES+=("$rc")
  TIMES+=($((SECONDS - start)))
}

install_deps() {
  npm ci && npm --prefix docs-site ci
}

# J-051: a self-test that hits an undefined helper must count it as a failure.
# The copy lives in the work directory, never in the repository (section 12 of
# the self-test counts litter). Its full output is long and repeats step 2:
# only its summary is shown. The red "X exit 127" and " 1 failed" it prints
# are the point of the probe: the title and the line below say so up front,
# so a green run does not look broken.
probe_dead_call() {
  info "ℹ la copie du self-test contient un appel mort volontaire : X exit 127 et 1 failed sont attendus"
  sed '/^section() {/a\
undefined_helper_ci_probe' scripts/harness-selftest.sh >"$WORK/st-dead.sh" || return 1
  bash "$WORK/st-dead.sh" >"$WORK/st-dead.out" 2>&1
  grep -E 'exit 127|passed, [0-9]+ failed' "$WORK/st-dead.out" | sed 's/^ *//;s/^/  /'
  if grep -q ' 1 failed' "$WORK/st-dead.out"; then
    printf '  %s✔ the dead call is counted as exactly one failure%s\n' "$GREEN" "$RESET"
  else
    printf '  %s✖ wanted " 1 failed" in the summary of the doctored self-test%s\n' "$RED" "$RESET"
    return 1
  fi
}

[ "$INSTALL" = 1 ] && run_step "Install (npm ci, docs-site)" install_deps
run_step "Capteurs, stage push (MIVRO_NO_ABSTAIN=1)" env MIVRO_NO_ABSTAIN=1 bash scripts/check.sh --stage push --range "$RANGE"
run_step "Self-test du harness" npm run check:harness
# Kept within the 52 columns of the summary (bytes under Bash 3.2).
run_step "Sonde J-051 : appel mort compté (1 échec attendu)" probe_dead_call
run_step "npm audit (dépendances runtime)" bash scripts/check-audit.sh

# --- Summary ------------------------------------------------------------------
printf '\n%s━━ Récapitulatif ━━%s\n' "$BOLD" "$RESET"
FAILED=0
ELAPSED=0
for i in "${!NAMES[@]}"; do
  ELAPSED=$((ELAPSED + TIMES[i]))
  case "${CODES[$i]}" in
    0) mark="${GREEN}✔${RESET}" note="" ;;
    3) mark="${RED}✖${RESET}" note=" (abstention, refusée comme en CI)"; FAILED=$((FAILED + 1)) ;;
    *) mark="${RED}✖${RESET}" note=" (exit ${CODES[$i]})"; FAILED=$((FAILED + 1)) ;;
  esac
  printf '  %s %-52s %10s%s\n' "$mark" "${NAMES[$i]}" "$(fmt_duration "${TIMES[$i]}")" "$note"
done
printf '  %s\n' "────────────────────────────────────────────────────────────────"
if [ "$FAILED" -eq 0 ]; then
  printf '  %s✔ CI locale verte%s — %d/%d étapes, %s\n' "$GREEN$BOLD" "$RESET" "$STEP" "$STEP" "$(fmt_duration "$ELAPSED")"
  exit 0
fi
printf '  %s✖ CI locale rouge%s — %d/%d étape(s) en échec, %s\n' "$RED$BOLD" "$RESET" "$FAILED" "$STEP" "$(fmt_duration "$ELAPSED")"
exit 1
