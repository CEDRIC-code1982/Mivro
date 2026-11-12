/**
 * @file locales.keys.test.ts
 * @description Sensor: every static key passed to `t()` exists in the French catalogue.
 *
 * The react-i18next mock of the unit tests ignores the namespace and returns
 * the raw key, so a component test cannot tell `t('markers.midpoint')` in the
 * wrong namespace from a real label: both render something. A key missing
 * from its catalogue renders the raw key on screen (809ba70 left this open;
 * JOURNAL J-022). The parity test then extends the check to English.
 *
 * Read: the non-test `.ts`/`.tsx` files of `src/`, comments removed. A binding
 * is `const { t } = useTranslation('ns')` or `const { t: alias } = …`; each
 * call `t('key')`, `t("key")` or `` t(`key`) `` of that binding is resolved in
 * `ns`, or in the namespace written before `:` in the key.
 *
 * Closed by refusal (lot E): any other call of `useTranslation(` — no namespace,
 * an array of namespaces, `{ t, i18n }` — fails the test until this sensor
 * learns it, instead of leaving the file unread.
 *
 * Limits: a key built at run time (a template with `${}`) is not checked; a
 * `t` received as a parameter, or `i18n.t`, is not resolved; a key that ends
 * on a sub-tree instead of a string passes when the sub-tree exists.
 *
 * @module i18n/locales.keys.test
 */
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(__dirname, '..');
const FR_DIR = path.join(__dirname, 'locales', 'fr');
const BINDING =
  /const\s*\{\s*t(?:\s*:\s*(\w+))?\s*\}\s*=\s*useTranslation\(\s*['"]([\w-]+)['"]\s*\)/g;
const ANY_BINDING = /\buseTranslation\(/g;
const COMMENTS = /\/\*[\s\S]*?\*\/|(^|[^:'"\\])\/\/.*$/gm;
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

type Catalogue = Record<string, unknown>;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : sourceFiles(full);
    }
    const isSource = /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name);
    return isSource ? [full] : [];
  });
}

function loadCatalogues(): Map<string, Catalogue> {
  const catalogues = new Map<string, Catalogue>();
  for (const file of fs.readdirSync(FR_DIR).filter((name) => name.endsWith('.json'))) {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(FR_DIR, file), 'utf8'));
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      catalogues.set(file.replace(/\.json$/, ''), Object.fromEntries(Object.entries(raw)));
    }
  }
  return catalogues;
}

function hasKey(catalogue: Catalogue | undefined, key: string): boolean {
  let node: unknown = catalogue;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
      return false;
    }
    const children = Object.fromEntries(Object.entries(node));
    if (part in children) {
      node = children[part];
      continue;
    }
    return PLURAL_SUFFIXES.some((suffix) => `${part}${suffix}` in children);
  }
  return node !== undefined;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface Call {
  file: string;
  namespace: string;
  key: string;
}

function withoutComments(source: string): string {
  return source.replace(COMMENTS, '$1');
}

function callsIn(source: string, file: string): Call[] {
  const code = withoutComments(source);
  const calls: Call[] = [];
  for (const binding of code.matchAll(BINDING)) {
    const name = binding[1] ?? 't';
    const namespace = binding[2] ?? '';
    const call = new RegExp(
      `(?<![\\w.$])${escapeRegExp(name)}\\(\\s*(['"\`])((?:(?!\\1).)*)\\1`,
      'g',
    );
    for (const match of code.matchAll(call)) {
      const literal = match[2] ?? '';
      if (literal.includes('${')) {
        continue;
      }
      const separator = literal.indexOf(':');
      calls.push(
        separator > 0
          ? { file, namespace: literal.slice(0, separator), key: literal.slice(separator + 1) }
          : { file, namespace, key: literal },
      );
    }
  }
  return calls;
}

const staticCalls = (file: string): Call[] => callsIn(fs.readFileSync(file, 'utf8'), file);

/** Number of useTranslation() calls this sensor cannot read in a source. */
function unreadBindings(source: string): number {
  const code = withoutComments(source);
  return [...code.matchAll(ANY_BINDING)].length - [...code.matchAll(BINDING)].length;
}

describe('i18n keys used in the code exist in the French catalogue', () => {
  const catalogues = loadCatalogues();
  const files = sourceFiles(SRC_DIR);
  const calls = files.flatMap(staticCalls);

  it('finds the t() calls of the code (the sensor reads something)', () => {
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((call) => call.namespace === 'biometric')).toBe(true);
  });

  it('reads every useTranslation() of the code (an unknown form fails, lot E)', () => {
    const unread = files
      .filter((file) => unreadBindings(fs.readFileSync(file, 'utf8')) !== 0)
      .map((file) => path.relative(SRC_DIR, file));
    expect(unread).toEqual([]);
  });

  it('resolves every static key in its namespace', () => {
    const missing = calls
      .filter((call) => !hasKey(catalogues.get(call.namespace), call.key))
      .map((call) => `${path.relative(SRC_DIR, call.file)}: ${call.namespace}:${call.key}`);
    expect(missing).toEqual([]);
  });

  it('reads a call through an alias, a namespace prefix, and skips a run-time key', () => {
    const source = [
      "const { t } = useTranslation('map');",
      "const { t: tBio } = useTranslation('biometric');",
      "t('a.b'); tBio('c.d'); t('poi:e'); t(`f.${x}`); obj.t('g');",
    ].join('\n');
    expect(callsIn(source, 'x.tsx').map((call) => `${call.namespace}:${call.key}`)).toEqual([
      'map:a.b',
      'poi:e',
      'biometric:c.d',
    ]);
  });

  it('counts a useTranslation() form it cannot read', () => {
    expect(unreadBindings("const { t } = useTranslation('map');")).toBe(0);
    expect(unreadBindings("const { t, i18n } = useTranslation('map');")).toBe(1);
    expect(unreadBindings('const { t } = useTranslation();')).toBe(1);
    expect(unreadBindings("// useTranslation('x') in a comment")).toBe(0);
  });

  it('resolves a key in a plural form, and rejects a missing key or namespace', () => {
    const catalogue: Catalogue = { a: { b: 'x', count_one: 'one', count_other: 'n' } };
    expect(hasKey(catalogue, 'a.b')).toBe(true);
    expect(hasKey(catalogue, 'a.count')).toBe(true);
    expect(hasKey(catalogue, 'a.c')).toBe(false);
    expect(hasKey(undefined, 'a.b')).toBe(false);
  });
});
