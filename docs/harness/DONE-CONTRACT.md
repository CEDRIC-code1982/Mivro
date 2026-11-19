# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Règles RTDB — accès au niveau `sessions/$sessionId` pour le partage F5

**Demande d'origine** : « Ok, on suit tes reco, go pour A » (n°1 = item TODO P2/P3 « Rules :
`sessions/$sessionId` sans `$other: false` » ; diagnostic : les règles déployées n'accordent rien au
niveau de la session, alors que `FirebaseSessionShareService` y fait `get`, `onValue`, `update` et
`remove`, et `FirebaseRealtimeService` lit le nœud `participants` → refus RTDB, les règles n'étant
pas des filtres ; option A retenue : ouvrir ce niveau strictement, sans toucher au client). Puis,
après la revue : « Ok, on suit tes reco, corrige le re-partage sur la branche » (le re-partage
d'une session déjà partagée, refusé par ces règles, réutilise le lien existant). Puis, après la
revue suivante : « Ok, on suit tes reco » (une copie locale de session partagée n'est jamais
republiée après la fin distante, qu'on soit invité ou propriétaire ; effacement de la copie locale
et re-création côté règles laissés au TODO). Puis, après la revue suivante : « go pour tes recos »
(le suivi F4 d'une copie de session partagée s'arrête à la fin distante, sur cette branche ; le
refus de `share()` faute de deux participants met aussi le store partagé en erreur ; la séquence
« suivi actif → suppression par le propriétaire → point GPS suivant → nœud absent » est ajoutée à
J-066 et à l'item émulateur du TODO). Puis, après la revue suivante : « Ok, on suit ta reco, go
pour A » (un consentement donné sans suivi actif, après un `start()` refusé, est retiré par le
hook ; `MapScreen` inchangé). Puis, après la revue suivante : « Ok on suit ta reco » (un
`start()` refusé arrête d'abord tout suivi en cours, d'une autre session y compris ; l'exemple TSDoc
de `RealtimeConsentModal` est remis dans le bon ordre ; la séquence « suivi actif sur A → rejoindre
B → fin distante de B → Accepter » est ajoutée à J-066).

**Branche** : `fix/regles-rtdb-niveau-session`, issue de `fix/poi-carte-etats` (`538b2ae`, empilée :
`PROGRESS.md` et `TODO.md` bougent encore sur la pile ; écart à « issue de `develop` » accepté par
Cédric sur les branches précédentes).

**Hors périmètre explicite** :

- Code client (option B écartée) : aucun changement des adapters RTDB ; seuls `useSessionShare`,
  `loadSharedSession`, l'entité `MidpointSession` et `useRealtimeTracking` changent (conditions 7
  à 12), plus la clé i18n `realtime:errors.closed` et les commentaires de `RealtimeConsentModal`
  (exemple TSDoc corrigé, commentaires traduits ; aucun code). `MapScreen` reste inchangé, y compris son
  titre d'erreur existant ; l'erreur du suivi temps réel n'est affichée nulle part (défaut
  existant, signalé à Cédric).
- Effacement de la copie locale d'une session partagée terminée : TODO, à spécifier avec Cédric.
- Tests des règles sur l'émulateur Firebase : nouvelle dépendance (`@firebase/rules-unit-testing`)
  et Java, décision de Cédric ; item TODO existant, mis à jour.
- Firebase Anonymous Auth : dette connue, inchangée.
- Purge `expiresAt` : `functions/index.js` existe ; l'état de son déploiement est à confirmer par
  Cédric avant de toucher au TODO correspondant.
