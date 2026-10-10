import {Narc} from "../src/narc.js";
import {decompress} from "../src/lz.js";
import {Ncgr,Ncer,Nanr,Nmcr,Nmar,Nclr} from "../src/nitro.js";
const SHA="b9c3a57e3167";
const ROOT="https://raw.githubusercontent.com/e-minence/black_white/"+SHA+"/resource/pokegra/";
const [resNarc,resIndex]=await Promise.all([fetch(ROOT+"pokegra_wb.narc"),fetch(ROOT+"pokegra_wb.naix")]);
if(!resNarc.ok||!resIndex.ok)throw Error("fetch failed "+resNarc.status+" "+resIndex.status);
const narc=new Narc(new Uint8Array(await resNarc.arrayBuffer()));
const ix=Object.fromEntries([...((await resIndex.text()).matchAll(/NARC_pokegra_wb_([A-Za-z0-9_]+)\s*=\s*(\d+)/g))].map(x=>[x[1],+x[2]]));
const pick=(name,Type)=>{
 const id=ix[name];if(id==null)return {name,error:"missing"};
 const raw=narc.member(id),d=decompress(raw),sections=[];
 for(let offset=0x10;offset+8<d.length;){const tag=String.fromCharCode(...d.slice(offset,offset+4));const sz=new DataView(d.buffer,d.byteOffset).getUint32(offset+4,true);if(sz<8||offset+sz>d.length)break;sections.push({tag,size:sz});offset+=sz;}
 let parsed=null,error=null;
 try{parsed=new Type(d);}catch(e){error=e.message}
 return {name,id,raw_bytes:raw.length,decoded_bytes:d.length,header:String.fromCharCode(...d.slice(0,4)),sections,
    error,
    count:parsed?.maps?.length??parsed?.entries?.length??parsed?.animations?.length??parsed?.cells?.length??parsed?.tileCount??parsed?.count??null,
    mapSummary:parsed?.maps?.slice(0,8).map((m,i)=>({i,parts:m.records.length,coords:m.records.slice(0,5)})),
    firstEntries:parsed?.entries?.slice(0,10),
    firstCells:parsed?.cells?.slice(0,4).map((c,i)=>({i,oams:c.oams.length,first:c.oams.slice(0,5)})),
    firstAnims:parsed?.animations?.slice(0,4).map((a,i)=>({i,frames:a.frames.slice(0,6),playback:a.playback}))};
};
const result={sha:SHA,archiveMembers:narc.memberCount,
 resources:[
 pick("pfwb_001_m_NCGR",Ncgr),
 pick("pfwb_001c_m_NCBR",Ncgr),
 pick("pfwb_001_NCER",Ncer),
 pick("pfwb_001_NANR",Nanr),
 pick("pfwb_001_NMCR",Nmcr),
 pick("pfwb_001_NMAR",Nmar),
 pick("pmwb_001_n_NCLR",Nclr),
 ]};
console.log(JSON.stringify(result,null,2));
