#!/usr/bin/env python3
"""PreToolUse hook — vetoes destructive shell commands.

Blocked:
  * rm with both a recursive and a force flag (any order, long forms included)
  * git push --force / -f / --force-with-lease
  * git reset --hard
  * anything touching ios/Pods or android/**/build (native artefacts)
  * the destructive npm scripts: pods, ios-clean, android-clean, clear

Rationale: these destroy state a rebuild cannot always recover (Podfile.lock,
gradle caches, unpushed history). Cedric runs them himself.

Exit 2 blocks the tool call; stderr is handed back to the agent.
"""

from __future__ import annotations

import json
import re
import shlex
import sys

OPERATORS = {";", "&&", "||", "|", "&", "(", ")", "{", "}", "\n"}

DESTRUCTIVE_NPM_SCRIPTS = {"pods", "ios-clean", "android-clean", "clear"}

# ios/Pods, android/build, android/app/build, android/app/.cxx ...
NATIVE_ARTEFACT_RE = re.compile(
    r"(?<![\w./-])(?:\./)?(?:ios/Pods|android/(?:[^\s;&|'\"]*/)?(?:build|\.cxx))(?![\w-])"
)


def deny(what: str, advice: str, command: str) -> None:
    print(f"✖ Blocked by the Mivro harness: {what}", file=sys.stderr)
    print(file=sys.stderr)
    print(f"Command: {command}", file=sys.stderr)
    print(file=sys.stderr)
    print(advice, file=sys.stderr)
    sys.exit(2)


def split_commands(tokens: list[str]) -> list[list[str]]:
    """Split a token stream into individual commands on shell operators.

    Only the first word after an operator (or at the very start) is treated as a
    command name, which keeps heredoc bodies from being mistaken for commands.
    """
    commands: list[list[str]] = [[]]
    for token in tokens:
        if token in OPERATORS:
            commands.append([])
        else:
            commands[-1].append(token)
    return [c for c in commands if c]


def command_name(words: list[str]) -> tuple[str, list[str]]:
    """Strip leading env assignments and simple prefixes, return (name, args)."""
    index = 0
    while index < len(words) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", words[index]):
        index += 1
    while index < len(words) and words[index] in {"sudo", "env", "command", "time", "nohup"}:
        index += 1
    if index >= len(words):
        return "", []
    name = words[index].rsplit("/", 1)[-1]
    return name, words[index + 1 :]


def short_flags(args: list[str]) -> set[str]:
    flags: set[str] = set()
    for arg in args:
        if arg == "--":
            break
        if arg.startswith("--"):
            continue
        if arg.startswith("-") and len(arg) > 1:
            flags.update(arg[1:])
    return flags


def long_flags(args: list[str]) -> set[str]:
    return {arg.split("=", 1)[0] for arg in args if arg.startswith("--")}


def check_rm(args: list[str], command: str) -> None:
    shorts, longs = short_flags(args), long_flags(args)
    recursive = bool({"r", "R"} & shorts) or "--recursive" in longs
    force = "f" in shorts or "--force" in longs
    if recursive and force:
        deny(
            "recursive force delete (rm -rf)",
            "Delete precisely instead: 'rm <file>', or run 'git clean -n' first to see "
            "what would go. If a whole tree really must go, run it yourself.",
            command,
        )


# git global options that consume the next argument, e.g. `git -C <dir> reset`.
GIT_VALUE_OPTS = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}


def git_subcommand(args: list[str]) -> str:
    """Return the git subcommand, skipping global options and their values."""
    index = 0
    while index < len(args):
        arg = args[index]
        if arg in GIT_VALUE_OPTS:
            index += 2
            continue
        if arg.startswith("-"):
            index += 1
            continue
        return arg
    return ""


def check_git(args: list[str], command: str) -> None:
    subcommand = git_subcommand(args)
    flags = long_flags(args)
    if subcommand == "push":
        if any(f.startswith("--force") for f in flags) or "f" in short_flags(args):
            deny(
                "forced push (git push --force / -f / --force-with-lease)",
                "A forced push rewrites shared history. Push a normal commit, or a new "
                "branch. If history truly must be rewritten, do it yourself.",
                command,
            )
    if subcommand == "reset" and "--hard" in flags:
        deny(
            "git reset --hard",
            "This throws away uncommitted work irreversibly. Use 'git stash', or "
            "'git restore <file>' to revert precisely.",
            command,
        )


def check_npm(args: list[str], command: str) -> None:
    positional = [a for a in args if not a.startswith("-")]
    if len(positional) >= 2 and positional[0] in {"run", "run-script"}:
        if positional[1] in DESTRUCTIVE_NPM_SCRIPTS:
            deny(
                f"destructive npm script ({positional[1]})",
                "These wipe Pods, gradle caches or node_modules. Ask Cedric to run it "
                "in his terminal.",
                command,
            )


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    command = ((payload.get("tool_input") or {}).get("command") or "").strip()
    if not command:
        return 0

    # Path-level veto: applies to the raw string, so redirections and globs count.
    if NATIVE_ARTEFACT_RE.search(command):
        deny(
            "command touching ios/Pods or android/**/build",
            "Native artefacts are Cedric's territory: a bad 'pod install' or gradle "
            "clean costs a long rebuild. Ask him to run it (see docs/context/RUNBOOK.md).",
            command,
        )

    try:
        tokens = shlex.split(command, comments=False, posix=True)
    except ValueError:
        # Unbalanced quotes (heredocs, multiline scripts): fall back to the
        # path-level veto only, already applied above.
        return 0

    for words in split_commands(tokens):
        name, args = command_name(words)
        if name == "rm":
            check_rm(args, command)
        elif name == "git":
            check_git(args, command)
        elif name in {"npm", "yarn", "pnpm"}:
            check_npm(args, command)

    return 0


if __name__ == "__main__":
    sys.exit(main())
