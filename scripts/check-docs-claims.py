#!/usr/bin/env python3
"""check-docs-claims.py — what the current-state docs say about files is true.

  1. Absence denied by the repo: a path quoted in backticks and immediately
     followed by "n'existe pas", "n'existe plus", "est absent(e)(s)" or
     "inexistant(e)(s)" must not exist. The RUNBOOK once said "`.env` n'existe
     pas" and "`.firebaserc` est absent" in the very commit that created them
     (JOURNAL J-022): a reader following it would have overwritten them.
  2. Dead source path: a path quoted in backticks that starts with `src/` must
     exist. POLICIES.md still sent readers to src/infrastructure/ long after
     ADR-014 moved the adapters to src/services/infra/.

The grammar is tight on purpose. A window of ~80 characters around "absent"
was tried first: on the docs of 2026-11-05 it found five claims, all wrong,
among them INVENTAIRE.md "Scripts référencés par `CLAUDE.md` mais absents",
where the absence is about the scripts, not about the file quoted before it.

Read: the docs that describe the repo as it is now — docs/context/*.md except
PROGRESS.md (a dated log of each feature, with its paths of the time),
docs/harness/INVENTAIRE.md, CLAUDE.md and README.md. Not read: the failure
journal and the ADRs, which tell a past state or quote the wrong claim.

Skipped: struck text ("~~...~~"), fenced code blocks, a checked "- [x]" item
with its indented continuation lines, a path announced as a file to create
("Créer `src/...`" earlier on the line), a path covered by rule 1 (an absence
claim on a missing path is true, and green), and templates: a path holding
"<", "{", "*", "…", "..." or a one-letter capital segment ("src/features/X/").

A line suffix (`src/App.tsx:42`, `src/App.tsx#L42`) is dropped before the
existence test.

Limits: a claim phrased otherwise ("aucun fichier `x`", "`x` a disparu") is
not seen; only `src/` paths are checked for existence; a dead path in a
skipped item stays invisible until the item is reopened. A path is looked up
from the root of the repository, whatever folder the sentence speaks of:
"`App.tsx` n'existe plus à la racine, il est dans `src/app/`" is red if a
root `App.tsx` exists, and green otherwise, even when `src/app/App.tsx` is
missing (review of lot D).

MIVRO_DOCS_ROOT points the sensor at another tree (self-test).
Exit 0 = every claim holds, 1 = at least one finding (each one listed).
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(
    os.environ.get("MIVRO_DOCS_ROOT")
    or subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip()
)

DOCS_DIRS = ["docs/context"]
EXCLUDED = {"docs/context/PROGRESS.md"}
EXTRA_DOCS = ["docs/harness/INVENTAIRE.md", "CLAUDE.md", "README.md"]

APOS = "['’]"
ABSENCE_RE = re.compile(
    r"`([^`\s]+)`(?:\s|\*)*"
    r"(?:n" + APOS + r"existe\s+(?:pas|plus)"
    r"|(?:est|sont)\s+(?:\*\*)?(?:absente?s?|inexistante?s?)"
    r"|(?:absente?s?|inexistante?s?))\b"
)
SRC_PATH_RE = re.compile(r"`(src/[^`\s]*)`")
CREATE_RE = re.compile(r"\b[Cc]réer\b")
TEMPLATE_RE = re.compile(r"[<>{}*…]|\.\.\.|(?:^|/)[A-Z](?:/|$)")
CHECKED_RE = re.compile(r"^(\s*)- \[[xX]\] ")
FENCE_RE = re.compile(r"^\s*(```|~~~)")


def docs() -> list[str]:
    found = []
    for folder in DOCS_DIRS:
        base = ROOT / folder
        if base.is_dir():
            found += sorted(f"{folder}/{p.name}" for p in base.glob("*.md"))
    found += [d for d in EXTRA_DOCS if (ROOT / d).is_file()]
    return [d for d in found if d not in EXCLUDED]


def readable_lines(text: str) -> list[tuple[int, str]]:
    """Lines that still state something: fences and checked items removed."""
    kept = []
    in_fence = False
    checked_indent = -1
    for number, line in enumerate(text.split("\n"), 1):
        if FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        indent = len(line) - len(line.lstrip())
        if checked_indent >= 0:
            if not line.strip() or indent > checked_indent:
                continue
            checked_indent = -1
        match = CHECKED_RE.match(line)
        if match:
            checked_indent = len(match.group(1))
            continue
        kept.append((number, line))
    return kept


def unstruck(lines: list[tuple[int, str]]) -> tuple[str, list[int]]:
    """Join the lines (Prettier wraps claims), drop struck spans, map offsets to line numbers."""
    text = ""
    starts = []
    for number, line in lines:
        starts.append((len(text), number))
        text += line.strip() + " "
    # Blank the struck spans instead of removing them: offsets stay valid.
    text = re.sub(r"~~.*?~~", lambda m: " " * len(m.group(0)), text, flags=re.S)
    numbers = [0] * (len(text) + 1)
    for (offset, number), nxt in zip(starts, starts[1:] + [(len(text) + 1, 0)]):
        for i in range(offset, nxt[0]):
            numbers[i] = number
    return text, numbers


def exists(path: str) -> bool:
    # `src/App.tsx:42` and `src/App.tsx#L42` cite a line of the file (lot E).
    path = re.sub(r"(?::\d+(?:[-:]\d+)?|#L\d+(?:-L?\d+)?)$", "", path)
    return (ROOT / path.rstrip("/")).exists()


def check(doc: str) -> list[str]:
    findings = []
    text, numbers = unstruck(readable_lines((ROOT / doc).read_text(encoding="utf-8")))
    absent_spans = set()
    for match in ABSENCE_RE.finditer(text):
        path = match.group(1)
        absent_spans.add(match.start(1))
        if TEMPLATE_RE.search(path) or ("/" not in path and "." not in path):
            continue
        if exists(path):
            findings.append(f"{doc}:{numbers[match.start()]}: `{path}` is said absent, but it exists")
    for match in SRC_PATH_RE.finditer(text):
        path = match.group(1)
        if match.start(1) in absent_spans or TEMPLATE_RE.search(path):
            continue
        line_start = match.start()
        while line_start > 0 and numbers[line_start - 1] == numbers[match.start()]:
            line_start -= 1
        if CREATE_RE.search(text[line_start : match.start()]):
            continue
        if not exists(path):
            findings.append(f"{doc}:{numbers[match.start()]}: `{path}` is cited, but it does not exist")
    return findings


def main() -> int:
    findings = []
    for doc in docs():
        findings += check(doc)
    for finding in findings:
        print(f"✖ {finding}")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
