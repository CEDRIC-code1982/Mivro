/**
 * @file FirebaseSessionShareService.test.ts
 * @description Tests unitaires de l'adapter FirebaseSessionShareService (F5, API
 *              modulaire). Unit tests for the FirebaseSessionShareService adapter
 *              (F5, modular API).
 *
 *              Le mock de base de @react-native-firebase/database vient de
 *              jest.setup.js ; on récupère ici des références aux fonctions
 *              mockées et on les surcharge par test.
 *
 *              Couvre : create/join/fetch/subscribe/updateMidpoint/delete sur les
 *              bons chemins (meta + members/$id, SANS toucher participants),
 *              parse Zod invalide → invalid_data, mapping erreurs (dont
 *              not_configured), absence de coords dans les logs.
 *
 * @module services/infra/realtime/FirebaseSessionShareService.test
 */

// [ADDED] F5 — Tests unitaires FirebaseSessionShareService
import { getApp } from '@react-native-firebase/app';
import { get, getDatabase, onValue, ref, remove, update } from '@react-native-firebase/database';
import { mock } from 'jest-mock-extended';
import type { Coordinates } from '@entities/Location';
import {
  SHARE_TTL_GUEST_MS,
  type SharedSession,
  type SharedSessionMember,
} from '@entities/SharedSession';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import { FirebaseSessionShareService } from '@services/infra/realtime/FirebaseSessionShareService';

const mockGetDatabase = getDatabase as jest.Mock;
const mockGetApp = getApp as jest.Mock;
const mockRef = ref as jest.Mock;
const mockOnValue = onValue as jest.Mock;
const mockUpdate = update as jest.Mock;
const mockRemove = remove as jest.Mock;
const mockGet = get as jest.Mock;

const NOW = 1_700_000_000_000;
const SESSION_ID = 'session-001';
const MEMBER_ID = '550e8400-e29b-41d4-a716-446655440000';

const validMember: SharedSessionMember = {
  memberId: MEMBER_ID,
  displayName: 'Alice',
  startLocation: { latitude: 48.8566, longitude: 2.3522, formattedAddress: '1 rue de Paris' },
};

const validSession: SharedSession = {
  sessionId: SESSION_ID,
  meta: {
    createdAt: NOW,
    expiresAt: NOW + SHARE_TTL_GUEST_MS,
    ownerType: 'guest',
    status: 'open',
  },
  members: [validMember],
};

/** Forme brute d'un nœud session telle que lue depuis Firebase (meta + members keyed). */
const rawNode = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  meta: {
    createdAt: NOW,
    expiresAt: NOW + SHARE_TTL_GUEST_MS,
    ownerType: 'guest',
    status: 'open',
  },
  members: {
    [MEMBER_ID]: {
      displayName: 'Alice',
      startLocation: { latitude: 48.8566, longitude: 2.3522, formattedAddress: '1 rue de Paris' },
    },
  },
  // sous-nœud F4 — NE doit jamais être touché par cet adapter
  participants: { 'p-1': { latitude: 1, longitude: 2, updatedAt: 1 } },
  ...overrides,
});

