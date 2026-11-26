/**
 * @file databaseRules.test.ts
 * @description Structural tests of the Realtime Database security rules (`database.rules.json`).
 *
 *              These tests pin the shape of the rules, not their runtime evaluation: running the
 *              rules needs the Firebase emulator (`@firebase/rules-unit-testing`), which is not a
 *              project dependency (see TODO.md, "Tests des règles RTDB"). The reasoning behind each
 *              grant is in `database.rules.README.md`.
 *
 * @module services/infra/realtime/databaseRules.test
 */

import rulesFile from '../../../../database.rules.json';

const root = rulesFile.rules;
const session = root.sessions.$sessionId;

/** Validation that makes a field immutable once written. */
const IMMUTABLE_CLAUSE = '(!data.exists() || data.val() === newData.val())';

/** Meta fields whose `.validate` carries the immutability clause, derived from the rules. */
const immutableMetaFields = Object.entries(session.meta)
  .filter(
    ([, rule]) =>
      typeof rule === 'object' &&
      '.validate' in rule &&
      typeof rule['.validate'] === 'string' &&
      rule['.validate'].includes(IMMUTABLE_CLAUSE),
  )
  .map(([field]) => field)
  .sort();

/** Meta fields that the `.write` rule of meta requires to still exist after any write. */
const requiredMetaFields = Array.from(
  session.meta['.write'].matchAll(/'([^']+)'/g),
  ([, field]) => field,
).sort();

describe('database.rules.json', () => {
  it('keeps the root closed', () => {
    expect(root['.read']).toBe(false);
    expect(root['.write']).toBe(false);
  });

  describe('sessions/$sessionId', () => {
    // [FIXED] "Rules : sessions/$sessionId sans $other: false": nothing was granted at this level,
    // so get/onValue/remove of a whole session and the read of the participants node were denied
    // (RTDB rules are not filters).
    it('grants the read of a whole session, participants node included', () => {
      expect(session['.read']).toBe(true);
    });

    it('grants a session-level write only to create a session or delete it entirely', () => {
      expect(session['.write']).toBe("!newData.exists() || !data.child('meta').exists()");
    });

    it('rejects any node besides meta, members and participants', () => {
      expect(session.$other['.validate']).toBe(false);
      expect(Object.keys(session).sort()).toEqual(
        ['$other', '.read', '.write', 'members', 'meta', 'participants'].sort(),
      );
    });
  });

  describe('child nodes stay governed by their own rules', () => {
    // [FIXED] "Immuabilité de `meta` contournable": meta had `.write: true`, and `.validate` rules
    // are not evaluated on a deletion, so a client could delete `meta/expiresAt` then write it
    // again with a later value (`!data.exists()` holds on the second write), extending the session
    // at will. The `.write` rule now denies any write that would leave one lifecycle field missing.
    it('grants a meta write only if its four lifecycle fields remain, each immutable', () => {
      expect(session.meta['.write']).toBe(
        "newData.hasChildren(['createdAt', 'expiresAt', 'ownerType', 'status'])",
      );
      expect(session.meta.createdAt['.validate']).toContain(IMMUTABLE_CLAUSE);
      expect(session.meta.expiresAt['.validate']).toContain(IMMUTABLE_CLAUSE);
      expect(session.meta.ownerType['.validate']).toContain(IMMUTABLE_CLAUSE);
      expect(session.meta.status['.validate']).toContain(IMMUTABLE_CLAUSE);
      expect(session.meta.$other['.validate']).toBe(false);
    });

    it('requires on write exactly the meta fields that are immutable', () => {
      expect(requiredMetaFields).toEqual(immutableMetaFields);
    });

    it('keeps each member writable, with unknown fields rejected', () => {
      expect(session.members.$memberId['.write']).toBe(true);
      expect(session.members.$memberId.$other['.validate']).toBe(false);
      expect(session.members.$memberId.startLocation.$other['.validate']).toBe(false);
    });

    it('keeps each participant writable, with unknown fields rejected', () => {
      expect(session.participants.$participantId['.write']).toBe(true);
      expect(session.participants.$participantId.$other['.validate']).toBe(false);
    });
  });
});
