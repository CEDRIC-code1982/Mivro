/**
 * Mivro rule LOG-001 — every console call must carry the imposed prefix:
 *
 *   [LEVEL][FileName][functionName][line][HH:mm:ss] message
 *
 * The function name, the line and the timestamp are normally interpolated, so
 * the check runs on the SHAPE of the first argument: its static text with every
 * interpolation collapsed to a placeholder. Verified are the four bracketed
 * segments plus the opening bracket of the time segment. The level is also
 * checked against the console method used, which catches the copy-paste classic
 * of an [INFO] prefix on console.error.
 *
 * Options:
 *   checkFileName (default true) — the second segment must equal the file's
 *   basename without extension.
 */

'use strict';

const LEVELS_BY_METHOD = {
  log: ['INFO', 'DEBUG'],
  info: ['INFO'],
  debug: ['DEBUG'],
  warn: ['WARN'],
  error: ['ERROR'],
};

// Stands in for an interpolated expression. Any character except ']' works,
// so an interpolated segment still matches the [^\]]* of a segment.
const INTERPOLATION = '\u0001';

// [LEVEL][File][fn][line][  -> the function name, the line and the time are
// normally interpolated, so every segment but the level may be a placeholder.
const PREFIX_RE = /^\[(DEBUG|INFO|WARN|ERROR)\]\[([^\]]+)\]\[([^\]]*)\]\[([^\]]*)\]\[/;

/**
 * Render the leading shape of an expression: its static text with every
 * interpolation collapsed to a placeholder. String concatenation is followed
 * down its left spine, since the prefix always sits in the leftmost operand.
 *
 * @param {object} node - The first argument of the console call.
 * @returns {string|null} The prefix shape, or null when the expression carries
 *   no statically visible text at all.
 */
function logPrefixShape(node) {
  if (!node) {
    return null;
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral') {
    // quasis are interleaved with expressions: q0 ${e0} q1 ${e1} q2 ...
    return node.quasis.map((quasi) => quasi.value.cooked).join(INTERPOLATION);
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return logPrefixShape(node.left);
  }
  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require the imposed log prefix [LEVEL][FileName][functionName][line][HH:mm:ss] on every console call (CLAUDE.md LOG-001).',
    },
    schema: [
      {
        type: 'object',
        properties: { checkFileName: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      missingPrefix:
        'Log without the LOG-001 prefix. Expected the message to start with [LEVEL][FileName][functionName][line][HH:mm:ss].',
      dynamicMessage:
        'Log message must start with a static LOG-001 prefix so it can be verified. Build the prefix inline instead of passing a pre-computed variable.',
      wrongLevel:
        'Log level [{{found}}] does not match console.{{method}}. Expected one of: {{expected}}.',
      wrongFileName:
        'Log prefix names [{{found}}] but this file is {{expected}}. Keep the second segment equal to the file name.',
    },
  },

  /**
   * Build the visitor.
   *
   * @param {object} context - The ESLint rule context.
   * @returns {object} The AST visitor.
   */
  create(context) {
    const options = context.options[0] || {};
    const checkFileName = options.checkFileName !== false;

    const filename = context.getFilename();
    const basename = filename.split('/').pop() || '';
    const expectedName = basename.replace(/\.(ts|tsx|js|jsx)$/, '');

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== 'MemberExpression' ||
          callee.object.type !== 'Identifier' ||
          callee.object.name !== 'console' ||
          callee.property.type !== 'Identifier'
        ) {
          return;
        }

        const method = callee.property.name;
        const expectedLevels = LEVELS_BY_METHOD[method];
        if (!expectedLevels) {
          return;
        }

        const text = logPrefixShape(node.arguments[0]);
        if (text === null) {
          context.report({ node, messageId: 'dynamicMessage' });
          return;
        }

        const match = PREFIX_RE.exec(text);
        if (!match) {
          context.report({ node, messageId: 'missingPrefix' });
          return;
        }

        const [, level, fileSegment] = match;

        if (!expectedLevels.includes(level)) {
          context.report({
            node,
            messageId: 'wrongLevel',
            data: { found: level, method, expected: expectedLevels.join(', ') },
          });
          return;
        }

        if (checkFileName && fileSegment !== expectedName) {
          context.report({
            node,
            messageId: 'wrongFileName',
            data: { found: fileSegment, expected: basename },
          });
        }
      },
    };
  },
};
