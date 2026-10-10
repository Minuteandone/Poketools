#!/usr/bin/env python3
"""Index the original TGA animation sequences in BW resource/, including each historical snapshot.

Only metadata (paths + source Git blob identifiers) is published. No movie frames,
game ROMs, or copyrighted graphic binaries are copied into the website.
"""
import json,os,pathlib,re,time,urllib.parse,urllib.request,urllib.error
API="https://api.github.com/repos/e-minence/black_white"
OUTPUT=pathlib.Path(__file__).with_name("film-history.json")
FILMS=[
 ("op_demo","Opening sequence 1","resource/op_demo"),
 ("op_demo2","Opening sequence 2","resource/op_demo2"),
 ("gf_logo","Game Freak logo","resource/gf_logo"),
]
TOKEN=os.environ.get("GH_TOKEN","")
def api(url):
    headers={"User-Agent":"poketools-film-sequence-archaeology","Accept":"application/vnd.github+json"}
    if TOKEN:headers["Authorization"]="Bearer "+TOKEN
    for n in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=120) as r:return json.load(r)
        except Exception as ex:
            if n==4 or isinstance(ex,urllib.error.HTTPError) and ex.code in (401,403,404):raise
            print("RETRY",n,str(ex)[:120],flush=True)
            time.sleep(min(20,2**n))
def number(name):
    m=re.search(r"(\d+)\.tga$",name,re.I)
    return int(m.group(1)) if m else -1
def build():
    results=[]
    for ident,title,folder in FILMS:
        raw=api(API+"/commits?"+urllib.parse.urlencode({"path":folder,"per_page":100}))
        if not isinstance(raw,list):raise ValueError(f"History missing for {folder}")
        snapshots=[]
        for i,c in enumerate(reversed(raw),1):
            commit=c["sha"]
            children=api(API+"/contents/"+folder+"?"+urllib.parse.urlencode({"ref":commit}))
            if not isinstance(children,list):raise ValueError(f"Unable to read {folder} at {commit}")
            frames=[[x["name"],x["sha"],x.get("size") or 0] for x in children if x.get("type")=="file" and re.search(r"\.tga$",x["name"],re.I)]
            frames.sort(key=lambda f:(number(f[0]),f[0]))
            current={x[0]:x[1] for x in frames}
            previous={x[0]:x[1] for x in snapshots[-1]["frames"]} if snapshots else {}
            added=sum(k not in previous for k in current)
            modified=sum(k in previous and v!=previous[k] for k,v in current.items())
            deleted=sum(k not in current for k in previous)
            snapshot={"commit":commit,"date":c["commit"]["author"]["date"][:10],
                "message":(c["commit"].get("message") or "").splitlines()[0] if (c["commit"].get("message") or "").splitlines() else "(No message)",
                "frames":frames,"changed":modified,"added":added,"deleted":deleted}
            snapshots.append(snapshot)
            print("SNAPSHOT",ident,i,len(raw),snapshot["date"],len(frames),"changed",modified,"added",added,"deleted",deleted,flush=True)
        latest=snapshots[-1]
        results.append({"id":ident,"title":title,"path":folder,"versions":snapshots,
                        "latest_frames":len(latest["frames"]),"historical_versions":len(snapshots)})
    output={"schema":1,"repo":"e-minence/black_white","generated_from":"resource/ original TGA frame sequences",
        "films":results,"note":"Dates are public commit dates; preview FPS is not asserted to be actual DS playback speed. No frame pixels are distributed."}
    OUTPUT.write_text(json.dumps(output,separators=(",",":"),ensure_ascii=False),encoding="utf8")
    assert len(results)==3 and sum(x["latest_frames"] for x in results)>=990
    print("DONE",OUTPUT.stat().st_size,"bytes",sum(x["historical_versions"] for x in results),"historical snapshots",flush=True)
if __name__=="__main__":build()
