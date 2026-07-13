# ADR-007 : Activer la New Architecture (Fabric + TurboModules)

Date : 2026-04-27
Statut : Accepté
Auteur : Cédric Pineau

> Documenté rétroactivement le 2026-07-14 (ADR rattrapage).

## Contexte

Au moment du setup (React Native 0.85.2), la **New Architecture** (nouveau
renderer **Fabric**, **TurboModules** via JSI, **codegen**) est le mode par
défaut et mature. Il faut décider si le projet l'active ou reste sur l'ancienne
architecture à pont (Bridge).

## Décision

**New Architecture ON** (Fabric + TurboModules + codegen).

## Raisons

- **Mode par défaut** des versions RN modernes : rester sur le Bridge revient à
  emprunter de la dette technique dès le départ.
- **Performance** : rendu Fabric (layout synchrone), accès natif via JSI sans
  sérialisation du pont — pertinent pour la carte + les mises à jour temps réel.
- **Compatibilité future des dépendances** : l'écosystème (maps, reanimated,
  MMKV, firebase…) migre vers la New Arch ; l'activer évite une migration
  douloureuse plus tard.

## Compromis

- **Versions de dépendances contraintes** : il faut choisir des versions
  compatibles New Arch de chaque module natif.
- **Quelques aspérités d'interop** possibles avec de vieilles libs (non
  compatibles) → à éviter/remplacer.
- Débogage natif parfois différent de l'ancien pont.

## Alternatives écartées

- **Ancienne architecture (Bridge)** : chemin déprécié, dette technique immédiate,
  et perte de compatibilité à mesure que les libs abandonnent le support Bridge.
  Écartée.
