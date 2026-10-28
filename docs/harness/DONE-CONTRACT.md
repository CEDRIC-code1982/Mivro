# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Consigner sous J-022 trois volets mécanisables proposés par les revues de J-057

**Demande d'origine** : « consigne sous J-022 », après la liste des trois règles proposées par les
revues de J-057 pour le capteur des affirmations factuelles des docs.

**Branche** : `harness/j-022-regles-affirmations-docs`, empilée sur `harness/ouvrir-github-au-sandbox`
(`c7c92be`, PR en cours vers `develop`), car le texte cite J-057.

**Hors périmètre explicite** :

- Écrire le capteur lui-même : il touche `scripts/`, donc le harness (session déverrouillée, relock).
- Changer le statut de J-022 : il reste OUVERT, capteur à écrire.
- La proposition du reviewer sur un contrat périmé (ligne « Branche » ≠ branche courante) : soumise à
  Cédric, pas consignée sans son accord.
- Le push, la PR et le merge : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                                                    | Comment on le vérifie                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| 1   | J-022 consigne les trois volets, chacun avec l'exemple réel qu'il aurait attrapé                                                                                                                                                                             | relecture de `JOURNAL-ECHECS.md`, section J-022 |
| 2   | Chaque exemple est vrai : J-057 rédigé sans ligne d'index ; `setup-branch-protection.sh` prescrit à l'étape 5 du RUNBOOK de `develop` ; `harness/en-attente-5-8` mergée par la PR #3 (`7d6c33c`) mais encore ouverte dans le TODO et le RUNBOOK de `develop` | `git show develop:<fichier>`, `git log develop` |
| 3   | Le volet « index du journal » est réellement greffable sur le capteur `docrefs`                                                                                                                                                                              | lecture du script de `docrefs` dans `scripts/`  |
| 4   | Le statut de J-022 reste OUVERT et cohérent avec son index ; seuls `JOURNAL-ECHECS.md` et ce contrat changent                                                                                                                                                | `git diff --stat`                               |

---

## Socle systématique

- [x] `npm run check` vert.
- [x] Les trois états rendus pour chaque écran touché : aucun écran modifié.
- [x] Toute donnée externe validée : sans objet, aucun schéma modifié.
- [x] Toute string affichée passe par `useTranslation()` : aucune string ajoutée.
- [x] Docs de contexte mises à jour : sans objet, le suivi de J-022 est déjà au TODO.
- [x] ADR : aucune.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [ ] Merger la PR J-057, puis pousser cette branche et ouvrir sa PR vers `develop`.
