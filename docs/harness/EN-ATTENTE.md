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

### 1. Sonde réseau du self-test : un contrôle positif (14e revue, mineur)

La sonde J-054 (`curl https://api.github.com`, section sandbox) passe au vert sur **tout** échec de
`curl`. Hors ligne, ou avec un DNS en panne, elle conclut donc « refusé » sans rien prouver. C'est
la leçon de J-053 : un contrôle doit distinguer une sonde qui marche d'une préparation cassée. Dans
`scripts/harness-selftest.sh`, juste avant la sonde :

```bash
  # Positive control: the network itself works, so a failure below is the deny list (J-054).
  if ! curl -s -o /dev/null --max-time 5 https://registry.npmjs.org/-/ping 2>/dev/null; then
    bad "network probe control failed: registry.npmjs.org unreachable, the GitHub probe proves nothing"
  elif curl -s -o /dev/null --max-time 5 https://api.github.com 2>/dev/null; then
```

(la branche `bad "the sandbox lets a call out to api.github.com (J-054)"` et le `else ok …` restent
inchangés). `registry.npmjs.org` répond 200 sous sandbox (constaté le 2026-10-08).

### 2. Isoler chaque Python du harness, et résoudre une destination « dossier » (revue du lot 1 de J-055)

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

**b. La garde Bash juge ce qu'une copie dépose dans un dossier.** Passent aujourd'hui la garde
(exit 0, rejoué par les revues) :

- `cp src/subprocess.py .` et `mv src/subprocess.py ./` (basename dans le dossier) ;
- `cp -R "$TMPDIR/scripts" .` (fusion d'un dossier nommé comme un dossier du harness) ;
- `cp -R "$TMPDIR/s/." .` (contenu d'un dossier, nom de base `.`).

Alors que `cp src/a.txt subprocess.py`, `cp -t scripts/hooks …`, `rsync` et `tar` sont refusés.
Quand la dernière cible d'un `cp`/`mv`/`ln`/`install` est un dossier existant (ou finit par `/`), il
faut juger ce que la copie y dépose : `<dossier>/<basename>` pour un fichier. Pour une copie
récursive, la source est inconnue au moment du jugement, donc le refus est systématique si la
destination est la racine ou un dossier qui contient du harness. Cas au self-test :
`guard BLOCK "cp src/x.py ."`, `guard BLOCK "mv src/x.sh scripts/"`,
`guard BLOCK 'cp -R "$TMPDIR/scripts" .'`, `guard BLOCK 'cp -R "$TMPDIR/s/." .'`,
`guard ALLOW "cp src/a.ts src/b/"`.
