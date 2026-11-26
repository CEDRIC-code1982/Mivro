# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Jonction sur une session supprimée : plus de nœud orphelin avec l'adresse de l'invité

**Demande d'origine** : item TODO « Jonction sur une session supprimée (F5, RGPD) » (P2), puis
« on suit tes recos » de Cédric le 2026-11-26 sur le lot proposé : relecture `null` traitée comme
`not_found` sans `updateMidpoint`, cas de l'invité déjà membre couvert, suppression best-effort du
membre qu'on vient d'écrire (nouvelle méthode de port `removeMember`), message `not_found`
existant réutilisé, fenêtre résiduelle documentée.

**Branche** : `fix/jonction-session-supprimee`, issue de `fix/regle-meta-immuable` (7aa2ff2).

**Hors périmètre explicite** :

- Relecture qui échoue (réseau) au lieu de renvoyer `null` : comportement actuel inchangé (la
  session existe, pas d'orphelin).
- Fenêtre « suppression entre la relecture et `updateMidpoint` » : documentée comme résiduelle,
  non fermable sans transaction ni Auth.
- Tests des règles sur l'émulateur Firebase, Firebase Anonymous Auth : items TODO existants.
- Vérification sur appareil : Cédric, avec le plan de test temps réel.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                      | Comment on le vérifie                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Quand la relecture après l'écriture du membre renvoie `null`, `JoinSessionUseCase` lève `SessionShareError` `not_found` et n'appelle pas `updateMidpoint`, nouveau membre ou déjà membre       | Tests de `JoinSessionUseCase` (le test de repli sur le roster local est inversé, cas déjà membre ajouté) |
| 2   | Dans ce cas, pour un nouveau membre seulement, le use case appelle `removeMember(sessionId, memberId)` avant de lever ; pour un membre déjà présent, il ne l'appelle pas                       | Tests de `JoinSessionUseCase`                                                                            |
| 3   | Le port `ISessionShareService` expose `removeMember`, documentée « ne rejette jamais » ; l'adapter Firebase supprime `members/$memberId` et, sur échec, remonte au crash reporter sans rejeter | Tests de `FirebaseSessionShareService`, TSDoc du port                                                    |
| 4   | Aucune nouvelle string : l'invité voit le message `not_found` existant                                                                                                                         | Relecture de `useSessionShare` et de l'écran de jonction                                                 |
| 5   | `database.rules.README.md` dit le nœud orphelin fermé côté client et décrit la fenêtre résiduelle ; l'item du TODO est coché ; PROGRESS porte l'entrée du lot                                  | Relecture, capteurs docrefs, docclaims et docfacts                                                       |

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
- [ ] Vérifier sur appareil avec le plan de test temps réel (pas de redéploiement des règles : `members/$memberId` est déjà en écriture libre).
