/**
 * Local ESLint rules for Mivro, loaded by eslint-plugin-local-rules.
 *
 * Each rule mechanises one CLAUDE.md rule that no stock rule expresses.
 * They are referenced as `local-rules/<name>` in .eslintrc.js.
 */

'use strict';

module.exports = {
  // TS-002
  'no-unjustified-type-assertion': require('./eslint-rules/no-unjustified-type-assertion'),
  // TS-003
  'no-unjustified-non-null': require('./eslint-rules/no-unjustified-non-null'),
  // LOG-001
  'log-format': require('./eslint-rules/log-format'),
  // DS-001
  'no-magic-style-values': require('./eslint-rules/no-magic-style-values'),
};
