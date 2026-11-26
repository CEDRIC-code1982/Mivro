/**
 * @file JoinSessionScreen.test.tsx
 * @description Unit tests for the JoinSessionScreen (F5).
 *
 *              Covers: the start point choice (address search + GPS, locating status, one GPS
 *              error message per reason), the confirm view ("Join" / "Change"), the join itself
 *              (loading / success with navigation to the map / error with retry and cancel), a11y
 *              (labels and hints on the controls) and i18n.
 *              [MODIFIED] The join now starts from the confirm view, once a start point is
 *              chosen. `useJoinStartPoint` is replaced by a small stateful fake: the start point
 *              is real React state (so picking an address really switches to the confirm view),
 *              while `isLocating`, `gpsErrorCode` and `addressUnresolved` are set by each test.
 *              [ADDED] The offline GPS notice (`join-gps-notice`) is checked by its testID and by
 *              the text announced on iOS, never by its i18n key (the key may still change). The real
 *              `AddressAutocomplete` is rendered, with `useGeocodeQuery` mocked
 *              (`@gorhom/bottom-sheet` is mocked in `jest.setup.js`).
 *
 * @module features/Session/screens/JoinSessionScreen/JoinSessionScreen.test
 */

// [ADDED] F5 — JoinSessionScreen unit tests
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React, { useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import type { GeocodeResult } from '@entities/GeocodeResult';
import type { Location } from '@entities/Location';
import type { UseJoinStartPointResult } from '@features/Session/hooks/useJoinStartPoint';
import JoinSessionScreen from '@features/Session/screens/JoinSessionScreen/JoinSessionScreen';
import type { GpsFailureCode } from '@services/domain/geolocation/gpsFailureCode';

// ─── Mock i18n (namespaces share + create) ──────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'join.startPointTitle': "D'où pars-tu ?",
        'join.startPointDescription': 'Indique ton point de départ.',
        'join.locatingTitle': 'Localisation en cours…',
        'join.selectedTitle': 'Ton point de départ',
        'join.confirm': 'Rejoindre',
        'join.confirmHint': 'Rejoint la session avec ce point de départ',
        'join.change': 'Changer',
        'join.changeHint': 'Choisis un autre point de départ',
        'join.loadingTitle': 'Connexion à la session…',
        'join.loadingDescription': 'Récupération du point de rencontre.',
        'join.loadingAccessibilityLabel': 'Connexion à la session en cours',
        'join.successTitle': 'Tu as rejoint la session',
        'join.successDescription': 'Le point de rencontre a été recalculé.',
        'join.openMap': 'Voir la carte',
        'join.retry': 'Réessayer',
        'join.retryHint': 'Relance la connexion à la session',
        'join.cancel': 'Annuler',
        'join.cancelHint': "Revient à l'écran de création",
        'startPointErrors.gps_permission_denied': 'Permission de localisation refusée.',
        'startPointErrors.gps_unavailable': 'Service de localisation indisponible.',
        'startPointErrors.gps_timeout': 'La localisation a pris trop de temps.',
        'startPointErrors.gps_inaccurate': 'Position trop imprécise.',
        'startPointErrors.gps_unknown': "Impossible d'obtenir ta position.",
        'errors.title': 'Impossible de rejoindre la session',
        'errors.expired': 'Ce lien a expiré.',
        'errors.not_found': 'Cette session est introuvable.',
        'errors.unknown': 'Une erreur inattendue est survenue.',
        'autocomplete.useGps': 'Utiliser ma position',
        'autocomplete.addressLabel': 'Adresse',
      };
      return translations[key] ?? opts?.defaultValue ?? key;
    },
  }),
}));

// ─── Mock navigation ────────────────────────────────────────
const mockReset = jest.fn();
let mockSessionId: string | undefined = 'session-001';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ reset: mockReset, navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: { sessionId: mockSessionId } }),
}));

// ─── Mock useSessionShare ───────────────────────────────────
const mockJoin = jest.fn<Promise<boolean>, [string, Location]>();
let mockErrorCode: string | null = null;

