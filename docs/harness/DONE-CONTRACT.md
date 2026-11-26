# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Jonction d'un invité sans profil ni session, et fin de session visible côté invité

**Demande d'origine** : liste de dette du 2026-11-26, « on suit tes recos » :

- élément 1 : créer automatiquement le profil invité à la jonction ;
- élément 2 : à la fin d'une session côté invité, afficher « session terminée » et purger la copie locale.

Puis, quand il est apparu que la jonction lit le point de départ dans la session locale de
l'invité (qu'un nouvel utilisateur n'a pas), choix de Cédric : « Point de départ à la jonction ».

**Branche** : `fix/jonction-invite-fin-de-session`, issue de `fix/erreur-suivi-durable` (10941cc).

**Hors périmètre explicite** :

- Vérifier que la session existe (introuvable, expirée, terminée, pleine) **avant** de demander le
  point de départ : l'erreur arrive après le choix, au moment de rejoindre, avec les messages
  existants. Amélioration possible plus tard, à proposer à Cédric.
- Test sur appareil (cas T2 et T9 du plan temps réel) : reporté par Cédric (« on testera plus
  tard »).
- Cause GPS contre cause réseau dans l'erreur de suivi, et blocage de Jest sur les tests TanStack :
  lot suivant.
- Annonce VoiceOver d'un refus répété : à confirmer d'abord sur appareil (TODO).

---

## Conditions de fin

| #   | Condition                                                                                                                                                                          | Comment on le vérifie                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Un appareil sans profil qui rejoint une session reçoit un profil invité (`signInAsGuest`, ADR-004) au lieu de l'erreur `no_user`                                                   | Test de `useSessionShare` : `user` nul → invité créé, jonction OK |
| 2   | `JoinSession` demande le point de départ avant de rejoindre : « Utiliser ma position » (GPS) ou saisie d'adresse (`AddressAutocomplete` réutilisé)                                 | Tests de `JoinSessionScreen` sur les deux chemins                 |
| 3   | Le membre publié porte le point de départ choisi à la jonction, et non celui de la session locale                                                                                  | Test de `useSessionShare` : `startLocation` transmis au use case  |
| 4   | `JoinSession` rend ses états (ERR-003) : chargement (GPS, jonction), erreur avec action (GPS refusé ou indisponible, jonction refusée), succès                                     | Tests de `JoinSessionScreen` par état                             |
| 5   | Côté invité (non propriétaire), la disparition du nœud distant vide la session locale, purge l'état partagé, arrête le suivi temps réel et affiche une alerte « session terminée » | Tests de `useSharedSessionSync` et de `MapScreen`                 |
| 6   | Côté propriétaire, rien ne change : pas d'alerte quand il termine lui-même sa session                                                                                              | Test de `useSharedSessionSync` (`isOwner: true`)                  |
| 7   | Toute nouvelle string est en FR et EN, cibles tactiles ≥ 44 pt, libellé et `accessibilityHint` sur les nouveaux contrôles                                                          | Capteurs i18n et a11y, relecture                                  |
| 8   | Les items du TODO résolus sont cochés (copie locale d'une session terminée), et la jonction est décrite dans `ARCHITECTURE.md`                                                     | Relecture, capteurs `docfacts` et `docclaims`                     |

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

- [ ] Tester sur appareil la jonction d'un invité neuf (cas T2) et la fin de session vue par
      l'invité (cas T9) : plan en attente.
- [ ] Pousser la branche ; pas de PR tant que le verrou de facturation GitHub tient.
