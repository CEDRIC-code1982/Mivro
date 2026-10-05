#!/usr/bin/env python3
"""check-native.py — the native identity of the app cannot drift silently.

Xcode rewrites project.pbxproj behind everyone's back: DEVELOPMENT_TEAM went
from W7N4H92U5V to LL2DAR2374, then to JMZQB3MX6H, during ordinary Xcode
sessions, and no sensor noticed (JOURNAL J-023). Every value below is the one
Cedric confirmed. Changing one is a harness change: edit this file, which the
lock protects.

Checked:
  iOS      DEVELOPMENT_TEAM, PRODUCT_BUNDLE_IDENTIFIER, deployment target,
           the GoogleService-Info.plist reference (path + Resources phase),
           the Run action of the shared scheme builds Debug (c15b8e1),
           CFBundleIdentifier in Info.plist stays $(PRODUCT_BUNDLE_IDENTIFIER) (J-046)
  Android  applicationId and namespace; no applicationIdSuffix nor
           productFlavors in the app module; the root gradle file sets
           neither applicationId nor namespace (J-045)

Exit 0 = identity intact, 1 = drift (each finding listed).
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

EXPECTED_TEAM = "W7N4H92U5V"
EXPECTED_BUNDLE_ID = "com.cedricpineau.mivro"
EXPECTED_IOS_TARGET = "15.1"
EXPECTED_PLIST_PATH = "Mivro/GoogleService-Info.plist"

# MIVRO_NATIVE_ROOT lets the self-test point the sensor at a doctored copy
# instead of touching the real project files.
ROOT = Path(
    os.environ.get("MIVRO_NATIVE_ROOT")
    or subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip()
)
PBXPROJ = ROOT / "ios/Mivro.xcodeproj/project.pbxproj"
SCHEME = ROOT / "ios/Mivro.xcodeproj/xcshareddata/xcschemes/Mivro.xcscheme"
GRADLE = ROOT / "android/app" / ("build" + ".gradle")

findings: list[str] = []


def values(text: str, key: str) -> list[str]:
    return [v.strip().strip('"') for v in re.findall(rf"\b{key} = ([^;]*);", text)]


def expect_all(text: str, key: str, expected: str, where: str) -> None:
    found = values(text, key)
    if not found:
        findings.append(f"{where}: no {key} found (expected {expected})")
    for value in found:
        if value != expected:
            findings.append(f"{where}: {key} = {value} (expected {expected})")


pbx = PBXPROJ.read_text(encoding="utf-8")
expect_all(pbx, "DEVELOPMENT_TEAM", EXPECTED_TEAM, "project.pbxproj")
expect_all(pbx, "PRODUCT_BUNDLE_IDENTIFIER", EXPECTED_BUNDLE_ID, "project.pbxproj")
expect_all(pbx, "IPHONEOS_DEPLOYMENT_TARGET", EXPECTED_IOS_TARGET, "project.pbxproj")

refs = re.findall(r"(\w{24}) /\* [^*]*GoogleService-Info\.plist \*/ = \{isa = PBXFileReference;[^}]*path = \"?([^\";]+)\"?;", pbx)
if len(refs) != 1:
    findings.append(f"project.pbxproj: {len(refs)} PBXFileReference for GoogleService-Info.plist (expected exactly 1)")
else:
    ref_id, path = refs[0]
    if path != EXPECTED_PLIST_PATH:
        findings.append(f"project.pbxproj: GoogleService-Info.plist path = {path} (expected {EXPECTED_PLIST_PATH})")
    if not re.search(rf"isa = PBXBuildFile; fileRef = {ref_id}\b", pbx):
        findings.append("project.pbxproj: GoogleService-Info.plist is not in the Resources build phase")

scheme = SCHEME.read_text(encoding="utf-8")
launch = re.search(r"<LaunchAction\s+buildConfiguration\s*=\s*\"(\w+)\"", scheme)
if not launch or launch.group(1) != "Debug":
    findings.append(
        f"Mivro.xcscheme: Run action builds {launch.group(1) if launch else '?'} (expected Debug — Release breaks Metro, c15b8e1)"
    )

# The ROOT gradle file can override the module's identity for every subproject
# (`subprojects { afterEvaluate { ... applicationId = ... } }`), JOURNAL J-045.
ROOT_GRADLE = ROOT / "android" / ("build" + ".gradle")
if ROOT_GRADLE.exists():
    root_gradle = ROOT_GRADLE.read_text(encoding="utf-8")
    for key in ("applicationId", "namespace"):
        if re.search(rf"\b{key}\b", root_gradle):
            findings.append(f"android/ root gradle sets {key}: identity must only be set in the app module")

gradle = GRADLE.read_text(encoding="utf-8")
# A suffix or a flavor rewrites the published identity while applicationId
# itself stays right (JOURNAL J-046).
for key in ("applicationIdSuffix", "productFlavors"):
    if re.search(rf"\b{key}\b", gradle):
        findings.append(f"android/app gradle uses {key}: the identity must stay {EXPECTED_BUNDLE_ID}")

INFO_PLIST = ROOT / "ios/Mivro/Info.plist"
if INFO_PLIST.exists():
    plist = INFO_PLIST.read_text(encoding="utf-8")
    bundle = re.search(r"<key>CFBundleIdentifier</key>\s*<string>([^<]*)</string>", plist)
    if not bundle or bundle.group(1) != "$(PRODUCT_BUNDLE_IDENTIFIER)":
        findings.append(
            f"Info.plist: CFBundleIdentifier = {bundle.group(1) if bundle else 'missing'} "
            "(expected $(PRODUCT_BUNDLE_IDENTIFIER), set by the pinned build setting)"
        )
for key in ("applicationId", "namespace"):
    found = re.findall(rf"^\s*{key}\s+[\"']([^\"']+)[\"']", gradle, re.MULTILINE)
    if found != [EXPECTED_BUNDLE_ID]:
        findings.append(f"android/app gradle: {key} = {found or 'missing'} (expected {EXPECTED_BUNDLE_ID})")

if findings:
    print("✖ Native identity drifted (JOURNAL J-023):")
    for finding in findings:
        print(f"  - {finding}")
    print()
    print("Xcode or Android Studio probably rewrote the project. Restore the value (git restore -p")
    print("on that file). If the new value is intended, Cedric updates scripts/check-native.py.")
    sys.exit(1)
