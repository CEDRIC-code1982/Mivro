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
l'ont été le 2026-10-05 aussi. Le point 1 (J-040, lots 1 et 1 bis) est fait le 2026-10-08. Reste le point 3 (décision de Cédric).

## À appliquer en session déverrouillée

Ces changements du harness sont prêts mais pas appliqués. En session déverrouillée, le classifieur du
mode auto de Claude Code refuse à l'agent toute écriture dans ses propres contrôles. Passe en mode
par défaut pour approuver les éditions toi-même, puis dis « applique EN-ATTENTE §N » : l'agent les
pose, relance le self-test et retire les entrées.

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
