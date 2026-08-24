#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# harness-selftest.sh — proves every sensor still fires.
#
# Each sensor is exercised with a DELIBERATE violation and then cleaned up.
# A sensor that silently stops detecting is worse than no sensor at all, so
# this runs the negative cases, not just the happy path.
#
#   npm run check:harness
#
# Exit 0 = every sensor behaved as expected.
#
# NB: fixture strings (banned patterns, native artefact paths) are assembled at
# runtime rather than written literally, so this file does not trip the very
# sensors it tests when it is itself edited or committed.
# ---------------------------------------------------------------------------
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

PASS=0
FAIL=0
PROBES=()

cleanup() {
  local probe
  for probe in "${PROBES[@]:-}"; do
    [ -n "$probe" ] && rm -f "$probe"
  done
}
trap cleanup EXIT INT TERM

ok() { PASS=$((PASS + 1)); printf '  \033[32m/\033[0m %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf '  \033[31mX\033[0m %s\n' "$1"; }
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

probe_file() {
  local path="$1"
  shift
  PROBES+=("$path")
  printf '%s\n' "$@" >"$path"
}

# ---------------------------------------------------------------------------
section "1. PreToolUse guard - destructive shell commands"

guard() {
  local expect="$1" cmd="$2" code got
  python3 -c 'import json,sys; json.dump({"tool_name":"Bash","tool_input":{"command":sys.argv[1]}}, sys.stdout)' "$cmd" |
    ./scripts/hooks/pre-bash-guard.py >/dev/null 2>&1
  code=$?
  got="ALLOW"
  [ "$code" -eq 2 ] && got="BLOCK"
  if [ "$got" = "$expect" ]; then ok "$expect  $cmd"; else bad "expected $expect, got $got: $cmd"; fi
}

guard BLOCK 'rm -rf node_modules'
guard BLOCK 'rm -fr build'
guard BLOCK 'rm -r -f build'
guard BLOCK 'rm --recursive --force build'
guard BLOCK 'sudo rm -rf /'
guard BLOCK 'ls && rm -rf dist'
guard BLOCK 'git push --force'
guard BLOCK 'git push -f origin main'
guard BLOCK 'git push --force-with-lease origin main'
guard BLOCK 'git reset --hard HEAD~1'
guard BLOCK 'git -C . reset --hard'
guard BLOCK 'git --git-dir=.git reset --hard'
guard BLOCK 'npm run pods'
guard BLOCK 'npm run clear'
guard BLOCK 'npm run android-clean'
guard ALLOW 'rm src/tmp.ts'
guard ALLOW 'rm -f src/tmp.ts'
guard ALLOW 'grep -rf pattern src/'
guard ALLOW 'git push origin main'
guard ALLOW 'git push -u origin feature'
guard ALLOW 'git reset HEAD~1'
guard ALLOW 'git -C . status'
guard ALLOW 'npm run check'
guard ALLOW 'npm test'
guard ALLOW 'echo "the words rm -rf inside a quoted string"'

# Native-artefact veto. The paths are concatenated at runtime, otherwise this
# very file would be unwritable through a Bash heredoc.
IOS_PODS="i""os/P""ods"
ANDROID_BUILD="andr""oid/bu""ild"
ANDROID_APP_BUILD="andr""oid/app/bu""ild"
ANDROID_CXX="andr""oid/app/.c""xx"
guard BLOCK "ls $IOS_PODS"
guard BLOCK "cat $IOS_PODS/Manifest.lock"
guard BLOCK "ls $ANDROID_BUILD"
guard BLOCK "ls $ANDROID_APP_BUILD"
guard BLOCK "ls $ANDROID_CXX"
guard ALLOW 'ls ios/'
guard ALLOW 'ls android/app/src/main'

# Contournements multi-lignes (JOURNAL J-018). shlex traite un retour à la ligne
# comme un simple espace : une commande destructrice posée sur une ligne suivante
# était lue comme un argument, donc jamais inspectée.
# Multi-line bypasses: a newline is plain whitespace to shlex, so a destructive
# command on a later line used to be read as a mere argument.
RM_RF="rm"" -rf"
RESET_HARD="git"" reset --hard"
PUSH_FORCE="git"" push --force"
NL='
'
guard BLOCK "python3 - <<'PY'${NL}print(\"l'encre\")${NL}PY${NL}${RM_RF} node_modules"
guard BLOCK "cat > f.txt <<'EOF'${NL}c'est un test${NL}EOF${NL}${RESET_HARD} HEAD~1"
guard BLOCK "echo ok${NL}${PUSH_FORCE} origin main"
guard ALLOW "python3 -c \"print('ok')\""
guard ALLOW "echo \"c'est bon\" && npm run check"
guard ALLOW "cat > f.md <<'EOF'${NL}Une doc multi-lignes${NL}sans rien de destructeur${NL}EOF"
guard ALLOW "npm run docs && npm run check"

# ---------------------------------------------------------------------------
section "2. check-diff - banned escape hatches in added code"

if bash scripts/check-diff.sh >/dev/null 2>&1; then
  ok "clean working tree passes"
else
  bad "clean working tree should pass but check-diff failed"
fi

# Fixtures for the nine banned patterns, assembled so they never appear
# literally in this file.
AS_ANY="as"" ""any"
COLON_ANY=":"" ""any"
ANGLE_ANY="<""any"">"
TS_IGNORE="@ts""-ignore"
TS_NOCHECK="@ts""-nocheck"
ESLINT_OFF="eslint""-disable"
DOT_SKIP=".""skip"
X_IT="x""it"
X_DESCRIBE="x""describe"

BANNED_PROBE="src/__harness_selftest_probe.ts"
probe_file "$BANNED_PROBE" \
  "const a = JSON.parse('{}') $AS_ANY;" \
  "const b$COLON_ANY = 1;" \
  "const c = ${ANGLE_ANY}2;" \
  "// $TS_IGNORE" \
  "// $TS_NOCHECK" \
  "/* $ESLINT_OFF no-console */" \
  "describe${DOT_SKIP}('x', () => {});" \
  "$X_IT('y', () => {});" \
  "$X_DESCRIBE('z', () => {});" \
  "const fine = 'as anyone knows: anything goes';"

HITS="$(bash scripts/check-diff.sh 2>&1 | grep -c "^  $BANNED_PROBE" || true)"
if [ "$HITS" -eq 9 ]; then
  ok "all 9 banned patterns detected in an untracked file"
else
  bad "expected 9 detections in an untracked file, got $HITS"
fi
if bash scripts/check-diff.sh >/dev/null 2>&1; then
  bad "check-diff should exit non-zero when a banned pattern is present"
else
  ok "non-zero exit on violation"
fi
rm -f "$BANNED_PROBE"

# Large-diff regression. A SIGPIPE + pipefail guard once made check-diff blind
# to every large diff, so assert range mode still sees a violation across one.
BLOB="$(printf 'export const bad = JSON.parse("{}") %s;\n' "$AS_ANY" | git hash-object -w --stdin)"
TREE="$(printf '100644 blob %s\tprobe.ts\n' "$BLOB" | git mktree)"
SYNTH="$(git commit-tree "$TREE" -p HEAD -m 'harness selftest probe')"
if bash scripts/check-diff.sh "HEAD...$SYNTH" >/dev/null 2>&1; then
  bad "range mode missed a violation across a large diff"
else
  ok "range mode catches a violation across a large diff"
fi
if bash scripts/check-diff.sh 'HEAD~1...HEAD' >/dev/null 2>&1; then
  ok "range mode passes on the last (clean) commit"
else
  bad "range mode wrongly flags the last commit"
fi

# ---------------------------------------------------------------------------
section "3. check:arch - dependency-cruiser layer boundaries"

arch() {
  local rule="$1" path="$2" out
  shift 2
  probe_file "$path" "$@"
  # Capture first, then substring-match with `case`. Piping into `grep -q` would
  # make grep exit early, kill depcruise with SIGPIPE and - under `pipefail` -
  # report failure for every rule, silently turning this whole section green-blind.
  out="$(npx --no-install depcruise src --config .dependency-cruiser.js 2>&1)"
  case "$out" in
    *"error $rule:"*) ok "$rule fires" ;;
    *) bad "$rule did NOT fire (probe: $path)" ;;
  esac
  rm -f "$path"
}

arch domain-no-ui src/services/domain/midpoint/__probe.ts \
  "import { Platform } from 'react-native';" "export const p = Platform.OS;"
arch domain-no-infra src/services/domain/midpoint/__probe.ts \
  "import { NominatimGeocodeService } from '@services/infra/geocode/NominatimGeocodeService';" \
  "export const p = NominatimGeocodeService;"
arch domain-no-app-layers src/services/domain/midpoint/__probe.ts \
  "import { useSessionStore } from '@state/useSessionStore';" "export const p = useSessionStore;"
arch screens-no-adapter src/features/POI/screens/POIScreen/__probe.ts \
  "import { container } from '@services/serviceContainer';" "export const p = container;"
arch screens-no-network-client src/features/POI/screens/POIScreen/__probe.ts \
  "import database from '@react-native-firebase/database';" "export const p = database;"
arch ui-no-adapter src/state/__probe.ts \
  "import { MMKVStorageService } from '@services/infra/storage/MMKVStorageService';" \
  "export const p = MMKVStorageService;"
arch components-no-features src/components/molecules/EmptyState/__probe.ts \
  "import { POI_GENERIC_ICON } from '@features/POI/utils/poiIcons';" "export const p = POI_GENERIC_ICON;"
arch atoms-no-upper src/components/atoms/Text/__probe.ts \
  "import EmptyState from '@components/molecules/EmptyState';" "export const p = EmptyState;"
arch entities-no-ui-package src/entities/__probe.ts \
  "import { StyleSheet } from 'react-native';" "export const p = StyleSheet;"
arch utils-pure src/services/utils/geo/__probe.ts \
  "import { CalculateMidpointUseCase } from '@services/domain/midpoint/CalculateMidpointUseCase';" \
  "export const p = CalculateMidpointUseCase;"
arch no-cross-feature-private-import src/features/Session/screens/MapScreen/__probe.ts \
  "import { POIScreen } from '@features/POI/screens/POIScreen/POIScreen';" "export const p = POIScreen;"
# A feature's components are private too, not just its screens.
arch no-cross-feature-private-import src/features/Session/screens/MapScreen/__probe.ts \
  "import POICard from '@features/POI/components/POICard';" "export const p = POICard;"
arch feature-components-presentational src/features/POI/components/POICard/__probe.ts \
  "import { container } from '@services/serviceContainer';" "export const p = container;"

if npx --no-install depcruise src --config .dependency-cruiser.js >/dev/null 2>&1; then
  ok "production code is clean once the probes are removed"
else
  bad "check:arch is red on the real codebase"
fi

# ---------------------------------------------------------------------------
section "4. PostToolUse hook - typecheck + lint on the edited file"

run_hook() {
  python3 -c 'import json,sys; json.dump({"tool_name":"Edit","tool_input":{"file_path":sys.argv[1]}}, sys.stdout)' "$1" |
    CLAUDE_PROJECT_DIR="$PWD" ./scripts/hooks/post-edit-check.sh >/dev/null 2>&1
}

if run_hook src/theme/tokens.ts; then
  ok "silent success on a healthy file"
else
  bad "hook failed on a healthy file"
fi

HOOK_PROBE="src/services/utils/geo/__probe.ts"

probe_file "$HOOK_PROBE" "export const bad: number = 'not a number';"
if run_hook "$HOOK_PROBE"; then
  bad "hook missed a type error"
else
  ok "type error blocks the edit"
fi
rm -f "$HOOK_PROBE"

probe_file "$HOOK_PROBE" "export const bad = JSON.parse('{}') $AS_ANY;"
if run_hook "$HOOK_PROBE"; then
  bad "hook missed an eslint error"
else
  ok "eslint error blocks the edit"
fi
rm -f "$HOOK_PROBE"

# The hook also cruises the edited module, so a boundary violation is caught at
# edit time instead of waiting for pre-push.
ARCH_PROBE="src/services/domain/midpoint/__probe.ts"
probe_file "$ARCH_PROBE" "import { Platform } from 'react-native';" "export const p = Platform.OS;"
if run_hook "$ARCH_PROBE"; then
  bad "hook missed a layer boundary violation"
else
  ok "layer boundary violation blocks the edit"
fi
rm -f "$ARCH_PROBE"

# An auto-fixable problem must be repaired silently, not reported.
probe_file "$HOOK_PROBE" \
  "import { LocationSchema } from '@entities/Location';" \
  "import { z } from 'zod';" \
  "export const probe = { LocationSchema, z };"
HOOK_OK=1
run_hook "$HOOK_PROBE" || HOOK_OK=0
FIRST_LINE="$(head -1 "$HOOK_PROBE")"
case "$FIRST_LINE" in
  *zod*) ;;
  *) HOOK_OK=0 ;;
