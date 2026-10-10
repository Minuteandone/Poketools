#!/usr/bin/env python3
"""Create a small, asset-free revision index from EVERY historic BW Pokégra NARC.

This indexes the *actual* content hashes of all twenty sprite resources,
rather than mistakenly treating a whole-archive commit as a sprite change.
No Pokémon images, ROMs or private files are published.
"""
import hashlib, json, os, re, struct, time, urllib.error, urllib.request
from pathlib import Path

OWNER = "e-minence/black_white"
DEST = Path(__file__).with_name("revisions.json")
PATTERN = re.compile(r"NARC_pokegra_wb_([A-Za-z0-9_]+)\s*=\s*(\d+)")
FRONT = re.compile(r"^pfwb_(\d{3})(?:_([A-Za-z0-9_]+))?_m_NCGR$")
TOKEN = os.environ.get("GH_TOKEN", "")

def fetch(url, authenticated=False):
    h = {"User-Agent": "bw-revision-history-browser/1.0"}
    if authenticated and TOKEN:
        h["Authorization"] = "Bearer " + TOKEN
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=100) as r:
                return r.read()
        except Exception as e:
            if attempt == 4 or (isinstance(e, urllib.error.HTTPError) and e.code in (401, 403, 404)):
                raise
            time.sleep(2 ** attempt)

def get_commits():
    out = []
    for page in range(1, 5):
        url = (f"https://api.github.com/repos/{OWNER}/commits?"
               f"path=resource/pokegra/pokegra_wb.narc&per_page=100&page={page}")
        part = json.loads(fetch(url, True))
        out.extend(part)
        if len(part) < 100:
            break
    return out[::-1]

def narc_members(buf):
    if buf[:4] != b"NARC":
        raise ValueError("Unexpected archive header")
    pos = 16
    ranges = []
    image = None
    while pos + 8 <= len(buf):
        magic = buf[pos:pos + 4]
        size = struct.unpack_from("<I", buf, pos + 4)[0]
        if size < 8 or pos + size > len(buf):
            raise ValueError("Corrupt NARC")
        if magic in (b"BTAF", b"FATB"):
            n = struct.unpack_from("<I", buf, pos + 8)[0]
            if n > 25000:
                raise ValueError("Implausible member count")
            ranges = [struct.unpack_from("<II", buf, pos + 12 + i * 8) for i in range(n)]
        elif magic in (b"GMIF", b"FIMG"):
            image = memoryview(buf)[pos + 8:pos + size]
        pos += size
    if image is None or not ranges:
        raise ValueError("Incomplete archive")
    return [image[a:b] for a, b in ranges]

def resource_names(sid, form):
    n = f"{sid:03d}" + ("_" + form if form else "")
    cn = f"{sid:03d}c" + ("_" + form if form else "")
    res = []
    for side in ("pfwb", "pbwb"):
        res += [f"{side}_{n}_m_NCGR", f"{side}_{n}_f_NCGR",
                f"{side}_{cn}_m_NCBR", f"{side}_{cn}_f_NCBR"]
        res += [f"{side}_{n}_{kind}" for kind in ("NCER", "NANR", "NMCR", "NMAR", "NCEC")]
    res += [f"pmwb_{n}_n_NCLR", f"pmwb_{n}_r_NCLR"]
    return res

def main():
    commits = get_commits()
    print("Historical NARC commits:", len(commits), flush=True)
    history = {}
    prev = {}
    summary = []
    for i, commit in enumerate(commits):
        sha = commit["sha"]
        date = commit["commit"]["author"]["date"][:10]
        root = f"https://raw.githubusercontent.com/{OWNER}/{sha}/resource/pokegra/"
        ix = fetch(root + "pokegra_wb.naix").decode("utf-8")
        names = {match.group(1): int(match.group(2)) for match in PATTERN.finditer(ix)}
        members = narc_members(fetch(root + "pokegra_wb.narc"))
        by_id = {}
        for name in names:
            found = FRONT.fullmatch(name)
            if found is None:
                continue
            sid = int(found.group(1))
            form = found.group(2) or ""
            key = f"{sid:03d}" + (":" + form if form else "")
            all_names = resource_names(sid, form)
            if names[name] >= len(members) or not members[names[name]]:
                continue
            digest = []
            for resource in all_names:
                j = names.get(resource)
                digest.append(hashlib.blake2s(members[j], digest_size=8).hexdigest()
                              if j is not None and j < len(members) and members[j] else None)
            by_id[key] = digest
            old = prev.get(key)
            change_mask = ((1 << len(digest)) - 1) if old is None else sum(
                (1 << n) for n in range(len(digest)) if digest[n] != old[n])
            if change_mask:
                obj = history.setdefault(key, {"id": sid, "form": form, "revs": []})
                obj["revs"].append([i, change_mask])
        for key in prev.keys() - by_id.keys():
            history[key]["revs"].append([i, -1])
        prev = by_id
        summary.append({"sha": sha, "date": date,
                        "message": (commit["commit"]["message"].splitlines() or ["(No commit message)"])[0][:160]})
        if i % 10 == 9 or i == len(commits) - 1:
            print(f"Indexed {i + 1}/{len(commits)} archives, {len(history)} sprite slots", flush=True)

    entries = sorted(history.values(), key=lambda x: (x["id"], x["form"]))
    payload = {
        "schema": 1, "source": OWNER, "archivePath": "resource/pokegra",
        "roles": ["front male graphics", "front female graphics", "front male parts",
                  "front female parts", "front cell layouts", "front animation",
                  "front animation map", "front timings", "front coordinates",
                  "back male graphics", "back female graphics", "back male parts",
                  "back female parts", "back cell layouts", "back animation",
                  "back animation map", "back timings", "back coordinates",
                  "normal palette", "shiny palette"],
        "commits": summary, "entries": entries,
        "note": "A change event is included only when this particular sprite/form's twenty indexed binary resources changed. -1 means removed. No game graphics are distributed with this index."
    }
    DEST.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    events = sum(len(x["revs"]) for x in entries)
    print("FINISHED", len(entries), "entries,", events, "events,", DEST.stat().st_size, "bytes", flush=True)
    assert len(commits) >= 100 and len(entries) >= 700
if __name__ == "__main__":
    main()
