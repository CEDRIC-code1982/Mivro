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
points 2 et 3 ci-dessous.

## Pour Cédric seul

### 1. `npm audit fix` en branche dédiée (J-040)

1 vulnérabilité critique et 7 hautes, toutes corrigibles sans `--force`. Le lockfile de l'app
bouge : rebuild natif et test sur appareil. À faire avant la protection de branche.

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
