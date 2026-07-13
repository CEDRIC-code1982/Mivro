# ADR-003 : React Native CLI (bare) plutôt qu'Expo

Date : 2026-04-27
Statut : Accepté
Auteur : Cédric Pineau

> Documenté rétroactivement le 2026-07-14 (ADR rattrapage).

## Contexte

Au démarrage, il faut choisir la chaîne d'outils React Native. Mivro dépend de
nombreux modules natifs (react-native-maps, géolocalisation, MMKV,
react-native-keychain, `@react-native-firebase/*`, react-native-image-picker,
reanimated) et vise la **New Architecture** (Fabric + TurboModules, voir
ADR-007), avec un contrôle fin de la configuration native (Podfile, Gradle,
permissions iOS/Android).

## Décision

Utiliser **React Native CLI** en projet **bare** (pas Expo managed).

## Raisons

- **Contrôle natif total** : accès direct au `Podfile` (ex.
  `use_modular_headers!` requis par les pods Swift Firebase), au Gradle, aux
  `Info.plist` / `AndroidManifest` (permissions caméra, biométrie, deep links).
- **Modules natifs sans friction** : plusieurs dépendances exigent une
  configuration native fine et/ou ne fonctionnent pas dans Expo Go.
- **New Architecture** : maîtrise des versions de dépendances compatibles
  Fabric/TurboModules et de la codegen.
- **Firebase natif** : `@react-native-firebase` s'appuie sur les fichiers de
  config natifs et l'auto-configuration — plus simple à opérer en bare.

## Compromis

- **Configuration native manuelle** : pods, gradle, permissions, signing — à la
  charge du développeur (pas d'abstraction Expo).
- **Pas d'EAS Build / OTA / conveniences Expo** prêts à l'emploi (builds et mises
  à jour à outiller soi-même — voir le chantier Beta du RUNBOOK).
- Mise à jour de RN plus manuelle qu'en managed.

## Alternatives écartées

- **Expo managed** : démarrage plus rapide, EAS Build/Update, mais friction avec
  certains modules natifs et contraintes sur la config native — incompatible avec
  le besoin de contrôle total (Firebase, New Arch, pods Swift).
- **Expo prebuild (bare workflow Expo)** : compromis intéressant (config plugins +
  éjection), mais ajoute une couche d'outillage Expo sans bénéfice décisif ici.
  Réévaluable si l'on veut EAS plus tard.
