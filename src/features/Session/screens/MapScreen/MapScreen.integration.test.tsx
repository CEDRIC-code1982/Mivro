/**
 * @file MapScreen.test.tsx
 * @description Tests d'intégration du MapScreen (F2).
 *              Integration tests for MapScreen (F2).
 *
 *              Vérifie les 3 états : pas de session, session draft,
 *              session computed avec carte.
 *              Verifies 3 states: no session, draft session,
 *              computed session with map.
 *
 * @module features/Session/screens/MapScreen/MapScreen.integration.test
 */

// [ADDED] Tests intégration MapScreen

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, Share } from 'react-native'; // [ADDED] F5 — retour utilisateur partage
import type { Coordinates } from '@entities/Location';
import type { MidpointSession, Participant } from '@entities/MidpointSession';
import { SHARE_TTL_GUEST_MS } from '@entities/SharedSession'; // [ADDED] F5
import type { User } from '@entities/User'; // [ADDED] F5
import MapScreen from '@features/Session/screens/MapScreen/MapScreen';
import {
  SessionShareError,
  type CreateSharedSessionResult,
} from '@services/domain/sharing/ISessionShareService'; // [ADDED] F5
import { useAuthStore } from '@state/useAuthStore'; // [ADDED] F5
import { useRealtimeStore } from '@state/useRealtimeStore';
import { useSessionStore } from '@state/useSessionStore';
import { useSharedSessionStore } from '@state/useSharedSessionStore'; // [ADDED] F5
import { createQueryClientWrapper } from '@test-utils/queryClientWrapper'; // [MODIFIED]

// ─── Mock i18n ──────────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        title: 'Point de rencontre',
        'noSession.title': 'Aucune session active',
        'noSession.description': 'Commence par créer une session avec tes points de départ.',
        'notComputed.title': 'Calcul en attente',
        'notComputed.description': 'Termine la saisie des points et calcule le midpoint.',
        'summary.title': 'Point de rencontre suggéré',
        'summary.coordinates': `Coordonnées : ${String(opts?.lat ?? '')}, ${String(
          opts?.lng ?? '',
        )}`,
        'summary.radius': `Zone de ${String(opts?.km ?? '')} km autour du midpoint`,
        'actions.viewPOI': 'Voir les lieux à proximité',
        'actions.viewList': 'Vue liste',
        'list.title': 'Participants',
        'list.midpoint': 'Point de rencontre',
        'list.close': 'Fermer',
        // [ADDED] F4 — namespace realtime:* + accessibilité
        'accessibility.mapLabel': `Carte avec ${String(opts?.participantCount ?? '')} participants`,
        'realtime:accessibility.liveMapLabel': `Carte en direct avec ${String(
          opts?.participantCount ?? '',
        )} participants`,
        'realtime:actions.startSharing': 'Partager ma position',
        'realtime:actions.stopSharing': 'Arrêter le partage',
        'realtime:list.title': 'Participants en direct',
        'realtime:consent.note': 'Tu peux arrêter le partage à tout moment.',
        'consent.title': 'Partager ma position',
        'consent.accept': 'Accepter et partager',
        'consent.decline': 'Non, juste voir les autres',
        'list.empty': 'Aucun participant en direct pour le moment.',
        // [ADDED] F5 — namespace share:*
        'share:actions.share': 'Partager la session',
        'share:actions.shareHint': "Génère un lien d'invitation et ouvre le menu de partage",
        'share:shareSheet.message': `Rejoins ma session Mivro : ${String(opts?.link ?? '')}`,
        'share:toast.shared': "Lien d'invitation prêt à partager",
        'share:errors.title': 'Impossible de partager la session',
        'share:errors.network': 'Connexion perdue. Vérifie ta connexion internet.',
        'share:errors.unknown': 'Une erreur inattendue est survenue.',
      };
      return translations[key] ?? key;
    },
    i18n: { language: 'fr' },
  }),
}));

// ─── Mock F4 — hook temps réel + auth ───────────────────────
const mockStart = jest.fn();
const mockStop = jest.fn();
jest.mock('@features/Sharing/hooks/useRealtimeTracking', () => ({
  useRealtimeTracking: () => ({ start: mockStart, stop: mockStop }),
}));

const mockAuthUser = { type: 'guest', id: 'p-alice', displayName: 'Alice', createdAt: 'now' };
jest.mock('@features/Profile/hooks/useAuth', () => ({
  useAuthUser: () => mockAuthUser,
}));

