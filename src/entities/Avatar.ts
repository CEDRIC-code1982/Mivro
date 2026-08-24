/**
 * @file Avatar.ts
 * @description Entité Avatar — avatars prédéfinis basés sur emoji.
 *              Avatar entity — predefined emoji-based avatars.
 *
 *              F7 (1re passe) : pas de photo picker. L'utilisateur choisit
 *              parmi 20 avatars prédéfinis (emoji + couleur de fond).
 *              Aucune dépendance native — rendu via <Text>.
 *
 *              F7 (first pass): no photo picker. The user picks from
 *              20 predefined avatars (emoji + background color).
 *              No native dependency — rendered via <Text>.
 *
 *              Le schéma Zod est la source de vérité (runtime + types).
 *              The Zod schema is the source of truth (runtime + types).
 *
 * @module entities/Avatar
 */

// [ADDED] Entité Avatar — avatars emoji prédéfinis (F7)
import { z } from 'zod';
import { palette } from '@theme/tokens';

/**
 * Schéma Zod pour un avatar prédéfini.
 * Zod schema for a predefined avatar.
 *
 * - `id` : identifiant stable persisté dans le User (ex `'fox'`).
 * - `emoji` : glyphe affiché (1 caractère perçu).
 * - `backgroundColor` : couleur de fond hex (`#RRGGBB`).
 */
export const AvatarSchema = z.object({
  /** Identifiant stable persisté / Stable persisted identifier */
  id: z.string().min(1),
  /** Emoji affiché / Displayed emoji */
  emoji: z.string().min(1),
  /** Couleur de fond hex `#RRGGBB` / Hex background color */
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

// [ADDED] Type inféré depuis le schéma Zod (TS-001 : zéro any)
export type Avatar = z.infer<typeof AvatarSchema>;

/**
 * Schéma Zod pour un identifiant d'avatar (référence vers {@link AVATARS}).
 * Zod schema for an avatar id (reference into {@link AVATARS}).
 *
 * Validé en frontière (storage/usecase) pour garantir qu'un id persisté
 * correspond toujours à un avatar connu.
 * Validated at boundaries (storage/usecase) so a persisted id always
 * maps to a known avatar.
 */
export const AvatarIdSchema = z.enum([
  'fox',
  'cat',
  'dog',
  'panda',
  'koala',
  'lion',
  'tiger',
  'bear',
  'frog',
  'owl',
  'penguin',
  'rabbit',
  'unicorn',
  'dragon',
  'octopus',
  'whale',
  'butterfly',
  'robot',
  'alien',
  'ghost',
]);

// [ADDED] Type d'identifiant d'avatar inféré (zéro any)
export type AvatarId = z.infer<typeof AvatarIdSchema>;

/**
 * Avatar dont l'`id` est garanti membre de {@link AvatarIdSchema}.
 * Avatar whose `id` is guaranteed to be an {@link AvatarIdSchema} member.
 *
 * Permet à la grille de sélection de manipuler des ids typés sans cast.
 * Lets the picker grid handle typed ids without any cast.
 */
export type PredefinedAvatar = Omit<Avatar, 'id'> & { readonly id: AvatarId };

/**
 * Liste des 20 avatars prédéfinis (emoji sur fond coloré).
 * The 20 predefined avatars (emoji on a colored background).
 *
 * Couleurs tirées de la palette du Design System (DS-001 : pas de
 * magic numbers hex à la volée — on réutilise les primitifs).
 * Colors taken from the Design System palette (DS-001).
 *
 * @remarks L'ordre est stable : il définit l'affichage de la grille.
 */
export const AVATARS: readonly PredefinedAvatar[] = [
  { id: 'fox', emoji: '🦊', backgroundColor: palette.brand[100] },
  { id: 'cat', emoji: '🐱', backgroundColor: palette.warning[50] },
  { id: 'dog', emoji: '🐶', backgroundColor: palette.brand[50] },
  { id: 'panda', emoji: '🐼', backgroundColor: palette.neutral[100] },
  { id: 'koala', emoji: '🐨', backgroundColor: palette.neutral[200] },
  { id: 'lion', emoji: '🦁', backgroundColor: palette.warning[50] },
  { id: 'tiger', emoji: '🐯', backgroundColor: palette.brand[100] },
  { id: 'bear', emoji: '🐻', backgroundColor: palette.brand[50] },
  { id: 'frog', emoji: '🐸', backgroundColor: palette.success[50] },
  { id: 'owl', emoji: '🦉', backgroundColor: palette.info[50] },
  { id: 'penguin', emoji: '🐧', backgroundColor: palette.info[50] },
  { id: 'rabbit', emoji: '🐰', backgroundColor: palette.error[50] },
  { id: 'unicorn', emoji: '🦄', backgroundColor: palette.accent[50] },
  { id: 'dragon', emoji: '🐲', backgroundColor: palette.success[50] },
  { id: 'octopus', emoji: '🐙', backgroundColor: palette.error[50] },
  { id: 'whale', emoji: '🐳', backgroundColor: palette.info[50] },
  { id: 'butterfly', emoji: '🦋', backgroundColor: palette.accent[50] },
  { id: 'robot', emoji: '🤖', backgroundColor: palette.neutral[200] },
  { id: 'alien', emoji: '👽', backgroundColor: palette.accent[50] },
  { id: 'ghost', emoji: '👻', backgroundColor: palette.neutral[100] },
] as const;

// [ADDED] Index id → avatar pour un lookup O(1) / id → avatar index for O(1) lookup
const AVATARS_BY_ID: ReadonlyMap<AvatarId, PredefinedAvatar> = new Map(
  AVATARS.map((avatar) => [avatar.id, avatar] as const),
);

/**
 * Retourne l'avatar correspondant à un id, ou `undefined` si inconnu.
 * Returns the avatar matching an id, or `undefined` if unknown.
 *
 * @param id - Identifiant d'avatar (peut venir du storage) / Avatar id (may come from storage)
 * @returns L'avatar correspondant ou `undefined` / Matching avatar or `undefined`
 */
export const getAvatarById = (id: string | null | undefined): PredefinedAvatar | undefined => {
  if (id == null) return undefined;
  const parsed = AvatarIdSchema.safeParse(id);
  if (!parsed.success) return undefined;
  return AVATARS_BY_ID.get(parsed.data);
};
