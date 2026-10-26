"""Inspect attribution and synchronization of records; does not certify AC-05."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[3]

def git(*args):
    return subprocess.check_output(['git', *args], cwd=root, text=True).strip()

team = json.loads((root / 'evidence/week-08/individual.json').read_text())
aux = json.loads((root / 'evidence/week-08/individual.osbaldoxxc.json').read_text())
original = json.loads(git('show', '39da4e35edc6eb588f91b777bbe48f2e57937132:evidence/week-08/individual.json'))
assert team['members'][1] == aux['members'][0]
assert team['members'][0] == original['members'][0]
assert team['members'][2] == original['members'][2]
print('Auxiliary and consolidated Osbaldo records equal; other two records unchanged.')
for sha, path in zip(team['members'][1]['commitShas'], team['members'][1]['files']):
    author = git('show', '-s', '--format=%an', sha)
    paths = git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).splitlines()
    assert author == 'osbaldoXxC' and path in paths
    print(json.dumps({'sha': sha, 'author': author, 'files': paths}))
print('Julian candidate:', git('show', '-s', '--format=%H %an %s', 'd7f388c8e2bd467e755048ea3be94710e0385bee'))
print('Candidate wrongly references:', git('show', '-s', '--format=%H %an %s', 'f3bb0c9f5dfb86cf4987c207ecc08349597804e8'))
assert team['members'][2]['studentId'] == ''
print('Third record remains pending; no personal prediction/explanation invented.')
print('Scope: attribution and record equality only; original local logs and human corroboration remain pending.')
