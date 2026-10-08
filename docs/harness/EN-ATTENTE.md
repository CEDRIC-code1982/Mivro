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
en session déverrouillée. Les points 5 à 8 (J-048 à J-050) l'ont été le 2026-10-05 aussi, en
session déverrouillée. Les points 2 et 4 (J-051 : trap `ERR` du self-test, juge `audit` sur `[]`)
l'ont été le 2026-10-05 aussi. Le point 1 (J-040, lots 1 et 1 bis) est fait le 2026-10-08. Les points 3 (sandbox Bash, J-051)
et 4 et 5 (J-052, première CI) ont été appliqués le 2026-10-08 en session déverrouillée, avec trois
correctifs que le sandbox a imposés au harness (`mktemp` et `/dev/fd`, voir J-051). Il reste à Cédric
la clé utilisateur `allowUnsandboxedCommands: false` (ancien point 3, étape 2), hors du dépôt.

## À appliquer en session déverrouillée

Ces changements du harness sont prêts mais pas appliqués. En session déverrouillée, le classifieur du
mode auto de Claude Code refuse à l'agent toute écriture dans ses propres contrôles. Passe en mode
par défaut pour approuver les éditions toi-même, puis dis « applique EN-ATTENTE §N » : l'agent les
pose, relance le self-test et retire les entrées.

Voir les §6 et §7 ci-dessous.

### 6. Le self-test ne doit jamais écrire dans l'historique du dépôt (J-053)

Le 2026-10-08, la session déverrouillée a lancé deux fois le self-test. Ces deux runs ont laissé deux
commits vides « init », d'auteur `selftest <selftest@mivro>`, **sur `harness/en-attente-5-8`**.
L'agent les a retirés (`git reset --soft c850f23`, avant tout push).

La cause est dans `scratch_repo` : `git -C "$dir" commit`. Si `$dir` est vide, `git -C ""` vise le
répertoire courant, donc le vrai dépôt. Si `git init` a échoué dans `$dir`, git remonte
l'arborescence et trouve un dépôt parent. Les deux cas ont été reproduits sur un faux dépôt
« extérieur » du scratchpad : un commit y atterrit à chaque fois. Les appelants (`SCRATCH=`,
`REVIEW_REPO=`) ne vérifient rien non plus. La ligne 518 fait d'ailleurs `cd "$SCRATCH" && git add …
&& git commit` : avec `SCRATCH` vide, `cd ""` reste dans le dépôt.

Dans `scripts/harness-selftest.sh` :

```bash
scratch_repo() {
  local dir
  dir="$(tmp_dir)"
  # Never let git fall back to the repository above: an empty or broken $dir made
  # `git -C "$dir" commit` commit into Mivro itself (JOURNAL J-053).
  if [ -z "$dir" ] || [ ! -d "$dir" ] || ! git -C "$dir" init -q 2>/dev/null ||
    [ "$(cd "$dir" && pwd -P)" != "$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)" ]; then
    echo "✖ cannot create a scratch repository under ${TMPDIR:-/tmp}" >&2
    return 1
  fi
  git --git-dir="$dir/.git" --work-tree="$dir" -c user.email=selftest@mivro -c user.name=selftest \
    commit -q --allow-empty -m init || return 1
  printf '%s' "$dir"
}
```

Les appelants : `SCRATCH="$(scratch_repo)" || exit 2`, et de même pour `REVIEW_REPO`.

Un invariant général, pour que toute régression future soit vue. Au début du self-test :
`SELFTEST_HEAD="$(git rev-parse HEAD)"` et `SELFTEST_REFS="$(git for-each-ref --format='%(objectname) %(refname)' refs/heads)"`.
Dans `cleanup()`, en dernier :

```bash
if [ "$(git rev-parse HEAD)" != "$SELFTEST_HEAD" ] ||
  [ "$(git for-each-ref --format='%(objectname) %(refname)' refs/heads)" != "$SELFTEST_REFS" ]; then
  printf '\033[31m✖ the self-test changed the repository history (JOURNAL J-053)\033[0m\n' >&2
  exit 1
