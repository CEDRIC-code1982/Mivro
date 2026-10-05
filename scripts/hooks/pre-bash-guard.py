#!/usr/bin/env python3
"""PreToolUse hook — vetoes destructive or harness-defeating shell commands.

Blocked, wherever they appear in the command line (chained with ; && || |,
in a subshell, in $(...) or backticks, behind bash -c / sh -c / eval / xargs /
npx -c, in inline interpreter code, even split over several lines):

  destructive
    * rm with both a recursive and a force flag (any order, long forms included)
    * rm -r on a directory that holds tracked files
    * find -delete / -exec rm, git clean -f, git checkout/restore of the whole
      tree or of a directory, git stash drop/clear, git branch -D, history
      rewriting and ref deletion
    * git push --force / -f / --force-with-lease / +refspec / :refspec / --delete / --mirror
    * git reset --hard
    * inline interpreter code that deletes trees (shutil.rmtree, fs.rmSync, ['rm','-rf'] ...)
    * a command name taken from a variable ($X -rf ...), which cannot be judged
    * a shell or interpreter fed on stdin (`... | bash`), which cannot be judged
    * anything touching ios/Pods or android/**/build (native artefacts)
    * the destructive npm scripts: pods, ios-clean, android-clean, clear

  gate bypass
    * --no-verify / commit -n, HUSKY=0, core.hooksPath, GIT_CONFIG_*, git aliases
    * commits made without the hooks: git commit-tree, git update-ref
    * hiding the Claude Code context from the git hooks (unset / env -i /
      declare +x / export -n CLAUDECODE)
    * GitHub mutations that would weaken the server-side gates (gh api writes,
      gh pr merge --admin, labels, secrets, workflows, repo settings)

  harness tamper (unless the human launched Claude Code with MIVRO_HARNESS_UNLOCK=1)
    * any write to a path listed in scripts/harness-protected.txt:
      redirection, tee, cp/mv/rm/ln/chmod/truncate/ed, sed -i / perl -i,
      curl -o / wget -O, tar -x / unzip into the repo, patch / git apply / git am,
      prettier --write / eslint --fix, git checkout/restore/rm/mv,
      npm pkg set scripts, inline interpreter code
    * a write target or cd target that cannot be judged ($VAR, $(...), backticks)
    * refreshing the harness lock (scripts/harness-lock.sh --update)

Long options are matched by prefix too: git accepts `--no-verif`, `--har`,
`--forc` as the full option (JOURNAL J-038).

Rationale: these destroy state a rebuild cannot always recover, or switch off
the very sensors that are supposed to judge the agent. Cedric runs them himself.

This guard is a speed bump, not the backstop: the backstop is the CI plus
branch protection (docs/harness/INVENTAIRE.md). It fails CLOSED on an internal
error — a crash must never let a command through unjudged.

Exit 2 blocks the tool call; stderr is handed back to the agent.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import harness_paths  # noqa: E402  (path set up just above)

OPERATORS = {";", ";;", "&&", "||", "|", "|&", "&", "(", ")", "{", "}", "!"}
REDIRECTS = {">", ">>", ">|", "&>", "&>>", ">&", "<>"}

# Placeholder left where a $(...) / backtick substitution stood. Its inner
# command is judged on its own; its OUTPUT is unknown, so a write target that
# contains it cannot be judged.
SUBST = "__MIVRO_SUBST__"

DESTRUCTIVE_NPM_SCRIPTS = {"pods", "ios-clean", "android-clean", "clear"}
PROTECTED_NPM_SCRIPTS = {"harness:relock"}

SHELLS = {"bash", "sh", "zsh", "dash", "ksh", "fish"}
INTERPRETERS = {
    "python": ("-c",),
    "python3": ("-c",),
    "node": ("-e", "-p", "--eval", "--print"),
    "perl": ("-e", "-E"),
    "ruby": ("-e",),
    "osascript": ("-e",),
}
# Prefix commands that run the rest of the line as a command.
WRAPPERS = {
    "sudo", "env", "command", "builtin", "time", "nohup", "nice", "exec", "stdbuf",
    "caffeinate", "xargs", "timeout", "npx",
}
# Wrappers whose options may consume a value.
WRAPPER_VALUE_OPTS = {
    "xargs": {"-I", "-J", "-n", "-P", "-L", "-d", "-E", "-s", "-R", "-S"},
    "timeout": {"-s", "-k", "--signal", "--kill-after"},
    "env": {"-u", "-C", "-S", "--unset", "--chdir"},
    "nice": {"-n"},
    "stdbuf": {"-i", "-o", "-e"},
    "sudo": {"-u", "-g", "-C", "-D", "-h", "-p", "-U"},
    "npx": {"-p", "--package"},
}
# Commands that write or remove the files named in their arguments.
FILE_WRITERS = {
    "cp", "mv", "rm", "ln", "install", "rsync", "truncate", "chmod", "chown",
    "touch", "unlink", "rmdir", "shred", "tee", "dd", "ditto", "ed", "ex",
}
COPIERS = {"cp", "install", "rsync", "ln", "ditto"}
# Inline code that deletes a tree: a deletion API is refused outright...
TREE_DELETE_RE = re.compile(
    r"rmtree|rmSync|rmdirSync|removedirs|rm_rf|remove_dir_all|remove_tree|FileUtils\.rm|rimraf"
    r"|\bfs(?:\.promises)?\.(?:rm|rmdir)\s*\(|\bfsp?\.rm\s*\(|promises\.rm\s*\("
    r"|\.rm\s*\([^)]*recursive\s*:\s*true"
)
# First segment of the harness directories: a literal equal to one of them in
# code that writes files is refused, whatever the path is assembled into.
PROTECTED_SEGMENTS = {"scripts", ".husky", ".github", "eslint-rules", ".claude", ".git"}
# ...a shell `rm -r` only when the code actually runs a command. Code that merely
# WRITES the words "rm -r" (a doc edited through a heredoc) is not a deletion.
CMD_DELETE_RE = re.compile(r"rm\s+-\w*[rR]|['\"]rm['\"]\s*,\s*['\"]-\w*[rR]")
EXEC_RE = re.compile(r"os\.system|subprocess|execSync|spawnSync|child_process|\bsystem\s*\(|\bexec\s*\(|popen|Popen")
# Inline code that writes files. A bare open() is a read: only a write mode counts.
CODE_WRITE_RE = re.compile(
    r"open\s*\([^)]*['\"][rb]*[wax]\+?b?['\"]|write_text|write_bytes|writeFile|appendFile"
    r"|createWriteStream|os\.rename|os\.replace|os\.remove|os\.unlink|unlink|shutil|truncate"
    r"|chmod|symlink|copyFile|\bfs\.(?:rm|cp|copy|mv|rename|write|append|truncate)"
)
# Canonical long options git (and others) accept by unambiguous prefix.
CANONICAL_LONG = (
    "--no-verify", "--hard", "--force", "--force-with-lease", "--delete", "--mirror",
    "--prune", "--recursive", "--ignore-environment", "--in-place", "--output", "--write",
    "--fix", "--staged", "--worktree", "--admin",
)

# ios/Pods, android/build, android/app/build, android/app/.cxx ... but NOT
# android/app/build.gradle, a versioned source file (JOURNAL J-024).
NATIVE_ARTEFACT_RE = re.compile(
    r"(?<![\w./-])(?:\./)?(?:ios/Pods|android/(?:[^\s;&|'\"]*/)?(?:build|\.cxx))(?=/|$|[\s;&|'\")`*])"
)

HEREDOC_RE = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")

# Environment variables and git configuration keys whose VALUE git (or the
# shell) runs as a command. Their value is judged like a command line:
# `GIT_EDITOR="rm -rf src" git commit --amend` and
# `git -c core.fsmonitor='rm -rf src' status` used to run unjudged (JOURNAL J-042).
EXEC_ENV_VARS = {
    "GIT_EDITOR", "GIT_SEQUENCE_EDITOR", "GIT_PAGER", "GIT_EXTERNAL_DIFF", "GIT_SSH",
    "GIT_SSH_COMMAND", "GIT_ASKPASS", "SSH_ASKPASS", "EDITOR", "VISUAL", "PAGER",
    "LESSOPEN", "PROMPT_COMMAND", "BASH_ENV", "ENV",
}
EXEC_GIT_KEYS = {
    "core.editor", "core.pager", "core.fsmonitor", "core.sshcommand", "core.askpass",
    "core.hookspath", "sequence.editor", "diff.external", "gpg.program", "credential.helper",
    "clean.requireforce", "core.gitproxy", "uploadpack.packobjectshook",
}
EXEC_GIT_KEY_SUFFIXES = (".command", ".driver", ".clean", ".smudge", ".process", ".textconv", ".cmd", ".program", ".helper")
# `git config` forms that only read.
GIT_CONFIG_READS = {"--get", "--get-all", "--get-regexp", "--get-urlmatch", "--list", "-l", "--show-origin", "--show-scope", "--name-only", "get", "list"}
# Values an EDITOR/PAGER may take without judging anything.
HARMLESS_EXEC_VALUES = {"", "cat", "less", "more", "true", ":", "head", "tail", "vi", "vim", "nano"}
GLOB_CHARS = set("*?[")
REBINDING_BUILTINS = {
    "printf", "read", "for", "select", "let", "declare", "typeset", "export", "local",
    "readonly", "unset", "mapfile", "readarray", "getopts", "eval", "set", "while",
}


class Denied(Exception):
    def __init__(self, what: str, advice: str) -> None:
        super().__init__(what)
        self.what = what
        self.advice = advice


def deny(what: str, advice: str) -> None:
    raise Denied(what, advice)


# ---------------------------------------------------------------------------
# tokenisation
# ---------------------------------------------------------------------------


def extract_substitutions(text: str) -> tuple[str, list[str]]:
    """Replace $(...), <(...), >(...) and `...` with SUBST; return the inners.

    The inner commands are judged separately. Nesting is followed by depth.
    An unterminated substitution is left in place (the tokenizer then fails
    and the raw fallback judges the line).
    """
    out: list[str] = []
    inners: list[str] = []
    i = 0
    single = double = False
    while i < len(text):
        char = text[i]
        # Inside single quotes the shell substitutes nothing: `git commit -m
        # 'fix `rm -rf` doc'` runs no command.
        if char == "'" and not double:
            single = not single
        elif char == '"' and not single:
            double = not double
        if single:
            out.append(char)
            i += 1
            continue
        two = text[i : i + 2]
        if two in {"$(", "<(", ">("} and not text[i : i + 3] == "$((":
            depth, j = 1, i + 2
            while j < len(text) and depth:
                if text[j] == "(":
                    depth += 1
                elif text[j] == ")":
                    depth -= 1
                j += 1
            if depth:
                out.append(text[i:])
                break
            inners.append(text[i + 2 : j - 1])
            out.append(SUBST)
            i = j
            continue
        if text[i] == "`":
            end = text.find("`", i + 1)
            if end == -1:
                out.append(text[i:])
                break
            inners.append(text[i + 1 : end])
            out.append(SUBST)
            i = end + 1
            continue
        out.append(text[i])
        i += 1
    return "".join(out), inners


def tokenize(text: str) -> list[str]:
    """Shell-ish tokens with operators split out, even without spaces.

    `ls;rm -rf x` used to be read as the single word `ls;rm` (JOURNAL J-028).
    punctuation_chars makes shlex emit `;`, `&&`, `|`, `(`, `>` ... as their
    own tokens. Substitutions must have been extracted before.
    """
    lexer = shlex.shlex(text, posix=True, punctuation_chars=True)
    lexer.whitespace_split = True
    lexer.commenters = ""
    tokens: list[str] = []
    for token in lexer:
        tokens.extend(split_punctuation(token))
    return tokens


# Longest first: shlex returns a run of punctuation such as `)&&` or `;(` as a
# single token, which would glue two commands together.
_PUNCT_OPS = (
    "&>>", "<<<", "<<-", "&&", "||", "|&", ";;", ">>", "&>", ">&", ">|", "<<", "<>",
    ";", "|", "&", "(", ")", "<", ">",
)


def split_punctuation(token: str) -> list[str]:
    if not token or any(c not in "();<>|&" for c in token):
        return [token]
    parts: list[str] = []
    rest = token
    while rest:
        for op in _PUNCT_OPS:
            if rest.startswith(op):
                parts.append(op)
                rest = rest[len(op) :]
                break
        else:
            return [token]
    return parts


def split_commands(tokens: list[str]) -> list[tuple[list[str], str]]:
    """Commands with the operator that precedes each one ('' at the start)."""
    commands: list[tuple[list[str], str]] = [([], "")]
    for token in tokens:
        if token in OPERATORS:
            commands.append(([], token))
        else:
            commands[-1][0].append(token)
    return [c for c in commands if c[0]]


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
    """Long options, with unambiguous prefixes expanded to the full option."""
    flags: set[str] = set()
    for arg in args:
        if not arg.startswith("--") or arg == "--":
            continue
        name = arg.split("=", 1)[0]
        flags.add(name)
        if len(name) >= 5:
            flags.update(full for full in CANONICAL_LONG if full.startswith(name))
    return flags


def positional(args: list[str]) -> list[str]:
    return [a for a in args if not a.startswith("-")]


# Options whose value is read, never rewritten (--config, --ignore-path...).
REWRITER_VALUE_OPTIONS = {"--config", "-c", "--ignore-path", "--rulesdir", "--plugin", "--ext",
                          "--resolve-plugins-relative-to", "--cache-location", "--parser",
                          "--loglevel", "--log-level"}


def rewrite_targets(args: list[str]) -> list[str]:
    targets, skip = [], False
    for arg in args:
        if skip:
            skip = False
        elif arg in REWRITER_VALUE_OPTIONS:
            skip = True
        elif not arg.startswith("-"):
            targets.append(arg)
    return targets


def option_value(args: list[str], *names: str) -> str | None:
    """Value of `-o X`, `-oX`, `--output X` or `--output=X`."""
    for i, arg in enumerate(args):
        for name in names:
            if arg == name and i + 1 < len(args):
                return args[i + 1]
            if name.startswith("--") and arg.startswith(name + "="):
                return arg.split("=", 1)[1]
            if not name.startswith("--") and arg.startswith(name) and len(arg) > len(name):
                return arg[len(name) :]
    return None


# ---------------------------------------------------------------------------
# the checker
# ---------------------------------------------------------------------------


class Guard:
    def __init__(self, cwd: str) -> None:
        self.root = harness_paths.repo_root(cwd)
        self.cwd: str | None = os.path.realpath(cwd) if os.path.isdir(cwd) else self.root
        self.patterns = harness_paths.load_patterns(
            os.path.join(self.root, "scripts", "harness-protected.txt")
        )
        self.protect = not harness_paths.unlocked()
        self.depth = 0

    # -- helpers -----------------------------------------------------------

    def _expand(self, word: str) -> str:
        """Expand the few variables whose value the guard knows."""
        home = os.path.expanduser("~")
        values = {"HOME": home, "TMPDIR": os.environ.get("TMPDIR", "/tmp")}
        if self.cwd is not None:
            values["PWD"] = self.cwd
        for key, value in values.items():
            word = word.replace("${" + key + "}", value).replace("$" + key, value)
        if word == "~" or word.startswith("~/"):
            word = home + word[1:]
        return word

    def protected(self, word: str) -> bool:
        """True when writing to `word` must be refused (harness file or unjudgeable)."""
        if not self.protect or not word:
            return False
        value = word.split("=", 1)[1] if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", word) else word
        value = self._expand(value)
        if "$" in value or SUBST in value:
            return True  # the real target is only known at run time
        if self.cwd is None and not os.path.isabs(value):
            return True  # after `cd $(...)`: relative to an unknown directory
        cwd = self.cwd or self.root
        for candidate in (value, value.split("=", 1)[-1]):
            if candidate and harness_paths.is_protected(candidate, self.root, cwd, self.patterns):
                return True
            # package.json carries harness keys (scripts, lint-staged): the shell may
            # not rewrite it wholesale. npm and the Edit tool still can (J-042).
            if candidate and harness_paths.to_rel(candidate, self.root, cwd) == "package.json":
                return True
        return False

    def _existing(self, words: list[str]) -> list[str]:
        """Only the words that ARE files or directories on disk.

        Under the zone model any non-product path is harness, so a word that is
        not a path at all (a branch name, a sed script) must not be judged as one.
        """
        out = []
        for word in words:
            path = self._resolve(word)
            if path is not None and os.path.lexists(path):
                out.append(word)
        return out

    def _resolve(self, word: str) -> str | None:
        value = self._expand(word)
        if "$" in value or SUBST in value or (self.cwd is None and not os.path.isabs(value)):
            return None
        return os.path.normpath(value if os.path.isabs(value) else os.path.join(self.cwd or self.root, value))

    def _inside_repo(self, path: str | None) -> bool:
        if path is None:
            return True  # unknown: assume the worst
        rel = os.path.relpath(os.path.realpath(path), self.root)
        return rel == "." or not rel.startswith("..")

    def _has_tracked_files(self, path: str | None) -> bool:
        if path is None:
            return True
        if not os.path.isdir(path) or not self._inside_repo(path):
            return False
        try:
            out = subprocess.run(
                ["git", "-C", self.root, "ls-files", "--", os.path.relpath(os.path.realpath(path), self.root)],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return bool(out.stdout.strip())
        except Exception:
            return True

    def deny_tamper(self, how: str) -> None:
        deny(
            f"write to a harness file, or to a target that cannot be judged ({how})",
            "The harness (hooks, sensors, lint/test/arch config, CI, git hooks) is out of the "
            "agent's reach: a sensor the agent can rewrite is not a sensor (JOURNAL J-029). "
            "If the target is not a harness file, write its path out literally (no $VAR, no "
            "$(...)) or use the Edit tool. Otherwise describe the change you need to Cedric; he "
            "applies it from a session launched with MIVRO_HARNESS_UNLOCK=1, then refreshes the "
            "lock with `npm run harness:relock`.",
        )

    def _check_native(self, words: list[str]) -> None:
        for word in words:
            if NATIVE_ARTEFACT_RE.search(word):
                deny(
                    "command touching ios/Pods or android/**/build",
                    "Native artefacts are Cedric's territory: a bad 'pod install' or gradle "
                    "clean costs a long rebuild. Ask him to run it (see docs/context/RUNBOOK.md).",
                )

    # -- entry points --------------------------------------------------------

    def check_text(self, text: str) -> None:
        """Judge a full (possibly multi-line) command string."""
        self.depth += 1
        if self.depth > 8:
            deny("command nesting too deep to judge", "Flatten the command.")
        try:
            self._check_lines(text)
        finally:
            self.depth -= 1

    def _check_lines(self, text: str) -> None:
        # One segment per line: shlex treats a newline as whitespace, so a
        # destructive command on a later line would otherwise be read as a mere
        # argument (JOURNAL J-018). Two exceptions:
        #   - a line with an unclosed quote continues on the next lines (inline
        #     code or a commit message spread over several lines, J-038);
        #   - a heredoc body is tracked: fed to a shell it is judged as
        #     commands, fed to an interpreter as inline code, fed to anything
        #     else (cat > file) it is data.
        lines = text.splitlines()
        index = 0
        while index < len(lines):
            line = lines[index].strip()
            index += 1
            if not line:
                continue
            heredoc = HEREDOC_RE.search(line) if "<<<" not in line else None
            body: list[str] = []
            if heredoc:
                delimiter = heredoc.group(2)
                while index < len(lines) and lines[index].strip() != delimiter:
                    body.append(lines[index])
                    index += 1
                index += 1  # the delimiter line itself
                self._check_line(line, body, expands=not heredoc.group(1))
                continue
            if not self._tokenizes(line):
                joined, end = line, index
                while end < len(lines) and not self._tokenizes(joined):
                    joined += "\n" + lines[end]
                    end += 1
                if self._tokenizes(joined):
                    self._check_line(joined, [])
                    index = end
                    continue
            self._check_line(line, [])

    @staticmethod
    def _tokenizes(text: str) -> bool:
        try:
            tokenize(text)
            return True
        except ValueError:
            return False

    def _check_line(self, line: str, heredoc_body: list[str], expands: bool = False) -> None:
        # $(...) and backticks run before the command: judge them first, and
        # leave a placeholder whose value (unknown) marks the spot.
        line, inners = extract_substitutions(line)
        for inner in inners:
            self.check_text(inner)
        try:
            tokens = tokenize(line)
        except ValueError:
            self._raw_fallback(line)
            return
        consumer = ""
        for words, before in split_commands(tokens):
            name = self._check_command(words, piped=before in {"|", "|&"})
            if name:
                consumer = name
        if heredoc_body:
            body = "\n".join(heredoc_body)
            if consumer in SHELLS:
                self.check_text(body)
            elif consumer in INTERPRETERS:
                self._check_inline_code(body)
            elif expands:
                # Anything else (`cat > file <<EOF`) is data — but with an
                # unquoted delimiter the shell still runs its $(...) first.
                for inner in extract_substitutions(body)[1]:
                    self.check_text(inner)
            # The redirection target was judged with the command.

    # -- per command -----------------------------------------------------------

    def _check_command(self, words: list[str], piped: bool = False) -> str:
        """Judge one simple command. Returns the resolved command name."""
        words = self._check_redirections(words)
        index = 0
        # Leading environment assignments.
        while index < len(words) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", words[index]):
            self._check_assignment(words[index])
            index += 1
        words = words[index:]
        if not words:
            return ""
        name, args = self._unwrap(words)
        if not name:
            return ""
        # `git ...` exactly as typed: the project's `ask` rules are prefix matches
        # on `git cherry-pick`, `git rebase`... (J-043).
        self._plain_git = words[0] == "git"
        # A commit message is prose: it may mention anything.
        judged = args
        if name == "git" and "commit" in args:
            judged = [a for i, a in enumerate(args) if not (i > 0 and args[i - 1] in {"-m", "--message"})]
        self._check_native([name, *judged])
        if any("gh/hosts.yml" in w for w in args):
            deny("reading the GitHub token file", "It would let a raw HTTP call bypass this guard.")
        if name.startswith("$") or SUBST in name:
            deny(
                "command name taken from a variable",
                "A command whose name is a variable ($X ...) cannot be judged. Write the "
                "command out explicitly.",
            )
        # Builtins that can rebind CLAUDECODE (`printf -v`, `read`, `for ... in`,
        # `let`, `declare +x`, a nameref...): a bare mention is refused there. Reading
        # it ($CLAUDECODE) or grepping for the word is fine.
        if name in REBINDING_BUILTINS and any(
            "CLAUDECODE" in w and "$CLAUDECODE" not in w and "${CLAUDECODE" not in w for w in args
        ):
            self._deny_context_hiding()
        if name in {"cd", "pushd"}:
            self._cd(args)
        elif name == "popd":
            self.cwd = None  # the directory stack is unknown
        elif name in {"source", "."}:
            target = args[0] if args else ""
            if not target or SUBST in target or target in {"-", "/dev/stdin"} or target.startswith("/dev/fd"):
                deny(
                    "sourcing code that cannot be judged",
                    "`source <(...)` or `. /dev/stdin` runs commands this guard never sees.",
                )
        elif name in {"export", "declare", "typeset", "local", "readonly"}:
            for arg in args:
                self._check_assignment(arg)
        elif name == "unset":
            if "CLAUDECODE" in args:
                self._deny_context_hiding()
        elif name == "rm":
            self._check_rm(args)
        elif name == "find":
            self._check_find(args)
        elif name == "git":
            self._check_git(args)
        elif name in {"npm", "yarn", "pnpm"}:
            self._check_npm(args)
        elif name == "husky":
            if positional(args)[:1] in (["uninstall"], ["init"]):
                self._deny_hook_bypass("husky uninstall")
        elif name == "gh":
            self._check_gh(args)
        elif name in {"curl", "wget"}:
            self._check_download(name, args)
        elif name in {"tar", "unzip", "bsdtar", "ditto"} and self.protect:
            self._check_extract(name, args)
        elif name == "patch" and self.protect and "--dry-run" not in long_flags(args):
            self.deny_tamper("patch — its targets are only known from the diff")
        elif name == "pod" and positional(args)[:1] and positional(args)[0] in {"install", "update", "deintegrate", "repo", "cache"}:
            deny(
                f"pod {positional(args)[0]}",
                "Pods are Cedric's territory (npm run pods): a bad pod install costs a long rebuild.",
            )
        elif name == "gradlew" and ({"clean", "--stop", "cleanBuildCache"} & set(args)):
            deny("gradlew clean", "Gradle caches are Cedric's territory (npm run android-clean).")
        elif name == "rsync" and any(a.startswith("--delete") for a in args):
            deny("rsync --delete", "It deletes whatever the destination has and the source lacks.")
        elif name in {"rimraf", "del", "del-cli", "trash", "rmtrash", "shx"}:
            targets = positional(args)[1:] if name == "shx" else positional(args)
            if name != "shx" or positional(args)[:1] == ["rm"]:
                if any(self._has_tracked_files(self._resolve(t)) for t in targets):
                    deny(f"{name}: recursive delete", "Same as rm -rf. Delete precisely, or ask Cedric.")
        elif name in {"claude", "claude-code"}:
            # A nested session can load other settings (--setting-sources user:
            # no project hook at all) or other agents (--agents) (J-044).
            deny("nested Claude Code session", "A nested session escapes this project's hooks. Ask Cedric.")
        elif name == "alias" and any("=" in a for a in args):
            deny("alias definition", "An alias hides the real command from this guard. Write it out.")
        elif name in {"prettier", "eslint"}:
            rewrites = {"--write", "--fix"} & long_flags(args) or ("w" in short_flags(args) and name == "prettier")
            if rewrites and any(self.protected(a) for a in rewrite_targets(args)):
                self.deny_tamper(f"{name} rewriting a harness file")
        elif name in {"script", "expect", "unbuffer"}:
            if self.protect and any("harness-lock" in a or "harness:relock" in a for a in args):
                self._deny_relock()
        elif name in SHELLS:
            self._check_shell(args, piped)
        elif name == "eval":
            self.check_text(" ".join(args))
        elif name in INTERPRETERS:
            self._check_interpreter(name, args, piped)

        if name in {"sed", "perl", "ruby"} and ("i" in short_flags(args) or "--in-place" in long_flags(args)):
            if any(self.protected(a) for a in self._existing(positional(args))):
                self.deny_tamper(f"{name} -i")
        if name in {"awk", "gawk"} and "inplace" in " ".join(args):
            if any(self.protected(a) for a in self._existing(positional(args))):
                self.deny_tamper("awk -i inplace")
        if name in FILE_WRITERS:
            pos = positional(args)
            if name == "dd":
                targets = [a[3:] for a in args if a.startswith("of=")]
            elif name == "ln":
                # A link TO a harness file is a door to it: writes through the link
                # are judged by the link's path, before the link exists (J-042).
                targets = pos
            elif name in COPIERS:
                # A copy only writes its destination; reading a harness file is fine.
                target_dir = option_value(args, "-t", "--target-directory")
                targets = [target_dir] if target_dir else (pos[-1:] if len(pos) >= 2 else [])
            else:
                targets = pos
            if name == "rm":
                targets = [t for t in targets if not self._regenerable(t)]
            if any(self.protected(a) for a in targets):
                self.deny_tamper(name)
        if self.protect and any("harness-lock.sh" in a for a in [name, *args]) and "--update" in args:
            self._deny_relock()
        return name

    def _check_redirections(self, words: list[str]) -> list[str]:
        """Inspect and strip redirections; returns the remaining words."""
        kept: list[str] = []
        index = 0
        while index < len(words):
            word = words[index]
            if word in REDIRECTS or word in {"<", "<<", "<<-", "<<<"}:
                target = words[index + 1] if index + 1 < len(words) else ""
                # `>&2`, `2>&1`: a file descriptor, not a file.
                if word in REDIRECTS and target and not target.isdigit() and target != "-":
                    if self.protected(target):
                        self.deny_tamper(f"redirection {word}")
                    self._check_native([target])
                index += 2
                continue
            # `2` before `>` is a file descriptor, not an argument.
            if index + 1 < len(words) and words[index + 1] in REDIRECTS and word.isdigit():
                index += 1
                continue
            kept.append(word)
            index += 1
        return kept

    def _check_exec_value(self, what: str, value: str) -> None:
        """A value that will be run as a command is judged as one."""
        value = value.strip()
        if value in HARMLESS_EXEC_VALUES or value.lower() in {"false", "0", "no", "off"}:
            return
        if SUBST in value or "$" in value:
            deny(
                f"{what} set to a value that cannot be judged",
                "Its value is run as a command. Write it out literally, or leave it unset.",
            )
        self.check_text(value)

    def _check_assignment(self, word: str) -> None:
        key, _, value = word.partition("=")
        if key == "HUSKY" and value == "0":
            self._deny_hook_bypass("HUSKY=0")
        if key == "CLAUDECODE":
            self._deny_context_hiding()
        if key in EXEC_ENV_VARS:
            self._check_exec_value(key, value)
        if key.startswith("GIT_CONFIG"):
            self._deny_hook_bypass(f"{key} (injects git configuration such as core.hooksPath)")
        if self.protect and key in {"GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY"}:
            self._deny_hook_bypass(f"{key} (redirects git away from this repository's hooks)")
        # Emptying it only LOCKS (what the self-test does); setting it never unlocks
        # anything, but is refused to make the intent visible.
        if key == harness_paths.UNLOCK_ENV and value.strip("'\"") not in {"", "0"}:
            deny(
                f"setting {harness_paths.UNLOCK_ENV} from the agent",
                "The unlock is read from the environment Claude Code was launched with, not "
                "from a command. Only Cedric can grant it, from his terminal.",
            )

    def _unwrap(self, words: list[str]) -> tuple[str, list[str]]:
        """Strip prefix commands (sudo, env, xargs, timeout, npx...)."""
        index = 0
        while index < len(words):
            name = words[index].rsplit("/", 1)[-1].lstrip("\\")
            if name in WRAPPERS:
                value_opts = WRAPPER_VALUE_OPTS.get(name, set())
                rest = words[index + 1 :]
                if name == "env":
                    if ("-u" in rest or "--unset" in rest) and "CLAUDECODE" in rest:
                        self._deny_context_hiding()
                    if "i" in short_flags(rest[:1]) or "--ignore-environment" in long_flags(rest) or "-" in rest[:1]:
                        self._deny_context_hiding()
                if name == "npx":
                    # Only npx's own leading options: `npx eslint -c cfg` is eslint's -c.
                    own: list[str] = []
                    for word in rest:
                        if not word.startswith("-") and not (own and own[-1] in {"-p", "--package", "-c", "--call"}):
                            break
                        own.append(word)
                    call = option_value(own, "-c", "--call")
                    if call is not None:
                        self.check_text(call)
                        return "npx", rest
                index += 1
                while index < len(words) and (
                    words[index].startswith("-") or re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", words[index])
                ):
                    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", words[index]):
                        self._check_assignment(words[index])
                    if words[index] in value_opts:
                        index += 1
                    index += 1
                if name == "timeout" and index < len(words):
                    index += 1  # the duration
                continue
            return name, words[index + 1 :]
        return "", []

    def _cd(self, args: list[str]) -> None:
        target = positional(args)
        if not target:
            self.cwd = os.path.expanduser("~")
            return
        self.cwd = self._resolve(target[0])  # None when it cannot be known

    # -- specific commands -----------------------------------------------------

    REGENERABLE = {"coverage", "node_modules/.cache", "docs-site/build", "docs-site/.docusaurus"}

    def _regenerable(self, target: str) -> bool:
        path = self._resolve(target)
        if path is None:
            return False
        real = os.path.realpath(path)
        # Temporary directories (the session scratchpad lives there): a subtree,
        # never the temp root itself.
        for tmp in {os.path.realpath(os.environ.get("TMPDIR", "/tmp")), os.path.realpath("/tmp")}:
            if real != tmp and real.startswith(tmp.rstrip("/") + "/") and not self._inside_repo(real):
                return True
        rel = os.path.relpath(real, self.root)
        inside = any(rel == d or rel.startswith(d + "/") for d in self.REGENERABLE)
        return inside and not self._has_tracked_files(path)

    def _check_rm(self, args: list[str]) -> None:
        shorts, longs = short_flags(args), long_flags(args)
        recursive = bool({"r", "R"} & shorts) or "--recursive" in longs
        force = "f" in shorts or "--force" in longs
        targets = positional(args)
        # Generated, git-ignored directories that tools recreate: clearing them is
        # routine (`rm -rf coverage`), not destruction.
        if recursive and targets and all(self._regenerable(t) for t in targets):
            return
        if recursive and force:
            deny(
                "recursive force delete (rm -rf)",
                "Delete precisely instead: 'rm <file>', or run 'git clean -n' first to see "
                "what would go. If a whole tree really must go, run it yourself.",
            )
        if recursive:
            for target in positional(args):
                if self._has_tracked_files(self._resolve(target)):
                    deny(
                        "recursive delete of a directory that holds tracked files",
                        "Uncommitted changes and untracked files in it would be lost. Remove "
                        "files one by one, or 'git rm -r' after committing, or ask Cedric.",
                    )

    def _check_find(self, args: list[str]) -> None:
        if "-delete" in args:
            deny("find -delete", "List first (find ... -print), then delete precisely.")
        for flag in ("-exec", "-execdir", "-ok", "-okdir"):
            if flag in args:
                start = args.index(flag) + 1
                inner: list[str] = []
                for word in args[start:]:
                    if word in {";", "\\;", "+"}:
                        break
                    inner.append(word)
                if inner and inner[0].rsplit("/", 1)[-1] in {"rm", "shred", "unlink"}:
                    deny("find -exec rm", "List first (find ... -print), then delete precisely.")
                if inner:
                    self._check_command(inner)

    # git global options that consume the next argument, e.g. `git -C <dir> reset`.
    GIT_VALUE_OPTS = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}

    def _check_git(self, args: list[str]) -> None:
        index = 0
        while index < len(args):
            arg = args[index]
            if arg == "-c" and index + 1 < len(args):
                key, _, value = args[index + 1].partition("=")
                self._check_git_config_key(key, value)
            if arg.startswith("--config-env"):
                # `--config-env=core.hooksPath=VAR` reads the value from the environment.
                self._deny_hook_bypass("git --config-env (configuration read from a variable)")
            if self.protect and (arg.startswith("--git-dir") or arg.startswith("--work-tree")):
                self._deny_hook_bypass(f"git {arg.split('=')[0]} (points git at other hooks)")
            if arg in self.GIT_VALUE_OPTS:
                index += 2
                continue
            if arg.startswith("-"):
                index += 1
                continue
            break
        sub = args[index] if index < len(args) else ""
        rest = args[index + 1 :]
        shorts, longs = short_flags(rest), long_flags(rest)
        pos = positional(rest)

        # These write history WITHOUT running any hook; their only gate is the
        # confirmation the `ask` rules ask for — which only `git <verb> ...` matches.
        # `git -C . cherry-pick`, `/usr/bin/git revert`, `command git rebase` slipped
        # past it (J-043).
        # Nested in `sh -c` / a heredoc fed to a shell counts too (self.depth > 1):
        # the `ask` rule only sees the outer command (J-044). commit and push join
        # the list: their confirmation is Cedric's "no commit without asking" rule.
        if sub in {"cherry-pick", "revert", "rebase", "am", "merge", "commit", "push"} and (
            index > 0 or not getattr(self, "_plain_git", True) or self.depth > 1
        ):
            deny(
                f"git {sub} behind global options, a path or a nested shell",
                f"Write it as a plain top-level `git {sub} ...`, so that Cedric's confirmation applies.",
            )

        if sub == "push":
            if any(f.startswith("--force") for f in longs) or "f" in shorts:
                deny(
                    "forced push (git push --force / -f / --force-with-lease)",
                    "A forced push rewrites shared history. Push a normal commit, or a new "
                    "branch. If history truly must be rewritten, do it yourself.",
                )
            if "--delete" in longs or "d" in shorts or "--mirror" in longs or "--prune" in longs:
                deny("remote ref deletion (git push --delete / --mirror / --prune)", "Ask Cedric.")
            if any(p.startswith("+") or p.startswith(":") for p in pos[1:]):
                deny(
                    "forced or deleting refspec (+ref / :ref)",
                    "A '+' refspec forces the update and ':ref' deletes the remote branch.",
                )
            if "--no-verify" in longs:
                self._deny_hook_bypass("git push --no-verify")
        elif sub == "commit":
            # A message value (-m "- note") must not be read as flags.
            flags_only = [
                a for i, a in enumerate(rest) if not (i > 0 and rest[i - 1] in {"-m", "-F", "-C", "-c", "-t"})
            ]
            if "--no-verify" in long_flags(flags_only) or "n" in short_flags(flags_only):
                self._deny_hook_bypass("git commit --no-verify / -n")
        elif sub in {"commit-tree", "update-ref"}:
            deny(
                f"git {sub}",
                "Plumbing that creates commits or moves refs skips the git hooks, and with them "
                "the reviewer gate. Commit with `git commit`.",
            )
        elif sub in {"merge", "rebase", "cherry-pick", "revert", "am"}:
            if "--no-verify" in longs:
                self._deny_hook_bypass(f"git {sub} --no-verify")
            # These create commits WITHOUT the pre-commit hook: `git stash` then
            # `git cherry-pick stash@{0}` committed unreviewed work (JOURNAL J-042).
            if any("stash" in p for p in pos):
                self._deny_hook_bypass(f"git {sub} of a stash (a commit without the pre-commit hook)")
            # `rebase -x <cmd>` runs <cmd> after each commit (for cherry-pick, -x is a flag).
            exec_cmd = option_value(rest, "-x", "--exec") if sub == "rebase" else None
            if exec_cmd is not None:
                self.check_text(exec_cmd)
            if sub == "am" and self.protect:
                self.deny_tamper("git am — its targets are only known from the patch")
        elif sub == "apply":
            if self.protect and not ({"--check", "--stat", "--numstat", "--summary"} & set(rest)):
                self.deny_tamper("git apply — its targets are only known from the patch")
        elif sub == "reset":
            if "--hard" in longs:
                deny(
                    "git reset --hard",
                    "This throws away uncommitted work irreversibly. Use 'git stash', or "
                    "'git restore <file>' to revert precisely.",
                )
            reset_paths = rest[rest.index("--") + 1 :] if "--" in rest else self._existing(pos)
            if any(self.protected(p) for p in reset_paths):
                self.deny_tamper("git reset <harness file>")
        elif sub == "clean":
            if "f" in shorts or "--force" in longs:
                deny("git clean -f", "Run 'git clean -n' to see what would go, then delete precisely.")
        elif sub == "switch":
            if "f" in shorts or "--force" in longs or "--discard-changes" in long_flags(rest):
                deny(
                    "git switch --force / --discard-changes",
                    "This discards every uncommitted change. 'git stash' first.",
                )
        elif sub == "read-tree":
            if "u" in shorts or "--reset" in longs or "--reset" in rest:
                deny("git read-tree -u / --reset", "It overwrites the working tree. 'git stash' first.")
        elif sub == "bisect":
            if "run" in rest:
                self._check_command(rest[rest.index("run") + 1 :])
        elif sub in {"fast-import", "mktag"} or (
            sub == "hash-object" and option_value(rest, "-t") in {"commit", "tag"} and "-w" in rest
        ):
            deny(
                f"git {sub}",
                "Writing commit objects by hand creates history without the git hooks. Commit with `git commit`.",
            )
        elif sub == "submodule":
            if pos[:1] == ["foreach"]:
                self.check_text(" ".join(pos[1:]))
        elif sub in {"checkout", "restore"}:
            raw_paths = rest[rest.index("--") + 1 :] if "--" in rest else pos
            # Without `--`, only words that exist are file paths (`git checkout develop`
            # names a branch) — but a pathspec pattern is judged as typed.
            paths = rest[rest.index("--") + 1 :] if "--" in rest else self._existing(pos)
            # A glob pathspec ('*.ts', 'src/*', ':(glob)...') discards many files at once.
            whole_tree = any(
                p in {".", ":/", ":(top)"} or p.startswith(":(") or bool(GLOB_CHARS & set(p)) for p in raw_paths
            ) or (sub == "checkout" and ("f" in shorts or "--force" in longs))
            staged_only = sub == "restore" and (
                ("--staged" in longs or "S" in shorts) and "--worktree" not in longs and "W" not in shorts
            )
            # `git checkout src/` discards the directory's changes even without
            # `--` when no branch has that name, so any existing directory counts.
            directory = any(os.path.isdir(self._resolve(p) or "/") for p in paths if p not in {"/"})
            if (whole_tree or directory) and not staged_only:
                deny(
                    f"git {sub} of the whole tree or of a directory",
                    "This discards every uncommitted change below it. Restore files one by one, "
                    "or 'git stash' to keep them.",
                )
            if any(self.protected(p) for p in paths):
                self.deny_tamper(f"git {sub} <harness file>")
        elif sub in {"rm", "mv"}:
            if sub == "rm" and {"r", "f"} <= shorts:
                deny("git rm -rf", "Remove files precisely.")
            if any(self.protected(p) for p in pos):
                self.deny_tamper(f"git {sub} <harness file>")
        elif sub == "stash":
            if pos and pos[0] in {"drop", "clear"}:
                deny(f"git stash {pos[0]}", "A dropped stash is gone. Leave it, or ask Cedric.")
            if "--" in rest and any(self.protected(p) for p in rest[rest.index("--") + 1 :]):
                self.deny_tamper("git stash of harness files")
        elif sub == "branch":
            if "D" in shorts or (("d" in shorts or "--delete" in longs) and ("f" in shorts or "--force" in longs)):
                deny("git branch -D", "Force-deleting a branch loses unmerged commits. Ask Cedric.")
        elif sub in {"filter-branch", "filter-repo", "replace"}:
            deny(f"git {sub}", "History rewriting is Cedric's call.")
        elif sub == "reflog":
            if pos and pos[0] in {"expire", "delete"}:
                deny(f"git reflog {pos[0]}", "The reflog is the last safety net. Leave it.")
        elif sub == "gc":
            if any(a.startswith("--prune") for a in rest):
                deny("git gc --prune", "Pruning drops unreachable commits for good.")
        elif sub == "config":
            reads = GIT_CONFIG_READS & set(rest)
            if not reads:
                if self.protect:
                    deny(
                        "git configuration change",
                        ".git/config holds core.hooksPath and every key git runs as a command; "
                        "`git config --remove-section core` silently switched the hooks off "
                        "(JOURNAL J-042). Reading is fine (--get, --list). Ask Cedric for a change.",
                    )
                if pos:
                    self._check_git_config_key(pos[0], pos[1] if len(pos) > 1 else None)
        elif sub == "worktree":
            if pos and pos[0] == "remove" and ("f" in shorts or "--force" in longs):
                deny("git worktree remove --force", "It discards the worktree's uncommitted work.")
            if self.protect and pos[:1] == ["add"]:
                # A worktree created and written in the same command cannot be
                # recognised as this repository yet (J-042). Subagent worktrees are
                # created by Claude Code itself, not through this tool.
                deny(
                    "git worktree add from the shell",
                    "Use a subagent with `isolation: worktree`, or ask Cedric to create it.",
                )

    def _check_git_config_key(self, key: str, value: str | None = None) -> None:
        key = key.lower()
        if key == "core.hookspath" or key.startswith("alias.") or key.startswith("include"):
            self._deny_hook_bypass(f"git config {key}")
        if key == "clean.requireforce":
            deny("git clean.requireForce override", "It turns `git clean` into a silent delete.")
        if key in EXEC_GIT_KEYS or key.endswith(EXEC_GIT_KEY_SUFFIXES):
            if value is None:
                deny(
                    f"git configuration key that runs a command ({key})",
                    "Its value is executed by git. Ask Cedric if it truly must change.",
                )
            self._check_exec_value(f"git {key}", value)

    def _check_npm(self, args: list[str]) -> None:
        # `npm --prefix . run clear`: skip option values.
        cleaned: list[str] = []
        skip = False
        for arg in args:
            if skip:
                skip = False
                continue
            if arg in {"--prefix", "-C", "--workspace", "-w"}:
                skip = True
                continue
            if not arg.startswith("-"):
                cleaned.append(arg)
        pos = cleaned
        if len(pos) >= 2 and pos[0] in {"run", "run-script", "rum", "urn"}:
            script = pos[1]
        elif pos and pos[0] in DESTRUCTIVE_NPM_SCRIPTS:
            script = pos[0]  # yarn <script>
        else:
            script = ""
        if script in DESTRUCTIVE_NPM_SCRIPTS:
            deny(
                f"destructive npm script ({script})",
                "These wipe Pods, gradle caches or node_modules. Ask Cedric to run it "
                "in his terminal.",
            )
        if self.protect and script in PROTECTED_NPM_SCRIPTS:
            self._deny_relock()
        if pos[:1] == ["exec"] or pos[:1] == ["x"]:
            self._check_command(pos[1:])
        # package.json is harness as a whole (J-045): any `npm pkg set/delete`.
        if len(pos) >= 2 and pos[0] == "pkg" and pos[1] in {"set", "delete", "fix"} and self.protect:
            self.deny_tamper(f"npm pkg {pos[1]}")

    def _check_gh(self, args: list[str]) -> None:
        pos = positional(args)
        if not pos:
            return
        group = pos[0]
        action = pos[1] if len(pos) > 1 else ""
        longs = long_flags(args)
        if group == "api":
            method = (option_value(args, "-X", "--method") or "").upper()
            writes_fields = bool({"-f", "-F", "--field", "--raw-field", "--input"} & set(args)) or any(
                a.startswith(("--field=", "--raw-field=", "--input=")) for a in args
            )
            if (method and method != "GET") or (writes_fields and method != "GET"):
                deny(
                    "GitHub API write (gh api -X/-f)",
                    "Repository settings, branch protection and rulesets are the backstop of "
                    "this harness: they are Cedric's to change. Read-only gh api calls are fine.",
                )
        elif group == "pr" and action == "merge":
            if "--admin" in longs:
                deny("gh pr merge --admin", "Bypassing branch protection is Cedric's call.")
        elif group == "pr" and action == "edit" and ({"--add-label", "--remove-label"} & longs):
            deny("PR label change", "The harness-change label is a human approval. Ask Cedric.")
        elif group == "pr" and action == "edit" and ("--base" in longs or "B" in short_flags(args)):
            # harness-guard runs the BASE branch's workflow: retargeting a PR onto a
            # branch the agent pushed would let that branch's copy judge it (J-042).
            deny("PR base change", "Retargeting a PR changes which harness judges it. Ask Cedric.")
        elif group in {"label", "secret", "variable", "ruleset", "workflow", "cache"} and action not in {
            "list",
            "view",
            "",
        }:
            deny(f"gh {group} {action}", "CI configuration and approvals are Cedric's to change.")
        elif group == "repo" and action in {"delete", "edit", "archive", "rename"}:
            deny(f"gh repo {action}", "Repository settings are Cedric's to change.")
        elif group == "auth" and action == "token":
            deny("gh auth token", "Exporting the token would let a raw HTTP call bypass this guard.")

    def _check_download(self, name: str, args: list[str]) -> None:
        joined = " ".join(args)
        if name == "curl":
            method = (option_value(args, "-X", "--request") or "").upper()
            data = bool({"-d", "--data", "--data-raw", "--data-binary", "-F", "--form", "-T"} & set(args))
            writes = (method and method not in {"GET", "HEAD"}) or data
            # An unjudgeable URL ($URL) may well be the GitHub API.
            unknown_url = any("$" in a or SUBST in a for a in positional(args))
            if writes and ("api.github.com" in joined or unknown_url):
                deny("GitHub API write through curl", "Repository settings are Cedric's to change.")
        if not self.protect:
            return
        if name == "curl":
            target = option_value(args, "-o", "--output")
            remote_name = "O" in short_flags(args) or "--remote-name" in long_flags(args)
        else:
            target = option_value(args, "-O", "--output-document")
            remote_name = target is None and "-" not in args
            prefix = option_value(args, "-P", "--directory-prefix")
            if remote_name and prefix is not None:
                if self._inside_repo(self._resolve(prefix)):
                    self.deny_tamper(f"{name} -P into the repository")
                return
        if target is not None and target != "-" and self.protected(target):
            self.deny_tamper(f"{name} -o")
        if remote_name:
            for url in positional(args):
                if "://" in url:
                    base = url.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
                    if base and self.protected(base):
                        self.deny_tamper(f"{name} -O")

    def _check_extract(self, name: str, args: list[str]) -> None:
        if name in {"tar", "bsdtar"}:
            extracting = "x" in short_flags(args[:1] + [a for a in args if a.startswith("-")]) or (
                args[:1] and not args[0].startswith("-") and "x" in args[0]
            ) or "--extract" in long_flags(args)
            if not extracting:
                return
            directory = option_value(args, "-C", "--directory")
        elif name == "unzip":
            directory = option_value(args, "-d")
        else:  # ditto: copier handled in FILE_WRITERS
            return
        where = self._resolve(directory) if directory is not None else self.cwd
        if self._inside_repo(where):
            self.deny_tamper(f"{name} extracting into the repository")

    def _check_shell(self, args: list[str], piped: bool) -> None:
        # The shell's own options stop at the first operand (the script, or -c's string).
        leading: list[str] = []
        for arg in args:
            if not arg.startswith("-"):
                break
            leading.append(arg)
        for i, arg in enumerate(leading):
            if arg == "-c" or (not arg.startswith("--") and "c" in arg[1:]):
                if i + 1 < len(args):
                    self.check_text(args[i + 1])
                return
        if (piped and len(leading) == len(args)) or "s" in short_flags(leading):
            deny(
                "shell reading its commands from stdin",
                "`... | bash` runs commands this guard never sees. Run them directly.",
            )

    def _check_interpreter(self, name: str, args: list[str], piped: bool) -> None:
        flags = INTERPRETERS[name]
        for i, arg in enumerate(args):
            if arg in flags and i + 1 < len(args):
                self._check_inline_code(args[i + 1])
                return
            for flag in flags:
                if flag.startswith("--") and arg.startswith(flag + "="):
                    self._check_inline_code(arg.split("=", 1)[1])
                    return
        if piped and (not positional(args) or positional(args)[:1] == ["-"] or "-" in args):
            deny(
                f"{name} reading its program from stdin",
                "Code piped into an interpreter is never seen by this guard. Use -c / -e, or a heredoc.",
            )

    def _check_inline_code(self, code: str) -> None:
        runs_commands = bool(EXEC_RE.search(code))
        if TREE_DELETE_RE.search(code) or (runs_commands and CMD_DELETE_RE.search(code)):
            deny(
                "inline code deleting a tree",
                "Recursive deletion from inline code is refused like rm -rf. Delete precisely, "
                "or ask Cedric.",
            )
        if runs_commands:
            for literal in re.findall(r"[\"']([^\"']+)[\"']", code):
                if " " in literal:
                    self.check_text(literal)
            # List form: ['git', 'commit', '-n'] -> "git commit -n"
            for group in re.findall(r"\[([^\]]+)\]", code):
                words = re.findall(r"[\"']([^\"']*)[\"']", group)
                if words:
                    self.check_text(" ".join(shlex.quote(w) for w in words))
        if self.protect and CODE_WRITE_RE.search(code):
            for literal in re.findall(r"[\"']([^\"'\s]+)[\"']", code):
                if "/" in literal or "." in literal:
                    if self.protected(literal) and "$" not in literal:
                        self.deny_tamper("inline interpreter code")
                # A path assembled at run time (['scripts', 'check.sh'].join('/')):
                # a bare harness directory name in writing code is enough (J-042).
                if literal in PROTECTED_SEGMENTS:
                    self.deny_tamper("inline code writing under a harness directory")

    # -- messages ---------------------------------------------------------------

    def _deny_hook_bypass(self, how: str) -> None:
        deny(
            f"bypass of the git hooks ({how})",
            "The git hooks are part of the harness. Fix what they report instead of skipping "
            "them. If a hook is wrong, say so to Cedric.",
        )

    def _deny_context_hiding(self) -> None:
        deny(
            "hiding the Claude Code context (CLAUDECODE)",
            "The pre-commit hook uses CLAUDECODE to require the reviewer's verdict on agent "
            "commits. Commit normally.",
        )

    def _deny_relock(self) -> None:
        deny(
            "refreshing the harness lock",
            "The lock records the harness Cedric approved. Only he refreshes it, from his "
            "terminal: `npm run harness:relock`.",
        )

    # -- fallback -------------------------------------------------------------------

    RAW_FALLBACK_PATTERNS = (
        (re.compile(r"(?<![\w`-])rm\s+(?:-\w*[rR]\w*f\w*|-\w*f\w*[rR]\w*)(?![\w-])"), "rm -rf"),
        (re.compile(r"(?<![\w`-])rm\s+(?:-\w+\s+)*--(?:recursive|force)(?![\w-])"), "rm --recursive/--force"),
        (re.compile(r"(?<![\w`-])git\s+(?:[^;&|\n`]*\s)?push\b[^;&|\n`]*(?:--fo|\s-f(?:\s|$))"), "git push --force"),
        (re.compile(r"(?<![\w`-])git\s+(?:[^;&|\n`]*\s)?reset\b[^;&|\n`]*--har"), "git reset --hard"),
        (re.compile(r"--no-verif|HUSKY=0|core\.hooksPath|GIT_CONFIG_|commit-tree|update-ref"), "git hook bypass"),
        (
            re.compile(r"(?<![\w`-])npm\s+run(?:-script)?\s+(?:pods|ios-clean|android-clean|clear)(?![\w-])"),
            "destructive npm script",
        ),
    )

    def _raw_fallback(self, line: str) -> None:
        """Last-resort scan of a line that could not be tokenised."""
        if NATIVE_ARTEFACT_RE.search(line):
            self._check_native([line])
        for pattern, what in self.RAW_FALLBACK_PATTERNS:
            if pattern.search(line):
                deny(
                    what,
                    "This line could not be parsed into tokens (unbalanced quotes...), so it is "
                    "refused on a raw-text match. Split it so it can be judged properly — or run "
                    "that part yourself.",
                )
        if self.protect and re.search(r">|\s-i\b|\btee\b|\bmv\b|\bcp\b", line):
            for word in re.findall(r"[\w./@-]+", line):
                if ("/" in word or "." in word) and self.protected(word):
                    self.deny_tamper("unparseable line")


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    command = ((payload.get("tool_input") or {}).get("command") or "").strip()
    if not command:
        return 0

    try:
        cwd = payload.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
        Guard(cwd).check_text(command)
    except Denied as denial:
        print(f"✖ Blocked by the Mivro harness: {denial.what}", file=sys.stderr)
        print(file=sys.stderr)
        print(f"Command: {command}", file=sys.stderr)
        print(file=sys.stderr)
        print(denial.advice, file=sys.stderr)
        return 2
    except Exception as crash:  # fail closed
        print(f"✖ Mivro harness guard crashed ({type(crash).__name__}: {crash}).", file=sys.stderr)
        print("The command was refused rather than let through unjudged.", file=sys.stderr)
        print("Simplify it, or report the crash so the guard can be fixed.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
