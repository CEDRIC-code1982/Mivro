# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Cause GPS prioritaire dans l'erreur de suivi, et Jest qui rend la main sur les tests TanStack Query

**Demande d'origine** : décision de Cédric du 2026-11-26 (« on suit tes recos ») : « cause GPS >
cause réseau dans `trackingErrorCode` (un seul champ) » ; puis « on enchaîne sur le lot
suivant » : ce lot, avec le blocage de Jest sur les tests TanStack et les deux mineurs relevés
par le reviewer sur `fix/jonction-invite-fin-de-session`.

**Branche** : `fix/cause-gps-et-blocage-jest`, issue de `fix/jonction-invite-fin-de-session` (01b7826).

**Hors périmètre explicite** :

- Afficher les deux causes à la fois (deux champs) : écarté par Cédric, un seul champ.
- Corriger les deux mineurs du reviewer (brouillon recréé par l'onglet Création après une fin de
  session distante, propriétaire qui ouvre son propre lien d'invitation) : seulement inscrits au
  TODO ; le second est « ⚠️ À SPÉCIFIER AVEC CÉDRIC ».
- `--forceExit` dans la config Jest : écarté, il masquerait les vraies fuites.
- Test sur appareil du temps réel : reporté par Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                      | Comment on le vérifie                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | Une erreur GPS affichée (`unavailable`, `timeout`, `permission_blocked`…) n'est pas remplacée par l'échec d'une publication lancée **avant** elle                              | Test de `useRealtimeTracking` : assertion « keeps a GPS error… » resserrée sur `'unavailable'` |
| 2   | L'échec d'une publication lancée **après** l'erreur GPS (un nouvel échantillon est arrivé, le GPS est revenu) remplace la cause GPS par sa propre cause                        | Test de `useRealtimeTracking` dédié                                                            |
| 3   | Une erreur GPS remplace toujours une erreur de publication ; l'effacement de l'erreur (publication réussie lancée après sa cause, retrait du consentement, arrêt) est inchangé | Tests existants de `useRealtimeTracking` verts                                                 |
| 4   | `npx jest <fichier>` se termine seul (sans `--forceExit`) sur chaque test qui utilise `createQueryClientWrapper` ou un `QueryClient` de test                                   | Commande lancée fichier par fichier sous `timeout 60`, code de sortie 0                        |
| 5   | La correction de Jest est dans les utilitaires de test (pas de `--forceExit`, pas de `gcTime` de prod modifié pour les tests)                                                  | Relecture du diff                                                                              |
| 6   | Le TODO coche « Cause GPS remplacée par une cause réseau » et « Jest ne rend pas la main », et ajoute les deux mineurs du reviewer                                             | Relecture, capteurs `docfacts` et `docclaims`                                                  |

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

- [ ] Pousser la branche ; pas de PR tant que le verrou de facturation GitHub tient.
