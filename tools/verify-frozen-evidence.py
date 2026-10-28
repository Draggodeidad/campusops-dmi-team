#!/usr/bin/env python3
"""Validate historical frozen evidence at its own immutable tag, not at a new HEAD."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def verify(repo: Path, week: int) -> None:
    tag = f"week-{week:02d}-final"
    kind = subprocess.check_output(["git", "cat-file", "-t", tag], cwd=repo, text=True).strip()
    if kind != "tag":
        raise ValueError("Frozen delivery must have an annotated tag")
    sha = subprocess.check_output(["git", "rev-parse", f"{tag}^{{commit}}"], cwd=repo, text=True).strip()
    with tempfile.TemporaryDirectory(prefix="campusops-frozen-") as directory:
        checkout = Path(directory) / "repo"
        subprocess.run(["git", "clone", "--quiet", "--shared", "--no-checkout", str(repo), str(checkout)], check=True)
        subprocess.run(["git", "checkout", "--quiet", "--detach", sha], cwd=checkout, check=True)
        subprocess.run([sys.executable, str(repo / "tools/course_public_evaluator.py"), "--repo", str(checkout), "--week", str(week), "--mode", "evidence"], check=True)
        output = repo / "reports" / f"week-{week:02d}" / "generated-frozen-evidence"
        output.mkdir(parents=True, exist_ok=True)
        shutil.copy2(checkout / "reports" / f"week-{week:02d}" / "failure.json", output / "failure.json")
        (output / "provenance.json").write_text(json.dumps({"tag": tag, "evaluatedCommitSha": sha, "scope": "Frozen historical evidence, evaluated unchanged in disposable checkout"}, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--week", type=int, required=True, choices=(1, 2, 3, 4, 5, 6, 8))
    args = parser.parse_args()
    try:
        verify(Path.cwd(), args.week)
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f"Frozen evidence verification failed: {error}", file=sys.stderr)
        raise SystemExit(1)
