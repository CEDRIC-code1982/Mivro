#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# sensors.sh — THE table of computational sensors. Sourced, never executed.
#
# Read by scripts/check.sh, which every caller goes through:
#   npm run check         stage "check"  (the agent's gate before a commit)
#   Stop hook             stage "fast"   (end of every agent turn)
#   .husky/pre-push       stage "push"
#   CI (.github/...)      stage "push"   with MIVRO_NO_ABSTAIN=1
# One list, so the four can never drift apart (JOURNAL J-033: the pre-push ran
# neither tsc nor eslint while `npm run check` did).
#
# Row format:  id|stage|may_abstain|label|command
#   stage        fast  = cheap enough for the Stop hook (whole row set < ~20 s)
#                check = adds the slow ones for `npm run check`
#                push  = adds what only the pre-push and the CI run
#   may_abstain  1 = the sensor may exit 3 when its tool is missing locally.
#                An abstention is reported by name and never counted as green;
#                in CI (MIVRO_NO_ABSTAIN=1) it counts as a failure.
#   command      run with `bash -c` from the repo root. $RANGES holds the diff
#                range(s) to inspect, space-separated ("HEAD" = working tree).
#
# ESLint and Prettier run with the ROOT config only (--no-eslintrc -c / --config):
# a nested .eslintrc or a package.json `eslintConfig` key used to be merged over
# it and switched rules off, lint green (JOURNAL J-039, J-043).
#
# Every option that stops a tool from discovering configuration on its own is
# forced: --no-editorconfig, --options, shellcheck --norc, and check.sh clears
# NODE_OPTIONS / npm_config_* (a .npmrc node-options preload could rewrite any
# exit code, JOURNAL J-045). The docs sensor runs the tools directly, not
# through docs-site/package.json scripts.
#
# No cache in a gate run: a forged .tsbuildinfo or ESLint cache served a green
# verdict on red code (JOURNAL J-046). The PostToolUse hook keeps its own
# incremental cache: it is feedback, not a gate.
#
# Exit codes of a sensor: 0 green, 3 abstained, anything else red.
# ---------------------------------------------------------------------------

# shellcheck disable=SC2034  # consumed by scripts/check.sh
# shellcheck disable=SC2016  # $RANGES / $ESLINT_CACHE expand in the sensor shell, not here
MIVRO_SENSORS='
typecheck|fast|0|TypeScript (tsc --noEmit)|npx --no-install tsc --noEmit
lint|fast|0|ESLint, zero warning, root config only|npx --no-install eslint . --no-eslintrc -c .eslintrc.js --ext .ts,.tsx,.js,.jsx,.mjs,.cjs --max-warnings 0
format|fast|0|Prettier, root config only|npx --no-install prettier --config .prettierrc.js --no-editorconfig --check --loglevel warn "**/*.{ts,tsx,js,jsx,json,md}"
arch|fast|0|Layer boundaries (dependency-cruiser)|npx --no-install depcruise src --config .dependency-cruiser.js
diff|fast|0|Banned patterns in the diff (check-diff)|for r in $RANGES; do bash scripts/check-diff.sh "$r" || exit 1; done
lock|fast|0|Harness lock (scripts/harness.lock)|bash scripts/harness-lock.sh
native|fast|0|Native identity (team, bundle id, scheme)|python3 scripts/check-native.py
deps|fast|0|Dependency allowlist|node scripts/check-deps.js
docrefs|fast|0|Failure-journal references|bash scripts/check-doc-refs.sh
scripts|fast|1|Harness scripts (shellcheck + Python syntax)|bash scripts/check-scripts.sh
tests|check|0|Jest + coverage thresholds|npx --no-install jest --ci --coverage --silent
audit|push|1|npm audit, runtime deps, high and above, named exceptions|bash scripts/check-audit.sh
docs|push|1|Documentation build (TypeDoc + Docusaurus)|[ -d docs-site/node_modules ] || { echo "docs-site dependencies missing: npm --prefix docs-site ci"; exit 3; }; npx --no-install typedoc --options typedoc.config.mjs >/dev/null && (cd docs-site && npx --no-install docusaurus build >/dev/null)
'
