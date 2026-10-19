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
2026-10-08 en session déverrouillée. Il reste à Cédric le jeton GitHub à privilèges réduits, hors du
dépôt (TODO).

**Depuis le 2026-10-12 : mode chantier (J-055).** Cédric a ouvert une session déverrouillée pour
finir le harness. L'agent y applique lui-même les entrées ci-dessous, avec une revue et un commit
local par lot. Le relock final et le push restent à Cédric.

## À appliquer en session déverrouillée

L'ancien §1 (contrôle positif de la sonde réseau) est appliqué au lot 2 du chantier, le
2026-10-12.

### 2. Isoler chaque Python du harness (revue du lot 1 de J-055) — le (a) reste à faire

**a. Ne plus jamais trouver `harness_paths` par son nom.** Les trois revues du lot 1 ont trouvé
quatre façons de faire mentir un Python du harness qui fait `import harness_paths` :

- un module posé à la racine (`python3 -c` y met le dossier courant) ;
- un module posé dans `scripts/hooks/` (`sys.path.insert(0, …)` le place avant la stdlib) ;
- un `.pyc` forgé dans `scripts/hooks/__pycache__/` (`-I` ignore l'export `PYTHONPYCACHEPREFIX`) ;
- un paquet `scripts/hooks/harness_paths/` (ou une extension `.so`), qui passe avant le `.py` dans
  la recherche de modules.

Le lot 1 sort la sonde du verrou de ce jeu : elle refait la règle de déverrouillage en shell pur, et
ne charge plus rien de `scripts/hooks/`. Mais les deux gardes font encore
`sys.path.insert(0, scripts/hooks)` puis `import harness_paths`. Un paquet `harness_paths/` posé là
remplacerait donc aussi leur module. Correctif :

- charger `harness_paths` par chemin explicite, partout
  (`importlib.util.spec_from_file_location("harness_paths", <chemin absolu>)`, puis
  `module_from_spec` et `exec_module`), avec le triplet `-I -B -X pycache_prefix=…` ;
- règle dans `scripts/check-scripts.sh` : un `import harness_paths` ou un `sys.path.insert(0,` dans
  le harness rougit le capteur `scripts` ;
- cas au self-test : un paquet `scripts/hooks/harness_paths/` posé, et la garde refuse toujours
  `echo x > scripts/check.sh`.

**b.** Appliqué au lot 4 du chantier (2026-10-15) : la garde Bash juge ce qu'une copie, un
déplacement ou un lien dépose dans un dossier, refuse `mkfifo`/`mknod` sur un chemin protégé, et,
en session déverrouillée, l'écriture Bash par fichier d'un module des gardes (`git restore`
excepté). Voir le §3 pour les écrivains indirects.

### 3. En session déverrouillée, les écrivains indirects vers `scripts/hooks/` (revue du lot 4)

En session déverrouillée, `tar -xf … -C scripts/`, `unzip … -d scripts/hooks`, `curl -o scripts/hooks/x.py`,
`patch`, `git apply` et un interpréteur qui ouvre un module en écriture passent la garde Bash : ces
chemins sont conditionnés par `self.protect`. Ce ne sont pas des voies d'édition accidentelles, et en
session déverrouillée l'agent a de toute façon le droit de modifier le harness. Le filet de J-056
vise les accidents, et l'Edit simulé reste la voie normale. À traiter si l'on veut un filet
complet : appliquer `_hooks_module` à leurs cibles et dossiers d'extraction, et refuser `patch` et
`git apply` aux cibles inconnues. Cas au self-test : un `guard_unlocked BLOCK` par écrivain.

### 4. Quatre trous de la garde Bash, antérieurs au chantier (cinquième, onzième et dernière revues du lot 4)

**a. Le dossier courant après un sous-shell.** `(cd /tmp); cp /tmp/x .babelrc` passe : la garde
garde `/tmp` comme dossier courant après le `)`, alors que le shell revient au dépôt. La copie
écrit donc `<dépôt>/.babelrc`. Correctif : sauvegarder `self.cwd` à chaque `(` et le restaurer au
`)` correspondant, dans la boucle de `_check_line`. À défaut, passer le dossier à inconnu après un
`)`. Cas au self-test : `guard BLOCK '(cd /tmp); cp /tmp/x .babelrc'`, plus un contrôle `ALLOW`
avec une cible produit.

**b. Un `$` au milieu d'un nom de commande.** `bash -c '(rm${IFS}scripts/check.sh)'` passe, parce
que `${IFS}` découpe le mot à l'exécution. La garde ne juge comme variable qu'un nom de commande qui
commence par `$`. Correctif : refuser tout nom de commande qui contient `$` ou le marqueur de
substitution, quelle que soit sa position. Cas au self-test : la commande ci-dessus en
`guard BLOCK`.

**c. Les qualificateurs zsh qui exécutent du code.** En zsh, `*(e:'cmd':)` exécute `cmd` pour
chaque fichier qui correspond, et `*(+fonction)` appelle une fonction. Le lot 4 a posé un filet :
`deny_code_qualifier`, appliqué par `deny_argument_qualifiers` à tout groupe qui n'ouvre pas une
commande, ainsi qu'aux `=(…)` collés et aux ouvreurs échappés dans `extract_substitutions`. Mais
de la septième à la onzième revue, chaque revue a trouvé une nouvelle position d'où le qualificateur
échappe au filet. Ce n'est donc pas une garantie, et le trou existait déjà à `8fd98f1`. Deux
pistes :

- un seul lecteur de quotes et d'échappements, partagé par `extract_substitutions`,
  `fold_glob_groups` et `deny_argument_qualifiers` ;
- un exécutable de sonde dédié, approuvé par Cédric, qui lit ses cas depuis un fichier. La garde
  refuse en effet toute sonde Bash qui contient `e:`, si bien que ni les revues ni l'agent ne
  peuvent vérifier zsh sur ces formes.

Cas au self-test : rejouer chaque ouvreur et chaque point d'arrêt du repli (`*`, quote, nom, `=`,
`)`, `\;`, `\$`, `\<`) suivi d'un qualificateur `e:`, en `guard BLOCK`.

**d. Une commande formée par l'expansion des accolades.** `{rm,-rf,node_modules}` passe : le shell
la développe en `rm -rf node_modules`, mais la garde lit un seul mot, sans nom de commande connu.
`8fd98f1` l'acceptait aussi. Correctif : refuser un nom de commande qui contient `{` suivi d'une
`,` hors quotes. Cas au self-test : la commande ci-dessus en `guard BLOCK`.
