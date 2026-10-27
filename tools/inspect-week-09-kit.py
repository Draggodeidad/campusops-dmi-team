#!/usr/bin/env python3
"""Compare all W09 ZIP entries with a fixed Git SHA before extracting outside the repo."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import subprocess
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--destination", required=True, type=Path)
    parser.add_argument("--ref", required=True)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    destination = args.destination.resolve()
    if destination == repo or repo in destination.parents or destination.exists():
        parser.error("destination must be a new directory outside the repository")
    actual = subprocess.check_output(["git", "rev-parse", args.ref], cwd=repo, text=True).strip()
    if actual != args.ref:
        parser.error("--ref must be a full Git SHA")
    entries = []
    with zipfile.ZipFile(args.archive) as archive:
        names = set()
        for member in archive.infolist():
            path = PurePosixPath(member.filename)
            if (path.is_absolute() or ".." in path.parts or "\\" in member.filename
                    or stat.S_ISLNK(member.external_attr >> 16) or member.filename in names):
                raise ValueError(f"Unsafe ZIP entry: {member.filename}")
            names.add(member.filename)
            data = archive.read(member)
            try:
                data.decode("utf-8")
                kind = "directory" if member.is_dir() else "text"
                if b"\x00" in data:
                    kind = "binary"
            except UnicodeDecodeError:
                kind = "binary"
            # This ZIP has root-relative paths, unlike the enclosing folder in W08.
            previous = subprocess.run(["git", "show", f"{args.ref}:{path}"], cwd=repo, capture_output=True)
            comparison = "new" if previous.returncode else "identical" if previous.stdout == data else "different"
            entries.append({"path": member.filename, "bytes": len(data), "kind": kind,
                            "sha256": hashlib.sha256(data).hexdigest(),
                            "comparisonAtBase": "not_applicable" if member.is_dir() else comparison})
        # Read and compare every entry before extracting. Never execute archive content.
        destination.mkdir(parents=True)
        archive.extractall(destination)
    result = {"archiveName": args.archive.name,
              "archiveSha256": hashlib.sha256(args.archive.read_bytes()).hexdigest(),
              "baseCommitSha": args.ref, "extractionDirectory": str(destination), "entries": entries}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
