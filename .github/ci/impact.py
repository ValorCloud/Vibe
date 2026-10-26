"""Conservative CI impact selection. Unknown changes always retain the full suite."""
import json, os, re, subprocess
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode, quote

METADATA = {"AGENTS.md", "docs/CI-IMPACT.md", "docs/REPRISE.md", "PROJECT_STATE.md", "CONTINUITY.md", "docs/DEVELOPER-HANDOFF.md"}
LAYOUT = {"hosts/cowork-vite/src/analytics/surveyor-audience-layout.css", "hosts/cowork-vite/src/analytics/surveyor-audience-layout.mjs", "hosts/cowork-vite/tests/audience-layout.test.mjs", "tests/browser/audience-layout.spec.mjs"}
MANIFESTS = {"package.json", "hosts/cowork-vite/package.json", "packages/core/package.json", "packages/ui/package.json", "packages/data-contracts/package.json"}
CSS = {
 "Surveyor": ("packages/ui/src/", "packages/valor-ui/src/", "hosts/cowork-vite/src/"),
 "Exorcist365": ("app/",),
 "casemaster-365": ("application/hosting/assets/valor-audience.css",),
 "valorpro": ("src/styles/",),
 "Vibe": ("src/",),
}

def git(*args):
 return subprocess.check_output(["git", *args], stderr=subprocess.PIPE).decode("utf-8")

def release_only(path, old, new):
 try:
  if path in MANIFESTS or path == "release.json":
   a, b = json.loads(old), json.loads(new)
   for key in (["version"] if path in MANIFESTS else ["version", "releaseId"]):
    a.pop(key, None); b.pop(key, None)
   return a == b
  if path == "packages/data-contracts/src/release.ts":
   strip=lambda s: re.sub(r'"(?:version|releaseId)":\s*"[^"\n]*"', '', s)
   return strip(old) == strip(new)
  if path == "hosts/azure-static/config.js":
   strip=lambda s: re.sub(r'^/\* Surveyor[^\n]*|"(?:version|releaseId)":\s*"[^"\n]*"', '', s)
   return strip(old) == strip(new)
  if path == "hosts/cowork-vite/src/main.tsx":
   strip=lambda s: '\n'.join(l for l in s.splitlines() if l.strip() and l not in ["import './analytics/surveyor-audience-layout.mjs';", "import './analytics/surveyor-audience-layout.css';"])
   return strip(old) == strip(new)
 except (ValueError, TypeError):
  pass
 return False

def classify(repo, changes):
 # changes = [(status, path, old text, new text)]. Renames become delete+add.
 if not changes: return "full"
 kinds=[]
 for status, path, old, new in changes:
  if status != "M" and not (repo == "Surveyor" and status == "A" and path in LAYOUT): return "full"
  if path in METADATA: kinds.append("metadata"); continue
  if repo == "Surveyor":
   if path in LAYOUT: kinds.append("layout"); continue
   if release_only(path, old, new): kinds.append("release"); continue
   # Build regenerates these, and CI requires exact agreement afterwards.
   if path in {"CHANGELOG.md", "docs/BUILD-STATUS.json", "packages/ui/src/release-history.json"}: kinds.append("release"); continue
  if path.endswith(".css") and any(path.startswith(p) for p in CSS.get(repo, ())): kinds.append("visual"); continue
  if repo == "services-by-valor" and path.startswith("infra/"): kinds.append("infra"); continue
  return "full"
 if all(k == "metadata" for k in kinds): return "metadata"
 if repo == "Surveyor" and "layout" in kinds and set(kinds) <= {"layout", "release", "metadata"}: return "layout"
 if "visual" in kinds and set(kinds) <= {"visual", "release", "metadata"}: return "visual"
 if "infra" in kinds and set(kinds) <= {"infra", "metadata"}: return "infra"
 return "full"

def verified_base(base):
 """Never skip coverage on top of an unverified/failed predecessor."""
 workflow=os.environ["GITHUB_WORKFLOW_REF"].split("/.github/workflows/",1)[1].split("@",1)[0]
 query=urlencode({"head_sha":base,"status":"success","per_page":1})
 url=f'{os.environ.get("GITHUB_API_URL", "https://api.github.com")}/repos/{os.environ["GITHUB_REPOSITORY"]}/actions/workflows/{quote(workflow, safe="")}/runs?{query}'
 request=Request(url,headers={"Authorization":"Bearer "+os.environ["GH_TOKEN"],"Accept":"application/vnd.github+json"})
 with urlopen(request,timeout=15) as response:
  runs=json.load(response).get("workflow_runs",[])
 return any(r.get("head_sha")==base and r.get("conclusion")=="success" for r in runs)

def main():
 profile="full"; reason="manual, missing base or unclassified change"; changed=[]
 try:
  event=json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
  name=os.environ.get("GITHUB_EVENT_NAME", "")
  if name == "pull_request":
   base=event["pull_request"]["base"]["sha"]
   head=event["pull_request"]["head"]["sha"]
   base=git("merge-base", base, head).strip()
  elif name == "push":
   base=event["before"]; head=event["after"]
  else: raise ValueError("Full verification explicitly requested")
  if not all(re.fullmatch(r"[a-f0-9]{40}", x) and set(x)!={"0"} for x in [base,head]): raise ValueError("Invalid comparison")
  fields=git("diff", "--no-renames", "--name-status", "-z", base, head).split("\0")
  for i in range(0,len(fields)-1,2):
   status,path=fields[i:i+2]
   old=git("show", f"{base}:{path}") if status != "A" else ""
   new=git("show", f"{head}:{path}") if status != "D" else ""
   changed.append((status,path,old,new))
  profile=classify(os.environ["GITHUB_REPOSITORY"].split("/")[-1],changed)
  reason=f"{len(changed)} changed files; {base[:12]}..{head[:12]}"
  if profile != "full" and os.environ.get("GITHUB_ACTIONS") == "true":
   if not verified_base(base):
    profile="full";reason+="; predecessor not verified by this workflow"
 except (KeyError, ValueError, OSError, subprocess.CalledProcessError, UnicodeError) as error:
  reason=f"Full fallback: {type(error).__name__}"
 print(json.dumps({"profile":profile,"reason":reason}))
 if os.environ.get("GITHUB_OUTPUT"):
  with open(os.environ["GITHUB_OUTPUT"],"a") as f: f.write(f"profile={profile}\n")
 if os.environ.get("GITHUB_STEP_SUMMARY"):
  with open(os.environ["GITHUB_STEP_SUMMARY"],"a") as f: f.write(f"### CI impact\nProfile: **{profile}**. {reason}.\nUnknown paths, deleted files and manual runs use the full suite.\n")

if __name__ == "__main__": main()
