import importlib.util, json, os, subprocess, tempfile, unittest
from unittest.mock import patch
from io import StringIO
from pathlib import Path
SCRIPT=Path(__file__).with_name('impact.py').resolve()
spec=importlib.util.spec_from_file_location('impact',SCRIPT)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def change(path, old='a', new='b', status='M'):return (status,path,old,new)
class Selection(unittest.TestCase):
 def test_unknown_and_deleted(self):
  for p in ['package-lock.json','.github/workflows/ci.yml','.github/ci/impact.py','packages/core/src/store.ts','src/auth.ts','README.md']:
   self.assertEqual(m.classify('Surveyor',[change(p)]),'full')
  self.assertEqual(m.classify('Surveyor',[change('packages/ui/src/styles.css',status='D')]),'full')
  self.assertEqual(m.classify('Surveyor',[]),'full')
 def test_css_and_transitive_change(self):
  css=change('packages/ui/src/styles.css')
  self.assertEqual(m.classify('Surveyor',[css]),'visual')
  self.assertEqual(m.classify('Surveyor',[css,change('packages/core/src/store.ts')]),'full')
 def test_layout_release(self):
  c=[change(next(iter(m.LAYOUT)),status='A'),change('package.json','{"version":"1","scripts":{"test":"a"}}','{"version":"2","scripts":{"test":"a"}}'),change('CHANGELOG.md')]
  self.assertEqual(m.classify('Surveyor',c),'layout')
  c[1]=change('package.json','{"version":"1","scripts":{"test":"a"}}','{"version":"2","scripts":{"test":"skip"}}')
  self.assertEqual(m.classify('Surveyor',c),'full')
 def test_main_import_is_narrow(self):
  old='boot();\n';new="import './analytics/surveyor-audience-layout.mjs';\nboot();\n"
  layout=change('hosts/cowork-vite/src/analytics/surveyor-audience-layout.css')
  self.assertEqual(m.classify('Surveyor',[layout,change('hosts/cowork-vite/src/main.tsx',old,new)]),'layout')
  self.assertEqual(m.classify('Surveyor',[layout,change('hosts/cowork-vite/src/main.tsx',old,new+'fetch("https://example.com");')]),'full')
 def test_configuration_changes(self):
  self.assertFalse(m.release_only('hosts/azure-static/config.js','"clientId":"a"','"clientId":"b"'))
  self.assertFalse(m.release_only('release.json','{"version":"1","tenant":"a"}','{"version":"2","tenant":"b"}'))
  self.assertFalse(m.release_only('package.json','broken','broken'))
 def test_verified_baseline(self):
  env={'GITHUB_WORKFLOW_REF':'ValorCloud/Surveyor/.github/workflows/ci.yml@refs/heads/main','GITHUB_REPOSITORY':'ValorCloud/Surveyor','GH_TOKEN':'synthetic-test-only'}
  with patch.dict(os.environ,env), patch.object(m,'urlopen',return_value=StringIO(json.dumps({'workflow_runs':[{'head_sha':'a'*40,'conclusion':'success'}]}))):
   self.assertTrue(m.verified_base('a'*40))
  with patch.dict(os.environ,env), patch.object(m,'urlopen',return_value=StringIO(json.dumps({'workflow_runs':[{'head_sha':'b'*40,'conclusion':'success'}]}))):
   self.assertFalse(m.verified_base('a'*40))
  with patch.dict(os.environ,env), patch.object(m,'urlopen',return_value=StringIO('{"workflow_runs":[]}')):
   self.assertFalse(m.verified_base('a'*40))
 def test_other_projects(self):
  self.assertEqual(m.classify('valorpro',[change('src/styles/glass.css')]),'visual')
  self.assertEqual(m.classify('casemaster-365',[change('application/hosting/index.html')]),'full')
  self.assertEqual(m.classify('casemaster-365',[change('application/hosting/casemaster-platform.css')]),'full')
  self.assertEqual(m.classify('casemaster-365',[change('application/hosting/assets/valor-audience.css')]),'visual')
  self.assertEqual(m.classify('Exorcist365',[change('app/index.html')]),'full')
  self.assertEqual(m.classify('services-by-valor',[change('infra/main.bicep')]),'infra')
  self.assertEqual(m.classify('services-by-valor',[change('infra/main.bicep'),change('server.mjs')]),'full')
  for repo in ['Vibe','Synapse','Surveyor','Exorcist365','apps-websites']:
   self.assertEqual(m.classify(repo,[change('AGENTS.md')]),'metadata')
 def test_real_git_range_and_missing_base(self):
  with tempfile.TemporaryDirectory() as temp:
   def git(*args):return subprocess.check_output(['git','-C',temp,*args],stderr=subprocess.DEVNULL).decode().strip()
   git('init','-q');git('config','user.name','Test');git('config','user.email','test@example.com')
   css=Path(temp)/'src/styles/glass.css';css.parent.mkdir(parents=True);css.write_text('a{}')
   git('add','.');git('commit','-qm','base');base=git('rev-parse','HEAD')
   css.write_text('a{color:red}');git('add','.');git('commit','-qm','style');head=git('rev-parse','HEAD')
   ep=Path(temp)/'event.json';out=Path(temp)/'output';summary=Path(temp)/'summary'
   env={**os.environ,'GITHUB_ACTIONS':'false','GITHUB_EVENT_NAME':'push','GITHUB_EVENT_PATH':str(ep),'GITHUB_OUTPUT':str(out),'GITHUB_STEP_SUMMARY':str(summary),'GITHUB_REPOSITORY':'ValorCloud/valorpro'}
   def run(event, name='push'):
    ep.write_text(json.dumps(event));out.write_text('');env['GITHUB_EVENT_NAME']=name
    subprocess.run(['python3',str(SCRIPT)],cwd=temp,env=env,check=True,stdout=subprocess.DEVNULL)
    return out.read_text().strip()
   self.assertEqual(run({'before':base,'after':head}),'profile=visual')
   self.assertEqual(run({'pull_request':{'base':{'sha':base},'head':{'sha':head}}},'pull_request'),'profile=visual')
   # Whole pushed range includes functional commit before final CSS commit.
   code=Path(temp)/'server.mjs';code.write_text('export default 1');git('add','server.mjs');git('commit','-qm','runtime');css.write_text('a{color:blue}');git('add',str(css));git('commit','-qm','style again');head2=git('rev-parse','HEAD')
   self.assertEqual(run({'before':base,'after':head2}),'profile=full')
   self.assertEqual(run({'before':'0'*40,'after':head}),'profile=full')
   self.assertEqual(run({},'workflow_dispatch'),'profile=full')
   self.assertEqual(run({'before':'f'*40,'after':head}),'profile=full')
if __name__=='__main__':unittest.main()
