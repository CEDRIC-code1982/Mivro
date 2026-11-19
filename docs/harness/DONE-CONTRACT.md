# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Courses des publications en vol sur l'erreur de suivi

**Demande d'origine** : « Ok, on suit ta reco » (reco : corriger les trois MINEURS du reviewer sur `de42b6b` — une publication ancienne efface une erreur GPS plus récente ; la garde compare la session, pas le cycle de suivi ; changement de session et redémarrage non testés côté hook)

**Branche** : `fix/erreur-suivi-durable`, à la suite de `de42b6b`.

**Hors périmètre explicite** :

- Un utilisateur immobile garde le message jusqu'à son prochain déplacement de 10 m (comportement du contrat précédent, « Réessayer » hors périmètre).
- La piste « test de mutation » dans JOURNAL-ECHECS (le reviewer a attrapé le trou, rien n'a échappé au harness).

---

## Conditions de fin

| #   | Condition                                                                                                                                             | Comment on le vérifie          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | Le succès d'une publication n'efface pas une erreur de suivi posée après son lancement                                                                | test de `useRealtimeTracking`  |
| 2   | Le succès ou l'échec d'une publication lancée avant un arrêt du watch (arrêt, redémarrage, changement de session, retrait du consentement) est ignoré | tests de `useRealtimeTracking` |
| 3   | Chaque nouveau test rougit sans le correctif                                                                                                          | mutation manuelle              |
| 4   | PROGRESS (section, métrique de tests) à jour                                                                                                          | `git diff docs/`               |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché.
- [ ] Toute donnée externe validée par un schéma Zod.
- [ ] Toute string affichée passe par `useTranslation()`.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`.
- [ ] ADR si décision d'architecture.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Vérifier sur appareil : couper la localisation pendant un partage actif, le message reste affiché malgré les positions des autres.
- [ ] Commit sur demande.
