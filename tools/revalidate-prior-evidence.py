#!/usr/bin/env python3
"""Re-run prior-week controls and index new observations without rewriting Git history.

Only for continuous feedback. Final tags always use the unmodified evaluator.
Historical observations keep their original evaluatedCommitSha and a byte-for-byte
copy; they are never relabeled as tests executed against the new revision.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys

from course_public_evaluator import validate_engineering, validate_individual, validate_report

COMMANDS = {
    1: [("feedback", "nominal", ["make", "feedback"]),
        ("public-regression", "boundary", ["npm", "test", "--", "--ci", "--runInBand", "course-tests/public/week-01.test.ts"])],
    2: [("feedback", "nominal", ["make", "feedback"]),
        ("architecture-behavior", "failure", ["npm", "run", "test:architecture"]),
        ("architecture-imports", "boundary", ["npm", "run", "check:architecture"]),
        ("repository-substitution", "boundary", ["npm", "run", "test:incidents"]),
        ("public-regression", "nominal", ["npm", "test", "--", "--ci", "--runInBand", "course-tests/public/week-02.test.ts"])],
}


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=repo, text=True).strip()


def revalidate(repo: Path, week: int) -> None:
    key = f"week-{week:02d}"
    if os.environ.get("GITHUB_REF") == f"refs/tags/{key}-final":
        raise ValueError("Final evidence must be evaluated unchanged; revalidation is forbidden on its tag")
    # The runner must be evaluating committed code, including a PR merge commit.
    changes = subprocess.check_output(["git", "status", "--porcelain", "--untracked-files=all"], cwd=repo, text=True).splitlines()
    if any(not line[3:].startswith(("reports/", "evidence/")) for line in changes):
        raise ValueError("Commit code/configuration before revalidation")
    sha = git(repo, "rev-parse", "HEAD")
    report_name = "baseline.json" if week == 1 else "dependencies.json"
    report_path = repo / "reports" / key / report_name
    engineering_path = repo / "evidence" / key / "engineering.json"
    individual_path = repo / "evidence" / key / "individual.json"
    sources = []
    for path, validator in [(report_path, validate_report), (engineering_path, validate_engineering)]:
        raw = path.read_bytes()
        data = json.loads(raw)
        source_sha = data.get("commitSha", "")
        # Validate schema against its declared historical revision; independently
        # require that revision to exist in this checkout's ancestry.
        valid, detail = validator(repo, path, week, source_sha)
        if not valid:
            raise ValueError(f"{path}: {detail}")
        subprocess.run(["git", "merge-base", "--is-ancestor", source_sha, sha], cwd=repo, check=True)
        sources.append((path, raw, data))
    valid, detail = validate_individual(individual_path, week)
    if not valid:
        raise ValueError(detail)

    output = repo / "reports" / key / "generated-revalidation"
    output.mkdir(parents=True, exist_ok=True)
    for path, raw, _ in sources:
        (output / f"original-{path.name}").write_bytes(raw)
    (output / "original-individual.json").write_bytes(individual_path.read_bytes())
    observations = []
    for check_id, scenario, command in COMMANDS[week]:
        log = output / f"{check_id}.log"
        print(f"[{key}] {' '.join(command)}", flush=True)
        with log.open("w") as stream:
            result = subprocess.run(command, cwd=repo, stdout=stream, stderr=subprocess.STDOUT, timeout=600)
        print(log.read_text()[-3000:], flush=True)
        observations.append({"id": f"revalidation-{check_id}", "status": "pass" if result.returncode == 0 else "fail",
                             "scenarioType": scenario, "command": " ".join(command),
                             "evidence": f"exit {result.returncode}; {log.relative_to(repo)}",
                             "evaluatedCommitSha": sha})
        (output / "observations.json").write_text(json.dumps({"commitSha": sha, "checks": observations}, indent=2) + "\n")
        if result.returncode:
            raise subprocess.CalledProcessError(result.returncode, command)

    # Do not write either index until ALL checks succeeded. Retain the historical
    # observations with explicit provenance; append newly executed controls.
    for path, _, data in sources:
        source_sha = data["commitSha"]
        field = "checks" if path == report_path else "verification"
        for observation in data[field]:
            observation.setdefault("evaluatedCommitSha", source_sha)
        data["commitSha"] = sha
        data["revalidation"] = {"sourceCommitSha": source_sha, "evaluatedCommitSha": sha,
                                "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                                "original": str((output / f"original-{path.name}").relative_to(repo)),
                                "scope": "Continuous regression feedback; not a replacement for the frozen weekly submission"}
        if field == "checks":
            data["checks"].extend(observations)
            data["generatedAt"] = data["revalidation"]["generatedAt"]
        else:
            data["verification"].extend({"command": obs["command"], "result": "exit 0", "evidence": obs["evidence"],
                                         "evaluatedCommitSha": sha} for obs in observations)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--week", type=int, choices=(1, 2), required=True)
    args = parser.parse_args()
    try:
        revalidate(Path.cwd(), args.week)
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        print(f"Evidence revalidation failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
