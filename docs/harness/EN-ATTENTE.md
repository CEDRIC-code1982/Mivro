# EN ATTENTE — changements du harness à appliquer en session déverrouillée

> Le harness protège ses propres fichiers (ADR-016). Quand l'agent trouve un défaut dans l'un
> d'eux, il ne le corrige pas : il le décrit ici, avec le changement exact. Cédric l'applique
> depuis une session `MIVRO_HARNESS_UNLOCK=1 claude`, puis lance `npm run harness:relock`.
> Une entrée appliquée est supprimée de ce fichier dans le même commit.

---

**Historique.** Les constats de l'audit (J-026 à J-035) et des deux revues (J-036 à J-042) ont
tous été appliqués : le 2026-09-28, puis le 2026-10-01 en session déverrouillée. Le détail est dans
`JOURNAL-ECHECS.md`. Les capteurs de J-043 à J-046 sont appliqués aussi ; le self-test de J-046 et le formatage
de `check-deps.js` ont été posés par Cédric le 2026-10-05, avec le premier verrou. Restent les
points 1 à 4 ci-dessous.

## Pour Cédric seul

### 1. J-040, lot 1 : mises à jour de sécurité dans les plages déclarées

Décision du 2026-10-05 : le lot 1 tout de suite, le lot 3 en avis acceptés (point 4), pas de lot 2
(il ne retire que des avis modérés). Seul le lockfile bouge, ce qui a été vérifié sur une copie.
Le lot corrige le critique `shell-quote` et 12 autres paquets. Dans ton terminal, hors Claude Code :

```bash
cd ~/Developer/Personnel/Mivro
git switch develop && git pull --ff-only
git switch -c fix/j-040-npm-audit
npm update shell-quote ws undici js-yaml nanoid brace-expansion joi qs \
  body-parser browserslist protobufjs launch-editor baseline-browser-mapping
git diff --stat            # seul package-lock.json doit apparaître
npx tsc --noEmit && npx jest --ci --silent
npm run ios && npm run android   # rebuild natif, puis test sur appareil
git commit -am "fix(deps): J-040 lot 1, mises à jour de sécurité dans les plages déclarées"
git push -u origin fix/j-040-npm-audit
gh pr create --base develop --fill
```

Après le merge dans `develop`, rebase `harness/beton` sur `develop`, puis `npm run harness:relock`,
car le lockfile fait partie du verrou.

## À appliquer en session déverrouillée

Ce changement du harness est prêt mais pas appliqué. En session déverrouillée, le classifieur du
mode auto de Claude Code refuse à l'agent toute écriture dans ses propres contrôles. Passe en mode
par défaut pour approuver l'édition toi-même, puis dis « applique EN-ATTENTE » : l'agent la pose,
relance le self-test et retire l'entrée.

### 2. Garde Bash : `prettier --config <fichier> --write` est refusé à tort

`npx prettier --config .prettierrc.js --write docs/x.md` est bloqué (« prettier rewriting a
harness file ») : `positional(args)` compte la valeur de `--config` comme une cible, et
`.prettierrc.js` est du harness. Prettier lit ce fichier, il ne l'écrit pas.

Changement dans `scripts/hooks/pre-bash-guard.py`, branche `elif name in {"prettier", "eslint"}:`
(ligne 619) : juger comme cibles les seuls mots qui ne sont pas la valeur d'une option.

```python
# Options whose value is read, never rewritten (--config, --ignore-path...).
REWRITER_VALUE_OPTIONS = {"--config", "-c", "--ignore-path", "--rulesdir", "--plugin", "--ext",
                          "--resolve-plugins-relative-to", "--cache-location", "--parser",
                          "--loglevel", "--log-level"}


def rewrite_targets(args: list[str]) -> list[str]:
    targets, skip = [], False
    for arg in args:
        if skip:
            skip = False
        elif arg in REWRITER_VALUE_OPTIONS:
            skip = True
        elif not arg.startswith("-"):
            targets.append(arg)
    return targets
```

puis `any(self.protected(a) for a in rewrite_targets(args))` à la place de `positional(args)`.
Aucune perte : un fichier du harness passé en position reste refusé. Cas à ajouter au self-test :

