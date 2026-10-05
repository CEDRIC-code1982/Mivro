#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-scripts.sh — the harness's own code is linted too.
#
#   ShellCheck (severity >= warning) on scripts/*.sh and the husky hooks
#   Python syntax of every hook and sensor written in Python
#
# A sensor with a syntax error does not fail loudly: a hook that crashes may
# simply stop judging. Abstains (exit 3) when shellcheck is not installed
# locally; the CI image always has it, and CI does not accept abstentions.
# ---------------------------------------------------------------------------
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

FAIL=0
PY_FILES="$(git ls-files --cached --others --exclude-standard -- 'scripts/*.py' 'scripts/**/*.py')"
if [ -n "$PY_FILES" ]; then
  # ast.parse, not py_compile: no __pycache__ written into the repo.
  # shellcheck disable=SC2086  # word splitting of the file list is intended
  python3 -c '
import ast, sys
bad = 0
for path in sys.argv[1:]:
    try:
        ast.parse(open(path, encoding="utf-8").read(), path)
    except SyntaxError as err:
        print(f"✖ {path}:{err.lineno}: {err.msg}")
        bad = 1
sys.exit(bad)
' $PY_FILES || FAIL=1
fi

if ! command -v shellcheck >/dev/null 2>&1; then
  [ "$FAIL" -eq 0 ] || exit 1
  echo "shellcheck not installed (brew install shellcheck)"
  exit 3
fi

SH_FILES="$(git ls-files --cached --others --exclude-standard -- 'scripts/*.sh' 'scripts/**/*.sh' '.husky/pre-*' '.husky/commit-*')"
# shellcheck disable=SC2086  # word splitting of the file list is intended
# --norc: a .shellcheckrc with disable=all, here or in a parent directory or $HOME,
# turned this sensor green (JOURNAL J-045).
shellcheck --norc --severity=warning --shell=bash $SH_FILES || FAIL=1

# GitHub workflows, when actionlint is installed (brew install actionlint).
# Optional, not an abstention when missing: GitHub itself refuses a workflow
# that does not parse, so the worst case of a skipped actionlint is a red run.
if command -v actionlint >/dev/null 2>&1; then
  actionlint .github/workflows/*.yml || FAIL=1
fi

exit "$FAIL"
