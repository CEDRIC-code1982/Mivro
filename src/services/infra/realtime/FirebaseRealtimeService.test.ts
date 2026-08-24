/**
 * @file FirebaseRealtimeService.test.ts
 * @description Tests unitaires de l'adapter FirebaseRealtimeService (API modulaire).
 *              Unit tests for the FirebaseRealtimeService adapter (modular API).
 *
 *              Le mock de base de @react-native-firebase/database vient de
 *              jest.setup.js ; on récupère ici des références aux fonctions
 *              mockées et on les surcharge par test.
 *
 * @module services/infra/realtime/FirebaseRealtimeService.test
 */

// [ADDED] F4 — Tests unitaires FirebaseRealtimeService
import { getApp } from '@react-native-firebase/app';
import {
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  update,
} from '@react-native-firebase/database';
import { mock } from 'jest-mock-extended';
import type { RealtimeLocationUpdate } from '@entities/RealtimeParticipant';
import type { ICrashReporter } from '@services/domain/crash/ICrashReporter';
import { FirebaseRealtimeService } from '@services/infra/realtime/FirebaseRealtimeService';

const mockGetDatabase = getDatabase as jest.Mock;
const mockGetApp = getApp as jest.Mock;
const mockRef = ref as jest.Mock;
const mockOnValue = onValue as jest.Mock;
const mockOnDisconnect = onDisconnect as jest.Mock;
const mockUpdate = update as jest.Mock;
const mockRemove = remove as jest.Mock;
const mockServerTimestamp = serverTimestamp as jest.Mock;

const SESSION_ID = 'session-001';
const PARTICIPANT_ID = '550e8400-e29b-41d4-a716-446655440000';

const validLocation: RealtimeLocationUpdate = {
  latitude: 48.8566,
  longitude: 2.3522,
  speed: 12.4,
  heading: 90,
};

/** Entrée Firebase valide (sans participantId, qui est la clé) */
const validRawEntry = {
  latitude: 48.8566,
  longitude: 2.3522,
  updatedAt: 1_700_000_000_000,
  speed: 10,
  heading: 180,
  isOnline: true,
};

