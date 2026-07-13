# ADR-010 : Observabilité — Sentry (crash) + PostHog (analytics), orientés vie privée

Date : 2026-04-27
Statut : Accepté
Auteur : Cédric Pineau

> Documenté rétroactivement le 2026-07-14 (ADR rattrapage).

## Contexte

Il faut deux capacités d'observabilité, **compatibles RGPD** :

- **Crash reporting** : détecter et diagnostiquer les crashs/erreurs en prod.
- **Analytics produit** : comprendre l'usage des features et les parcours, sans
  collecter de données personnelles ni de position exacte.

## Décision

- **Sentry** pour le crash reporting : port **`ICrashReporter`** → adapter
  `SentryCrashReporter` (`src/services/infra/crash/`), initialisé au démarrage,
  **source maps** uploadées en CI. Un `beforeSend` **scrubbe** les données
  sensibles (coordonnées GPS, emails, tokens) via `sanitizers.ts`.
- **PostHog** pour l'analytics produit : port **`IAnalyticsService`** → adapter
  `PostHogAnalytics` (`src/services/infra/analytics/`), **opt-in** utilisateur
  (préférence dans `usePreferencesStore`), **jamais** de GPS exact / identité /
  contenu utilisateur. Hébergement **EU** (self-host ou PostHog Cloud EU — voir
  RUNBOOK).

Les deux sont confinés derrière leurs ports → substituables en 1 ligne.

## Raisons

- **Sentry** : reporting RN mature, gestion des source maps, symbolication —
  standard éprouvé.
- **PostHog** : open-source, **auto-hébergeable en EU** (souveraineté / RGPD),
  analytics orientée événements/funnels.
- **Vie privée par conception** : scrubbing systématique (Sentry), opt-in +
  exclusion de toute PII/position (PostHog).
- **Substituables** : isolés derrière `ICrashReporter` / `IAnalyticsService`.

## Compromis

- **Sentry** : coût au-delà d'un certain volume d'événements.
- **PostHog self-host** : stack lourde à opérer (ClickHouse/Kafka/Redis) — d'où
  l'alternative Cloud EU (arbitrage documenté dans le RUNBOOK). **Non encore
  câblé** (bloqué sur la décision VPS/infra).
- **Discipline** : ne jamais logger de PII ; maintenir un flux de consentement.

## Alternatives écartées

- **Firebase Crashlytics + Google Analytics** : intégration facile, mais moins
  RGPD-friendly (US, profilage GA4) et couplage fort à l'écosystème Google.
- **Bugsnag** (crash) / **Amplitude, Mixpanel** (analytics) : viables, mais
  majoritairement hébergés hors EU → friction RGPD ; PostHog EU/self-host est
  préféré.
