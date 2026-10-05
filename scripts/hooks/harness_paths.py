"""Shared helpers for the harness guards: repo root and what the harness is.

The harness is everything that is NOT product code (JOURNAL J-045). Five
reviews in a row each found another file a tool discovers on its own —
.babelrc, package.json keys, __mocks__, .npmrc, .gitattributes, .editorconfig,
typedoc.json... — and an enumeration of protected files can never be complete.
So the model is inverted: PRODUCT_ZONES lists where the agent may write; any
other file, present or future, tracked or not, is harness: protected by the
guards, hashed by the lock, labelled by harness-guard.

scripts/harness-protected.txt still lists files INSIDE the product zones that
are harness too (sensor tests, the stdlib type override), and is the list the
guards, the lock and harness-guard all read — they can never disagree.
"""

from __future__ import annotations

import os
import re
import subprocess

HOOKS_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ROOT = os.path.dirname(os.path.dirname(HOOKS_DIR))
PROTECTED_LIST = os.path.join(DEFAULT_ROOT, "scripts", "harness-protected.txt")

# Human-only escape hatch. It is read from the hook's own environment, which
# the agent's Bash tool cannot change: `MIVRO_HARNESS_UNLOCK=1 claude` in a
# terminal is the only way to set it. If Claude Code ever stops passing its
# environment to hooks, the unlock simply stops working — the guard fails
# closed, which is the safe direction.
UNLOCK_ENV = "MIVRO_HARNESS_UNLOCK"

# A path inside a worktree or a worktree's git dir maps back onto the same
# protected file of the main checkout.
_WORKTREE_PREFIXES = (
    re.compile(r"^\.claude/worktrees/[^/]+/"),
    re.compile(r"^\.git/worktrees/[^/]+/"),
)


def _settings_inject_unlock() -> bool:
    """Does a settings file set the unlock through its `env` block?

    Hooks inherit Claude Code's environment, and settings files can add to it:
    an agent that wrote `"env": {"MIVRO_HARNESS_UNLOCK": "1"}` would unlock the
    NEXT session silently. The unlock must come from the terminal that
    launched Claude Code, so a settings-provided one is ignored.
    """
    home = os.path.expanduser("~")
    candidates = [
        os.path.join(home, ".claude", "settings.json"),
        os.path.join(home, ".claude", "settings.local.json"),
    ]
    project = os.environ.get("CLAUDE_PROJECT_DIR")
    if project:
        candidates += [
            os.path.join(project, ".claude", "settings.json"),
            os.path.join(project, ".claude", "settings.local.json"),
        ]
    for path in candidates:
        try:
            with open(path, encoding="utf-8") as handle:
                if UNLOCK_ENV in handle.read():
                    return True
        except OSError:
            continue
    return False


def unlocked() -> bool:
    return os.environ.get(UNLOCK_ENV) == "1" and not _settings_inject_unlock()


# Outside the repository: files whose rewrite would grant the agent rights or
# forge what the hooks read (permissions, environment, transcripts). Patterns
# are relative to $HOME. Memory files (~/.claude/projects/*/memory/) stay writable.
HOME_PROTECTED = (
    ".claude/settings.json",
    ".claude/settings.local.json",
    ".claude.json",
    # A global git config can set core.hooksPath for every repository.
    ".gitconfig",
    # Instructions injected with authority into EVERY session, the reviewer's
    # included (JOURNAL J-046).
    ".claude/CLAUDE.md",
    ".config/git/config",
)
# Credentials: reading them would let a raw HTTP call bypass the gh checks.
HOME_SECRETS = (".config/gh/hosts.yml",)

# A tool configuration below the root is merged over the root one (J-039). The
# two separate projects of the repository keep theirs.
NESTED_CONFIG_RE = re.compile(
    r"^(\.eslintrc.*|\.prettierrc.*|prettier\.config\..*|\.babelrc.*|babel\.config\..*"
    r"|jest\.config\..*|tsconfig.*\.json|\.dependency-cruiser.*|\.eslintignore|\.prettierignore"
    # A nested package.json carries `eslintConfig` / `prettier` keys (J-043).
    r"|package\.json)$",
    # APFS is case-insensitive: src/x/Package.json IS package.json (J-046).
    re.IGNORECASE,
)
# Keep in sync with the case list in scripts/check-diff.sh (the self-test checks both).
NESTED_CONFIG_EXCEPTIONS = {"docs-site/package.json", "docs-site/tsconfig.json", "docs-site/babel.config.js"}


# package.json keys that configure a tool — any of them changes a sensor's
# verdict: `eslintIgnore` is read even under --no-eslintrc when .eslintignore is
# absent, `babel` is merged over babel.config.js, `jest` over jest.config.js
# (JOURNAL J-044). The lock hashes them, the edit guard refuses changing them,
# harness-guard treats them as harness.
PACKAGE_HARNESS_KEYS = (
    "scripts", "lint-staged", "eslintConfig", "eslintIgnore", "prettier", "babel", "jest",
    "browserslist", "type", "imports", "husky",
)


