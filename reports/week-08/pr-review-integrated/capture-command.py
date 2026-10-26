import subprocess,sys,os,datetime,json,time,pathlib,platform
repo,logpath,*command=sys.argv[1:]
env=os.environ.copy();env['PATH']='/home/dragodeidad/.nvm/versions/node/v22.22.0/bin:'+env['PATH'];env['NODE_OPTIONS']='--experimental-sqlite';env['CI']='1'
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
meta={'command':command,'cwd':repo,'commitSha':sha,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'node':subprocess.check_output(['node','--version'],env=env,text=True).strip(),'npm':subprocess.check_output(['npm','--version'],env=env,text=True).strip(),'NODE_OPTIONS':env['NODE_OPTIONS'],'platform':platform.platform(),'executor':'Codex reproduction at user request; not a personal execution by Osbaldo','workingTree':subprocess.check_output(['git','status','--short'],cwd=repo,text=True).strip()}
p=pathlib.Path(logpath);p.parent.mkdir(parents=True,exist_ok=True)
start=time.monotonic()
with p.open('w') as f:
 f.write(json.dumps(meta,ensure_ascii=False)+'\n');f.flush()
 r=subprocess.run(command,cwd=repo,env=env,stdout=f,stderr=subprocess.STDOUT)
 meta['exitCode']=r.returncode;meta['durationSeconds']=round(time.monotonic()-start,3)
 f.write('\n'+json.dumps({'exitCode':r.returncode,'durationSeconds':meta['durationSeconds']})+'\n')
p.with_suffix('.meta.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(meta,ensure_ascii=False))
sys.exit(r.returncode)
