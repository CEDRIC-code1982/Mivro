/**
 * @file POICategory.test.ts
 * @description Tests unitaires de l'entité POICategory.
 *              Unit tests for the POICategory entity.
 *
 * @module __tests__/unit/core/entities/POICategory
 */

// [ADDED] Tests unitaires entité POICategory
import {
  POICategorySchema,
  POI_CATEGORY_OVERPASS_FILTERS,
  ALL_POI_CATEGORIES,
} from '@entities/POICategory';
import type { POICategory } from '@entities/POICategory';

describe('POICategory entity', () => {
  // ─── POICategorySchema ────────────────────────────────────
  describe('POICategorySchema', () => {
    const VALID_CATEGORIES: readonly POICategory[] = [
      'restaurant',
      'cafe',
      'bar',
      'park',
      'cinema',
      'museum',
      'shop',
      'sport',
      'hotel',
    ];

    it.each(VALID_CATEGORIES)('parses valid category: %s', (category) => {
      const result = POICategorySchema.parse(category);
      expect(result).toBe(category);
    });

    it('rejects unknown category', () => {
      const result = POICategorySchema.safeParse('bowling');
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = POICategorySchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('rejects non-string value', () => {
      const result = POICategorySchema.safeParse(42);
      expect(result.success).toBe(false);
    });
  });

  // ─── POI_CATEGORY_OVERPASS_FILTERS ────────────────────────
  describe('POI_CATEGORY_OVERPASS_FILTERS', () => {
    it('contains all 9 categories', () => {
      const keys = Object.keys(POI_CATEGORY_OVERPASS_FILTERS);
      expect(keys).toHaveLength(9);
    });

    it('each category has at least one filter', () => {
      for (const category of ALL_POI_CATEGORIES) {
        const filters = POI_CATEGORY_OVERPASS_FILTERS[category];
        expect(filters.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('each filter has key and value strings', () => {
      for (const category of ALL_POI_CATEGORIES) {
        const filters = POI_CATEGORY_OVERPASS_FILTERS[category];
        for (const filter of filters) {
          expect(typeof filter.key).toBe('string');
          expect(typeof filter.value).toBe('string');
          expect(filter.key.length).toBeGreaterThan(0);
          expect(filter.value.length).toBeGreaterThan(0);
        }
      }
    });

    it('bar category includes both bar and pub', () => {
      const barFilters = POI_CATEGORY_OVERPASS_FILTERS.bar;
      const values = barFilters.map((f) => f.value);
      expect(values).toContain('bar');
      expect(values).toContain('pub');
    });
  });

  // ─── ALL_POI_CATEGORIES ───────────────────────────────────
  describe('ALL_POI_CATEGORIES', () => {
    it('contains exactly 9 values', () => {
      expect(ALL_POI_CATEGORIES).toHaveLength(9);
    });

    it('contains all valid categories', () => {
      const expected: readonly POICategory[] = [
        'restaurant',
        'cafe',
        'bar',
        'park',
        'cinema',
        'museum',
        'shop',
        'sport',
        'hotel',
      ];
      expect(ALL_POI_CATEGORIES).toEqual(expected);
    });

    it('matches POI_CATEGORY_OVERPASS_FILTERS keys', () => {
      const filterKeys = Object.keys(POI_CATEGORY_OVERPASS_FILTERS).sort();
      const allCategories = [...ALL_POI_CATEGORIES].sort();
      expect(allCategories).toEqual(filterKeys);
    });
  });
});
