#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-scripts.sh — the harness's own code is linted too.
#
#   ShellCheck (severity >= warning) on scripts/*.sh and the husky hooks
#   Python syntax of every hook and sensor written in Python
#   No harness code loads harness_paths by name or changes the module search
#   path (EN-ATTENTE §2a, lot B)
#
# A sensor with a syntax error does not fail loudly: a hook that crashes may
# simply stop judging. Abstains (exit 3) when shellcheck is not installed
# locally; the CI image always has it, and CI does not accept abstentions.
# ---------------------------------------------------------------------------
set -uo pipefail

# Never read or write Python bytecode: a .pyc planted in the cache would
# replace the source of a guard or of the stdlib (JOURNAL J-052).
export PYTHONDONTWRITEBYTECODE=1 PYTHONPYCACHEPREFIX=/dev/null/mivro-nopyc

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

# harness_paths is loaded by path, never by name (EN-ATTENTE §2a, lot B): a
# module, package or extension named harness_paths anywhere on the search path
# would replace it, and a directory put on that path shadows the stdlib. Closed
# by refusal, not by listing the import forms one by one: any line where an
# `import` is followed by the word harness_paths, a `from harness_paths`, the
# name handed to __import__/import_module/run_module or to `-m`, and any change
# of the search path (sys.path written, indexed or extended, a site dir added,
# a PYTHONPATH assignment). A file path (harness_paths.py, …/harness_paths) is
# no import. No exception list: the self-test's own controls load their
# modules by path too.
# Accepted false positive, named: a comment or a message whose text reads like
# such an import turns this sensor red too; reword it. The self-test builds its
# probe forms at run time for that reason, and so does the second pattern here.
NAME_IMPORT_RE='(^|[^A-Za-z0-9_.])(import[[:space:]]([^#]*[^A-Za-z0-9_/])?harness_paths([^A-Za-z0-9_./]|$)|from[[:space:]]+harness_paths[[:space:]]+import)|(__import__|import_module|run_module)\([[:space:]]*.harness_paths|-m[[:space:]]*harness_paths'
SYS_PATH_RE='sys\.path[[:space:]]*(\.(insert|append|extend)[[:space:]]*\(|\+?=|\[)|addsite''dir|PYTHON''PATH='
HARNESS_CODE="$(git ls-files --cached --others --exclude-standard -- \
  'scripts/*.py' 'scripts/**/*.py' 'scripts/*.sh' 'scripts/**/*.sh' '.husky/*' '.github/workflows/*.yml' '.claude/settings.json')"
if [ -n "$HARNESS_CODE" ]; then
  # shellcheck disable=SC2086  # word splitting of the file list is intended
  if grep -nE -- "$NAME_IMPORT_RE|$SYS_PATH_RE" $HARNESS_CODE /dev/null; then
    echo "✖ harness_paths imported by name, or sys.path changed: load it by path (importlib.util.spec_from_file_location), lot B"
    FAIL=1
  fi
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
