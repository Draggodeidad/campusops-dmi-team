import json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[3]
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
p=json.loads((root/'evidence/week-09/individual.json').read_text());observed=[]
for m in p['members']:
 commits=[]
 for sha in m['commitShas']:
  author,email=git('show','-s','--format=%an%n%ae',sha).splitlines()
  assert author==m['githubLogin'], (m['githubLogin'],sha,author)
  assert subprocess.run(['git','merge-base','--is-ancestor',sha,'HEAD'],cwd=root).returncode==0
  commits.append(dict(sha=sha,authorGithubLogin=author))
 assert all((root/f).is_file() for f in m['files'])
 ownfiles=set()
 for sha in m['commitShas']:
  ownfiles.update(git('diff-tree','--no-commit-id','--name-only','-r',sha).splitlines())
 overlap=sorted(set(m['files'])&ownfiles)
 assert overlap,(m['githubLogin'],'No own changed file')
 observed.append(dict(githubLogin=m['githubLogin'],commits=commits,declaredFilesExist=True,ownChangedFiles=overlap,signal='tests' if m['tests'] else 'documentary_review'))
assert len(p['members'])==3
print(json.dumps(dict(status='pass',commitSha=git('rev-parse','HEAD'),members=observed,limits='Authors and reachable changed files corroborated with Git, not proof of personal command execution or a new human review.'),ensure_ascii=False,indent=2))
