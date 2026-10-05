/**
 * Mivro rule TS-003 — a non-null assertion (`expr!`) is forbidden unless a
 * comment justifies it.
 *
 * `@typescript-eslint/no-non-null-assertion` bans it outright, which does not
 * match CLAUDE.md ("interdite sauf commentaire justificatif"). This rule accepts
 * the assertion when a comment sits on the same line or on the line above.
 */

'use strict';

const { isJustification } = require('./justification');

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid a non-null assertion unless a comment on the same line, or on the line above, justifies it (CLAUDE.md TS-003).',
    },
    schema: [],
    messages: {
      unjustified:
        'Non-null assertion without justification (TS-003). Narrow with a guard, or an early return; if it is genuinely required, put a comment on the line above saying why it cannot be null here.',
    },
  },

  /**
   * Build the visitor.
   *
   * @param {object} context - The ESLint rule context.
   * @returns {object} The AST visitor.
   */
  create(context) {
    const source = context.getSourceCode();

    /**
     * Walk up to the statement the assertion belongs to, so a comment placed
     * above a multi-line expression still counts.
     *
     * @param {object} node - The TSNonNullExpression node under inspection.
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
      const statement = current.parent || current;
      // `export const x = y!`: the comment sits above `export`, which is the
      // parent of the declaration.
      if (statement.parent && /^Export/.test(statement.parent.type)) {
        return statement.parent;
      }
      return statement;
    }

    return {
      TSNonNullExpression(node) {
        const sameLine = source
          .getAllComments()
          .some(
            (comment) => comment.loc.start.line === node.loc.start.line && isJustification(comment),
          );
        if (sameLine) {
          return;
        }

        const statement = enclosingStatement(node);
        const above = source
          .getCommentsBefore(statement)
          .some(
            (comment) =>
              comment.loc.end.line === statement.loc.start.line - 1 && isJustification(comment),
          );
        if (above) {
          return;
        }

        context.report({ node, messageId: 'unjustified' });
      },
    };
  },
};