```bash
guard ALLOW 'npx prettier --config .prettierrc.js --write docs/x.md'
guard BLOCK 'npx prettier --config .prettierrc.js --write .eslintrc.js'
guard BLOCK 'npx eslint -c .eslintrc.js --fix scripts/check-deps.js'
```

### 3. Casse du chemin absolu : racine du dépôt et `$HOME` (J-047)

J-046 compare sans casse le chemin **relatif**, pas la base dont on le tire. Rejoué le 2026-10-05
(exit 0 = écriture autorisée) :

- Edit de `~/.Claude/settings.json` ou de `~/.GITCONFIG` : 0 (la forme exacte sort en 2) ;
- Edit de `/Users/cpineau/Developer/Personnel/MIVRO/scripts/check.sh` : 0 ;
- `echo x >> ~/.Claude/settings.json` dans la garde Bash : 0.

Changement dans `scripts/hooks/harness_paths.py` : une seule fonction de « chemin relatif sous une
base », sans casse, qui rend le chemin **dans sa casse d'origine**.

```python
def rel_under(absolute: str, base: str) -> str | None:
    """`absolute` relative to `base`, compared without case (APFS), or None
    when it lies outside. The returned path keeps the case it was given."""
    a, b = absolute.casefold().rstrip("/"), base.casefold().rstrip("/")
    if a == b:
        return ""
    if not a.startswith(b + "/"):
        return None
    return absolute[len(base.rstrip("/")) + 1:]
```

puis :

- `home_secret` : `rel = rel_under(absolute, home)` ; `rel is not None and rel.casefold() in
{p.casefold() for p in HOME_SECRETS}` ;
- `home_protected` : même chose avec `HOME_PROTECTED`, et `rel.casefold()` pour
  `HOME_TRANSCRIPTS_DIR` et le suffixe `.jsonl` ;
- `to_rel` : `rel = rel_under(absolute, root)` à la place de `os.path.relpath`, `None` si hors dépôt ;
- `_same_repo_worktree_rel` : `rel_under(absolute, os.path.realpath(top))`, et
  `common.casefold() != mine.casefold()` pour comparer les deux répertoires git.

Cas à ajouter au self-test (le premier pose `REPO_UPPER="$(printf '%s' "$REPO" | tr '[:lower:]'
'[:upper:]')"`) :

```bash
edit_guard 2 "$REPO_UPPER/scripts/check.sh"
edit_guard 2 "$HOME/.Claude/settings.json"
edit_guard 2 "$HOME/.claude/Settings.json"
edit_guard 2 "$HOME/.GITCONFIG"
edit_guard 2 "$HOME/.Claude/projects/x/y.jsonl"
guard BLOCK "echo x >> $HOME/.Claude/settings.json"
guard BLOCK "echo x > $REPO_UPPER/scripts/check.sh"
guard BLOCK "cat $HOME/.CONFIG/gh/hosts.yml"
```

En même temps : compléter la liste « Checked » de la docstring de `scripts/check-native.py` (gradle
racine, `applicationIdSuffix`, `productFlavors`, `CFBundleIdentifier`).

### 4. Capteur `audit` : avis acceptés par identifiant GHSA (J-040, lot 3)

Les hautes restantes sur React Native 0.85 remontent de **4 avis**, dont aucun n'a de correctif sur
cette ligne. `braces` n'a aucune version corrigée, `image-size` est épinglé par metro 0.84, et
`@grpc/grpc-js` est épinglé par le SDK JS Firestore, que Mivro n'importe pas. Le capteur les
accepte **nommément**. Il reste rouge pour tout autre avis, pour un avis dont l'acceptation a expiré
(le 2027-01-05, à redécider) et pour une entrée sans justification. Tout a été vérifié sur des
copies, en 7 cas : rouge sur l'arbre actuel, vert après le lot 1, rouge si la liste est périmée,
incomplète ou mal justifiée, abstention hors ligne, rouge sur une réponse illisible.

