#!/usr/bin/env python3
"""Fail if anything that ships to the browser looks like a secret.

Everything in this repository except .env is published: GitHub Pages serves the
files as they are committed. A key that reaches a committed file reaches every
visitor, so this check is the last line of defence before that happens.

    python3 tools/check-secrets.py

Exits non-zero on a finding, so it works as a CI step or a pre-commit hook.
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Directories and files that never ship, or that legitimately name a variable.
SKIP_DIRS = {".git", "node_modules", ".github"}
SKIP_FILES = {".env", ".env.example", "check-secrets.py"}
SCAN_SUFFIXES = {".html", ".js", ".css", ".json", ".md", ".yml", ".yaml", ".xml", ".txt"}

PATTERNS = [
    ("UUID-style API key",
     re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)),
    ("Authorization header with a literal value",
     re.compile(r"""["']?Authorization["']?\s*[:=]\s*["'][^"'{$][^"']{8,}["']""", re.I)),
    ("Assignment to a key-like name",
     re.compile(r"""\b(api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*["'][^"'{$][^"']{8,}["']""", re.I)),
    ("AWS access key id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
]

# A match is exempt only when the matched text itself is a reference to an
# environment variable, never merely because the surrounding line mentions one.
# Checking the whole line is what let a literal key slip through in testing:
# `window.BOTDOJO_API_KEY = "<uuid>"` mentions BOTDOJO_ and would be excused.
ENV_REFERENCE = re.compile(
    r"""(process\.env|os\.environ|ENV\[|env\.[A-Z_]|\$\{\{\s*secrets\.|\$\{?[A-Z_]+\}?$)""")

# Account, project and flow ids are not credentials. They identify the flow and
# are useless without the key, so they are allowed to appear.
NON_SECRET_IDS = set()
env_example = ROOT / ".env.example"
if env_example.exists():
    for line in env_example.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            name, value = line.split("=", 1)
            value = value.strip()
            if value and "KEY" not in name.upper():
                NON_SECRET_IDS.add(value)


def is_allowed(match_text):
    """Exempt only the flow identifiers and genuine env-var references."""
    if match_text in NON_SECRET_IDS:
        return True
    return bool(ENV_REFERENCE.search(match_text))


def scan():
    findings = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_FILES:
            continue
        if path.suffix.lower() not in SCAN_SUFFIXES:
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        for n, line in enumerate(text.splitlines(), 1):
            for label, rx in PATTERNS:
                for m in rx.finditer(line):
                    if is_allowed(m.group(0)):
                        continue
                    findings.append((path.relative_to(ROOT), n, label, m.group(0)[:60]))
    return findings


if __name__ == "__main__":
    found = scan()
    if not found:
        print("check-secrets: clean. Nothing secret-looking in any published file.")
        sys.exit(0)

    print("check-secrets: %d possible secret(s) in files that ship to the browser.\n" % len(found))
    for rel, line_no, label, snippet in found:
        print("  %s:%d" % (rel, line_no))
        print("      %s: %s" % (label, snippet))
    print("\nEverything committed here is served by GitHub Pages. Move the value to")
    print("the proxy host's environment variables and reference it by name.")
    sys.exit(1)