// ─── Mock lucide-react-native ───────────────────────────────
jest.mock('lucide-react-native', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const createMockIcon = (displayName: string) => {
    const MockIcon = (props: Record<string, unknown>) =>
      ReactMock.createElement(View, { testID: `lucide-${displayName}`, ...props });
    MockIcon.displayName = displayName;
    return MockIcon;
  };
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => createMockIcon(prop),
    },
  );
});

// ─── Mock react-native-maps ────────────────────────────────
jest.mock('react-native-maps', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const MockMapView = ReactMock.forwardRef((props: Record<string, unknown>, ref: unknown) =>
    ReactMock.createElement(View, { ...props, ref }),
  );
  MockMapView.displayName = 'MockMapView';
  return {
    __esModule: true,
    default: MockMapView,
    Marker: (props: Record<string, unknown>) => ReactMock.createElement(View, props),
    Circle: (props: Record<string, unknown>) => ReactMock.createElement(View, props),
    PROVIDER_GOOGLE: 'google',
  };
});

// ─── Mock react-native-safe-area-context ────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// [MODIFIED] Mock navigation (pour navigation vers POIScreen)
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
}));

// ─── F5 — Mock DI container (partage + abonnement live) ─────
// useSessionShare lit useAuthStore.getState().user (store persisté) → on expose
// un zustandStorage in-memory pour que le middleware persist ne casse pas.
const mockSubscribeToSharedSession = jest.fn();
const mockShareExecute = jest.fn();
const mockJoinExecute = jest.fn();
const mockUnsubscribe = jest.fn();
const mockStorageMap = new Map<string, string>();

jest.mock('@services/serviceContainer', () => ({
  getContainer: jest.fn(() => ({
    shareSessionUseCase: { execute: mockShareExecute },
    joinSessionUseCase: { execute: mockJoinExecute },
    sessionShareService: {
      subscribeToSharedSession: mockSubscribeToSharedSession,
    },
    zustandStorage: {
      getItem: (key: string) => mockStorageMap.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mockStorageMap.set(key, value);
      },
      removeItem: (key: string) => {
        mockStorageMap.delete(key);
      },
    },
  })),
}));

// ─── Helpers ────────────────────────────────────────────────

const makeParticipant = (name: string, coords: Coordinates): Participant => ({
  id: `p-${name.toLowerCase()}`,
  displayName: name,
  startLocation: {
    id: `loc-${name.toLowerCase()}`,
    coordinates: coords,
    formattedAddress: `Adresse de ${name}`,
  },
});

const PARIS: Coordinates = { latitude: 48.8566, longitude: 2.3522 };
const LYON: Coordinates = { latitude: 45.764, longitude: 4.8357 };

const computedSession: MidpointSession = {
  id: 'session-001',
  status: 'computed',
  participants: [makeParticipant('Alice', PARIS), makeParticipant('Bob', LYON)],
  midpoint: { latitude: 47.3103, longitude: 3.594 },
  midpointRadius: 196000,
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-08T10:01:00.000Z',
};

const draftSession: MidpointSession = {
  id: 'session-002',
  status: 'draft',
  participants: [makeParticipant('Alice', PARIS)],
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-08T10:00:00.000Z',
};

// ─── Tests ──────────────────────────────────────────────────

const GUEST_USER: User = {
  type: 'guest',
  id: 'p-alice',
  displayName: 'Alice',
  createdAt: '2026-06-25T10:00:00.000Z',
};

