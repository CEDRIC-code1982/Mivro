/**
 * @file container.test.ts
 * @description Tests unitaires du conteneur de dépendances.
 *              Unit tests for the dependency injection container.
 *
 * @module __tests__/unit/di/container
 */

// [ADDED] Tests unitaires container DI

describe('DI Container', () => {
  // Reset module state between tests to get fresh containerInstance
  beforeEach(() => {
    jest.resetModules();
  });

  it('getContainer throws if not initialized', () => {
    const { getContainer } = require('@/di/container') as typeof import('@/di/container');

    expect(() => getContainer()).toThrow('Container not initialized. Call initContainer() first.');
  });

  it('initContainer returns a container with all dependencies', () => {
    const { initContainer } = require('@/di/container') as typeof import('@/di/container');

    const container = initContainer('test-encryption-key');

    expect(container).toBeDefined();
    expect(container.storage).toBeDefined();
    expect(container.zustandStorage).toBeDefined();
    expect(container.createGuestUserUseCase).toBeDefined();
    expect(container.crashReporter).toBeDefined(); // [ADDED]
    expect(container.geocodeService).toBeDefined(); // [ADDED]
    expect(container.searchAddressUseCase).toBeDefined(); // [ADDED]
    expect(container.queryClient).toBeDefined(); // [ADDED]
    expect(container.geolocationService).toBeDefined(); // [ADDED]
    expect(container.getCurrentLocationUseCase).toBeDefined(); // [ADDED]
  });

  it('getContainer returns the container after initialization', () => {
    const { initContainer, getContainer } =
      require('@/di/container') as typeof import('@/di/container');

    initContainer('test-encryption-key');
    const container = getContainer();

    expect(container).toBeDefined();
    expect(container.storage).toBeDefined();
  });

  it('initContainer returns the same instance on second call', () => {
    const { initContainer } = require('@/di/container') as typeof import('@/di/container');

    const first = initContainer('test-encryption-key');
    const second = initContainer('different-key');

    expect(first).toBe(second);
  });

  it('container.createGuestUserUseCase creates a valid guest', () => {
    const { initContainer } = require('@/di/container') as typeof import('@/di/container');

    const container = initContainer('test-encryption-key');
    const guest = container.createGuestUserUseCase.execute();

    expect(guest.type).toBe('guest');
    expect(guest.id).toBeTruthy();
    expect(guest.displayName).toBeTruthy();
  });

  it('container.zustandStorage implements StateStorage interface', () => {
    const { initContainer } = require('@/di/container') as typeof import('@/di/container');

    const container = initContainer('test-encryption-key');

    expect(typeof container.zustandStorage.getItem).toBe('function');
    expect(typeof container.zustandStorage.setItem).toBe('function');
    expect(typeof container.zustandStorage.removeItem).toBe('function');
  });
});