esac
if [ "$HOOK_OK" -eq 1 ]; then
  ok "auto-fixable import order is fixed silently"
else
  bad "eslint --fix did not repair the import order"
fi
rm -f "$HOOK_PROBE"

# ---------------------------------------------------------------------------
section "5. docs - TypeDoc + Docusaurus (DOC-004)"

if [ ! -d docs-site/node_modules ]; then
  bad "docs-site dependencies missing - run: npm --prefix docs-site install"
else
  # A dangling reference must fail the build, otherwise DOC-004 is decorative.
  # NB: the probe must NOT start with '_': Docusaurus silently excludes those,
  # which made an earlier probe look like a passing sensor.
  DOC_PROBE="docs-site/docs/adr/probe-harness.md"
  probe_file "$DOC_PROBE" \
    '---' \
    'title: Sonde harness' \
    '---' \
    '' \
    '# Sonde' \
    '' \
    'Lien mort : [ADR inexistant](./ADR-999-nexiste-pas.md)'
  if npm run --silent docs >/dev/null 2>&1; then
    bad "a broken documentation link does NOT fail the build"
  else
    ok "a broken documentation link fails the build"
  fi
  rm -f "$DOC_PROBE"
fi

# ---------------------------------------------------------------------------
printf '\n\033[1m%d passed, %d failed\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
