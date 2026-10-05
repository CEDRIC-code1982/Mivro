#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-branch-protection.sh — the server-side backstop (JOURNAL J-030).
#
# Protects `main` and `develop` on GitHub:
#   - changes land through a pull request only (no direct push, admins included)
#   - the CI jobs battery, security and harness-guard must be green, on a branch
#     up to date with its base
#   - no force-push, no deletion
# Zero approvals required: Mivro has a single maintainer, and GitHub does not
# let an author approve their own PR. The human gate is the merge itself, plus
# the harness-change label for any harness change.
#
# Run by Cedric (or by the agent on his explicit request) AFTER the workflow
# .github/workflows/check.yml has run at least once on GitHub.
#
#   bash scripts/setup-branch-protection.sh            apply
#   bash scripts/setup-branch-protection.sh --show     print the current rules
# ---------------------------------------------------------------------------
set -euo pipefail

REPO="${MIVRO_REPO:-CEDRIC-code1982/Mivro}"
BRANCHES=(main develop)

if [ "${1:-}" = "--show" ]; then
  for branch in "${BRANCHES[@]}"; do
    echo "== $branch"
    gh api "repos/$REPO/branches/$branch/protection" \
      --jq '{checks: .required_status_checks.contexts, strict: .required_status_checks.strict, admins: .enforce_admins.enabled, pr: (.required_pull_request_reviews != null), force: .allow_force_pushes.enabled, delete: .allow_deletions.enabled}' \
      2>&1 || true
  done
  exit 0
fi

BODY='{
  "required_status_checks": { "strict": true, "contexts": ["battery", "security", "harness-guard"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "dismiss_stale_reviews": false },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}'

SKIPPED=0
for branch in "${BRANCHES[@]}"; do
  # harness-guard runs under pull_request_target, i.e. from the BASE branch's
  # copy of the workflow. Requiring it on a branch that does not carry the
  # workflow yet would leave every PR waiting for a check that never runs.
  if ! gh api "repos/$REPO/contents/.github/workflows/harness-guard.yml?ref=$branch" >/dev/null 2>&1; then
    echo "✖ $branch does not carry .github/workflows/harness-guard.yml yet: merge the harness into it first." >&2
    echo "  Nothing was changed on $branch." >&2
    SKIPPED=$((SKIPPED + 1))
    continue
  fi
  printf '%s\n' "$BODY" | gh api -X PUT "repos/$REPO/branches/$branch/protection" --input - >/dev/null
  echo "✔ $branch protected"
done

gh label create harness-change --repo "$REPO" --color B60205 \
  --description "Cedric approves a change to the harness" 2>/dev/null || true

bash "$0" --show

# A skipped branch is NOT protected: say so with the exit code, not only in a message.
if [ "$SKIPPED" -gt 0 ]; then
  echo "✖ $SKIPPED branch(es) left unprotected (see above)." >&2
  exit 1
fi
