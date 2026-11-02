# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

---

## Tâche

**Titre** : Ménage après le lot 5 — lignes périmées du TODO, test réel du deep linking

**Demande d'origine** : « ok fais le ménage », sur la liste proposée après la PR #7 :

- retirer du TODO les lignes périmées (« Bloque la PR #3 », « EN-ATTENTE §1 », « Reste
  `npm run harness:relock` ») ;
- ajouter un test `getStateFromPath` sans mock sur la config de `linking.ts`, comme l'a demandé
  le reviewer du lot 5.

**Branche** : `chore/menage-apres-lot-5`, issue de `develop` (`0325a23`).

**Hors périmètre explicite** :

- Remettre ce fichier à son modèle vierge. Le reviewer rend `NO_CONTRACT` sur un contrat vide,
  donc ce reset ne peut pas passer par un commit relu. C'est le volet « contrat périmé » de J-022,
  qui reste ouvert : ce contrat-ci remplace celui du lot 5.
- Changer le statut des entrées du journal (J-048, J-052) : le journal est un fichier du harness.
- Les autres lignes du TODO dont l'état n'est pas prouvé : je les signale à Cédric sans y toucher.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                      | Comment on le vérifie                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Les trois lignes du TODO sont barrées ou corrigées, avec leur preuve : PR #3 mergée (`7d6c33c`), EN-ATTENTE §1 appliqué au lot 2 (`EN-ATTENTE.md:32`), verrou refait le 2026-11-02 (`33a25dd`) | `git diff docs/context/TODO.md`, `git log`             |
| 2   | `linking.test.ts` appelle le vrai `getStateFromPath` de `@react-navigation/native`, sans mock, sur la config de `linking.ts`                                                                   | lecture du test, `grep jest.mock` vide dans le fichier |
| 3   | Le test couvre `session/abc-123` (`JoinSession`, `sessionId`), `session/a%20b` (décodé), `map` (`Tabs` › `Map`), et un `%` mal formé (`session/abc%`) qui ne lève pas d'exception              | `npx jest src/navigations/linking.test.ts`             |
| 4   | Le test échoue si le mapping casse : vérifié en changeant le pattern `session/:sessionId`, puis restauré                                                                                       | essai manuel, décrit dans le rapport                   |
| 5   | Tous les commentaires de `linking.test.ts` sont en anglais (règle du fichier entier) ; aucun fichier du harness ne change (`lock` vert sans relock)                                            | lecture, `npm run check`                               |

---

## Socle systématique

- [x] `npm run check` vert.
- [x] Les trois états rendus pour chaque écran touché : aucun écran modifié.
- [x] Toute donnée externe validée : sans objet, aucun schéma modifié.
- [x] Toute string affichée passe par `useTranslation()` : aucune string ajoutée.
- [x] Docs de contexte mises à jour : `TODO.md`.
- [x] ADR : aucune.
- [ ] Verdict `APPROVED` du subagent `reviewer` sur l'arbre final.

---

## Ce qui reste à Cédric

- [ ] Push de `chore/menage-apres-lot-5`, PR vers `develop`, merge si la CI est verte.
