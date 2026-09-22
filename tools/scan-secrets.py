#!/usr/bin/env python3
"""Fail the CI job when tracked text contains a high-confidence secret."""

from __future__ import annotations

import re
import sys
from pathlib import Path


EXCLUDED_DIRECTORIES = {".git", ".expo", "node_modules", "coverage", "dist", "android", "ios"}
EXCLUDED_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".zip", ".apk", ".aab"}
PATTERNS = {
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "github_token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    "aws_access_key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "public_secret_name": re.compile(r"EXPO_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|ACCESS_TOKEN)\s*="),
}


def main() -> int:
    hits: list[str] = []
    for path in Path.cwd().rglob("*"):
        if not path.is_file() or any(part in EXCLUDED_DIRECTORIES for part in path.parts):
            continue
        if path.name == ".env.example" or path.suffix.lower() in EXCLUDED_SUFFIXES:
            continue
        try:
            contents = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for name, pattern in PATTERNS.items():
            if pattern.search(contents):
                hits.append(f"{path.relative_to(Path.cwd())}:{name}")

    if hits:
        print("Potential secrets found:", *hits, sep="\n- ", file=sys.stderr)
        return 1
    print("Secret scan passed: no high-confidence secrets found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
