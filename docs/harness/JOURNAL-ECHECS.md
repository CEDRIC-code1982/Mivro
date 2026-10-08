# JOURNAL DES ÉCHECS

> **Une entrée = un échec observé = la règle, le hook ou le test ajouté en réponse.**
>
> Ce fichier est la mémoire du harness. Un défaut qui passe à travers les capteurs sans laisser
> d'entrée ici repassera : c'est le seul document qui transforme une erreur en garde-fou.
>
> Règles d'écriture :
>
> - On consigne ce qui a **réellement** échoué, pas ce qui pourrait échouer.
> - Chaque entrée nomme sa **réponse mécanique**. « Faire attention la prochaine fois » n'est pas
>   une réponse : si aucun outil ne peut l'attraper, l'entrée dit explicitement pourquoi et à quel
>   capteur inférentiel (reviewer) la charge revient.
> - On ne supprime pas une entrée. Une dette résolue est marquée `RÉSOLU` avec la date.

| #     | Sujet                                                               | Statut  |
| ----- | ------------------------------------------------------------------- | ------- |
| J-001 | Capteur d'archi aveugle : `includeOnly` masquait les npm            | RÉSOLU  |
| J-002 | `grep -q` + `pipefail` : check-diff aveugle aux gros diffs          | RÉSOLU  |
| J-003 | Même piège rejoué dans le self-test                                 | RÉSOLU  |
| J-004 | Substitution bash quadratique : check-diff bloqué >5 min            | RÉSOLU  |
| J-005 | Fichiers non suivis invisibles à check-diff                         | RÉSOLU  |
| J-006 | Règle LOG-001 : 9 faux positifs sur des logs corrects               | RÉSOLU  |
| J-007 | Préfixe de log `[container]` après renommage                        | RÉSOLU  |
| J-008 | `eslint-disable` mort, invisible jusqu'à la migration               | RÉSOLU  |
| J-009 | Commentaire de justification posé au mauvais endroit                | RÉSOLU  |
| J-010 | Scripts `test:unit` / `test:integration` morts                      | RÉSOLU  |
| J-011 | DOC-004 inapplicable : pas de Docusaurus ni TypeDoc                 | RÉSOLU  |
| J-012 | Thème : 15 paires échouent WCAG AA                                  | RÉSOLU  |
| J-013 | 46 `accessibilityHint` manquants                                    | OUVERT  |
| J-014 | Couplage `components/` → `features/` préexistant                    | RÉSOLU  |
| J-015 | TS-002 : 127 casts idiomatiques en tests                            | ARBITRÉ |
| J-016 | Imports de hooks entre features                                     | ARBITRÉ |
| J-017 | Véto natif : faux positif sur les heredocs                          | ACCEPTÉ |
| J-018 | Véto destructif contournable par une commande multi-lignes          | RÉSOLU  |
| J-019 | `npm run clear` de Docusaurus bloqué par homonymie                  | ACCEPTÉ |
| J-020 | Le cliquet de contraste a validé sa propre régression               | RÉSOLU  |
| J-021 | Deux rôles hors modèle : tuile de carte et état désactivé           | RÉSOLU  |
| J-022 | Le harness ne verifie aucune affirmation des docs                   | OUVERT  |
| J-023 | `check:diff` aveugle a tout le natif                                | RÉSOLU  |
| J-024 | Veto natif : bloque un fichier source (`.gradle`)                   | RÉSOLU  |
| J-025 | Test sans marge de temps, vert seulement au repos                   | RÉSOLU  |
| J-026 | check-diff aveugle à un arbre fait de fichiers non suivis           | RÉSOLU  |
| J-027 | Hook d'édition muet dans un worktree                                | RÉSOLU  |
| J-028 | Garde Bash contournable (opérateurs collés, indirection)            | RÉSOLU  |
| J-029 | Le harness pouvait se réécrire lui-même                             | RÉSOLU  |
| J-030 | Aucun contrôle côté serveur, push pré-approuvé                      | PARTIEL |
| J-031 | Échappatoires en un commentaire, justification vide                 | RÉSOLU  |
| J-032 | Warnings non bloquants, tests focalisés ou sautés                   | RÉSOLU  |
| J-033 | Pre-push sans tsc ni lint, sur la mauvaise plage                    | RÉSOLU  |
| J-034 | Aucun hook Stop, reviewer sur l'honneur                             | RÉSOLU  |
| J-035 | Angles morts : secrets, `.js`, imports dynamiques, deps             | RÉSOLU  |
| J-036 | `harness-guard` exécute le code de la PR qu'il juge                 | RÉSOLU  |
| J-037 | Un verdict APPROVED pré-déposé est scellé                           | RÉSOLU  |
| J-038 | Garde Bash : contournements restants sans script `/tmp`             | RÉSOLU  |
| J-039 | Config ESLint de sous-dossier : règles éteintes sans trace          | RÉSOLU  |
| J-040 | Job `security` rouge avant le premier run (`npm audit`)             | RÉSOLU  |
| J-041 | check-diff vert sur une base invalide                               | RÉSOLU  |
| J-042 | 2e revue : même famille de trous, en une ligne                      | RÉSOLU  |
| J-043 | 3e revue : package.json imbriqué, jest.setup, sceau                 | RÉSOLU  |
| J-044 | 4e revue : fichiers découverts seuls (`.babelrc`, `__mocks__`)      | RÉSOLU  |
| J-045 | 5e revue : le modèle est inversé (zones produit)                    | RÉSOLU  |
| J-046 | 6e revue : casse, fichiers ignorés, CLAUDE.md, Functions            | RÉSOLU  |
| J-047 | 7e revue : casse du chemin absolu (dépôt, `$HOME`)                  | RÉSOLU  |
| J-048 | Cas du self-test appelé avant la définition de sa fonction          | OUVERT  |
| J-049 | Jeton `gh` : `home_secret` jamais appelée, Read non gardé           | RÉSOLU  |
| J-050 | 8e revue : `-c` de Prettier, sorties d'ESLint, rapport `audit` vide | RÉSOLU  |
| J-051 | 9e revue : J-048 inopérant sous Bash 5, lecture des secrets         | OUVERT  |
| J-052 | 1re CI : identité git, `__pycache__`, cache de bytecode forgeable   | OUVERT  |
| J-053 | Le self-test a commité dans le vrai dépôt (`scratch_repo`)          | OUVERT  |
| J-054 | 13e revue : quatre routes vers le jeton par le trousseau            | OUVERT  |

---

## J-001 — Un capteur d'architecture vert alors qu'il était aveugle

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** `.dependency-cruiser.js` fraîchement écrit annonçait « no dependency violations ».
Une sonde volontaire (`import { Platform } from 'react-native'` dans `services/domain/`) n'a
**rien** déclenché, alors que la règle `domain-no-ui` était censée l'interdire. La règle
`domain-no-infra`, elle, mordait correctement.

**Cause.** `options.includeOnly: '^src/'` retirait les paquets npm du graphe. Toute règle dont la
cible était un paquet (`react-native`, `react`, `@react-native-firebase/*`) n'avait donc plus rien
à matcher. Second facteur : `to.path` de dependency-cruiser matche le chemin **résolu**
(`node_modules/react-native/index.js`), pas le specifier (`react-native`) — les motifs étaient de
toute façon faux.

**Pourquoi c'est le pire type de bug.** Un capteur cassé est plus dangereux qu'un capteur absent :
il produit un signal vert qui décourage de regarder.

**Réponse.**

- `includeOnly` supprimé ; les paquets restent des feuilles du graphe via `doNotFollow`.
- Tous les motifs de paquet réécrits en `^node_modules/<nom>/`.
- `no-circular` explicitement borné à `^src/`.
- **`scripts/harness-selftest.sh`** créé : chaque règle est prouvée par une violation volontaire
  puis nettoyée. `npm run check:harness` → 53 assertions. C'est la vraie réponse : un capteur non
  testé par une violation est présumé aveugle.

---

## J-002 — `printf | grep -q` sous `pipefail` : check-diff aveugle à tout gros diff

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** `scripts/check-diff.sh` sortait `0` sur un commit synthétique contenant pourtant
`as any` et `it.skip(`. La même logique awk, lancée isolément, détectait bien les 2 violations.

**Cause.** Le garde de court-circuit s'écrivait :

```sh
if ! printf '%s' "$DIFF" | grep -q '[^[:space:]]'; then exit 0; fi
```

`grep -q` sort dès la première correspondance et ferme le tube ; `printf` meurt alors en SIGPIPE
(141). Avec `set -o pipefail`, le statut du pipeline devient 141, donc non nul, donc `!` l'inverse
en vrai, donc « diff vide », donc `exit 0`. Le capteur se taisait **d'autant plus sûrement que le
diff était gros** — exactement l'inverse du comportement voulu.

**Réponse.**

- Garde remplacé par un simple `[ -z "$DIFF" ]`, sans tube.
- Cas de non-régression ajouté au self-test : une violation dans un diff de 146 fichiers doit être
  détectée en mode plage.
- Règle générale adoptée dans tout le harness : **jamais `| grep -q` dans une condition sous
  `pipefail`** → utiliser `case "$var" in *motif*)`.

---

## J-003 — Le même piège, rejoué dans le self-test lui-même

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** Premier lancement de `npm run check:harness` : **10 échecs**, les 10 règles
d'architecture annoncées « did NOT fire ». Lancées à la main, les mêmes sondes déclenchaient
toutes.

**Cause.** Identique à J-002, réintroduite dans le testeur :
`npx depcruise ... | grep -q "error $rule:"` en condition de `if`, sous `pipefail`.

**Leçon.** J'ai corrigé le bug dans `check-diff.sh` puis reproduit le même motif 20 minutes plus
tard. Une règle apprise mais pas mécanisée ne tient pas.

**Réponse.** Substring-matching par `case` dans le self-test, avec le commentaire expliquant le
piège au-dessus du code — c'est le seul endroit où le prochain lecteur en aura besoin. Même
correction appliquée préventivement à `scripts/hooks/post-edit-check.sh` (retry `tsbuildinfo`),
qui portait le même motif.

---

## J-004 — Substitution bash quadratique : check-diff bloqué plus de 5 minutes

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** `bash scripts/check-diff.sh 'HEAD~1...HEAD'` ne rendait jamais la main (>5 min de
timeout), alors que le `git diff` sous-jacent prend 50 ms pour 2 848 lignes.

**Cause.** `${DIFF//[[:space:]]/}` — une substitution de motif bash sur ~115 Ko. Le bash 3.2 livré
avec macOS y est quadratique.

**Réponse.** Substitution supprimée. Le commentaire au-dessus du garde nomme les **deux** pièges
écartés (celui-ci et J-002), pour qu'aucune des deux « optimisations » ne revienne.

---

## J-005 — Un fichier fraîchement écrit échappait à check-diff

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** Un fichier neuf contenant les 9 motifs interdits passait `check:diff` sans un mot.

**Cause.** `git diff HEAD` ne voit pas les fichiers non suivis. Or **le cas le plus fréquent pour
un agent, c'est justement créer un fichier neuf** : le capteur était donc aveugle précisément là
où il devait mordre.

**Réponse.** En mode arbre de travail, `check-diff.sh` synthétise un diff complet pour chaque
fichier non suivi (`git ls-files --others` + `git diff --no-index`). Exclu en mode plage : un
fichier non suivi n'est pas poussé. Cas couvert par le self-test (9 détections attendues).

---

## J-006 — La règle LOG-001 accusait 9 logs parfaitement corrects

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** `local-rules/log-format` signalait 9 appels dont le préfixe était pourtant conforme,
par exemple :

```ts
`[INFO][getEncryptionKey][${fnName}][?][${timestamp()}] Encryption key retrieved`;
```

**Cause.** La règle ne lisait que `quasis[0]` du template littéral. Dès que le nom de fonction est
interpolé — c'est-à-dire partout dans ce code — le texte statique s'arrêtait à
`[INFO][getEncryptionKey][` et la regex ne pouvait plus matcher.

**Réponse.** La règle raisonne maintenant sur la **forme** du template : tous les `quasis` joints
par un sentinelle `U+0001`, ce qui laisse chaque segment `[^\]]*` accepter une interpolation.
Suivi aussi le long des concaténations `+`.

**Leçon.** Une règle custom qui trouve beaucoup de violations dans du code réputé conforme est
suspecte **elle-même**. Vérifier la règle avant de « corriger » le code : j'ai failli patcher
9 fichiers sains.

---

## J-007 — Préfixe de log `[container]` resté après le renommage du fichier

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** `src/services/serviceContainer.ts` loggait
`[INFO][container][initContainer][?][...]`. Séquelle du refactor `de6b15c`
(`di/container.ts` → `services/serviceContainer.ts`) : le fichier a été renommé, le préfixe non.

**Réponse.** `local-rules/log-format` vérifie que le 2ᵉ segment égale le nom de fichier. Un
renommage sans mise à jour du log devient une erreur de lint, pas une divergence silencieuse.
Corrigé en `[serviceContainer]`.

---

## J-008 — Un `eslint-disable` mort, invisible jusqu'à la migration de règle

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** En basculant TS-003 de `@typescript-eslint/no-non-null-assertion` vers
`local-rules/no-unjustified-non-null`, `POIListView.test.tsx:119` a révélé un
`eslint-disable-next-line` devenu inutile.

**Réponse.** Le commentaire de suppression est remplacé par un **commentaire de justification en
français**, que la nouvelle règle accepte nativement. Bénéfice de fond : TS-003 s'exprime
désormais telle que CLAUDE.md l'énonce (« interdite **sauf commentaire justificatif** ») au lieu
d'une interdiction sèche contournée au cas par cas — et `check-diff` interdit le contournement.

---

## J-009 — Commentaire de justification inséré au mauvais endroit

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** En ajoutant les justifications TS-002 par script, le commentaire destiné à
`NominatimGeocodeService.ts:246` a atterri ligne 122 — un site **déjà** justifié — parce que
`lines.index(target)` retourne la première des deux lignes identiques.

**Réponse.** Aucune règle à ajouter : **le capteur a fait son travail**. La règle est restée rouge
sur le site réel, ce qui a rendu l'erreur immédiatement visible. Consigné parce que c'est la
démonstration du fonctionnement attendu : l'édition scriptée par motif est fragile dès qu'un motif
apparaît deux fois, et c'est le capteur, pas la relecture, qui l'attrape. Correction : localisation
par numéro de ligne.

---

## J-010 — Deux scripts npm morts depuis le refactor

**Date** : 2026-08-21 · **Statut** : RÉSOLU

**Observé.** `test:unit` et `test:integration` pointaient sur `src/__tests__/unit` et
`src/__tests__/integration`, supprimés par `de6b15c` (tests co-localisés). Les deux scripts
échouaient, et `CLAUDE.md` les documentait toujours.

**Réponse.** Réécrits pour l'arborescence réelle : `test:integration` cible
`*.integration.test.tsx`, `test:unit` prend le complément. Les deux sont listés dans le nouveau
`CLAUDE.md`, donc réellement exécutés.

---

## J-011 — DOC-004 est une règle morte : ni Docusaurus ni TypeDoc

**Date** : 2026-08-21 · **Statut** : RÉSOLU le 2026-08-24

**Observé.** `CLAUDE.md` imposait « `npm run docs` doit passer sans erreur » (DOC-004) et
documentait `docs`, `docs:dev`, `docs:build`. Aucun de ces scripts n'existe, `docs-site/` n'a pas
de `package.json`, TypeDoc n'est pas installé. `e2e/` est vide alors que six scénarios Maestro sont
listés.

