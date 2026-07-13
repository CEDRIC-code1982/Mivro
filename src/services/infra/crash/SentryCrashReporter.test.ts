/**
 * @file SentryCrashReporter.test.ts
 * @description Tests unitaires de SentryCrashReporter.
 *              Unit tests for SentryCrashReporter.
 *
 * @module __tests__/unit/infrastructure/crash/SentryCrashReporter
 */

// [ADDED] Tests unitaires SentryCrashReporter

import * as Sentry from '@sentry/react-native';
import Config from 'react-native-config';
import { SentryCrashReporter } from '@services/infra/crash/SentryCrashReporter';

// Accès aux mocks typés
const mockSentryInit = Sentry.init as jest.MockedFunction<typeof Sentry.init>;
const mockCaptureException = Sentry.captureException as jest.MockedFunction<
  typeof Sentry.captureException
>;
const mockCaptureMessage = Sentry.captureMessage as jest.MockedFunction<
  typeof Sentry.captureMessage
>;
const mockSetUser = Sentry.setUser as jest.MockedFunction<typeof Sentry.setUser>;
const mockSetTag = Sentry.setTag as jest.MockedFunction<typeof Sentry.setTag>;
const mockAddBreadcrumb = Sentry.addBreadcrumb as jest.MockedFunction<typeof Sentry.addBreadcrumb>;
const mockFlush = Sentry.flush as jest.MockedFunction<typeof Sentry.flush>;
const mockWithScope = Sentry.withScope as jest.MockedFunction<typeof Sentry.withScope>;

/**
 * Helper pour configurer le DSN dans Config mock.
 * Helper to set DSN in Config mock.
 */
const setConfigDSN = (dsn: string | undefined): void => {
  (Config as Record<string, unknown>).SENTRY_DSN = dsn;
};

/**
 * Helper pour configurer l'environment dans Config mock.
 * Helper to set environment in Config mock.
 */
const setConfigEnv = (env: string): void => {
  (Config as Record<string, unknown>).SENTRY_ENVIRONMENT = env;
};

