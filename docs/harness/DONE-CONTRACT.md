# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Erreurs du temps réel affichées sur la carte

**Demande d'origine** : « Ok, on suit ta reco, session locale hors périmètre » (reco : faire afficher par `MapScreen` les erreurs de `useRealtimeStore`, aujourd'hui posées sans être montrées — TODO, défaut existant cité dans l'item « Copie locale d'une session partagée terminée »)

**Branche** : `fix/erreurs-temps-reel-carte`, issue de `fix/marqueurs-live-contraste` (`aa46bd6`), la pile n'étant pas encore fusionnée dans `develop`.

**Hors périmètre explicite** :

- Vider ou garder la session locale de l'invité quand la session distante se termine : « ⚠️ À SPÉCIFIER AVEC CÉDRIC », reste au TODO.
- Un bouton « Réessayer » ou « Fermer » sur le message : le message disparaît au prochain démarrage du suivi ou à sa fin ; à spécifier si voulu.
- Les erreurs du partage (`useSharedSessionStore`), déjà affichées par une alerte.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                               | Comment on le vérifie                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Quand `useRealtimeStore.status` vaut `error`, le pied de carte affiche `realtime:errors.<code>` (repli sur `realtime:errors.unknown` pour un code inconnu), en `text.error`, avec le rôle `alert` et une région live polie              | tests d'intégration de `MapScreen`                   |
| 2   | Sous iOS, le message est annoncé à VoiceOver (`AccessibilityInfo.announceForAccessibility`) une fois par message nouveau ; sous Android, TalkBack le lit par la région live, sans annonce en double                                     | tests d'intégration (espion, `Platform.OS` remplacé) |
| 3   | Le message disparaît dès que le statut quitte `error` (redémarrage ou arrêt du suivi)                                                                                                                                                   | test d'intégration                                   |
| 4   | Scénario de l'invité : « Partager ma position » puis « Accepter » sur une session partagée terminée affiche « Cette session est terminée. »                                                                                             | test d'intégration (`start` simulé posant `closed`)  |
| 5   | Commentaires de `MapScreen.tsx` tous en anglais (règle du fichier entier)                                                                                                                                                               | `git diff`                                           |
| 6   | TODO (défaut retiré de l'item « Copie locale d'une session partagée terminée »), PROGRESS (section et métrique de tests) et ARCHITECTURE (ligne `MapScreen`) à jour                                                                     | `git diff docs/`                                     |
| 7   | Un refus de la localisation pendant le suivi affiche « La localisation est bloquée. Active-la dans les réglages. » (`permission_blocked`), et non le texte du refus du service temps réel ; un refus Firebase garde `permission_denied` | tests de `useRealtimeTracking`                       |
| 8   | JOURNAL-ECHECS J-068 (collision des codes `permission_denied`) ; TODO : message de suivi effacé par le prochain instantané, annonce VoiceOver absente sur un refus répété                                                               | `git diff docs/`                                     |

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

- [ ] Vérifier sur appareil l'annonce VoiceOver/TalkBack du message et son rendu en Dynamic Type 200 %.
- [ ] Trancher le sort de la session locale de l'invité (TODO).
- [ ] Commit sur demande.
