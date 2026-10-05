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
session déverrouillée. Reste le point 1.

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

### 2. Self-test : compter un appel mort avec un trap `ERR`, sur toute version de Bash (J-051)

Le correctif J-048 comptait l'échec dans `command_not_found_handle`. Or, à partir de Bash 4, ce
handler tourne dans un environnement d'exécution séparé (manuel Bash, §3.7.2) : le
`FAIL=$((FAIL + 1))` y est perdu. Sur la CI (Bash 5), un appel mort affichait donc un X rouge,
mais le bilan restait « 0 failed ». Le repli `trap ERR` n'était posé que sous Bash 3.2.

Dans `scripts/harness-selftest.sh`, remplacer le bloc `command_not_found_handle` + `if
((BASH_VERSINFO[0] < 4))` par :

```bash
# A case that calls an undefined helper must fail, not vanish (JOURNAL J-048).
# An ERR trap, not command_not_found_handle: from Bash 4 on, that handler runs
# in a separate execution environment, so a FAIL counted there is lost (J-051).
# The trap runs in the shell that saw the 127, on every Bash version; -E
# (errtrace) makes functions inherit it, so a dead call inside a helper counts.
set -E
trap 'SELFTEST_RC=$? SELFTEST_LINE=$LINENO; ((SELFTEST_RC == 127)) && bad "exit 127 at line ${SELFTEST_LINE}: command not found?"' ERR
```

`$LINENO` et non `$BASH_COMMAND` : sous Bash 3.2, `$BASH_COMMAND` dans le trap affiche la commande
du trap lui-même.

Preuve, sur des copies du self-test, avec `/bin/bash` 3.2.57 :

| Cas                                                           | Résultat               |
| ------------------------------------------------------------- | ---------------------- |
| A. copie corrigée, cas inchangés                              | 393 passed, 0 failed   |
| B. appel mort au niveau supérieur                             | 393 passed, 1 failed   |
| C. appel mort dans une fonction (couvert grâce à `set -E`)    | 393 passed, 1 failed   |
| D. échec compté dans un sous-shell (perdu, comme sous Bash 5) | 393 passed, 1 failed ¹ |
| E. self-test actuel, appel mort, Bash 3.2 (pour comparaison)  | 393 passed, 1 failed   |

¹ L'échec du sous-shell est perdu, et seul celui du shell parent est compté. C'est ce qui se
passe sous Bash 5 avec `command_not_found_handle`, et le trap, lui, compte dans le shell parent.
Le cas A prouve qu'aucun cas existant ne sort en 127 (pas de faux positif).

NON VÉRIFIÉ sous Bash 5 : il n'y en a pas sur ce poste (ni Homebrew, ni Docker). La première CI le
prouvera. Pour cela, ajouter au job `battery` un pas qui lance une copie du self-test avec un appel
mort et exige `1 failed`. C'est le méta-cas demandé par la 9e revue :

```yaml
- name: self-test counts a dead call (J-051)
  run: |
    sed '/^section() {/a\
    undefined_helper_ci_probe' scripts/harness-selftest.sh > /tmp/st-dead.sh
    bash /tmp/st-dead.sh | grep -q ' 1 failed'
```

Limite connue : un trap `ERR` ne se déclenche pas dans une condition (`if f; then`, `f || x`,
`f && x`). Le self-test appelle ses helpers en instruction simple, suivie de `expect_exit … $?`.

### 3. Lecture des secrets : le sandbox de Claude Code, pas une liste noire de plus (J-051)

La 9e revue a rejoué cinq contournements de la garde de lecture de J-049 (exit 0) :
`cat < ~/.config/gh/hosts.yml`, `cat ~/.config/gh/*`, `cat ~/.ss*/id_rsa`,
`H=~/.ssh; cat $H/id_rsa`, `grep -r token ~/.config/gh`. L'outil Grep n'est rattaché à aucun hook.
L'agent en a trouvé deux autres, vers le jeton lui-même : `gh auth status --show-token` et
`security find-generic-password -s gh:github.com -w` (exit 0). Sur ce poste, le jeton `gh` est dans
le trousseau macOS (`gh auth status` : `keyring`), donc `hosts.yml` ne le contient pas. Les clés de
`~/.ssh/`, elles, sont bien sur le disque.

Une garde qui lit le texte d'une commande ne fermera jamais la lecture : `python3 -c`, `node -e`,
`find -exec`, une concaténation de chaînes y échappent (J-042, J-045). La fermeture documentée par
Anthropic est le **sandbox Bash** de Claude Code. Il est imposé par l'OS (Seatbelt sur macOS) à
tout sous-processus, et les règles `Read` s'appliquent aussi aux outils Read, Grep et Glob.

Sources : https://code.claude.com/docs/en/sandboxing.md, https://code.claude.com/docs/en/permissions.md.

**Décision de Cédric, à prendre avant d'appliquer** : le sandbox change l'environnement de toutes
les commandes Bash de l'agent. Le réseau est limité aux domaines autorisés, et `git` en SSH ne
passe pas dans le sandbox : il faut l'exclure ou passer en HTTPS. Ce qu'il faut tester, c'est
`npm audit` (registre npm), `npx jest`, `npx tsc`, la doc et le self-test.

1. `.claude/settings.json` (projet) :

   ```json
   "sandbox": {
     "enabled": true,
     "failIfUnavailable": true,
     "filesystem": { "denyRead": ["~/.ssh", "~/.config/gh"] },
     "network": { "allowedDomains": ["registry.npmjs.org"] }
   },
   ```

   et, dans `permissions.deny` : `"Read(~/.ssh/**)"`, `"Read(~/.config/gh/**)"`.

2. `~/.claude/settings.json` (utilisateur, toi seul) : `"sandbox": { "allowUnsandboxedCommands":
false }`. C'est la seule clé qui empêche l'agent de relancer une commande hors sandbox
   (`dangerouslyDisableSandbox`). La doc précise qu'un projet ne peut pas la poser, et qu'un `false`
   côté utilisateur l'emporte sur le projet.

3. Garde Bash, en complément (le trousseau n'est pas un fichier, donc le sandbox ne couvre
   peut-être pas `security`, point NON VÉRIFIÉ) : refuser `gh auth status` avec `--show-token`/`-t`,
   et `security find-generic-password` / `find-internet-password` avec `-w`/`-g`.

4. Self-test, à écrire une fois le sandbox actif : un `cat` d'un fichier témoin placé sous un
   répertoire refusé doit échouer. C'est un test réel de l'OS, pas une payload envoyée à la garde.

Ensuite, J-049 et J-051 passent RÉSOLU. D'ici là, J-049 repasse OUVERT : sa fermeture déclarée
était fausse.

### 4. Juge `audit` : un rapport `[]` donne une trace Python (J-051, mineur)

`scripts/check-audit-verdict.py`, ligne `text = raw if report is None else json.dumps(report.get("error"))` →
`text = raw if not isinstance(report, dict) else json.dumps(report.get("error"))`. L'exit était déjà
1 (rouge), seul le message change. Cas : `printf '[]' | python3 scripts/check-audit-verdict.py
"$AUDIT_DIR/ok.json"` → `expect_exit 1`.