Les trois fichiers sont des fichiers du harness. Ils sont aussi sauvegardés dans
`~/Developer/Personnel/Mivro-backups/EN-ATTENTE-J-040/scripts/`.

**`scripts/check-audit.sh`** (remplace l'actuel) :

```bash
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

HARNESS="$(cd "$(dirname "$0")" && pwd)"
ROOT="${MIVRO_AUDIT_ROOT:-$(git rev-parse --show-toplevel)}"
cd "$ROOT" || exit 1

OUT="$(npm audit --omit=dev --json 2>/dev/null)"
printf '%s' "$OUT" | python3 "$HARNESS/check-audit-verdict.py" "$HARNESS/audit-accepted.json"
```

**`scripts/check-audit-verdict.py`** (nouveau) :

```python
#!/usr/bin/env python3
"""check-audit-verdict.py — judge `npm audit --json` (stdin) against the accepted list.

Called by scripts/check-audit.sh; see its header for the policy (JOURNAL J-040).
Exit 0 = nothing unaccepted, 1 = finding, 3 = registry unreachable.
"""

from __future__ import annotations

import datetime
import json
import re
import sys

NETWORK_MARKERS = ("ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "network request")
GHSA_RE = re.compile(r"^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$")
MIN_REASON = 40

raw = sys.stdin.read()
try:
    report = json.loads(raw)
except ValueError:
    report = None
if not isinstance(report, dict) or "error" in report:
    text = raw if report is None else json.dumps(report.get("error"))
    if any(marker in text for marker in NETWORK_MARKERS):
        print("npm registry unreachable")
        sys.exit(3)
    print("✖ npm audit gave no usable report:")
    print(text[:2000])
    sys.exit(1)

findings: list[str] = []
today = datetime.date.today()

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        accepted = json.load(handle)
except (OSError, ValueError) as error:
    print(f"✖ scripts/audit-accepted.json unreadable: {error}")
    sys.exit(1)
if not isinstance(accepted, dict):
    print("✖ scripts/audit-accepted.json must be an object keyed by GHSA id")
    sys.exit(1)

valid: dict[str, datetime.date] = {}
for gid, entry in accepted.items():
    if gid.startswith("_"):
        continue  # "_comment" and similar keys
    if not GHSA_RE.match(gid) or not isinstance(entry, dict):
        findings.append(f"accepted list: {gid!r} is not a GHSA id with an object value")
        continue
    reason = entry.get("reason", "")
    if not isinstance(entry.get("package"), str) or not isinstance(reason, str) or len(reason) < MIN_REASON:
        findings.append(f"accepted list: {gid} needs a package and a reason of {MIN_REASON}+ characters")
        continue
    try:
        expires = datetime.date.fromisoformat(entry.get("expires", ""))
    except (TypeError, ValueError):
        findings.append(f"accepted list: {gid} needs an ISO expiry date (YYYY-MM-DD)")
        continue
    valid[gid] = expires

reported: dict[str, str] = {}
for name, vuln in report.get("vulnerabilities", {}).items():
    for via in vuln.get("via", []):
        # String entries only point at another vulnerable package: the root
        # advisory is listed (as a dict) under that package itself.
        if not isinstance(via, dict) or via.get("severity") not in ("high", "critical"):
            continue
        gid = str(via.get("url", "")).rsplit("/", 1)[-1]
        reported[gid] = f"{via.get('severity')} {via.get('name', name)}: {str(via.get('title', ''))[:90]}"

accepted_now = []
for gid, label in sorted(reported.items()):
    if gid not in valid:
        findings.append(f"{gid} {label}")
    elif valid[gid] < today:
        findings.append(f"{gid} accepted until {valid[gid]}, expired: decide again ({label})")
    else:
        accepted_now.append(f"{gid} until {valid[gid]}")

for gid in sorted(set(valid) - set(reported)):
    print(f"  stale: {gid} is accepted but no longer reported; remove it at the next harness session")
if accepted_now:
    print(f"  accepted ({len(accepted_now)}): " + ", ".join(accepted_now))

if findings:
    print("✖ Unaccepted runtime advisories (high and above):")
    for finding in findings:
        print(f"  - {finding}")
    print()
    print("Fix: `npm audit fix` (never --force) in a dedicated branch, then a native rebuild.")
    print("No fix on this React Native line: Cedric decides whether to accept it by GHSA id in")
    print("scripts/audit-accepted.json (reason + expiry), or to upgrade (JOURNAL J-040).")
    sys.exit(1)
sys.exit(0)
```

**`scripts/audit-accepted.json`** (nouveau) :

```json
{
  "_comment": "Runtime advisories accepted by name (JOURNAL J-040). Cedric's decision; harness file. Each one: why it cannot reach the shipped app, and an expiry date after which it must be decided again.",
  "GHSA-vfj7-8cjw-p6xm": {
    "package": "braces",
    "reason": "No fixed release exists (3.0.3 is the latest and is vulnerable). Pulled by metro and jest through micromatch: it expands glob patterns written in our own build and test configuration, never user input, and is not part of the app bundle.",
    "expires": "2027-01-05"
  },
  "GHSA-5p2g-fcmc-qvqq": {
    "package": "image-size",
    "reason": "Pinned to 1.x by metro 0.84 (React Native 0.85); fixed only in 2.0.3+. Metro reads the dimensions of our own assets at bundle time on the developer machine; the parser never runs in the app.",
    "expires": "2027-01-05"
  },
  "GHSA-w3rx-r6r6-pgpr": {
    "package": "image-size",
    "reason": "Same package and path as GHSA-5p2g-fcmc-qvqq: metro bundle-time parsing of our own assets, never in the app.",
    "expires": "2027-01-05"
  },
  "GHSA-m9gg-hp2v-232j": {
    "package": "@grpc/grpc-js",
    "reason": "Pinned to 1.9.x by @firebase/firestore inside the firebase JS SDK that @react-native-firebase lists for non-native platforms. Node-only gRPC transport; Mivro uses the native SDKs and Realtime Database only, no Firestore import in src/ (checked 2026-10-05).",
    "expires": "2027-01-05"
  }
}
```

**CI, `.github/workflows/check.yml`, job `security`** : le même capteur qu'au pre-push. Exit 3
(abstention) fait échouer le step, comme le veut la CI.

```yaml
- name: npm audit (runtime dependencies, high and above, named exceptions)
  run: bash scripts/check-audit.sh # npm audit reads the lockfile only, no install needed
```

**`scripts/sensors.sh`**, libellé de la ligne `audit` : `npm audit, runtime deps, high and above,
named exceptions`.

**Self-test**, hors ligne : il nourrit le juge avec des rapports fabriqués.

```bash
AUDIT_DIR="$(tmp_dir)"
printf '{"GHSA-2222-3333-4444":{"package":"x","reason":"%s","expires":"2099-01-01"}}' \
  "accepted in the self-test, never reaches the app bundle" >"$AUDIT_DIR/ok.json"
sed 's/2099-01-01/2000-01-01/' "$AUDIT_DIR/ok.json" >"$AUDIT_DIR/expired.json"
AUDIT_REPORT='{"vulnerabilities":{"x":{"via":[{"url":"https://github.com/advisories/GHSA-2222-3333-4444","severity":"high","name":"x","title":"t"}]}}}'
printf '%s' "$AUDIT_REPORT" | python3 scripts/check-audit-verdict.py "$AUDIT_DIR/ok.json" >/dev/null
expect_exit 0 $? "an accepted, unexpired advisory passes (J-040)"
printf '%s' "$AUDIT_REPORT" | python3 scripts/check-audit-verdict.py "$AUDIT_DIR/expired.json" >/dev/null
expect_exit 1 $? "an expired acceptance is red (J-040)"
printf '%s' "${AUDIT_REPORT//2222/5555}" | python3 scripts/check-audit-verdict.py "$AUDIT_DIR/ok.json" >/dev/null
expect_exit 1 $? "an advisory not on the accepted list is red (J-040)"
printf '{"error":{"code":"ENOTFOUND"}}' | python3 scripts/check-audit-verdict.py "$AUDIT_DIR/ok.json" >/dev/null
expect_exit 3 $? "an unreachable registry abstains (J-040)"
```
