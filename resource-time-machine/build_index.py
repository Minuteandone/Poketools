#!/usr/bin/env python3
"""Index actual Pokémon Black/White resource files, never src/.

Produces a searchable catalog of all resource/ files and precomputed Git
history for representative artwork, field events, music, models, and UI files.
No copyrighted asset bytes or ROM data are copied into the site.
"""
from __future__ import annotations
import collections
import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

REPO="e-minence/black_white"
API="https://api.github.com/repos/"+REPO
DEST=pathlib.Path(__file__).with_name("resources.json")
TOKEN=os.environ.get("GH_TOKEN","")
EXCLUDE={"c","cc","cpp","h","hpp","rb","pl","bat","sh","py","js","mk","mak","d","o","a","exe","dll","obj","html","htm","cs","java"}
TYPES={
 "Artwork / frames":{"tga","bmp","png","jpg","jpeg","gif","psd"},
 "Nintendo DS 2D graphics":{"ncg","ncl","nce","nsc","nanr","ncgr","nclr","ncer","nscr"},
 "3D models / animations":{"imd","nsbmd","nsbtx","nsbca","nsbta","nsbtp","ima","ica","ita","itp","3dmd"},
 "Field / events":{"mev","wms","ev","esf","gmm","gmt","tbl","cdat","3dmd"},
 "Music / audio":{"wav","swav","sseq","sbnk","swar","swls","strm","sdat"},
 "Archives / indexes":{"narc","naix"},
 "Game data":{"bin","dat","pdm","tdm","xls","xsl","def"},
 "Text / documents":{"txt","csv","md","xml","npv","script","lst","json"}
}
CATEGORY={ext:key for key,extensions in TYPES.items() for ext in extensions}
FEATURED=[
 "resource/title/fix_blk_logo.bmp",
 "resource/title/fix_wht_logo.bmp",
 "resource/title/logo_pokemon_nintendo.bmp",
 "resource/op_demo/op000.tga",
 "resource/op_demo/op100.tga",
 "resource/op_demo/op300.tga",
 "resource/op_demo2/op_demo_00000.tga",
 "resource/op_demo2/op_demo_00040.tga",
 "resource/gf_logo/gf_logo_00000.tga",
 "resource/gf_logo/gf_logo_00030.tga",
 "resource/manual_image/002_01_title_black.bmp",
 "resource/manual_image/005_01_battle.bmp",
 "resource/manual_image/012_01_cgear_custom.bmp",
 "resource/manual_image/018_01_townmap.bmp",
 "resource/fldmapdata/eventdata/data/c01.mev",
 "resource/fldmapdata/eventdata/data/c01.wms",
 "resource/fldmapdata/eventdata/data/bc10.mev",
 "resource/fldmapdata/camera_scroll/original/original_C03.xls",
 "resource/fldmapdata/area_data/area_data.bin",
 "resource/battle/battle_bg/BG内訳.txt",
 "resource/battle/battle_bg/battle_w_bg.ncg",
 "resource/battle/battgra_wb.naix",
 "resource/debug/obata/dice.imd",
 "resource/debug/obata/dice.nsbmd",
 "resource/debug/nagihashi/back.ncg",
 "resource/debug/nagihashi/back.ncl",
 "resource/test_graphic/others/titledemo.naix",
 "resource/test_graphic/others/titledemo.narc",
 "resource/demo3d/bin/c_cruiser_port01.nsbmd",
 "resource/demo3d/bin/c_cruiser_port02.nsbca",
 "resource/demo3d/bin/cdemo_01.nsbmd",
 "resource/demo3d/res/title_b/title_b.imd",
 "resource/musical/dressup/anime_ue.ncg",
 "resource/musical/dressup/anime_ue.ncl",
 "resource/musical/dressup/obj_main.ncg",
 "resource/musical/dressup/obj_main.nce",
 "resource/sound/midi_download/msl_voice_01.wav",
 "resource/sound/midi_download/mus_wb_msl_dl_01.sseq",
 "resource/message/src/b_bag.gmm",
 "resource/message/src/b_plist.gmm",
 "resource/zukan_data_old/zukan_data_old.naix",
 "resource/field_weather/arare.ncg",
 "resource/field_weather/arare.ncl",
 "resource/field_weather/mirage.ncg",
 "resource/c_gear/c_gear.ncg",
 "resource/c_gear/c_gear_f.ncl",
 "resource/itemicon/item_001.ncg",
 "resource/itemicon/item_001.ncl",
 "resource/itemicon/item_001.nce",
 "resource/pokeicon/graphic/poke_icon_000_m.ncg",
 "resource/pokefoot/graphic/poke_foot_000.ncg",
 "resource/intro/intro_bg.ncg",
 "resource/intro/intro_bg.ncl",
 "resource/oekaki/oekaki_m.ncg",
 "resource/oekaki/oekaki_m.ncl",
 "resource/p_tree/p_tree01_001.imd",
 "resource/trainer_case/badge_bg01.ncg",
 "resource/box/bar_button.ncg",
 "resource/townmap/townmap.naix",
 "resource/season_display/season_display.naix"
]
def api(url, retries=5):
    headers={"User-Agent":"poketools-resource-time-machine","Accept":"application/vnd.github+json"}
    if TOKEN:headers["Authorization"]="Bearer "+TOKEN
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=110) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code in (404,422):return None
            if e.code in (403,429) and i<retries-1:
                t=min(45,3*(i+1));print("Rate limit",e.code,"waiting",t,flush=True);time.sleep(t);continue
            raise
        except (TimeoutError,urllib.error.URLError):
            if i>=retries-1:raise
            time.sleep(2**i)
