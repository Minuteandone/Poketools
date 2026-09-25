import {u16,u32,ascii} from './binary.js';

export async function readSlice(file,start,end){ return new Uint8Array(await file.slice(start,end).arrayBuffer()); }
function getDir(fnt,dirId){ const idx=dirId&0x0fff, count=u16(fnt,6); if(idx>=count) throw new Error('FNT directory out of range'); const o=idx*8; return {sub:u32(fnt,o),first:u16(fnt,o+4)}; }
export function findFileId(fnt,path){
  const parts=path.split('/').filter(Boolean); let dir=0xF000;
  for(let pi=0;pi<parts.length;pi++){
    const part=parts[pi], last=pi===parts.length-1, d=getDir(fnt,dir); let pos=d.sub,fileIndex=0,found=false;
    while(pos<fnt.length){ const ctl=fnt[pos++]; if(ctl===0) break; const isDir=!!(ctl&0x80), n=ctl&0x7f; const name=ascii(fnt,pos,n);
      if(isDir){ const child=u16(fnt,pos+n); if(!last&&name===part){dir=child;found=true;break;} pos+=n+2; }
      else { const id=d.first+fileIndex; if(last&&name===part) return id; fileIndex++;pos+=n; }
    }
    if(!found&&!last) throw new Error(`NDS path not found: ${path}`);
  }
  throw new Error(`NDS path not found: ${path}`);
}

export async function openNds(file){
  const header=await readSlice(file,0,0x200); if(header.length<0x200) throw new Error('Not a Nintendo DS ROM');
  const title=ascii(header,0,12), gameCode=ascii(header,0x0c,4), fntOffset=u32(header,0x40),fntSize=u32(header,0x44),fatOffset=u32(header,0x48),fatSize=u32(header,0x4c);
  if(!gameCode.startsWith('IR')) throw new Error(`Expected a Gen V Pokémon ROM; game code is ${gameCode||'unknown'}`);
  const fnt=await readSlice(file,fntOffset,fntOffset+fntSize), fat=await readSlice(file,fatOffset,fatOffset+fatSize);
  const pokegraFileId=findFileId(fnt,'/a/0/0/4'); if(pokegraFileId*8+8>fat.length) throw new Error('Pokégra FAT entry is invalid');
  const narcStart=u32(fat,pokegraFileId*8),narcEnd=u32(fat,pokegraFileId*8+4),narc=await readSlice(file,narcStart,narcEnd);
  return {file,title,gameCode,isSequel:['C','D','E'].includes(gameCode[2]),pokegraFileId,narcStart,narcEnd,narc,fatOffset};
}
