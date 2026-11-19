# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Marqueurs live de la carte de session — contraste sur les tuiles de carte

**Demande d'origine** : « Ok, on suit ta reco, go pour les marqueurs » (item TODO P2 « Marqueurs
live illisibles sur la carte », J-021 : `liveMarkerOnline` de `SessionMapView` utilise des tokens
calés sur les surfaces du thème, alors que les tuiles restent claires en mode sombre → ~1,78:1).
Constat en cours de tâche : le marqueur hors ligne échoue aussi, en clair comme en sombre (bordure
`border.strong` en clair ≈ 2,2:1 sur la tuile claire).

**Branche** : `fix/marqueurs-live-contraste`, issue de `test/suivi-temps-reel-assertions`
(`7d09f3b`, empilée : `PROGRESS.md`, `TODO.md` et `JOURNAL-ECHECS.md` bougent encore sur la pile ;
écart à « issue de `develop` » accepté par Cédric sur les branches précédentes).

**Hors périmètre explicite** :

- `src/theme/contrast.test.ts` (fichier du harness, ADR-016) : les paires des nouveaux tokens et
  le test de complétude de la famille `map.*` sont décrits dans `docs/harness/EN-ATTENTE.md` §8,
  à appliquer par Cédric en session déverrouillée. En attendant, les ratios sont calculés à la
  main et figurent au JOURNAL (J-067).
- `src/theme/index.ts` : les quatre tokens sont ajoutés sans commentaire (le bloc `map` explique
  déjà leur rôle, et le test de contraste est la source de vérité des ratios), pour ne pas
  déclencher la traduction des ~140 lignes de commentaires du fichier.
- Distinction en ligne / hors ligne portée par la seule teinte (WCAG 1.4.1) : inchangée ;
  l'alternative textuelle reste `LiveParticipantsList` (A11Y-006).
- Points de départ et marqueur midpoint : inchangés (remplissages pleins, hors de cet item).

---

## Conditions de fin

| #   | Condition                                                                                                                                                                                         | Comment on le vérifie                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Quatre tokens `map.liveOnline`, `map.liveOnlineFill`, `map.liveOffline`, `map.liveOfflineFill`, identiques en clair et en sombre (calés sur la tuile, comme `map.stroke`)                         | relecture de `src/theme/index.ts`, `tsc`                             |
| 2   | Le marqueur live (fond, bordure, point) n'utilise plus que ces tokens, en ligne comme hors ligne ; plus aucun token `feedback.*`, `text.*`, `surface.*` ou `border.*` sur le marqueur live        | `SessionMapView.test.tsx` (2 tests : thème clair et thème sombre)    |
| 3   | Bordure et point ≥ 3:1 sur les tuiles (claire `#F1EFE9` et blanche) et sur leur remplissage : en ligne `success[700]` ≈ 4,4:1 / 5,0:1 / 4,6:1 ; hors ligne `neutral[600]` ≈ 6,7:1 / 7,7:1 / 7,0:1 | calcul documenté en J-067 ; test du harness proposé en EN-ATTENTE §8 |
| 4   | Commentaires de `SessionMapView.tsx` en anglais (règle du fichier entier), sans perte de contenu                                                                                                  | relecture                                                            |
| 5   | Docs : TODO (item fermé), JOURNAL (J-067 + index), EN-ATTENTE §8, PROGRESS (puce + compte de tests)                                                                                               | relecture, `docmetrics`                                              |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché. — sans objet, aucun écran touché (molecule, rendu seul).
- [ ] Toute donnée externe validée par un schéma Zod. — sans objet.
- [ ] Toute string affichée passe par `useTranslation()`. — sans objet, aucune string ajoutée.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`. — `ARCHITECTURE.md` sans objet (ni module, ni couche, ni port ne change).
- [ ] ADR si décision d'architecture. — sans objet : la famille `map.*` existe déjà (J-021).
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Appliquer EN-ATTENTE §8 en session déverrouillée (paires `map.live*` et complétude de `map.*`
      dans `src/theme/contrast.test.ts`), puis `npm run harness:relock`.
- [ ] Vérifier sur appareil, en mode sombre, que les marqueurs live se détachent des tuiles.
