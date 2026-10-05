# EN ATTENTE — changements du harness à appliquer en session déverrouillée

> Le harness protège ses propres fichiers (ADR-016). Quand l'agent trouve un défaut dans l'un
> d'eux, il ne le corrige pas : il le décrit ici, avec le changement exact. Cédric l'applique
> depuis une session `MIVRO_HARNESS_UNLOCK=1 claude`, puis lance `npm run harness:relock`.
> Une entrée appliquée est supprimée de ce fichier dans le même commit.

---

**Historique.** Les constats de l'audit (J-026 à J-035) et des deux revues (J-036 à J-042) ont
tous été appliqués : le 2026-09-28, puis le 2026-10-01 en session déverrouillée. Le détail est dans
`JOURNAL-ECHECS.md`. Les capteurs de J-043 à J-046 sont appliqués aussi ; le self-test de J-046 et le formatage
de `check-deps.js` ont été posés par Cédric le 2026-10-05, avec le premier verrou. Les points 2 à 4
(garde `prettier --config`, J-047, capteur `audit` à avis acceptés) ont été appliqués le 2026-10-05
en session déverrouillée. Restent le point 1 et les points 5 et 6, nés de cette session.

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

Ces changements du harness sont prêts mais pas appliqués. En session déverrouillée, le classifieur du
mode auto de Claude Code refuse à l'agent toute écriture dans ses propres contrôles. Passe en mode
par défaut pour approuver les éditions toi-même, puis dis « applique EN-ATTENTE §N » : l'agent les
pose, relance le self-test et retire les entrées.

### 5. Self-test : un appel à une commande inconnue est un échec (J-048)

Dans `scripts/harness-selftest.sh`, juste après la définition de `bad()` :

```bash
# A case that calls an undefined helper must fail, not vanish (JOURNAL J-048).
command_not_found_handle() {
  bad "command not found in the self-test: $1"
  return 127
}
```

Preuve, à garder hors du self-test (sinon le cas serait lui-même un `bad`) : copier le self-test,
appeler `edit_guard` avant sa définition, et vérifier que le total passe à `1 failed`.

### 6. Jeton GitHub : `home_secret` branchée, et sans casse (J-049)

- `scripts/hooks/pre-bash-guard.py`, ligne `if any("gh/hosts.yml" in w for w in args):` →
  `if any("gh/hosts.yml" in w.casefold() or harness_paths.home_secret(harness_paths.resolve(w, cwd)) for w in args):`
  (`cwd` étant celui du payload, comme ailleurs dans la classe).
- `scripts/hooks/pre-edit-guard.py`, en tête de `main()` après la lecture de `path` : si
  `payload.get("tool_name") == "Read"`, refuser si et seulement si
  `harness_paths.home_secret(harness_paths.resolve(path, cwd))`, et sinon `return 0`. Le Read d'un
  fichier du harness reste autorisé.
- `.claude/settings.json` : ajouter `Read` au matcher `Write|Edit|MultiEdit|NotebookEdit` de
  `pre-edit-guard.py`.

Cas à ajouter au self-test (le helper `edit_guard` envoie `Edit`, il faut une variante `Read`) :

```bash
guard BLOCK "cat $HOME/.config/GH/hosts.yml"
read_guard 2 "$HOME/.config/gh/hosts.yml"
read_guard 2 "$HOME/.CONFIG/gh/Hosts.yml"
read_guard 0 "$REPO/scripts/check.sh"
```

Vu par la 8e revue : `cat ~/.ssh/id_rsa` est autorisé aussi, parce que `~/.ssh/` n'est pas dans
`HOME_SECRETS`. Ajouter le répertoire `.ssh/` entier (préfixe, sans casse) aux secrets du `$HOME`,
avec les cas `read_guard 2 "$HOME/.ssh/id_rsa"` et `guard BLOCK "cat $HOME/.SSH/id_ed25519"`.

### 7. Garde Bash : options de Prettier et d'ESLint, par outil (J-050)

Le correctif du §2 mettait `-c` dans une liste commune aux deux outils. Or, pour Prettier, `-c` est
`--check`, un drapeau sans valeur : `npx prettier --write -c scripts/sensors.sh` n'était plus
refusé, et Prettier écrit quand même avec `--check`. Autre trou, plus ancien : ESLint
`-o`/`--output-file` et le `--cache-location` des deux outils **écrivent** dans le fichier donné,
même sans `--write` ni `--fix`. Ces deux trous ont été rejoués : exit 0 sur 6 formes. Le correctif
a été vérifié sur une copie de la garde, avec 16 cas : 10 BLOCK et 6 ALLOW, dont les commandes
des capteurs eux-mêmes.