jest.mock('@features/Sharing/hooks/useSessionShare', () => ({
  useSessionShare: () => ({
    join: mockJoin,
    share: jest.fn(),
    isBusy: false,
    errorCode: mockErrorCode,
  }),
}));

// ─── Mock useGeocodeQuery (real AddressAutocomplete) ────────
const mockUseGeocodeQuery = jest.fn();

jest.mock('@features/Session/hooks/useGeocodeQuery', () => ({
  useGeocodeQuery: (...args: unknown[]) => mockUseGeocodeQuery(...args),
}));

// ─── Fake useJoinStartPoint ─────────────────────────────────
const START_LOCATION: Location = {
  id: '9b2f6a1e-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
  coordinates: { latitude: 45.764, longitude: 4.8357 },
  formattedAddress: 'Place Bellecour, Lyon',
};

const GEOCODE_RESULT: GeocodeResult = {
  externalId: 'osm-12345',
  coordinates: { latitude: 48.8584, longitude: 2.2945 },
  displayName: 'Tour Eiffel, Paris, France',
  placeType: 'attraction',
  importance: 0.85,
};

/** Values each test sets before rendering, plus spies on the hook actions. */
interface FakeJoinStartPoint {
  initialStartLocation: Location | null;
  isLocating: boolean;
  gpsErrorCode: GpsFailureCode | null;
  addressUnresolved: boolean;
  locateByGps: jest.Mock<Promise<void>, []>;
  selectAddress: jest.Mock<void, [GeocodeResult]>;
  clearStartLocation: jest.Mock<void, []>;
  use: () => UseJoinStartPointResult;
}

const mockJoinStartPoint: FakeJoinStartPoint = {
  initialStartLocation: null,
  isLocating: false,
  gpsErrorCode: null,
  addressUnresolved: false,
  locateByGps: jest.fn<Promise<void>, []>(),
  selectAddress: jest.fn<void, [GeocodeResult]>(),
  clearStartLocation: jest.fn<void, []>(),
  use: (): UseJoinStartPointResult => useFakeJoinStartPoint(),
};

/**
 * Stateful fake of `useJoinStartPoint`: the start point is real state, the actions are spied.
 *
 * @returns Hook result driven by `mockJoinStartPoint`
 */
function useFakeJoinStartPoint(): UseJoinStartPointResult {
  const [startLocation, setStartLocation] = useState<Location | null>(
    mockJoinStartPoint.initialStartLocation,
  );
  return {
    startLocation,
    isLocating: mockJoinStartPoint.isLocating,
    gpsErrorCode: mockJoinStartPoint.gpsErrorCode,
    addressUnresolved: mockJoinStartPoint.addressUnresolved,
    locateByGps: mockJoinStartPoint.locateByGps,
    selectAddress: (result: GeocodeResult) => {
      mockJoinStartPoint.selectAddress(result);
      setStartLocation({
        id: 'loc-from-address',
        coordinates: result.coordinates,
        formattedAddress: result.displayName,
      });
    },
    clearStartLocation: () => {
      mockJoinStartPoint.clearStartLocation();
      setStartLocation(null);
    },
  };
}

jest.mock('@features/Session/hooks/useJoinStartPoint', () => ({
  useJoinStartPoint: () => mockJoinStartPoint.use(),
}));

/**
 * Renders the screen on the confirm view and presses "Join".
 *
 * @returns Render result
 */
const renderAndJoin = () => {
  mockJoinStartPoint.initialStartLocation = START_LOCATION;
  const utils = render(<JoinSessionScreen />);
  fireEvent.press(utils.getByTestId('join-btn-confirm'));
  return utils;
};