fi
```

Vérifié sur le faux dépôt : l'ancien code commite dans le dépôt extérieur dans les deux cas (`tmp_dir`
vide, `git init` refusé). Le nouveau code rend 1 dans les deux cas, sans commit, et fonctionne
normalement sinon.

En plus, dans la même passe (13e revue, mineurs) :

- `tmp_dir` est appelé dans `$(…)`, donc `TMP_DIRS+=` se perd dans le sous-shell. `cleanup()` ne
  supprime rien, et chaque run laisse ses répertoires `mivro.*` dans `$TMPDIR`. Il faut enregistrer
  chaque répertoire dans un fichier (`printf '%s\n' "$dir" >>"$SELFTEST_TMP_LIST"`), que `cleanup()`
  relit.
- Le cas du `.pyc` forgé (section 10) ne prouve que `-I`. Il faut une seconde forge, posée dans le
  `__pycache__/` voisin du source, sans préfixe : seul `-X pycache_prefix` la neutralise.

### 7. Le trousseau : refuser les quatre routes connues, et couper GitHub au réseau (J-054)

La garde du trousseau ajoutée au §3 refuse `gh auth token`, `gh auth status --show-token` et
`security find-*-password -w/-g`. La 13e revue a trouvé quatre autres routes vers le **même** jeton
GitHub, que l'agent a rejouées sur le hook (payload seule, rien d'exécuté, exit 0 pour chacune) :

- `printf 'find-generic-password -w -s gh:github.com\n' | security -i` (mode interactif) ;
- `gh auth git-credential get` ;
- `printf 'protocol=https\nhost=github.com\n\n' | git credential fill` ;
- `git credential-osxkeychain get` (`credential.helper osxkeychain` est configuré en global).

Le réseau ne protège pas derrière. Depuis le sandbox, `api.github.com` et `github.com` répondent 200
(constaté le 2026-10-08), alors que `example.com` est refusé, et `.claude/settings.json` n'autorise
que `registry.npmjs.org`. L'origine de cette autorisation n'est pas établie : défaut du sandbox, ou
approbation donnée en session. Un jeton lu par l'une de ces routes peut donc partir dans un `curl`
vers l'API GitHub.

**Ce qui ferme vraiment, à décider par Cédric :**

1. **Refuser GitHub au réseau du sandbox.** Dans `.claude/settings.json`, ajouter
   `"deniedDomains": ["github.com", "api.github.com", "*.github.com", "*.githubusercontent.com"]`
   sous `sandbox.network`. Vérifier ensuite dans `/sandbox` qu'aucune approbation de session ne
   l'emporte. L'agent ne pousse et ne merge déjà plus, puisque `gh` et SSH ne passent pas : on ne
   perd rien.
2. **Un jeton à privilèges réduits pour les sessions Claude.** C'est l'entrée « token fine-grained
   sans Administration » de la TODO : un jeton qui fuit ne peut alors ni changer la protection de
   branche ni merger.

**En complément, la garde textuelle**, incomplète par nature car tout binaire peut interroger le
trousseau. Dans `scripts/hooks/pre-bash-guard.py`, refuser :

- `security` avec `-i` ou `-p` (mode interactif ou invite) ;
- `gh auth git-credential` ;
- `git credential fill|approve|reject` et toute commande `git credential-*`.

Cas au self-test :

```bash
guard BLOCK "printf 'find-generic-password -w -s gh:github.com\n' | security -i"
guard BLOCK 'gh auth git-credential get'
guard BLOCK "printf 'protocol=https\nhost=github.com\n\n' | git credential fill"
guard BLOCK 'git credential-osxkeychain get'
guard ALLOW 'gh pr view 3'
```

Et une sonde réseau sous `SANDBOX_RUNTIME=1` : `curl --max-time 5 https://api.github.com` doit
échouer (rouge si 200). C'est le test de l'effet, pas de l'orthographe de la config.
