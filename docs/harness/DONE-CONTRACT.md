# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Étape 1 — câblage natif Firebase (F4/F5) + correction des docs périmées

**Demande d'origine, en une phrase** : « Vérifie l'étape 1, j'ai mis le GoogleService-Info.plist
dans Xcode ; si tu as besoin de compléter l'installation pour iOS et Android, les fichiers sont
dans mon dossier Téléchargements » puis « j'ai déplacé le plist dans `ios/Mivro/`, fais les
commandes pour finir l'étape 1 et enchaîne sur l'étape 2 ».

**Hors périmètre explicite** : `firebase login` et `firebase deploy --only database` (compte Google
de Cédric, hors de ma portée) ; le rebuild natif et les vérifs device ; les étapes 3 à 6 du plan.

---

## Conditions de fin

| #   | Condition                                                      | Comment on le vérifie                                                                              |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Le plist iOS est réellement embarqué dans le bundle            | `project.pbxproj` : `path` résout vers un fichier existant **et** présence dans la phase Resources |
| 2   | La config Android est en place et cohérente avec iOS           | `google-services.json` dans le module app ; même `project_id` et `project_number` que le plist     |
| 3   | L'URL RTDB est fournie à l'app                                 | `.env` existe et porte `FIREBASE_DATABASE_URL` en `europe-west1`                                   |
| 4   | Aucun fichier de config Firebase ni `.env` n'est suivi par git | `git check-ignore` sur les 3 fichiers ; `git status` ne les montre pas                             |
| 5   | Le projet Firebase est lié en CLI                              | `.firebaserc` présent avec l'alias `default` = `mivro-40125`                                       |
| 6   | Plus aucune doc ne mentionne l'ancien bundle id comme actuel   | `grep cedricpineau.midpoint` : seules restent des mentions historiques ou barrées                  |
| 7   | Le contrat précédent est formellement clos                     | ses 7 conditions revérifiées une par une, résultat consigné                                        |
| 8   | Aucune régression                                              | `npm run check` exit 0 (1226 tests) et `npm run check:harness` 64/64                               |

---

## Socle systématique

- [x] `npm run check` vert (typecheck + lint + format + `check:arch` + `check:diff` + tests).
- [x] Les trois états rendus pour chaque écran touché — aucun écran modifié.
- [x] Toute donnée externe validée par Zod — aucune nouvelle source de données.
- [x] Toute string affichée passe par `useTranslation()` — aucune string ajoutée.
- [x] Docs de contexte mises à jour : `RUNBOOK.md` (procédure d'enregistrement Firebase),
      `TODO.md` (bundle id, prérequis `.env`), `PROGRESS.md` (métriques + bundle id).
- [ ] ADR : aucun — pas de décision d'architecture, uniquement du câblage et de la correction
      documentaire.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] `firebase login` puis `firebase deploy --only database` (compte Google requis).
- [ ] Vérifier dans la console : Realtime Database → Règles affiche bien `database.rules.json`
      (racine en `read: false` / `write: false`), pas les règles all-deny par défaut.
- [ ] Rebuild natif : `react-native-config` lit `.env` au build, pas au reload Metro.
- [ ] Vérifs device F4/F5 : deux appareils dans une même session, le marqueur de l'un doit bouger
      chez l'autre en 1-2 s.

---

## Hypothèses prises

- Le plist déplacé à la main dans `ios/Mivro/` devait **rester** à cet emplacement : j'ai corrigé
  la référence Xcode plutôt que de remettre le fichier à la racine de `ios/`.
- `.firebaserc` est versionné (config projet, pas un secret), contrairement aux deux fichiers de
  config Firebase et au `.env` qui restent gitignorés.
- L'ajout de `google-services.json` et du plist à `.prettierignore` est le bon geste : ce sont des
  fichiers générés par une console tierce, leur format ne nous appartient pas.

---

## Clôture du contrat précédent (palette indigo + DOC-004 + archi)

Le travail avait été commité (`b153b92`, `1d077a9`) **sans** que le verdict `reviewer` soit
consigné. Ses 7 conditions ont été revérifiées mécaniquement le 2026-08-24 :

| #   | Condition                                          | Résultat                                                            |
| --- | -------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Travail sur `develop`, `main` intacte              | ✅ `develop` ; `main` = `de6b15c`, inchangée                        |
| 2   | Aucune paire du thème n'échoue WCAG AA             | ✅ `PENDING_DESIGN_DECISION` vide (0 paire en dette)                |
| 3   | La marque reste l'indigo voulu                     | ✅ `palette.brand[500]` = `#6366F1`                                 |
| 4   | `npm run docs` passe sans erreur                   | ✅ exit 0, Docusaurus compile                                       |
| 5   | DOC-004 est un capteur, plus une règle de jugement | ✅ 0 occurrence dans `CLAUDE.md`, 4ᵉ garde du pre-push              |
| 6   | Plus d'exemption de grandfathering en archi        | ✅ le seul `pathNot` restant est la logique « pas la même feature » |
| 7   | Aucune régression                                  | ✅ `npm run check` exit 0 ; `check:harness` 64/64                   |

Contrat objectivement satisfait. Seule la trace formelle manquait — elle est ici.