describe('SentryCrashReporter', () => {
  let reporter: SentryCrashReporter;

  beforeEach(() => {
    jest.clearAllMocks();
    reporter = new SentryCrashReporter();
    // Reset Config to default test values
    setConfigDSN('');
    setConfigEnv('test');
  });

  // ─── init ────────────────────────────────────────────────
  describe('init', () => {
    it('calls Sentry.init with correct DSN when configured', () => {
      setConfigDSN('https://examplePublicKey@o0.ingest.sentry.io/0');
      setConfigEnv('staging');

      reporter.init();

      expect(mockSentryInit).toHaveBeenCalledTimes(1);
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
          environment: 'staging',
          tracesSampleRate: 0.1,
        }),
      );
    });

    it('is idempotent — second call does not re-initialize', () => {
      setConfigDSN('https://test@sentry.io/1');

      reporter.init();
      reporter.init();

      expect(mockSentryInit).toHaveBeenCalledTimes(1);
    });

    it('does not call Sentry.init when DSN is empty (no-op)', () => {
      setConfigDSN('');

      reporter.init();

      expect(mockSentryInit).not.toHaveBeenCalled();
    });

    it('does not call Sentry.init when DSN is undefined (no-op)', () => {
      setConfigDSN(undefined);

      reporter.init();

      expect(mockSentryInit).not.toHaveBeenCalled();
    });

    it('passes beforeSend that sanitizes contexts and extra', () => {
      setConfigDSN('https://test@sentry.io/1');

      reporter.init();

      const initCall = mockSentryInit.mock.calls[0];
      expect(initCall).toBeDefined();

      const options = initCall?.[0];
      expect(options?.beforeSend).toBeDefined();

      // Simule un ErrorEvent avec des données sensibles
      const event = {
        type: undefined as undefined,
        contexts: {
          device: { latitude: 48.85, name: 'iPhone' },
        },
        extra: {
          userToken: 'secret123',
          screen: 'MapScreen',
        },
        tags: {
          feature: 'midpoint',
        },
      };

      // beforeSend doit nettoyer les données
      // Cast via unknown : on simule un ErrorEvent Sentry pour tester beforeSend
      const sanitized = options?.beforeSend?.(
        event as unknown as Sentry.ErrorEvent,
        {} as unknown as Parameters<NonNullable<typeof options.beforeSend>>[1],
      );

      const sanitizedEvent = sanitized as unknown as Record<string, unknown>;
      const contexts = sanitizedEvent.contexts as Record<string, unknown>;
      const device = contexts.device as Record<string, unknown>;
      expect(device.latitude).toBe('[REDACTED]');
      expect(device.name).toBe('iPhone');

      const extra = sanitizedEvent.extra as Record<string, unknown>;
      expect(extra.userToken).toBe('[REDACTED]');
      expect(extra.screen).toBe('MapScreen');
    });
  });

  // ─── captureException ────────────────────────────────────
  describe('captureException', () => {
    it('calls Sentry.captureException via withScope when active', () => {
      setConfigDSN('https://test@sentry.io/1');
      reporter.init();

      const error = new Error('Test error');
      reporter.captureException(error, {
        level: 'error',
        tags: { feature: 'map' },
      });

      expect(mockWithScope).toHaveBeenCalledTimes(1);
      expect(mockCaptureException).toHaveBeenCalledWith(error);
    });

    it('no-ops when DSN is not configured', () => {
      setConfigDSN('');
      reporter.init();

      reporter.captureException(new Error('Test'));

      expect(mockWithScope).not.toHaveBeenCalled();
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });

  // ─── captureMessage ──────────────────────────────────────
  describe('captureMessage', () => {
    it('calls Sentry.captureMessage via withScope', () => {
      setConfigDSN('https://test@sentry.io/1');
      reporter.init();

      reporter.captureMessage('Something happened');

      expect(mockWithScope).toHaveBeenCalledTimes(1);
      expect(mockCaptureMessage).toHaveBeenCalledWith('Something happened');
    });

    it('no-ops when DSN is not configured', () => {
      setConfigDSN('');
      reporter.init();

      reporter.captureMessage('Test');

      expect(mockWithScope).not.toHaveBeenCalled();
      expect(mockCaptureMessage).not.toHaveBeenCalled();
    });
  });

  // ─── setUser ─────────────────────────────────────────────
  describe('setUser', () => {
    beforeEach(() => {
      setConfigDSN('https://test@sentry.io/1');
      reporter.init();
    });

    it('sets user ID and type tag', () => {
      reporter.setUser({ id: 'user-123', type: 'guest' });

      expect(mockSetUser).toHaveBeenCalledWith({ id: 'user-123' });
      expect(mockSetTag).toHaveBeenCalledWith('user.type', 'guest');
    });

    it('clears user when null is passed', () => {
      reporter.setUser(null);

      expect(mockSetUser).toHaveBeenCalledWith(null);
    });

    it('does not call Sentry when not active', () => {
      jest.clearAllMocks();
      const inactiveReporter = new SentryCrashReporter();
      setConfigDSN('');
      inactiveReporter.init();

      inactiveReporter.setUser({ id: 'user-456', type: 'authenticated' });

      expect(mockSetUser).not.toHaveBeenCalled();
    });
  });

  // ─── setTag ──────────────────────────────────────────────
  describe('setTag', () => {
    it('calls Sentry.setTag when active', () => {
      setConfigDSN('https://test@sentry.io/1');
      reporter.init();
      jest.clearAllMocks();

      reporter.setTag('feature', 'midpoint');

      expect(mockSetTag).toHaveBeenCalledWith('feature', 'midpoint');
    });
  });

  // ─── addBreadcrumb ───────────────────────────────────────
  describe('addBreadcrumb', () => {
    it('calls Sentry.addBreadcrumb with sanitized data', () => {
      setConfigDSN('https://test@sentry.io/1');
      reporter.init();

      reporter.addBreadcrumb({
        message: 'Navigated to map',
        category: 'navigation',
        level: 'info',
        data: { screen: 'MapScreen', latitude: 48.85 },
      });

      expect(mockAddBreadcrumb).toHaveBeenCalledWith({
        message: 'Navigated to map',
        category: 'navigation',
        level: 'info',
        data: { screen: 'MapScreen', latitude: '[REDACTED]' },
      });
    });

    it('omits optional fields when not provided', () => {
      setConfigDSN('https://test@sentry.io/1');
      reporter.init();

      reporter.addBreadcrumb({ message: 'Simple breadcrumb' });

      expect(mockAddBreadcrumb).toHaveBeenCalledWith({
        message: 'Simple breadcrumb',
      });
    });
  });

  // ─── flush ───────────────────────────────────────────────
  describe('flush', () => {
    it('calls Sentry.flush when active', async () => {
      setConfigDSN('https://test@sentry.io/1');
      reporter.init();

      const result = await reporter.flush();

      expect(mockFlush).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('returns true immediately when not active', async () => {
      setConfigDSN('');
      reporter.init();

      const result = await reporter.flush();

      expect(mockFlush).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