describe('FirebaseRealtimeService', () => {
  const crashReporter = mock<ICrashReporter>();
  let service: FirebaseRealtimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Réinitialise les implémentations par défaut (clearAllMocks vide les retours).
    mockGetDatabase.mockReturnValue({ __mockDatabase: true });
    mockRef.mockImplementation((_db, path) => ({ __mockRef: true, path }));
    mockOnValue.mockReturnValue(jest.fn());
    mockOnDisconnect.mockReturnValue({
      update: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
    });
    mockUpdate.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    mockServerTimestamp.mockReturnValue({ '.sv': 'timestamp' });

    service = new FirebaseRealtimeService(crashReporter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── subscribeToSession ───────────────────────────────────
  describe('subscribeToSession', () => {
    it('subscribes on the correct participants path', () => {
      service.subscribeToSession(SESSION_ID, jest.fn());

      expect(mockRef).toHaveBeenCalledWith(
        { __mockDatabase: true },
        `sessions/${SESSION_ID}/participants`,
      );
      expect(mockOnValue).toHaveBeenCalled();
    });

    it('parses valid entries via Zod and forwards them', () => {
      mockOnValue.mockImplementation((_ref, onNext) => {
        onNext({ val: () => ({ [PARTICIPANT_ID]: validRawEntry }) });
        return jest.fn();
      });
      const onUpdate = jest.fn();

      service.subscribeToSession(SESSION_ID, onUpdate);

      expect(onUpdate).toHaveBeenCalledWith([{ participantId: PARTICIPANT_ID, ...validRawEntry }]);
    });

    it('skips invalid entries (Zod failure) without crashing', () => {
      mockOnValue.mockImplementation((_ref, onNext) => {
        onNext({
          val: () => ({
            [PARTICIPANT_ID]: validRawEntry,
            'bad-1': {
              latitude: 999,
              longitude: 2,
              updatedAt: 1,
              speed: 1,
              heading: 1,
              isOnline: true,
            },
            'bad-2': { latitude: 1 }, // champs manquants
            'bad-3': null,
          }),
        });
        return jest.fn();
      });
      const onUpdate = jest.fn();

      service.subscribeToSession(SESSION_ID, onUpdate);

      const forwarded = onUpdate.mock.calls[0]?.[0];
      expect(forwarded).toHaveLength(1);
      expect(forwarded[0].participantId).toBe(PARTICIPANT_ID);
      expect(crashReporter.captureMessage).toHaveBeenCalledWith(
        'Realtime: invalid participant data skipped',
        expect.objectContaining({ level: 'warning' }),
      );
    });

    it('returns empty list when snapshot value is null', () => {
      mockOnValue.mockImplementation((_ref, onNext) => {
        onNext({ val: () => null });
        return jest.fn();
      });
      const onUpdate = jest.fn();

      service.subscribeToSession(SESSION_ID, onUpdate);

      expect(onUpdate).toHaveBeenCalledWith([]);
    });

    it('returns a working unsubscribe function', () => {
      const innerUnsub = jest.fn();
      mockOnValue.mockReturnValue(innerUnsub);

      const unsubscribe = service.subscribeToSession(SESSION_ID, jest.fn());
      unsubscribe();

      expect(innerUnsub).toHaveBeenCalledTimes(1);
    });

    it('reports cancel-callback errors to the crash reporter', () => {
      mockOnValue.mockImplementation((_ref, _onNext, onError) => {
        onError(new Error('permission denied'));
        return jest.fn();
      });

      service.subscribeToSession(SESSION_ID, jest.fn());

      expect(crashReporter.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'permission_denied' }),
        expect.objectContaining({ tags: { feature: 'realtime' } }),
      );
    });

    it('maps init errors to not_configured (Firebase not configured)', () => {
      mockGetDatabase.mockImplementation(() => {
        throw new Error('No Firebase App "[DEFAULT]" has been created');
      });

      expect(() => service.subscribeToSession(SESSION_ID, jest.fn())).toThrow(
        expect.objectContaining({ code: 'not_configured' }),
      );
    });
  });

  // ─── publishLocation ──────────────────────────────────────
  describe('publishLocation', () => {
    it('arms onDisconnect (isOnline=false) BEFORE writing', async () => {
      const callOrder: string[] = [];
      const disconnectUpdate = jest.fn().mockImplementation(() => {
        callOrder.push('onDisconnect.update');
        return Promise.resolve();
      });
      mockOnDisconnect.mockReturnValue({ update: disconnectUpdate, cancel: jest.fn() });
      mockUpdate.mockImplementation(() => {
        callOrder.push('update');
        return Promise.resolve();
      });

      await service.publishLocation(SESSION_ID, PARTICIPANT_ID, validLocation);

      expect(disconnectUpdate).toHaveBeenCalledWith({ isOnline: false });
      expect(callOrder).toEqual(['onDisconnect.update', 'update']);
    });

    it('writes the correct path with serverTimestamp and isOnline=true', async () => {
      await service.publishLocation(SESSION_ID, PARTICIPANT_ID, validLocation);

      expect(mockRef).toHaveBeenCalledWith(
        { __mockDatabase: true },
        `sessions/${SESSION_ID}/participants/${PARTICIPANT_ID}`,
      );
      expect(mockServerTimestamp).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith(
        { __mockRef: true, path: `sessions/${SESSION_ID}/participants/${PARTICIPANT_ID}` },
        {
          latitude: validLocation.latitude,
          longitude: validLocation.longitude,
          speed: validLocation.speed,
          heading: validLocation.heading,
          isOnline: true,
          updatedAt: { '.sv': 'timestamp' },
        },
      );
    });

    it('maps network errors and reports them', async () => {
      mockUpdate.mockRejectedValue(new Error('network request failed'));

      await expect(
        service.publishLocation(SESSION_ID, PARTICIPANT_ID, validLocation),
      ).rejects.toMatchObject({ code: 'network' });
      expect(crashReporter.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'network' }),
        expect.objectContaining({ tags: { feature: 'realtime' } }),
      );
    });

    it('does NOT leak raw coordinates into logs', async () => {
      const logSpy = jest.spyOn(console, 'log');

      await service.publishLocation(SESSION_ID, PARTICIPANT_ID, validLocation);

      const logged = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logged).not.toContain(String(validLocation.latitude));
      expect(logged).not.toContain(String(validLocation.longitude));
      // La vitesse (non identifiante) reste autorisée.
      expect(logged).toContain('Location published');
    });
  });

  // ─── leaveSession ─────────────────────────────────────────
  describe('leaveSession', () => {
    it('cancels onDisconnect then removes the participant node', async () => {
      const callOrder: string[] = [];
      const cancel = jest.fn().mockImplementation(() => {
        callOrder.push('cancel');
        return Promise.resolve();
      });
      mockOnDisconnect.mockReturnValue({ update: jest.fn(), cancel });
      mockRemove.mockImplementation(() => {
        callOrder.push('remove');
        return Promise.resolve();
      });

      await service.leaveSession(SESSION_ID, PARTICIPANT_ID);

      expect(cancel).toHaveBeenCalled();
      expect(mockRemove).toHaveBeenCalledWith({
        __mockRef: true,
        path: `sessions/${SESSION_ID}/participants/${PARTICIPANT_ID}`,
      });
      expect(callOrder).toEqual(['cancel', 'remove']);
    });

    it('maps and reports removal errors', async () => {
      mockRemove.mockRejectedValue(new Error('permission denied'));

      await expect(service.leaveSession(SESSION_ID, PARTICIPANT_ID)).rejects.toMatchObject({
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
      ['something totally unexpected', 'unknown'],
    ])('maps "%s" → %s', async (message, expectedCode) => {
      mockUpdate.mockRejectedValue(new Error(message));

      await expect(
        service.publishLocation(SESSION_ID, PARTICIPANT_ID, validLocation),
      ).rejects.toMatchObject({ code: expectedCode });
    });
  });

  // ─── without crash reporter ───────────────────────────────
  describe('without crash reporter', () => {
    it('does not throw when crashReporter is undefined', async () => {
      const bare = new FirebaseRealtimeService();

      await expect(
        bare.publishLocation(SESSION_ID, PARTICIPANT_ID, validLocation),
      ).resolves.toBeUndefined();
    });
  });

  // ─── db() target RTDB instance (F4 — câblage EU) ──────────
  // FIREBASE_DATABASE_URL vide (mock par défaut de jest.setup.js) → fallback
  // getDatabase(getApp()) SANS url. Branche couverte par le service importé
  // au top du fichier (le mock react-native-config est figé à l'import).
  describe('db() target RTDB instance — empty FIREBASE_DATABASE_URL', () => {
    it('calls getDatabase with getApp() only (no url) → fallback default instance', () => {
      const appHandle = { name: '[DEFAULT]' };
      mockGetApp.mockReturnValue(appHandle);

      service.subscribeToSession(SESSION_ID, jest.fn());

      expect(mockGetApp).toHaveBeenCalled();
      expect(mockGetDatabase).toHaveBeenCalledWith(appHandle);
      // Un seul argument : aucune URL passée sur la branche fallback.
      const lastCall = mockGetDatabase.mock.calls.at(-1);
      expect(lastCall).toHaveLength(1);
    });
  });
});

