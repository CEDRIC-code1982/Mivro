/**
 * @file locales.parity.test.ts
 * @description Sensor: the French and English catalogues stay in lockstep.
 *
 * A key present in one language only renders the raw key (or the other
 * language) at runtime, and nothing else in the harness would notice: the
 * I18N lint rule only checks that JSX text goes through `t()`. Same for an
 * interpolation variable renamed in one catalogue only — `{{count}}` becomes
 * literal text on screen. Found by the red-team audit (JOURNAL J-035): parity
 * held by luck.
 *
 * @module i18n/locales.parity.test
 */
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.join(__dirname, 'locales');
const INTERPOLATION = /\{\{\s*([\w.]+)\s*\}\}/g;

type Flat = Map<string, string>;

function flatten(value: unknown, prefix: string, out: Flat): Flat {
  if (typeof value === 'string') {
    out.set(prefix, value);
    return out;
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.set(prefix, JSON.stringify(value));
  return out;
}

function load(language: string, file: string): Flat {
  const raw: unknown = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, language, file), 'utf8'));
  return flatten(raw, '', new Map());
}

function variables(text: string): string {
  return [...text.matchAll(INTERPOLATION)]
    .map((match) => match[1] ?? '')
    .sort()
    .join(',');
}

const namespaces = (language: string): string[] =>
  fs
    .readdirSync(path.join(LOCALES_DIR, language))
    .filter((file) => file.endsWith('.json'))
    .sort();

describe('i18n catalogues parity (fr ↔ en)', () => {
  it('both languages ship the same namespace files', () => {
    expect(namespaces('en')).toEqual(namespaces('fr'));
  });

  describe.each(namespaces('fr'))('%s', (file) => {
    const fr = load('fr', file);
    const en = load('en', file);

    it('has the same keys in both languages', () => {
      expect([...en.keys()].sort()).toEqual([...fr.keys()].sort());
    });

    it('uses the same interpolation variables for each key', () => {
      const mismatches: string[] = [];
      for (const [key, frText] of fr) {
        const enText = en.get(key);
        if (enText !== undefined && variables(frText) !== variables(enText)) {
          mismatches.push(`${key}: fr {${variables(frText)}} / en {${variables(enText)}}`);
        }
      }
      expect(mismatches).toEqual([]);
    });

    it('has no empty translation', () => {
      const empty = [
        ...[...fr].filter(([, text]) => text.trim() === '').map(([key]) => `fr:${key}`),
        ...[...en].filter(([, text]) => text.trim() === '').map(([key]) => `en:${key}`),
      ];
      expect(empty).toEqual([]);
    });
  });
});
