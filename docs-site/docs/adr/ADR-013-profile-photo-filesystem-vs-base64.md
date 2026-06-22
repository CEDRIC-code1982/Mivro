# ADR-013 : Stockage de la photo de profil sur le FileSystem (chemin) plutôt que base64/MMKV

Date : 2026-06-20
Statut : Accepté
Auteur : Cédric Pineau

## Contexte

La passe 2 de F7 (Profil) ajoute une **photo de profil optionnelle** (galerie /
caméra) en plus des avatars emoji (ADR-012). Le picker
(`react-native-image-picker`) produit une image redimensionnée (resize natif
200×200) référencée par une URI temporaire.

Il faut décider **comment persister cette photo** côté client (MVP local, pas de
backend ni de bucket S3 pour l'instant — cf. CLAUDE.md > STORAGE, ligne « Photos
profil (binaire local) → FileSystem ; S3 en V1 »). Les contraintes :

- la photo doit **survivre à un redémarrage** (kill / relance de l'app) ;
- le store de préférences/auth (MMKV) doit rester **léger et rapide** (il est lu
  au démarrage et persiste de petits objets) ;
- le couplage aux libs natives (`react-native-image-picker`,
  `@dr.pogodin/react-native-fs`) doit rester confiné à l'infrastructure pour
  préserver la testabilité (cf. règle de dépendance Clean Architecture).

## Décision

La photo de profil est **stockée sur le FileSystem** ; **seul son chemin** est
persisté.

- L'image (resize natif 200×200) est **copiée** dans
  `Documents/profile-photos/<uuid>.jpg` par l'adapter
  `ImagePickerProfilePhotoService` (infra, `src/infrastructure/media/`).
- Le **chemin** résultant est stocké dans `User.photoUri` (validé Zod) et
  persisté via MMKV comme le reste du profil.
- L'accès est découplé derrière le port `IProfilePhotoService` (core) ; la
  presentation passe par le hook `useProfilePhoto` et n'importe jamais les libs
  natives.
- L'atom `Avatar` rend la photo via `<Image source={{ uri: photoUri }}>` selon la
  priorité **photo > emoji > initiale**.
- Au remplacement ou à la suppression, l'ancien fichier est nettoyé
  (**cleanup best-effort** : `deletePhoto` ne doit jamais rejeter).

## Raisons

- **Persistance fiable** : un fichier dans `Documents/` survit aux redémarrages,
  contrairement à l'URI temporaire renvoyée par le picker (`tmp/` purgeable par
  l'OS).
- **MMKV léger** : on n'y stocke qu'une courte chaîne (chemin), pas un binaire
  encodé → store rapide à (dé)sérialiser, pas de gonflement mémoire.
- **Cohérent avec STORAGE / V1** : aligne le MVP sur la migration prévue vers S3
  en V1 (on remplace l'adapter, `photoUri` devient une URL distante — l'UI ne
  change pas).
- **Substituable** : le binaire reste derrière un port ; un futur upload serveur
  n'impacte ni la presentation ni le core.
- **Testable sans device** : image-picker et FS sont mockés au niveau de
  l'adapter (mocks typés, zéro `any`).

## Compromis

- Il faut **gérer le cycle de vie du fichier** soi-même (cleanup à
  remplacement/suppression, et lors d'une suppression de compte — clear MMKV +
  fichiers). Risque de fichiers orphelins si un cleanup échoue silencieusement
  (best-effort assumé).
- `photoUri` est un **chemin local** : non synchronisé entre appareils tant que
  le backend (S3) n'existe pas (V1).
- Une copie disque supplémentaire (≈ 200×200 jpg) par photo — négligeable.

## Alternatives écartées

- **base64 dans MMKV** : encoder l'image en base64 et la stocker dans le store.
  Écartée : gonfle le store (lu au démarrage), +33 % de taille vs binaire,
  dé/sérialisation coûteuse, et mélange données binaires et préférences. Mauvais
  fit pour un store conçu pour de petits objets.
- **Conserver l'URI temporaire du picker** : ne rien copier, persister l'URI
  `tmp/` telle quelle. Écartée : l'OS peut purger le dossier temporaire → photo
  perdue après un kill / au bout d'un certain temps (non fiable).