// ─── db() target RTDB instance — EU URL définie ─────────────
// Branche EU : FIREBASE_DATABASE_URL non vide → getDatabase(getApp(), url).
// On surcharge le mock react-native-config AVANT de (ré)importer le service,
// dans un registre de modules isolé (jest.isolateModulesAsync + doMock) pour
// ne pas polluer les autres suites figées sur l'URL vide du jest.setup.js.
describe('db() target RTDB instance — EU FIREBASE_DATABASE_URL defined', () => {
  const EU_DATABASE_URL = 'https://mivro-40125-default-rtdb.europe-west1.firebasedatabase.app/';

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('calls getDatabase WITH the EU url when FIREBASE_DATABASE_URL is set', () => {
    // L'objet renvoyé par le mock react-native-config (jest.setup.js) est figé
    // au niveau du module ; on mute sa clé pour simuler l'env EU, puis on
    // ré-require le service dans un registre isolé pour qu'il relise la valeur.
    const config = require('react-native-config') as { FIREBASE_DATABASE_URL: string };
    const original = config.FIREBASE_DATABASE_URL;
    config.FIREBASE_DATABASE_URL = EU_DATABASE_URL;

    try {
      jest.isolateModules(() => {
        const appHandle = { name: '[DEFAULT]' };
        const { getApp: getAppEu } = require('@react-native-firebase/app') as {
          getApp: jest.Mock;
        };
        const { getDatabase: getDatabaseEu, onValue: onValueEu } =
          require('@react-native-firebase/database') as {
            getDatabase: jest.Mock;
            onValue: jest.Mock;
          };
        getAppEu.mockReset().mockReturnValue(appHandle);
        getDatabaseEu.mockReset().mockReturnValue({ __mockDatabase: true });
        onValueEu.mockReset().mockReturnValue(jest.fn());

        const { FirebaseRealtimeService: ServiceEu } =
          require('@services/infra/realtime/FirebaseRealtimeService') as {
            FirebaseRealtimeService: typeof FirebaseRealtimeService;
          };

        new ServiceEu().subscribeToSession(SESSION_ID, jest.fn());

        expect(getDatabaseEu).toHaveBeenCalledWith(appHandle, EU_DATABASE_URL);
      });
    } finally {
      config.FIREBASE_DATABASE_URL = original;
    }
  });
});
