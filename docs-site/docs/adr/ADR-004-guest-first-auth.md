# ADR-004 : Authentification « guest-first » (invité par défaut, compte optionnel)

Date : 2026-04-27
Statut : Accepté
Auteur : Cédric Pineau

> Documenté rétroactivement le 2026-07-14 (ADR rattrapage).

## Contexte

Mivro est une app de rendez-vous géographique collaboratif : la valeur est
immédiate (« trouve le point milieu maintenant »). Imposer une création de compte
avant d'essayer ajoute une friction majeure. De plus, l'auth sociale (Google /
Apple, F6) est **bloquée** par la nécessité de comptes développeur payants.

## Décision

**Guest-first** : l'utilisateur est un invité par défaut.

- `useAuthStore.signInAsGuest(displayName?)` crée un `GuestUser` (UUID +
  displayName généré), persisté en MMKV.
- L'entité `User` distingue `GuestUser` (`type: 'guest'`) d'`AuthenticatedUser`
  (`provider: 'google' | 'apple'`, `email`).
- L'auth par compte est **optionnelle** et ajoutée plus tard (F6) : les signatures
  `signInWithGoogle()` / `signInWithApple()` existent déjà (stubs qui `throw`).

## Raisons

- **Zéro friction** : usage immédiat, essentiel pour l'adoption d'un utilitaire.
- **MVP sans backend d'auth** : pas de gestion de mots de passe / sessions serveur.
- **RGPD** : moins de PII collectée par défaut (pas d'email obligatoire).
- **Débloque le développement** : tout le MVP se construit sans attendre les
  comptes développeur Google/Apple (F6 en PAUSE OBLIGATOIRE).

## Compromis

- **Pas de persistance cross-device** ni de récupération de compte pour un invité
  (données locales uniquement).
- Le **verrou biométrique** (F8) a dû être ouvert aux invités (contrainte
  « compte requis » relâchée) puisque F6 est bloqué — réversible quand F6 existera.
- Une future synchro/partage persistant nécessitera une vraie identité (compte).

## Alternatives écartées

- **Auth obligatoire dès l'ouverture** : friction forte + bloquée par les comptes
  dev — inacceptable pour le MVP.
- **Firebase Anonymous Auth** : introduit une dépendance Firebase Auth très tôt et
  un identifiant serveur, sans bénéfice pour le MVP local (envisageable plus tard
  pour durcir les Security Rules RTDB).
