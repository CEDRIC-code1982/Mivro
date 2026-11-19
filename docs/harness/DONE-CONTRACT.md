# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : EN-ATTENTE §8 — `npm run format` après collage du snippet

**Demande d'origine** : « Ok, on suit ta reco » (reco : ajouter au §8 une phrase demandant
`npm run format` après collage, en petite tâche à part avec sa propre revue). Constat du reviewer
sur `5b099eb` : l'appel `push('map.liveOnline on map.liveOnlineFill', …)` du §8 tient en 100
colonnes dans le markdown, où Prettier le garde sur une ligne, mais en fait 102 une fois indenté
dans `buildPairs`, ce qui rougirait le capteur `format`.

**Branche** : `fix/marqueurs-live-contraste`, à la suite de `cc256b1` (même branche que le §8).

**Hors périmètre explicite** :

- `src/theme/contrast.test.ts` : inchangé, le §8 reste à appliquer par Cédric en session
  déverrouillée.
- Le snippet lui-même : inchangé. Prettier le recolle à chaque formatage du markdown, une forme
  repliée à la main ne tiendrait pas.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                   | Comment on le vérifie |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | EN-ATTENTE §8 « Vérification » demande `npm run format` après collage, et dit pourquoi (100 colonnes dans le markdown, 102 indenté)                                         | relecture             |
| 2   | J-067 « Deuxième défaut » ne présente plus la ligne trop longue comme corrigée, et la règle de processus précise que la copie part du snippet tel qu'écrit dans le markdown | relecture             |

---

## Socle systématique

- [ ] `npm run check` vert.
- [ ] Les trois états rendus (loading, error, empty) pour chaque écran touché. — sans objet, doc seule.
- [ ] Toute donnée externe validée par un schéma Zod. — sans objet.
- [ ] Toute string affichée passe par `useTranslation()`. — sans objet.
- [ ] Docs de contexte mises à jour : `PROGRESS.md`, `TODO.md`, `ARCHITECTURE.md`. — sans objet : précision dans des docs du harness, aucun état du projet ne change.
- [ ] ADR si décision d'architecture. — sans objet.
- [ ] Verdict `APPROVED` du subagent `reviewer`.

---

## Ce qui reste à Cédric

- [ ] Appliquer EN-ATTENTE §8 en session déverrouillée, `npm run format`, puis `npm run harness:relock`.
