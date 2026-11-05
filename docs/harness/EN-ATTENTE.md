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
l'ont été le 2026-10-05 aussi. L'ancien point 1 (J-040, lots 1 et 1 bis) est fait le 2026-10-08. Les
anciens points 3 (sandbox Bash, J-051), 4 et 5 (J-052, première CI) ont été appliqués le 2026-10-08
en session déverrouillée, avec trois correctifs que le sandbox a imposés au harness (`mktemp` et
`/dev/fd`, voir J-051). Cédric a posé la clé utilisateur `allowUnsandboxedCommands: false` le
2026-10-08. Les anciens points 6 (J-053 : le self-test n'écrit plus l'historique) et 7 (J-054 :
GitHub refusé au réseau du sandbox, quatre routes du trousseau refusées) ont été appliqués le
2026-10-08 en session déverrouillée. Le jeton fine-grained `mivro-claude` est dans `GH_TOKEN`, sans
_Administration_ (permissions relevées le 2026-10-28). GitHub reste refusé au sandbox (J-057).

**Depuis le 2026-10-12 : mode chantier (J-055).** Cédric a ouvert une session déverrouillée pour
finir le harness. L'agent y applique lui-même les entrées ci-dessous, avec une revue et un commit
local par lot. Le relock final et le push restent à Cédric.

## À appliquer en session déverrouillée

L'ancien §1 (contrôle positif de la sonde réseau) est appliqué au lot 2 du chantier, le
2026-10-12.

L'ancien §4 (quatre trous de la garde Bash) est appliqué au lot A de la finition, le 2026-11-02,
avec les trous voisins trouvés en sondant (J-058).

L'ancien §2 (isoler chaque Python du harness) est appliqué : le (b) au lot 4 du chantier, le
2026-10-15 ; le (a) au lot B de la finition, le 2026-11-05. `harness_paths` est chargé par chemin
partout (gardes, health check, workflow `harness-guard`, self-test), et `check-scripts` refuse un
import par nom ou un changement de `sys.path` dans le code du harness.

### 3. En session déverrouillée, les écrivains indirects vers `scripts/hooks/` (revue du lot 4)

En session déverrouillée, `tar -xf … -C scripts/`, `unzip … -d scripts/hooks`, `curl -o scripts/hooks/x.py`,
`patch`, `git apply` et un interpréteur qui ouvre un module en écriture passent la garde Bash : ces
chemins sont conditionnés par `self.protect`. Ce ne sont pas des voies d'édition accidentelles, et en
session déverrouillée l'agent a de toute façon le droit de modifier le harness. Le filet de J-056
vise les accidents, et l'Edit simulé reste la voie normale. À traiter si l'on veut un filet
complet : appliquer `_hooks_module` à leurs cibles et dossiers d'extraction, et refuser `patch` et
`git apply` aux cibles inconnues. Cas au self-test : un `guard_unlocked BLOCK` par écrivain.

### 5. Garde Bash : trois limites connues laissées par le lot A (J-058, septième revue)

Elles existaient déjà avant le lot A. Cédric a décidé, après la sixième revue, de ne plus en
modéliser de nouvelles dans ce lot. Dans les trois cas, bash et zsh exécutent la commande et la
garde l'accepte :

- **`\` suivi d'un blanc en fin de ligne** (`echo hi \ ` ⏎ `git clean -fdx`) : tester
  `ends_with_escape` sur la ligne physique avant d'en retirer les blancs de fin, ou ne retirer que
  les blancs de tête.
- **Une `)` entre quotes dans un `$(`** (`echo $(echo ")"; git clean -fdx)`) :
  `extract_substitutions` doit suivre les quotes dans son comptage de profondeur, ou refuser une
  `(`/`)` entre quotes dans une substitution.
- **Un `#` après un blanc échappé** (`echo x\ #"`) : `strip_comments` doit vérifier que le
  caractère précédent n'est pas lui-même échappé.

Chaque correctif entre au self-test par `shell_diff`, avec la forme citée.
