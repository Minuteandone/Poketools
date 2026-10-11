// Utilities shared by the dedicated resource/ archaeology viewers.
// All content comes from the original e-minence/black_white resource/ tree.
import {Narc} from '../../src/narc.js';
import {decompress} from '../../src/lz.js';
import {Ncgr,Nclr,Ncer,renderNcgr,renderNcerCell} from '../../src/nitro.js';

export const SOURCE='e-minence/black_white';
export const ROOT='https://raw.githubusercontent.com/'+SOURCE+'/';
export const el=id=>document.getElementById(id);
export const fmt=n=>n>=1048576?(n/1048576).toFixed(2)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B';
export const safe=t=>String(t??'');
export function dom(tag,cls='',value){const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=String(value);return n;}
export function repoUrl(path,ref='main'){return 'https://github.com/'+SOURCE+'/blob/'+encodeURIComponent(ref)+'/'+path.split('/').map(encodeURIComponent).join('/');}
export function rawUrl(path,ref='main'){return ROOT+encodeURIComponent(ref)+'/'+path.split('/').map(encodeURIComponent).join('/');}
export async function bytes(path,ref='main'){
 const r=await fetch(rawUrl(path,ref));
 if(!r.ok)throw Error('HTTP '+r.status+' loading '+path);
 return new Uint8Array(await r.arrayBuffer());
}
export async function text(path,ref='main'){
 const r=await fetch(rawUrl(path,ref));
 if(!r.ok)throw Error('HTTP '+r.status+' loading '+path);
 const b=await r.arrayBuffer();
 try{return new TextDecoder('utf-8',{fatal:true}).decode(b);}
 catch{return new TextDecoder('shift_jis').decode(b);}
}
export async function revisions(path){
 // Browser API is unauthenticated and may rate-limit; the main version always works.
 const query='https://api.github.com/repos/'+SOURCE+'/commits?path='+encodeURIComponent(path)+'&per_page=100';
 const r=await fetch(query,{headers:{Accept:'application/vnd.github+json'}});
 if(!r.ok)throw Error('GitHub revision API returned '+r.status);
 const json=await r.json();
 return json.map(x=>({sha:x.sha,date:x.commit.author.date.slice(0,10),message:(x.commit.message||'').split('\n')[0]})).reverse();
}
export function readNaix(input){
 const matches=[...input.matchAll(/(NARC_[A-Za-z0-9_]+)\s*=\s*(\d+)/g)];
 const items=matches.map(m=>({full:m[1],id:Number(m[2])}));
 const index=new Map(items.map(x=>[x.id,x]));
 const fullNames=items.map(x=>x.full);
 // Strip constant leading archive prefix (e.g. NARC_intro_*) to make names readable.
 let prefix=fullNames.length?fullNames[0]:'';
 for(const n of fullNames){let i=0;while(i<prefix.length&&n[i]===prefix[i])i++;prefix=prefix.slice(0,i);}
 prefix=prefix.slice(0,prefix.lastIndexOf('_')+1);
 return {items:items.map(x=>({...x,name:x.full.slice(prefix.length)||x.full})),index,prefix};
}
export function signature(raw){
 let b=raw instanceof Uint8Array?raw:new Uint8Array(raw);
 if(!b.length)return 'EMPTY';
 const sig=String.fromCharCode(...b.slice(0,4));
 if(b[0]===0x10||b[0]===0x11)return 'LZ '+b[0].toString(16).toUpperCase();
 return sig.replace(/[^ -~]/g,'.');
}
export function kindFromName(name,b){
 const extension=(name.match(/_(NCGR|NCBR|NCLR|NCER|NANR|NMCR|NMAR|NCEC|NSCR)$/i)||[])[1];
 if(extension)return extension.toUpperCase();
 let sig=signature(b);
 if(sig.startsWith('LZ ')){try{sig=signature(decompress(b));}catch{/* invalid compressed member */}}
 return {'RGCN':'NCGR','RLCN':'NCLR','RECN':'NCER','RNAN':'NANR','RCMN':'NMCR','RAMN':'NMAR','RCSN':'NSCR','BMD0':'NSBMD','BTX0':'NSBTX','BCA0':'NSBCA','BTA0':'NSBTA','BTP0':'NSBTP'}[sig]||sig;
}
export async function openNarc(path,ref='main'){
 if(!path.startsWith('resource/')||!path.endsWith('.narc'))throw Error('Choose a .narc inside resource/');
 const [b,index]=await Promise.all([bytes(path,ref),text(path.replace(/\.narc$/i,'.naix'),ref).catch(()=>null)]);
 const narc=new Narc(b);
 const naix=index?readNaix(index):{items:[],index:new Map(),prefix:''};
 // The original .naix may be unavailable over raw GitHub on a particular
 // browser/session. Keep exact main-branch labels in a tiny local manifest.
 // Never apply today's labels to a historical commit with changed slot order.
 if(!naix.items.length && ref==='main'){
  try{
   const response=await fetch(new URL('../narc-indexes.json',import.meta.url));
   if(response.ok){
    const catalogue=await response.json(),members=catalogue[path]?.members||{};
    naix.index=new Map(Object.entries(members).map(([id,name])=>[Number(id),{id:Number(id),name}]));
   }
  }catch{/* Present member IDs rather than invent names. */}
 }
 const records=Array.from({length:narc.memberCount},(_,id)=>{
  const b=narc.member(id);
  const label=naix.index.get(id)?.name??'Member '+id;
  return {id,label,length:b.length,type:kindFromName(label,b)};
 });
 return {path,ref,narc,naix,records};
}
export function findPalette(archive,member){
 const pal=archive.records.filter(r=>r.type==='NCLR');
 if(!pal.length)return null;
 const base=member.label.replace(/_(NCBR|NCGR)$/i,'').replace(/_(m|f)$/i,'');
 const exact=pal.find(p=>p.label===base+'_NCLR' || p.label===base+'_n_NCLR');
 if(exact)return exact;
 const segments=base.split('_');
 const common=p=>{const a=p.label.split('_');let score=0;for(let i=0;i<Math.min(a.length,segments.length);i++){if(a[i]!==segments[i])break;score++;}return score;};
 return pal.slice().sort((a,b)=>common(b)-common(a))[0];
}
export function findCell(archive,member){
 const cells=archive.records.filter(r=>r.type==='NCER');
 if(!cells.length)return null;
 const base=member.label.replace(/_(NCBR|NCGR)$/i,'').replace(/_(m|f)$/i,'');
 const canonical=base.replace(/c(?=(_|$))/,'');
 return cells.find(c=>c.label===base+'_NCER'||c.label===canonical+'_NCER')||null;
}
export function pairedParts(archive,member){
 const base=member.label.replace(/_NCGR$/i,'');
 const candidates=[base.replace(/_(m|f)$/i,'c_$1')+'_NCBR',base+'c_NCBR'];
 return archive.records.find(r=>candidates.includes(r.label))||null;
}
export function decoded(archive,id){return decompress(archive.narc.member(id));}
export function makeSprite(archive,member,paletteId=null,cellId=null){
 const palMember=paletteId==null?findPalette(archive,member):archive.records[paletteId];
 if(!palMember)throw Error('No NCLR palette is available for this image');
 const palette=new Nclr(decoded(archive,palMember.id));
 const cellMember=cellId==null?findCell(archive,member):archive.records[cellId];
 let graphicsMember=member;
 if(cellMember && member.type==='NCGR'){
  const part=pairedParts(archive,member);
  if(part)graphicsMember=part;
 }
 const graphic=new Ncgr(decoded(archive,graphicsMember.id));
 let cell=null;
 if(cellMember){try{cell=new Ncer(decoded(archive,cellMember.id));}catch{/* keep tile preview */}}
 return {graphic,palette,cell,member:graphicsMember,paletteMember:palMember,cellMember};
}
export function paintSprite(canvas,sprite,{assemble=false,cellIndex=0,scale=2}={}){
 const ctx=canvas.getContext('2d');
 if(assemble&&sprite.cell){
  renderNcerCell(ctx,sprite.graphic,sprite.palette,sprite.cell,cellIndex,{zoom:scale,stage:192});
  // Some archived animation cells start completely empty (e.g. a particle's
  // first timing frame). Display its original graphic tiles instead of a blank stage.
  const pixels=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data;
  let painted=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0){painted=true;break;}
  if(!painted){
   const stride=(sprite.graphic.renderStride>0&&sprite.graphic.renderStride<=128)?sprite.graphic.renderStride:32;
   const {w,h}=sprite.graphic.dimensions(stride);
   if(w*h>4_000_000||h<=0)throw Error('Unreasonable NCGR fallback size');
   renderNcgr(ctx,sprite.graphic,sprite.palette,{scale,stride});
   return {mode:'tiles',reason:'Empty first cell: showing original graphics in a safe tile layout.'};
  }
  return {mode:'assembled'};
 }else{
  const stride=(sprite.graphic.renderStride>0&&sprite.graphic.renderStride<=128)?sprite.graphic.renderStride:32;
  const dims=sprite.graphic.dimensions(stride);
  if(dims.w*dims.h>4_000_000||dims.h<=0)throw Error('Unreasonable tile sheet dimensions');
  renderNcgr(ctx,sprite.graphic,sprite.palette,{scale,stride});
  return {mode:'tiles'};
 }
}
export function option(value,label){const e=dom('option','',label);e.value=value;return e;}
export function status(id,msg,bad=false){const n=el(id);if(n){n.textContent=msg;n.classList.toggle('error',bad);}}
export function downloadCanvas(canvas,name='sprite.png'){
 canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const a=dom('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);},'image/png');
}
