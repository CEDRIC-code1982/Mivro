/**
 * @file ParticipantCard.test.tsx
 * @description Unit tests for the ParticipantCard molecule.
 *
 * @module components/molecules/ParticipantCard/ParticipantCard.test
 */

// [ADDED] ParticipantCard unit tests

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import ParticipantCard from '@components/molecules/ParticipantCard';
import type { Participant } from '@entities/MidpointSession';

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
    // includeHiddenElements because the avatar is hidden from the a11y tree
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

  // [ADDED] F7 — emoji avatar
  it('renders the avatar emoji when participant has an avatarId', () => {
    const { getByText, queryByText } = render(
      <ParticipantCard participant={makeParticipant({ displayName: 'Léa', avatarId: 'fox' })} />,
    );

    expect(getByText('🦊', { includeHiddenElements: true })).toBeTruthy();
    // The initial must not be rendered when an emoji avatar is present
    expect(queryByText('L', { includeHiddenElements: true })).toBeNull();
  });

  // [ADDED] F7 — initial fallback when avatarId is missing
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

  // ─── A11Y-003 — hints ─────────────────────────────────────

  it('sets accessibilityHint on the card when provided', () => {
    const { getByTestId } = render(
      <ParticipantCard
        participant={makeParticipant()}
        accessibilityHint="Indique le point de départ de ce participant"
        testID="card"
      />,
    );

    expect(getByTestId('card').props.accessibilityHint).toBe(
      'Indique le point de départ de ce participant',
    );
  });

  it('sets no accessibilityHint on the card when none is provided', () => {
    const { getByTestId } = render(
      <ParticipantCard participant={makeParticipant()} testID="card" />,
    );

    expect(getByTestId('card').props.accessibilityHint).toBeUndefined();
  });

  it('uses removeAccessibilityLabel and removeAccessibilityHint on the remove button', () => {
    const { getByTestId } = render(
      <ParticipantCard
        participant={makeParticipant()}
        onRemove={jest.fn()}
        removeAccessibilityLabel="Supprimer Cédric"
        removeAccessibilityHint="Retire ce point de départ de la session"
        testID="card"
      />,
    );

    const removeButton = getByTestId('card-remove');
    expect(removeButton.props.accessibilityLabel).toBe('Supprimer Cédric');
    expect(removeButton.props.accessibilityHint).toBe('Retire ce point de départ de la session');
  });

  it('falls back to displayName and sets no hint on the remove button without remove props', () => {
    const { getByTestId } = render(
      <ParticipantCard participant={makeParticipant()} onRemove={jest.fn()} testID="card" />,
    );

    const removeButton = getByTestId('card-remove');
    expect(removeButton.props.accessibilityLabel).toBe('Cédric');
    // Non-regression (D5): the address used to be announced as the hint of the × button
    expect(removeButton.props.accessibilityHint).toBeUndefined();
  });
});
