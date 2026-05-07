// [ADDED] Barrel export — entités core
export {
  GuestUserSchema,
  AuthenticatedUserSchema,
  UserSchema,
  isGuestUser,
  isAuthenticatedUser,
} from './User';
export type { GuestUser, AuthenticatedUser, User } from './User';

export { CoordinatesSchema, LocationSchema } from './Location';
export type { Coordinates, Location } from './Location';

export { ParticipantSchema, SessionStatusSchema, MidpointSessionSchema } from './MidpointSession';
export type { Participant, SessionStatus, MidpointSession } from './MidpointSession';

// [ADDED] GeocodeResult entity
export { GeocodeResultSchema } from './GeocodeResult';
export type { GeocodeResult } from './GeocodeResult';
