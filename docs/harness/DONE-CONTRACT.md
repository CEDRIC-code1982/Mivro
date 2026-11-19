# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Tests du suivi temps réel — deux assertions fragiles de `useRealtimeTracking.test.tsx`

**Demande d'origine** : « Ok, on suit ta reco pour les deux mineurs » (deux MINEUR de la revue de
`fix/regles-rtdb-niveau-session` : le refus de `start()` sans suivi actif ne fige pas l'absence de
`leave` ; l'assertion de publication du test « stops the tracking of another session when start is
refused » passe par `emitSample`, variable de module non réinitialisée, et dépend de l'ordre des
tests).

**Branche** : `test/suivi-temps-reel-assertions`, issue de `fix/regles-rtdb-niveau-session`
(`e1832fb`, empilée : les tests visés n'existent que sur cette branche ; écart à « issue de
`develop` » accepté par Cédric sur les branches précédentes).

**Hors périmètre explicite** :

- Code applicatif : aucun changement, seul le fichier de test change.
- Commentaires du fichier de test : aucun commentaire ajouté ni modifié, les commentaires en
  français existants restent en l'état (règle du fichier entier non déclenchée).
- Docs de contexte : le nombre de tests ne change pas (1338), aucune fonctionnalité ne change.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                                                                                  | Comment on le vérifie                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | « refuses to start tracking an ended shared copy » vérifie que `leave` n'est pas appelé quand rien n'est suivi                                                                                                                                                                             | `expect(mockLeave).not.toHaveBeenCalled()` dans le test              |
| 2   | « stops the tracking of another session when start is refused » ne dépend plus de l'ordre des tests : l'appel à `emitSample` est retiré (aucun watch n'existe dans ce test, il ne pouvait rien exercer) ; l'absence de publication reste vérifiée, avec l'absence de watch qui la garantit | relecture du test ; le test passe lancé seul (`-t`) et dans la suite |
| 3   | Aucun autre test ni fichier ne change ; 1338 tests verts                                                                                                                                                                                                                                   | `git diff --stat`, `npm run check`                                   |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché. — sans objet, aucun écran touché.
- [ ] Toute donnée externe validée par un schéma Zod. — sans objet.
- [ ] Toute string affichée passe par `useTranslation()`. — sans objet.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`. — sans objet, ni fonctionnalité ni nombre de tests ne changent.
- [ ] ADR si décision d'architecture. — sans objet.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Pousser la branche, puis PR après celle de `fix/regles-rtdb-niveau-session`.
