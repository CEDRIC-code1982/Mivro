/**
 * Mivro rule DS-001 — no magic value inside StyleSheet.create().
 *
 * Every dimension, radius, spacing and colour must come from a theme token, so
 * a raw number or colour string inside a StyleSheet object is a design-system
 * leak. `react-native/no-color-literals` covers colours only, and no stock rule
 * covers numbers scoped to StyleSheet, hence this rule.
 *
 * Tolerated:
 *   - 0 and 1 (a hairline border, a full-opacity value, a reset)
 *   - unitless layout properties that carry no design decision
 *     (flex, zIndex, aspectRatio...), configurable through `allowedProperties`
 *   - negative counterparts of the above
 */

'use strict';

const DEFAULT_ALLOWED_PROPERTIES = [
  'flex',
  'flexGrow',
  'flexShrink',
  'zIndex',
  'aspectRatio',
  'elevation',
  'shadowOpacity',
  'opacity',
  'numberOfLines',
];

const DEFAULT_ALLOWED_NUMBERS = [0, 1];

const COLOR_RE = /^(#|rgba?\(|hsla?\()/i;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid raw numbers and colour strings inside StyleSheet.create(); use theme tokens instead (CLAUDE.md DS-001).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedProperties: { type: 'array', items: { type: 'string' } },
          allowedNumbers: { type: 'array', items: { type: 'number' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      magicNumber:
        'Magic number {{value}} on "{{property}}" (DS-001). Use a theme token, e.g. theme.spacing / theme.radius / theme.typography.',
      magicColor:
        'Colour literal "{{value}}" on "{{property}}" (DS-001). Use a theme colour token.',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedProperties = new Set(options.allowedProperties || DEFAULT_ALLOWED_PROPERTIES);
    const allowedNumbers = new Set(options.allowedNumbers || DEFAULT_ALLOWED_NUMBERS);

    /**
     * Is this node inside a StyleSheet.create(...) call?
     *
     * @param {object} node - Any node.
     * @returns {boolean} True when an ancestor is a StyleSheet.create call.
     */
    function insideStyleSheetCreate(node) {
      let current = node.parent;
      while (current) {
        if (
          current.type === 'CallExpression' &&
          current.callee.type === 'MemberExpression' &&
          current.callee.object.type === 'Identifier' &&
          current.callee.object.name === 'StyleSheet' &&
          current.callee.property.type === 'Identifier' &&
          current.callee.property.name === 'create'
        ) {
          return true;
        }
        current = current.parent;
      }
      return false;
    }

    /**
     * Name of the style property a value belongs to.
     *
     * @param {object} node - The value node.
     * @returns {string} The property name, or '?' when it cannot be resolved.
     */
    function propertyName(node) {
      let current = node;
      while (current.parent) {
        if (current.parent.type === 'Property' && current.parent.value === current) {
          const key = current.parent.key;
          if (key.type === 'Identifier') {
            return key.name;
          }
          if (key.type === 'Literal') {
            return String(key.value);
          }
          return '?';
        }
        current = current.parent;
      }
      return '?';
    }

    return {
      Literal(node) {
        if (!insideStyleSheetCreate(node)) {
          return;
        }

        const property = propertyName(node);
        if (allowedProperties.has(property)) {
          return;
        }

        if (typeof node.value === 'number') {
          if (allowedNumbers.has(Math.abs(node.value))) {
            return;
          }
          context.report({
            node,
            messageId: 'magicNumber',
            data: { value: String(node.value), property },
          });
          return;
        }

        if (typeof node.value === 'string' && COLOR_RE.test(node.value)) {
          context.report({
            node,
            messageId: 'magicColor',
            data: { value: node.value, property },
          });
        }
      },
    };
  },
};
