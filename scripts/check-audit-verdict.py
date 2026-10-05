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
    text = raw if report is None else json.dumps(report.get("error"))
    if any(marker in text for marker in NETWORK_MARKERS):
        print("npm registry unreachable")
        sys.exit(3)
    print("✖ npm audit gave no usable report:")
    print(text[:2000])
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

reported: dict[str, str] = {}
for name, vuln in report.get("vulnerabilities", {}).items():
    for via in vuln.get("via", []):
        # String entries only point at another vulnerable package: the root
        # advisory is listed (as a dict) under that package itself.
        if not isinstance(via, dict) or via.get("severity") not in ("high", "critical"):
            continue
        gid = str(via.get("url", "")).rsplit("/", 1)[-1]
        reported[gid] = f"{via.get('severity')} {via.get('name', name)}: {str(via.get('title', ''))[:90]}"

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
