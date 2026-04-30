// [ADDED] Sanity check — validates setup and theme import
describe('Sanity check', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('imports theme without error', () => {
    const { lightTheme } = require('@core/theme');
    expect(lightTheme.mode).toBe('light');
  });
});
