"""Regenerate W08 indices from captured clean-source executions, without inventing SHAs."""
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[3]
out = root / 'reports/week-08/issue-52'
v = json.loads((out / 'validation.json').read_text())
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
assert v['commitSha'] == sha
assert not v['uncommittedSourceFiles'], 'Only a clean technical source is eligible'
changed = subprocess.check_output(['git', 'ls-files', '--modified', '--others', '--exclude-standard'], cwd=root, text=True).splitlines()
assert all(p.startswith(('reports/', 'evidence/')) for p in changed), changed
assert v['checks'] and all(c['exitCode'] == 0 for c in v['checks'])
required = {'setup', 'typecheck', 'lint', 'architecture-tests', 'architecture', 'session', 'session-readiness', 'persistence', 'sync', 'integration', 'week08-aggregate', 'feedback', 'verify-w08'}
assert required <= {c['id'] for c in v['checks']}
notice = 'Fresh reproduction of exact technical HEAD with no uncommitted source/document changes; all commands, cwd, times, exits and environment are recorded in reports/week-08/issue-52/validation.json. Only reports/evidence were being recorded. Precommit observations are archived separately and are not reused as current results. After PR merge, verify the actual main SHA and regenerate in an evidence-only PR if the HEAD/direct-parent rule no longer holds.'
report = json.loads((out / 'previous-migration-tests.json').read_text())
report.update(commitSha=sha, generatedAt=v['generatedAt'], checks=v['checks'], environment={k: v[k] for k in ('node', 'npm', 'NODE_OPTIONS', 'platform', 'cwd')}, executor=v['executor'], scope=notice, composition={'technicalShaEvaluated':sha, 'baseMainSha':'fb11b69f3617466712bbd67d0ef49f0592d3a357', 'branch':'fix/w08-post-merge-evidence-issue-52', 'sourceTreeClean':True, 'onlyEvidenceChangedDuringCapture':True}, moduleStatus='pass', deliveryStatus='incomplete', finalTagStatus='pending_final_tag', humanReview='pending')
report['pending'] += ['Owner authorized Draggodeidad <antonioimanol7@gmail.com> for these Git commits. Git author identity does not turn AI-assisted execution into personal student evidence.', 'After owner-approved merge, inspect actual main SHA; if report SHA is not HEAD or its permitted direct parent, rerun there and prepare a separate evidence-only PR. No tag or Classroom submission in this task.']
# Retain the scenario-to-source mapping, pointing to the new clean execution logs.
current = json.loads((root / 'reports/week-08/migration-tests.json').read_text())
if 'scenarioIndex' in current: report['scenarioIndex'] = current['scenarioIndex']
(root / 'reports/week-08/migration-tests.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
engineering = json.loads((out / 'previous-engineering.json').read_text())
engineering.update(commitSha=sha, generatedAt=v['generatedAt'], verification=[{'command':c['command'], 'result':f"{c['status']}; exit {c['exitCode']}", 'evidence':c['evidence']} for c in v['checks']], scope=notice, sourceTreeClean=True, deliveryStatus='incomplete', finalTagStatus='pending_final_tag', humanReview='pending')
(root / 'evidence/week-08/engineering.json').write_text(json.dumps(engineering, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'commitSha':sha, 'sourceTreeClean':True, 'observations':len(v['checks']), 'deliveryStatus':'incomplete', 'finalTagStatus':'pending_final_tag'}))
