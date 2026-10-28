# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : GitHub au sandbox — essai, mesure, retour à J-054 (J-057)

**Demande d'origine** : « ouvre GitHub au sandbox ». Essai sur `github.com` seul. La revue a montré
que le push de l'agent ne marchait pas, et qu'une route de push sans garde s'ouvrait par `GH_TOKEN`.
Cédric a retenu la recommandation : refermer, et consigner.

**Branche** : `harness/ouvrir-github-au-sandbox`, depuis `develop` (`18bdb6c`).

**Hors périmètre explicite** :

- Durcir la garde contre `git remote-*` et les URL à jeton : sans objet tant que GitHub est refusé.
- Retirer `GH_TOKEN` et `GIT_ASKPASS` du shell qui lance `claude` : décision de Cédric, au TODO.
- Le commit, le push, la PR et le merge : Cédric.

---

## Conditions de fin

| #   | Condition                                                                   | Comment on le vérifie                      |
| --- | --------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Aucun fichier du harness ne diffère de `develop`                            | `git diff --stat develop` : docs seulement |
| 2   | `github.com` et `api.github.com` sont de nouveau refusés                    | sonde du self-test, `sandbox_violations`   |
| 3   | J-057 consigne l'essai, les mesures, la route découverte et la décision     | relecture, capteur `docrefs`               |
| 4   | Le TODO dit l'état réel : jeton en place, restes de J-057, ruleset consigné | relecture                                  |

---

## Socle systématique

- [x] `npm run check` vert.
- [x] Les trois états rendus pour chaque écran touché : aucun écran modifié.
- [x] Toute donnée externe validée : sans objet, aucun schéma modifié.
- [x] Toute string affichée passe par `useTranslation()` : aucune string ajoutée.
- [x] Docs de contexte mises à jour : `TODO.md`, `RUNBOOK.md` (protection, place du jeton), `EN-ATTENTE.md`, J-057 et son index.
- [x] ADR : aucune, la décision reste celle de J-054.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [ ] Commit sur demande, push de `harness/ouvrir-github-au-sandbox`, PR vers `develop`.
