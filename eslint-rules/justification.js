/**
 * Shared test for TS-002 / TS-003: does a comment actually justify an escape
 * hatch, or does it merely exist?
 *
 * The first version of both rules accepted ANY comment, so `// ok` or `// .`
 * above a cast satisfied the linter (JOURNAL J-031). A justification must now
 * say something: at least MIN_LENGTH characters of text, at least two words,
 * and not one of the filler phrases below. The linter cannot judge whether the
 * reason is true — the reviewer does — but it can refuse an empty one.
 *
 * Not a rule: eslint-local-rules.js lists rules explicitly, so this module is
 * never loaded as one.
 */

'use strict';

const MIN_LENGTH = 15;

const FILLER =
  /^(ok|okay|fine|safe|todo|fixme|hack|cast|trust me|it works|works|needed|required|necessary|intentional|on purpose|see above|see below|ignore|ts|type|types)$/i;

/**
 * Text of a comment, without comment markers, JSDoc stars or tags noise.
 *
 * @param {{ value: string }} comment - An ESLint comment token.
 * @returns {string} The normalised text.
 */
function commentText(comment) {
  return comment.value
    .split('\n')
    .map((line) => line.replace(/^\s*\*?\s?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Does this comment carry a real justification?
 *
 * @param {{ value: string }} comment - An ESLint comment token.
 * @returns {boolean} True when the text is long and specific enough.
 */
function isJustification(comment) {
  const text = commentText(comment);
  const bare = text.replace(/[^\p{L}\p{N}\s'-]/gu, '').trim();
  if (bare.length < MIN_LENGTH) {
    return false;
  }
  if (bare.split(/\s+/).length < 2) {
    return false;
  }
  return !FILLER.test(bare);
}

module.exports = { isJustification, commentText, MIN_LENGTH };