def main():
    tree=api(API+"/git/trees/main?recursive=1")
    if not tree or tree.get("truncated"):raise RuntimeError("Git tree is truncated or unavailable")
    raw=[x for x in tree["tree"] if x["type"]=="blob" and x["path"].startswith("resource/")]
    dirs=[x["path"] for x in tree["tree"] if x["type"]=="tree" and x["path"].startswith("resource/")]
    folders=collections.Counter()
    entries=[]
    existing=set()
    for f in raw:
        path=f["path"];existing.add(path)
        bits=path.split("/")
        folder=bits[1] if len(bits)>2 else "(root)"
        ext=bits[-1].rsplit(".",1)[-1].lower() if "." in bits[-1] else ""
        category=CATEGORY.get(ext,"Other resources")
        if ext in EXCLUDE or bits[-1].lower() in {"makefile","makefile.in"}:category="Tools / source"
        folders[folder]+=1
        entries.append([path, f.get("size") or 0, category, ext])
    # Precompute Git histories of representative, real files, not files guessed
    # from programming source and not all 27K irrelevant entries.
    curated=[p for p in FEATURED if p in existing]
    missing=[p for p in FEATURED if p not in existing]
    print("MISSING_FEATURED",missing,flush=True)
    histories={}
    for i,path in enumerate(curated,1):
        q=urllib.parse.urlencode({"path":path,"per_page":100})
        records=api(API+"/commits?"+q)
        if not isinstance(records,list):continue
        histories[path]=[[c["sha"],c["commit"]["author"]["date"][:10],
            (c["commit"]["message"].splitlines() or ["(No message)"])[0][:150]]
            for c in reversed(records)]
        if i%10==0:print("HISTORY",i,"/",len(curated),path,len(records),flush=True)
    counts=collections.Counter(e[2] for e in entries)
    payload={"schema":1,"source":REPO,"headRef":"main",
        "resourceFiles":len(raw),"resourceDirectories":len(dirs),
        "topLevelFolders":[[k,folders[k]] for k in sorted(folders)],
        "typeCounts":dict(counts),
        "entries":entries,"featured":curated,"histories":histories,
        "notice":"History arrays are oldest-to-newest and capped to 100 most recent file-affecting commits; for uncached files the client may query GitHub on demand."}
    DEST.parent.mkdir(exist_ok=True,parents=True)
    DEST.write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False),encoding="utf-8")
    print("DONE",len(raw),"resource files",len(dirs),"directories",len(histories),"pre-indexed histories",DEST.stat().st_size,"bytes",flush=True)
    assert len(folders)>=100 and len(raw)>20000 and len(histories)>=30
if __name__=="__main__":main()