describe('FirebaseSessionShareService', () => {
  const crashReporter = mock<ICrashReporter>();
  let service: FirebaseSessionShareService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    mockGetDatabase.mockReturnValue({ __mockDatabase: true });
    mockRef.mockImplementation((_db, path) => ({ __mockRef: true, path }));
    mockOnValue.mockReturnValue(jest.fn());
    mockUpdate.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    mockGet.mockResolvedValue({ val: () => null });

    service = new FirebaseSessionShareService(crashReporter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── createSharedSession ──────────────────────────────────
  describe('createSharedSession', () => {
    it('writes meta + members at the session node WITHOUT touching participants', async () => {
      await service.createSharedSession(validSession, 'guest');

      expect(mockRef).toHaveBeenCalledWith({ __mockDatabase: true }, `sessions/${SESSION_ID}`);
      const [, payload] = mockUpdate.mock.calls[0] ?? [];
      // Seules les clés meta + members sont fournies → update() ne remplace pas participants.
      expect(Object.keys(payload as object).sort()).toEqual(['members', 'meta']);
      expect(payload).not.toHaveProperty('participants');
    });

    it('indexes members by memberId and strips the memberId from the value', async () => {
      await service.createSharedSession(validSession, 'guest');

      const [, payload] = mockUpdate.mock.calls[0] ?? [];
      const members = (payload as { members: Record<string, unknown> }).members;
      expect(Object.keys(members)).toEqual([MEMBER_ID]);
      expect(members[MEMBER_ID]).toEqual({
        displayName: 'Alice',
        startLocation: { latitude: 48.8566, longitude: 2.3522, formattedAddress: '1 rue de Paris' },
      });
    });

    it('returns the sessionId, deep link and expiresAt', async () => {
      const result = await service.createSharedSession(validSession, 'account');

      expect(result.sessionId).toBe(SESSION_ID);
      expect(result.link).toBe(`mivro://session/${SESSION_ID}`);
      expect(result.expiresAt).toBe(validSession.meta.expiresAt);
    });

    it('forces the ownerType argument into the persisted meta', async () => {
      await service.createSharedSession(validSession, 'account');

      const [, payload] = mockUpdate.mock.calls[0] ?? [];
      expect((payload as { meta: { ownerType: string } }).meta.ownerType).toBe('account');
    });

    it('maps and reports a network error', async () => {
      mockUpdate.mockRejectedValue(new Error('network request failed'));

      await expect(service.createSharedSession(validSession, 'guest')).rejects.toMatchObject({
        code: 'network',
      });
      expect(crashReporter.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'network' }),
        expect.objectContaining({ tags: { feature: 'share' } }),
      );
    });
  });

  // ─── joinSharedSession ────────────────────────────────────
  describe('joinSharedSession', () => {
    it('writes the member at members/{memberId} path', async () => {
      await service.joinSharedSession(SESSION_ID, validMember);

      expect(mockRef).toHaveBeenCalledWith(
        { __mockDatabase: true },
        `sessions/${SESSION_ID}/members/${MEMBER_ID}`,
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        { __mockRef: true, path: `sessions/${SESSION_ID}/members/${MEMBER_ID}` },
        {
          displayName: 'Alice',
          startLocation: {
            latitude: 48.8566,
            longitude: 2.3522,
            formattedAddress: '1 rue de Paris',
          },
        },
      );
    });

    it('includes avatarId only when present', async () => {
      await service.joinSharedSession(SESSION_ID, { ...validMember, avatarId: 'fox' });

      const [, payload] = mockUpdate.mock.calls[0] ?? [];
      expect((payload as { avatarId?: string }).avatarId).toBe('fox');
    });

    it('maps and reports a permission error', async () => {
      mockUpdate.mockRejectedValue(new Error('permission denied'));

      await expect(service.joinSharedSession(SESSION_ID, validMember)).rejects.toMatchObject({
        code: 'permission_denied',
      });
      expect(crashReporter.captureException).toHaveBeenCalled();
    });
  });

  // ─── fetchSharedSession ───────────────────────────────────
  describe('fetchSharedSession', () => {
    it('reads the session node and returns a validated SharedSession', async () => {
      mockGet.mockResolvedValue({ val: () => rawNode() });

      const result = await service.fetchSharedSession(SESSION_ID);

      expect(mockRef).toHaveBeenCalledWith({ __mockDatabase: true }, `sessions/${SESSION_ID}`);
      expect(result).toEqual(validSession);
    });

    it('re-injects the Firebase key as memberId on read', async () => {
      mockGet.mockResolvedValue({ val: () => rawNode() });

      const result = await service.fetchSharedSession(SESSION_ID);

      expect(result?.members[0]?.memberId).toBe(MEMBER_ID);
    });

    it('returns null when the node is absent', async () => {
      mockGet.mockResolvedValue({ val: () => null });

      expect(await service.fetchSharedSession(SESSION_ID)).toBeNull();
    });

    it('returns null when the node has no meta (F4-only / participants only)', async () => {
      mockGet.mockResolvedValue({
        val: () => ({ participants: { 'p-1': { latitude: 1, longitude: 2 } } }),
      });

      expect(await service.fetchSharedSession(SESSION_ID)).toBeNull();
    });

    it('throws invalid_data when the meta fails Zod validation', async () => {
      mockGet.mockResolvedValue({
        val: () => rawNode({ meta: { createdAt: NOW, ownerType: 'guest', status: 'open' } }),
      });

      await expect(service.fetchSharedSession(SESSION_ID)).rejects.toMatchObject({
        code: 'invalid_data',
      });
      expect(crashReporter.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'invalid_data' }),
        expect.objectContaining({ tags: { feature: 'share' } }),
      );
    });

    it('skips member entries that are not objects', async () => {
      mockGet.mockResolvedValue({
        val: () =>
          rawNode({
            members: {
              [MEMBER_ID]: {
                displayName: 'Alice',
                startLocation: {
                  latitude: 48.8566,
                  longitude: 2.3522,
                  formattedAddress: '1 rue de Paris',
                },
              },
              'bad-null': null,
            },
          }),
      });

      const result = await service.fetchSharedSession(SESSION_ID);

      expect(result?.members).toHaveLength(1);
    });

    it('maps and reports a read error', async () => {
      mockGet.mockRejectedValue(new Error('client is offline'));

      await expect(service.fetchSharedSession(SESSION_ID)).rejects.toMatchObject({
        code: 'network',
      });
    });
  });

  // ─── subscribeToSharedSession ─────────────────────────────
  describe('subscribeToSharedSession', () => {
    it('subscribes on the session node and forwards a validated session', () => {
      mockOnValue.mockImplementation((_ref, onNext) => {
        onNext({ val: () => rawNode() });
        return jest.fn();
      });
      const onUpdate = jest.fn();

      service.subscribeToSharedSession(SESSION_ID, onUpdate);

      expect(mockRef).toHaveBeenCalledWith({ __mockDatabase: true }, `sessions/${SESSION_ID}`);
      expect(onUpdate).toHaveBeenCalledWith(validSession);
    });

    it('forwards null when the node is absent', () => {
      mockOnValue.mockImplementation((_ref, onNext) => {
        onNext({ val: () => null });
        return jest.fn();
      });
      const onUpdate = jest.fn();

      service.subscribeToSharedSession(SESSION_ID, onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(null);
    });

    it('reports subscription (cancel-callback) errors to the crash reporter', () => {
      mockOnValue.mockImplementation((_ref, _onNext, onError) => {
        onError(new Error('permission denied'));
        return jest.fn();
      });

      service.subscribeToSharedSession(SESSION_ID, jest.fn());

      expect(crashReporter.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'permission_denied' }),
        expect.objectContaining({ tags: { feature: 'share' } }),
      );
    });

    it('returns a working unsubscribe function', () => {
      const innerUnsub = jest.fn();
      mockOnValue.mockReturnValue(innerUnsub);

      const unsubscribe = service.subscribeToSharedSession(SESSION_ID, jest.fn());
      unsubscribe();

      expect(innerUnsub).toHaveBeenCalledTimes(1);
    });

    it('maps init errors to not_configured', () => {
      mockGetDatabase.mockImplementation(() => {
        throw new Error('No Firebase App "[DEFAULT]" has been created');
      });

      expect(() => service.subscribeToSharedSession(SESSION_ID, jest.fn())).toThrow(
        expect.objectContaining({ code: 'not_configured' }),
      );
    });
  });

  // ─── updateMidpoint ───────────────────────────────────────
  describe('updateMidpoint', () => {
    const midpoint: Coordinates = { latitude: 48.85, longitude: 2.34 };

    it('updates meta/midpoint + meta/midpointRadius on the meta path', async () => {
      await service.updateMidpoint(SESSION_ID, midpoint, 1234);

      expect(mockRef).toHaveBeenCalledWith({ __mockDatabase: true }, `sessions/${SESSION_ID}/meta`);
      expect(mockUpdate).toHaveBeenCalledWith(
        { __mockRef: true, path: `sessions/${SESSION_ID}/meta` },
        { midpoint: { latitude: 48.85, longitude: 2.34 }, midpointRadius: 1234 },
      );
    });

    it('does NOT leak raw coordinates into logs (RGPD)', async () => {
      const logSpy = jest.spyOn(console, 'log');

      await service.updateMidpoint(SESSION_ID, midpoint, 1234);

      const logged = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logged).not.toContain(String(midpoint.latitude));
      expect(logged).not.toContain(String(midpoint.longitude));
      expect(logged).toContain('Midpoint updated');
    });

    it('maps and reports an update error', async () => {
      mockUpdate.mockRejectedValue(new Error('network unavailable'));

      await expect(service.updateMidpoint(SESSION_ID, midpoint, 1)).rejects.toMatchObject({
        code: 'network',
      });
      expect(crashReporter.captureException).toHaveBeenCalled();
    });
  });

  // ─── deleteSharedSession ──────────────────────────────────
  describe('deleteSharedSession', () => {
    it('removes the whole session node (RGPD)', async () => {
      await service.deleteSharedSession(SESSION_ID);

      expect(mockRemove).toHaveBeenCalledWith({
        __mockRef: true,
        path: `sessions/${SESSION_ID}`,
      });
    });

    it('maps and reports a removal error', async () => {
      mockRemove.mockRejectedValue(new Error('permission denied'));

      await expect(service.deleteSharedSession(SESSION_ID)).rejects.toMatchObject({
        code: 'permission_denied',
      });
      expect(crashReporter.captureException).toHaveBeenCalled();
    });
  });

  // ─── error mapping ────────────────────────────────────────
  describe('error mapping', () => {
    it.each([
      ['permission denied by security rules', 'permission_denied'],
      ['Client is offline', 'network'],
      ['network unavailable', 'network'],
      ['No Firebase App has been created', 'not_configured'],
      ['default app not initialized', 'not_configured'],
      ['something totally unexpected', 'unknown'],
    ])('maps "%s" → %s', async (message, expectedCode) => {
      mockUpdate.mockRejectedValue(new Error(message));

      await expect(service.createSharedSession(validSession, 'guest')).rejects.toMatchObject({
        code: expectedCode,
      });
    });

    it('preserves an already-typed SessionShareError code', async () => {
      // invalid_data est levé par parseSession (déjà typé) puis re-mappé sans changer le code.
      mockGet.mockResolvedValue({
        val: () => rawNode({ meta: { createdAt: NOW } }),
      });

      await expect(service.fetchSharedSession(SESSION_ID)).rejects.toMatchObject({
        code: 'invalid_data',
      });
    });
  });

  // ─── without crash reporter ───────────────────────────────
  describe('without crash reporter', () => {
    it('does not throw when crashReporter is undefined', async () => {
      const bare = new FirebaseSessionShareService();

      await expect(bare.deleteSharedSession(SESSION_ID)).resolves.toBeUndefined();
    });
  });

  // ─── db() target RTDB instance (fallback, FIREBASE_DATABASE_URL vide) ──
  describe('db() target RTDB instance — empty FIREBASE_DATABASE_URL', () => {
    it('calls getDatabase with getApp() only (no url) on the fallback branch', async () => {
      const appHandle = { name: '[DEFAULT]' };
      mockGetApp.mockReturnValue(appHandle);

      await service.deleteSharedSession(SESSION_ID);

      expect(mockGetApp).toHaveBeenCalled();
      expect(mockGetDatabase).toHaveBeenCalledWith(appHandle);
      const lastCall = mockGetDatabase.mock.calls.at(-1);
      expect(lastCall).toHaveLength(1);
    });
  });
});

