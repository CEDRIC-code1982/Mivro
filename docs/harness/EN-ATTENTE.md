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

**2026-11-05 : finition close (lots A à E).** Toutes les entrées à appliquer l'ont été. Ce fichier
ne garde plus que les limites et faux positifs connus, assumés par décision de Cédric (§5 à §7) :
« fermer par refus » plutôt que modéliser, et nommer ce qui reste. Une limite qu'on décide de
fermer redevient une entrée à appliquer.

## Appliqué

L'ancien §1 (contrôle positif de la sonde réseau) est appliqué au lot 2 du chantier, le
2026-10-12.

L'ancien §4 (quatre trous de la garde Bash) est appliqué au lot A de la finition, le 2026-11-02,
avec les trous voisins trouvés en sondant (J-058).

L'ancien §2 (isoler chaque Python du harness) est appliqué : le (b) au lot 4 du chantier, le
2026-10-15 ; le (a) au lot B de la finition, le 2026-11-05. `harness_paths` est chargé par chemin
partout (gardes, health check, workflow `harness-guard`, self-test), et `check-scripts` refuse un
import par nom ou un changement de `sys.path` dans le code du harness.

L'ancien §3 (les écrivains indirects vers `scripts/hooks/` en session déverrouillée) est appliqué au
lot C de la finition, le 2026-11-05, avec les trous voisins trouvés en sondant (neuf points validés
par Cédric). Téléchargeurs, archiveurs (extraction et archive écrite), compresseurs, `patch`,
`git apply`, `git am` et code inline qui écrit sont jugés verrouillé comme déverrouillé ; une cible
connue seulement à l'exécution est refusée dans les deux modes. Faux positif hérité et laissé :
`tar -xOf` (vers stdout) reste refusé dans le repo.

Au lot E (2026-11-05), les écrivains de code inline nommés en limite au §6 sont fermés, avec leurs
variantes de syntaxe trouvées par la revue du lot E (J-063).

## Limites connues, assumées

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

### 6. Garde Bash : limites et faux positifs connus du lot C (revues du 2026-11-05)

**Limites** (la garde laisse passer). Toutes existaient avant le lot C, qui ne les aggrave pas :

- un nom assemblé par concaténation dans du code inline (`'ho' + 'oks'`) ;
- un interpréteur qui lance un fichier (`python3 /tmp/x.py`, `python3 - < /tmp/x.py`) : son contenu
  n'est pas lu ;
- un `~/.curlrc` ou un `~/.wgetrc` déjà présent, lu sans option ni variable ;
- les fichiers annexes que curl et wget écrivent sans option de sortie : `SSLKEYLOGFILE=… curl`, et
  `wget --hsts-file=…` en session déverrouillée ;
- `gtar --one-top-level=<dossier>` qui extrait ailleurs que dans le dossier courant.

Fermées au lot E (J-063), dans les formes que le self-test teste : mode `'r+'`, `fileinput` avec
`inplace=True`, `File.write`/`IO.write`, `File.new`, `io.FileIO`, `open` avec ou sans parenthèses
(Perl `open F, '>x'` et `open my $f, '>', 'x'`, Ruby `File.open 'x', 'w' do`),
`curl -w '%output{…}'`.

Restent ouvertes, même en session verrouillée (elles passaient déjà à `bcdfebd`) :

- un mode Perl collé au chemin **avec une espace** : `open(F, '> scripts/…')`, `'+> …'`, `'>> …'` ;
- un mode suivi d'un encodage : Ruby `File.open('scripts/…', 'w:UTF-8')`, `'wb:UTF-8'` ;
- `curl --expand-write-out '%output{…}'` (le préfixe `--expand-` de curl 8.3 et plus).

Limite de nature : `CODE_WRITE_RE` est une liste d'écrivains connus, pas une liste de ce qui est
permis. Un écrivain ou une syntaxe qu'elle ne nomme pas passe ; il se ferme en l'ajoutant, avec son
cas `guard BLOCK`.

Nouveaux faux positifs acceptés avec ces fermetures, dans du code inline qui cite un fichier du
harness : un littéral `'>'` ou `'+<'` après un `open` sur la même ligne (`if '>' in l` après
`open('scripts/…')`), et un littéral de mode (`'a'`, `'w'`, `'x'`, `'+'`…) placé après une virgule
dans l'instruction d'un `open`, d'un `new` ou d'un `FileIO` :
`node -e "const s=new Set(['x', 'a']); …readFileSync('scripts/check.sh')"` est refusé en session
verrouillée.

**Faux positifs acceptés** (refusés à tort, par prudence). Ce sont des ALLOW de HEAD (`6739939`)
devenus BLOCK avec le lot C, dans au moins un des deux modes :

- toute cible faite d'une variable, refusée dans les deux modes ; déjà refusée en session
  verrouillée à HEAD, elle ne l'est nouvellement qu'en session déverrouillée
  (`for f in a b; do echo x > "$f.txt"; done`, `npm test | tee "$LOG"`, `S=/abs; mkdir -p $S/x`) ;
- `git am --abort` et `git am --show-current-patch`, refusés avec tout `git am` : nouveau en
  session déverrouillée seulement, déjà refusés en verrouillée à HEAD ;
- `gzip -r src`, et tout compresseur récursif dans le repo, en session verrouillée : le harness
  est aussi sous `src/` (les autres outils récursifs, `cp -r` ou `zip -r` vers `/tmp`, sont
  inchangés) ;
- une valeur collée qui contient `r`, `m`, `p`, `x` ou `i` après `wget -O` ou `-o` (`-Ox.html`) :
  lue comme un téléchargement récursif, donc refusée dans le repo. De même, `wget -np` et `-nd`
  sont lus lettre à lettre (`-p`) : `wget -nd -np https://e.x/a.tgz` est refusé dans le repo ;
- du code inline qui lit un fichier du harness et cite plus loin, sur la même ligne, un littéral de
  mode (`, 'a'`, `, 'x'`) ;
- du code inline qui écrit, même vers `/tmp`, et contient un littéral `hooks` ou `harness_paths` :
  `python3 -c "import json; d={'hooks': {}}; open('/tmp/s.json','w').write(json.dumps(d))"` ;
- une variable d'environnement qui porte des options d'un compresseur, posée quelle que soit sa
  valeur et sa cible : `XZ_OPT=-T0 tar -cJf /tmp/x.txz src`, `GZIP=-9 tar -czf /tmp/x.tgz src`,
  `ZSTD_CLEVEL=19 zstd /tmp/x` (cette dernière ne prend qu'un nombre) ;
- une extraction qui garde les noms absolus ou les `../`, refusée partout, `/tmp` compris :
  `cpio -i` et `cpio -p`, `pax -r`, `tar -P`, `unzip -:`, `7z x -spf` ;
- le gabarit `#N` de curl dans un nom de sortie, refusé partout :
  `curl -o '/tmp/out_#1.html' 'https://e.x/page[1-3].html'`.

### 7. Chargement de `harness_paths` : limites laissées par le lot B (2026-11-05)

`check-scripts` refuse un import par nom et un changement du chemin de recherche dans le code du
harness, en lisant le texte. Il ne voit pas :

- un nom calculé à l'exécution (`import_module(var)`) ;
- `import_module (` avec un espace avant la parenthèse ;
- `os.environ['PYTHONPATH']` (seule la forme `PYTHONPATH=` est refusée).

Et le chargement de `harness_paths` au niveau module, hors du `try` de la garde, sort en 1 s'il
échoue : une erreur non bloquante pour Claude Code, au lieu du refus (exit 2) attendu.
