/**
 * Tightens the two standard-library entry points that return `any` for data
 * coming from outside the app: JSON.parse and Response.json().
 *
 * With `any`, `const user: User = JSON.parse(raw)` compiled and skipped
 * validation entirely — no cast, no lint error, nothing for check-diff to see
 * (JOURNAL J-031). Declaration merging puts these overloads first, so both now
 * return `unknown` and the value has to go through a Zod schema (TS-004)
 * before it can be used.
 *
 * Harness file: listed in scripts/harness-protected.txt.
 */

interface JSON {
  parse(text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown): unknown;
}

interface Body {
  json(): Promise<unknown>;
}