// ─── db() target RTDB instance — EU URL définie ─────────────
// Branche EU : FIREBASE_DATABASE_URL non vide → getDatabase(getApp(), url).
describe('FirebaseSessionShareService db() — EU FIREBASE_DATABASE_URL defined', () => {
  const EU_DATABASE_URL = 'https://mivro-40125-default-rtdb.europe-west1.firebasedatabase.app/';

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('calls getDatabase WITH the EU url when FIREBASE_DATABASE_URL is set', async () => {
    const config = require('react-native-config') as { FIREBASE_DATABASE_URL: string };
    const original = config.FIREBASE_DATABASE_URL;
    config.FIREBASE_DATABASE_URL = EU_DATABASE_URL;

    try {
      await jest.isolateModulesAsync(async () => {
        const appHandle = { name: '[DEFAULT]' };
        const { getApp: getAppEu } = require('@react-native-firebase/app') as { getApp: jest.Mock };
        const {
          getDatabase: getDatabaseEu,
          ref: refEu,
          remove: removeEu,
        } = require('@react-native-firebase/database') as {
          getDatabase: jest.Mock;
          ref: jest.Mock;
          remove: jest.Mock;
        };
        getAppEu.mockReset().mockReturnValue(appHandle);
        getDatabaseEu.mockReset().mockReturnValue({ __mockDatabase: true });
        refEu.mockReset().mockImplementation((_db, path) => ({ __mockRef: true, path }));
        removeEu.mockReset().mockResolvedValue(undefined);

        const { FirebaseSessionShareService: ServiceEu } =
          require('@services/infra/realtime/FirebaseSessionShareService') as {
            FirebaseSessionShareService: typeof FirebaseSessionShareService;
          };

        await new ServiceEu().deleteSharedSession(SESSION_ID);

        expect(getDatabaseEu).toHaveBeenCalledWith(appHandle, EU_DATABASE_URL);
      });
    } finally {
      config.FIREBASE_DATABASE_URL = original;
    }
  });
});
