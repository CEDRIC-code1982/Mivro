# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Erreur de suivi effacée par une publication partie après sa cause

**Demande d'origine** : « Ok, on suit ta reco » (reco : MINEUR du reviewer sur `cd64334` — deux publications qui se chevauchent, l'ancienne échoue, la récente réussit et n'efface pas l'erreur ; remplacer le compteur d'erreurs par un compteur de lancements)

**Branche** : `fix/erreur-suivi-durable`, à la suite de `cd64334`.

**Hors périmètre explicite** :

- Un utilisateur immobile garde le message jusqu'à son prochain déplacement de 10 m (« Réessayer » hors périmètre).

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                            | Comment on le vérifie                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Une erreur de suivi n'est effacée que par le succès d'une publication lancée après sa cause (coupure GPS : publications déjà lancées ; échec de publication : la publication en échec)               | tests de `useRealtimeTracking`                  |
| 2   | Le succès d'une publication plus récente efface l'échec d'une publication plus ancienne qui se chevauche avec elle, et un échec arrivé après le succès d'une publication plus récente n'est pas posé | tests de `useRealtimeTracking`                  |
| 3   | Les gardes de génération (arrêt, redémarrage, changement de session, retrait du consentement) sont inchangées                                                                                        | tests existants de `useRealtimeTracking`        |
| 4   | Chaque nouveau test rougit sans le correctif                                                                                                                                                         | mutation manuelle                               |
| 5   | PROGRESS (section, métrique de tests) à jour                                                                                                                                                         | `git diff docs/`                                |
| 6   | Un échec de publication ancien arrivé en retard ne fait pas reculer le seuil d'une coupure GPS plus récente (BLOQUANT du reviewer)                                                                   | test de non-régression de `useRealtimeTracking` |
| 7   | Le remplacement de la cause GPS par la cause réseau est consigné au TODO (P3, « ⚠️ À SPÉCIFIER AVEC CÉDRIC »)                                                                                        | `git diff docs/context/TODO.md`                 |

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
