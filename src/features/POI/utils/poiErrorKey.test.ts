/**
 * @file poiErrorKey.test.ts
 * @description Unit tests for poiErrorKey, shared by the POI list and map views.
 *
 * @module features/POI/utils/poiErrorKey.test
 */

import { poiErrorKey } from '@features/POI/utils/poiErrorKey';
import { POIError, type POIErrorCode } from '@services/domain/poi/IPOIService';

describe('poiErrorKey', () => {
  it.each<[POIErrorCode, string]>([
    ['rate_limited', 'errors.rate_limited'],
    ['network', 'errors.network'],
    ['server_error', 'errors.server_error'],
    ['query_timeout', 'errors.query_timeout'],
    ['parse_error', 'errors.parse_error'],
  ])('maps the %s code to its dedicated message key', (code, expectedKey) => {
    expect(poiErrorKey(new POIError('technical message', code))).toBe(expectedKey);
  });

  it('maps invalid_input, which the user cannot fix, to the unknown message key', () => {
    expect(poiErrorKey(new POIError('radius out of bounds', 'invalid_input'))).toBe(
      'errors.unknown',
    );
  });

  it('maps an untyped error to the unknown message key', () => {
    expect(poiErrorKey(new Error('raw technical message'))).toBe('errors.unknown');
  });
});
