#!/usr/bin/env python3
"""Generate human-readable Nitro member names for curated Time Machine NARC exhibits.

The indexes come from original resource/*.naix source text. No graphics,
game archives, or private files are copied into this public metadata.
"""
import json, pathlib, re, urllib.request, time
SOURCE="https://raw.githubusercontent.com/e-minence/black_white/main/"
PATHS=[
"resource/field_weather/field_weather.narc",
"resource/musical/stage/stage_gra.narc",
"resource/test_graphic/others/titledemo.narc",
"resource/debug/obata/debug_obata.narc",
"resource/sea_temple/field_sea_temple.narc",
"resource/fldmmdl/fldmmdl_mdlres.narc",
"resource/field_weather_light/field_weather_light.narc",
"resource/test_graphic/others/pl_keycursor.narc"
]
OUT=pathlib.Path("resource-time-machine/narc-indexes.json")
def fetch(path):
    for attempt in range(4):
        try:
            req=urllib.request.Request(SOURCE+path,headers={"User-Agent":"poketools-resource-archaeology"})
            with urllib.request.urlopen(req,timeout=80) as r:return r.read().decode("shift_jis",errors="replace")
        except Exception:
            if attempt==3:raise
            time.sleep(2**attempt)
def main():
    result={}
    for path in PATHS:
        source=fetch(path.removesuffix(".narc")+".naix")
        matches=re.findall(r"(NARC_[A-Za-z0-9_]+)\s*=\s*(\d+)",source)
        if not matches:raise RuntimeError("No named index entries for "+path)
        prefix=matches[0][0]
        for name,_ in matches:
            i=0
            while i<len(prefix) and i<len(name) and prefix[i]==name[i]:i+=1
            prefix=prefix[:i]
        prefix=prefix[:prefix.rfind("_")+1]
        result[path]={"source":path.removesuffix(".narc")+".naix",
          "members":{i:name[len(prefix):] for name,i in matches}}
        print("INDEX",path,len(matches),"named members",flush=True)
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=1)+"\n",encoding="utf-8")
    print("COMPLETE",len(result),"curated archives",flush=True)
if __name__=="__main__":main()