describe('MapScreen integration', () => {
  let alertSpy: jest.SpiedFunction<typeof Alert.alert>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockNavigate.mockClear();
    mockStart.mockClear();
    mockStop.mockClear();

    // [ADDED] F5 — abonnement live renvoie un désabonnement mockable.
    mockSubscribeToSharedSession.mockReturnValue(mockUnsubscribe);
    mockShareExecute.mockResolvedValue({
      sessionId: 'session-001',
      link: 'mivro://session/session-001',
      expiresAt: Date.now() + SHARE_TTL_GUEST_MS,
    } satisfies CreateSharedSessionResult);
    // [ADDED] F5 — espion sur Alert.alert (retour utilisateur du partage).
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation();
    // [ADDED] F5 — share sheet native mockée (ne pas ouvrir de vraie UI).
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

    useSessionStore.setState({ session: null });
    useAuthStore.setState({ user: GUEST_USER, isAuthenticated: true });
    useRealtimeStore.setState({
      sessionId: null,
      participants: {},
      status: 'idle',
      errorCode: null,
      hasSharingConsent: false,
    });
    // [ADDED] F5 — pas de session partagée par défaut (hook de synchro inerte).
    useSharedSessionStore.setState({
      isShared: false,
      isOwner: false,
      sessionId: null,
      link: null,
      meta: null,
      members: [],
      status: 'idle',
      errorCode: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows EmptyState when no session exists', () => {
    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByTestId('map-screen-empty')).toBeTruthy();
    expect(screen.getByText('Aucune session active')).toBeTruthy();
  });

  it('shows "Calcul en attente" when session is draft', () => {
    useSessionStore.setState({ session: draftSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByTestId('map-screen-not-computed')).toBeTruthy();
    expect(screen.getByText('Calcul en attente')).toBeTruthy();
  });

  it('shows SessionMapView and footer when session is computed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByTestId('map-screen')).toBeTruthy();
    expect(screen.getByTestId('map-session')).toBeTruthy();
    expect(screen.getByTestId('map-footer')).toBeTruthy();
    expect(screen.getByText('Point de rencontre suggéré')).toBeTruthy();
  });

  it('shows masked coordinates in footer summary', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByText(/47\.31\*\*/)).toBeTruthy();
    expect(screen.getByText(/196\.0/)).toBeTruthy();
  });

  it('navigates to POI screen when "Voir POI" button is pressed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    const poiButton = screen.getByTestId('map-btn-poi');
    fireEvent.press(poiButton);

    expect(mockNavigate).toHaveBeenCalledWith('POI');
  });

  it('opens list modal when "Vue liste" is pressed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    fireEvent.press(screen.getByTestId('map-btn-list'));

    expect(screen.getByText('Participants')).toBeTruthy();
    expect(screen.getByText('Point de rencontre')).toBeTruthy();
    expect(screen.getByTestId('map-list-midpoint')).toBeTruthy();
  });

  it('shows participant cards in list modal', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    fireEvent.press(screen.getByTestId('map-btn-list'));

    expect(screen.getByTestId('map-list-participant-p-alice')).toBeTruthy();
    expect(screen.getByTestId('map-list-participant-p-bob')).toBeTruthy();
  });

  it('closes list modal when close button is pressed', () => {
    useSessionStore.setState({ session: computedSession });

    render(<MapScreen />, { wrapper: createQueryClientWrapper() });

    fireEvent.press(screen.getByTestId('map-btn-list'));
    expect(screen.getByTestId('map-list-midpoint')).toBeTruthy();

    fireEvent.press(screen.getByTestId('map-list-close'));

    expect(screen.queryByTestId('map-list-midpoint')).toBeNull();
  });

  // ─── F4 — Temps réel ──────────────────────────────────────
  describe('F4 — real-time sharing', () => {
    it('opens the consent modal when "Partager ma position" is pressed', () => {
      useSessionStore.setState({ session: computedSession });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      fireEvent.press(screen.getByTestId('map-btn-share'));

      expect(screen.getByTestId('map-consent-modal-card')).toBeTruthy();
    });

    it('grants consent and starts tracking on accept', () => {
      useSessionStore.setState({ session: computedSession });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      fireEvent.press(screen.getByTestId('map-btn-share'));
      fireEvent.press(screen.getByTestId('map-consent-modal-accept'));

      expect(useRealtimeStore.getState().hasSharingConsent).toBe(true);
      expect(mockStart).toHaveBeenCalledWith('session-001', 'p-alice');
    });

    it('subscribes (to view others) but does NOT grant consent on decline', () => {
      useSessionStore.setState({ session: computedSession });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      fireEvent.press(screen.getByTestId('map-btn-share'));
      fireEvent.press(screen.getByTestId('map-consent-modal-decline'));

      expect(useRealtimeStore.getState().hasSharingConsent).toBe(false);
      expect(mockStart).toHaveBeenCalledWith('session-001', 'p-alice');
    });

    it('renders live markers on the map when tracking', () => {
      useSessionStore.setState({ session: computedSession });
      useRealtimeStore.setState({
        sessionId: 'session-001',
        participants: {
          'p-bob': {
            participantId: 'p-bob',
            latitude: 47.31,
            longitude: 3.59,
            updatedAt: 1,
            speed: 5,
            heading: 0,
            isOnline: true,
          },
        },
      });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      expect(screen.getByTestId('map-session-live-marker-p-bob')).toBeTruthy();
    });

    it('shows the a11y live list in the list modal when tracking', () => {
      useSessionStore.setState({ session: computedSession });
      useRealtimeStore.setState({ sessionId: 'session-001' });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      fireEvent.press(screen.getByTestId('map-btn-list'));

      expect(screen.getByTestId('map-list-live')).toBeTruthy();
      expect(screen.getByText('Participants en direct')).toBeTruthy();
    });

    it('calls stop() on unmount (leaveSession — RGPD)', () => {
      useSessionStore.setState({ session: computedSession });

      const { unmount } = render(<MapScreen />, { wrapper: createQueryClientWrapper() });
      unmount();

      expect(mockStop).toHaveBeenCalled();
    });

    it('stops SHARING (not the subscription) when toggling off while sharing', () => {
      // Partage actif : abonné + consentement donné.
      useSessionStore.setState({ session: computedSession });
      useRealtimeStore.setState({ sessionId: 'session-001', hasSharingConsent: true });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      fireEvent.press(screen.getByTestId('map-btn-share'));

      // [FIXED] Le toggle off coupe le PARTAGE (setSharingConsent(false)) mais
      // CONSERVE l'abonnement (mode voir-seulement) → stop() n'est PAS appelé.
      expect(useRealtimeStore.getState().hasSharingConsent).toBe(false);
      expect(mockStop).not.toHaveBeenCalled();
    });

    it('share button label is based on hasSharingConsent — "Partager ma position" without consent', () => {
      useSessionStore.setState({ session: computedSession });
      // Suivi actif mais sans consentement (mode voir-seulement).
      useRealtimeStore.setState({ sessionId: 'session-001', hasSharingConsent: false });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      expect(screen.getByText('Partager ma position')).toBeTruthy();
      expect(screen.queryByText('Arrêter le partage')).toBeNull();
    });

    it('share button label is based on hasSharingConsent — "Arrêter le partage" with consent', () => {
      useSessionStore.setState({ session: computedSession });
      useRealtimeStore.setState({ sessionId: 'session-001', hasSharingConsent: true });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      expect(screen.getByText('Arrêter le partage')).toBeTruthy();
      expect(screen.queryByText('Partager ma position')).toBeNull();
    });
  });

  // ─── F5 — Partage collaboratif (deep link) ────────────────
  describe('F5 — collaborative sharing', () => {
    it('does NOT subscribe to the shared session when the session is not shared', () => {
      useSessionStore.setState({ session: computedSession });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      // Hook useSharedSessionSync inerte tant que isShared est false.
      expect(mockSubscribeToSharedSession).not.toHaveBeenCalled();
    });

    it('subscribes to the shared session when in shared mode', () => {
      useSessionStore.setState({ session: computedSession });
      useSharedSessionStore.setState({ isShared: true, sessionId: 'session-001' });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      expect(mockSubscribeToSharedSession).toHaveBeenCalledWith(
        'session-001',
        expect.any(Function),
      );
    });

    it('unsubscribes from the shared session on unmount (RGPD)', () => {
      useSessionStore.setState({ session: computedSession });
      useSharedSessionStore.setState({ isShared: true, sessionId: 'session-001' });

      const { unmount } = render(<MapScreen />, { wrapper: createQueryClientWrapper() });
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('shares the session and alerts success when the share succeeds', async () => {
      useSessionStore.setState({ session: computedSession });

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      fireEvent.press(screen.getByTestId('map-btn-share-session'));

      await waitFor(() => {
        expect(mockShareExecute).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("Lien d'invitation prêt à partager");
      });
    });

    it('alerts a localized error when the share fails', async () => {
      useSessionStore.setState({ session: computedSession });
      mockShareExecute.mockRejectedValueOnce(new SessionShareError('net', 'network'));

      render(<MapScreen />, { wrapper: createQueryClientWrapper() });

      fireEvent.press(screen.getByTestId('map-btn-share-session'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Impossible de partager la session',
          'Connexion perdue. Vérifie ta connexion internet.',
        );
      });
    });
  });
});
