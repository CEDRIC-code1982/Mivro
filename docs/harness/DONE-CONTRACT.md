# DONE-CONTRACT — condition de « terminé »

> Contrat de la tâche en cours. Une fois la tâche livrée, ce fichier est remis à son modèle vierge
> (le contrat rempli part dans le message de commit).

<!-- Modèle vierge : `docs/harness/DONE-CONTRACT.modele.md`. Remettre le contrat à zéro, c'est
     copier ce fichier sur `DONE-CONTRACT.md` ; le reviewer juge alors le commit sur le contrat
     de HEAD, et `scripts/check-contract.sh` le voit vierge (JOURNAL J-022). -->

---

## Tâche

**Titre** : Dette F7 (photo de profil, avatars) et liste des ADR de POLICIES à jour

**Demande d'origine** : « c'est poussé, on enchaîne sur le lot suivant » (2026-11-26) : le lot
dette F7 du TODO (`normalizePath`, TSDoc de `deletePhoto`, fallback de `AvatarPicker`,
`cameraType: 'front'` gardé et documenté, décision de Cédric du même jour).

**Branche** : `fix/dette-f7`, issue de `fix/cause-gps-et-blocage-jest` (bfb94d6).

**Hors périmètre explicite** :

- Règle `meta` provisoire (`".write": "newData.exists()"`, F5) : lot à part, déploiement des
  rules par Cédric.
- Vérification sur appareil de la photo de profil : reportée.

---

## Conditions de fin

| #   | Condition                                                                                                                                                                 | Comment on le vérifie                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | `normalizePath` ne retire le préfixe `file://` qu'en tête et décode les caractères encodés (espaces, accents) ; une URI mal encodée retombe sur le chemin brut sans lever | Tests de `ImagePickerProfilePhotoService` : chemin encodé, chemin sans préfixe, `%` invalide |
| 2   | La TSDoc de `IProfilePhotoService.deletePhoto` dit que la méthode ne rejette jamais (best-effort), et l'adapter tient ce contrat                                          | Relecture ; test de l'adapter : `unlink` qui rejette → la promesse se résout                 |
| 3   | Le `fallbackName={avatar.emoji}` de `AvatarPicker` est documenté comme inatteignable pour un id connu                                                                     | Relecture ; tests de `AvatarPicker` verts                                                    |
| 4   | `cameraType: 'front'` est gardé et documenté comme choix produit de Cédric (2026-11-26)                                                                                   | Relecture du commentaire à l'endroit du choix                                                |
| 5   | `POLICIES.md` liste les ADR jusqu'à 016, et la section « ADR rattrapage » ne dit plus qu'il en manque                                                                     | Relecture, capteurs `docrefs` et `docclaims`                                                 |
| 6   | Les quatre items F7 du TODO sont cochés                                                                                                                                   | Relecture, capteur `docfacts`                                                                |

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
