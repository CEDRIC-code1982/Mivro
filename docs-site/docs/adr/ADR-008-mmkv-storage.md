# ADR-008 : Stockage local — MMKV (préférences/cache) + Keychain (secrets) + AsyncStorage (volume)

Date : 2026-04-27
Statut : Accepté
Auteur : Cédric Pineau

> Documenté rétroactivement le 2026-07-14 (ADR rattrapage).

## Contexte

Mivro doit persister plusieurs types de données locales, avec des exigences de
sécurité différentes : préférences utilisateur, caches (POI/géocodage), stores
Zustand persistés, futurs secrets (tokens), et données de volume modéré non
sensibles (historique de sessions).

## Décision

Répartir le stockage **par sensibilité** :

| Donnée                                           | Support                   | Raison                    |
| ------------------------------------------------ | ------------------------- | ------------------------- |
| Secrets (sentinelle biométrie F8, futurs tokens) | **react-native-keychain** | Secure Enclave / Keystore |
| Préférences, caches, stores Zustand persistés    | **MMKV (chiffré)**        | Rapide, chiffrable        |
| Historique / volume non sensible                 | **AsyncStorage**          | Simple, volume modéré     |

- MMKV est câblé derrière le port **`IStorageService`** (adapter
  `MMKVStorageService`, `src/services/infra/storage/`), avec un
  **middleware persist Zustand** (`zustand-mmkv-adapter`).
- La **clé de chiffrement** MMKV est dérivée/stockée via le Keychain
  (`getEncryptionKey`).

## Raisons

- **MMKV** : lecture/écriture **synchrones** en C++ (bien plus rapide
  qu'AsyncStorage), **chiffrement** intégré — parfait pour la persistance Zustand
  et les caches chauds.
- **Keychain** : les secrets vont dans le stockage sécurisé matériel, jamais en
  clair.
- **Séparation explicite** : évite de stocker un secret au mauvais endroit.

## Compromis

- **Dépendance native** MMKV (version compatible New Architecture requise —
  ADR-007).
- **Gestion de la clé de chiffrement** à sécuriser (via Keychain).
- **AsyncStorage non chiffré** sur Android → **règle** : n'y JAMAIS stocker de
  secret (uniquement du volume non sensible).

## Alternatives écartées

- **AsyncStorage seul** : lent, non chiffré — inadapté aux caches chauds et aux
  données sensibles.
- **SQLite / WatermelonDB / Realm** : surdimensionné pour les besoins clé-valeur
  du MVP.
- **redux-persist + AsyncStorage** : plus lent et lié à Redux (écarté avec Redux,
  cf. ADR-005).