`scripts/hooks/pre-bash-guard.py` :

```diff
@@ -312,22 +312,41 @@
     return [a for a in args if not a.startswith("-")]


-# Options whose value is read, never rewritten (--config, --ignore-path...).
-REWRITER_VALUE_OPTIONS = {"--config", "-c", "--ignore-path", "--rulesdir", "--plugin", "--ext",
-                          "--resolve-plugins-relative-to", "--cache-location", "--parser",
-                          "--loglevel", "--log-level"}
+# Per tool, the options whose value is only READ (--config, --ignore-path...).
+# Prettier's `-c` is `--check`, a flag: skipping the word after it hid the
+# target of `prettier --write -c <file>` (JOURNAL J-050).
+REWRITER_READ_OPTIONS = {
+    "prettier": {"--config", "--ignore-path", "--plugin", "--parser", "--loglevel", "--log-level"},
+    "eslint": {"--config", "-c", "--ignore-path", "--rulesdir", "--plugin", "--ext",
+               "--resolve-plugins-relative-to", "--parser", "-f", "--format"},
+}
+# Options whose value is WRITTEN, with or without --write/--fix: the ESLint
+# report and either tool's cache file (JOURNAL J-050).
+REWRITER_WRITE_OPTIONS = {"-o", "--output-file", "--cache-location"}


-def rewrite_targets(args: list[str]) -> list[str]:
-    targets, skip = [], False
-    for arg in args:
-        if skip:
-            skip = False
-        elif arg in REWRITER_VALUE_OPTIONS:
-            skip = True
+def rewrite_targets(args: list[str], name: str) -> tuple[list[str], list[str]]:
+    """(files rewritten under --write/--fix, files written whatever the flags)."""
+    read = REWRITER_READ_OPTIONS[name]
+    targets: list[str] = []
+    outputs: list[str] = []
+    i = 0
+    while i < len(args):
+        arg = args[i]
+        key, eq, value = arg.partition("=")
+        if key in REWRITER_WRITE_OPTIONS:
+            if eq:
+                outputs.append(value)
+            elif i + 1 < len(args):
+                outputs.append(args[i + 1])
+                i += 1
+        elif key in read:
+            if not eq:
+                i += 1
         elif not arg.startswith("-"):
             targets.append(arg)
-    return targets
+        i += 1
+    return targets, outputs


 def option_value(args: list[str], *names: str) -> str | None:
@@ -636,8 +655,9 @@
             deny("alias definition", "An alias hides the real command from this guard. Write it out.")
         elif name in {"prettier", "eslint"}:
             rewrites = {"--write", "--fix"} & long_flags(args) or ("w" in short_flags(args) and name == "prettier")
-            if rewrites and any(self.protected(a) for a in rewrite_targets(args)):
-                self.deny_tamper(f"{name} rewriting a harness file")
+            targets, outputs = rewrite_targets(args, name)
+            if any(self.protected(a) for a in outputs) or (rewrites and any(self.protected(a) for a in targets)):
+                self.deny_tamper(f"{name} writing a harness file")
         elif name in {"script", "expect", "unbuffer"}:
             if self.protect and any("harness-lock" in a or "harness:relock" in a for a in args):
                 self._deny_relock()
```

Cas à ajouter au self-test, à côté de ceux du §2 :

```bash
guard BLOCK 'npx prettier --write -c scripts/sensors.sh'
guard BLOCK 'npx prettier -w -c .eslintrc.js'
guard BLOCK 'npx prettier --config=.prettierrc.js --write .eslintrc.js'
guard BLOCK 'npx eslint src -o scripts/sensors.sh'
guard BLOCK 'npx eslint src --output-file=scripts/sensors.sh'
guard BLOCK 'npx eslint --cache --cache-location scripts/sensors.sh src'
guard BLOCK 'npx prettier --cache --cache-location scripts/sensors.sh --check src'
guard ALLOW 'npx prettier --write -c docs/x.md'
guard ALLOW 'npx eslint src -o /tmp/eslint-report.txt'
```

Dans le même passage, le cas `guard BLOCK "cat $HOME/.CONFIG/gh/hosts.yml"` (ligne 367) passe sous
le commentaire J-049 : il passait déjà avant J-047, grâce au test de sous-chaîne, et il ne prouve
donc pas `rel_under`.

### 8. Juge `audit` : un rapport qu'il ne reconnaît pas n'est jamais vert (J-050)

