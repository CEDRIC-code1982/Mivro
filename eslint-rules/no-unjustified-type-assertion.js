/**
 * Mivro rule TS-002 — a type assertion (`expr as T`) is forbidden unless a
 * comment justifies it.
 *
 * CLAUDE.md phrased this as "cast interdit sauf commentaire justificatif", which
 * a stock rule cannot express: `@typescript-eslint/consistent-type-assertions`
 * either bans every assertion or none. This rule accepts an assertion when a
 * comment sits on the same line or on the line just above it.
 *
 * Not reported:
 *   - `as const` (a literal-type widening hint, not an escape hatch)
 *   - the inner `as unknown` of a `x as unknown as T` chain (one report, not two)
 */

'use strict';

/**
 * Is this node the `as unknown` step of a `x as unknown as T` double assertion?
 *
 * @param {object} node - The TSAsExpression node under inspection.
 * @returns {boolean} True when the parent is itself an assertion, so the inner
 *   step is reported through its outer one instead.
 */
function isInnerStepOfDoubleAssertion(node) {
  return Boolean(node.parent) && node.parent.type === 'TSAsExpression';
}

/**
 * Is the asserted type the `const` keyword?
 *
 * @param {object} node - The TSAsExpression node under inspection.
 * @returns {boolean} True for `expr as const`.
 */
function isConstAssertion(node) {
  const annotation = node.typeAnnotation;
  return Boolean(
    annotation &&
      annotation.type === 'TSTypeReference' &&
      annotation.typeName &&
      annotation.typeName.type === 'Identifier' &&
      annotation.typeName.name === 'const',
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid a type assertion unless a comment on the same line, or on the line above, justifies it (CLAUDE.md TS-002).',
    },
    schema: [],
    messages: {
      unjustified:
        'Type assertion without justification (TS-002). Prefer a Zod schema or a type guard; if the assertion is genuinely required, put a comment on the line above saying why.',
    },
  },

  create(context) {
    const source = context.getSourceCode();

    /**
     * Does a comment vouch for this assertion?
     *
     * @param {object} node - The TSAsExpression node under inspection.
     * @returns {boolean} True when a comment sits on the same line or above.
     */
    function hasJustifyingComment(node) {
      const statement = enclosingStatement(node);
      const startLine = statement.loc.start.line;

      const sameLine = source
        .getAllComments()
        .some((comment) => comment.loc.start.line === node.loc.start.line);
      if (sameLine) {
        return true;
      }

      const before = source.getCommentsBefore(statement);
      return before.some((comment) => comment.loc.end.line === startLine - 1);
    }

    /**
     * Walk up to the statement the assertion belongs to, so a comment placed
     * above a multi-line expression still counts.
     *
     * @param {object} node - The TSAsExpression node under inspection.
     * @returns {object} The nearest enclosing statement-like ancestor.
     */
    function enclosingStatement(node) {
      let current = node;
      while (
        current.parent &&
        !/Statement|Declaration|Property|ReturnStatement/.test(current.parent.type)
      ) {
        current = current.parent;
      }
      return current.parent || current;
    }

    return {
      TSAsExpression(node) {
        if (isConstAssertion(node) || isInnerStepOfDoubleAssertion(node)) {
          return;
        }
        if (hasJustifyingComment(node)) {
          return;
        }
        context.report({ node, messageId: 'unjustified' });
      },
    };
  },
};
