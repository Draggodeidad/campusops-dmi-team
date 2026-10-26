import json
from pathlib import Path
import sys
root=Path(sys.argv[1]);scripts=json.loads((root/'package.json').read_text())['scripts']
workflow=(root/'.github/workflows/week-08-persistencia-sincronizacion-feedback.yml').read_text()
for kind, paths in [('persistence',['course-tests/week-08-workspace-owner.test.ts','course-tests/week-08-persistence.test.ts']),('sync',['course-tests/week-08-sync.test.ts','course-tests/week-08-sync-composition.test.ts','course-tests/week-08-sync-validation.test.ts'])]:
 key='test:week-08:'+kind
 assert '--runTestsByPath' in scripts[key]
 for path in paths: assert scripts[key].split().count(path)==1
 assert scripts['test:week-08'].split().count(key)==1
 assert workflow.count('npm run '+key)==1
 print(f'{key}: explicit paths {paths}; included once in aggregate and once in W08 workflow')
print('No workflow or owner/public suite changes; actual execution recorded separately in suite/aggregate logs.')