describe('JoinSessionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    mockSessionId = 'session-001';
    mockErrorCode = null;
    mockJoinStartPoint.initialStartLocation = null;
    mockJoinStartPoint.isLocating = false;
    mockJoinStartPoint.gpsErrorCode = null;
    mockJoinStartPoint.addressUnresolved = false;
    mockJoinStartPoint.locateByGps.mockResolvedValue(undefined);
    mockUseGeocodeQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Start point choice ───────────────────────────────────
  describe('start point choice', () => {
    it('opens on the choice view with the address search, without a name field', () => {
      const { getByTestId, getByText, queryByTestId } = render(<JoinSessionScreen />);

      expect(getByTestId('join-screen-choose')).toBeTruthy();
      expect(getByText("D'où pars-tu ?")).toBeTruthy();
      expect(getByTestId('join-address')).toBeTruthy();
      expect(getByTestId('join-address-address-input')).toBeTruthy();
      expect(getByTestId('join-address-gps-button')).toBeTruthy();
      expect(queryByTestId('join-address-name-input')).toBeNull();
      expect(queryByTestId('join-locating-status')).toBeNull();
      expect(queryByTestId('join-gps-error')).toBeNull();
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('asks for the GPS position when "Use my location" is pressed', () => {
      const { getByTestId } = render(<JoinSessionScreen />);

      fireEvent.press(getByTestId('join-address-gps-button'));

      expect(mockJoinStartPoint.locateByGps).toHaveBeenCalledTimes(1);
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('shows the locating status and disables the GPS button while locating', () => {
      mockJoinStartPoint.isLocating = true;
      const { getByTestId, getByText } = render(<JoinSessionScreen />);

      expect(getByTestId('join-locating-status')).toBeTruthy();
      expect(getByText('Localisation en cours…')).toBeTruthy();
      expect(getByTestId('join-address-gps-button').props.accessibilityState).toEqual({
        disabled: true,
      });
      expect(getByTestId('join-address-address-input')).toBeTruthy();
    });

    it.each<[GpsFailureCode, string]>([
      ['gps_permission_denied', 'Permission de localisation refusée.'],
      ['gps_unavailable', 'Service de localisation indisponible.'],
      ['gps_timeout', 'La localisation a pris trop de temps.'],
      ['gps_inaccurate', 'Position trop imprécise.'],
      ['gps_unknown', "Impossible d'obtenir ta position."],
    ])('shows the %s message and keeps both paths available', (code, message) => {
      mockJoinStartPoint.gpsErrorCode = code;
      const { getByTestId } = render(<JoinSessionScreen />);

      const error = getByTestId('join-gps-error');
      expect(error).toHaveTextContent(message);
      expect(error.props.accessibilityRole).toBe('alert');
      expect(getByTestId('join-address-gps-button').props.accessibilityState).toEqual({
        disabled: false,
      });
      expect(getByTestId('join-address-address-input')).toBeTruthy();
    });

    it('announces the GPS failure to VoiceOver on iOS', () => {
      const announceSpy = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation();
      mockJoinStartPoint.gpsErrorCode = 'gps_timeout';

      render(<JoinSessionScreen />);

      expect(announceSpy).toHaveBeenCalledWith('La localisation a pris trop de temps.');
    });

    it('announces the locating status to VoiceOver on iOS', () => {
      const announceSpy = jest
        .spyOn(AccessibilityInfo, 'announceForAccessibility')
        .mockImplementation();
      mockJoinStartPoint.isLocating = true;

      render(<JoinSessionScreen />);

      expect(announceSpy).toHaveBeenCalledWith('Localisation en cours…');
    });

    it('switches to the confirm view once an address is picked', () => {
      mockUseGeocodeQuery.mockReturnValue({
        data: [GEOCODE_RESULT],
        isLoading: false,
        error: null,
      });
      const { getByTestId, queryByTestId } = render(<JoinSessionScreen />);

      fireEvent.changeText(getByTestId('join-address-address-input'), 'Tour Eiffel');
      fireEvent.press(getByTestId('join-address-result-osm-12345'));

      expect(mockJoinStartPoint.selectAddress).toHaveBeenCalledWith(GEOCODE_RESULT);
      expect(getByTestId('join-screen-confirm')).toBeTruthy();
      expect(getByTestId('join-start-address')).toHaveTextContent('Tour Eiffel, Paris, France');
      expect(getByTestId('join-btn-confirm')).toBeTruthy();
      expect(queryByTestId('join-screen-choose')).toBeNull();
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('goes back to the Create tab when "Cancel" is pressed on the choice view', () => {
      const { getByTestId } = render(<JoinSessionScreen />);

      fireEvent.press(getByTestId('join-btn-cancel'));

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Tabs', params: { screen: 'Create' } }],
      });
    });
  });

  // ─── Confirm view ─────────────────────────────────────────
  describe('confirm view', () => {
    it('shows the chosen start point with "Join" and "Change"', () => {
      mockJoinStartPoint.initialStartLocation = START_LOCATION;
      const { getByTestId, getByText } = render(<JoinSessionScreen />);

      expect(getByTestId('join-screen-confirm')).toBeTruthy();
      expect(getByText('Ton point de départ')).toBeTruthy();
      expect(getByTestId('join-start-address')).toHaveTextContent('Place Bellecour, Lyon');
      expect(getByTestId('join-btn-confirm')).toBeTruthy();
      expect(getByTestId('join-btn-change')).toBeTruthy();
    });

    it('calls clearStartLocation and goes back to the choice view on "Change"', () => {
      mockJoinStartPoint.initialStartLocation = START_LOCATION;
      const { getByTestId } = render(<JoinSessionScreen />);

      fireEvent.press(getByTestId('join-btn-change'));

      expect(mockJoinStartPoint.clearStartLocation).toHaveBeenCalledTimes(1);
      expect(getByTestId('join-screen-choose')).toBeTruthy();
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('joins with the route sessionId and the chosen start point on "Join"', async () => {
      mockJoin.mockResolvedValue(true);
      const { getByTestId } = renderAndJoin();

      await waitFor(() => expect(getByTestId('join-screen-success')).toBeTruthy());
      expect(mockJoin).toHaveBeenCalledTimes(1);
      expect(mockJoin).toHaveBeenCalledWith('session-001', START_LOCATION);
    });

    it('joins with the address picked in the search', async () => {
      mockJoin.mockResolvedValue(true);
      mockUseGeocodeQuery.mockReturnValue({
        data: [GEOCODE_RESULT],
        isLoading: false,
        error: null,
      });
      const { getByTestId } = render(<JoinSessionScreen />);

      fireEvent.changeText(getByTestId('join-address-address-input'), 'Tour Eiffel');
      fireEvent.press(getByTestId('join-address-result-osm-12345'));
      fireEvent.press(getByTestId('join-btn-confirm'));

      await waitFor(() => expect(getByTestId('join-screen-success')).toBeTruthy());
      expect(mockJoin).toHaveBeenCalledWith(
        'session-001',
        expect.objectContaining({
          coordinates: GEOCODE_RESULT.coordinates,
          formattedAddress: GEOCODE_RESULT.displayName,
        }),
      );
    });

    it('exposes labels and hints on "Join" and "Change"', () => {
      mockJoinStartPoint.initialStartLocation = START_LOCATION;
      const { getByTestId } = render(<JoinSessionScreen />);

      const confirm = getByTestId('join-btn-confirm');
      expect(confirm.props.accessibilityRole).toBe('button');
      expect(confirm.props.accessibilityLabel).toBe('Rejoindre');
      expect(confirm.props.accessibilityHint).toBe('Rejoint la session avec ce point de départ');

      const change = getByTestId('join-btn-change');
      expect(change.props.accessibilityRole).toBe('button');
      expect(change.props.accessibilityLabel).toBe('Changer');
      expect(change.props.accessibilityHint).toBe('Choisis un autre point de départ');
    });

    describe('offline GPS notice', () => {
      it('shows the notice when the GPS address could not be resolved', () => {
        mockJoinStartPoint.initialStartLocation = START_LOCATION;
        mockJoinStartPoint.addressUnresolved = true;
        const { getByTestId } = render(<JoinSessionScreen />);

        expect(getByTestId('join-screen-confirm')).toBeTruthy();
        expect(getByTestId('join-gps-notice')).toBeTruthy();
        expect(getByTestId('join-btn-confirm')).toBeTruthy();
      });

      it('does not show the notice when the address is resolved', () => {
        mockJoinStartPoint.initialStartLocation = START_LOCATION;
        const { getByTestId, queryByTestId } = render(<JoinSessionScreen />);

        expect(getByTestId('join-screen-confirm')).toBeTruthy();
        expect(queryByTestId('join-gps-notice')).toBeNull();
      });

      it('does not show the notice on the choice view', () => {
        mockJoinStartPoint.addressUnresolved = true;
        const { getByTestId, queryByTestId } = render(<JoinSessionScreen />);

        expect(getByTestId('join-screen-choose')).toBeTruthy();
        expect(queryByTestId('join-gps-notice')).toBeNull();
      });

      it('announces the notice text to VoiceOver on iOS when it appears', () => {
        const announceSpy = jest
          .spyOn(AccessibilityInfo, 'announceForAccessibility')
          .mockImplementation();
        mockJoinStartPoint.initialStartLocation = START_LOCATION;
        mockJoinStartPoint.addressUnresolved = true;

        const { getByTestId } = render(<JoinSessionScreen />);

        expect(announceSpy).toHaveBeenCalledTimes(1);
        const announced = announceSpy.mock.calls[0]?.[0] ?? '';
        expect(announced).not.toBe('');
        expect(getByTestId('join-gps-notice')).toHaveTextContent(announced);
      });

      it('announces nothing on iOS when the address is resolved', () => {
        const announceSpy = jest
          .spyOn(AccessibilityInfo, 'announceForAccessibility')
          .mockImplementation();
        mockJoinStartPoint.initialStartLocation = START_LOCATION;

        render(<JoinSessionScreen />);

        expect(announceSpy).not.toHaveBeenCalled();
      });

      it('leaves the notice to the live region on Android', () => {
        const restorePlatform = jest.replaceProperty(Platform, 'OS', 'android');
        const announceSpy = jest
          .spyOn(AccessibilityInfo, 'announceForAccessibility')
          .mockImplementation();
        mockJoinStartPoint.initialStartLocation = START_LOCATION;
        mockJoinStartPoint.addressUnresolved = true;

        const { getByTestId } = render(<JoinSessionScreen />);

        expect(getByTestId('join-gps-notice')).toBeTruthy();
        expect(announceSpy).not.toHaveBeenCalled();
        restorePlatform.restore();
      });
    });
  });

  // ─── Joining ──────────────────────────────────────────────
  describe('joining state', () => {
    it('shows the loading view while the join is pending', () => {
      mockJoin.mockReturnValue(new Promise(() => undefined)); // never resolves
      const { getByTestId, getByText, getByLabelText } = renderAndJoin();

      expect(getByTestId('join-screen-loading')).toBeTruthy();
      expect(getByText('Connexion à la session…')).toBeTruthy();
      expect(getByLabelText('Connexion à la session en cours')).toBeTruthy();
    });
  });

  // ─── Success ──────────────────────────────────────────────
  describe('success state', () => {
    it('shows the success view', async () => {
      mockJoin.mockResolvedValue(true);
      const { getByTestId, getByText } = renderAndJoin();

      await waitFor(() => expect(getByTestId('join-screen-success')).toBeTruthy());
      expect(getByText('Tu as rejoint la session')).toBeTruthy();
    });

    it('navigates (reset) to the Map tab when "View map" is pressed', async () => {
      mockJoin.mockResolvedValue(true);
      const { getByTestId } = renderAndJoin();

      await waitFor(() => expect(getByTestId('join-btn-open-map')).toBeTruthy());
      fireEvent.press(getByTestId('join-btn-open-map'));

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Tabs', params: { screen: 'Map' } }],
      });
    });

    it('exposes an accessible button for opening the map', async () => {
      mockJoin.mockResolvedValue(true);
      const { getByTestId } = renderAndJoin();

      await waitFor(() => expect(getByTestId('join-btn-open-map')).toBeTruthy());
      const button = getByTestId('join-btn-open-map');
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe('Voir la carte');
    });
  });

  // ─── Error ────────────────────────────────────────────────
  describe('error state', () => {
    it('shows the error view with the expired message', async () => {
      mockJoin.mockResolvedValue(false);
      mockErrorCode = 'expired';
      const { getByTestId, getByText } = renderAndJoin();

      await waitFor(() => expect(getByTestId('join-screen-error')).toBeTruthy());
      expect(getByText('Impossible de rejoindre la session')).toBeTruthy();
      expect(getByText('Ce lien a expiré.')).toBeTruthy();
    });

    it('shows the not_found message when the session is unknown', async () => {
      mockJoin.mockResolvedValue(false);
      mockErrorCode = 'not_found';
      const { getByText } = renderAndJoin();

      await waitFor(() => expect(getByText('Cette session est introuvable.')).toBeTruthy());
    });

    it('falls back to the unknown message when errorCode is null', async () => {
      mockJoin.mockResolvedValue(false);
      mockErrorCode = null;
      const { getByText } = renderAndJoin();

      await waitFor(() => expect(getByText('Une erreur inattendue est survenue.')).toBeTruthy());
    });

    it('falls back to the unknown message for an untranslated errorCode', async () => {
      mockJoin.mockResolvedValue(false);
      mockErrorCode = 'something_new';
      const { getByText } = renderAndJoin();

      await waitFor(() => expect(getByText('Une erreur inattendue est survenue.')).toBeTruthy());
    });

    it('shows the error view immediately when the sessionId is missing (no join call)', () => {
      mockSessionId = undefined;
      const { getByTestId, queryByTestId } = render(<JoinSessionScreen />);

      expect(getByTestId('join-screen-error')).toBeTruthy();
      expect(queryByTestId('join-screen-choose')).toBeNull();
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('stays on the error view on retry when the sessionId is missing', () => {
      mockSessionId = undefined;
      const { getByTestId } = render(<JoinSessionScreen />);

      fireEvent.press(getByTestId('join-btn-retry'));

      expect(getByTestId('join-screen-error')).toBeTruthy();
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('retries the join with the same start point when "Try again" is pressed', async () => {
      mockJoin.mockResolvedValue(false);
      mockErrorCode = 'network';
      const { getByTestId } = renderAndJoin();

      await waitFor(() => expect(getByTestId('join-btn-retry')).toBeTruthy());
      mockJoin.mockResolvedValue(true);
      fireEvent.press(getByTestId('join-btn-retry'));

      await waitFor(() => expect(getByTestId('join-screen-success')).toBeTruthy());
      expect(mockJoin).toHaveBeenCalledTimes(2);
      expect(mockJoin).toHaveBeenLastCalledWith('session-001', START_LOCATION);
    });

    it('shows the error view when the join rejects unexpectedly', async () => {
      mockJoin.mockRejectedValue(new Error('boom'));
      const { getByTestId } = renderAndJoin();

      await waitFor(() => expect(getByTestId('join-screen-error')).toBeTruthy());
    });

    it('navigates (reset) to the Create tab when "Cancel" is pressed', async () => {
      mockJoin.mockResolvedValue(false);
      const { getByTestId } = renderAndJoin();

      await waitFor(() => expect(getByTestId('join-btn-cancel')).toBeTruthy());
      fireEvent.press(getByTestId('join-btn-cancel'));

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Tabs', params: { screen: 'Create' } }],
      });
    });

    it('exposes labels and hints on retry and cancel', async () => {
      mockJoin.mockResolvedValue(false);
      const { getByTestId } = renderAndJoin();

      await waitFor(() => expect(getByTestId('join-btn-retry')).toBeTruthy());
      const retry = getByTestId('join-btn-retry');
      expect(retry.props.accessibilityRole).toBe('button');
      expect(retry.props.accessibilityLabel).toBe('Réessayer');
      expect(retry.props.accessibilityHint).toBe('Relance la connexion à la session');

      const cancel = getByTestId('join-btn-cancel');
      expect(cancel.props.accessibilityRole).toBe('button');
      expect(cancel.props.accessibilityLabel).toBe('Annuler');
      expect(cancel.props.accessibilityHint).toBe("Revient à l'écran de création");
    });
  });

  // ─── Defensive safety nets ────────────────────────────────
  describe('defensive paths', () => {
    it('swallows an unexpected rejection of locateByGps', async () => {
      mockJoinStartPoint.locateByGps.mockRejectedValue(new Error('boom'));
      const { getByTestId } = render(<JoinSessionScreen />);

      await act(async () => {
        fireEvent.press(getByTestId('join-address-gps-button'));
      });

      expect(getByTestId('join-screen-choose')).toBeTruthy();
    });
  });
});
