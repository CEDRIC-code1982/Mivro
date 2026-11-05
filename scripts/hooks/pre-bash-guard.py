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

  unlocked session (lot C): the harness is the agent's to edit, except the
  modules the guards load (scripts/hooks/), which go through the Edit tool's
  simulation (J-056). Whatever the lock, these are judged: downloads (curl,
  wget), archivers (extraction into the repo, archive written), compressors,
  patch / git apply / git am, inline code that writes, and any write target
  known at run time only.

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

import importlib.util
import json
import os
import re
import shlex
import subprocess
import sys
import types


def _load_harness_paths() -> types.ModuleType:
    """Load harness_paths.py from this file's own directory, by path.

    Never by name, never through sys.path: a module, a package or an extension
    called harness_paths anywhere on the search path (a `scripts/hooks/
    harness_paths/` package, a module at the root) would replace it, and a
    directory put first on sys.path shadows the stdlib too (EN-ATTENTE §2a,
    lot B). The hook runs with -I -B -X pycache_prefix=…, so no cached
    bytecode is read either (J-052).
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "harness_paths.py")
    spec = importlib.util.spec_from_file_location("harness_paths", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


harness_paths = _load_harness_paths()

# The terminators of a `case` branch: `;;`, bash's `;&` and `;;&`, zsh's `;|`.
# Each is followed by a pattern, never by a command (third review of lot A).
CASE_ENDS = {";;", ";&", ";;&", ";|"}
OPERATORS = {";", "&&", "||", "|", "|&", "&", "(", ")", "{", "}", "!"} | CASE_ENDS
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
# Prefix commands that run the rest of the line as a command. `noglob`,
# `nocorrect` and `-` are zsh precommand modifiers, `arch` runs a command under
# another architecture on macOS (lot A).
WRAPPERS = {
    "sudo", "env", "command", "builtin", "time", "nohup", "nice", "exec", "stdbuf",
    "caffeinate", "xargs", "timeout", "npx", "noglob", "nocorrect", "-", "arch",
}
# Wrappers that keep the command in the current shell: a `cd` behind them still
# moves the shell. Behind any other wrapper it runs in a child process.
IN_SHELL_WRAPPERS = {"command", "builtin", "noglob", "nocorrect", "-", "time"}
# Wrappers whose options may consume a value.
WRAPPER_VALUE_OPTS = {
    "xargs": {"-I", "-J", "-n", "-P", "-L", "-d", "-E", "-s", "-R", "-S"},
    "timeout": {"-s", "-k", "--signal", "--kill-after"},
    # -P altpath, -L/-U user: macOS env (second review of lot A).
    "env": {"-u", "-C", "-S", "--unset", "--chdir", "-P", "-L", "-U"},
    # (ENV_VALUE_OPTS below: the same without -S, which _unwrap reads itself.)
    "nice": {"-n"},
    "stdbuf": {"-i", "-o", "-e"},
    "sudo": {"-u", "-g", "-C", "-D", "-h", "-p", "-U"},
    "npx": {"-p", "--package"},
    # `exec -a NAME cmd` used to read NAME as the command (lot A).
    "exec": {"-a"},
    "caffeinate": {"-t", "-w"},
    "arch": {"-e", "-d", "-arch"},
}
ENV_VALUE_OPTS = WRAPPER_VALUE_OPTS["env"] - {"-S"}
# Reserved words and prefixes after which the rest of the words is still a
# command: `then rm -rf x` used to be judged as a command named `then` (lot A).
# `for`, `select` and `case` are left out: their words are data, and the commands
# of their bodies start after an operator (`;`, `)`), where they are judged.
RESERVED_PREFIXES = {
    "if", "then", "else", "elif", "while", "until", "do", "fi", "done", "esac",
    "{", "}", "!", "coproc", "always", "function",
}
# A folded subshell glued to a reserved word (`then(...)`) reads `then*`; its
# content is judged by _check_glued_groups.
RESERVED_FOLDED_RE = re.compile(r"(?:if|then|else|elif|while|until|do|time|coproc)\*")
# Every word that makes the current directory hard to follow: a compound command,
# a function, a pipeline element or a background job may run a `cd` in a subshell,
# or not at all (lot A).
COMPOUND_WORDS = {
    "if", "then", "else", "elif", "fi", "while", "until", "do", "done", "for",
    "foreach", "select", "case", "esac", "function", "coproc", "repeat", "always",
}
# `!` too: `! cd /tmp x && cmd` runs cmd when the `cd` failed (review of lot A).
UNSURE_OPERATORS = {"|", "|&", "||", "&", "{", "}", "!"}
# A command name must be a plain word. The shell rewrites any other before
# running it: `rm${IFS}x` splits, `{rm,-rf,x}` expands to three words, `=rm`
# (zsh) becomes a path, `/bin/r?` a glob (lot A). Allowlist, not denylist.
# `~` only first: under EXTENDED_GLOB, `/bin/rm~x` is an exclusion glob that
# yields /bin/rm (review of lot A).
COMMAND_NAME_RE = re.compile(r"[A-Za-z0-9_./~+@%:-][A-Za-z0-9_./+@%:=,-]*")
PLAIN_NAMES = {"[", "[["}
# A leading assignment: `x=1`, `arr+=(...)` (folded to `arr+=*`), `a[1]=x`.
# Read as a command name, `arr+=*` would now be refused by COMMAND_NAME_RE.
ASSIGN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?\+?=.*")
# zsh glob qualifiers allowed in a group that opens no command: file types,
# permissions, owners by id, sizes, times, sorting, subscripts, NULL_GLOB... Every
# other character is refused, so `e` (code), `+name` (a function), `P`, `f`,
# `:` modifiers, `#q`, quotes and blanks never pass (lot A). The eleven reviews
# of lot 4 listed the forbidden forms one by one and never closed.
# A subscript `[...]` holds digits only: zsh evaluates it as arithmetic, where a
# variable name is evaluated too, its own subscripts included, `$(...)` and all
# (`x='y[$(cmd)]'; ls *([x])`, review of lot A).
QUALIFIER_LIST_RE = re.compile(r"(?:[/.@=p*%rwxAIERWXsStUGNDnMTFoOLlamcduYghkw^,0-9+-]|\[[0-9,-]*\])*")
# Arithmetic contexts take literals only, for the same reason: `$((x))`,
# `((x))`, `$[x]`, `${a[x]}`, `${s:x}`, `let x`, `[ x -eq 1 ]` (zsh), a typed
# integer evaluate the value of x as an expression, and a subscript in that
# value runs its `$(...)`. No name, no `$`, no subscript (review of lot A).
ARITH_LITERAL_RE = re.compile(r"[\s0-9+*/%<>=!&|^~?:,()-]*")
SUBSCRIPT_LITERAL_RE = re.compile(r"[\s0-9,@*+-]*")
ARITH_TEST_OPS = {"-eq", "-ne", "-lt", "-le", "-gt", "-ge"}
NUMERIC_BUILTINS = {"shift", "return", "exit", "break", "continue", "repeat"}
NAME_BUILTINS = {
    "read", "vared", "print", "printf", "unset", "getopts", "typeset", "declare",
    "local", "export", "readonly", "integer", "float", "mapfile", "readarray",
}
# Commands that write or remove the files named in their arguments.
FILE_WRITERS = {
    "cp", "mv", "rm", "ln", "install", "rsync", "truncate", "chmod", "chown",
    "touch", "unlink", "rmdir", "shred", "tee", "dd", "ditto", "ed", "ex",
    # A FIFO or device node in place of a file the guards read (a settings
    # file, a harness module) would block or fool them (EN-ATTENTE §2b).
    "mkfifo", "mknod",
    # A directory in place of a harness path shadows it: `scripts/hooks/
    # harness_paths/` would be imported before the module (lot A).
    "mkdir",
}
COPIERS = {"cp", "install", "rsync", "ln", "ditto"}
# Archivers (lot C): what they extract lands in a directory whose member names
# only the archive knows, what they create or update is a file. Both are judged,
# locked and unlocked: an archive may well carry `scripts/hooks/x.py`.
ARCHIVERS = {
    "tar", "bsdtar", "gtar", "unzip", "zip", "7z", "7za", "7zr", "7zz",
    "unar", "unrar", "jar", "ar", "cpio", "bsdcpio", "pax",
}
# Compressors (lot C): `gzip x` replaces x by x.gz, `gunzip x.gz` does the
# reverse; each operand is a file written or removed, unless the output goes to
# stdout or the run only tests or lists.
COMPRESSORS = {
    "gzip", "gunzip", "pigz", "unpigz", "bzip2", "bunzip2", "pbzip2", "lbzip2",
    "xz", "unxz", "lzma", "unlzma", "lzip", "plzip", "compress", "uncompress",
    "zstd", "unzstd", "pzstd", "lz4", "unlz4", "brotli", "lzop", "zopfli",
}
# Long options of a compressor that take a value which is no input file.
COMPRESSOR_LONG_VALUES = frozenset({
    "--suffix", "--blocksize", "--processes", "--threads", "--memlimit", "--quality",
    "--lgwin", "--format", "--check", "--level", "--block-size",
})
# Long options naming an output file or directory: judged as targets.
COMPRESSOR_OUTPUTS = ("--output", "--output-dir-flat", "--output-dir-mirror")
# Per tool, the one-letter options that take a value: the value is the rest of
# the group or the next word (`gzip -S.ct x`: `.ct` is a suffix, not -c -t).
# Per tool, never shared: `-q` is quiet for gzip, a value for brotli, and a
# flag read as a value letter would swallow the operand after it. `o` (and
# lzop's `p`, a directory) name outputs, judged as targets.
COMPRESSOR_VALUE_LETTERS = {
    "gzip": "S", "gunzip": "S", "pigz": "Sbp", "unpigz": "Sbp",
    "xz": "SCFTM", "unxz": "SCFTM", "lzma": "SCFTM", "unlzma": "SCFTM",
    "lzip": "bmnSs", "plzip": "bmnSs", "compress": "b", "uncompress": "b",
    "zstd": "oDTM", "unzstd": "oDTM", "pzstd": "oDTMp", "brotli": "oqwS", "lzop": "oSp",
}
# Environment variables that hand options or a configuration file to those
# tools (review of lot C): `UNZIP=-d<dir> unzip a.zip`, `WGETRC=<file> wget`.
OPTION_ENV_VARS = {
    "WGETRC", "CURL_HOME", "UNZIP", "UNZIPOPT", "ZIP", "ZIPOPT", "TAR_OPTIONS", "GZIP",
    "BZIP", "BZIP2", "XZ_OPT", "XZ_DEFAULTS", "ZSTD_CLEVEL", "LZ4", "SEVENZIP",
}
# Options that name the inputs in a file: what is written is then unknown.
COMPRESSOR_LISTS = {"--files", "--files0", "--filelist"}
# Name segments of the guards' own code: in code that writes files, either one
# is refused, locked or not (lot C). Unlocked, the rest of the harness is the
# agent's to edit; these modules are not, through Bash (J-056).
HOOKS_SEGMENTS = {"hooks", "harness_paths", "harness_paths.py"}
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
# One level of nested parentheses is followed: `open(os.path.join('scripts',
# 'check.sh'), 'w')` used to end the match at join's `)` (lot C). The first
# form stays: it alone sees `open(*("x", "w"))`. The third takes a write mode
# anywhere after an `open(` on the same line, whatever the nesting
# (`open(os.path.join(os.getcwd(), ...), 'w')`, review of lot C). Accepted
# false positive: a later `, 'a'`-like literal in reading code.
# A write mode holds w, a, x or "+": `'r+'` rewrites in place, and passed even
# a locked session (`open('scripts/check.sh','r+')`, lot E). Perl writes with
# a '>', '>>' or '+<' mode, Ruby with File.write / IO.write, Python with
# fileinput's inplace=True (lot E, EN-ATTENTE §6).
WRITE_MODE = r"['\"][rbtU]*(?:[wax]|\+)[rbt+]*['\"]"
CODE_WRITE_RE = re.compile(
    r"open\s*\([^)]*" + WRITE_MODE
    + r"|open\s*\((?:[^()]|\([^()]*\))*" + WRITE_MODE
    + r"|open\s*\(.*?,\s*(?:mode\s*=\s*)?" + WRITE_MODE
    + r"|\bopen\b[^;\n]*?['\"](?:\+?>|\+<)"
    # With or without parentheses (Perl `open my $f, '>', ...`, Ruby
    # `File.open 'x', 'w' do`), and File.new / io.FileIO (review of lot E).
    + r"|\b(?:open|new|FileIO)\b\s*\(?[^;\n]*?,\s*(?:mode\s*=\s*)?" + WRITE_MODE
    + r"|\b(?:File|IO)\.(?:write|binwrite)\b|\binplace\s*=\s*(?:True|1)\b"
    + r"|\bos\.open\b|\bos\.write\b|write_text|write_bytes|writeFile|appendFile"
    r"|createWriteStream|os\.rename|os\.replace|os\.remove|os\.unlink|unlink|shutil|truncate"
    r"|chmod|symlink|copyFile|\bfs\.(?:rm|cp|copy|mv|rename|write|append|truncate)"
)
# Canonical long options git (and others) accept by unambiguous prefix.
CANONICAL_LONG = (
    "--no-verify", "--hard", "--force", "--force-with-lease", "--delete", "--mirror",
    "--prune", "--recursive", "--ignore-environment", "--in-place", "--output", "--write",
    "--fix", "--staged", "--worktree", "--admin", "--show-token",
)

# ios/Pods, android/build, android/app/build, android/app/.cxx ... but NOT
# android/app/build.gradle, a versioned source file (JOURNAL J-024).
NATIVE_ARTEFACT_RE = re.compile(
    r"(?<![\w./-])(?:\./)?(?:ios/Pods|android/(?:[^\s;&|'\"]*/)?(?:build|\.cxx))(?=/|$|[\s;&|'\")`*])"
)

# What may follow `<<` (or `<<-`): a plain word, the same word fully quoted, or
# `\word`, then a blank, an operator or the end of the line. Any other form
# (`<<E'OF'`, `<<EO\F`, `<<"EOF"x`, `<<$X`) makes the shell end the body on a
# line this guard would not expect, so it is refused (third review of lot A).
HEREDOC_DELIM_RE = re.compile(
    r"(?P<dash>-?)[ \t]*(?:(?P<q>['\"])(?P<quoted>[A-Za-z_][A-Za-z0-9_]*)(?P=q)"
    r"|\\(?P<escaped>[A-Za-z_][A-Za-z0-9_]*)|(?P<plain>[A-Za-z_][A-Za-z0-9_]*))"
    r"(?=[ \t\n;&|<>()]|$)"
)
# Line ends and blanks the shell does not know. Python's splitlines() and
# strip() cut on them, bash and zsh do not (fifth review of lot A: `EOF\r`,
# `EOF\f` and `EOF ` ended a heredoc body for the guard only). Among the
# control characters, only `\n` and `\t` are allowed.
CONTROL_RE = re.compile("[\x00-\x08\x0b-\x1f\x7f\x85  ]")
# A line whose last operator asks for more: the pipeline or and-or list goes on
# on the next non-blank line (fourth review of lot A: `printf '…' |` ⏎ `sh`
# ran a shell on stdin that the guard read as a lone `sh`).
CONTINUATION_RE = re.compile(r"(?:\|\|?|&&|\|&)\s*$")
# `$'` up to the next `'`, holding a backslash (see deny_ansi_c_escapes).
ANSI_C_ESCAPE_RE = re.compile(r"\$'[^']*\\")
# A line that opens a `case` and ends on its `in`: the next line starts with a
# pattern. Matched on the quote-masked line, so `'case' x in` does not count.
CASE_OPEN_RE = re.compile(r"(?:^|[;&|({!]|\b(?:if|then|else|elif|while|until|do|time)\s)\s*case\s.*\sin$")
# A case pattern word: plain characters and glob characters only. No `{`, `$`,
# quote or backslash, which a command reading would expand into another command.
CASE_PATTERN_RE = re.compile(r"[A-Za-z0-9_./~+@%:=,*?!\[\]-]+")

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
# Marker for a copy whose landing cannot be judged (see Guard._dropped_into_dirs).
UNKNOWN_LANDING = "UNKNOWN_COPY_LANDING"
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


def deny_code_qualifier(content: str) -> None:
    """Refuse a group that may carry a zsh qualifier running code.

    `*(e:'cmd':)` runs `cmd` for each match and `*(+func)` calls a function. That
    code cannot be told apart from plain qualifier letters, so any `e` followed by
    a delimiter, or `+` followed by a name, is refused (seventh review of lot 4).
    The price is a rare false positive on a subshell such as `then(npm test --
    src/theme/)`.
    """
    if re.search(r"e[^\w\s]|\+[^\d\s]", content):
        deny(
            "zsh glob qualifier that may run code",
            "`*(e:'cmd':)` and `*(+func)` run shell code for each match. Drop the "
            "qualifier, or filter the matches in a separate, explicit command.",
        )


def deny_unlisted_qualifier(content: str) -> None:
    """Refuse a group that opens no command unless it is a plain qualifier list.

    zsh reads such a group as glob qualifiers unless it holds an unquoted `|` at
    its top level (an alternation, `(a|b)`): only then is the older heuristic
    applied, as a second net. Otherwise the content must match QUALIFIER_LIST_RE,
    with `+` only before a digit (`Lk+3`). The price: a group of words outside
    command position (`then(npm test)`, `ls (a b)`) is refused.
    """
    if _top_level_bar(content):
        deny_code_qualifier(content)
        return
    if not QUALIFIER_LIST_RE.fullmatch(content) or re.search(r"\+(?!\d)", content):
        deny(
            "group that zsh may read as glob qualifiers, outside the allowed list",
            "Outside command position, `(...)` glued to a word is a list of zsh glob "
            "qualifiers, and `e`, `+func` run code. Only plain qualifiers pass (`*(.)`, "
            "`*(N)`, `*(om[1])`, `*(Lk+3)`). Write a subshell at the start of a command, "
            "assign arrays at the start of a command, or quote the parentheses.",
        )


def _top_level_bar(content: str) -> bool:
    """True when `content` holds an unquoted `|` outside any nested group."""
    depth = 0
    quote = ""
    i = 0
    while i < len(content):
        char = content[i]
        if quote:
            if char == "\\" and quote == '"':
                i += 1
            elif char == quote:
                quote = ""
        elif char in {"'", '"'}:
            quote = char
        elif char == "\\":
            i += 1
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == "|" and depth == 0:
            return True
        i += 1
    return False


def _opens_command(text: str, start: int) -> bool:
    """True when a word starting at `start` is in command position.

    Start of the text, or right after an unescaped `;`, `&`, `|`, `(` or newline.
    """
    before = text[:start].rstrip(" \t")  # keep a newline: it starts a command
    return not before or (before[-1] in ";&|(\n" and not before[:-1].endswith("\\"))


_ARRAY_NAME_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]\s]*\])?\+?=$")


def _array_assignment(text: str, paren: int) -> bool:
    """True when the `(` at `paren` opens `name=(...)` in command position.

    There zsh and bash read an array, never qualifiers. Command position is the
    same test that lets a subshell through, so this trusts nothing new. A fake
    position (`\\;x=(...)`, `{x=(...)`, `ls x=(...)`) gets the qualifier list.
    """
    match = _ARRAY_NAME_RE.search(text[:paren])
    return bool(match) and _opens_command(text, match.start())


_RESERVED_BEFORE_RE = re.compile(r"(?:if|then|else|elif|do|while|until|time|\{|!)$")


def _after_reserved_word(text: str, paren: int) -> bool:
    """True when the `(` at `paren` follows a reserved word in command position.

    `then(echo x)` runs a subshell (seventh review of lot 4), whose content
    _check_glued_groups judges as a command. The same word as an argument
    (`echo then(...)`) is no reserved word: there the group gets the list.
    """
    before = text[:paren].rstrip(" \t")
    match = _RESERVED_BEFORE_RE.search(before)
    if not match:
        return False
    start = match.start()
    if start and not (before[start - 1].isspace() or before[start - 1] in ";&|({"):
        return False  # part of a longer word (`fi`, `echo xthen`)
    return _opens_command(text, start) or _after_reserved_word(text, start)


def deny_ansi_c_escapes(text: str) -> None:
    """Refuse `$'...'` holding a backslash (second and third reviews of lot A).

    In `$'\\''` the `\\'` is an escaped quote: the shell keeps reading, while
    every scanner of this guard closes the quote there, and the rest of the line
    (`; rm -rf x #'`) was read as quoted text. Without a backslash, `$'...'`
    reads like `'...'` and stays allowed.

    Read raw, with no quote model (third review): an apostrophe in a comment or
    a heredoc body (`git status # l'état`) opened a quote for the former
    scanner, which then took the real `$'\\''` of the next line for quoted text.
    The same raw reading covers `"...\\$'\\''..."` handed to `zsh -c`.
    False positive accepted: a single-quoted text ending in `$`, then a
    backslash before the next quote (`printf 'a$' "\\n"`). Write it with double
    quotes, or put the text in a file.
    """
    if ANSI_C_ESCAPE_RE.search(text):
        deny(
            "$'...' quoting with a backslash escape",
            "Inside $'...', \\' does not end the quote, which this guard cannot "
            "follow. Use plain quotes, or printf for special characters. A "
            "single-quoted text ending in `$` followed by a backslash reads the same: "
            "use double quotes there.",
        )


class _Frame:
    """A `(`, `$(` or backtick group opened on a line (see _scan_line)."""

    def __init__(self, kind: str, start: int, quote: str) -> None:
        self.kind = kind  # "(", "$(" or "`"
        self.start = start  # index of its first inner character
        self.quote = quote  # the quote state its closing restores
        self.close: int | None = None  # index of its closing, if on the line


def _scan_line(line: str) -> tuple[list[tuple[int, _Frame | None]], list[_Frame], str]:
    """Follow quotes and groups along a line.

    Returns every `<<` outside quotes with its innermost `$(` or backtick group
    (None outside any), the groups still open at the end, and the quote still
    open. Each group pushes the quote state its closing restores. A `)` the
    stack cannot match (a case pattern) only makes the guard see quotes where
    there are none: it misses a heredoc and judges its body as commands, the
    strict side.
    """
    stack: list[_Frame] = []
    candidates: list[tuple[int, _Frame | None]] = []
    quote = ""
    i = 0
    while i < len(line):
        char = line[i]
        if char == "\\" and quote != "'":
            i += 2
            continue
        if quote == "'":
            if char == "'":
                quote = ""
        elif char == "`" and stack and stack[-1].kind == "`":
            frame = stack.pop()
            frame.close = i
            quote = frame.quote
        elif line.startswith("$(", i) or char == "`":
            kind = "`" if char == "`" else "$("
            stack.append(_Frame(kind, i + len(kind), quote))
            quote = ""
            i += len(kind)
            continue
        elif quote:
            if char == quote:
                quote = ""
        elif char in {"'", '"'}:
            quote = char
        elif char == "(":
            stack.append(_Frame("(", i + 1, ""))
        elif char == ")" and stack and stack[-1].kind != "`":
            frame = stack.pop()
            frame.close = i
            quote = frame.quote
        elif line.startswith("<<<", i):
            i += 3
            continue
        elif line.startswith("<<", i):
            subst = next((f for f in reversed(stack) if f.kind != "("), None)
            candidates.append((i, subst))
            i += 2
            continue
        i += 1
    return candidates, stack, quote


class Heredoc:
    """A heredoc found by find_heredocs."""

    def __init__(self, delimiter: str, quoted: bool, dash: bool, at: int, head: str) -> None:
        self.delimiter = delimiter
        self.quoted = quoted  # no expansion in the body
        self.dash = dash  # `<<-`: leading tabs are stripped, the delimiter line's too
        self.at = at  # index of its `<<` in the logical line
        self.head = head  # the text whose last command reads it (Guard._heredoc_consumer)

    def ends(self, line: str) -> bool:
        """True on the line that ends the body. The shell wants that exact line
        (fourth review of lot A: ` EOF` and `EOF ` end nothing); `<<-` strips
        leading tabs only."""
        return (line.lstrip("\t") if self.dash else line) == self.delimiter


def deny_control_characters(text: str) -> None:
    """Refuse a control character other than `\\n` and `\\t`, and a Unicode line end."""
    found = CONTROL_RE.search(text)
    if found:
        deny(
            f"control character U+{ord(found.group()):04X} in the command",
            "Only newlines and tabs are accepted: other line ends (CR, form feed, "
            "U+2028...) split lines for this guard, not for the shell.",
        )


def find_heredocs(text: str) -> list[Heredoc]:
    """Every heredoc with a body in a logical line whose bodies are cut out, in order.

    The shell reads the bodies of all of them, one after the other, after the
    line that holds their `<<` (fifth review of lot A: only the first one of a
    line was followed, and none on a line that went on after a quote or a
    backslash). Each comes with the text that names its reader, the last
    command written before its `<<`: from the start of the logical line, or
    from the `$(` left open around it.

    Only a `<<` outside quotes and not escaped opens a heredoc (third review of
    lot A: `echo "<<EOF"` made the guard take the next lines for data, which the
    shell runs as commands). A `$(` or a backtick opens an unquoted context,
    even between double quotes: `git commit -m "$(cat <<'EOF'` holds a real
    heredoc. A `<<` in a `$(` or backticks closed on its own line has no body:
    the next lines run as commands (`echo $(cat <<EOF)`, checked in bash and
    zsh). A `<<` in arithmetic (`$((1<<2))`) sits in a closed `$(`: skipped
    here, but extract_substitutions hands its inner `(1<<2)` to check_text,
    which refuses that delimiter. False positive accepted: write `$((1*4))`.
    A delimiter outside HEREDOC_DELIM_RE is refused, and so is a heredoc line
    continued by a backslash: its body would start one line on.
    """
    found: list[Heredoc] = []
    candidates, _, _ = _scan_line(text)
    for at, subst in candidates:
        line_end = text.find("\n", at)
        line_end = len(text) if line_end == -1 else line_end
        if subst is not None and subst.close is not None and subst.close < line_end:
            continue
        match = HEREDOC_DELIM_RE.match(text, at + 2)
        if not match:
            deny(
                "heredoc delimiter this guard cannot follow",
                "Write the delimiter as a plain word, quoted whole or not: <<EOF, "
                "<<'EOF', <<\"EOF\", <<\\EOF. A partly quoted or escaped delimiter "
                "ends the body on a line the guard does not expect.",
            )
        if ends_with_escape(text[:line_end]):
            deny("heredoc line continued by a backslash", "Put the whole command on the line of its `<<`.")
        # The shell reads the bodies at the first newline outside quotes: a
        # quote, `$(` or backtick opened after the `<<` and left open at the end
        # of its line delays them by lines (sixth review of lot A, `cat <<EOF;
        # echo "` ⏎ `" ; rm -rf x`). Refused rather than followed. Read without
        # comments, as bash -c and zsh -c read it: `<<'EOF' # it's` is ordinary.
        # (The `<<` stands outside quotes: the rest of its line strips on its own.)
        _, groups, quote = _scan_line(text[:at] + strip_comments(text[at:line_end]))
        if quote or any(group.kind != "(" and group.start > at for group in groups):
            deny(
                "heredoc line that leaves a quote or a substitution open",
                "The shell reads the body only once that quote or substitution "
                "closes. Close it on the line of the `<<`.",
            )
        word = match.group("quoted") or match.group("escaped") or match.group("plain")
        start = subst.start if subst is not None else 0
        found.append(Heredoc(word, match.group("plain") is None, bool(match.group("dash")), at, text[start:at]))
    return found


def ends_with_escape(text: str) -> bool:
    """True when `text` ends with an odd run of backslashes: its last one escapes what follows."""
    return (len(text) - len(text.rstrip("\\"))) % 2 == 1


def line_left_open(text: str) -> bool:
    """True when a quote, a `$(` or a backtick opened in `text` is still open at its end."""
    _, stack, quote = _scan_line(text)
    return bool(quote) or any(frame.kind != "(" for frame in stack)


def strip_comments(text: str) -> str:
    """The text without its `#` comments, as a shell with comments on reads it.

    A `#` that starts a word outside quotes runs to the end of the line. Whether
    the shell honours comments depends on an option (interactive_comments), so
    check_text judges both readings (second review of lot A: `echo hi #'`, then a
    command, then `#'` hid that command from the reading without comments).
    """
    out: list[str] = []
    quote = ""
    i = 0
    while i < len(text):
        char = text[i]
        if char == "\\" and quote != "'" and i + 1 < len(text):
            out.append(text[i : i + 2])
            i += 2
            continue
        if quote:
            if char == quote:
                quote = ""
        elif char in {"'", '"'}:
            quote = char
        elif char == "#" and (i == 0 or text[i - 1].isspace() or text[i - 1] in ";&|()<>"):
            end = text.find("\n", i)
            i = end if end != -1 else len(text)
            continue
        out.append(char)
        i += 1
    return "".join(out)


def _deny_arithmetic(what: str) -> None:
    deny(
        f"name or expansion in an arithmetic context ({what})",
        "The shell evaluates a variable's value as an expression there, and a "
        "subscript inside that value runs its $(...). Use literal numbers, or compute "
        "with `expr` (`n=$(expr $n + 1)`), which evaluates nothing.",
    )


def _mask_quotes(text: str, double_too: bool) -> str:
    """Blank single-quoted text and escaped characters (double-quoted text too).

    Positions are kept, so indices found in the mask hold in the text.
    """
    out: list[str] = []
    quote = ""
    i = 0
    while i < len(text):
        char = text[i]
        if char == "\\" and quote != "'" and i + 1 < len(text):
            out.append("  ")
            i += 2
            continue
        if quote:
            if char == quote:
                quote = ""
                out.append(char)
            else:
                out.append(" " if quote == "'" or double_too else char)
        else:
            if char in {"'", '"'}:
                quote = char
            out.append(char)
        i += 1
    return "".join(out)


def _closing(text: str, start: int, opening: str, closing: str) -> int | None:
    """Index of the `closing` matching the `opening` at `start`."""
    depth = 0
    for index in range(start, len(text)):
        if text[index] == opening:
            depth += 1
        elif text[index] == closing:
            depth -= 1
            if depth == 0:
                return index
    return None


def deny_arithmetic_names(text: str) -> None:
    """Refuse an arithmetic context that holds anything but literals (lot A review).

    Expansions run inside double quotes and unquoted heredoc bodies, so `$((`,
    `$[`, subscripts and offsets are looked for there too; a bare `((` and an
    assignment subscript only outside quotes.

    Second review of lot A: listing the arithmetic contexts did not close (zsh
    flags `${(@)a[x]}`, prefixes `$#a[x]`, `${+a[x]}`, nesting `${${a}[x]}`,
    `${!x}`, `${@:x}`). So every `$` expansion is checked against an allowlist
    (EXPANSION_BODY_RE for `${...}`, plain names and specials otherwise), and
    every arithmetic context must hold literals and be closed on its line.
    """
    anywhere = _mask_quotes(text, double_too=False)
    unquoted = _mask_quotes(text, double_too=True)
    for match in re.finditer(r"\(\(", unquoted):
        if match.start() > 0 and unquoted[match.start() - 1] in "($":
            continue  # `$((` is judged below; `(((` at its own position
        end = _closing(unquoted, match.start(), "(", ")")
        if end is None or not ARITH_LITERAL_RE.fullmatch(text[match.start() + 2 : end - 1]):
            _deny_arithmetic("((...))")
    for match in re.finditer(r"(?:^|(?<=[\s;&|(]))[A-Za-z_][A-Za-z0-9_]*\[(?=[^\]]*\]\+?=)", unquoted):
        end = _closing(unquoted, match.end() - 1, "[", "]")
        if end is None or not SUBSCRIPT_LITERAL_RE.fullmatch(text[match.end() : end]):
            _deny_arithmetic("subscript")
    for match in re.finditer(r"\$", anywhere):
        _check_expansion(text, anywhere, match.start())


# The body of `${...}` allowed (second review of lot A): an optional `#`, a name,
# digits or one special parameter, a literal subscript, then one plain operation
# (default, removal, substitution, case, literal offset). Its word may hold any
# text: the `$` in it are checked at their own position.
EXPANSION_BODY_RE = re.compile(
    r"#?(?:[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[#?@*$!-])"
    r"(?:\[[\s0-9,@*+-]*\])?"
    r"(?::?[-=+?].*|#{1,2}.*|%{1,2}.*|/{1,2}.*|\^{1,2}.*|,{1,2}.*|:[\s0-9+-]*(?::[\s0-9+-]*)?)?",
    re.S,
)


def _check_expansion(text: str, mask: str, at: int) -> None:
    """Judge the expansion that the unquoted or double-quoted `$` at `at` opens."""
    nxt = mask[at + 1 : at + 2]
    if mask[at + 1 : at + 3] == "((":
        end = _closing(mask, at + 1, "(", ")")
        if end is None or not ARITH_LITERAL_RE.fullmatch(text[at + 3 : end - 1]):
            _deny_arithmetic("$((...))")
    elif nxt == "[":
        end = _closing(mask, at + 1, "[", "]")
        if end is None or not ARITH_LITERAL_RE.fullmatch(text[at + 2 : end]):
            _deny_arithmetic("$[...]")
    elif nxt == "{":
        end = _closing(mask, at + 1, "{", "}")
        if end is None or not EXPANSION_BODY_RE.fullmatch(text[at + 2 : end]):
            _deny_arithmetic("${...} outside the allowed forms (flags, nesting, indirection, offsets)")
    elif nxt and nxt in "~=^+":
        # zsh `$~x` globs the value (qualifiers run code), `$+a[x]` tests a subscript.
        _deny_arithmetic(f"${nxt}name")
    else:
        rest = mask[at + 1 :]
        word = re.match(r"[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[#?@*$!-]", rest)
        if rest[:1] == "#" and re.match(r"[A-Za-z_{(\[]", rest[1:2]):
            _deny_arithmetic("$#name")  # zsh length of a name, subscripts evaluated
        if word and rest[word.end() : word.end() + 1] == "[":
            end = _closing(mask, at + 1 + word.end(), "[", "]")
            if end is None or not SUBSCRIPT_LITERAL_RE.fullmatch(text[at + 2 + word.end() : end]):
                _deny_arithmetic("$name[...]")


def deny_argument_qualifiers(text: str) -> None:
    """Run deny_code_qualifier on every unquoted group that opens no command.

    Listing where zsh accepts qualifiers did not close: after a glob, a quote, a
    name, `=`, then after a closed group, `(a|b)(e:'cmd':)` (tenth review of lot
    4). The rule is turned around: a `(` opens a subshell only at the start of the
    text or right after an unescaped `;`, `&`, `|` or `(`. Anywhere else bash
    refuses it and zsh reads a pattern, so its content must be a plain qualifier
    list (deny_unlisted_qualifier, lot A). A misread command start only adds a
    false positive (`! (cd src/theme)`), never a gap. `$((...))` is arithmetic
    and is skipped; an array assignment in command position keeps the older
    heuristic only, since zsh reads no qualifier there.
    """
    quote = ""
    i = 0
    while i < len(text):
        char = text[i]
        if quote:
            if char == "\\" and quote == '"':
                i += 1
            elif char == quote:
                quote = ""
        elif char in {"'", '"'}:
            quote = char
        elif char == "\\":
            i += 1
        elif char == "(":
            before = text[:i].rstrip(" \t")
            if not _opens_command(text, i) and not before.endswith("$"):
                end = _group_end(text, i)
                if end is not None:
                    if _array_assignment(text, i) or _after_reserved_word(text, i):
                        deny_code_qualifier(text[i + 1 : end])
                    else:
                        deny_unlisted_qualifier(text[i + 1 : end])
        i += 1


# ---------------------------------------------------------------------------
# tokenisation
# ---------------------------------------------------------------------------


def extract_substitutions(text: str, quoted: bool = False) -> tuple[str, list[str]]:
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
        # zsh: `=(cmd)` is a process substitution too, wherever a word may start:
        # after a blank, an operator, but also a redirection (`cat <=(cmd)` slipped
        # through when only `;&|(` counted, seventh review of lot 4). Only an array
        # assignment (`name=(a b)`, `name+=(c)`, `a[1]=(x)`) is left to tokenize.
        # Extracting too much is harmless: the inner is judged as a command.
        array = i > 0 and (text[i - 1].isalnum() or text[i - 1] in "_]+")
        if (two in {"$(", "<(", ">("} or (two == "=(" and not array)) and not text[i : i + 3] == "$((":
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
            # Inside double quotes, or in a heredoc body (`quoted`), no shell reads
            # qualifiers: `echo "\$(date)"` is plain text (review of lot A).
            escaped = i > 0 and text[i - 1] == "\\"
            glued = two == "=(" and i > 0 and not text[i - 1].isspace() and text[i - 1] not in ";&|(<>"
            if (escaped or glued) and not (double or quoted):
                # Glued to a word (`*=(...)`) or escaped (`\$(...)`, `\<(...)`: a
                # literal `$` or `<` then a group), zsh may read the group as
                # qualifiers (eleventh review of lot 4). It stays extracted and
                # judged as a command too: checking more is harmless.
                deny_unlisted_qualifier(inners[-1])
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
    # The `)` of a case pattern closes `$(` for this count (sixth review of lot
    # A: `echo "$(case a in a) true;; esac; rm -rf x)"` left the rest in the
    # outer quotes, as text). A `case` inside a substitution is refused.
    # False positive accepted: write the `case` outside, or use `if`.
    for inner in inners:
        if re.search(r"(?:^|[\s;&|(){}!`])case(?=\s)", _mask_quotes(inner, double_too=True)):
            deny(
                "unquoted word `case` inside a command substitution",
                "A `case` pattern's `)` would close the substitution for this guard. As an "
                "argument, quote the word ('case'); as a statement, move it out of "
                "`$(...)`, or use `if`.",
            )
    return "".join(out), inners


def fold_glob_groups(text: str, groups: list[str] | None = None) -> str:
    """Fold every unquoted `(...)` glued to a word into `*` (see tokenize).

    zsh reads a group glued to a word as glob qualifiers, whatever precedes it:
    `file(N)` and `*''(D)` are patterns too (sixth review of lot 4), so the rule
    is "glued to a word", not "after a glob character". Only an empty `()`
    (a function definition) is kept. Quoted text is no pattern for the shell,
    and inline code (`python3 -c '...'`) is judged from it: folded there,
    `os.rename(*("/tmp/x","scripts/check.sh"))` lost its literal paths and
    passed (fifth review of lot 4).

    The fold cannot tell a qualifier from a real subshell: `{(rm x)}`,
    `then(rm x)` or `do(rm x)` run their group (seventh review of lot 4). So
    every folded group's content is handed back through `groups`,
    for the caller to judge as well: both readings are judged.
    """
    out: list[str] = []
    quote = ""
    glued = False  # the last character emitted belongs to a word
    i = 0
    while i < len(text):
        char = text[i]
        if quote:
            out.append(char)
            if char == "\\" and quote == '"' and i + 1 < len(text):
                out.append(text[i + 1])
                i += 1
            elif char == quote:
                quote = ""
            glued = True
        elif char in {"'", '"'}:
            quote = char
            out.append(char)
            glued = True
        elif char == "\\" and i + 1 < len(text):
            out.append(text[i : i + 2])
            i += 1
            glued = True
        elif char == "(" and glued:
            end = _group_end(text, i)
            if end is None or end == i + 1:
                out.append(char)  # `name()` or unbalanced: left to the lexer
                glued = False
            else:
                if groups is not None:
                    groups.append(text[i + 1 : end])
                out.append("*")
                i = end  # resume after the closing parenthesis
        else:
            out.append(char)
            glued = not (char.isspace() or char in ";&|<>()!")
        i += 1
    return "".join(out)


def _group_end(text: str, start: int) -> int | None:
    """Index of the `)` closing the group opened at `start`, quotes skipped."""
    depth = 0
    quote = ""
    i = start
    while i < len(text):
        char = text[i]
        if quote:
            if char == "\\" and quote == '"':
                i += 1
            elif char == quote:
                quote = ""
        elif char in {"'", '"'}:
            quote = char
        elif char == "\\":
            i += 1
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def tokenize(text: str) -> list[str]:
    """Shell-ish tokens with operators split out, even without spaces.

    `ls;rm -rf x` used to be read as the single word `ls;rm` (JOURNAL J-028).
    punctuation_chars makes shlex emit `;`, `&&`, `|`, `(`, `>` ... as their
    own tokens. Substitutions must have been extracted before.

    A zsh glob qualifier or a bash extglob group glued to its word (`*(D)`,
    `@(a|b)`) is folded into a plain glob first: split at `(`, the word lost its
    pattern and `cp x/*(D) dest` read as a copy to the glob `x/*` (fourth review
    of lot 4).

    Only an unquoted, unescaped operator comes out as an `Op`: shlex returns
    `'('` and `\\(` as the same `(` as a real subshell, and the directory stack
    followed them (`cd /tmp; echo '('; cd scripts; echo ')'; rm -rf hooks`,
    review of lot A). Quoted and escaped operator characters are shielded
    before shlex and given back as plain words.
    """
    text = _shield_quoted(fold_glob_groups(text))
    lexer = shlex.shlex(text, posix=True, punctuation_chars=True)
    lexer.whitespace_split = True
    lexer.commenters = ""
    tokens: list[str] = []
    for token in lexer:
        for part in split_punctuation(token):
            if part in _PUNCT_OPS or part in {"{", "}", "!"}:
                tokens.append(Op(part))
            else:
                tokens.append(part.translate(_UNSHIELD))
    return tokens


class Op(str):
    """A real shell operator, as opposed to the same characters quoted or escaped."""


_SHIELDED = "();<>|&{}!"
_SHIELD = {char: chr(0xF000 + ord(char)) for char in _SHIELDED}
_UNSHIELD = str.maketrans({value: key for key, value in _SHIELD.items()})


def _shield_quoted(text: str) -> str:
    """Replace operator characters inside quotes or after a backslash (see tokenize)."""
    out: list[str] = []
    quote = ""
    i = 0
    while i < len(text):
        char = text[i]
        if char == "\\" and quote != "'" and i + 1 < len(text):
            out.append(char + _SHIELD.get(text[i + 1], text[i + 1]))
            i += 2
            continue
        if quote:
            if char == quote:
                quote = ""
                out.append(char)
            else:
                out.append(_SHIELD.get(char, char))
        else:
            if char in {"'", '"'}:
                quote = char
            out.append(char)
        i += 1
    return "".join(out)


# Longest first: shlex returns a run of punctuation such as `)&&` or `;(` as a
# single token, which would glue two commands together.
_PUNCT_OPS = (
    "&>>", "<<<", "<<-", ";;&", "&&", "||", "|&", ";;", ";&", ";|", ">>", "&>", ">&", ">|", "<<", "<>",
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


def case_pattern_end(commands: list[tuple[list[str], str]], at: int) -> int | None:
    """Index of the command after the `)` that closes a pattern starting at `at`.

    A pattern is one or more `|` alternatives of a single CASE_PATTERN_RE word
    each, closed by `)`. Anything else returns None and is judged as commands
    (third review of lot A). False positive accepted: a quoted pattern holding a
    blank, or a `$var` pattern, is read as a command name and refused.
    """
    index = at
    while index < len(commands):
        words, before = commands[index]
        if index > at and before == ")":
            return index
        if index > at and before != "|":
            return None
        if len(words) != 1 or not CASE_PATTERN_RE.fullmatch(words[0]):
            return None
        index += 1
    return None


def split_commands(tokens: list[str], keep_empty: bool = False) -> list[tuple[list[str], str]]:
    """Commands with the operator that precedes each one ('' at the start).

    keep_empty keeps the operators that precede no word (`(`, `)`, `;` in
    `(cd /tmp); cp ...`): the directory tracking needs them.
    """
    commands: list[tuple[list[str], str]] = [([], "")]
    for token in tokens:
        if isinstance(token, Op) and token in OPERATORS:
            commands.append(([], token))
        else:
            commands[-1][0].append(token)
    return [c for c in commands if c[0] or keep_empty]


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


# Per tool, the options whose value is only READ (--config, --ignore-path...).
# Prettier's `-c` is `--check`, a flag: skipping the word after it hid the
# target of `prettier --write -c <file>` (JOURNAL J-050).
REWRITER_READ_OPTIONS = {
    "prettier": {"--config", "--ignore-path", "--plugin", "--parser", "--loglevel", "--log-level"},
    "eslint": {"--config", "-c", "--ignore-path", "--rulesdir", "--plugin", "--ext",
               "--resolve-plugins-relative-to", "--parser", "-f", "--format"},
}
# Options whose value is WRITTEN, with or without --write/--fix: the ESLint
# report and either tool's cache file (JOURNAL J-050).
REWRITER_WRITE_OPTIONS = {"-o", "--output-file", "--cache-location"}


def rewrite_targets(args: list[str], name: str) -> tuple[list[str], list[str]]:
    """(files rewritten under --write/--fix, files written whatever the flags)."""
    read = REWRITER_READ_OPTIONS[name]
    targets: list[str] = []
    outputs: list[str] = []
    i = 0
    while i < len(args):
        arg = args[i]
        key, eq, value = arg.partition("=")
        if key in REWRITER_WRITE_OPTIONS:
            if eq:
                outputs.append(value)
            elif i + 1 < len(args):
                outputs.append(args[i + 1])
                i += 1
        elif key in read:
            if not eq:
                i += 1
        elif not arg.startswith("-"):
            targets.append(arg)
        i += 1
    return targets, outputs


def option_values(args: list[str], *names: str) -> list[str]:
    """Every value of the options named: `-o X`, `-oX`, `--output X`,
    `--output=X`, and a one-letter option at the end of a bundle (`curl -sSLo
    X`) or inside it (`-sSLoX`), which option_value() does not see (lot C)."""
    values: list[str] = []
    for i, arg in enumerate(args):
        nxt = args[i + 1] if i + 1 < len(args) else None
        for name in names:
            if arg == name:
                if nxt is not None:
                    values.append(nxt)
            elif name.startswith("--"):
                # getopt_long takes any unambiguous prefix (`wget --output-doc=`,
                # J-038): every prefix counts here, an ambiguous one included.
                given, eq, value = arg.partition("=")
                if len(given) > 2 and given.startswith("--") and name.startswith(given):
                    if eq:
                        values.append(value)
                    elif nxt is not None:
                        values.append(nxt)
            elif arg.startswith("-") and not arg.startswith("--") and len(name) == 2 and name[1] in arg[1:]:
                rest = arg[arg.index(name[1], 1) + 1 :]
                if rest:
                    values.append(rest)
                elif nxt is not None:
                    values.append(nxt)
    return values


def has_long(args: list[str], *names: str) -> bool:
    """True when one of the long options named is given, in full or by any
    prefix (getopt_long, J-038), with or without `=value`."""
    for arg in args:
        given = arg.partition("=")[0]
        if len(given) > 2 and given.startswith("--") and any(name.startswith(given) for name in names):
            return True
    return False


def short_groups(
    args: list[str], value_letters: str, long_values: frozenset[str] = frozenset()
) -> tuple[set[str], dict[str, list[str]], list[str]]:
    """One-letter options of a getopt-style tool, read the way getopt reads
    them: a letter that takes a value consumes the rest of its group, or the
    next word (`unzip -dtools`: d with value `tools`, not -d -t -o -o -l -s).
    Returns the letters seen, the values of the value letters, and the
    operands: the other words, a lone `-` included, minus the values of the
    long options in `long_values` given without `=` (review of lot C:
    short_flags() read the letters of glued values as options)."""
    letters: set[str] = set()
    values: dict[str, list[str]] = {}
    operands: list[str] = []
    skip = False
    for i, arg in enumerate(args):
        if skip:
            skip = False
            continue
        if arg == "--":
            operands += args[i + 1 :]
            break
        if arg.startswith("--"):
            skip = arg in long_values and i + 1 < len(args)
            continue
        if not arg.startswith("-") or len(arg) < 2:
            operands.append(arg)
            continue
        for j, letter in enumerate(arg[1:], start=1):
            letters.add(letter)
            if letter in value_letters:
                rest = arg[j + 1 :]
                if rest:
                    values.setdefault(letter, []).append(rest)
                elif i + 1 < len(args):
                    values.setdefault(letter, []).append(args[i + 1])
                    skip = True
                break
    return letters, values, operands


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
        # A set CDPATH makes a relative `cd` land anywhere (see _cd).
        self.cdpath = bool(os.environ.get("CDPATH"))
        # Set once the text holds a construct that may run a `cd` in a subshell
        # or not at all (COMPOUND_WORDS, UNSURE_OPERATORS, a function): every
        # later `cd` makes the directory unknown (lot A).
        self.cwd_unsure = False
        # Set by _check_line for the command being judged: it follows `&&`.
        self._chained = False
        # Set by a `cd` that may not take effect: the directory becomes unknown
        # at the end of its and-or list (`false && cd /tmp; cp ...`).
        self._cd_shaky = False
        # Set by _unwrap: the command runs behind a wrapper that leaves the shell.
        self._wrapped = False
        # Set by _check_line when its line ends a `case` branch (`;;`) or opens a
        # `case` on its `in`: the next line starts with a pattern.
        self._case_pattern_next = False

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

    def protected(self, word: str, repair: bool = False) -> bool:
        """True when writing to `word` must be refused (harness file or unjudgeable).

        Unlocked, the harness is the agent's to edit, except the modules the
        guards load (scripts/hooks/*.py): through Bash they would skip the Edit
        tool's simulation, and a two-step change could lock every tool out
        (J-056). `repair=True` (git restore/checkout of a file) stays open: it
        is the repair path the simulation keeps alive.
        """
        if not word:
            return False
        if not self.protect:
            # A target known at run time only (`X=scripts/hooks && echo x >
            # "$X/y.py"`, `cd $D && ...`) may be one of those modules: refused
            # as when locked (lot C).
            return not repair and (self._resolve(word) is None or self._hooks_module(word))
        value = word.split("=", 1)[1] if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", word) else word
        value = self._expand(value)
        if "$" in value or SUBST in value or value.startswith("~"):
            # Known at run time only: a variable, a substitution, or `~name` (a
            # zsh named directory, `hash -d h=scripts/hooks`; review of lot A).
            return True
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

    def _home_secret(self, word: str) -> bool:
        """True when `word` names a credential file of $HOME, whatever the lock."""
        value = self._expand(word)
        if not value or (self.cwd is None and not os.path.isabs(value)):
            return False
        return harness_paths.home_secret(harness_paths.resolve(value, self.cwd or self.root))

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
        if "$" in value or SUBST in value or value.startswith("~") or (self.cwd is None and not os.path.isabs(value)):
            return None
        return os.path.normpath(value if os.path.isabs(value) else os.path.join(self.cwd or self.root, value))

    def _hooks_module(self, word: str) -> bool:
        """True when `word` names the guards' code: scripts/hooks/ or anything in it.

        `scripts` and `scripts/hooks` themselves count: moving or removing the
        directory takes every module with it (review of lot 4).
        """
        path = self._resolve(word)
        if path is None:
            return False
        rel = harness_paths.to_rel(path, self.root, self.cwd or self.root)
        folded = (rel or "").casefold().rstrip("/")
        return folded in {"scripts", "scripts/hooks"} or folded.startswith("scripts/hooks/")

    def _dropped_into_dirs(self, name: str, args: list[str], pos: list[str]) -> list[str]:
        """What a copy, move or link writes, judged without guessing (EN-ATTENTE §2b).

        `cp src/x.py .` writes ./x.py, yet the destination word (".") is no
        harness file. Modelling shell and tool semantics finely does not close
        (four reviews of lot 4: tree contents, `ditto` and `cp -R x/` copying
        contents, globs, braces, rsync -R, sources created earlier in the same
        command, globs in the destination). So the rule is conservative and
        bounded, never weaker than before this lot:

        - a recursive copy (cp -R/-a, ditto, rsync, mv of a directory or of a
          source that does not exist yet) into the repository is UNKNOWN;
        - a file copy lands as <dir>/<basename>, judged like any target;
        - braces and globs, in the destination or in a source, are UNKNOWN: the
          shell (zsh qualifiers, files created earlier in the same command)
          expands them to something the hook cannot see.

        UNKNOWN is refused when the destination is in the repository (locked);
        unlocked, it is refused when it could reach the guards' own code.
        """
        target_dir = option_value(args, "-t", "--target-directory")
        if target_dir:
            dest, sources = target_dir, pos
        elif len(pos) >= 2:
            dest, sources = pos[-1], pos[:-1]
        else:
            return []
        resolved = self._resolve(dest)
        dest_is_dir = dest.endswith("/") or (resolved is not None and os.path.isdir(resolved))
        shorts, longs = short_flags(args), long_flags(args)
        # For rsync, -R is --relative, not recursive (review of lot 4).
        recursive_shorts = {"r", "a"} if name == "rsync" else {"r", "R", "a"}
        recursive = (
            name in {"ditto", "rsync"}
            or bool(recursive_shorts & shorts)
            or bool({"--recursive", "--archive"} & longs)
        )

        def unknown() -> list[str]:
            if self.protect:
                # protected() refuses any `$` target: the landing is not known.
                return ["$" + UNKNOWN_LANDING] if self._inside_repo(resolved) else []
            # Unlocked: only what could reach the guards' code is refused.
            rel = harness_paths.to_rel(resolved, self.root, self.cwd or self.root) if resolved else None
            if resolved is not None and rel is None:
                return []  # outside the repository (fifth review: was read as the root)
            folded = (rel or "").casefold().rstrip("/")
            if resolved is None or folded in {"", ".", "scripts"} or self._hooks_module(dest):
                return [os.path.join(self.root, "scripts", "hooks", UNKNOWN_LANDING)]
            return []

        if "{" in dest or "}" in dest or GLOB_CHARS & set(dest):
            return unknown()
        if name == "rsync" and ("R" in shorts or "--relative" in longs):
            return unknown()
        dropped: list[str] = []
        for source in sources:
            if "{" in source or "}" in source:
                dropped += unknown()
                continue
            # A pattern source is unknown, whatever the tool: what the shell expands
            # it to (zsh qualifiers `*(D)`, `[^a]*`, `**/`, `<1-9>` ranges, files
            # created earlier in the same command) is not what Python sees at hook
            # time (fourth review of lot 4). Copy the files one by one instead.
            if (GLOB_CHARS | {"<", "("}) & set(source):
                dropped += unknown()
                continue
            source_path = self._resolve(source)
            if source_path is None:
                dropped += unknown()
                continue
            is_tree = os.path.isdir(source_path) or not os.path.exists(source_path)
            if (recursive or name == "mv") and is_tree and name != "ln":
                dropped += unknown()
                continue
            base = os.path.basename(source.rstrip("/"))
            if dest_is_dir and base not in {"", ".", ".."}:
                dropped.append(os.path.join(dest, base))
        return dropped

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
        if not self.protect:
            deny(
                f"writing a module the guards load through Bash ({how})",
                "In an unlocked session, edit scripts/hooks/*.py with the Edit tool: it simulates "
                "the change and refuses one that would break the guards (JOURNAL J-056). "
                "`git restore -- <file>` stays allowed for repairs.",
            )
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
        # A nested text (a substitution, a `sh -c` string) starts outside any
        # `case`, and leaves the pattern state of the enclosing line untouched.
        outer_case = self._case_pattern_next
        self._case_pattern_next = False
        try:
            deny_control_characters(text)
            deny_ansi_c_escapes(text)
            if "#" in text:
                # Both readings (see strip_comments): with comments, the real one
                # for `bash -c`, `zsh -c` and `eval`, and without. Comments are
                # removed per logical line, bodies cut out (fifth review of lot
                # A: a `don't` in a heredoc body hid every later comment from a
                # removal done on the raw text). The directory both agree on.
                saved = (self.cwd, self.cwd_unsure)
                self._check_lines(text, comments=True)
                after = (self.cwd, self.cwd_unsure)
                self.cwd, self.cwd_unsure = saved
                self._case_pattern_next = False
                self._check_lines(text)
                if self.cwd != after[0]:
                    self.cwd = None
                self.cwd_unsure = self.cwd_unsure or after[1]
            else:
                self._check_lines(text)
        finally:
            self._case_pattern_next = outer_case
            self.depth -= 1

    def _check_lines(self, text: str, comments: bool = False) -> None:
        # One segment per logical line: shlex treats a newline as whitespace, so
        # a destructive command on a later line would otherwise be read as a
        # mere argument (JOURNAL J-018). See _logical_line for what makes a
        # logical line run over several physical ones. Each heredoc body is cut
        # out and judged by the command that carries its `<<`: as commands for
        # a shell, as inline code for an interpreter, as data otherwise.
        # Lines end on `\n` only, blanks are spaces and tabs only: what the
        # shell does (fifth review of lot A; other control characters are
        # refused by check_text).
        lines = text.split("\n")
        index = 0
        while index < len(lines):
            line = lines[index].strip(" \t")
            index += 1
            if not line:
                continue
            logical, index, heredocs = self._logical_line(line, lines, index, comments)
            self._check_line(logical)
            for heredoc, body in heredocs:
                self._check_heredoc_body(self._heredoc_consumer(heredoc.head), body, not heredoc.quoted)

    def _logical_line(
        self, first: str, lines: list[str], index: int, comments: bool
    ) -> tuple[str, int, list[tuple[Heredoc, list[str]]]]:
        """The logical line that starts with `first`, the index after it, its heredocs.

        A logical line goes on (fourth review of lot A, checked in bash and zsh):
          - after a quote, a `$(` or a backtick left open (inline code, or a
            commit message spread over several lines, J-038; `)" && cmd` after
            a heredoc in `"$(...)"` belongs to the opening line);
          - after a trailing `|`, `||`, `&&` or `|&`, on the next non-blank line;
          - over each heredoc body, whatever the line still has to say.
        After each line added, the whole logical line (bodies cut out) is
        scanned again: every new `<<` with a body has its body taken from the
        next lines, in order, wherever it stands (fifth review: after a quote
        closed on that line, after a backslash continuation, a second `<<` on
        the same line). With `comments`, the comments are removed from the
        logical line before anything is read, so a quote in a comment opens
        nothing and a heredoc body never feeds the comment model.
        A logical line that never completes is a syntax error for the shell:
        the first line is then judged alone, and every later line on its own,
        bodies included (the strict side).
        """
        start = index
        logical = first
        heredocs: list[tuple[Heredoc, list[str]]] = []
        while True:
            view = strip_comments(logical) if comments else logical
            for heredoc in find_heredocs(view)[len(heredocs) :]:
                body: list[str] = []
                while index < len(lines) and not heredoc.ends(lines[index]):
                    body.append(lines[index])
                    index += 1
                index += 1  # the delimiter line itself
                heredocs.append((heredoc, body))
            finished = self._tokenizes(view) and not line_left_open(view)
            if finished and not CONTINUATION_RE.search(view):
                return view, index, heredocs
            if finished:
                while index < len(lines) and not lines[index].strip(" \t"):
                    index += 1
            if index >= len(lines):
                return (strip_comments(first) if comments else first), start, []
            following = lines[index]
            index += 1
            if ends_with_escape(view) and ends_with_escape(logical) and _scan_line(view)[2] != "'":
                # `\` + newline outside single quotes: the shell removes both before
                # reading words (sixth review of lot A: `git cl\` ⏎ `ean -fdx` ran
                # `git clean`, and `cmd1 && \` ⏎ `cmd2` was refused).
                logical = logical[:-1] + following
            else:
                # At top level after an operator; inside a quote the text is kept as is.
                logical += "\n" + (following.strip(" \t") if finished else following)

    @staticmethod
    def _tokenizes(text: str) -> bool:
        try:
            tokenize(text)
            return True
        except ValueError:
            return False

    def _check_line(self, line: str) -> None:
        # $(...) and backticks run before the command: judge them first, and
        # leave a placeholder whose value (unknown) marks the spot.
        deny_arithmetic_names(line)
        line, inners = extract_substitutions(line)
        for inner in inners:
            self._check_in_subshell(inner)  # $(...) runs in a subshell
        self._check_glued_groups(line)
        try:
            tokens = tokenize(line)
        except ValueError:
            self._raw_fallback(line)
            return
        commands = split_commands(tokens, keep_empty=True)
        if self._unsure_directory(commands):
            self.cwd_unsure = True
        # The current directory, as the shell follows it (lot A): a subshell's
        # `cd` ends at its `)`, a `cd` that may not run ends its list unknown.
        saved: list[tuple[str | None, bool]] = []
        shaky = False
        # Case patterns (third review of lot A): after a branch end (CASE_ENDS),
        # or at the start of a line that follows one or `case ... in`, the words
        # up to the closing `)` are a pattern, never run (case_pattern_end). The
        # `(` and `)` around a pattern open and close no subshell. `;;` outside a
        # `case` is a syntax error: nothing on its line runs.
        pattern = self._case_pattern_next
        self._case_pattern_next = False
        skip_below = 0  # commands below this index belong to a pattern
        for at, (words, before) in enumerate(commands):
            if at < skip_below:
                continue
            if before in CASE_ENDS:
                pattern = True
            if pattern and words:
                pattern = False
                end = case_pattern_end(commands, at)
                if end is not None:
                    commands[end] = (commands[end][0], "")
                    skip_below = end
                    before = before if before in CASE_ENDS else ""
            if before == "(":
                saved.append((self.cwd, shaky))
                shaky = False
            elif before == ")" and saved:
                self.cwd, shaky = saved.pop()
            elif before in {";", "&"} | CASE_ENDS:
                if shaky:
                    self.cwd = None
                shaky = False
            if not words or at < skip_below:
                continue
            self._chained = before == "&&"
            self._cd_shaky = False
            self._check_command(words, piped=before in {"|", "|&"})
            shaky = shaky or self._cd_shaky
        if shaky:
            self.cwd = None
        # The next line starts with a pattern: this one ends a branch, or opens
        # a `case` on its `in` (not a quoted `'case'`: masked).
        self._case_pattern_next = pattern or bool(
            CASE_OPEN_RE.search(_mask_quotes(line, double_too=True).strip())
        )

    def _check_heredoc_body(self, consumer: str, lines: list[str], expands: bool) -> None:
        """Judge a heredoc body by the command that reads it."""
        body = "\n".join(lines)
        # `source /dev/stdin <<EOF` and `. /dev/stdin` run the body in this shell.
        if consumer in SHELLS or consumer in {"source", "."}:
            self._check_in_subshell(body)
        elif consumer in INTERPRETERS:
            self._check_inline_code(body)
        elif expands:
            # Anything else (`cat > file <<EOF`) is data — but with an
            # unquoted delimiter the shell still runs its $(...) first.
            deny_arithmetic_names(body.replace("'", " "))  # quotes are data there
            for inner in extract_substitutions(body, quoted=True)[1]:
                self.check_text(inner)

    def _heredoc_consumer(self, prefix: str) -> str:
        """The command that reads a heredoc: the one that carries its `<<`.

        `prefix` is the text before the `<<`, from the start of its physical
        line or from the `$(` (or backtick) left open around it: the heredoc
        feeds the last command written there. Not the last command of the line
        (fourth review of lot A: `bash <<'EOF' 2>&1 | tail -20` was read as fed
        to `tail`), nor only what a `$(` holds before the `<<` without the rest
        of its line, which _check_line judges (`"$(cat <<'EOF' | sh`). A prefix
        this guard cannot read is refused.
        """
        # A newline outside quotes ends a command: tokenize takes it for a blank
        # (sixth review of lot A: `x=$(true` ⏎ `bash <<EOF` was read as `true bash`).
        mask = _mask_quotes(prefix, double_too=True)
        prefix = "".join(";" if hidden == "\n" else char for char, hidden in zip(prefix, mask))
        try:
            commands = split_commands(tokenize(extract_substitutions(prefix)[0]))
        except ValueError:
            commands = []
        name = ""
        if commands:
            words = self._check_redirections(commands[-1][0])
            while words and ASSIGN_RE.fullmatch(words[0]):
                words = words[1:]
            name = self._unwrap(words)[0] if words else ""
        if not name:
            deny(
                "heredoc whose command cannot be read",
                "Write the command that reads the heredoc plainly before its `<<`, "
                "e.g. `cat > file <<'EOF'` or \"$(cat <<'EOF'\".",
            )
        return name

    def _check_in_subshell(self, text: str) -> None:
        """Judge commands a subshell or a child shell runs: their `cd` ends with them."""
        saved = self.cwd
        try:
            self.check_text(text)
        finally:
            self.cwd = saved

    @staticmethod
    def _unsure_directory(commands: list[tuple[list[str], str]]) -> bool:
        """True when a `cd` in these commands may run in a subshell, or not at all.

        A pipeline element, a background job, `||`, a brace group (it may be
        piped), a compound command or a function body: following each case
        exactly did not close (`{ cd /tmp; } | cat` runs the braces in a subshell
        under bash, the last element in the shell under zsh). So any of them
        makes every later `cd` lead to an unknown directory (lot A).
        """
        previous = None
        for words, before in commands:
            if before in UNSURE_OPERATORS:
                return True
            if before == ")" and previous == "(":
                return True  # `f() ...`: a function definition
            if words and (words[0] in COMPOUND_WORDS or RESERVED_FOLDED_RE.fullmatch(words[0])):
                return True
            previous = before if not words else None
        return False

    def _check_glued_groups(self, line: str) -> None:
        """Judge the groups tokenize folds into `*`, under their other readings.

        A group after a reserved word or `{` is a subshell (`then(rm x)`), so its
        content is judged as a command, in its own directory scope. Only a content
        that tokenizes to one plain word (`*(.)`, `file(N)`) is skipped: judged as a
        command, the `.` qualifier would read as `source` with no file. Blanks do not
        count words: `{(:>f)}` is a full command with none (eighth review of lot 4).
        A zsh qualifier may also run code: see deny_argument_qualifiers, which
        checks every group that opens no command, folded or not. Array
        assignments get no exemption: telling `x=(a b)` in command position from
        the pattern `ls x=(...)` was fooled by `\\;x=(...)` and `{x=(...)` (ninth
        review of lot 4).
        """
        deny_argument_qualifiers(line)
        groups: list[str] = []
        fold_glob_groups(line, groups)
        for content in groups:
            try:
                words = tokenize(content)
            except ValueError:
                words = []  # not tokenizable: judged all the same
            # A nested group folds to one word too (`{({(rm x)})}` reads `{*}`):
            # only a content with nothing folded inside is skipped (closing review).
            if len(words) != 1 or words[0] in _PUNCT_OPS or fold_glob_groups(content) != content:
                saved = self.cwd
                self.check_text(content)
                self.cwd = saved  # a subshell's `cd` does not outlive it

    # -- per command -----------------------------------------------------------

    def _check_command(self, words: list[str], piped: bool = False) -> str:
        """Judge one simple command. Returns the resolved command name."""
        words = self._check_redirections(words)
        # A word starting with `#` in command position: a comment for a shell
        # with interactive_comments, a missing command `#...` for one without
        # (the raw reading of check_text). Inert either way; its redirections
        # were judged just above (third review of lot A: `# step 1` ⏎ `ls`).
        if next((w for w in words if not ASSIGN_RE.fullmatch(w)), "").startswith("#"):
            return ""
        # zsh's `[`/`test` and both shells' `[[` evaluate the operands of `-eq`...
        # as arithmetic (review of lot A): literal numbers, `$#` and `$?` only.
        # Wherever the operator stands: `!`, `&&` and `(` inside `[[ ]]` cut the
        # words into several commands (second review of lot A).
        test_words = {"[", "[[", "test", "]", "]]"} & set(words)
        for at, word in enumerate(words):
            # `[[ -v a[x] ]]` evaluates the subscript (bash).
            if test_words and word == "-v" and at + 1 < len(words):
                sub = re.match(r"[A-Za-z_][A-Za-z0-9_]*\[", words[at + 1])
                if sub and not SUBSCRIPT_LITERAL_RE.fullmatch(words[at + 1][sub.end() : -1]):
                    _deny_arithmetic("test -v of a subscripted name")
            if word in ARITH_TEST_OPS:
                for operand in (words[at - 1] if at else "", words[at + 1] if at + 1 < len(words) else ""):
                    if not re.fullmatch(r"-?[0-9]+|\$[#?]", operand):
                        _deny_arithmetic(f"test {word}")
        index = 0
        # Leading environment assignments.
        while index < len(words) and ASSIGN_RE.fullmatch(words[index]):
            self._check_assignment(words[index])
            index += 1
        words = words[index:]
        if not words:
            return ""
        name, args = self._unwrap(words)
        if not name:
            return ""
        # Builtins whose operand is evaluated as arithmetic, or that take a
        # variable name, subscript included (`read 'a[x]'`): second review of lot A.
        if name in NUMERIC_BUILTINS and not all(re.fullmatch(r"-?[0-9]+|\$[#?]", w) for w in positional(args)):
            _deny_arithmetic(name)
        if name in NAME_BUILTINS:
            # print and printf take free text: only the name after -v counts.
            names = [option_value(args, "-v") or ""] if name in {"print", "printf"} else args
            for word in names:
                sub = re.match(r"[A-Za-z_][A-Za-z0-9_]*\[", word)
                end = _closing(word, sub.end() - 1, "[", "]") if sub else None
                if sub and (end is None or not SUBSCRIPT_LITERAL_RE.fullmatch(word[sub.end() : end])):
                    _deny_arithmetic(f"{name} of a subscripted name")
        # `git ...` exactly as typed: the project's `ask` rules are prefix matches
        # on `git cherry-pick`, `git rebase`... (J-043).
        self._plain_git = words[0] == "git"
        # A commit message is prose: it may mention anything.
        judged = args
        if name == "git" and "commit" in args:
            judged = [a for i, a in enumerate(args) if not (i > 0 and args[i - 1] in {"-m", "--message"})]
        self._check_native([name, *judged])
        # Without case (APFS), and through home_secret: the SSH keys too (JOURNAL J-049).
        if any("gh/hosts.yml" in w.casefold() or self._home_secret(w) for w in args):
            deny("reading a credential file (GitHub token, SSH key)", "It would let a raw HTTP call bypass this guard.")
        if name.startswith("$") or SUBST in name:
            deny(
                "command name taken from a variable",
                "A command whose name is a variable ($X ...) cannot be judged. Write the "
                "command out explicitly.",
            )
        # zsh AUTO_CD: a directory name used as a command moves the shell (lot A),
        # `~-` and `~name` included, whose directory the guard does not know.
        run_word = words[len(words) - len(args) - 1]
        run_path = self._resolve(run_word) if run_word not in {".", ""} else None
        if run_word.startswith("~") or (run_path is not None and os.path.isdir(run_path)):
            self.cwd = None
        # Builtins that can rebind CLAUDECODE (`printf -v`, `read`, `for ... in`,
        # `let`, `declare +x`, a nameref...): a bare mention is refused there. Reading
        # it ($CLAUDECODE) or grepping for the word is fine.
        if name in REBINDING_BUILTINS and any(
            "CLAUDECODE" in w and "$CLAUDECODE" not in w and "${CLAUDECODE" not in w for w in args
        ):
            self._deny_context_hiding()
        if name == "pushd" and (not positional(args) or any(a.startswith(("-", "+")) for a in args)):
            # No argument swaps the top two stack entries; an option may leave the
            # directory unchanged (`pushd -n DIR` in bash): unknown either way.
            self.cwd = None
        elif name in {"cd", "pushd", "chdir"}:
            self._cd(args)
            self._after_cd()
            # zsh's `cd old new` form, or an option it may not take (`cd -Z /tmp`):
            # where it lands, if anywhere, is not followed (second review of lot A).
            options = {a for a in args if a.startswith("-") and a != "-"}
            if len(positional(args)) > 1 or options - {"-L", "-P", "-q", "-s", "--"}:
                self.cwd = None
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
            if {"i", "E", "F"} & short_flags(args) and positional(args):
                # A typed integer evaluates every value assigned to it later.
                _deny_arithmetic(f"{name}: integer or float variable")
            if "n" in short_flags(args) and name != "export":
                # A nameref resolves the name in its value, subscript included.
                _deny_arithmetic(f"{name} -n: name reference")
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
        elif name.startswith("git-credential-"):
            # The helper binary itself, out of `git --exec-path` (JOURNAL J-054).
            deny(name, "Printing a stored credential would let a raw HTTP call bypass this guard.")
        elif name in {"npm", "yarn", "pnpm"}:
            self._check_npm(args)
        elif name == "husky":
            if positional(args)[:1] in (["uninstall"], ["init"]):
                self._deny_hook_bypass("husky uninstall")
        elif name == "gh":
            self._check_gh(args)
        elif name == "security":
            self._check_security(args)
        elif name in {"curl", "wget"}:
            self._check_download(name, args)
        elif name in ARCHIVERS:
            self._check_archive(name, args)
        elif name in COMPRESSORS:
            self._check_compressor(name, args)
        elif name == "patch" and "--dry-run" not in long_flags(args):
            # Locked and unlocked (lot C): unlocked, a patch may touch the
            # guards' modules without the Edit tool's simulation (J-056).
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
        elif name == "let" and not all(ARITH_LITERAL_RE.fullmatch(a) for a in args):
            _deny_arithmetic("let")
        elif name in {"integer", "float"}:
            _deny_arithmetic(f"{name}: integer or float variable")
        elif name == "hash" and any("=" in a or a.startswith("-") for a in args):
            # `hash x=/bin/rm` (zsh), `hash -p /bin/rm x` (bash) bind a name to a
            # program; `hash -d h=dir` names a directory (review of lot A).
            deny("hash binding", "Like an alias, it hides the real command or path from this guard.")
        elif name in {"prettier", "eslint"}:
            rewrites = {"--write", "--fix"} & long_flags(args) or ("w" in short_flags(args) and name == "prettier")
            targets, outputs = rewrite_targets(args, name)
            if any(self.protected(a) for a in outputs) or (rewrites and any(self.protected(a) for a in targets)):
                self.deny_tamper(f"{name} writing a harness file")
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
            elif name in {"mknod", "mkdir"}:
                # mknod [-m MODE] [-Z CTX] NAME TYPE [MAJOR MINOR]: drop option
                # values first, `-m 600` once made the guard judge "600" (review).
                # mkdir [-m MODE] DIR...: every operand is a target (lot A).
                operands: list[str] = []
                skip = False
                for arg in args:
                    if skip:
                        skip = False
                    elif arg in {"-m", "--mode", "-Z", "--context"}:
                        skip = True
                    elif not arg.startswith("-"):
                        operands.append(arg)
                targets = operands if name == "mkdir" else operands[:1]
            else:
                targets = pos
            if name in COPIERS or name == "mv":
                # A destination directory: judge what lands in it (EN-ATTENTE §2b),
                # not the directory word itself, which is no file being written
                # (`mv README.md docs/` used to be read as a root file "docs").
                dropped = self._dropped_into_dirs(name, args, pos)
                if dropped:
                    target_dir = option_value(args, "-t", "--target-directory")
                    dest_word = target_dir if target_dir else (pos[-1] if len(pos) >= 2 else None)
                    targets = [t for t in targets if t != dest_word]
                targets = targets + dropped
            if name == "rm":
                targets = [t for t in targets if not self._regenerable(t)]
            if any(self.protected(a) for a in targets):
                if any(UNKNOWN_LANDING in t for t in targets):
                    self.deny_tamper(
                        f"{name} whose landing in the repository cannot be judged: recursive copy, "
                        "glob or brace source, or a source that does not exist yet. Copy the files "
                        "one by one with literal paths, or use `git mv` / the Edit tool"
                    )
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
        key = re.sub(r"(?:\[[^\]]*\])?\+?$", "", key)  # `X+=v` and `a[1]=v` set X and a
        if key == "CDPATH":
            self.cdpath = True
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
        # Options or a configuration file handed to a downloader, an archiver or
        # a compressor through the environment: what it writes is then unknown
        # (`UNZIP=-d<dir>`, `WGETRC=<file>`), locked or not (review of lot C).
        if key in OPTION_ENV_VARS:
            self.deny_tamper(f"{key}: options from the environment, what the tool writes cannot be judged")
        # Emptying it only LOCKS (what the self-test does). Setting it does not
        # unlock the hooks, which read the environment Claude Code was launched
        # with; but since J-055 the lock sensor reads the variable of the process
        # that runs it, so an agent-set value would make the agent's own
        # `check.sh` (and a pre-push it starts) abstain. Refused for both reasons.
        # A value smuggled through a file is beyond this textual check; the Stop
        # hook, the reviewer and CI do not inherit it.
        if key == harness_paths.UNLOCK_ENV and value.strip("'\"") not in {"", "0"}:
            deny(
                f"setting {harness_paths.UNLOCK_ENV} from the agent",
                "The unlock is read from the environment Claude Code was launched with, not "
                "from a command. Only Cedric can grant it, from his terminal.",
            )

    def _plain_name(self, word: str) -> None:
        """Refuse a command name the shell rewrites before running it (lot A)."""
        if word in PLAIN_NAMES or RESERVED_FOLDED_RE.fullmatch(word):
            return
        if SUBST in word or not COMMAND_NAME_RE.fullmatch(word):
            deny(
                "command name the shell rewrites before running it",
                "A command name with `$`, a substitution, braces, a glob, a leading `=` "
                "or quotes around blanks becomes another command at run time "
                "(`rm${IFS}x`, `{rm,-rf,x}`, `=rm`, `/bin/r?`). Write the command out "
                "as a plain word.",
            )

    def _unwrap(self, words: list[str]) -> tuple[str, list[str]]:
        """Strip prefix commands (sudo, env, xargs, timeout, npx...) and reserved words.

        Sets self._wrapped when a wrapper runs the command outside the current
        shell (a `cd` behind it moves no directory of this shell).
        """
        self._wrapped = False
        index = 0
        while index < len(words):
            self._plain_name(words[index])
            if words[index] in RESERVED_PREFIXES or RESERVED_FOLDED_RE.fullmatch(words[index]):
                index += 1
                continue
            if words[index] == "repeat":  # zsh: `repeat N cmd`, N evaluated as arithmetic
                if not re.fullmatch(r"[0-9]+", words[index + 1] if index + 1 < len(words) else ""):
                    _deny_arithmetic("repeat")
                index += 2
                continue
            if words[index] == "[[":
                # zsh short forms (`if [[ -n x ]] rm -rf y`): the words after the
                # closing `]]` are a command.
                index = words.index("]]", index) + 1 if "]]" in words[index:] else len(words)
                continue
            name = words[index].rsplit("/", 1)[-1].lstrip("\\")
            if name in WRAPPERS:
                if name not in IN_SHELL_WRAPPERS:
                    self._wrapped = True
                value_opts = WRAPPER_VALUE_OPTS.get(name, set())
                rest = words[index + 1 :]
                if name == "env":
                    if ("-u" in rest or "--unset" in rest) and "CLAUDECODE" in rest:
                        self._deny_context_hiding()
                    if "i" in short_flags(rest[:1]) or "--ignore-environment" in long_flags(rest) or "-" in rest[:1]:
                        self._deny_context_hiding()
                    # `env -S 'rm -rf x'` splits the string into a command, followed
                    # by the remaining words (review of lot A).
                    skip = False
                    for at, word in enumerate(rest):
                        if skip:  # the value of -u / -C / -P (`env -u X -S 'cmd'`)
                            skip = False
                            continue
                        if not word.startswith("-"):
                            break
                        # Every leading option, not only the first (`env -P /bin -i`).
                        if word == "-" or (not word.startswith("--") and "i" in word[1:].split("S")[0]):
                            self._deny_context_hiding()
                        skip = word in ENV_VALUE_OPTS
                        split = None
                        grouped = re.fullmatch(r"-[A-Za-z0-9]*S(.*)", word)  # -S, -vS, -S'cmd'
                        if word == "--split-string" and at + 1 < len(rest):
                            split, tail = rest[at + 1], rest[at + 2 :]
                        elif word.startswith("--split-string="):
                            split, tail = word.split("=", 1)[1], rest[at + 1 :]
                        elif grouped and grouped.group(1):
                            split, tail = grouped.group(1), rest[at + 1 :]
                        elif grouped and at + 1 < len(rest):
                            split, tail = rest[at + 1], rest[at + 2 :]
                        if split is not None:
                            if re.search(r"[\\$#]", split):
                                # env -S reads its own escapes (`\_` is a blank) and
                                # ${VAR}: the split it makes is not the guard's.
                                deny(
                                    "env -S string with escapes, variables or comments",
                                    "env -S interprets `\\`, `${VAR}` and `#` itself. Write the command out.",
                                )
                            self.check_text(" ".join([split, *(shlex.quote(w) for w in tail)]))
                            return "env", rest
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
                    words[index].startswith("-") or ASSIGN_RE.fullmatch(words[index])
                ):
                    if ASSIGN_RE.fullmatch(words[index]):
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
        # `cd -` goes back to $OLDPWD, `pushd +N`/`-N` rotates the stack, and a
        # relative `cd` follows CDPATH when it is set (in the environment or in
        # the command): none is tracked, so the directory becomes unknown (review
        # of lot 4: `cd -` used to be read as `cd`, i.e. $HOME).
        # `~-`, `~+` and `~N` name the directory stack too (fifth review).
        if any(arg == "-" or re.match(r"^~?[+-]\d*(/|$)|^~\d+(/|$)", arg) for arg in args):
            self.cwd = None
            return
        target = positional(args)
        if not target:
            self.cwd = os.path.expanduser("~")
            return
        if self.cdpath and not os.path.isabs(target[0]) and not target[0].startswith("."):
            self.cwd = None
            return
        self.cwd = self._resolve(target[0])  # None when it cannot be known

    def _after_cd(self) -> None:
        """Decide how far the directory a `cd` just set can be trusted (lot A).

        Behind a wrapper that leaves the shell (`xargs cd`, `env cd`), or once the
        text holds a construct that may run it in a subshell or skip it
        (cwd_unsure), the directory is unknown at once. Otherwise it holds for
        the rest of its `&&` chain only, which runs only if the `cd` succeeded,
        and is unknown after the list. Whether a `cd` fails cannot be told from
        here: `cd /tmp x` (zsh's two-operand form), a directory the process may
        not enter, a bad option, a failing redirection (review of lot A). The
        price: `cd src; touch x` must be written `cd src && touch x`.
        """
        if self._wrapped or self.cwd_unsure:
            self.cwd = None
        else:
            self._cd_shaky = True

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
                    saved = self.cwd
                    self._check_command(inner)
                    self.cwd = saved  # `-exec cd` runs in a child process

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

        # `git credential fill` and the helpers (`credential.helper osxkeychain` is
        # global) print the GitHub token from the keychain (JOURNAL J-054).
        if (sub == "credential" and pos[:1] in (["fill"], ["approve"], ["reject"])) or sub.startswith("credential-"):
            deny(f"git {sub} {pos[0] if pos else ''}".rstrip(), "Printing a stored credential would let a raw HTTP call bypass this guard.")

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
            # Locked and unlocked (lot C), like patch.
            if sub == "am":
                self.deny_tamper("git am — its targets are only known from the patch")
        elif sub == "apply":
            if not ({"--check", "--stat", "--numstat", "--summary"} & set(rest)):
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
            if any(self.protected(p, repair=True) for p in paths):
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
        elif group == "auth" and action == "status" and ("--show-token" in longs or "t" in short_flags(args)):
            deny("gh auth status --show-token", "Printing the token would let a raw HTTP call bypass this guard.")
        elif group == "auth" and action == "git-credential":
            # The git credential helper protocol prints the same token (JOURNAL J-054).
            deny("gh auth git-credential", "Printing the token would let a raw HTTP call bypass this guard.")

    def _check_security(self, args: list[str]) -> None:
        # The gh token lives in the macOS keychain, which is not a file: the Bash
        # sandbox's denyRead does not cover it (verified in-session, JOURNAL J-051).
        action = positional(args)[:1]
        shorts = short_flags(args)
        # Options before the command: `-i` reads commands from stdin and `-p` implies
        # it, so `printf 'find-generic-password -w ...' | security -i` hid the
        # action from the text (JOURNAL J-054).
        leading: list[str] = []
        for arg in args:
            if not arg.startswith("-"):
                break
            leading.append(arg)
        if {"i", "p"} & short_flags(leading):
            deny("security -i/-p (interactive mode)", "Commands read from stdin cannot be judged, keychain reads included.")
        elif action in (["find-generic-password"], ["find-internet-password"]) and {"w", "g"} & shorts:
            deny(f"security {action[0]} -w/-g", "Printing a keychain secret would let a raw HTTP call bypass this guard.")
        elif action == ["dump-keychain"] and "d" in shorts:
            deny("security dump-keychain -d", "Dumping the keychain prints every stored secret.")

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
        # Judged locked and unlocked (lot C): unlocked, protected() still refuses
        # the guards' own modules and any target known at run time only.
        shorts, longs = short_flags(args), long_flags(args)
        if name == "curl":
            document = option_values(args, "-o", "--output")
            # Other files curl writes when asked: headers, cookies, traces.
            side_files = option_values(
                args, "-D", "--dump-header", "-c", "--cookie-jar", "--trace", "--trace-ascii",
                "--stderr", "--libcurl", "--etag-save", "--hsts", "--alt-svc",
            )
            # -w writes its text into a file with %output{path} (or %output{>>path});
            # a format read from a file (-w @file) may hold one (lot E).
            for fmt in option_values(args, "-w", "--write-out"):
                if fmt.startswith("@"):
                    self.deny_tamper(f"{name} -w {fmt}: its format, and any %output{{}} in it, cannot be judged")
                side_files += [found.lstrip(">") for found in re.findall(r"%output\{([^}]*)\}", fmt)]
            remote_name = "O" in shorts or has_long(args, "--remote-name", "--remote-name-all")
            # The server names the file (-J): what lands is unknown.
            names_unknown = "J" in shorts or has_long(args, "--remote-header-name")
            # A file of options (-K) may set any output at all.
            if "K" in shorts or has_long(args, "--config"):
                self.deny_tamper(f"{name} reading its options from a file: its output cannot be judged")
            # --output-dir applies to -o as well as to -O (review of lot C).
            landings = option_values(args, "--output-dir")
        else:
            document = option_values(args, "-O", "--output-document")
            side_files = option_values(
                args, "-o", "--output-file", "-a", "--append-output", "--save-cookies", "--warc-file",
            )
            remote_name = not document and "-" not in args
            names_unknown = bool({"r", "m", "p", "x", "i"} & shorts) or has_long(
                args, "--recursive", "--mirror", "--page-requisites", "--force-directories",
                "--input-file", "--content-disposition", "--trust-server-names",
            )
            # `-e` runs a wgetrc command (output_document, dir_prefix...): only the
            # robots switch is let through; a wgetrc file may set anything.
            for command in option_values(args, "-e", "--execute"):
                if not re.fullmatch(r"robots\s*=\s*(?:on|off)", command.strip(), re.I):
                    self.deny_tamper(f"{name} -e {command}: its output cannot be judged")
            if has_long(args, "--config"):
                self.deny_tamper(f"{name} reading its options from a file: its output cannot be judged")
            landings = option_values(args, "-P", "--directory-prefix")
            # wget -P: the names under the prefix are the server's (lot 4 rule).
            names_unknown = names_unknown or bool(landings)
        for target in document + side_files:
            if target == "-":
                continue
            # curl's `#1` takes its text from the URL glob: unknown (review of lot C).
            if re.search(r"#\d", target):
                self.deny_tamper(f"{name} -o {target}: the name comes from the URL glob")
            # A relative -o lands under each --output-dir, not here.
            relative_to = landings if target in document and landings and not os.path.isabs(target) else [""]
            for landing in relative_to:
                if self.protected(os.path.join(landing, target) if landing else target):
                    self.deny_tamper(f"{name} writing {target}")
        for landing in landings or [None]:
            if names_unknown:
                self._unknown_names_land(f"{name} saving files the server names", landing)
            elif remote_name:
                for url in positional(args):
                    if "://" not in url:
                        continue
                    base = url.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
                    if set("{}[]") & set(base):
                        # A URL glob: the names are unknown.
                        self._unknown_names_land(f"{name} -O on a URL glob", landing)
                    elif base and self.protected(os.path.join(landing, base) if landing else base):
                        self.deny_tamper(f"{name} -O")

    def _in_repository(self, where: str | None) -> bool:
        """True when `where` is in the repository, or unknown (None)."""
        if where is None or self._inside_repo(where):
            return True
        # Whatever the case of the path (J-047): to_rel knows it.
        return harness_paths.to_rel(where, self.root, self.cwd or self.root) is not None

    def _unknown_names_land(self, how: str, word: str | None) -> None:
        """Files whose names only an archive or a server knows land under `word`
        (None: the current directory). Refused when that is in the repository,
        locked or unlocked (lot C): a name such as `scripts/hooks/x.py` would
        land there. A word known at run time only is in the repository."""
        where = self._resolve(word) if word is not None else self.cwd
        if self._in_repository(where):
            self.deny_tamper(how)

    def _check_archive(self, name: str, args: list[str]) -> None:
        """Archivers, locked and unlocked (lot C): the archive a run creates or
        updates is a file written; what it extracts lands under a directory,
        with names only the archive knows. Per tool, the modes that write; the
        others (list, test, print to stdout) are let through."""
        # Glued values are read as getopt reads them (short_groups), never as
        # letters of the mode (review of lot C: `unzip -dtools` read as -t).
        shorts, longs = short_flags(args), long_flags(args)
        operands = [a for a in args if not a.startswith("-") or a == "-"]
        written: list[str] = []
        trees: list[str] = []  # operands a run deletes as whole trees
        landings: list[str | None] = []
        unknown = "$" + UNKNOWN_LANDING  # resolves to nothing: in the repository

        def one(dirs: list[str]) -> str | None:
            # No directory: the current one. Several: they chain or override,
            # depending on the tool: unknown.
            return None if not dirs else dirs[0] if len(dirs) == 1 else unknown

        if name in {"tar", "bsdtar", "gtar"}:
            letters, values, rest = short_groups(
                args, "fCbTXgKNVHLIF", frozenset({"--file", "--directory", "--cd"})
            )
            dirs = values.get("C", []) + option_values(args, "--directory", "--cd")
            files = values.get("f", []) + option_values(args, "--file")
            if args and not args[0].startswith("-"):
                # Old style, `tar xCf dir a.tar`: each value letter of the first
                # word takes the next words, in order.
                letters |= set(args[0])
                takers = [c for c in args[0] if c in "fCbTXgKNVHLIF"]
                for k, letter in enumerate(takers, start=1):
                    if k < len(args) and letter == "C":
                        dirs.append(args[k])
                    if k < len(args) and letter == "f":
                        files.append(args[k])
                rest = rest[1 + len(takers) :]
            writing = bool({"c", "r", "u", "A"} & letters) or has_long(
                args, "--create", "--append", "--update", "--catenate", "--concatenate", "--delete"
            )
            if writing:
                written += [f for f in files if f != "-"]
            if has_long(args, "--remove-files"):
                trees += rest
            if "x" in letters or has_long(args, "--extract", "--get"):
                # -P keeps absolute member names: they land anywhere.
                absolute = "P" in letters or has_long(args, "--absolute-names")
                landings.append(unknown if absolute else one(dirs))
        elif name == "unzip":
            letters, values, _ = short_groups(args, "dP")
            # -l, -t, -v, -z, -Z list or test; -p prints to stdout.
            if not {"l", "t", "v", "z", "Z", "p"} & letters:
                # `-:` keeps `../` in member names: they land anywhere.
                landings.append(unknown if ":" in letters else one(values.get("d", [])))
        elif name == "zip":
            letters, values, rest = short_groups(
                args, "bntPZsO", frozenset({"--temp-path", "--suffixes", "--from-date", "--before-date",
                                            "--password", "--compression-method", "--split-size",
                                            "--output-file", "--out"})
            )
            if rest and rest[0] != "-":
                written.append(rest[0])
            written += values.get("O", []) + option_values(args, "--output-file", "--out")
            # -m moves the files into the archive: they are removed, trees with -r.
            if "m" in letters or has_long(args, "--move"):
                trees += rest[1:]
        elif name in {"7z", "7za", "7zr", "7zz"}:
            # 7-Zip switches ignore case: -o and -O, -sdel and -SDEL.
            command = operands[0].lower() if operands else ""
            archive = operands[1] if len(operands) > 1 else None
            switches = [a.lower() for a in args if a.startswith("-")]
            if command in {"a", "u", "d", "rn"} and archive is not None:
                written.append(archive)
                # -sdel deletes the files once compressed: whole trees.
                if any(s.startswith("-sdel") for s in switches):
                    trees += operands[2:]
            if command in {"e", "x"} and "-so" not in switches:
                # -spf keeps absolute paths: they land anywhere.
                absolute = any(s.startswith("-spf") for s in switches)
                dirs = [a[2:] for a in args if a[:2].lower() == "-o"]
                landings.append(unknown if absolute else one(dirs))
        elif name == "unrar":
            command = operands[0].lower() if operands else ""
            if command in {"e", "x"}:
                dirs = [a[3:] for a in args if a.lower().startswith("-op") and len(a) > 3]
                if len(operands) > 2 and operands[-1].endswith("/"):
                    dirs.append(operands[-1])
                landings.append(one(dirs))
        elif name == "unar":
            # One-dash long options: read word by word, never as a letter group.
            dirs = [
                args[i + 1] for i, a in enumerate(args)
                if a in {"-o", "-output-directory", "--output-directory"} and i + 1 < len(args)
            ]
            landings.append(one(dirs))
        elif name == "jar":
            bundle = args[0].lstrip("-") if args and not args[0].startswith("--") else ""
            letters = set(bundle)
            archive = option_value(args, "--file")
            if archive is None and "f" in bundle:
                takers = [c for c in bundle if c in "fme"]
                index = 1 + takers.index("f")
                archive = args[index] if index < len(args) else None
            if ({"c", "u"} & letters or {"--create", "--update"} & longs) and archive is not None:
                written.append(archive)
            if "x" in letters or "--extract" in longs:
                landings.append(option_value(args, "--dir", "-C"))
        elif name == "ar":
            index = next((i for i, a in enumerate(args) if not a.startswith("--")), None)
            if index is not None:
                bundle = args[index].lstrip("-")
                members = [a for a in args[index + 1 :] if not a.startswith("-")]
                # a/b/i take a member name first, N a count.
                skip = (1 if set("abi") & set(bundle) else 0) + (1 if "N" in bundle else 0)
                if set("dmqrs") & set(bundle) and len(members) > skip:
                    written.append(members[skip])
                if "x" in bundle:
                    landings.append(option_value(args, "--output"))
        elif name in {"cpio", "bsdcpio"}:
            letters, values, _ = short_groups(args, "FOIDHERMC")
            listing = "t" in letters or has_long(args, "--list")
            if "o" in letters or has_long(args, "--create"):
                files = values.get("O", []) + values.get("F", []) + option_values(args, "--file")
                written += [f for f in files if f != "-"]
            elif ({"i", "p"} & letters or has_long(args, "--extract", "--pass-through")) and not listing:
                # Member names may be absolute (kept by default): they land anywhere.
                self.deny_tamper(f"{name} extracting: member names may be absolute and land anywhere")
        elif name == "pax":
            letters, values, _ = short_groups(args, "fsbopx")
            if "r" in letters:
                # Absolute member names are kept, and -s rewrites them: anywhere.
                self.deny_tamper(f"{name} -r: member names may be absolute and land anywhere")
            if "w" in letters:
                written += [f for f in values.get("f", []) if f != "-"]
        for archive in written:
            if self.protected(archive):
                self.deny_tamper(f"{name} writing {archive}")
        for tree in trees:
            if self.protected(tree) or self._tree_reaches(tree):
                self.deny_tamper(f"{name} removing {tree}")
        for word in landings:
            self._unknown_names_land(f"{name} extracting into the repository", word)

    def _tree_reaches(self, word: str) -> bool:
        """For an operand a tool walks recursively or deletes as a tree (`gzip
        -r .`, `zip -rm x.zip .`, `tar --remove-files`): True when that tree may
        hold what this session must not touch. Anything at or above the
        repository root does; then, locked, anything in the repository (the
        harness lies everywhere, src/ included), unlocked, scripts/ and
        scripts/hooks/ (review of lot C). Unknown at hook time: True."""
        path = self._resolve(word)
        if path is None:
            return True
        tree = os.path.realpath(path).casefold().rstrip(os.sep)
        root = os.path.realpath(self.root).casefold()
        if root == tree or root.startswith(tree + os.sep):
            return True
        if self.protect:
            return self._in_repository(path)
        return self._hooks_module(word)

    def _check_compressor(self, name: str, args: list[str]) -> None:
        """`gzip x` replaces x by x.gz (lot C): each operand is a file written or
        removed, judged as a target, locked and unlocked; so is an output named
        by -o or an output directory. Writing to stdout, testing or listing
        writes nothing (lz4 -l is a format, not a listing)."""
        # Glued values are read as getopt reads them, per tool (review of lot
        # C: `gzip -S.ct x` was read as -c -t, stdout and test).
        letters, values, operands = short_groups(
            args, COMPRESSOR_VALUE_LETTERS.get(name, ""), COMPRESSOR_LONG_VALUES | set(COMPRESSOR_OUTPUTS)
        )
        quiet = {"c", "t"} | (set() if name in {"lz4", "unlz4"} else {"l"})
        if quiet & letters or has_long(args, "--stdout", "--to-stdout", "--test", "--list"):
            return
        if has_long(args, *COMPRESSOR_LISTS):
            self.deny_tamper(f"{name} reading its inputs from a list: what it writes cannot be judged")
        outputs = values.get("o", []) + option_values(args, *COMPRESSOR_OUTPUTS)
        if name == "lzop":
            outputs += values.get("p", [])  # lzop -p: the output directory
        for target in operands + outputs:
            if self.protected(target):
                self.deny_tamper(f"{name} replacing {target}")
        # -r walks each operand: a whole tree is replaced (review of lot C).
        if "r" in letters or has_long(args, "--recursive"):
            for tree in operands:
                if self._tree_reaches(tree):
                    self.deny_tamper(f"{name} -r on {tree}")

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
                    self._check_in_subshell(args[i + 1])  # a child shell: its `cd` ends with it
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
        # Judged locked and unlocked (lot C): unlocked, protected() answers for
        # the guards' own modules and for targets known at run time only.
        if CODE_WRITE_RE.search(code):
            for literal in re.findall(r"[\"']([^\"'\s]+)[\"']", code):
                # Perl's two-argument open glues its mode to the path: '>x', '+<x' (lot E).
                literal = re.sub(r"^\+?(?:>>?|<)", "", literal) or literal
                if "/" in literal or "." in literal:
                    if self.protected(literal) and "$" not in literal:
                        self.deny_tamper("inline interpreter code")
                # A path assembled at run time (['scripts', 'check.sh'].join('/')):
                # a bare harness directory name in writing code is enough (J-042).
                if self.protect and literal in PROTECTED_SEGMENTS:
                    self.deny_tamper("inline code writing under a harness directory")
                # The guards' own code, whatever the lock (lot C).
                if literal.casefold() in HOOKS_SEGMENTS:
                    self.deny_tamper("inline code writing under scripts/hooks")

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
