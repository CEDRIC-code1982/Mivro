# ADR-011 : Rebranding MidPoint → Mivro

Date : 2026-05-07
Statut : Accepté
Auteur : Cédric Pineau

## Contexte

"MidPoint" est déjà utilisé par plusieurs apps existantes sur l'App Store
et a un domaine pris. Pour éviter tout risque légal et faciliter le SEO,
le projet est renommé.

## Décision

Adoption du nom "Mivro" :

- Nom inventé (libre marquage mondial)
- 5 lettres, 2 syllabes, prononçable internationalement
- Évoque "mi-chemin" via le préfixe "MI-"
- Suffixe "-vro" moderne (Vimeo-vibe)

## Conséquences

- Bundle ID : `com.cedricpineau.mivro`
- Package npm : `@mivro/app`
- Slogans : "Find your mivro." / "Trouvez votre mivro."
- Storage MMKV : nouveau service Keychain (`com.cedricpineau.mivro.mmkv`)
  et nouvel id MMKV (`mivro-storage`) — perte des données dev existantes,
  désinstaller l'app du simulateur pour repartir clean
- Xcode project, scheme, target renommés (`ios/Mivro/`)
- Android package renommé (`com.cedricpineau.mivro`)
- Le dossier local s'appelle toujours `MidPoint` — non renommé pour
  garder l'historique Git propre
- Les entités métier (`MidpointSession`, `setMidpoint`, `CalculateMidpoint`)
  gardent leur nom : "midpoint" est le terme métier du calcul de point médian,
  pas le nom de l'application

## Alternatives écartées

- **Renommer le dossier local** : casserait les chemins absolus en local
  et les settings Claude Code. Le gain est cosmétique.
- **Renommer les entités métier** : "midpoint" reste le terme correct
  pour décrire le calcul du point médian entre participants.
