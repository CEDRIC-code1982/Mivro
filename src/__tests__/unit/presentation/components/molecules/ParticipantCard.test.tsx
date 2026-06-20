/**
 * @file ParticipantCard.test.tsx
 * @description Tests unitaires de la molecule ParticipantCard.
 *              Unit tests for the ParticipantCard molecule.
 *
 * @module __tests__/unit/presentation/components/molecules/ParticipantCard
 */

// [ADDED] Tests unitaires ParticipantCard

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import type { Participant } from '@core/entities/MidpointSession';
import ParticipantCard from '@presentation/components/molecules/ParticipantCard';

// ─── Test data ──────────────────────────────────────────────

const makeParticipant = (overrides?: Partial<Participant>): Participant => ({
  id: 'p-001',
  displayName: 'Cédric',
  startLocation: {
    id: 'loc-001',
    coordinates: { latitude: 48.8566, longitude: 2.3522 },
    formattedAddress: '1 Rue de Rivoli, Paris, France',
  },
  ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────

describe('ParticipantCard', () => {
  it('renders without crashing (smoke test)', () => {
    const { getByTestId } = render(
      <ParticipantCard participant={makeParticipant()} testID="card" />,
    );

    expect(getByTestId('card')).toBeTruthy();
  });

  it('renders displayName', () => {
    const { getByText } = render(<ParticipantCard participant={makeParticipant()} />);

    expect(getByText('Cédric')).toBeTruthy();
  });

  it('renders formattedAddress', () => {
    const { getByText } = render(<ParticipantCard participant={makeParticipant()} />);

    expect(getByText('1 Rue de Rivoli, Paris, France')).toBeTruthy();
  });

  it('renders the correct initial in avatar', () => {
    // includeHiddenElements car l'avatar est masqué de l'arbre a11y
    const { getByText } = render(
      <ParticipantCard participant={makeParticipant({ displayName: 'Sophie' })} />,
    );

    expect(getByText('S', { includeHiddenElements: true })).toBeTruthy();
  });

  it('renders initial uppercase even for lowercase name', () => {
    const { getByText } = render(
      <ParticipantCard participant={makeParticipant({ displayName: 'alice' })} />,
    );

    expect(getByText('A', { includeHiddenElements: true })).toBeTruthy();
  });

  // [ADDED] F7 — avatar emoji
  it('renders the avatar emoji when participant has an avatarId', () => {
    const { getByText, queryByText } = render(
      <ParticipantCard participant={makeParticipant({ displayName: 'Léa', avatarId: 'fox' })} />,
    );

    expect(getByText('🦊', { includeHiddenElements: true })).toBeTruthy();
    // L'initiale ne doit pas être rendue quand un avatar emoji est présent
    expect(queryByText('L', { includeHiddenElements: true })).toBeNull();
  });

  // [ADDED] F7 — fallback initiale si avatarId absent
  it('falls back to the name initial when participant has no avatarId', () => {
    const { getByText } = render(
      <ParticipantCard participant={makeParticipant({ displayName: 'Bruno' })} />,
    );

    expect(getByText('B', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows remove button when onRemove is provided', () => {
    const onRemove = jest.fn();
    const { getByTestId } = render(
      <ParticipantCard participant={makeParticipant()} onRemove={onRemove} testID="card" />,
    );

    expect(getByTestId('card-remove')).toBeTruthy();
  });

  it('hides remove button when onRemove is not provided', () => {
    const { queryByTestId } = render(
      <ParticipantCard participant={makeParticipant()} testID="card" />,
    );

    expect(queryByTestId('card-remove')).toBeNull();
  });

  it('calls onRemove when remove button is pressed', () => {
    const onRemove = jest.fn();
    const { getByTestId } = render(
      <ParticipantCard participant={makeParticipant()} onRemove={onRemove} testID="card" />,
    );

    fireEvent.press(getByTestId('card-remove'));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('uses accessibilityLabelOverride when provided', () => {
    const { getByTestId } = render(
      <ParticipantCard
        participant={makeParticipant()}
        accessibilityLabelOverride="Custom label"
        testID="card"
      />,
    );

    expect(getByTestId('card').props.accessibilityLabel).toBe('Custom label');
  });

  it('concatenates name and address for default accessibilityLabel', () => {
    const { getByTestId } = render(
      <ParticipantCard participant={makeParticipant()} testID="card" />,
    );

    expect(getByTestId('card').props.accessibilityLabel).toBe(
      'Cédric, 1 Rue de Rivoli, Paris, France',
    );
  });
});
