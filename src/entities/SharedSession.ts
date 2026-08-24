/**
 * @file SharedSession.ts
 * @description Entité SharedSession — session de calcul de midpoint PARTAGÉE sur
 *              Firebase RTDB (F5). Étend la structure F4 avec une `meta` (cycle
 *              de vie + expiration + midpoint) et un roster de `members` (points
 *              de départ collaboratifs).
 *              SharedSession entity — midpoint session SHARED over Firebase RTDB
 *              (F5). Extends the F4 structure with a `meta` (lifecycle +
 *              expiration + midpoint) and a `members` roster (collaborative start
 *              points).
 *
 *              Modèle Firebase / Firebase model :
 *              sessions/{sessionId}/
 *                meta/    { createdAt, expiresAt, ownerType, status, midpoint?, midpointRadius? }
 *                members/{memberId}/  { displayName, avatarId?, startLocation }
 *                participants/{participantId}/  ← positions live F4 (NON gérées ici)
 *
 *              ⚠️ RGPD : la session partagée expire (24h guest / 7j compte),
 *              n'est jamais persistée localement au-delà de la session courante,
 *              et est supprimée en fin de session. Les coordonnées exactes ne
 *              sont JAMAIS loggées.
 *
 *              ⚠️ GDPR: the shared session expires (24h guest / 7d account), is
 *              never persisted locally beyond the current session, and is removed
 *              at the end of the session. Exact coordinates are NEVER logged.
 *
 *              Source de vérité runtime + type (TS-001/TS-004) : ces schémas
 *              valident les données LUES depuis Firebase (frontière externe).
 *
 * @module entities/SharedSession
 */

// [ADDED] F5 — Entité SharedSession (meta + members) avec validation Zod (TS-004)
import { z } from 'zod';
import { AvatarIdSchema } from './Avatar';
import { CoordinatesSchema } from './Location';

/**
 * Type de propriétaire de la session partagée (pilote l'expiration).
 * Owner type of the shared session (drives expiration).
 *
 * - `guest` : utilisateur invité → lien valide 24h / guest user → 24h link
 * - `account` : utilisateur authentifié → lien valide 7j / authenticated → 7d link
 */
export const SharedSessionOwnerTypeSchema = z.enum(['guest', 'account']);

/**
 * Statut d'une session partagée.
 * Shared session status.
 *
 * - `open` : ouverte, accepte de nouveaux membres / open, accepts new members
 * - `closed` : fermée (terminée par le propriétaire) / closed (ended by owner)
 */
export const SharedSessionStatusSchema = z.enum(['open', 'closed']);

/**
 * Point de départ d'un membre (sous-ensemble de Location, sans id local).
 * A member's start location (subset of Location, without local id).
 *
 * On ne stocke que ce qui est nécessaire au recalcul du midpoint + affichage,
 * conformément au modèle Firebase F5 (RGPD : minimisation des données).
 * Only what is needed to recompute the midpoint + display is stored, per the
 * F5 Firebase model (GDPR: data minimization).
 */
export const MemberStartLocationSchema = z.object({
  /** Latitude GPS (-90..90) / GPS latitude */
  latitude: z.number().min(-90).max(90),
  /** Longitude GPS (-180..180) / GPS longitude */
  longitude: z.number().min(-180).max(180),
  /** Adresse formatée affichable / Displayable formatted address */
  formattedAddress: z.string().min(1),
});

/**
 * Membre d'une session partagée (point de départ collaboratif).
 * A shared session member (collaborative start point).
 *
 * Le `memberId` est la clé Firebase ; il est injecté à la lecture par l'adapter.
 * The `memberId` is the Firebase key; injected on read by the adapter.
 */
export const SharedSessionMemberSchema = z.object({
  /** Identifiant du membre (clé Firebase) / Member identifier (Firebase key) */
  memberId: z.string().min(1),
  /** Nom affiché / Display name */
  displayName: z.string().min(1),
  /** Avatar emoji optionnel (fallback initiale) / optional emoji avatar */
  avatarId: AvatarIdSchema.optional(),
  /** Point de départ du membre / Member's start location */
  startLocation: MemberStartLocationSchema,
});

/**
 * Méta-données de la session partagée.
 * Shared session metadata.
 */
export const SharedSessionMetaSchema = z.object({
  /** Date de création (epoch ms) / Creation date (epoch ms) */
  createdAt: z.number().int().nonnegative(),
  /** Date d'expiration (epoch ms) — vérifiée à l'ouverture / Expiration date (epoch ms) */
  expiresAt: z.number().int().nonnegative(),
  /** Type de propriétaire (pilote l'expiration) / Owner type */
  ownerType: SharedSessionOwnerTypeSchema,
  /** Statut de la session / Session status */
  status: SharedSessionStatusSchema,
  /** Midpoint recalculé (absent tant que < 2 membres) / Recomputed midpoint */
  midpoint: CoordinatesSchema.optional(),
  /** Rayon de zone en mètres / Zone radius in meters */
  midpointRadius: z.number().positive().optional(),
});

/**
 * Session partagée complète (meta + roster de membres).
 * Complete shared session (meta + members roster).
 */
export const SharedSessionSchema = z.object({
  /** Identifiant de la session (= clé Firebase, UUID) / Session identifier */
  sessionId: z.string().min(1),
  /** Méta-données / Metadata */
  meta: SharedSessionMetaSchema,
  /** Roster des membres (points de départ) / Members roster (start points) */
  members: z.array(SharedSessionMemberSchema),
});

// [ADDED] Types inférés depuis les schémas Zod (TS-001 : zéro any)
export type SharedSessionOwnerType = z.infer<typeof SharedSessionOwnerTypeSchema>;
export type SharedSessionStatus = z.infer<typeof SharedSessionStatusSchema>;
export type MemberStartLocation = z.infer<typeof MemberStartLocationSchema>;
export type SharedSessionMember = z.infer<typeof SharedSessionMemberSchema>;
export type SharedSessionMeta = z.infer<typeof SharedSessionMetaSchema>;
export type SharedSession = z.infer<typeof SharedSessionSchema>;

/** Durée de validité d'un lien guest (24h en ms) / Guest link TTL (24h in ms) */
export const SHARE_TTL_GUEST_MS = 24 * 60 * 60 * 1000;
/** Durée de validité d'un lien compte (7j en ms) / Account link TTL (7d in ms) */
export const SHARE_TTL_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Calcule la date d'expiration (epoch ms) selon le type de propriétaire.
 * Computes the expiration date (epoch ms) based on the owner type.
 *
 * @param ownerType - Type de propriétaire / Owner type
 * @param now - Horodatage de référence (epoch ms) / Reference timestamp (epoch ms)
 * @returns Date d'expiration (epoch ms) / Expiration date (epoch ms)
 */
export const computeExpiresAt = (ownerType: SharedSessionOwnerType, now: number): number =>
  now + (ownerType === 'account' ? SHARE_TTL_ACCOUNT_MS : SHARE_TTL_GUEST_MS);

/**
 * Construit le lien profond (deep link) d'une session partagée.
 * Builds the deep link of a shared session.
 *
 * Format : `mivro://session/{sessionId}` (scheme `mivro://`, cf. CLAUDE.md).
 *
 * @param sessionId - Identifiant de la session / Session identifier
 * @returns Lien profond / Deep link
 */
export const buildShareLink = (sessionId: string): string => `mivro://session/${sessionId}`;