def is_mock(rel: str) -> bool:
    """Jest applies any file under a __mocks__ directory WITHOUT a jest.mock call:
    src/x/__mocks__/@theme.ts silently replaced the theme the contrast test
    checks (JOURNAL J-044). None is tracked today; a new one is Cedric's call."""
    return "__mocks__" in rel.split("/")


# Where the agent writes product: application code, its tests, documentation,
# native projects (guarded by the `native` sensor), Cloud Functions, e2e, assets.
PRODUCT_DIRS = (
    "src/", "docs/", "docs-site/docs/", "docs-site/src/", "docs-site/static/",
    "ios/", "android/", "functions/", "e2e/", "assets/",
)
PRODUCT_ROOT_FILES = {
    "app.json", "index.js", "metro.config.js", "database.rules.json", "firebase.json",
}
# Nothing nested is product any more: functions/package.json decides what Cloud
# Build installs in the admin backend, so it is a dependency decision (J-046).
PRODUCT_NESTED_CONFIGS: set[str] = set()
# Instructions Claude Code injects with authority into every session (J-046).
INSTRUCTION_FILES = {"claude.md", "claude.local.md"}
PRODUCT_ZONES = {"dirs": PRODUCT_DIRS, "root_files": PRODUCT_ROOT_FILES}


def is_product(rel: str) -> bool:
    """May the agent write this repo-relative path?

    Compared case-insensitively: APFS (and the tools on it) read
    src/theme/Contrast.test.ts as the protected src/theme/contrast.test.ts
    (JOURNAL J-046).
    """
    rel = normalise(rel).casefold()
    if not rel or rel.startswith("../"):
        return False
    parts = rel.split("/")
    # Git-ignored build and dependency directories inside the zones are read by
    # tsc and Jest but escape the lock and check-diff (J-046).
    if any(part in {"node_modules", "build", "dist", "coverage", "pods"} for part in parts[:-1]):
        return False
    if parts[-1] in INSTRUCTION_FILES:
        return False
    # Dotfiles and dot-directories are tool configuration (.npmrc, .gitattributes,
    # .editorconfig, .babelrc...), wherever they sit. A placeholder is not.
    if any(part.startswith(".") for part in parts) and parts[-1] != ".gitkeep":
        return False
    if is_mock(rel):
        return False
    if "/" not in rel:
        return rel in PRODUCT_ROOT_FILES or rel.endswith(".md")
    if not rel.startswith(PRODUCT_DIRS):
        return False
    if NESTED_CONFIG_RE.match(parts[-1]) and rel not in PRODUCT_NESTED_CONFIGS:
        return False
    return True


def is_harness(rel: str, patterns: list[str] | None = None) -> bool:
    rel = normalise(rel)
    if patterns is not None and matches(rel, patterns):
        return True
    return not is_product(rel)


def nested_config(rel: str) -> bool:
    return "/" in rel and rel not in NESTED_CONFIG_EXCEPTIONS and bool(NESTED_CONFIG_RE.match(os.path.basename(rel)))


def rel_under(absolute: str, base: str) -> str | None:
    """`absolute` relative to `base`, compared without case (APFS), or None
    when it lies outside. The returned path keeps the case it was given."""
    a, b = absolute.casefold().rstrip("/"), base.casefold().rstrip("/")
    if a == b:
        return ""
    if not a.startswith(b + "/"):
        return None
    return absolute[len(base.rstrip("/")) + 1:]


def home_secret(absolute: str) -> bool:
    home = os.path.realpath(os.path.expanduser("~"))
    rel = rel_under(absolute, home)
    return rel is not None and rel.casefold() in {p.casefold() for p in HOME_SECRETS}
HOME_PROTECTED_SUFFIXES = (".jsonl",)  # session and subagent transcripts
HOME_TRANSCRIPTS_DIR = ".claude/projects/"


def home_protected(absolute: str) -> bool:
    # The base is compared without case too: ~/.Claude/settings.json IS
    # ~/.claude/settings.json on APFS (JOURNAL J-047).
    home = os.path.realpath(os.path.expanduser("~"))
    rel = rel_under(absolute, home)
    if rel is None:
        return False
    rel = rel.casefold()
    if rel in {p.casefold() for p in HOME_PROTECTED}:
        return True
    return rel.startswith(HOME_TRANSCRIPTS_DIR) and rel.endswith(HOME_PROTECTED_SUFFIXES)


def repo_root(cwd: str | None = None) -> str:
    """Main checkout root: CLAUDE_PROJECT_DIR, else git, else this file's repo."""
    env_root = os.environ.get("CLAUDE_PROJECT_DIR")
    if env_root and os.path.isdir(env_root):
        return os.path.realpath(env_root)
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=cwd or os.getcwd(),
            capture_output=True,
            text=True,
            timeout=5,
            check=True,
        )
        return os.path.realpath(out.stdout.strip())
    except Exception:
        return os.path.realpath(DEFAULT_ROOT)