- Déploiement des règles (`firebase deploy --only database`) et vérification sur appareil : Cédric.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                                                                                   | Comment on le vérifie                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | `sessions/$sessionId` accorde `.read` (lecture de la session entière et du nœud `participants`)                                                                                                                                                             | test structurel des règles                                                |
| 2   | `sessions/$sessionId` n'accorde `.write` que pour créer une session (pas encore de `meta`) ou la supprimer en entier                                                                                                                                        | test structurel (expression exacte)                                       |
| 3   | `sessions/$sessionId/$other` refusé (`.validate: false`) : aucun nœud frère de `meta`, `members`, `participants`                                                                                                                                            | test structurel                                                           |
| 4   | Les règles existantes de `meta`, `members/$memberId` et `participants/$participantId` sont inchangées (droits, validations, immuabilité, `$other`)                                                                                                          | test structurel + diff de `database.rules.json`                           |
| 5   | Chaque appel du client au niveau session (`get`, `onValue`, `update` meta+members, `remove`, lecture `participants`) est couvert par une règle, raisonnement documenté                                                                                      | `database.rules.README.md`                                                |
| 6   | Docs à jour : TODO (item fermé, item émulateur précisé), RUNBOOK (dette retirée, redéploiement à faire), README des règles, PROGRESS                                                                                                                        | relecture                                                                 |
| 7   | Re-partage : une session déjà partagée (store partagé sur le même id, propriétaire ou invité) réutilise son lien et rouvre la share sheet, sans publier ; sinon publication inchangée                                                                       | `useSessionShare.test.tsx` (5 tests)                                      |
| 8   | Session terminée : une session chargée depuis le partage est marquée `isSharedCopy` ; sans store partagé sur son id, `share()` ne publie pas et renvoie l'erreur `closed`                                                                                   | `useSessionShare.test.tsx` (2 tests), `useSessionStore.test.ts` (3 tests) |
| 9   | Suivi F4 d'une copie de session partagée : arrêté (nœud de position retiré, plus de publication) dès que le store partagé ne porte plus son id ; démarrage refusé sur une copie terminée (erreur `closed`) ; inchangé pour une session non issue du partage | `useRealtimeTracking.test.tsx` (4 tests)                                  |
| 10  | `share()` refusé faute de deux participants : erreur `unknown` dans le hook **et** dans le store partagé                                                                                                                                                    | `useSessionShare.test.tsx` (1 test complété)                              |
| 11  | Consentement de partage sans suivi actif (après un `start()` refusé) : remis à false, aucun watch GPS ; inchangé après un `start()` réussi                                                                                                                  | `useRealtimeTracking.test.tsx` (2 tests)                                  |
| 12  | `start()` refusé alors qu'une autre session est suivie : ce suivi est arrêté (nœud retiré par `leave`), aucune session suivie ensuite, consentement retiré, aucune publication ; erreur `closed`                                                            | `useRealtimeTracking.test.tsx` (1 test)                                   |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché. — sans objet, aucun écran touché (le hook garde `isBusy` et `errorCode`).
- [ ] Toute donnée externe validée par un schéma Zod. — sans objet, pas de nouvelle donnée lue.
- [ ] Toute string affichée passe par `useTranslation()`. — sans objet.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`. — `ARCHITECTURE.md` : champ `isSharedCopy?` ajouté à la ligne de l'entité `MidpointSession` ; ni module, ni couche, ni adapter ne change.
- [ ] ADR si décision d'architecture. — pas d'ADR : le modèle d'accès (capability URL, sans auth) ne change pas ; les règles sont mises en conformité avec le client existant, raisonnement dans `database.rules.README.md`.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Déployer les règles : `firebase deploy --only database`.
- [ ] Sur deux appareils : créer un partage, le rejoindre par le lien, voir les positions en temps réel, appuyer une seconde fois sur « Partager » (même lien, pas d'alerte), puis, pendant que l'invité partage sa position, réinitialiser côté propriétaire (session supprimée, aucun nœud `sessions/<id>` réapparu après le point GPS suivant de l'invité, bouton revenu à « Partager ma position »).
- [ ] Confirmer si la Cloud Function `purgeExpiredSessions` est déployée (TODO purge `expiresAt`).
