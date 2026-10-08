#!/usr/bin/env python3
"""check-audit-verdict.py — judge `npm audit --json` (stdin) against the accepted list.

Called by scripts/check-audit.sh; see its header for the policy (JOURNAL J-040).
Exit 0 = nothing unaccepted, 1 = finding, 3 = registry unreachable.
"""

from __future__ import annotations

import datetime
import json
import re
import sys

NETWORK_MARKERS = ("ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "network request")
GHSA_RE = re.compile(r"^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$")
MIN_REASON = 40

raw = sys.stdin.read()
try:
    report = json.loads(raw)
except ValueError:
    report = None
if not isinstance(report, dict) or "error" in report:
    text = raw if not isinstance(report, dict) else json.dumps(report.get("error"))
    if any(marker in text for marker in NETWORK_MARKERS):
        print("npm registry unreachable")
        sys.exit(3)
    print("✖ npm audit gave no usable report:")
    print(text[:2000])
    sys.exit(1)
# Any other shape (an empty object, npm 6's `advisories`, a future report
# version) must never read as "no vulnerability" (JOURNAL J-050).
if report.get("auditReportVersion") != 2 or not isinstance(report.get("vulnerabilities"), dict):
    print("✖ unrecognised npm audit report (expected auditReportVersion 2 with a `vulnerabilities` object)")
    sys.exit(1)

findings: list[str] = []
today = datetime.date.today()

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        accepted = json.load(handle)
except (OSError, ValueError) as error:
    print(f"✖ scripts/audit-accepted.json unreadable: {error}")
    sys.exit(1)
if not isinstance(accepted, dict):
    print("✖ scripts/audit-accepted.json must be an object keyed by GHSA id")
    sys.exit(1)

valid: dict[str, datetime.date] = {}
for gid, entry in accepted.items():
    if gid.startswith("_"):
        continue  # "_comment" and similar keys
    if not GHSA_RE.match(gid) or not isinstance(entry, dict):
        findings.append(f"accepted list: {gid!r} is not a GHSA id with an object value")
        continue
    reason = entry.get("reason", "")
    if not isinstance(entry.get("package"), str) or not isinstance(reason, str) or len(reason) < MIN_REASON:
        findings.append(f"accepted list: {gid} needs a package and a reason of {MIN_REASON}+ characters")
        continue
    try:
        expires = datetime.date.fromisoformat(entry.get("expires", ""))
    except (TypeError, ValueError):
        findings.append(f"accepted list: {gid} needs an ISO expiry date (YYYY-MM-DD)")
        continue
    valid[gid] = expires

SEVERE = ("high", "critical")
vulnerabilities = report["vulnerabilities"]


def root_advisories(name: str, seen: set[str]) -> dict[str, str]:
    """High/critical advisories reached from `name` through its `via` chain.

    A dict entry is an advisory; a string entry only points at another
    vulnerable package, whose own advisories are listed under its name.
    """
    if name in seen:
        return {}
    seen.add(name)
    found: dict[str, str] = {}
    vuln = vulnerabilities.get(name)
    if not isinstance(vuln, dict):
        return found
    for via in vuln.get("via", []):
        if isinstance(via, dict):
            if via.get("severity") in SEVERE:
                gid = str(via.get("url", "")).rsplit("/", 1)[-1]
                title = str(via.get("title", ""))[:90]
                found[gid] = f"{via.get('severity')} {via.get('name', name)}: {title}"
        elif isinstance(via, str):
            found.update(root_advisories(via, seen))
    return found


reported: dict[str, str] = {}
for name, vuln in vulnerabilities.items():
    if not isinstance(vuln, dict) or vuln.get("severity") not in SEVERE:
        continue
    roots = root_advisories(name, set())
    if not roots:
        # A severe package whose chain reaches no severe advisory: the report
        # does not explain itself, so it cannot be judged green (JOURNAL J-050).
        findings.append(f"{name}: {vuln.get('severity')} with no traceable advisory in the report")
    reported.update(roots)

accepted_now = []
for gid, label in sorted(reported.items()):
    if gid not in valid:
        findings.append(f"{gid} {label}")
    elif valid[gid] < today:
        findings.append(f"{gid} accepted until {valid[gid]}, expired: decide again ({label})")
    else:
        accepted_now.append(f"{gid} until {valid[gid]}")

for gid in sorted(set(valid) - set(reported)):
    print(f"  stale: {gid} is accepted but no longer reported; remove it at the next harness session")
if accepted_now:
    print(f"  accepted ({len(accepted_now)}): " + ", ".join(accepted_now))

if findings:
    print("✖ Unaccepted runtime advisories (high and above):")
    for finding in findings:
        print(f"  - {finding}")
    print()
    print("Fix: `npm audit fix` (never --force) in a dedicated branch, then a native rebuild.")
    print("No fix on this React Native line: Cedric decides whether to accept it by GHSA id in")
    print("scripts/audit-accepted.json (reason + expiry), or to upgrade (JOURNAL J-040).")
    sys.exit(1)
sys.exit(0)
