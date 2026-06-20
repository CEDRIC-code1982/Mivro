# ADR-012 : Avatars emoji prédéfinis plutôt que SVG / photo pour le MVP

Date : 2026-06-20
Statut : Accepté
Auteur : Cédric Pineau

## Contexte

La feature F7 (Profil) doit permettre à l'utilisateur de personnaliser son
identité. Le backlog laissait ouverte la question de la nature des avatars :
SVG vectoriels custom, emoji, ou photo (cf. décision en attente « Avatars F7 »
dans `docs/context/TODO.md`).

Contraintes du MVP : pas de dette native superflue, rendu cohérent cross-platform
(iOS + Android), accessibilité (A11Y-003), et respect du Design System (DS-001 :
zéro magic number, couleurs via tokens). La photo, elle, impose une étape native
(`react-native-image-picker` + `pod install` + permissions `Info.plist` /
`AndroidManifest`) et du stockage FileSystem.

## Décision

Pour la **passe 1** de F7, les avatars sont **emoji-based** :

- Entité `core/entities/Avatar.ts` : `AvatarIdSchema` (enum de 20 ids stables),
  liste statique `AVATARS` (emoji + `backgroundColor` tirée de la palette du
  Design System), `getAvatarById` (lookup O(1), tolérant aux ids inconnus).
- Rendu via l'atom `Avatar` (`<Text>` sur fond coloré), sans aucune dépendance
  native ni asset à bundler.
- `User.avatarId` et `Participant.avatarId` (entité `MidpointSession`) référencent
  l'enum d'ids.

La **photo** (picker + resize + FileSystem) est **reportée en passe 2** comme
ajout optionnel, et non comme remplacement des avatars emoji.

## Raisons

- **Zéro dépendance native** : pas de `pod install` ni de permissions à demander
  pour la passe 1 → livrable et testable immédiatement (661 tests verts).
- **Cohérence cross-platform** : les emoji sont rendus nativement par l'OS,
  rendu homogène sans gérer de jeu d'assets SVG (poids, theming, densités).
- **Accessibilité** : chaque avatar porte un nom traduit (`profile.avatarNames.*`)
  → label exploitable par VoiceOver/TalkBack (A11Y-003).
- **Design System** : les fonds réutilisent la palette de tokens (DS-001).
- **Évolutif** : `avatarId` est un simple id ; ajouter la photo en passe 2 se fait
  par extension de l'atom `Avatar` (photo > emoji > initiale), sans migration.

## Compromis

- Le rendu exact des emoji **dépend de la police système** (variations légères
  iOS/Android/versions OS) — acceptable pour un MVP.
- 20 choix prédéfinis seulement (pas d'avatar 100 % personnalisé tant que la
  photo n'est pas livrée en passe 2).

## Alternatives écartées

- **SVG vectoriels custom** : nécessite concevoir/maintenir un jeu d'assets et le
  theming associé ; gain esthétique non justifié au stade MVP.
- **Photo uniquement** : impose d'emblée l'étape native + permissions + stockage,
  retarde la livraison ; conservée en passe 2 comme option complémentaire.