`{}`, `{"message": "..."}` ou un paquet `high` dont la chaîne `via` ne mène à aucun avis donnaient
exit 0. Le cas réaliste est un changement de format de npm, et le capteur passait alors au vert.
Le correctif exige `auditReportVersion: 2` et un objet `vulnerabilities`, puis remonte la chaîne
`via` de chaque paquet haut ou critique jusqu'à ses avis. Un paquet sévère sans avis traçable est
rouge. Vérifié sur une copie, en 11 cas : le vrai rapport (rouge sur l'arbre actuel, vert après le
lot 1), et des rapports fabriqués (vide, sans clé, non traçable, cycle, hors ligne, avis inconnu,
raison trop courte).

`scripts/check-audit-verdict.py` :

```diff
@@ -29,6 +29,11 @@
     print("✖ npm audit gave no usable report:")
     print(text[:2000])
     sys.exit(1)
+# Any other shape (an empty object, npm 6's `advisories`, a future report
+# version) must never read as "no vulnerability" (JOURNAL J-050).
+if report.get("auditReportVersion") != 2 or not isinstance(report.get("vulnerabilities"), dict):
+    print("✖ unrecognised npm audit report (expected auditReportVersion 2 with a `vulnerabilities` object)")
+    sys.exit(1)

 findings: list[str] = []
 today = datetime.date.today()
@@ -61,16 +66,45 @@
         continue
     valid[gid] = expires

-reported: dict[str, str] = {}
-for name, vuln in report.get("vulnerabilities", {}).items():
+SEVERE = ("high", "critical")
+vulnerabilities = report["vulnerabilities"]
+
+
+def root_advisories(name: str, seen: set[str]) -> dict[str, str]:
+    """High/critical advisories reached from `name` through its `via` chain.
+
+    A dict entry is an advisory; a string entry only points at another
+    vulnerable package, whose own advisories are listed under its name.
+    """
+    if name in seen:
+        return {}
+    seen.add(name)
+    found: dict[str, str] = {}
+    vuln = vulnerabilities.get(name)
+    if not isinstance(vuln, dict):
+        return found
     for via in vuln.get("via", []):
-        # String entries only point at another vulnerable package: the root
-        # advisory is listed (as a dict) under that package itself.
-        if not isinstance(via, dict) or via.get("severity") not in ("high", "critical"):
-            continue
-        gid = str(via.get("url", "")).rsplit("/", 1)[-1]
-        reported[gid] = f"{via.get('severity')} {via.get('name', name)}: {str(via.get('title', ''))[:90]}"
+        if isinstance(via, dict):
+            if via.get("severity") in SEVERE:
+                gid = str(via.get("url", "")).rsplit("/", 1)[-1]
+                title = str(via.get("title", ""))[:90]
+                found[gid] = f"{via.get('severity')} {via.get('name', name)}: {title}"
+        elif isinstance(via, str):
+            found.update(root_advisories(via, seen))
+    return found

+
+reported: dict[str, str] = {}
+for name, vuln in vulnerabilities.items():
+    if not isinstance(vuln, dict) or vuln.get("severity") not in SEVERE:
+        continue
+    roots = root_advisories(name, set())
+    if not roots:
+        # A severe package whose chain reaches no severe advisory: the report
+        # does not explain itself, so it cannot be judged green (JOURNAL J-050).
+        findings.append(f"{name}: {vuln.get('severity')} with no traceable advisory in the report")
+    reported.update(roots)
+
 accepted_now = []
 for gid, label in sorted(reported.items()):
     if gid not in valid:
```

Cas à ajouter au self-test, après les 4 cas `audit` existants. Les rapports fabriqués de ces
cas-là doivent aussi porter `"auditReportVersion":2`, sinon ils deviennent rouges.

```bash
printf '{}' | python3 scripts/check-audit-verdict.py "$AUDIT_DIR/ok.json" >/dev/null
expect_exit 1 $? "an unrecognised audit report is red (J-050)"
printf '' | python3 scripts/check-audit-verdict.py "$AUDIT_DIR/ok.json" >/dev/null
expect_exit 1 $? "an empty audit report is red (J-050)"
printf '{"auditReportVersion":2,"vulnerabilities":{"x":{"severity":"high","via":["y"]}}}' |
  python3 scripts/check-audit-verdict.py "$AUDIT_DIR/ok.json" >/dev/null
expect_exit 1 $? "a severe package with no traceable advisory is red (J-050)"
printf '{"GHSA-2222-3333-4444":{"package":"x","reason":"short","expires":"2099-01-01"}}' >"$AUDIT_DIR/short.json"
printf '%s' "$AUDIT_REPORT" | python3 scripts/check-audit-verdict.py "$AUDIT_DIR/short.json" >/dev/null
expect_exit 1 $? "an accepted entry without a real reason is red (J-050)"
```
