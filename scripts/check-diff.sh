#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-diff.sh — diff-scoped quality gate.
#
# Fails when the diff INTRODUCES something the harness bans. Only ADDED lines
# are inspected, so pre-existing code never blocks a commit.
#
#   code files (.ts .tsx .js .jsx .mjs .cjs)
#     - suppression directives: @ts-ignore, @ts-nocheck, @ts-expect-error,
#       eslint-disable*, inline eslint config comments, coverage ignores
#     - the any type in any position (TS only), z.any()
#     - focused / disabled / pending tests: .only .skip .todo .failing,
#       xit xtest xdescribe fit fdescribe
#   every file
#     - credentials: Google/AWS/GitHub/Slack/Stripe keys, private keys,
#       Sentry DSNs, and `password = "..."`-style assignments outside tests
#     - files that must never be committed (.env, Firebase configs, keystores,
#       signing material), even when force-added past .gitignore
#
# Usage:
#   scripts/check-diff.sh              # working tree vs HEAD, else branch vs upstream
#   scripts/check-diff.sh <base>       # explicit base (rev or rev range)
#   scripts/check-diff.sh --print-range  # show the range it would inspect
#
# Exit codes: 0 = clean, 1 = at least one banned item introduced.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

resolve_range() {
  if [ "$#" -ge 1 ] && [ -n "${1:-}" ]; then
    printf '%s' "$1"
    return
  fi
  # Uncommitted work takes priority: that is what the agent just wrote. An
  # untracked file counts as uncommitted work — a brand-new feature is often
  # nothing but untracked files, and `git diff --quiet HEAD` alone missed it.
  if [ -n "$(git status --porcelain --untracked-files=all 2>/dev/null)" ]; then
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

if [ "${1:-}" = "--print-range" ]; then
  resolve_range
  exit 0
fi

RANGE="$(resolve_range "${1:-}")"

# Fail closed: a range whose bounds do not resolve (shallow clone, deleted ref,
# typo) used to produce an empty diff — and a green that inspected nothing
# (JOURNAL J-041).
for bound in $(printf '%s' "$RANGE" | sed 's/\.\.\.*/ /'); do
  if ! git rev-parse --verify --quiet "$bound^{commit}" >/dev/null; then
    echo "✖ check-diff: '$bound' (range $RANGE) does not resolve to a commit — nothing was inspected." >&2
    exit 2
  fi
done

# --text and an empty attributes file: a `*.ts -diff` line in a .gitattributes
# turned every change into "Binary files differ" and blinded this sensor
# (JOURNAL J-045). Attributes never decide what is inspected here.
GIT_NOATTR=(git -c core.attributesFile=/dev/null)
if ! DIFF="$("${GIT_NOATTR[@]}" diff --text --unified=0 --no-color --no-ext-diff "$RANGE" --)"; then
  echo "✖ check-diff: git diff failed on range $RANGE." >&2
  exit 2
fi
# AR: a rename is an addition under the new name — `git mv notes.js
# src/x/.eslintrc.js` slipped past the nested-config check (JOURNAL J-042).
ADDED_FILES="$(git diff --name-only --diff-filter=AR "$RANGE" --)"

# In working-tree mode, a brand new file is untracked and therefore absent from
# `git diff HEAD`. Synthesise a full-file diff for those so freshly written code
# is inspected too. Skipped for commit ranges (untracked files are not pushed).
if [ "$RANGE" = "HEAD" ]; then
  while IFS= read -r untracked; do
    [ -n "$untracked" ] || continue
    DIFF="$DIFF
$("${GIT_NOATTR[@]}" diff --text --unified=0 --no-color --no-index -- /dev/null "$untracked" || true)"
    ADDED_FILES="$ADDED_FILES
$untracked"
  done <<UNTRACKED
$(git ls-files --others --exclude-standard)
UNTRACKED
fi

# Files that must never reach the repository, whatever .gitignore says. Matched
# case-insensitively: on APFS, Package.json IS package.json (JOURNAL J-046).
shopt -s nocasematch
FORBIDDEN=""
NESTED=""
while IFS= read -r added; do
  [ -n "$added" ] || continue
  case "$added" in
    .env | */.env | .env.local | .env.*.local | \
      *GoogleService-Info.plist | *google-services.json | \
      *.keystore | *.jks | *.p12 | *.p8 | *.mobileprovision | *.pem)
      case "$added" in
        *.example | *debug.keystore) ;;
        *) FORBIDDEN="$FORBIDDEN  $added