def load_patterns(path: str = PROTECTED_LIST) -> list[str]:
    try:
        with open(path, encoding="utf-8") as handle:
            lines = handle.read().splitlines()
    except OSError:
        # Missing list: protect the list's own directory at least, so deleting
        # the file cannot switch the guards off.
        return ["scripts/**", ".claude/settings.json", ".husky/**"]
    return [line.strip() for line in lines if line.strip() and not line.lstrip().startswith("#")]


def normalise(rel: str) -> str:
    rel = rel.replace(os.sep, "/")
    for prefix in _WORKTREE_PREFIXES:
        rel = prefix.sub(lambda m: ".git/" if m.group(0).startswith(".git/") else "", rel, count=1)
    while rel.startswith("./"):
        rel = rel[2:]
    return rel


def matches(rel: str, patterns: list[str]) -> bool:
    rel = normalise(rel).casefold()
    for pattern in patterns:
        pattern = pattern.casefold()
        if pattern.endswith("/**"):
            base = pattern[:-3]
            if rel == base or rel.startswith(base + "/"):
                return True
        elif rel == pattern:
            return True
    return False


def resolve(path: str, cwd: str) -> str:
    """Absolute path with EVERY symlink resolved, the file itself included.

    Resolving only the parent let `ln -s scripts/check.sh notes.txt` turn a
    harmless-looking file into a door to a harness file (JOURNAL J-042).
    realpath copes with a file that does not exist yet (Write).
    """
    expanded = os.path.expanduser(path)
    absolute = expanded if os.path.isabs(expanded) else os.path.join(cwd, expanded)
    return os.path.realpath(absolute)


def to_rel(path: str, root: str, cwd: str) -> str | None:
    """Repo-relative form of `path`, or None when it lies outside the repo."""
    if not path:
        return None
    absolute = resolve(path, cwd)
    # Without case: /Users/.../MIVRO/scripts/check.sh is a harness file (J-047).
    return rel_under(absolute, root)


def _same_repo_worktree_rel(absolute: str, root: str) -> str | None:
    """Path relative to ANOTHER worktree of this repository, if it lies in one.

    `git worktree add ../w && echo x > ../w/scripts/check.sh` rewrote a harness
    file that a later commit from that worktree would carry (JOURNAL J-042).
    """
    probe = absolute
    while probe and not os.path.isdir(probe):
        probe = os.path.dirname(probe)
    if not probe:
        return None
    try:
        out = subprocess.run(
            ["git", "-C", probe, "rev-parse", "--show-toplevel", "--git-common-dir"],
            capture_output=True, text=True, timeout=5, check=True,
        ).stdout.split("\n")
        mine = subprocess.run(
            ["git", "-C", root, "rev-parse", "--git-common-dir"],
            capture_output=True, text=True, timeout=5, check=True,
        ).stdout.strip()
    except Exception:
        return None
    top, common = out[0].strip(), out[1].strip()
    common = os.path.realpath(os.path.join(top, common)) if not os.path.isabs(common) else os.path.realpath(common)
    mine = os.path.realpath(os.path.join(root, mine)) if not os.path.isabs(mine) else os.path.realpath(mine)
    if common.casefold() != mine.casefold():
        return None
    return rel_under(absolute, os.path.realpath(top))


def is_protected(path: str, root: str, cwd: str, patterns: list[str]) -> bool:
    if not path:
        return False
    absolute = resolve(path, cwd)
    if home_protected(absolute):
        return True
    rel = to_rel(path, root, cwd)
    if rel is None:
        other = _same_repo_worktree_rel(absolute, root)
        return other is not None and is_harness(other, patterns)
    if rel == "":
        return False
    return is_harness(rel, patterns)


LOCK_FILE = "scripts/harness.lock"


def lockable_files(root: str) -> list[str]:
    """Harness files present in the working tree (tracked or not), sorted.

    That is every file outside the product zones — package.json and the
    lockfiles included, so a dependency change is Cedric's call — plus the
    listed files inside them. Untracked ones count: a new dotfile or config is
    a harness change too. The lock file itself is excluded, obviously.
    """
    out = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=root,
        capture_output=True,
        check=True,
    )
    patterns = load_patterns(os.path.join(root, "scripts", "harness-protected.txt"))
    files = {
        f
        for f in out.stdout.decode("utf-8").split("\0")
        if f
        and f != LOCK_FILE
        and is_harness(f, patterns)
        and os.path.isfile(os.path.join(root, f))
    }
    return sorted(files)


if __name__ == "__main__":
    import sys

    if sys.argv[1:] == ["--lockable"]:
        print("\n".join(lockable_files(repo_root())))
    elif len(sys.argv) == 3 and sys.argv[1] == "--is-harness":
        sys.exit(0 if is_harness(sys.argv[2], load_patterns()) else 1)
    else:
        print("usage: harness_paths.py --lockable", file=sys.stderr)
        sys.exit(2)
