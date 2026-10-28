#!/usr/bin/env python3
"""Read-only provenance audit; the team scope always uses the unchanged official validator."""
import argparse
import hashlib
import json
import re
import runpy
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TARGET = ROOT / 'evidence/week-09/individual.json'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def source(ref, path):
    return json.loads(git('show', f'{ref}:{path}'))


def audit_owner():
    data = json.loads(TARGET.read_text())
    assert data['schemaVersion'] == 1 and data['week'] == 9
    assert len(data['members']) == 1
    member = data['members'][0]
    required = {'studentId', 'commitShas', 'files', 'tests', 'reviews', 'prediction', 'command', 'observedResult', 'explanation'}
    assert required.issubset(member) and member['githubLogin'] == 'Draggodeidad'
    assert member['commitShas'] and member['files'] and (member['tests'] or member['reviews'])
    assert all(isinstance(member[key], str) and len(member[key].strip()) >= 8
               for key in ['prediction', 'command', 'observedResult', 'explanation'])
    identity = data['identitySource']
    for path in [identity['path'], *identity['corroboratedWith']]:
        old = source(identity['sourceCommit'], path)
        old_owner = next(m for m in old['members'] if m.get('githubLogin') == 'Draggodeidad')
        assert old['teamId'] == data['teamId'] and old_owner['studentId'] == member['studentId']
    previous = source(identity['sourceCommit'], identity['path'])
    previous_owner = next(m for m in previous['members'] if m.get('githubLogin') == 'Draggodeidad')
    expected_owner = git('show', '-s', '--format=%an <%ae>', previous_owner['commitShas'][0])
    assert expected_owner.startswith('Draggodeidad <')
    touched = set()
    for sha in member['commitShas']:
        assert re.fullmatch(r'[0-9a-f]{40}', sha)
        assert git('show', '-s', '--format=%an <%ae>', sha) == expected_owner
        assert git('show', '-s', '--format=%cn <%ce>', sha) == expected_owner
        touched.update(git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).splitlines())
    assert set(member['files']).issubset(touched)
    for item in member['verification']:
        index = source(item['artifactCommitSha'], item['sourceIndex'])
        assert item['commitSha'] == index['commitSha']
        assert git('rev-parse', item['artifactCommitSha'] + '^') == item['commitSha']
        changes = git('diff-tree', '--no-commit-id', '--name-only', '-r', item['artifactCommitSha']).splitlines()
        assert all(path.startswith(('reports/', 'evidence/')) for path in changes)
        check = next(c for c in index['checks'] if c['id'] == item['checkId'])
        assert all(item[key] == check[key] for key in ['command', 'status', 'exitCode', 'evidence'])
        if check.get('repetitions'):
            count = check['repetitions']
            match = re.fullmatch(r'(reports/week-09/integration-order/native-repeat-)1\.log through native-repeat-(\d+)\.log', item['evidence'])
            assert match and isinstance(count, int) and 1 <= count <= 100 and int(match[2]) == count
            for repetition in range(1, count + 1):
                path = f'{match[1]}{repetition}.log'
                observation = source(item['artifactCommitSha'], path)
                assert observation['commitSha'] == item['commitSha'] and observation['sourceTreeDirty'] is False
                assert all(result['status'] == 'pass' for result in observation['checks'])
        else:
            git('cat-file', '-e', f"{item['artifactCommitSha']}:{item['evidence']}")
    approval = member['humanValidation']
    assert approval['status'] == 'approved_by_owner'
    assert approval['source'] == 'explicit_user_statement_in_this_Codex_chat'
    assert {item['issue'] for item in approval['scope']} == {61, 62}
    assert data['status'] == 'pending_team_evidence'
    assert len(data['pendingContributors']) == 2
    assert {p['githubLogin'] for p in data['pendingContributors']} == {'osbaldoXxC', 'JulianDele'}
    assert all(p['status'] == 'pending_own_evidence' and 'studentId' not in p for p in data['pendingContributors'])
    return {'scope': 'owner', 'passed': True, 'membersRecorded': len(data['members']),
            'ownCommitsVerified': len(member['commitShas']), 'technicalFilesVerified': len(member['files']),
            'historicalChecksMatched': len(member['verification']), 'humanApprovalSourceRecorded': approval['source'],
            'pendingContributors': len(data['pendingContributors']),
            'recordSha256': hashlib.sha256(TARGET.read_bytes()).hexdigest(),
            'limits': 'Audit of existing Git artifacts and recorded approval; no implementation tests or human actions are rerun.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scope', choices=['owner', 'team'], required=True)
    args = parser.parse_args()
    if args.scope == 'team':
        validator = runpy.run_path(str(ROOT / 'tools/course_public_evaluator.py'))['validate_individual']
        passed, detail = validator(TARGET, 9)
        print(json.dumps({'scope': 'team', 'passed': passed, 'detail': detail}, ensure_ascii=False))
        return 0 if passed else 1
    print(json.dumps(audit_owner(), ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
