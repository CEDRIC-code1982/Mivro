/**
 * @file LiveParticipantsList.test.tsx
 * @description Tests unitaires de la molecule LiveParticipantsList (F4 — vue a11y).
 *              Unit tests for the LiveParticipantsList molecule (F4 — a11y list).
 *
 * @module __tests__/unit/presentation/components/molecules/LiveParticipantsList
 */

// [ADDED] F4 — Tests unitaires LiveParticipantsList
import { render } from '@testing-library/react-native';
import React from 'react';
import type { Coordinates } from '@core/entities/Location';
import type { RealtimeParticipant } from '@core/entities/RealtimeParticipant';
import LiveParticipantsList from '@presentation/components/molecules/LiveParticipantsList';

// ─── Mock i18n (avec interpolation) ─────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'list.empty': 'Aucun participant en direct pour le moment.',
        'list.you': 'Toi',
        'list.distanceFromMidpoint': `À ${String(opts?.distance ?? '')} du point de rencontre`,
        'status.online': 'En ligne',
        'status.offline': 'Hors ligne',
        'accessibility.participantStatus': `${String(opts?.name ?? '')}, ${String(
          opts?.status ?? '',
        )}, à ${String(opts?.distance ?? '')} du point de rencontre`,
      };
      return translations[key] ?? key;
    },
  }),
}));

// ─── Test data ──────────────────────────────────────────────
const MIDPOINT: Coordinates = { latitude: 48.8566, longitude: 2.3522 };

const makeLive = (
  participantId: string,
  overrides: Partial<RealtimeParticipant> = {},
): RealtimeParticipant => ({
  participantId,
  latitude: 48.86,
  longitude: 2.36,
  updatedAt: 1_700_000_000_000,
  speed: 5,
  heading: 90,
  isOnline: true,
  ...overrides,
});

describe('LiveParticipantsList', () => {
  it('renders the empty state when there are no live participants', () => {
    const { getByText, getByTestId } = render(
      <LiveParticipantsList liveParticipants={[]} midpoint={MIDPOINT} testID="live" />,
    );

    expect(getByTestId('live-empty')).toBeTruthy();
    expect(getByText('Aucun participant en direct pour le moment.')).toBeTruthy();
  });

  it('renders one row per live participant', () => {
    const { getByTestId } = render(
      <LiveParticipantsList
        liveParticipants={[makeLive('p1'), makeLive('p2')]}
        midpoint={MIDPOINT}
        testID="live"
      />,
    );

    expect(getByTestId('live-item-p1')).toBeTruthy();
    expect(getByTestId('live-item-p2')).toBeTruthy();
  });

  it('resolves participant names via resolveName', () => {
    const { getByText } = render(
      <LiveParticipantsList
        liveParticipants={[makeLive('p1')]}
        midpoint={MIDPOINT}
        resolveName={(id) => (id === 'p1' ? 'Alice' : undefined)}
        testID="live"
      />,
    );

    expect(getByText('Alice')).toBeTruthy();
  });

  it('falls back to the participantId when no name is resolved', () => {
    const { getByText } = render(
      <LiveParticipantsList liveParticipants={[makeLive('p1')]} midpoint={MIDPOINT} />,
    );

    expect(getByText('p1')).toBeTruthy();
  });

  it('labels the current participant as "Toi"', () => {
    const { getByText } = render(
      <LiveParticipantsList
        liveParticipants={[makeLive('me')]}
        midpoint={MIDPOINT}
        currentParticipantId="me"
      />,
    );

    expect(getByText('Toi')).toBeTruthy();
  });

  it('shows online / offline status labels', () => {
    const { getByText } = render(
      <LiveParticipantsList
        liveParticipants={[makeLive('p1', { isOnline: false })]}
        midpoint={MIDPOINT}
        resolveName={() => 'Bob'}
      />,
    );

    expect(getByText(/Hors ligne/)).toBeTruthy();
  });

  it('computes a distance label to the midpoint', () => {
    const { getByTestId } = render(
      <LiveParticipantsList
        liveParticipants={[makeLive('p1', { latitude: 48.8566, longitude: 2.3522 })]}
        midpoint={MIDPOINT}
        resolveName={() => 'Bob'}
        testID="live"
      />,
    );

    // Au point de rencontre exact → "0 m"
    const row = getByTestId('live-item-p1');
    expect(row.props.accessibilityLabel).toContain('0 m');
  });

  it('exposes an accessibility label per row (name + status + distance)', () => {
    const { getByTestId } = render(
      <LiveParticipantsList
        liveParticipants={[makeLive('p1')]}
        midpoint={MIDPOINT}
        resolveName={() => 'Alice'}
        testID="live"
      />,
    );

    const row = getByTestId('live-item-p1');
    expect(row.props.accessible).toBe(true);
    expect(row.props.accessibilityRole).toBe('text');
    expect(row.props.accessibilityLabel).toContain('Alice');
    expect(row.props.accessibilityLabel).toContain('En ligne');
  });
});
