# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Erreur de suivi durable sur la carte

**Demande d'origine** : « Ok, on suit ta reco » (reco : item TODO P2 « Erreur de suivi effacée par le prochain instantané » ; séparer l'erreur de suivi de l'état de connexion ; le bouton reste sur « Arrêter le partage » pendant l'erreur)

**Branche** : `fix/erreur-suivi-durable`, issue de `fix/erreurs-temps-reel-carte` (`f365aa7`), la pile n'étant pas encore fusionnée dans `develop`.

**Hors périmètre explicite** :

- L'annonce VoiceOver d'un refus répété (TODO P3, à confirmer sur appareil).
- Un bouton « Réessayer » sur le message.
- Le sort de la session locale de l'invité (« ⚠️ À SPÉCIFIER AVEC CÉDRIC »).

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                    | Comment on le vérifie              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | `useRealtimeStore` porte l'erreur de suivi (`trackingErrorCode`, `setTrackingError`) à part de l'état de connexion (`status`, `errorCode`) ; `startTracking` et `stopTracking` la remettent à `null`                         | tests de `useRealtimeStore`        |
| 2   | Les erreurs du watch GPS (callback et lancement) et de la publication posent l'erreur de suivi, plus le `status` ; un instantané des participants (`setStatus('connected')`) ne l'efface pas                                 | tests de `useRealtimeTracking`     |
| 3   | L'erreur de suivi s'efface à la première publication réussie, au retrait du consentement, au redémarrage et à l'arrêt du suivi ; une erreur de publication arrivée après l'arrêt ou le changement de session n'est pas posée | tests de `useRealtimeTracking`     |
| 4   | `MapScreen` affiche l'erreur de suivi en priorité, sinon l'erreur de connexion ; le message reste affiché quand un instantané pose `connected`, et le bouton reste « Arrêter le partage »                                    | tests d'intégration de `MapScreen` |
| 5   | Commentaires de `useRealtimeStore.ts` tous en anglais (règle du fichier entier)                                                                                                                                              | `git diff`                         |
| 6   | TODO (item P2 coché), PROGRESS (section, métrique de tests) et ARCHITECTURE (store temps réel) à jour                                                                                                                        | `git diff docs/`                   |

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
