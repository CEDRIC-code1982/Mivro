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

Even unlocked, an edit of a module the guards load (scripts/hooks/*.py) is
first simulated on a throwaway copy (JOURNAL J-056: twice, a two-step edit left
the guards broken and the repairing edit refused). The simulation is a net
against accidents, not a security boundary, and its first duty is to keep the
repair path open: in an unlocked session the Bash guard lets
`git restore -- scripts/hooks/<file>` through, so the proposed tree must keep
harness_paths loading, fast, and unlocked, and the Bash guard answering. An
edit that only damages this edit guard is then repairable by that restore, and
the refusal says so. The simulation runs the proposed code outside the Bash
sandbox, as the next hook call would anyway, and writes only in its own
temporary directory.

Exit 2 blocks the tool call; stderr is handed back to the agent. Fails closed
on an internal error.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import harness_paths  # noqa: E402  (path set up just above)

NATIVE_ARTEFACT_RE = re.compile(r"(?:^|/)(?:ios/Pods|android/(?:[^/]+/)*(?:build|\.cxx))(?:/|$)")
HOOKS_PREFIX = "scripts/hooks/"

# The hook has 10 s (.claude/settings.json); the simulation may run the health
# check twice (proposed tree, then current tree), so each run gets 3.5 s, each
# guard probe 1 s, and unlocked() itself must answer within 0.8 s: a slow
# harness_paths is a broken one, every guard calls it on every tool call. A
# proposed tree that does not answer within its run (a guard or harness_paths
# that blocks) counts as broken too, against a current tree that does.
_CHECK_TIMEOUT = 3.5
_PROBE_TIMEOUT = 1.0
_UNLOCKED_BUDGET = 0.8
# Exit code the health check uses, with a "BROKEN: " line, to name what is
# broken. The decision does not rest on it: any failure of the proposed tree
# counts, and the differential against the current tree (same check) is what
# keeps a broken checker from ever blocking an edit (J-056).
_BROKEN = 3

# Run inside a throwaway copy of scripts/hooks/: every module compiles,
# harness_paths loads and answers unlocked() fast and right, and both guards
# answer harmless payloads with exit 0 within their budget, the edit guard on a
# scripts/hooks/ file too (the never-matching old_string ends that simulation
# at once).
_HOOKS_HEALTH_CHECK = r"""
import json, os, subprocess, sys, time

def broken(message):
    print("BROKEN: " + message, file=sys.stderr)
    sys.exit(3)

hooks, root = sys.argv[1], sys.argv[2]
probe_timeout, unlocked_budget = float(sys.argv[3]), float(sys.argv[4])
for name in sorted(os.listdir(hooks)):
    if name.endswith(".py"):
        try:
            with open(os.path.join(hooks, name), encoding="utf-8") as handle:
                compile(handle.read(), name, "exec")
        except Exception as error:
            broken(f"{name} does not compile: {type(error).__name__}: {error}")
sys.path.append(hooks)
started = time.monotonic()
try:
    import harness_paths
    state = harness_paths.unlocked()
except Exception as error:
    broken(f"harness_paths fails: {type(error).__name__}: {error}")
if time.monotonic() - started > unlocked_budget:
    broken(f"harness_paths.unlocked() takes more than {unlocked_budget:g} s")
if os.environ.get("MIVRO_HARNESS_UNLOCK") == "1" and not state:
    broken("harness_paths.unlocked() would return False in this unlocked session")
never = "\x00mivro-health-probe\x00"
probes = [
    ("pre-bash-guard.py", {"tool_name": "Bash", "tool_input": {"command": "ls"}, "cwd": root}),
]
if os.environ.get("MIVRO_HARNESS_UNLOCK") == "1":
    # The repair path the refusal message points to must stay open (J-056).
    probes.append(("pre-bash-guard.py", {"tool_name": "Bash", "tool_input": {
        "command": "git restore -- scripts/hooks/pre-edit-guard.py"}, "cwd": root}))
probes += [
    ("pre-edit-guard.py", {"tool_name": "Edit", "tool_input": {
        "file_path": os.path.join(root, "src", "App.tsx"), "old_string": "a", "new_string": "b"}, "cwd": root}),
    ("pre-edit-guard.py", {"tool_name": "Edit", "tool_input": {
        "file_path": os.path.join(root, "scripts", "hooks", "harness_paths.py"),
        "old_string": never, "new_string": never}, "cwd": root}),
]
for guard, payload in probes:
    script = os.path.join(hooks, guard)
    if not os.path.exists(script):
        continue
    try:
        run = subprocess.run(
            [sys.executable, "-I", "-B", "-X", "pycache_prefix=/dev/null/mivro-nopyc", script],
            input=json.dumps(payload), capture_output=True, text=True, timeout=probe_timeout, cwd=root,
        )
    except subprocess.TimeoutExpired:
        broken(f"{guard} takes longer than {probe_timeout:g} s on a harmless call")
    if run.returncode != 0:
        broken(f"{guard} would refuse a harmless call (exit {run.returncode}): {run.stderr.strip()[:300]}")
"""


def refuse(message: str) -> int:
    print(message, file=sys.stderr)
    return 2


def _apply_edit(text: str, old: str, new: str, replace_all: bool) -> str | None:
    if not old or old not in text:
        return None  # the Edit tool will reject it by itself
    return text.replace(old, new) if replace_all else text.replace(old, new, 1)


def _simulated_content(tool: str, tool_input: dict, current: str | None) -> str | None:
    if tool == "Write":
        content = tool_input.get("content")
        return content if isinstance(content, str) else None
    if tool == "Edit":
        old = tool_input.get("old_string") or ""
        new = tool_input.get("new_string") or ""
        if current is None:
            # An Edit with an empty old_string creates the file: simulate it too,
            # or a module that does not compile lands unchecked (review of lot 3).
            return new if not old else None
        return _apply_edit(current, old, new, bool(tool_input.get("replace_all")))
    if tool == "MultiEdit":
        text = current
        for edit in tool_input.get("edits") or []:
            if text is None:
                return None
            text = _apply_edit(
                text, edit.get("old_string") or "", edit.get("new_string") or "", bool(edit.get("replace_all"))
            )
        return text
    return None


def _health_check(hooks_copy: str, root: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-I", "-B", "-X", "pycache_prefix=/dev/null/mivro-nopyc", "-c",
         _HOOKS_HEALTH_CHECK, hooks_copy, root, str(_PROBE_TIMEOUT), str(_UNLOCKED_BUDGET)],
        capture_output=True, text=True, timeout=_CHECK_TIMEOUT, cwd=root,
    )


def _hooks_edit_breaks_guards(rel: str, root: str, payload: dict) -> str | None:
    """Simulate an edit of scripts/hooks/*.py; return why it breaks the guards, or None.

    The edit is refused only when the health check fails on the proposed tree
    (any exit code, or no answer in time) while the same check passes on the
    current tree. Anything else lets the edit through: a checker that fails on
    both trees is the checker's own problem, and a tree already broken may be
    getting its repair. This check must never become the lock-out it is meant
    to prevent.
    """
    hooks_dir = os.path.join(root, "scripts", "hooks")
    # The part below scripts/hooks/, as given: on APFS a case variant of the
    # path is the same file, and writing it into the copy overwrites it there.
    inner = rel[len(HOOKS_PREFIX):]
    target = os.path.join(hooks_dir, inner)
    try:
        current = None
        if os.path.exists(target):
            with open(target, encoding="utf-8") as handle:
                current = handle.read()
        new = _simulated_content(payload.get("tool_name") or "", payload.get("tool_input") or {}, current)
        if new is None:
            return None
        with tempfile.TemporaryDirectory(prefix="mivro-hooks-") as tmp:
            proposed = os.path.join(tmp, "proposed")
            shutil.copytree(hooks_dir, proposed, ignore=shutil.ignore_patterns("__pycache__"))
            destination = os.path.realpath(os.path.join(proposed, inner))
            if not destination.startswith(os.path.realpath(proposed) + os.sep):
                return None  # outside the copy: not a hooks module after all
            os.makedirs(os.path.dirname(destination), exist_ok=True)
            with open(destination, "w", encoding="utf-8") as handle:
                handle.write(new)
            try:
                run = _health_check(proposed, root)
                lines = [line for line in run.stderr.strip().splitlines() if line.startswith("BROKEN: ")]
                tail = (run.stderr.strip().splitlines() or [""])[-1][:200]
                reason = (
                    lines[-1][len("BROKEN: "):] if lines
                    else f"the health check exits {run.returncode} on the proposed tree: {tail}"
                )
                # ANY failure of the proposed tree counts, not only the reserved
                # code: a sys.exit() at harness_paths load is no Exception and
                # used to slip through (4th review of lot 3). The differential
                # below keeps a broken checker from blocking: the same check runs
                # on the current tree, and fails there too in that case.
                proposed_broken = run.returncode != 0
            except subprocess.TimeoutExpired:
                # A proposed tree that blocks (a guard or harness_paths that never
                # answers) is the worst break of all; judged below against the
                # current tree like any other (review of lot 3).
                reason = f"the proposed hooks tree does not answer within {_CHECK_TIMEOUT:g} s"
                proposed_broken = True
            if not proposed_broken:
                return None
            # Differential: blame the edit only if the current tree is healthy,
            # within its own time limit (a timeout here is the checker's problem).
            current_copy = os.path.join(tmp, "current")
            shutil.copytree(hooks_dir, current_copy, ignore=shutil.ignore_patterns("__pycache__"))
            if _health_check(current_copy, root).returncode != 0:
                return None
    except Exception:  # noqa: BLE001 - the checker failed, not the edited code
        return None
    return reason


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
            # Without case, like every path comparison of the harness (J-047).
            folded = rel.casefold()
            if folded.startswith(HOOKS_PREFIX) and folded.endswith(".py"):
                broken = _hooks_edit_breaks_guards(rel, root, payload)
                if broken:
                    return refuse(
                        f"✖ Refused by the Mivro harness: this edit of {rel} would break the guards.\n\n"
                        f"Simulated on a throwaway copy of scripts/hooks/: {broken}\n"
                        "The guards load this code on every tool call; a broken state refuses everything, "
                        "the repairing edit included (JOURNAL J-056). Make the whole change in ONE edit "
                        "(an import together with its first use), or Write the full file. If an earlier "
                        "edit already broke this guard, `git restore -- <file>` through Bash repairs it "
                        "in an unlocked session."
                    )
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