**Pourquoi ça compte.** Une règle bloquante inexécutable apprend à l'agent que les règles de
`CLAUDE.md` sont facultatives — ce qui coûte plus cher que la règle elle-même.

**Réponse (2026-08-24).** Cédric a tranché : outiller. Docusaurus 3 dans `docs-site/` (config,
sidebars ADR + API, palette indigo) + TypeDoc à la racine (`typedoc.config.mjs`, sortie Markdown).
`npm run docs` régénère l'API puis construit le site en **11 s**, et devient la **4ᵉ garde du
pre-push** : DOC-004 quitte la liste « jugement » de `CLAUDE.md` pour devenir un capteur.

Trois pièges rencontrés, tous consignés parce qu'ils reviendront :

1. `onBrokenLinks: 'throw'` ne suffit pas — depuis Docusaurus 3.9 les liens Markdown morts se
   règlent dans `markdown.hooks.onBrokenMarkdownLinks` ; à la racine, l'option est dépréciée et
   **silencieusement ignorée**. Le garde-fou paraissait actif sans l'être.
2. Docusaurus **exclut les fichiers commençant par `_`**. Ma première sonde s'appelait
   `__probe.md` : elle n'était jamais construite, donc le lien mort n'échouait pas. Un capteur
   « vert » de plus qui ne testait rien (même famille que J-001). La sonde du self-test s'appelle
   désormais `probe-harness.md`.
3. Docusaurus 3 parse les `.md` en MDX, donc toute accolade devient une expression JS : le
   Markdown généré par TypeDoc (`{sessionId}`, génériques) cassait le build.
   `markdown.format: 'detect'` rend les `.md` au CommonMark.

**Bonus.** La doc générée était classée sous `presentation/`, `core/`, `infrastructure/` — des
couches supprimées par le refactor `de6b15c`. **96 tags `@module`** en code de production (178
fichiers au total avec les tests, qui pointaient encore `__tests__/`) réalignés sur les chemins
réels. `prettier` a aussi dû être aiguillé : il vérifiait le format des 311 fichiers **générés**
(`docs-site/docs/api/` ajouté à `.prettierignore`, et le dossier est gitignoré : c'est du dérivé).

Reste ouvert : `e2e/` est toujours vide alors que `POLICIES.md` documente 6 scénarios Maestro.

---

## J-012 — Le thème échoue WCAG AA sur 15 paires réellement affichées

**Date** : 2026-08-21 · **Statut** : RÉSOLU le 2026-08-24

**Observé.** A11Y-001 (« contraste WCAG AA respecté ») était présentée comme bloquante et le thème
annote ses couleurs de ratios (`// ✅ Texte sur blanc (4.7:1)`). Mesure faite : **ces annotations
sont fausses**. L'orange de marque `#E55A24` sur `surface.primary` donne **3.61:1**, pas 4.7:1.

Échecs mesurés : `text.brand`, `text.success`, `text.warning` en clair ; `text.error` en sombre ;
l'anneau de focus en clair (**2.84:1** pour un seuil de 3:1) ; et **les six** combinaisons de
libellé blanc sur bouton plein (`brand` 3.61 clair / 2.84 sombre, `accent` 2.93 / 2.17,
`danger` 4.17 / 4.17).

**Réponse.** `src/theme/contrast.test.ts` mécanise A11Y-001 en **cliquet** :

- toute paire conforme aujourd'hui doit rester conforme ;
- les 15 paires en dette sont listées avec leur ratio mesuré et ne peuvent qu'**augmenter** ;
- si une paire repasse le seuil, le test **échoue** pour forcer sa sortie de la liste ;
- une entrée orpheline (paire disparue) fait échouer le test.

Corriger ces 15 paires impliquait de repeindre la palette : décision design, pas correction
mécanique. Le harness a bloqué la régression sans trancher à la place de Cédric.

**Résolution (2026-08-24).** Deux temps.

D'abord un constat : le chantier harness avait été mené sur `main`, **6 commits en retard** sur
`origin/develop`, qui portait déjà le rebrand indigo (`617d64b`). Le cliquet a fait exactement son
travail au rebase : il a signalé que 4 paires atteignaient désormais le seuil et devaient sortir de
la liste — l'orange à 3,61:1 était devenu de l'indigo `#4F46E5` à **6,29:1**.

Restaient 11 paires. Corrigées par des **steps de palette**, pas par des couleurs inventées :

| Paire                               | Avant  | Après  | Correctif                    |
| ----------------------------------- | ------ | ------ | ---------------------------- |
| `light text.success`                | 3,30:1 | 5,02:1 | step 600 → 700               |
| `light text.warning`                | 2,86:1 | 5,06:1 | step 600 → 700               |
| `dark text.error`                   | 4,35:1 | 6,59:1 | nouveau step 400 (`#F5737F`) |
| `dark text.onBrand` sur brand       | 4,47:1 | 6,29:1 | remplissage step 500 → 600   |
| `text.onBrand` sur danger (2 modes) | 4,17:1 | 5,59:1 | remplissage step 500 → 600   |
| `text.on*` sur accent (2 modes)     | 2,17:1 | 7,87:1 | **nouveau token `onAccent`** |

Le cas intéressant est l'accent teal. Aucun step ne permet du blanc lisible dessus sans détruire
la couleur (il faudrait descendre à `accent[700]`, un teal presque noir). La bonne réponse n'était
pas d'assombrir la marque mais de **retourner le contraste** : sur un remplissage lumineux, le
libellé est de l'encre. D'où `text.onAccent` (`#1A1A2E`), appliqué aux 3 sites concernés (marqueurs
de participants des deux cartes, badge « invité » du profil) et ajouté à l'union `TextColor`.

`interactive.danger.default` méritait aussi un mot : ce token sert **à la fois** de remplissage
(blanc dessus) et de couleur d'icône sur blanc. Le step 500 échouait les deux à 4,17:1 ; le 600
passe les deux à 5,59:1.

**État : 44 paires vérifiées, `PENDING_DESIGN_DECISION` vide.** Le test a aussi été restructuré :
`it.each([])` échoue en réclamant un tableau non vide, donc la vérification de dette est désormais
un test unique qui boucle — un cliquet doit supporter d'avoir zéro dette.

Les commentaires de ratio du thème ont été corrigés là où ils mentaient (`brand[600]` annonçait
6,4:1 pour 6,29:1 mesuré) et renvoient maintenant au test comme source de vérité.

---

## J-013 — 46 `accessibilityHint` manquants

**Date** : 2026-08-21 · **Statut** : OUVERT — dette produit

**Observé.** `plugin:react-native-a11y/basic` active 11 règles. 10 passent d'emblée ;
`has-accessibility-hint` remonte **46** éléments qui ont un `accessibilityLabel` sans `hint`.

**Réponse.** Les 10 règles gratuites sont activées en `error` (A11Y-003 partie label + role
désormais mécanisée). `has-accessibility-hint` reste `off` : un hint est de la **copie
utilisateur**, à écrire et à traduire, pas à générer. La charge passe au reviewer, avec le critère
« le libellé seul dit-il ce que l'action fait ? ».

---

## J-014 — Couplage `components/` → `features/` préexistant

**Date** : 2026-08-21 · **Statut** : OUVERT — dette d'architecture

**Observé.** 5 violations de `components-no-features` : 4 molecules POI importent
`@features/POI/utils/poiIcons`, et `AddressAutocomplete` importe
`@features/Session/hooks/useGeocodeQuery`. Le kit UI global dépend donc de deux features.

**Réponse.** Règle gardée en `error` avec un **cliquet** : les deux modules concernés sont
explicitement exemptés via `pathNot` dans `.dependency-cruiser.js`. Toute **nouvelle** violation
est bloquée ; l'existante est nommée et bornée. La sortie de dette (remonter `poiIcons` dans
`components/`, et `useGeocodeQuery` dans `src/hooks/`) est une décision d'architecture laissée à
Cédric — hors périmètre d'une mission harness.

**Limite assumée** : l'exemption porte sur les deux modules importés, pas sur les fichiers
importateurs. Elle est donc bornée par ce qui existe, mais n'interdit pas à un autre composant
d'importer ces deux mêmes modules.

---

## J-015 — TS-002 : 127 casts idiomatiques dans les tests

**Date** : 2026-08-21 · **Statut** : ARBITRÉ

**Observé.** `local-rules/no-unjustified-type-assertion` remonte 11 sites en production (tous
corrigés) et **127** dans les tests : `err as CalculateMidpointError` après un `throw`,
`fn as jest.Mock` pour typer un module mocké, `'not-an-avatar' as never` pour une fixture de
chemin d'erreur.

**Réponse.** Règle `off` dans `**/*.test.ts(x)` et `src/test-utils/**`. Exiger 127 commentaires
sur des idiomes standards produirait du bruit, pas de la sûreté — et le bruit finit par être
ignoré partout, y compris là où il compte. `as any` reste interdit dans les tests par
`no-explicit-any` **et** par `check-diff`.

---

## J-016 — Imports de hooks entre features

**Date** : 2026-08-21 · **Statut** : ARBITRÉ

**Observé.** Une première règle `no-cross-feature-import` remontait 6 cas : `MapScreen` (Session)
importe `useSharedSessionSync`, `useSessionShare`, `useRealtimeTracking` (Sharing) et `useAuth`
(Profile) ; `ProfileScreen` importe `useBiometricLock` (Biometric).

**Réponse.** Règle **resserrée** en `no-cross-feature-screen-import` : un écran ou un util propre à
une feature reste privé, mais la réutilisation d'un **hook** entre features est autorisée — ces
hooks (`useAuth`, `useBiometricLock`, `useSessionShare`) sont transverses par nature. Aucune règle
de `CLAUDE.md` ne l'interdisait ; l'interdire aurait été inventer une contrainte, et la laisser en
`warn` aurait produit 6 avertissements permanents donc invisibles.

Si ces hooks deviennent vraiment transverses, leur place est `src/hooks/` — et la règle pourra
alors être élargie.

---

## J-017 — Le véto « artefacts natifs » bloque les commandes qui en parlent

**Date** : 2026-08-21 · **Statut** : ACCEPTÉ — faux positif connu

**Observé.** Le hook `PreToolUse` a bloqué l'écriture de `scripts/harness-selftest.sh` : le
heredoc **mentionnait** `ios/Pods` et `android/build` comme chaînes de test.

**Cause.** Le véto natif s'applique à la commande brute, avant tout découpage en tokens — il ne
peut pas distinguer « toucher ce chemin » de « écrire ce chemin dans un fichier ».

**Réponse.** Faux positif **assumé** : un véto sur les artefacts natifs doit rester grossier
plutôt que contournable. Deux contournements documentés :

1. écrire le fichier avec l'outil `Write` au lieu d'un heredoc Bash ;
2. dans le self-test, les chemins sensibles sont assemblés à l'exécution
   (`IOS_PODS="i""os/P""ods"`) pour que le fichier ne se bloque pas lui-même.

Les vérifications `rm -rf`, `git push --force` et `git reset --hard` sont, elles, analysées par
tokens (`shlex`) avec détection de la position de commande : un heredoc qui contient `rm -rf` en
texte n'est **pas** bloqué. 32 cas de test dans le self-test, dont 14 qui doivent passer.

---

## J-018 — Le véto sur les commandes destructrices était contournable

**Date** : 2026-08-24 · **Statut** : RÉSOLU

**Observé.** J'ai lancé, et le hook a laissé passer, une commande de cette forme :

```
python3 - <<'PY'
... du code contenant une apostrophe ...
PY
<suppression récursive forcée d'un dossier>
```

Le dossier a bien été supprimé. Aucun refus. Or ce motif est exactement celui que le hook
`PreToolUse` est censé interdire.

**Cause — deux défauts qui se cumulent.**

1. `shlex.split()` traite un **retour à la ligne comme un simple espace**. Toute la commande
   multi-lignes se réduisait donc à _une_ commande dont le nom est `python3` ; la suppression
   placée sur la ligne suivante n'était qu'un **argument**, jamais soumise à `check_rm`.
2. Quand `shlex` échouait (guillemets déséquilibrés — un heredoc contenant une apostrophe suffit),
   le code faisait `return 0`, c'est-à-dire **autoriser**. Un parseur qui abandonne ne doit pas
   conclure « rien à signaler ».

**Pourquoi c'est grave.** C'est le capteur censé protéger de l'irréversible, et son mode de
défaillance était silencieux et permissif. Même famille que J-001 — un capteur vert qui ne
regardait pas — sauf que celui-ci garde des suppressions de fichiers.

**Réponse.**

- Analyse **ligne par ligne** : chaque ligne est tokenisée et jugée séparément.
- Échec de tokenisation → `check_raw_fallback()`, jeu de regex sur le texte brut, **biaisé vers le
  refus**. Un parseur en échec refuse, il n'autorise pas.
- 7 cas ajoutés au self-test : les 3 contournements multi-lignes ci-dessus, et 4 commandes
  légitimes multi-lignes qui doivent continuer à passer.

