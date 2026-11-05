#!/usr/bin/env python3
"""check-docs-metrics.py — the test counts of PROGRESS.md are the measured ones.

The "Métriques actuelles" table of docs/context/PROGRESS.md stayed at 85 suites
and 1133 tests while the suite had grown to 86 and 1226 (JOURNAL J-022): a
number nobody remeasures is a number that lies. Two rows are compared with the
report that the `tests` sensor wrote during the same `scripts/check.sh` run
(`jest --json --outputFile`, in the run's own work directory, so a report from
an older tree can never be read):

  | Suites de tests | N |                  == numTotalTestSuites
  | Tests (cas) — `npm run check` | N |    == numTotalTests

Other rows (entities, ports, screens...) have no reliable count and are not
checked. The date in the heading is not checked either.

MIVRO_JEST_REPORT is the report (set by check.sh from its work directory);
MIVRO_DOCS_ROOT points the sensor at another tree (self-test).
Exit 0 = both rows match, 1 = a row is stale or missing, 3 = no report from
this run (the `tests` sensor did not run): an abstention, never a green.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(
    os.environ.get("MIVRO_DOCS_ROOT")
    or subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip()
)
PROGRESS = "docs/context/PROGRESS.md"
ROWS = {
    "numTotalTestSuites": re.compile(r"^\|\s*Suites de tests\s*\|\s*([0-9]+)\s*\|", re.M),
    "numTotalTests": re.compile(r"^\|\s*Tests \(cas\)[^|]*\|\s*([0-9]+)\s*\|", re.M),
}
LABELS = {"numTotalTestSuites": "Suites de tests", "numTotalTests": "Tests (cas)"}


def main() -> int:
    report_path = os.environ.get("MIVRO_JEST_REPORT", "")
    try:
        report = json.loads(Path(report_path).read_text(encoding="utf-8")) if report_path else None
    except (OSError, ValueError):
        report = None
    if not isinstance(report, dict):
        print("no Jest report from this run: run it with the tests sensor (npm run check)")
        return 3
    text = (ROOT / PROGRESS).read_text(encoding="utf-8")
    bad = 0
    for key, pattern in ROWS.items():
        measured = report.get(key)
        match = pattern.search(text)
        if not isinstance(measured, int):
            print(f"✖ the Jest report has no {key}")
            bad = 1
        elif not match:
            print(f"✖ {PROGRESS}: no '| {LABELS[key]} | N |' row in the metrics table")
            bad = 1
        elif int(match.group(1)) != measured:
            line = text.count("\n", 0, match.start()) + 1
            print(f"✖ {PROGRESS}:{line}: {LABELS[key]} says {match.group(1)}, Jest measured {measured}")
            bad = 1
    return bad


if __name__ == "__main__":
    sys.exit(main())
