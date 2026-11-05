# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : retouches de rédaction d'`EN-ATTENTE.md` laissées par la dernière revue du lot E

**Demande d'origine** : « fais les retouches de rédaction d'EN-ATTENTE »

**Branche** : `harness/finition-lots-a-e`, après le lot E (`598c28f`), avant le relock et le push.

**Hors périmètre explicite** :

- Tout changement de code de la garde : les variantes citées restent des limites (règle de J-058).
- Le commit : sur demande de Cédric. Le relock, le push et la PR : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                | Comment on le vérifie                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 1   | La section « Appliqué » ne laisse plus croire fermées les variantes de la 2e revue du lot E                                                                              | relecture d'`EN-ATTENTE.md`                   |
| 2   | `curl -w @fichier`, refusé partout, est listé parmi les faux positifs de §6                                                                                              | relecture ; sonde de la garde                 |
| 3   | Le faux positif « `new` » est décrit comme la règle l'applique (le mot nu `open`, `new` ou `FileIO` ; un littéral de r, b, t, U autour de w, a, x ou +, `'tab'` compris) | relecture ; sonde de la garde                 |
| 4   | Sous « limite de nature », les exemples `fs.openSync(…, 'w')`, mode passé par une variable et Perl `sysopen` sont cités, avec leur verdict vérifié                       | sonde de la garde, verrouillé et déverrouillé |
| 5   | Aucun autre fichier que `EN-ATTENTE.md` et ce contrat ne change                                                                                                          | `git status`                                  |

---

## Socle systématique

- [ ] `npm run check` vert (`lock` s'abstient en session déverrouillée, relock à Cédric).
- [x] Les trois états rendus (loading, error, empty) pour chaque écran touché : aucun écran.
- [x] Toute donnée externe validée par un schéma Zod : sans objet.
- [x] Toute string affichée passe par `useTranslation()` : aucune string.
- [x] Docs de contexte mises à jour : la tâche est elle-même une mise à jour de doc.
- [x] ADR si décision d'architecture : aucune.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Décider du commit de ces retouches, puis `npm run harness:relock`, push et PR.