**Conséquence assumée.** Une ligne de heredoc qui _mentionne_ une commande destructrice est
refusée. Deux atténuations : le texte entre backticks est ignoré (une commande réelle n'est jamais
précédée d'un backtick), et pour le reste le contournement est documenté — outil `Write`, ou
chaînes assemblées à l'exécution comme dans le self-test. Un véto grossier vaut mieux qu'un véto
contournable.

---

## J-019 — Le `clear` de Docusaurus bloqué par homonymie

**Date** : 2026-08-24 · **Statut** : ACCEPTÉ — faux positif connu

**Observé.** Le script `clear` lancé depuis `docs-site/` a été refusé. Il s'agissait de
`docusaurus clear` (vide le cache de build), pas du script homonyme de la racine qui supprime
`node_modules`.

**Cause.** Le véto compare le **nom du script**, sans savoir de quel `package.json` il provient.

**Réponse.** Faux positif accepté ; contournement : appeler le binaire directement
(`npx docusaurus clear`). Rendre le véto conscient du répertoire courant demanderait de résoudre
le `package.json` applicable à chaque appel, pour un gain marginal : les quatre noms bloqués sont
tous destructeurs à la racine, et l'homonymie ne concerne que celui-ci.

---

## J-014 bis — Résolution du couplage `components/` → `features/`

**Date** : 2026-08-24 · **Statut** : RÉSOLU — l'exemption de cliquet est supprimée

**Le constat qui change tout.** Avant de déplacer quoi que ce soit, une vérification d'usage :

| Composant             | Importé par                      |
| --------------------- | -------------------------------- |
| `POICard`             | `POIListView` uniquement         |
| `POIDetailSheet`      | `POIScreen` uniquement           |
| `POIListView`         | `POIScreen` uniquement           |
| `POIMapView`          | `POIScreen` uniquement           |
| `POIScreenHeader`     | `POIScreen` uniquement           |
| `AddressAutocomplete` | `CreateSessionScreen` uniquement |

**Aucun de ces six composants n'était partagé.** Le couplage `components/ → features/` n'était donc
pas le problème : c'en était le **symptôme**. Six composants de feature vivaient dans le kit UI
global, et de là ils avaient besoin de `poiIcons` (POI) et `useGeocodeQuery` (Session) — d'où les
imports interdits.

**Trois options étaient sur la table.**

1. **Remonter les deux modules partagés** — `poiIcons` dans `components/`, `useGeocodeQuery` dans
   `src/hooks/`. Le plus petit diff (2 fichiers), mais il promeut du mapping d'icônes POI et du
   géocodage Session au rang de « partagé » alors qu'ils ne le sont pas, et laisse les composants
   POI dans le kit global. **Soigne le symptôme.**
2. **Déplacer tous les composants mono-feature** — `BiometricLockScreen` → Biometric,
   `RealtimeConsentModal` et `LiveParticipantsList` → Sharing, `SessionMapView` → Session,
   `AvatarPicker` → Profile. Taxonomie idéale, mais diff large et qui touche quatre features
   sans qu'aucune règle ne l'exige. **Mérite sa propre tâche.**
3. **Déplacer les six qui créent la violation.** Retenu.

**Réponse.** `src/features/POI/components/` et `src/features/Session/components/` créés, les six
dossiers déplacés avec `git mv` (historique préservé), 9 fichiers d'imports réécrits, 13 tags
`@module` réalignés.

Côté règles :

- `components-no-features` perd ses deux exemptions `pathNot` — **plus aucun grandfathering**. Le
  kit UI global ne peut plus connaître une feature, point.
- `no-cross-feature-screen-import` devient **`no-cross-feature-private-import`** et couvre
  désormais `screens`, `utils` **et** `components` : les composants d'une feature sont privés au
  même titre que ses écrans. La réutilisation de **hooks** entre features reste autorisée (cf. le
  J-016 d'origine).
- Nouvelle règle **`feature-components-presentational`** : un composant de feature n'accède pas au
  conteneur de DI. Sans elle, déplacer un composant près de son écran l'autoriserait implicitement
  à faire ce que le kit global n'a jamais pu faire — la frontière aurait été déplacée, pas tenue.

3 sondes ajoutées au self-test (dont `components-no-features`, qui n'en avait aucune : la règle
n'était vérifiée par personne, seulement par l'absence de violation réelle).

**Ce qui reste.** Cinq molecules mono-feature dorment encore dans `src/components/molecules/`
(`AvatarPicker`, `BiometricLockScreen`, `LiveParticipantsList`, `RealtimeConsentModal`,
`SessionMapView`) ; `ParticipantCard` sert à deux features et reste donc partagée à juste titre.
Aucune ne viole de règle
aujourd'hui — c'est l'option 2 ci-dessus, à traiter séparément si le besoin apparaît.

---

## J-020 — Le cliquet de contraste a validé sa propre régression

**Date** : 2026-08-24 · **Statut** : RÉSOLU · **Trouvé par** : le subagent `reviewer`

**Observé.** En corrigeant J-012, j'ai assombri `interactive.brand.default` (step 500 → 600) et
`interactive.danger.default` (500 → 600) en mode sombre pour que du blanc y devienne lisible. Le
test de contraste est resté vert 44/44, `PENDING_DESIGN_DECISION` vide, `npm run check` à 0, et
j'ai déclaré « 0 dette ». Le reviewer a mesuré 12 usages réels passés **sous** le seuil :

| Site                                  | Avant  | Après      |
| ------------------------------------- | ------ | ---------- |
| Onglet actif (`TabBarIcon`)           | 4,06:1 | **2,88:1** |
| Icône de catégorie (`POICard`)        | 3,33:1 | **2,37:1** |
| Bordure du bouton « Ma position »     | 4,06:1 | **2,88:1** |
| Icône « retirer » (`ParticipantCard`) | 3,94:1 | **2,94:1** |
| Piste du switch biométrie             | 4,06:1 | **2,88:1** |

Pire symptôme : l'onglet **actif** devenait moins lisible que les onglets **inactifs**
(`text.tertiary`, 5,81:1).

**Cause — une erreur de raisonnement, puis un capteur qui ne pouvait pas la voir.**

1. J'avais identifié que `interactive.danger.default` sert **à la fois** de remplissage et de
   couleur d'icône — je l'ai même écrit en commentaire comme justification du changement. Mais je
   n'ai raisonné que sur du blanc sur fond clair. En mode sombre, les deux rôles tirent en sens
   **opposés** : un remplissage doit être foncé pour porter du blanc, et clair pour se détacher
   d'un fond sombre. Assombrir a résolu un rôle en cassant l'autre.
2. `buildPairs()` n'utilisait `interactive.*.default` que comme **arrière-plan**, jamais comme
   avant-plan. Le test ne pouvait structurellement pas voir la modification qu'il était censé
   garder. Un test aveugle sur l'axe modifié ne garantit rien sur cet axe — et il est pire qu'un
   test absent, parce qu'il signe.

**Réponse — 1. Le thème distingue les rôles.**

- Un token `interactive.*` est un **remplissage**. Pour un avant-plan (icône, spinner, bordure,
  tint), le token est `text.*`. Les **22 usages** avant-plan ont migré vers `text.brand` /
  `text.error` (`text.brand` vaut brand[300] en sombre, 9,09:1, et brand[600] en clair, 6,29:1).
- En mode sombre, un remplissage est **clair et porte de l'encre** : `interactive.brand.default`
  passe à brand[400] (frontière 6,07:1, encre dessus 5,72:1) et `text.onBrand` devient l'encre.
  brand[500] était un cul-de-sac : ni le blanc (4,47:1) ni l'encre (3,82:1) n'y atteignent AA.
  C'est la même bascule que pour le teal accent, généralisée.
- Les états d'un remplissage vif **s'éclaircissent** au lieu de s'assombrir, en clair comme en
  sombre, sinon le libellé encre devient illisible au survol.

**Réponse — 2. Le cliquet couvre les quatre rôles.** `contrast.test.ts` passe de 44 à 80 paires :

1. texte sur surface — dont `surface.tertiary`, sur les tokens qui y sont réellement rendus ;
2. libellé sur remplissage — `default`, **`hover` et `pressed`** compris, `text.onBrand` ou
   `text.onAccent` selon la teinte ;
3. **remplissage contre surface** (WCAG 1.4.11, seuil 3:1) — le rôle qui manquait ;
4. indicateurs porteurs de sens (focus, bordure d'erreur).

Le test compose aussi les `rgba` des `feedback.*Bg` au lieu de les exclure : l'assertion « ne
teste que des couleurs hexadécimales résolues » **entérinait** la limite au lieu de la lever.

Une seule exclusion subsiste, et elle est raisonnée plutôt que subie : les remplissages `accent`
sont hors du rôle 3, parce que les deux seuls de l'app ne sont pas des composants d'interface (un
badge non interactif dont le texte porte l'information, et des marqueurs de carte cernés d'un
anneau dont la frontière se juge contre les tuiles). Le commentaire le dit et précise qu'un
**bouton** accent devrait être rajouté.

**Piste non retenue pour l'instant.** Le reviewer proposait une règle ESLint locale interdisant
`theme.color.interactive.*` en valeur de `color=` / `tintColor=` / `borderColor`. C'est exactement
la confusion de rôle qui a produit les 12 sites, et ce serait le capteur le plus direct. Non fait :
la distinction remplissage/avant-plan est parfois portée par une variable intermédiaire, donc une
règle purement syntaxique aurait des angles morts — à évaluer (`docs/context/TODO.md`).

**Leçon.** Un cliquet ne protège que les axes qu'il mesure. Avant de modifier un token, la question
n'est pas « le test est-il vert ? » mais « le test regarde-t-il ce que je change ? ».

---

## J-021 — Deux rôles hors modèle : la tuile de carte et l'état désactivé

**Date** : 2026-08-24 · **Statut** : RÉSOLU · **Trouvé par** : le subagent `reviewer`, 2ᵉ passe

**Observé.** Le correctif de J-020 a réparé le contraste contre les surfaces de l'app… et l'a cassé
sur deux fonds que le cliquet ne modélisait pas. Les deux en mode sombre, les deux introduits par
le correctif lui-même.

| Site                                        | Avant J-020 | Après J-020 | Corrigé |
| ------------------------------------------- | ----------- | ----------- | ------- |
| Cercle de rayon sur les tuiles de carte     | 3,88:1      | **1,73:1**  | 5,47:1  |
| Libellé « Enregistrer » désactivé (Profile) | 10,44:1     | **1,63:1**  | 4,07:1  |

**Cause 1 — les tuiles de carte ne suivent pas le thème.** En migrant les avant-plans de
`interactive.*` vers `text.*`, j'ai aussi migré le `strokeColor` du cercle de rayon des deux
cartes. Or ce trait n'est pas rendu sur une surface de l'app : il est rendu sur les tuiles
`react-native-maps`, qui restent **claires** en mode sombre (aucun `customMapStyle` dans le
projet). `text.brand` sombre vaut `brand[300]` `#A5B4FC` — un lavande clair sur une tuile claire.
Le cercle devenait invisible.

La dichotomie que j'avais posée — `interactive.*` = remplissage, `text.*` = avant-plan — est
définie **contre les surfaces du thème**. Sur la carte, aucune des deux familles n'est valide.
Il manquait une troisième catégorie.

**Cause 2 — `disabled` n'était pas dans le modèle.** Le rôle « libellé sur remplissage » couvrait
`default`, `hover` et `pressed`, jamais `disabled`. Or `ProfileScreen` pose `color="onBrand"` sur
un remplissage `interactive.brand.disabled` (`neutral[700]`), et J-020 avait fait passer
`text.onBrand` du blanc à l'encre en mode sombre. Résultat : le bouton « Enregistrer », **désactivé
dès l'ouverture de l'écran**, affichait de l'encre sur du gris foncé.

**Réponse.**

- Nouvelle famille `color.map.*` (`stroke`, `strokeFill`), **identique en clair et en sombre**,
  calée sur les tuiles claires (`brand[600]` : 5,47:1 sur tuile, 6,29:1 sur blanc). Les quatre
  usages carte y sont routés.
- Les libellés de bouton désactivé passent à `text.tertiary` (4,07:1 en sombre, 3,27:1 en clair),
  en reprenant le motif déjà employé par `CreateSessionScreen` et `AddressAutocomplete` —
  il existait, je ne l'avais pas cherché.
- Le cliquet passe de 80 à **90 paires** et gagne deux rôles :
  - **rôle 5** — avant-plan sur tuile de carte, avec deux fonds de tuile bornants
    (`#F1EFE9` et `#FFFFFF`) ;
  - **rôle 2 étendu** — `disabled` inclus, seuil 3:1 (WCAG exempte les contrôles inactifs, mais un
    libellé doit rester perceptible).
- Au passage : `interactive.danger.pressed` en sombre passe de `error[50]` (rose quasi blanc, faute
  de step intermédiaire) à un `error[200]` ajouté à la palette ; et
  `CreateSessionScreen` utilise `border.error` au lieu de `text.error` pour une bordure.

**Leçon — la deuxième de suite sur le même capteur.** J-020 disait : « un cliquet ne protège que
les axes qu'il mesure ». J-021 précise : **corriger un axe peut casser un axe voisin non modélisé.**
Les deux fois, le test est resté vert et c'est la revue qui a vu. Le réflexe à garder : après une
modification de token, lister les **fonds** sur lesquels ce token est rendu — pas seulement les
surfaces du thème — et vérifier qu'ils sont tous dans le modèle.

**Dette restante, préexistante et non introduite ici** : les marqueurs live de `SessionMapView`
(`liveMarkerOnline` = `feedback.successBg` + bordure `text.success`) sont eux aussi rendus sur les
tuiles, à ~1,78:1. Consigné dans `docs/context/TODO.md` plutôt que corrigé au passage, pour ne pas
absorber silencieusement un défaut antérieur dans le correctif d'un autre.

---

## J-022 — Le harness ne vérifie aucune affirmation factuelle des docs

**Date** : 2026-08-24 · **Statut** : OUVERT — capteur à écrire. Requalifié le 2026-09-26 : hors du
lot harness v2, qui porte sur les contournements du code et des gates. Le reviewer y a d'ailleurs
trouvé trois affirmations fausses dans les docs du harness v2, corrigées à la main : la leçon tient
toujours. Suivi : `TODO.md > Harness v2`.

**Observé.** Un commit dont l'objet **était** « purge des docs périmées » a livré **5 assertions
fausses**, avec `npm run check` **vert**. J'ai rédigé la procédure d'enregistrement Firebase dans
`RUNBOOK.md` en décrivant l'état constaté (« aucun fichier de config natif n'est présent », « zéro
référence dans `project.pbxproj` », « `.env` n'existe pas », « `.firebaserc` est absent »), **puis**
j'ai installé ces fichiers dans le même diff. La doc décrivait donc l'état d'avant le commit qu'elle
accompagnait.

**Conséquence concrète**, telle que le reviewer l'a reconstruite : Cédric ouvre le RUNBOOK, suit
l'étape « glisser le plist sur le groupe Mivro », Xcode crée une **seconde** `PBXFileReference` pour
le même fichier, et le build casse sur `Multiple commands produce .../GoogleService-Info.plist` —
détruisant le seul point du contrat qui était objectivement réussi. Même mécanique pour
`cp .env.example .env`, qui écraserait un `.env` local non versionné dès que `SENTRY_DSN` sera
renseigné.

**Pourquoi c'est le trou le plus large du harness.** Tous les capteurs portent sur le **code**.
Aucun ne regarde si une doc dit vrai. Or l'agent écrit beaucoup de doc, et une doc fausse est pire
qu'une doc absente : elle est suivie.

**Réponse.** Corrigé à la main dans ce commit (RUNBOOK scindé « déjà en place » / « reste à faire »,
puces TODO cochées, `PROGRESS` remesuré, `POLICIES` annoté). Le capteur reste **à écrire** :

- `scripts/check-docs-facts.sh` branché dans `npm run check` : extraire les chemins cités dans un
  rayon de ~80 caractères autour de `absent|absents|n'existe pas|zéro référence|n'a aucune
référence`, échouer si `test -e` répond vrai.
- ⚠️ Prototype déjà écrit et essayé : il produit **un faux positif** sur
  `INVENTAIRE.md:40` — « Scripts référencés par \`CLAUDE.md\` mais **absents** », où l'absence porte
  sur les scripts et non sur le fichier cité. Le capteur devra donc distinguer le sujet de
  l'absence, pas juste le chemin le plus proche. Sans ça il sera désactivé au premier bruit, ce qui
  est pire que rien.
- Second volet mécanisable : faire écrire à `test:ci` un `coverage/coverage-summary.json`
  (`coverageReporters: ['text', 'json-summary', 'lcov']`) puis comparer `numTotalTests` /
  `numTotalTestSuites` au tableau « Métriques actuelles » de `PROGRESS.md`. Aurait attrapé les
  compteurs figés à 85 suites / 1133 tests alors que la réalité était 86 / 1226.

---

## J-023 — `check:diff` est aveugle à tout le natif

**Date** : 2026-08-24 · **Statut** : RÉSOLU le 2026-09-26 — `scripts/check-native.py`

**Observé.** Le `DEVELOPMENT_TEAM` du projet iOS est passé de `W7N4H92U5V` à `LL2DAR2374` sur les
configs Debug **et** Release, pendant une session Xcode, **sans que rien ne le signale**. Ni
`npm run check`, ni `check:diff`, ni le hook `PostToolUse`. C'est le reviewer — capteur inférentiel —
qui l'a trouvé, et seulement parce qu'il lisait le diff ligne à ligne.

**Cause.** `scripts/check-diff.sh` filtre le diff sur `'*.ts' '*.tsx' '*.js' '*.jsx'`. Tout le
natif — `project.pbxproj`, les fichiers gradle, les `Info.plist`, les schemes — échappe donc à
**tous** les motifs interdits, pas seulement à celui-ci. L'angle mort est structurel.

**Pourquoi ça compte.** Un changement d'identité de signature ou de bundle id casse le build device
ou, pire, publie sous la mauvaise identité. Et comme aucune doc ne dit quelle team est la bonne,
personne ne peut imputer la régression au commit fautif.

**Réponse.** Le changement a été **exclu du commit** par staging partiel (`git hash-object` +
`git update-index`), l'arbre de travail de Cédric restant intact pour ne pas casser sa signature
locale ; la question lui est posée. Capteur à ajouter : étendre `check-diff.sh` aux fichiers natifs
et refuser un diff qui touche
`DEVELOPMENT_TEAM|PRODUCT_BUNDLE_IDENTIFIER|CODE_SIGN_IDENTITY|applicationId|namespace` dans
`ios/**/project.pbxproj` ou `android/**/*.gradle` sans mention correspondante dans
`docs/harness/DONE-CONTRACT.md`.

---

## J-024 — Le véto « artefacts natifs » bloque un fichier source

**Date** : 2026-08-24 · **Statut** : RÉSOLU le 2026-09-26 — motif corrigé, deux cas au self-test

**Observé.** Le hook `PreToolUse` a refusé une simple **lecture** du fichier gradle du module app,
et a aussi bloqué deux `python3` dont le texte contenait ce chemin.

**Cause.** Le motif du véto natif est `android/(...)?/(build|\.cxx)`, qui matche le préfixe
`android/app/build` de `build.gradle`. Or c'est un **fichier source versionné**, pas un dossier
d'artefacts. Même famille que J-017, mais ici le faux positif porte sur un fichier qu'on doit
pouvoir lire et éditer en temps normal.

**Réponse.** Contourné trois fois par concaténation à l'exécution, ce qui est le signe qu'il faut
corriger le motif plutôt que de le contourner. Correctif à appliquer : exiger une **fin de segment**
après `build`, c'est-à-dire `(build|\.cxx)(/|$)` au lieu de `(build|\.cxx)`. `android/app/build/`
resterait bloqué, `android/app/build.gradle` passerait. À couvrir par deux cas dans
`harness-selftest.sh` : BLOCK sur le dossier, ALLOW sur le `.gradle`.

---

## J-025 — Un test sans marge de temps, vert seulement au repos

**Date** : 2026-08-24 · **Statut** : RÉSOLU le 2026-09-26 — timeout explicite sur ce test seul

**Observé.** `npm run check` a échoué sur
`usePOIQuery › retry logic › does not retry on parse_error` — **timeout de 5 000 ms**, pas une
assertion fausse. La machine tournait alors un `pod install` et un job de sauvegarde en parallèle.
Le fichier passe **9/9 trois fois de suite** en isolation, et la suite complète est verte au repos.

**Pourquoi le consigner malgré tout.** Un test qui tient dans le budget par défaut sans marge n'est
pas vert : il est vert _au repos_. Il mordra en CI, sur une machine partagée, et il apprendra à
lire un échec de `npm run check` comme du bruit — ce qui coûte bien plus cher que le test lui-même.

**Réponse.** Aucune correction appliquée pour l'instant : le test concerne la logique de retry
TanStack Query, donc son budget dépend des faux timers et du nombre de tentatives. À traiter en
donnant un timeout explicite à ce test précis, plutôt qu'en relevant le budget global qui masquerait
d'autres lenteurs. Consigné dans `TODO.md > Dette technique`.

**Clôture (2026-09-26).** Timeout explicite de 15 s sur ce seul test
(`LOADED_MACHINE_TIMEOUT_MS`, `src/features/POI/hooks/usePOIQuery.test.ts`). Le budget global de
Jest reste à 5 s, pour qu'une vraie lenteur ailleurs continue de faire échouer la suite.

---

> **J-026 à J-035 — audit red-team du 2026-09-26.** Un agent a tenté de contourner chaque capteur
> dans un worktree isolé, en écrivant de vraies violations et en regardant si elles passaient. Chacun
> des trous ci-dessous a été observé, pas supposé, et chacun est rejoué au self-test
> (`npm run check:harness`, section indiquée).

## J-026 — check-diff aveugle à un arbre fait de fichiers non suivis

**Date** : 2026-09-26 · **Statut** : RÉSOLU

**Observé.** Une feature neuve, c'est souvent **uniquement** des fichiers non suivis. Dans ce cas
`git diff --quiet HEAD` ne voit rien, `check-diff` basculait en mode « branche contre upstream » et
inspectait les commits déjà poussés : exit 0 sur un fichier contenant cinq violations. En mode `HEAD`
explicite, les cinq étaient trouvées. J-005 avait bien ajouté les fichiers non suivis, mais seulement
**une fois** le mode `HEAD` choisi.

**Réponse.** `resolve_range` choisit le mode `HEAD` dès que `git status --porcelain` n'est pas vide,
fichiers non suivis compris. Self-test §3 : dépôt jetable avec un seul fichier non suivi fautif.

## J-027 — Hook d'édition muet dans un worktree

**Date** : 2026-09-26 · **Statut** : RÉSOLU

**Observé.** `post-edit-check.sh` faisait `cd "$CLAUDE_PROJECT_DIR"`. Or cette variable reste sur le
checkout principal quand une session ou un subagent (`isolation: worktree`) travaille dans un
worktree. Même fichier, même payload : exit 0 sans erreur avec la racine du checkout principal,
exit 2 avec TS2322 et TS-002 avec la racine du worktree. Tous les subagents isolés étaient donc
écrits sans contrôle.

**Réponse.** La racine est celle du dépôt qui possède le fichier édité
(`git -C <dossier du fichier> rev-parse --show-toplevel`). Un worktree sans `node_modules` fait
échouer le hook avec la commande `ln -s` à lancer, au lieu de passer en silence. Le hook couvre
aussi les `.js` (J-035). Self-test §6 : hook lancé avec `CLAUDE_PROJECT_DIR` pointé ailleurs.

## J-028 — Garde Bash contournable

**Date** : 2026-09-26 · **Statut** : RÉSOLU (ralentisseur, pas rempart : voir J-030)

**Observé.** Trois familles de contournement, toutes `PASS` :

- **Opérateurs collés** : `ls;rm -rf x`, `(rm -rf x)`, `ls&&rm -rf x`. `shlex` rendait `ls;rm` comme
  un seul mot.
- **Indirection** : `bash -c '…'`, `eval`, `$(…)`, backticks, `X=rm; $X -rf`, `xargs rm -rf`,
  `python -c 'shutil.rmtree(…)'`, `node -e 'rmSync(…)'`.
- **Commandes destructrices absentes de la liste** : `find -delete`, `git clean -fdx`,
  `git checkout -- .`, `git restore .`, `git stash drop`, `git branch -D`, `git push origin +develop`,
  `git push origin :main`, un alias git vers `reset --hard`.

Et le garde laissait passer toute commande quand il plantait.

**Réponse.** `scripts/hooks/pre-bash-guard.py` réécrit :

- tokeniseur `shlex` avec `punctuation_chars`, puis découpe des suites d'opérateurs comme `)&&` ;
- récursion dans `bash -c`, `sh -c`, `zsh -c`, `eval`, `$()`, les backticks, et un heredoc passé à un
  shell ;
- préfixes neutralisés : `xargs`, `timeout`, `exec`, `env`, `sudo`… ;
- un nom de commande tiré d'une variable est refusé ;
- le code inline d'interpréteur est scanné (`rmtree`, `rmSync`…) ;
- toute la liste git destructrice ci-dessus est couverte ;
- **fail-closed** : si le garde plante, la commande est refusée.

Un heredoc passé à `cat > fichier` est désormais traité comme de la donnée : une doc qui **cite**
`rm -rf` ne bloque plus (J-017 atténué). Self-test §1 : environ 90 cas BLOCK/ALLOW.

**Limite assumée.** Un analyseur de shell reste contournable par qui le veut vraiment, par exemple
en écrivant un script dans `/tmp` puis en l'exécutant. Le rempart est côté serveur (J-030).

## J-029 — Le harness pouvait se réécrire lui-même

**Date** : 2026-09-26 · **Statut** : RÉSOLU

**Observé.** Une seule commande `sed -i` a désactivé cinq capteurs à la fois :

- `.eslintrc.js` : `no-explicit-any` passé à `off` ;
- `jest.config.js` : seuils de couverture mis à 0 ;
- `post-edit-check.sh` : `exit 2` remplacé par `exit 0` ;
- `pre-bash-guard.py` : `sys.exit(2)` remplacé par `sys.exit(0)` ;
- `.husky/pre-push` : réduit à `exit 0`.

Aucun capteur n'a réagi : `check-diff` ne regardait pas ces fichiers et rien ne les protégeait. Un
Edit sur `pre-bash-guard.py` passait aussi, sans objection.

**Réponse.** Quatre couches :

1. **Liste unique** `scripts/harness-protected.txt` : hooks, capteurs, configs lint/test/archi/tsc,
   CI, hooks git, `.git/hooks`, `.git/config`, le verdict scellé.
2. **Refus à la source.** Le garde Bash refuse toute écriture shell vers ces fichiers : redirection,
   `tee`, `cp`/`mv`/`rm`, `sed -i`, `git checkout`/`restore`, `npm pkg set scripts`, code inline, et
   `cd` suivi d'un chemin relatif. Le nouveau hook `pre-edit-guard.py` refuse Write, Edit, MultiEdit
   et NotebookEdit sur les mêmes chemins.
3. **Détection de ce qui aurait échappé aux gardes.** `scripts/harness.lock` contient le hash de
   chaque fichier protégé et celui des clés `scripts` et `lint-staged` de `package.json`. Le capteur
   `lock` fait partie du stage `fast` : il tourne donc au Stop, au pre-push et en CI.
4. **Approbation humaine.** Seul Cédric rafraîchit le verrou (`npm run harness:relock`), dans un
   terminal interactif et hors Claude Code. En CI, une PR qui touche le harness exige le label
   `harness-change`.

Les hooks sont appelés par leur interpréteur (`python3 …`, `bash …`) : un `chmod -x` ne les
neutralise plus.

**Observé en construisant.** Claude Code a **rechargé `.claude/settings.json` en cours de session** :
dès l'écriture du nouveau hook, l'agent qui construisait le harness s'est fait refuser l'édition
suivante de `reviewer.md`. C'est le comportement voulu, et il prouve que la protection prend effet
sans redémarrage.

**Déverrouillage.** Lancer Claude Code avec `MIVRO_HARNESS_UNLOCK=1` lève la protection du harness,
jamais les vétos destructifs. ⚠️ Que les hooks héritent de l'environnement de Claude Code n'est pas
documenté : c'est **à valider au premier usage**. Si l'héritage n'a pas lieu, le déverrouillage ne
fonctionne pas et le harness reste fermé. C'est le sens sûr de l'échec.

## J-030 — Aucun contrôle côté serveur, et le push était pré-approuvé

**Date** : 2026-09-26 · **Statut** : PARTIEL — protection de branche prête, pas encore appliquée

**Observé.** Pas de `.github/`, pas de workflow, aucun ruleset. `develop` n'était pas protégée
(404). `main` exigeait une PR mais avec 0 approbation, aucun check requis et `enforce_admins` à
false. En parallèle, `~/.claude/settings.json` autorise `git commit *`, `git push *` et
`git reset *` sans rien demander. Toute la batterie locale tombait donc devant un `--no-verify`.

Preuve vécue : le commit `b346a53` a été créé sans demande explicite de Cédric, en violation de sa
règle globale, et rien ne l'a empêché.

**Réponse.**

- `.github/workflows/check.yml`, trois jobs qui deviennent les checks requis :
  - `battery` : le stage `push` de la table, avec les abstentions interdites, plus le self-test ;
  - `security` : gitleaks et `npm audit --omit=dev --audit-level=high` ;
  - `harness-guard` : exige le label `harness-change`.
- `scripts/setup-branch-protection.sh` sur `main` et `develop` : PR obligatoire, checks verts sur une
  branche à jour, `enforce_admins`, ni force-push ni suppression.
- Permissions du projet : `ask` sur `git commit`, `git push` et `gh pr merge` ; `deny` sur
  `--no-verify`, `commit -n`, `--force`, `HUSKY=0` et `harness:relock`. Côté permissions, `deny`
  l'emporte sur l'`allow` du fichier utilisateur. La règle « pas de commit sans demande » devient
  donc mécanique.
- Le garde Bash refuse les écritures `gh api`, `gh pr merge --admin`, les changements de label,
  `gh auth token` et les écritures `curl` vers `api.github.com`.

**Reste.** La protection sera appliquée quand la CI aura tourné une première fois. Durcissement
recommandé ensuite : donner aux sessions Claude un token GitHub _fine-grained_ **sans** la
permission Administration. C'est la seule barrière qui résiste à un script écrit dans `/tmp`.

## J-031 — Échappatoires en un commentaire, justification vide

**Date** : 2026-09-26 · **Statut** : RÉSOLU

**Observé.**

- `/* eslint @typescript-eslint/no-explicit-any: off, local-rules/…: off */` en tête de fichier
  coupait les règles pour tout le fichier. Lint et `check-diff` restaient verts : ce dernier ne
  cherchait que la chaîne `eslint-disable`.
- `// @ts-expect-error` au-dessus d'une vraie erreur de type : tsc, lint et `check-diff` verts.
- `// ok` ou `// .` au-dessus d'un cast suffisait à TS-002 (et à TS-003).
- `const user: User = JSON.parse(raw)` compilait sans cast : `any` implicite, rien à voir pour un
  capteur.

**Réponse.**

- ESLint : `noInlineConfig: true` et `@typescript-eslint/ban-ts-comment`, `ts-expect-error` compris.
- `eslint-rules/justification.js` : une justification fait au moins 15 caractères et deux mots, et
  n'est pas une formule de remplissage.
- `x as unknown as T` est interdit en production.
- `Function` et les types objets enveloppes sont interdits.
- `check-diff` interdit en plus les commentaires de config inline, `@ts-expect-error`,
  `istanbul`/`c8 ignore`, `any` **dans toutes les positions de type** (`Record<string, any>`,
  `=> any`, `<T = any>`) et `z.any()`.
- `src/types/stdlib-unknown.d.ts` : `JSON.parse` et `Response.json()` renvoient `unknown`.

Self-test §3 et §4.

**Trouvé en passant.** TS-002 et TS-003 ne voyaient pas un commentaire placé au-dessus de
`export const x = y as T` : elles le cherchaient avant le `const`, pas avant le `export`. C'était un
faux positif qui attendait son premier cas. Corrigé, et couvert par un cas ALLOW.

## J-032 — Warnings non bloquants, tests focalisés ou sautés

**Date** : 2026-09-26 · **Statut** : RÉSOLU

**Observé.** Le lint n'avait pas de `--max-warnings 0` et environ 70 règles de la config RN sont en
warning, dont `jest/no-focused-tests`. Une sonde a donné 11 warnings pour un exit 0. Un `it.only`
passait donc `jest --ci`, qui a rapporté « 4 skipped, 1 todo, 2 passed ». La regex
`\.skip[ \t]*\(` de `check-diff` ratait aussi `.skip.each(`, `xtest`, `.todo` et `.failing`.

**Réponse.**

- `--max-warnings 0` partout : `npm run lint`, hook d'édition, lint-staged, stage `lint`.
- Dans les tests, en erreur : `jest/no-focused-tests`, `no-disabled-tests`, `expect-expect`,
  `no-commented-out-tests`, `no-identical-title`, `valid-expect`.
- `check-diff` couvre `.only`, `.skip`, `.todo` et `.failing` suivis de `(` ou de `.`, ainsi que
  `xtest`, `fit` et `fdescribe`.

Self-test §3 et §4.

## J-033 — Pre-push sans tsc ni lint, sur la mauvaise plage

**Date** : 2026-09-26 · **Statut** : RÉSOLU

**Observé.** Le pre-push lançait archi, `check-diff`, tests et doc, mais **ni tsc ni eslint**. Or
Jest passe par babel et ne voit pas les erreurs de type : un `commit -n` avec une erreur TS
passait. En plus, il ne lisait pas les refs sur stdin et comparait `@{u}...HEAD`, donc
`git push origin autre:develop` était jugé sur la mauvaise plage. Plus généralement, quatre
listes de contrôles (`npm run check`, pre-push, hook, doc) divergeaient déjà.

**Réponse.** Reprise de SmartBLE :

- `scripts/sensors.sh` est **la** table des capteurs, avec un stage par ligne (`fast`, `check`,
  `push`). Elle est lue par `scripts/check.sh`, que `npm run check`, le hook Stop, le pre-push et la
  CI appellent tous.
- Une abstention (exit 3) est nommée et jamais comptée verte ; en CI, elle compte comme un échec.
- Le pre-push dérive les plages des lignes `<ref> <sha> <ref> <sha>` qu'il reçoit sur stdin. Une
  branche neuve est comparée à sa merge-base avec `origin/develop`.

## J-034 — Aucun hook Stop, reviewer sur l'honneur

**Date** : 2026-09-26 · **Statut** : RÉSOLU (identification du reviewer à valider en réel)

**Observé.** Deux trous :

- Aucun hook `Stop` : un agent pouvait finir son tour avec un arbre rouge. Le hook d'édition ne
  voit que Write et Edit, jamais un `sed -i` ni un heredoc.
- Le reviewer n'était qu'une consigne. `b153b92` et `1d077a9` ont été commités sans verdict
  consigné (constaté à la clôture du contrat précédent). Rien ne persistait le verdict et rien ne le
  vérifiait.

**Réponse.**

- **Stop et SubagentStop** (`mivro-dev|mivro-tester`) : `scripts/hooks/stop-check.sh` rejoue le
  stage `fast` dès que l'arbre a bougé et refuse la fin du tour s'il est rouge. Garde-fou de boucle :
  après 3 refus sur un arbre inchangé, ou 8 d'affilée, l'arrêt passe avec un message à Cédric qui
  nomme les capteurs rouges. Jamais en silence.
- **Verdict scellé.** Le reviewer finit par `scripts/record-review.sh <VERDICT>`. Le hook
  `SubagentStop` à matcher `reviewer` (`seal-review.sh`) scelle ce verdict dans `.git/mivro-review`
  avec le hash de l'arbre relu.
- **Pre-commit.** `scripts/review-gate.sh` refuse un commit fait depuis Claude Code
  (`CLAUDECODE=1`) sans verdict `APPROVED` portant sur **exactement** l'arbre commité.

Self-test §8 et §9.

**Limites.**

- L'identification du reviewer repose sur le matcher de `SubagentStop`, documenté mais pas encore
  observé en réel. S'il ne se déclenche pas, les commits de l'agent sont refusés : le système
  échoue fermé.
- Un agent qui lancerait un reviewer en arrière-plan pourrait écrire un faux verdict en attente
  pendant la revue. Il faudrait le vouloir délibérément, et le transcript le montrerait.

## J-035 — Angles morts : secrets, `.js` non lintés, imports dynamiques, dépendances

**Date** : 2026-09-26 · **Statut** : RÉSOLU

**Observé.**

- Une clé `AIzaSy…` et un `PASSWORD='hunter2'` passaient `check-diff`.
- `npm run lint` ne regardait que `.ts`/`.tsx` : `functions/index.js`, la Cloud Function de purge
  RGPD, avait des erreurs de lint que personne ne voyait.
- `import(ADAPTER)` franchissait une frontière de couche avec « 0 dependencies cruised ».
- N'importe quel paquet npm pouvait entrer sans décision.

**Réponse.**

- `check-diff` scanne les secrets dans **tous** les types de fichiers : clés Google, AWS, GitHub,
  Slack et Stripe, clés privées, DSN Sentry, affectations `password = "…"` hors tests. Il refuse
  aussi `.env`, les configs Firebase, les keystores et le matériel de signature, même ajoutés avec
  `git add -f`.
- En CI, gitleaks et `npm audit`.
- Lint des `.js`, `.mjs` et `.cjs` : les 4 erreurs d'ordre d'imports existantes sont corrigées.
- Imports et `require` à spécificateur calculé interdits (`no-restricted-syntax`).
- `scripts/check-deps.js` avec la liste `scripts/allowed-dependencies.json`, un fichier du harness :
  un nouveau paquet est une décision de Cédric.

Self-test §3, §4 et §7.

---

> **J-036 à J-041 — revue du harness v2 par le reviewer, le 2026-09-26.** Le reviewer a relu le
> harness fraîchement construit, en contexte séparé, et a testé chaque attaque dans un dépôt
> jetable. Il rend `CHANGES_REQUESTED`. Tout ce qui suit touche des fichiers protégés : le
> correctif exact est dans `EN-ATTENTE.md`, à appliquer en session déverrouillée. Ces entrées
> restent **OUVERTES** jusque-là.

## J-036 — `harness-guard` exécute le code de la PR qu'il juge

**Date** : 2026-09-26 · **Statut** : RÉSOLU le 2026-09-28 — `.github/workflows/harness-guard.yml`

**Observé.** Avec `on: pull_request`, GitHub exécute le workflow **de la PR**, et le job lit
`harness_paths.py` et `harness-protected.txt` depuis ce même checkout. Une PR qui remplace l'étape
par `exit 0` et reforge le verrou obtient ses trois checks verts sans label. La couche 4 d'ADR-016
se jugeait donc elle-même.

**Réponse prévue.** Un workflow `pull_request_target` séparé qui n'exécute aucun code de la PR : la
liste des fichiers vient de l'API, les motifs de `git show $BASE:scripts/harness-protected.txt`, et
`.github/**` et `harness.lock` comptent toujours comme harness. Plus un test de structure au
self-test.

## J-037 — Un verdict APPROVED pré-déposé est scellé

**Date** : 2026-09-26 · **Statut** : RÉSOLU le 2026-09-28 — verdict lu dans le dernier message du reviewer

**Observé.** Le scénario tient en trois étapes :

1. L'agent principal lance `bash scripts/record-review.sh APPROVED` ; `.pending` n'est pas protégé.
2. Il lance ensuite le reviewer, qui rend `CHANGES_REQUESTED` sans rien enregistrer.
3. À la fin du reviewer, `seal-review.sh` scelle l'`APPROVED` pré-déposé, et le commit passe.

C'est un échec **ouvert**, pas fermé comme l'affirmait J-034.

**Réponse prévue.**

- Un hook `SubagentStart` sur `reviewer` supprime `.pending` et le sceau.
- `seal-review.sh` exige que le `VERDICT:` du dernier message du reviewer, lu dans le transcript,
  concorde avec `.pending`.
- `.pending` devient protégé.

## J-038 — Garde Bash : contournements restants sans script dans `/tmp`

**Date** : 2026-09-26 · **Statut** : RÉSOLU le 2026-09-28 — garde réécrit, cas au self-test §1

**Observé**, chaque commande autorisée par le garde :

- **Options longues abrégées** : `git commit --no-verif`, `git reset --har`, `git clean --forc`.
  Git les accepte.
- **Code inline multi-ligne** : `python3 -c` ou `node -e` sur plusieurs lignes. La première ligne
  ne se tokenise pas, les suivantes sont prises pour des commandes. Aussi `echo … | bash` et les
  formes en liste `s.run(['rm','-rf',…])`.
- **Porte de revue** :
  - `env -i … git commit` et `declare +x CLAUDECODE` font disparaître CLAUDECODE ;
  - `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0=core.hooksPath` désactive les hooks ;
  - `git commit-tree` suivi de `update-ref` crée un commit sans passer par eux.
- **Cibles non jugeables** : `tee $(echo scripts/harness.lock)` reforge le verrou en une ligne ;
  aussi `> $PWD/scripts/…`, `F=…; > $F` et `cd $(git rev-parse --git-dir)`.
- **Écrivains absents de la liste** : `curl -o`, `wget -O`, `patch`, `git apply`, `tar -x`.

**Réponse prévue.**

- Normaliser les préfixes d'options longues.
- Recoller les lignes tant qu'un guillemet reste ouvert.
- Refuser un shell en fin de pipe, `env -i`, `declare`/`typeset` sur CLAUDECODE, `GIT_CONFIG_*`,
  `commit-tree` et `update-ref`.
- Quand la protection est active, refuser toute cible d'écriture ou de `cd` qui contient `$` ou un
  backtick.
- Ajouter les écrivains manquants.

Chaque cas entre au self-test §1.

## J-039 — Une config ESLint de sous-dossier éteint les règles sans trace

**Date** : 2026-09-26 · **Statut** : RÉSOLU le 2026-09-28 — refus dans `check-diff`, cas au self-test §3

**Observé.** En mode eslintrc, un `src/features/X/.eslintrc.js` se fusionne par-dessus la racine :
`root: true` ne l'empêche pas. Aucune couche ne le voit : la liste protégée ne couvre que la
racine. Même trou pour `.prettierrc*`, `.babelrc*`, `tsconfig*.json` et `jest.config.*` imbriqués.

**Réponse prévue.** `check-diff` refuse l'ajout de ces fichiers hors de la racine, avec un cas au
self-test. Ou bien le capteur lance `eslint --no-eslintrc -c .eslintrc.js`.

## J-040 — Le job `security` est rouge avant même le premier run

**Date** : 2026-09-26 · **Statut** : RÉSOLU le 2026-10-08 — lots 1 et 1 bis mergés (PR #1, #2) ; 4 avis acceptés jusqu'au 2027-01-05

**Observé.** `npm audit --omit=dev --audit-level=high` donne exit 1 : 1 critique (`shell-quote`)
et 7 hautes (`brace-expansion`, `browserslist`, `image-size`, `js-yaml`, `nanoid`, `undici`, `ws`).
Toutes se corrigent sans `--force`. Tant que ce n'est pas fait, aucune PR ne peut passer la
protection de branche.

**Réponse prévue.**

- `npm audit fix` dans une branche dédiée, avec rebuild natif et tests device, car le lockfile de
  l'app bouge.
- Un capteur `audit` au stage `push`, avec abstention possible hors ligne, pour que le rouge se voie
  avant la CI.

**Remesuré le 2026-10-05 : la prémisse ne tient plus.** On est à 56 vulnérabilités (1 critique, 43
hautes, 11 modérées, 1 basse), et `npm audit fix` sans `--force` échoue en ERESOLVE : il veut
`react-native-reanimated@4.7.1`, qui exige React Native 0.86 au minimum. La mesure a été faite sur
une copie du manifeste et du lockfile, sans rien écrire dans le dépôt. Elle se découpe en trois
lots :

- **Lot 1, lockfile seul, dans les plages déjà déclarées** (`npm update` de 17 paquets
  transitifs, `package.json` inchangé). Il corrige le critique `shell-quote` (1.8.3 → 1.12.0), `ws`,
  `undici`, `js-yaml`, `nanoid`, `brace-expansion`, `joi`, `qs`, `body-parser`, `browserslist`,
  `protobufjs`, `launch-editor` et `@babel/core`. Il reste alors 44 vulnérabilités : 0 critique,
  38 hautes, 6 modérées.
- **Lot 2, `@react-native-community/cli` 20.1.0 → 20.2.0** (mineure, version épinglée dans
  `package.json`). Il corrige `fast-glob`, `fast-xml-parser` et les dix paquets `cli-*`.
- **Lot 3, sans correctif dans React Native 0.85.** `metro`, `micromatch`, `braces`, la chaîne
  `jest`, et le SDK JS `firebase` tiré par `@react-native-firebase` (`@grpc/grpc-js`). Les
  « correctifs » que propose npm sont des rétrogradations absurdes : `react-native@0.72.17`,
  `@react-native-firebase/app@20.1.0` (on est en 25), `reanimated@4.2.2`. Ce lot ne se ferme qu'en
  montant React Native en 0.86 ou plus, ou en acceptant nommément ces avis.

**Conséquence.** Le capteur `audit` (`--omit=dev --audit-level=high`) ne peut pas passer au vert
sur React Native 0.85, même après les lots 1 et 2. `overrides` est refusé par `check:deps` depuis
J-046, et c'est voulu. La décision revient à Cédric : monter React Native, ou faire porter au
capteur une liste d'avis acceptés, par identifiant GHSA, avec justification et date d'expiration.

**Décision de Cédric (2026-10-05).** Le lot 1 est appliqué tout de suite, dans la branche dédiée
`fix/j-040-npm-audit`. Le lot 2 est abandonné : il ne retire que des avis modérés. Le lot 3 passe en
avis acceptés. Les hautes restantes viennent de 4 avis :

- `braces`, GHSA-vfj7-8cjw-p6xm : aucune version corrigée n'existe ;
- `image-size`, GHSA-5p2g-fcmc-qvqq et GHSA-w3rx-r6r6-pgpr : épinglé par metro 0.84 ;
- `@grpc/grpc-js`, GHSA-m9gg-hp2v-232j : vient du SDK JS Firestore, que Mivro n'importe pas.

Ces avis sont acceptés jusqu'au 2027-01-05. Le capteur proposé et ses cas de test sont au point 4
d'`EN-ATTENTE.md`, vérifiés sur des copies. Montée de React Native 0.86+ : ticket séparé, avec ADR.

**Appliqué (2026-10-05, session déverrouillée).** `scripts/check-audit.sh` délègue le verdict à
`scripts/check-audit-verdict.py`, qui lit `scripts/audit-accepted.json`. Le job CI `security` lance le
même capteur. Quatre cas hors ligne au self-test §7. À cette date, le capteur restait rouge
uniquement sur des avis du lot 1, en attendant le merge de `fix/j-040-npm-audit`.

**2026-10-08.** Le lot 1 est mergé dans `develop` (PR #1, `4242ada`). Sitôt la branche du harness
rebasée, le capteur `audit` a attrapé un avis publié entre-temps : GHSA-vc2v-76pw-4v95 (haute),
`compression` < 1.8.2. Il se corrige dans la plage déclarée : c'est le lot 1 bis (PR #2). Le
capteur fait ce qu'on attend de lui : un avis nouveau rougit, il n'est jamais avalé par la liste
des avis acceptés.

**Clos le 2026-10-08.** Le lot 1 bis est mergé (PR #2, `58e4096`), la branche du harness est
rebasée et Cédric a refait le verrou. Le stage `push` est entièrement vert (13 capteurs), `audit`
compris, sans `--no-verify`. Restent les 4 avis acceptés jusqu'au 2027-01-05 : seule la montée de
React Native en 0.86 ou plus les fermera (TODO, à spécifier).

## J-041 — check-diff vert sur une base invalide

**Date** : 2026-09-26 · **Statut** : RÉSOLU le 2026-09-28 — exit 2, cas au self-test §3

**Observé.** `bash scripts/check-diff.sh 'nosuchref...HEAD'` sort en exit 0, à cause du
`git diff … || true`. Un clone superficiel ou une ref supprimée donne donc un vert qui n'a rien
inspecté. Idem si awk plante : le rapport est vide et le résultat vert.

**Réponse prévue.** `git rev-parse --verify` sur les deux bornes, avec exit 2 en cas d'échec, et
un rapport `CLEAN` exigé dès que le diff n'est pas vide. Cas au self-test.

---

## Clôture des entrées J-036 à J-041 (2026-09-28, session déverrouillée)

- **Le déverrouillage marche.** Au premier essai de la session lancée avec
  `MIVRO_HARNESS_UNLOCK=1`, l'édition d'un fichier protégé est passée, alors qu'elle était refusée
  la veille. Les hooks héritent bien de l'environnement de Claude Code : la réserve de J-029 est
  levée.
- **J-037, conception changée.** Le correctif prévu en EN-ATTENTE §8 est remplacé par plus simple
  et plus sûr. Les champs ont été vérifiés dans le binaire de Claude Code 2.1.283, où la charge
  utile de `SubagentStop` contient `agent_type` et `last_assistant_message`. Le sceau lit donc la
  ligne `VERDICT:` **du dernier message du reviewer**, que l'agent principal ne peut pas écrire. Le
  fichier `.pending` et `scripts/record-review.sh` sont supprimés. En plus, un hook
  `SubagentStart` (`reset-review.sh`) efface le sceau au début de chaque revue.
- **J-036.** `harness-guard` vit dans son propre workflow `pull_request_target` : checkout de la
  base seulement, liste des fichiers par l'API, motifs lus sur la base. `.github/**`, le verrou et
  les clés `scripts`/`lint-staged` de `package.json` y comptent toujours comme harness.
  `battery` et `security` restent sous `pull_request` : c'est `harness-guard` qui empêche une PR
  de les vider.
- **J-038.** Le garde est réécrit, 52 cas vérifiés à part :
  - options longues abrégées ;
  - lignes recollées tant qu'un guillemet reste ouvert ;
  - shell ou interpréteur refusé en fin de pipe ;
  - `$(…)` et backticks jugés comme commandes, puis rendus « non jugeables » s'ils servent de
    cible d'écriture ;
  - `env -i`, `declare`/`typeset`/`export -n` sur CLAUDECODE, `GIT_CONFIG_*`, `GIT_DIR`,
    `commit-tree` et `update-ref` refusés ;
  - écrivains ajoutés : `curl -o`, `wget -O`, `tar -x` et `unzip` dans le dépôt, `patch`,
    `git apply`, `git am`, et `prettier --write` ou `eslint --fix` sur un fichier protégé ;
  - `rm -r` refusé sur un dossier suivi, `git checkout`/`restore` refusé sur un dossier ;
  - faux positifs levés : corps de commit multi-ligne, doc en heredoc qui cite `ios/Pods`,
    `open()` en lecture, et code inline qui ne fait qu'écrire les mots « rm -r ».
- **Mineurs appliqués.**
  - La clé du hook Stop inclut le contenu des fichiers non suivis.
  - Le relâchement conserve l'état, pour qu'un même arbre ne coûte pas 3 nouveaux refus.
  - Le reviewer lance `scripts/check.sh` directement.
  - `pull-requests: read` pour gitleaks.
  - actionlint est utilisé s'il est installé.
  - Les deux tests-capteurs et `.git/mivro-stop-state` sont protégés.
- **Self-test** : 230 assertions ; seul le verrou est rouge, en attente de relock.

---

## J-042 — Seconde revue du harness v2 : la même famille de trous, en une ligne

**Date** : 2026-09-28 · **Statut** : RÉSOLU le 2026-10-01 — tous les points appliqués, rejoués au
self-test

**Observé.** Le reviewer a rejoué toutes ses attaques précédentes, qui sont bloquées, puis en a
trouvé d'autres, chacune prouvée dans un dépôt jetable :

- **Commit sans verdict** :
  - `git --config-env=core.hooksPath=…` ;
  - `git stash` puis `git cherry-pick stash@{0}` (cherry-pick ne lance aucun hook) ;
  - `git config --remove-section core` ;
  - `printf -v CLAUDECODE 0` ;
  - `git merge --no-ff`.
- **Code exécuté sans être jugé** : `GIT_EDITOR="…"`, `git -c core.fsmonitor=…`,
  `rebase -x`, `bisect run`, `submodule foreach`, `source <(…)`.
- **Suppressions** : `fs.rm(…, {recursive})`, `rimraf`, `rsync --delete`, `git switch -f`,
  `read-tree -u`, pathspecs glob.
- **Écritures du harness par un détour** :
  - un lien symbolique : seul le parent était résolu ;
  - `package.json` réécrit en entier ;
  - `pushd` ;
  - un autre worktree du même dépôt ;
  - `.claude/agents/*` ;
  - `~/.claude/settings.json`, avec un bloc `env` qui déverrouillerait la session suivante ;
  - `~/.gitconfig` ;
  - `.git/refs`, `.git/info`, `hash-object -t commit`, `fast-import`.
- **TOCTOU du sceau** : l'arbre était photographié à la fin de la revue, pas au début.
- **Côté serveur** : un label `harness-change` resté posé couvre les pushs suivants, et un
  changement de base n'est pas rejugé.
- **Renommage** : `git mv x src/.eslintrc.js` échappait à check-diff (filtre `A` seul).

**Leçon.** Un garde par liste noire sur tout ce que savent faire le shell et git ne sera jamais
complet : chaque revue en trouve d'autres. Il reste utile comme ralentisseur et comme retour
immédiat à l'agent. Mais la sûreté repose sur ce qui ne dépend pas d'une liste :

- les permissions `ask` sur toute écriture d'historique ou de configuration git, qui exigent une
  confirmation humaine ;
- le verrou ;
- `harness-guard` côté serveur, avec la protection de branche.

**Appliqué le 2026-09-28** (session déverrouillée), dans le garde Bash, `harness_paths.py` et le
garde d'édition :

- valeurs des variables et clés git exécutables jugées comme des commandes ;
- `--config-env` et `git config` en écriture refusés ;
- stash vers commit refusé ;
- `rebase -x`, `bisect run` et `submodule foreach` jugés ;
- `source` ou `.` non jugeables refusés ;
- `switch -f`, `read-tree -u`, globs, `rimraf`, `rsync --delete`, `fs.rm` récursif et `alias`
  refusés ;
- réaffectation de CLAUDECODE par un builtin refusée ;
- `realpath` complet contre les liens symboliques ;
- `$HOME` protégé (settings, `.gitconfig`, transcripts) ;
- déverrouillage refusé s'il vient d'un bloc `env` des settings ;
- configs imbriquées et autres worktrees protégés ;
- `.git/**` et `.claude/agents/**` protégés en entier ;
- Edit de `package.json` qui change `scripts` ou `lint-staged` refusé ;
- plumbing de commit refusé ;
- `pod install` et `gradlew clean` refusés ;
- `gh pr edit --base` refusé.

S'y ajoutent :

- les permissions `ask` sur merge, rebase, cherry-pick, revert, am, `git config` et
  `git worktree` ;
- le hook `.husky/pre-merge-commit` ;
- le sceau, qui compare l'arbre du `SubagentStart` (`reset-review.sh`) à celui du
  `SubagentStop`, et lit aussi le transcript du reviewer.

Les listes d'attaques du reviewer donnent 0 commande dangereuse autorisée, hors `git notes`,
inoffensif, et 0 faux positif sur ses 72 commandes ordinaires.

**Constaté en route.** Un module `harness_paths.py` incohérent pendant une édition fait planter le
garde d'édition, qui **refuse alors tout** : c'est l'échec fermé voulu. Dans une session
déverrouillée, Bash reste disponible pour réparer.

**Complété le 2026-10-01** (session déverrouillée, relancée depuis le terminal) :

- le hook Stop remet `TOTAL` à zéro au relâchement ;
- `harness-guard` n'approuve que sur un `labeled` fait sur la tête courante ; il rejuge `edited`,
  et échoue fermé si `package.json` est illisible par l'API ;
- `setup-branch-protection.sh` sort en 1 s'il a sauté une branche ;
- `check-diff` voit les renommages (`--diff-filter=AR`) ;
- le self-test rejoue toutes les attaques de J-042.

Le self-test, à 262 assertions, en a trouvé une de plus : le garde d'édition sortait **avant** de
vérifier `$HOME` pour un chemin hors du dépôt, si bien que `~/.claude/settings.json` restait
éditable. C'est corrigé. Il ne reste que le verrou, à générer par Cédric.

---

## J-043 — Troisième revue : deux fichiers hors de toute couche, et le sceau en concurrence

**Date** : 2026-10-01 · **Statut** : RÉSOLU le 2026-10-01

**Observé.** Toutes les attaques de J-042 sont bloquées. Le reviewer a pourtant trouvé deux
fichiers qu'**aucune** couche ne surveillait :

- **Un `package.json` imbriqué avec une clé `eslintConfig`.** ESLint 8 en mode eslintrc fusionne
  cette config par-dessus la racine, même avec `root: true` ; la démonstration a été faite dans un
  bac à sable. `src/package.json` éteignait `any`, i18n, couleurs, a11y et TSDoc sur tout `src/`,
  et le lint restait vert en local comme en CI. Une clé `prettier` fait de même avec le format.
  C'est la rechute de J-039 par une autre porte.
- **`jest.setup.js`**, chargé avant chaque test. Un `jest.mock('@theme', …)` global y neutralisait
  le test de contraste, qui est pourtant protégé. Ni le verrou, ni check-diff, ni `harness-guard`
  ne le voyaient.

Le reviewer a aussi trouvé que le sceau se trompait en concurrence. Deux revues parallèles
partageaient un même fichier de départ. Et un aller-retour de fichiers pendant la revue (ABA)
passait pour une absence de changement.

**Réponse.**

- **Configs imbriquées, toute la classe.** ESLint et Prettier tournent avec la config racine
  **seule**, partout : capteurs, `npm run lint` / `format`, lint-staged, hook d'édition. Les options
  sont `--no-eslintrc -c .eslintrc.js` et `--config .prettierrc.js`. En plus, un `package.json`
  imbriqué est refusé par les gardes et par check-diff. Les seules exceptions sont `docs-site/` et
  `functions/`, dans une liste unique que le self-test vérifie identique des deux côtés.
- **`jest.setup.js` est protégé.** Le self-test dérive de `jest.config.js` la liste des fichiers
  chargés (`setupFiles*`, `globalSetup`…) et exige qu'ils soient tous protégés.
- **Sceau.**
  - Le fichier de départ porte l'`agent_id` de la revue, et seule cette revue peut sceller.
  - Au stop, si un fichier de l'arbre a un ctime postérieur au départ, le sceau est refusé. Ça
    couvre l'ABA.
- **Mineurs.**
  - Le garde d'édition passe par `is_protected`, comme le garde Bash : configs imbriquées et
    `$HOME`.
  - `cherry-pick`, `revert`, `rebase`, `am` et `merge` sont refusés derrière des options globales
    ou un chemin vers git. Seule la forme `git <verbe>` déclenche la confirmation `ask`.
  - `harness-guard` échoue fermé à partir de 3000 fichiers.
  - `rm -rf` est autorisé sur `coverage`, `node_modules/.cache` et le build de la doc, qui sont
    régénérables et ignorés.

Le self-test passe à 278 assertions.

---

## J-044 — Quatrième revue : les fichiers qu'un outil découvre tout seul

**Date** : 2026-10-01 · **Statut** : RÉSOLU le 2026-10-01

**Observé.** Les correctifs de J-043 tiennent. Le reviewer a démontré en bac à sable que quatre
fichiers non protégés faisaient encore passer un capteur au vert, sans qu'aucune couche ne réagisse :

- **Un `.babelrc` à la racine, ou une clé `babel` dans `package.json`.** Babel les fusionne
  par-dessus `babel.config.js`. Un plugin y réécrivait `expect(x)` en `expect(42)`, et les tests
  restaient verts.
- **Une clé `eslintIgnore` dans `package.json`.** ESLint 8 la lit **même avec `--no-eslintrc`**
  quand `.eslintignore` est absent. `["src/"]` faisait sortir le lint en 0, sans un mot.
- **Un fichier `__mocks__/@theme.ts` n'importe où sous `src/`.** Jest l'applique **sans aucun `jest.mock`** à tout
  import de `@theme`, ce qui vidait de son sens le test de contraste, pourtant protégé.
- **`docs-site/docusaurus.config.ts` et `typedoc.config.mjs`.** Passer `onBrokenLinks` à `'warn'`
  rend le capteur `docs` vert malgré un lien mort.

Trois points mineurs en plus :

- **Un `sh -c "git revert"`** contournait la règle `ask`.
- **`claude -p --setting-sources user`** ouvrait une session imbriquée sans aucun hook du projet.
- **La lecture de secours du sceau** pouvait prendre une ligne de verdict citée plus tôt dans le
  transcript.

**La classe.** Ce ne sont pas des configs que l'on passe à l'outil, mais des fichiers qu'il
**découvre seul** : `.babelrc`, les clés de `package.json`, `__mocks__`. La liste protégée ne les
nommait pas.

**Réponse.**

- **Liste protégée.** Elle couvre maintenant les variantes racine `.babelrc*` et
  `babel.config.{json,cjs,mjs,cts}`, les deux configs de doc, et tout fichier sous `__mocks__`
  (`harness_paths.is_mock`, aucun n'est suivi aujourd'hui).
- **Verrou.** Il hache **toutes** les clés de configuration d'outils de `package.json`
  (`harness_paths.PACKAGE_HARNESS_KEYS` : `scripts`, `lint-staged`, `eslintConfig`, `eslintIgnore`,
  `prettier`, `babel`, `jest`, `browserslist`, `type`, `imports`, `husky`), ainsi que toute config
  imbriquée ou tout mock présent. Le garde d'édition et `harness-guard` lisent la même liste.
- **`.eslintignore`.** Le fichier est créé et protégé : sa seule présence coupe la lecture de secours
  dans `package.json`.
- **`check-diff`.** Il refuse l'ajout d'un fichier `__mocks__`.
- **Garde Bash.**
  - Les verbes qui écrivent l'historique, plus `commit` et `push`, sont refusés dans un shell
    imbriqué ou derrière des options globales.
  - `claude` est refusé dans le garde et en `deny` dans les permissions.
  - `rm -rf` est autorisé sous `$TMPDIR` et `/tmp`.
- **Sceau.** La lecture de secours ne regarde plus que le **dernier** message du reviewer.
- **Self-test.** Il vérifie que tout fichier passé en `--config`/`-c` dans `sensors.sh` est protégé.

Le self-test passe à 299 assertions (le chiffre de 300 annoncé d'abord était faux : J-045).

---

## J-045 — Cinquième revue : on ne ferme pas une classe par énumération

**Date** : 2026-10-01 · **Statut** : RÉSOLU le 2026-10-01 — changement de modèle

**Observé.** Les correctifs de J-044 tiennent. Mais la cinquième revue a encore trouvé, dans la
même catégorie, des fichiers qu'un outil découvre seul et qui font passer un capteur au vert :

- **`.npmrc`** : `node-options=--require ./pre.js` réécrit le code de sortie de tous les capteurs
  lancés par npx ou npm (rejoué : un `exit 7` devient 0).
- **`.gitattributes`** : `*.ts -diff` rend check-diff aveugle, en CI comme en local.
- **Les versions de `devDependencies`** (`npm:<autre-paquet>`) et **le lockfile** : `check:deps` ne
  contrôlait que les noms.
- **`typedoc.json`**, lu avant le `typedoc.config.mjs` protégé, et **les scripts de
  `docs-site/package.json`**, qui court-circuitent le capteur `docs`.
- **`.editorconfig`** (Prettier 2 le fusionne malgré `--config`) et **`.shellcheckrc`**.

Elle a aussi trouvé que la lecture de secours du sceau ne voyait jamais la première ligne d'un
rapport de hand-back (`json.dumps` la préfixait), et qu'elle retenait le **dernier** verdict cité.

**Leçon.** Cinq revues, cinq nouvelles familles de fichiers découverts. Une liste de fichiers
protégés ne peut pas être complète : chaque outil (npm, git, node, Babel, Jest, Prettier, ESLint,
TypeDoc, shellcheck...) a ses propres fichiers de découverte, et ils changent avec les versions.

**Réponse : le modèle est inversé.** `harness_paths.PRODUCT_ZONES` liste là où l'agent écrit :

- `src/`, `docs/`, `docs-site/{docs,src,static}/`, `ios/`, `android/`, `functions/`, `e2e/`,
  `assets/` ;
- à la racine, `*.md`, `app.json`, `index.js`, `metro.config.js` et les règles Firebase.

**Tout le reste est du harness par défaut**, qu'il soit présent, futur, suivi ou non :

- tout dotfile, où qu'il soit, sauf `.gitkeep` ;
- toute config d'outil imbriquée, et tout fichier sous `__mocks__` ;
- `package.json` entier et les lockfiles ;
- tout fichier racine inconnu.

Les deux gardes le refusent, le verrou le hache, et `harness-guard` exige le label. Un `.npmrc`, un
`.gitattributes` ou un `typedoc.json` inconnus aujourd'hui sont donc couverts **sans être nommés**.

**Conséquence assumée :** toute modification de dépendance, version comprise, passe par Cédric. Le
lockfile rougit le verrou jusqu'à son relock. C'est cohérent avec la liste blanche des dépendances.

**En plus, défense en profondeur :**

- check-diff lance `git diff --text` avec un fichier d'attributs vide ;
- les capteurs forcent `--no-editorconfig`, `typedoc --options`, `shellcheck --norc` et
  `--cache-strategy content` ;
- `check.sh` vide `NODE_OPTIONS` et `npm_config_node_options` ;
- le capteur `docs` appelle les outils directement ;
- check-diff refuse les redéclarations de `JSON`, `Body`, `Response` et `declare global` ;
- `npm pkg set/delete` et `claude-code` (via npx ou `npm exec`) sont refusés ;
- `check-native` lit le `build.gradle` racine.

Côté sceau : le texte du hand-back est lu tel quel, et seul le **premier** verdict compte.

Le passage au modèle par zones a créé trois faux positifs, corrigés : `git checkout develop`,
`git reset HEAD~1` et le script d'un `sed -i` étaient lus comme des chemins du harness. Seuls les
mots qui existent sur le disque, ou qui suivent `--`, sont désormais jugés comme des chemins.

Le self-test passe à 336 assertions.

## J-046 — Sixième revue : la casse, les fichiers ignorés et les consignes de l'agent

**Date** : 2026-10-05 · **Statut** : RÉSOLU le 2026-10-05

**Observé.** Le modèle par zones de J-045 tient : aucun fichier de découverte inconnu n'est passé.
La sixième revue a trouvé cinq trous **dans la définition des zones elles-mêmes** :

- **La casse.** APFS ne distingue pas les majuscules : `src/types/STDLIB-UNKNOWN.d.ts` **est**
  `src/types/stdlib-unknown.d.ts`. Les comparaisons de chemins étaient sensibles à la casse : écrire
  la variante en majuscules écrasait le fichier protégé, et `src/x/Package.JSON` échappait au
  motif des configs imbriquées, dans les gardes comme dans check-diff.
- **Le manifeste des Cloud Functions.** `functions/package.json` et `functions/tsconfig.json`
  restaient en zone produit par exception : leurs scripts et leur config tsc étaient modifiables
  sans Cédric. Et `check:deps` ne lisait que les **noms** : un nom autorisé pointant vers
  `npm:<autre>`, un dépôt git, une archive ou un chemin local passait, comme un bloc `overrides`.
- **Les fichiers ignorés par git.** Un `.d.ts` posé sous `src/build/`, `src/**/dist/` ou un
  `node_modules` imbriqué est lu par tsc mais invisible pour check-diff et pour le verrou. De même,
  un `.tsbuildinfo` ou un cache ESLint forgé servait un verdict vert sur du code rouge.
- **Les consignes de l'agent.** `CLAUDE.md` (et `CLAUDE.local.md`, à toute profondeur) étaient en
  zone produit, au titre des `*.md` racine : l'agent pouvait réécrire ses propres règles, y compris
  « le harness est hors de ta portée ». `~/.claude/CLAUDE.md` n'était pas protégé non plus.
- **L'identité native.** `applicationIdSuffix`, `productFlavors` ou un `CFBundleIdentifier` en dur
  dans `Info.plist` changent l'identifiant publié sans toucher aux valeurs que check-native lisait.

**Leçon.** Une liste blanche ne vaut que par la façon dont on compare les chemins à la liste. Le
système de fichiers (casse, liens, fichiers ignorés) fait partie de la surface d'attaque. Et les
fichiers d'instructions sont du harness au même titre que les hooks : ils pilotent l'agent.

**Réponse.**

- `harness_paths` compare tout en minuscules : `matches()`, `is_product()`, le motif des configs
  imbriquées. check-diff passe en `nocasematch`.
- `is_product()` refuse tout chemin qui traverse `node_modules`, `build`, `dist`, `coverage` ou
  `Pods`, et tsconfig exclut `**/build`, `**/dist` et `coverage`.
- `functions/package.json` et `functions/tsconfig.json` deviennent du harness (plus d'exception).
  `check:deps` n'accepte que des versions du registre, et refuse `overrides` et `resolutions`.
- `CLAUDE.md` et `CLAUDE.local.md` sont du harness partout ; `~/.claude/CLAUDE.md` rejoint les
  fichiers protégés du `$HOME`.
- Les capteurs de la porte tournent sans cache : tsc sans `incremental`, ESLint sans `--cache`. Le
  hook PostToolUse garde son cache, car il informe et ne décide pas.
- check-native refuse `applicationIdSuffix` et `productFlavors`, et exige
  `CFBundleIdentifier = $(PRODUCT_BUNDLE_IDENTIFIER)` dans `Info.plist`.

**Risque accepté : la mémoire de l'agent.** `~/.claude/projects/<projet>/memory/` est rechargée à
chaque session et reste inscriptible par l'agent : c'est son outil. Une note pourrait y pousser une
consigne contraire au harness. Ce n'est pas un trou de capteur : les couches 2 à 4 d'ADR-016
(verrou, sceau, CI, `harness-guard`) ne lisent aucune consigne. Cédric relit la mémoire de temps en
temps (`MEMORY.md` est un index d'une ligne par note).

**Conséquence pour l'agent.** Mettre à jour `CLAUDE.md` passe désormais par Cédric, comme toute
règle. L'agent propose le changement exact dans `EN-ATTENTE.md`.

Le self-test passe à 358 assertions. Ses nouveaux cas, écrits hors session déverrouillée, ont été
posés par Cédric le 2026-10-05.

## J-047 — Septième revue : la casse de la base, pas seulement du chemin relatif

**Date** : 2026-10-05 · **Statut** : RÉSOLU le 2026-10-05 — `rel_under`, 8 cas au self-test §2

**Observé.** J-046 compare sans casse le chemin **relatif** au dépôt. Mais ce chemin relatif est
tiré d'un `os.path.relpath` sensible à la casse, et `realpath` ne rend pas la casse réelle sur APFS.
Rejoué sans rien écrire, en envoyant la payload aux hooks :

- `~/.Claude/settings.json`, `~/.claude/Settings.json` et `~/.GITCONFIG` passent les deux gardes,
  alors que la forme exacte est refusée. Ce sont les settings utilisateur (`disableAllHooks`), la
  config git globale, et par extension `~/.claude/CLAUDE.md` et les transcripts que lit le sceau.
  Aucune couche suivante ne les voit : ni le verrou, ni la CI.
- `/Users/cpineau/Developer/Personnel/MIVRO/scripts/check.sh` passe la garde d'édition : le chemin
  est jugé hors dépôt, puis `git rev-parse` rend la racine dans sa vraie casse et le chemin relatif
  devient `../MIVRO/...`. Le verrou, le Stop et la CI le rattrapent après coup.

**Leçon.** Rendre une comparaison insensible à la casse, c'est le faire à **chaque** étape qui
compare des chemins, base comprise. Le self-test ne testait que des variantes du chemin relatif.

**Réponse prévue.** Une seule fonction `rel_under(absolute, base)` sans casse, utilisée par
`to_rel`, `_same_repo_worktree_rel`, `home_protected` et `home_secret`, et huit cas au self-test
(dépôt en majuscules, `$HOME` en variantes de casse). Détail : `EN-ATTENTE.md` §3.

**Commit.** L'arbre de `harness/beton` est commité avant ce correctif (sauvegarde demandée par
Cédric). J-047 reste OUVERT jusqu'à la session déverrouillée.

**Appliqué (2026-10-05, session déverrouillée).** Les quatre fonctions passent par `rel_under`.
Les huit cas sont au self-test §2, et la forme `/USERS/.../MIVRO/scripts/check.sh` est refusée.

---

## J-048 — Un cas du self-test appelé avant que sa fonction existe

**Date** : 2026-10-05 · **Statut** : OUVERT — correctif J-051 appliqué (trap `ERR` sans condition de version) ; reste la preuve sous Bash 5, à la première CI

**Observé.** Le cas J-046 `edit_guard 2 "$HOME/.claude/CLAUDE.md"` était écrit en section 1 de
`scripts/harness-selftest.sh`, alors que `edit_guard` n'est définie qu'en section 2. Bash affichait
« command not found » sur stderr et continuait : ni `ok`, ni `bad`, et le total restait vert. La
protection de `~/.claude/CLAUDE.md` n'a donc jamais été prouvée par le self-test.

**Cause.** Un appel à une commande inconnue n'est pas un échec pour le self-test, qui ne lance pas
`set -e` (c'est voulu, chaque cas doit tourner) et ne compte que `ok` et `bad`.

**Réponse.** Le cas est déplacé en section 2, après la définition (2026-10-05). Règle proposée qui
l'aurait attrapé : `command_not_found_handle() { bad "command not found in the self-test: $1"; return 127; }`
en tête du self-test. Tout appel mort devient alors un `bad`.

**Appliqué** (2026-10-05, session déverrouillée). La preuve hors self-test a montré que la règle
proposée était inerte en local : `command_not_found_handle` n'existe qu'à partir de Bash 4, et
`/bin/bash` de macOS est en 3.2. Seule la CI (ubuntu, Bash 5) l'aurait vue. Le self-test pose donc
aussi, sous Bash 3.2, un `trap` `ERR` qui compte un `bad` sur tout code 127. Preuve rejouée sur une
copie avec `edit_guard` appelée avant sa définition : un `bad` de plus, et aucun faux positif sur
l'arbre propre.

**Leçon.** Une règle de shell se prouve sur le shell qui la lance : le Bash du poste n'est pas
celui de la CI.

**Rouvert, puis corrigé** (J-051, 2026-10-05, session déverrouillée). Sous Bash 4+,
`command_not_found_handle` tourne dans un environnement séparé : le `bad` s'affichait, mais le
compteur ne bougeait pas. Le handler est retiré. Le self-test pose `set -E` et un trap `ERR` sans
condition de version, qui compte un `bad` dans le shell qui a vu le 127.

Preuve sous `/bin/bash` 3.2.57, sur des copies du self-test (agent, puis 10e revue) :

| Cas                                                        | Résultat              |
| ---------------------------------------------------------- | --------------------- |
| Copie corrigée, cas inchangés                              | 393 passed, 0 failed  |
| Appel mort au niveau supérieur                             | 1 failed              |
| Appel mort dans une fonction (`set -E`)                    | 1 failed              |
| Appel mort dans `x=$(...)`                                 | 1 failed              |
| Échec ordinaire : `false`, `(exit 2)`, `return 1`          | 0 failed              |
| Échec compté dans un sous-shell (perdu, comme sous Bash 5) | seul le parent compte |

Aucun cas existant ne sort en 127 : `grep 127` ne trouve que le trap.

Sous Bash 5, la preuve est le pas `self-test counts a dead call (J-051)` du job `battery` : il lance
une copie avec un appel mort et exige `1 failed`. J-048 passe RÉSOLU quand ce pas est vert sur la
CI.

**Limites connues.**

- Un trap `ERR` ne se déclenche pas dans une condition. `if appel_mort; then`, `f || x` et `f && x`
  donnent 0 failed (rejoué par la 10e revue). Le self-test appelle ses helpers en instruction
  simple, suivie de `expect_exit … $?`.
- Un appel mort placé en dernière commande d'un helper est compté deux fois : une fois dans la
  fonction grâce à `-E`, une fois chez l'appelant, puisque la fonction rend 127. Le défaut va dans le
  sens sûr : le bilan surcompte, il ne masque rien.

---

## J-049 — Le jeton GitHub : `home_secret` n'est appelée nulle part

**Date** : 2026-10-05 · **Statut** : RÉSOLU le 2026-10-08 — sandbox Bash de Claude Code (`denyRead`) et règles `Read`, voir J-051

**Observé.** `harness_paths.home_secret()` (liste `HOME_SECRETS`, `~/.config/gh/hosts.yml`) est
définie mais n'est appelée par aucun hook. Le jeton n'est protégé que par
`"gh/hosts.yml" in w` dans `pre-bash-guard.py`, une comparaison sensible à la casse.
`cat ~/.config/GH/hosts.yml` est autorisé (exit 0, rejoué le 2026-10-05), alors qu'APFS sert le même
fichier. L'outil Read n'est rattaché à aucun hook (`.claude/settings.json` : matchers `Bash` et
`Write|Edit|...` seulement), donc `Read ~/.config/gh/hosts.yml` n'est pas gardé non plus.

**Leçon.** C'est la même famille que J-046 et J-047. Une fonction de garde qui n'est appelée nulle
part protège autant qu'une fonction absente, et le self-test ne prouve que ce qu'il appelle.

**Réponse** (2026-10-05, session déverrouillée). `pre-bash-guard.py` compare `gh/hosts.yml` sans
casse et appelle `home_secret` sur chaque mot, après résolution. `pre-edit-guard.py` garde aussi
Read (matcher de `.claude/settings.json`) : il ne refuse que les secrets du `$HOME`, et la lecture
d'un fichier du harness reste permise. La 8e revue avait vu `cat ~/.ssh/id_rsa` autorisé :
`HOME_SECRET_DIRS` ajoute le répertoire `.ssh/` entier, en préfixe et sans casse.

## J-050 — Huitième revue : un correctif de la garde qui rouvre un trou, et un juge qui croit le vide

**Date** : 2026-10-05 · **Statut** : RÉSOLU le 2026-10-05 — 9 cas au self-test §1, 4 cas `audit` au self-test §7

**Observé.** La revue du delta appliqué en session déverrouillée confirme J-047 fermé sur toutes
les variantes de casse rejouées. Elle trouve deux défauts, rejoués avant d'être consignés :

- **La garde Prettier a reculé.** Le correctif d'EN-ATTENTE §2, écrit par l'agent, sautait la
  valeur des options de config, avec `-c` dans une liste commune aux deux outils. Or, chez
  Prettier, `-c` est `--check`, un drapeau. `npx prettier --write -c scripts/sensors.sh` devenait
  autorisé, alors que l'ancienne garde le refusait. En vérifiant, l'agent a trouvé un trou plus
  ancien : ESLint `-o`/`--output-file` et le `--cache-location` des deux outils écrivent dans le
  fichier donné, sans `--write` ni `--fix`, et la garde ne les regardait pas.
- **Le juge `audit` croyait le vide.** Tout objet JSON sans clé `error` passait pour un rapport
  valide : `{}` donnait exit 0. Un changement de format de npm aurait rendu le capteur vert.

**Leçon.**

- Une option n'a pas le même sens d'un outil à l'autre. Une liste d'options partagée entre outils
  est une hypothèse, pas un fait : chaque option se vérifie dans la CLI de chaque outil.
- Un juge de rapport externe valide d'abord la forme du rapport (TS-004), puis son contenu. Une
  absence de données n'est jamais un vert.
- Chaque cas de régression doit être vu rouge sur l'arbre d'avant. La revue a trouvé un cas J-047
  du self-test qui passait déjà avant le correctif (`.CONFIG/gh/hosts.yml`, J-049).

**Réponse** (2026-10-05, session déverrouillée). Les options lues et écrites sont définies par outil, et les valeurs des options
d'écriture sont jugées en toute circonstance. Le juge exige `auditReportVersion: 2` et remonte la
chaîne `via`. Les cas vérifiés sur des copies (16 + 11) sont entrés au self-test, et le cas
`.CONFIG/gh/hosts.yml` est rangé sous J-049. Le juge reste rouge sur l'arbre actuel, jusqu'au lot 1
(J-040).

## J-051 — Neuvième revue : deux fermetures déclarées qui ne tenaient pas

**Date** : 2026-10-05 · **Statut** : OUVERT — §2 et §4 appliqués le 2026-10-05 (Bash 5 à prouver
par la CI) ; sandbox appliqué le 2026-10-08

**Observé.** La revue du delta §5 à §8 confirme J-050 fermé : garde Prettier/ESLint par outil,
sans régression sur les 13 commandes des capteurs, et juge `audit` rouge sur tout rapport vide ou
mal formé. Elle rouvre deux entrées déclarées RÉSOLU le même jour :

- **J-048 ne compte rien sur la CI.** À partir de Bash 4, `command_not_found_handle` tourne dans un
  environnement séparé (manuel Bash, §3.7.2) : le `FAIL` incrémenté y est perdu. Le repli
  `trap ERR` n'était posé que sous Bash 3.2. Sur la CI (Bash 5), un appel mort affichait un X mais
  le bilan restait « 0 failed ».
- **J-049 se contourne.** Cinq formes rejouées passent la garde : redirection d'entrée, glob,
  variable, `grep -r`, et l'outil Grep, rattaché à aucun hook. L'agent en a trouvé deux de plus,
  vers le jeton lui-même : `gh auth status --show-token` et `security find-generic-password -w`.
  Sur ce poste, le jeton est dans le trousseau macOS, pas dans `hosts.yml`. Les clés SSH, elles,
  sont sur le disque.

**Leçon.**

- Un correctif se prouve sur l'environnement où il doit tenir. J-048 visait la CI, mais n'a été
  prouvé que sous le Bash 3.2 du Mac, où le mécanisme qu'il utilisait n'existe même pas.
- Pour la **lecture**, une garde qui lit le texte d'une commande est une liste noire. Elle ne sera
  jamais complète (`python3 -c`, `node -e`, `find -exec`, concaténation) : c'est la leçon de J-042
  et J-045, appliquée aux secrets. La fermeture doit venir de l'OS, avec le sandbox Bash de Claude
  Code (Seatbelt), vérifié dans la doc Anthropic.
- « RÉSOLU » ne s'écrit qu'après une revue qui a cherché à contourner le correctif.

**Réponse prévue.**

- Un trap `ERR` sans condition de version, avec `set -E`, prouvé sur des copies : preuve et
  limites dans J-048.
- Le sandbox, avec `denyRead` sur `~/.ssh` et `~/.config/gh`, plus `allowUnsandboxedCommands:
false` dans les settings utilisateur (`EN-ATTENTE.md` §3, décision de Cédric).
- La garde Bash refuse en plus les deux commandes qui affichent le jeton.

**Appliqué** (2026-10-05, session déverrouillée) :

- l'ancien §2 d'EN-ATTENTE, c'est-à-dire le trap `ERR` et le pas CI `self-test counts a dead call
(J-051)` ;
- l'ancien §4 : `check-audit-verdict.py` rend exit 1 avec un message, sans trace Python, sur un
  rapport JSON qui n'est pas un objet (`[]` par exemple). Deux cas sont au self-test.

**Sandbox appliqué le 2026-10-08** (ancien §3 d'EN-ATTENTE). `.claude/settings.json` active le
sandbox Bash (`failIfUnavailable`, `denyRead` sur `~/.ssh` et `~/.config/gh`, réseau limité à
`registry.npmjs.org`) et refuse `Read(~/.ssh/**)` et `Read(~/.config/gh/**)`. Les contournements de la
9e revue, rejoués en session (glob `~/.ss*`, chemin concaténé dans `python3 -c`), échouent en
`PermissionError` alors que `~/.config` reste lisible : c'est l'OS qui ferme, pas le texte de la
commande. Le trousseau n'est **pas** couvert, vérifié : `security find-generic-password` rend 0 sous
sandbox. La garde Bash refuse donc `gh auth status --show-token`/`-t`, `security
find-generic-password`/`find-internet-password` avec `-w`/`-g`, et `security dump-keychain -d`. Le
self-test lit les deux répertoires refusés quand il tourne sous sandbox (`SANDBOX_RUNTIME=1`). Il est
rouge sous Claude Code hors sandbox, et il saute ce cas ailleurs.

Le sandbox a révélé trois défauts du harness, corrigés dans la même passe :

- **`mktemp` sans gabarit ignore `$TMPDIR` sur macOS** et écrit dans `/var/folders/…`, que le sandbox
  refuse. `check.sh`, le self-test, `tree-hash.sh` et `post-edit-check.sh` passent donc un gabarit
  sous `${TMPDIR:-/tmp}`. Sans cela, `npm run check` cassait dans le shell de l'agent.
- **Deux échecs ouverts sur un `mktemp` raté.** `tree-hash.sh` lançait alors
  `GIT_INDEX_FILE="" git add -A`, et un `GIT_INDEX_FILE` vide est le vrai index : tout l'arbre
  s'est retrouvé indexé pendant le premier essai (désindexé aussitôt). `tmp_dir` du self-test
  rendait une chaîne vide, et les cas travaillaient sur `/`, jusqu'à un `git -C "" init` qui a tenté
  de réécrire `.git/config`, ce que le sandbox a refusé. `tree-hash.sh` sort désormais en erreur, et
  le self-test s'arrête d'entrée si `mktemp` échoue.
- **Le sandbox refuse `/dev/fd`**, donc les substitutions de processus `<(…)`. Le capteur `lock` en
  utilisait une : il aurait été rouge pour toujours dans le shell de l'agent. Il compare maintenant
  les empreintes dans `awk`, et n'affiche que les fichiers réellement modifiés.

Sous sandbox, le stage `push` est vert (hors `lock`, avant relock) : `audit` joint le registre npm,
`docs` se construit. Reste à Cédric la clé utilisateur `allowUnsandboxedCommands: false`, la seule
qui empêche l'agent de relancer une commande hors sandbox ; un projet ne peut pas la poser.

**Leçon.** Un échec ouvert ne se voit que quand l'environnement change : les deux `mktemp` sans
contrôle dormaient depuis l'origine. Toute valeur produite par une commande qui peut échouer, et
qui sert ensuite de chemin ou de variable d'environnement, se contrôle avant usage.

J-051 reste OUVERT jusqu'à la preuve de J-048 sur la CI.

**Vu par la 10e revue, à consigner comme règle** : le paramètre fictif `PROOF` laissé dans J-048,
et un renvoi vers une section supprimée d'EN-ATTENTE, auraient pu être attrapés par `docrefs`.
Il faudrait (a) refuser un renvoi « `EN-ATTENTE.md` §N » sans titre `### N.` correspondant, et
(b) refuser un mot en capitales isolé et en gras dans le journal, hors liste blanche (OUVERT,
RÉSOLU…). La 11e revue (2026-10-08) ajoute (c) : un hash de commit cité dans `docs/context/*.md`
doit être accessible depuis HEAD (`git merge-base --is-ancestor`), car un rebase rend périmé un hash
cité. La règle (a) doit tolérer une forme historique (« l'ancien §N »). C'est un changement du
harness, à décrire dans EN-ATTENTE à la prochaine passe, en lien avec J-022.

## J-052 — Première CI : ce que le Mac cachait

**Date** : 2026-10-08 · **Statut** : OUVERT — correctifs appliqués le 2026-10-08 ; preuve : la CI de la PR #3 après relock

**Observé.** La PR #3 est la première à faire tourner la CI. `security` est vert, mais `battery`
est rouge sur deux assertions du self-test (392 passed, 2 failed), alors qu'on a 395/0 en local et
dans un clone neuf sur le Mac :

- **Le commit synthétique n'a pas d'auteur.** Le runner n'a pas d'identité git, donc
  `git commit-tree` échoue (« Author identity unknown »). Le cas « range mode … large diff » échoue
  fermé, mais pour une mauvaise raison. Le Mac, lui, déduit une identité du compte système.
- **Le verrou rougit pendant le self-test.** Il est vert à l'étape « Sensors » et rouge à la
  section 7. Sous Linux, `import harness_paths` écrit `scripts/hooks/__pycache__/*.pyc` dans le
  dépôt, et le verrou voit un fichier du harness non suivi. Le Python de Xcode écrit ailleurs :
  `PYTHONPYCACHEPREFIX=~/Library/Caches/com.apple.python`, posé par son lanceur.

En cherchant la seconde cause, l'agent a trouvé un trou de sécurité. Ce cache hors du dépôt n'est
protégé par rien, et Python y charge le `.pyc` de chaque module, stdlib comprise, dès que l'en-tête
correspond à la date et à la taille du source. Un `.pyc` forgé y **remplace le source**, ce qui a
été vérifié sur un module jetable du scratchpad. Sont exposés `harness_paths` (les deux gardes), et
aussi `json`, `os` ou `subprocess`, qu'utilisent le sceau du reviewer, la liste du verrou,
check-native et le juge `audit`. Ni le verrou ni la CI ne voient ce cache.

**Leçon.**

- Un poste de développement n'est pas la CI. Identité git, OS, interpréteur : la première CI est un
  capteur à part entière, et elle a trouvé en un run ce que neuf revues sur le Mac n'avaient pas vu.
- Le harness ne protège que ce qu'il **lit**. Le bytecode est du code exécuté que personne ne lit :
  il fait partie de la surface, au même titre que les fichiers de config découverts par les outils
  (J-044, J-045).
- Un message d'échec doit dire pourquoi. « harness lock is red » sans la liste des fichiers a coûté
  une enquête.

**Réponse prévue** (`EN-ATTENTE.md` §4 et §5) :

- une identité explicite pour le commit synthétique, et un échec nommé s'il ne se crée pas ;
- le verrou rouge du self-test affiche sa liste ;
- les hooks Python lancés en `python3 -I -B -X pycache_prefix=/dev/null/mivro-nopyc` ;
- chaque script du harness qui lance `python3` exporte `PYTHONDONTWRITEBYTECODE=1` et
  `PYTHONPYCACHEPREFIX=/dev/null/mivro-nopyc` ;
- des cas au self-test, dont un `.pyc` forgé qui ne doit pas être chargé.

La PR #3 attend ces correctifs. On ne merge pas sur une CI rouge.

**Appliqué le 2026-10-08** (anciens §4 et §5 d'EN-ATTENTE), en session déverrouillée. Le self-test
passe de 395 à 418 assertions sous sandbox (416 en terminal ou en CI, où les deux cas « sandbox denies … » sont sautés). La sonde du `.pyc` forgé a un contrôle : sans les options des hooks,
le `.pyc` doit être chargé, sinon le cas ne prouverait rien. Ce contrôle a d'ailleurs attrapé une
première sonde fausse, qui restaurait la date du source d'avant la falsification. La section 12
compare les fichiers non suivis d'avant et d'après le run, pour qu'un fichier neuf du développeur ne
la fasse pas rougir. J-052 passe RÉSOLU quand `battery` est vert sur la PR #3.

## J-053 — Le self-test a commité dans le vrai dépôt

**Date** : 2026-10-08 · **Statut** : OUVERT — correctif dans `EN-ATTENTE.md` §6

**Observé.** Après la session déverrouillée du 2026-10-08, `harness/en-attente-5-8` portait deux
commits vides « init », d'auteur `selftest <selftest@mivro>`, créés à 14:05 et 14:06, un par
lancement du self-test. L'agent les a vus avant de commiter. Ils n'avaient pas été poussés, et il les
a retirés par `git reset --soft c850f23`.

La cause est dans `scratch_repo`, qui fait `git -C "$dir" commit`. Si `$dir` est vide, `git -C ""`
vise le répertoire courant, donc le vrai dépôt. Si `git init` a échoué, git remonte l'arborescence
jusqu'à un dépôt parent. Les deux cas ont été reproduits sur un faux dépôt du scratchpad. La cause
exacte de l'échec dans cette session n'est pas établie : `tmp_dir` venait de passer à
`mktemp -d "$TMPDIR/…"` pour le sandbox. Dans la session suivante, le même self-test passe
(418/0) sans toucher `HEAD`.

**Leçon.** Un outil qui doit écrire dans un bac à sable doit **prouver** qu'il y est avant d'écrire.
Avec git, cela veut dire `--git-dir` explicite, ou une vérification du `rev-parse --show-toplevel`,
jamais `-C` sur un chemin non vérifié. Et un harness qui interdit à l'agent d'écrire l'historique ne
doit pas l'écrire lui-même. L'invariant « `HEAD` et les branches inchangés » doit être vérifié à la
sortie du self-test.

**Réponse prévue** (`EN-ATTENTE.md` §6) : `scratch_repo` échoue fermé, les appelants s'arrêtent sur
son échec, et la sortie du self-test vérifie `HEAD` et les références des branches.

## J-054 — Treizième revue : le trousseau ne se ferme pas par le texte des commandes

**Date** : 2026-10-08 · **Statut** : OUVERT — `EN-ATTENTE.md` §7, décision de Cédric

**Observé.** La garde du trousseau posée au §3 de J-051 refuse `gh auth token`,
`gh auth status --show-token` et `security find-*-password -w/-g`. Quatre autres routes rendent le
même jeton, et elles ont été rejouées sur le hook (exit 0) : `security -i` sur l'entrée standard,
`gh auth git-credential get`, `git credential fill`, et `git credential-osxkeychain get`.

Le réseau ne compense pas. Depuis le sandbox, `api.github.com` et `github.com` répondent 200 alors
que `example.com` est refusé, sans que `.claude/settings.json` les autorise. L'agent avait écrit
dans la TODO et le RUNBOOK que le réseau était limité au registre npm. C'était faux : il avait pris
l'échec de `gh` (sa config est illisible sous sandbox) pour un refus réseau. La revue a mesuré au
lieu de déduire.

**Leçon.**

- C'est la troisième fois (J-042 pour l'écriture, J-051 pour la lecture de fichiers, J-054 pour le
  trousseau) : une garde qui lit le texte des commandes réduit la surface, mais ne la ferme pas. Ce
  qui ferme, c'est l'OS (sandbox), le réseau (domaines refusés) ou le privilège (jeton réduit).
- Une affirmation sur l'environnement se mesure. « Le réseau est limité » demandait un `curl`, pas
  une déduction tirée d'un message d'erreur.

**Réponse prévue** (`EN-ATTENTE.md` §7) : refuser GitHub au réseau du sandbox, et/ou un jeton à
privilèges réduits pour les sessions Claude. La garde textuelle refuse en plus les quatre routes,
avec une sonde réseau au self-test.
