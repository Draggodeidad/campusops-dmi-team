"""Keep byte-exact compressed stdout and readable copies without trailing blanks."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

out = Path(__file__).resolve().parent
repo = out.parents[2]
before = subprocess.run(['git', 'diff', '--cached', '--check'], cwd=repo, capture_output=True)
record = {'initialCheck': {'command': 'git diff --cached --check', 'exitCode': before.returncode}, 'normalization': 'Readable .log copies remove only spaces/tabs immediately before newline. Exact original command output is retained as .log.gz. No test result, assertion, check or status is changed.', 'files': []}
if before.returncode:
    p = out / 'staged-whitespace-before.log.gz'
    p.write_bytes(gzip.compress(before.stdout + before.stderr, mtime=0))
    record['initialCheck']['rawDiagnostics'] = str(p.relative_to(repo))
for path in sorted(out.rglob('*.log')):
    raw = path.read_bytes()
    lines = raw.splitlines(keepends=True)
    normalized = b''.join(line.rstrip(b'\r\n').rstrip(b' \t') + (b'\n' if line.endswith(b'\n') else b'') for line in lines)
    if normalized == raw: continue
    archive = path.with_suffix(path.suffix + '.gz')
    archive.write_bytes(gzip.compress(raw, mtime=0))
    assert gzip.decompress(archive.read_bytes()) == raw
    path.write_bytes(normalized)
    record['files'].append({'readable':str(path.relative_to(repo)), 'byteExactOriginal':str(archive.relative_to(repo)), 'rawSha256':hashlib.sha256(raw).hexdigest(), 'readableSha256':hashlib.sha256(normalized).hexdigest()})
(out / 'log-formatting.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n')
p = out / 'contract-checks.json'
data = json.loads(p.read_text())
data['logSha256'] = {name:hashlib.sha256((out / name).read_bytes()).hexdigest() for name in data['logSha256']}
data['rawLogArchives'] = [r for r in record['files'] if '/precommit/' not in r['readable']]
p.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'initialStagedWhitespaceCheckExit':before.returncode, 'rawOutputsPreserved':len(record['files']), 'onlyLogWhitespaceNormalized':True}))
