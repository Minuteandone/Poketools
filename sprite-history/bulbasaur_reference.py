#!/usr/bin/env python3
"""Temporary proxy ROM for comparing C and web sprite assembly; never ships ROM data."""
import os,struct,re,urllib.request,pathlib,sys
SHA="b9c3a57e3167"
BASE="https://raw.githubusercontent.com/e-minence/black_white/"+SHA+"/resource/pokegra/"
def get(path):
    with urllib.request.urlopen(BASE+path,timeout=100) as u:return u.read()
def extract_narc(buf):
    if buf[:4]!=b"NARC":raise ValueError("NARC magic")
    pos=16;sections={}
    while pos+8<=len(buf):
        size=struct.unpack_from("<I",buf,pos+4)[0]
        if size<8 or pos+size>len(buf):raise ValueError("NARC section bounds")
        sections[buf[pos:pos+4]]=buf[pos+8:pos+size];pos+=size
    fat=sections[b"BTAF"];img=sections[b"GMIF"];n=struct.unpack_from("<I",fat,0)[0]
    return [img[a:b] for a,b in [struct.unpack_from("<II",fat,4+8*i) for i in range(n)]]
def archive(items):
    pay=bytearray();pairs=[]
    for blob in items:
        a=len(pay);pay.extend(blob);b=len(pay);pairs.append((a,b))
        pay.extend(b"\0"*((-len(pay))%4))
    fat=b"BTAF"+struct.pack("<II",12+8*len(pairs),len(pairs))+b"".join(struct.pack("<II",*p) for p in pairs)
    fnt=b"BTNF"+struct.pack("<I",16)+struct.pack("<II",4,0x10000)
    img=b"GMIF"+struct.pack("<I",8+len(pay))+pay
    return struct.pack("<4sHHIHH",b"NARC",0xfffe,0x100,16+len(fat)+len(fnt)+len(img),16,3)+fat+fnt+img
def wrapper(content):
    entries=[
        b"\x81a"+struct.pack("<H",0xF001)+b"\0",
        b"\x810"+struct.pack("<H",0xF002)+b"\0",
        b"\x810"+struct.pack("<H",0xF003)+b"\0",
        b"\x014\0"]
    cur=32;dirs=[]
    for i,e in enumerate(entries):
        dirs.append(struct.pack("<IHH",cur,0,4 if i==0 else 0xF000+i-1));cur+=len(e)
    fnt=b"".join(dirs)+b"".join(entries)
    header=bytearray(0x400)
    header[0:12]=b"POKEGRA DATA"
    header[0x0c:0x10]=b"IRBO"
    struct.pack_into("<IIII",header,0x40,0x200,len(fnt),0x300,8)
    header[0x200:0x200+len(fnt)]=fnt
    struct.pack_into("<II",header,0x300,0x400,0x400+len(content))
    return header+content
def main():
    naix=get("pokegra_wb.naix").decode("utf-8")
    # re.findall groups are (name,index), correct mapping
    idx=dict((name,int(num)) for name,num in re.findall(r"NARC_pokegra_wb_([A-Za-z0-9_]+)\s*=\s*(\d+)",naix))
    raw=extract_narc(get("pokegra_wb.narc"))
    names=[]
    for side in ("pfwb","pbwb"):
        names.extend([f"{side}_001_m_NCGR",f"{side}_001_f_NCGR",f"{side}_001c_m_NCBR",f"{side}_001c_f_NCBR"])
        names.extend(f"{side}_001_{e}" for e in ("NCER","NANR","NMCR","NMAR","NCEC"))
    names.extend(["pmwb_001_n_NCLR","pmwb_001_r_NCLR"])
    members=[b""]*(190*20)+[raw[idx[k]] if k in idx else b"" for k in names]
    dest=pathlib.Path(sys.argv[1]);dest.write_bytes(wrapper(archive(members)))
    print("REFERENCE_ROM",dest, dest.stat().st_size,flush=True)
if __name__=="__main__":main()