" ;;
      esac
      ;;
  esac
  # A tool configuration below the root is merged over the root one: a
  # src/features/X/.eslintrc.js switched rules off with lint green, and no
  # layer of the harness saw it (JOURNAL J-039). The only nested configs are the
  # two separate projects, listed explicitly.
  # NESTED_EXCEPTIONS_BEGIN — same list as harness_paths.NESTED_CONFIG_EXCEPTIONS
  case "$added" in
    docs-site/package.json | docs-site/tsconfig.json | docs-site/babel.config.js) ;;
    */.eslintrc* | */.prettierrc* | */prettier.config.* | */.babelrc* | */babel.config.* | \
      */jest.config.* | */tsconfig*.json | */.dependency-cruiser* | */.eslintignore | */.prettierignore | \
      */package.json)
      NESTED="$NESTED  $added
"
      ;;
  esac
  # NESTED_EXCEPTIONS_END
  # Jest applies any __mocks__ file without a jest.mock call: one replaced the
  # theme the contrast test checks, tests green (JOURNAL J-044).
  case "/$added" in
    */__mocks__/*) NESTED="$NESTED  $added (jest __mocks__)
" ;;
  esac
done <<ADDED
$ADDED_FILES
ADDED

# Cheap short-circuit. Deliberately NOT `printf | grep -q`: grep exits on the
# first match, printf then dies of SIGPIPE, and with `set -o pipefail` that
# non-zero status made the guard swallow every large diff. Deliberately NOT a
# `${DIFF//[[:space:]]/}` substitution either: quadratic on macOS bash 3.2.
# awk below handles a whitespace-only diff correctly on its own.
REPORT=""
if [ -n "$DIFF" ]; then
  REPORT="$(printf '%s\n' "$DIFF" | awk '
    function report(label) {
      printf "  %s:%d  [%s]\n      %s\n", file, lineno, label, body
      violations++
    }
    # Blank out string literals and comments so prose never trips a code rule.
    function strip(s) {
      gsub(/\\./, "", s)
      gsub(/"[^"]*"/, "\"\"", s)
      gsub(/\047[^\047]*\047/, "\"\"", s)
      gsub(/`[^`]*`/, "\"\"", s)
      gsub(/\/\*.*\*\//, "", s)
      sub(/\/\/.*$/, "", s)
      if (s ~ /^[ \t]*\*/) s = ""
      return s
    }
    /^\+\+\+ b\// {
      file = substr($0, 7)
      is_code = (file ~ /\.(ts|tsx|js|jsx|mjs|cjs)$/)
      is_ts = (file ~ /\.(ts|tsx)$/)
      is_test = (file ~ /(\.test\.|__tests__\/|src\/test-utils\/)/)
      next
    }
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
      low = tolower(body)

      # --- credentials: every file type ---------------------------------
      if (body ~ /AIza[0-9A-Za-z_-]{35}/)                          report("secret: Google API key")
      else if (body ~ /AKIA[0-9A-Z]{16}/)                          report("secret: AWS access key")
      else if (body ~ /-----BEGIN [A-Z ]*PRIVATE KEY-----/)        report("secret: private key")
      else if (body ~ /gh[pousr]_[A-Za-z0-9]{36}/)                 report("secret: GitHub token")
      else if (body ~ /xox[abposr]-[A-Za-z0-9-]{10,}/)             report("secret: Slack token")
      else if (body ~ /sk_live_[0-9A-Za-z]{20,}/)                  report("secret: Stripe live key")
      else if (body ~ /https:\/\/[0-9a-f]{32}@[a-z0-9.]*ingest/)   report("secret: Sentry DSN")
      else if (!is_test && low ~ /(password|passwd|secret|api[_-]?key|access[_-]?token|private[_-]?key)["\047]?[ \t]*[:=][ \t]*["\047][^"\047 \t]{8,}["\047]/) \
                                                                   report("secret: hardcoded credential")

      if (!is_code) { lineno++; next }

      # --- suppression directives: raw text, comments included ----------
      if (body ~ /@ts-ignore/)                                     report("@ts-ignore")
      else if (body ~ /@ts-nocheck/)                               report("@ts-nocheck")
      else if (body ~ /@ts-expect-error/)                          report("@ts-expect-error")
      else if (body ~ /eslint-disable/)                            report("eslint-disable")
      else if (body ~ /\/\*[ \t]*eslint[ \t]+[A-Za-z@]/)           report("inline eslint config")
      else if (body ~ /\/\*[ \t]*eslint-env/)                      report("inline eslint config")
      else if (body ~ /(istanbul|c8|v8)[ \t]+ignore/)              report("coverage ignore")
      else {
        code = strip(body)
        if (is_ts && code ~ /(^|[^A-Za-z0-9_$.])any([^A-Za-z0-9_$]|$)/) report("any type")
        else if (code ~ /(^|[^A-Za-z0-9_$])z\.any[ \t]*\(/)          report("z.any()")
        # Re-declaring JSON / Body / Response, or any global, reopens what
        # src/types/stdlib-unknown.d.ts closes (TS-004, JOURNAL J-045).
        else if (is_ts && file != "src/types/stdlib-unknown.d.ts" && code ~ /(^|[^A-Za-z0-9_$])(declare[ \t]+global|interface[ \t]+(JSON|Body|Response|Window|Global)([^A-Za-z0-9_$]|$))/) \
                                                                     report("global declaration merge")
        else if (code ~ /\.(only|skip|todo|failing)[ \t]*[(.]/)      report("focused/disabled test")
        else if (code ~ /(^|[^A-Za-z0-9_$.])(xit|xtest|xdescribe|fit|fdescribe)[ \t]*[(.]/) \
                                                                     report("focused/disabled test")
      }
      lineno++
      next
    }
    END { if (violations > 0) exit 9 }
  '; printf '\n__AWK_EXIT=%s' "$?")"
  # awk's own status, not an empty report, decides: 0 clean, 9 violations,
  # anything else a crash that inspected nothing (JOURNAL J-041). The captured
  # text is only the violations, so these expansions stay small.
  AWK_EXIT="${REPORT##*__AWK_EXIT=}"
  REPORT="${REPORT%__AWK_EXIT=*}"
  case "$AWK_EXIT" in
    0) REPORT="" ;;
    9) ;;
    *)
      echo "✖ check-diff: the inspection itself failed (awk exit $AWK_EXIT) — nothing can be vouched for." >&2
      exit 2
      ;;
  esac
fi

if [ -z "$REPORT" ] && [ -z "$FORBIDDEN" ] && [ -z "$NESTED" ]; then
  exit 0
fi

{
  printf '✖ check-diff: banned item introduced (range: %s)\n\n' "$RANGE"
  if [ -n "$REPORT" ]; then
    printf '%s\n\n' "$REPORT"
  fi
  if [ -n "$FORBIDDEN" ]; then
    printf 'Files that must never be committed (secrets / signing material):\n%s\n' "$FORBIDDEN"
    printf 'Unstage them (git rm --cached <file>); they stay local and gitignored.\n\n'
  fi
  if [ -n "$NESTED" ]; then
    printf 'Nested tool configuration (merged over the root one, JOURNAL J-039):\n%s\n' "$NESTED"
    printf 'Exemptions belong in the root config files, which are reviewed and locked.\n\n'
  fi
  cat <<'MSG'
Fix the cause instead of silencing the tool:
  - unknown + a Zod schema for external data (TS-004), a type guard instead of a cast
  - a real fix instead of a skipped, focused or pending test
  - credentials live in .env (react-native-config), never in the source
MSG
} >&2
exit 1
