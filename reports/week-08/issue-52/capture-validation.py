import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import time

repo = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)
env = os.environ.copy()
env.update(PATH='/home/dragodeidad/.nvm/versions/node/v22.22.0/bin:' + env['PATH'], NODE_OPTIONS='--experimental-sqlite', CI='1', NO_COLOR='1')
def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo, text=True)
sha = git('rev-parse', 'HEAD').strip()
source_files = [p for p in git('ls-files', '--modified', '--others', '--exclude-standard').splitlines() if not p.startswith(('reports/', 'evidence/'))]
source_snapshot = {p: hashlib.sha256((repo / p).read_bytes()).hexdigest() if (repo / p).is_file() else 'deleted' for p in source_files}
context = {'schemaVersion': 1, 'week': 8, 'commitSha': sha, 'cwd': str(repo), 'node': subprocess.check_output(['node', '-v'],env=env,text=True).strip(), 'npm': subprocess.check_output(['npm', '-v'],env=env,text=True).strip(), 'NODE_OPTIONS':env['NODE_OPTIONS'], 'platform':platform.platform(), 'executor':'Codex technical reproduction requested by owner; no personal execution attributed to any student', 'uncommittedSourceFiles':source_snapshot, 'deliveryStatus':'incomplete', 'humanReview':'pending', 'finalTagStatus':'pending_final_tag'}
assert context['node'] == 'v22.22.0', context['node']
commands = [
('setup', ['make','setup'], 'nominal'),
('typecheck',['npm','run','typecheck'], 'nominal'),
('lint',['npm','run','lint'], 'nominal'),
('smoke',['npm','run','test:smoke'], 'nominal'),
('incidents',['npm','run','test:incidents'], 'nominal'),
('architecture-tests',['npm','run','test:architecture'], 'boundary'),
('architecture',['npm','run','check:architecture'], 'boundary'),
('session',['npm','run','test:week-06'], 'failure'),
('session-readiness',['npm','run','check:week-06-readiness'], 'failure'),
('persistence',['npm','run','test:week-08:persistence'], 'failure'),
('sync',['npm','run','test:week-08:sync'], 'boundary'),
('integration',['npm','run','test:week-08:integration'], 'failure'),
('week08-aggregate',['npm','run','test:week-08'], 'failure'),
('feedback',['make','feedback'], 'nominal'),
('verify-w08',['make','verify-week-08'], 'nominal'),
('individual-contract',['python3','reports/week-08/pr56-review/validate-individual.py'], 'boundary'),
('provenance-audit',['python3','reports/week-08/pr56-review/audit.py'], 'boundary'),
('protected-files',['git','diff','--exit-code','749b171b1c57a6215810dca5da376b0f288bd732','--','src','App.tsx','course-tests','.github/workflows','Makefile','tools/course_public_evaluator.py','docs/EVIDENCE_CONTRACT.md','docs/SUBMISSION.md','docs/assignments','package.json','package-lock.json'], 'boundary'),
('patch-hygiene',['git','diff','--check'], 'boundary'),
('public-w08',['make','public-test-week-08'], 'boundary')]
checks=[]
for identifier, command, scenario in commands:
    if git('rev-parse','HEAD').strip() != sha:
        raise RuntimeError('HEAD changed while capturing; do not mix SHAs')
    if identifier == 'public-w08':
        subprocess.run(['python3','reports/week-08/issue-52/regenerate-observed.py'],cwd=repo,check=True)
    started=dt.datetime.now(dt.timezone.utc).isoformat(); t=time.monotonic()
    with (out / (identifier+'.log')).open('w') as log:
        log.write(json.dumps({'command':command,'startedAt':started, **context},ensure_ascii=False)+'\n'); log.flush()
        result=subprocess.run(command,cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT)
        elapsed=round(time.monotonic()-t,3)
        log.write('\n'+json.dumps({'exitCode':result.returncode,'durationSeconds':elapsed})+'\n')
    output=(out / (identifier+'.log')).read_text()
    counts=re.findall(r'Tests:\s+(\d+) passed,\s+(\d+) total',output)
    observation={'id':identifier,'status':'pass' if result.returncode==0 else 'fail','scenarioType':scenario,'command':' '.join(command),'commandArgs':command,'startedAt':started,'exitCode':result.returncode,'durationSeconds':elapsed,'jestPassedTotal':counts,'evidence':f'reports/week-08/issue-52/{identifier}.log; exit {result.returncode}; Jest passed/total per invocation={counts}'}
    checks.append(observation)
    (out / 'validation.json').write_text(json.dumps({**context,'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'checks':checks},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(observation,ensure_ascii=False),flush=True)
current={p: hashlib.sha256((repo / p).read_bytes()).hexdigest() if (repo / p).is_file() else 'deleted' for p in source_files}
assert current == source_snapshot, 'Source files changed during execution'
sys.exit(0 if all(c['exitCode']==0 for c in checks) else 1)
