#!/usr/bin/env python3
"""PreToolUse hook — refuses Write/Edit/MultiEdit/NotebookEdit on harness files.

The Bash guard stops shell writes to the harness; this one closes the other
door. Without it, a single Edit could turn `exit 2` into `exit 0` in a hook,
lower a coverage threshold or switch a lint rule off, and no sensor would see
it (JOURNAL J-029).

Protected paths come from scripts/harness-protected.txt. Native artefacts
(ios/Pods, android/**/build) are refused too, like in the Bash guard.

Unlock: only when Claude Code itself was launched with MIVRO_HARNESS_UNLOCK=1
by Cedric. The lock (scripts/harness.lock) then still has to be refreshed from
his terminal, so an unlocked session cannot hide its harness changes either.

Exit 2 blocks the tool call; stderr is handed back to the agent. Fails closed
on an internal error.
"""

from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import harness_paths  # noqa: E402  (path set up just above)

NATIVE_ARTEFACT_RE = re.compile(r"(?:^|/)(?:ios/Pods|android/(?:[^/]+/)*(?:build|\.cxx))(?:/|$)")


def refuse(message: str) -> int:
    print(message, file=sys.stderr)
    return 2


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    try:
        tool_input = payload.get("tool_input") or {}
        path = tool_input.get("file_path") or tool_input.get("notebook_path") or tool_input.get("path") or ""
        if not path:
            return 0
        cwd = payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
        if payload.get("tool_name") == "Read":
            # Read only guards the credentials of $HOME (GitHub token, SSH keys),
            # locked or not; reading a harness file stays allowed (JOURNAL J-049).
            if harness_paths.home_secret(harness_paths.resolve(path, cwd)):
                return refuse(
                    f"✖ Blocked by the Mivro harness: {path} is a credential file.\n\n"
                    "Reading it would let a raw HTTP call bypass the guards (JOURNAL J-049). Ask Cedric."
                )
            return 0
        root = harness_paths.repo_root(cwd)
        rel = harness_paths.to_rel(path, root, cwd)
        if rel is None:
            # Outside the repository: only the files that grant rights or forge
            # what the hooks read ($HOME/.claude settings, transcripts, git config)
            # matter (J-042) — checked before returning, not after.
            if not harness_paths.unlocked() and harness_paths.is_protected(
                path, root, cwd, harness_paths.load_patterns(os.path.join(root, "scripts", "harness-protected.txt"))
            ):
                return refuse(
                    f"✖ Blocked by the Mivro harness: {path} grants rights to the agent or feeds the hooks.\n\n"
                    "Claude Code settings, transcripts and git configuration outside the repository are "
                    "out of the agent's reach (JOURNAL J-042). Ask Cedric."
                )
            return 0
        rel = harness_paths.normalise(rel)

        if NATIVE_ARTEFACT_RE.search(rel):
            return refuse(
                f"✖ Blocked by the Mivro harness: edit inside a native artefact directory ({rel}).\n\n"
                "ios/Pods and android/**/build are generated. Change the source (Podfile, gradle "
                "files) instead; Cedric regenerates the artefacts."
            )

        if harness_paths.unlocked():
            return 0

        patterns = harness_paths.load_patterns(os.path.join(root, "scripts", "harness-protected.txt"))
        # is_protected, not matches(): nested configs and $HOME files too, exactly
        # like the Bash guard (J-043: a nested .eslintrc.json used to be writable here).
        if harness_paths.is_protected(path, root, cwd, patterns):
            return refuse(
                f"✖ Blocked by the Mivro harness: {rel} is a harness file.\n\n"
                "Only the product zones are the agent's (src/, docs/, docs-site/docs/, ios/, android/, "
                "functions/, e2e/, assets/ — scripts/hooks/harness_paths.py). Everything else — hooks, "
                "sensors, tool configs, dotfiles, package.json and lockfiles — is harness: a sensor the "
                "agent can rewrite is not a sensor (JOURNAL J-029, J-045).\n"
                "Describe the exact change to Cedric. He applies it from a session launched with "
                "MIVRO_HARNESS_UNLOCK=1, then refreshes the lock with `npm run harness:relock`."
            )
        return 0
    except Exception as crash:  # fail closed
        return refuse(
            f"✖ Mivro edit guard crashed ({type(crash).__name__}: {crash}); the edit was refused "
            "rather than let through unjudged."
        )


if __name__ == "__main__":
    sys.exit(main())
