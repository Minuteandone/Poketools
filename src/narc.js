import {u32,magic} from './binary.js';
export class Narc{
  constructor(bytes){ this.bytes=bytes; if(!magic(bytes,0,'NARC')) throw new Error('Pokégra file is not a NARC'); let pos=0x10; this.chunks={}; while(pos+8<=bytes.length){const sz=u32(bytes,pos+4); if(sz<8||pos+sz>bytes.length) throw new Error('Broken NARC chunk'); this.chunks[String.fromCharCode(...bytes.slice(pos,pos+4))]={pos,size:sz}; pos+=sz;} const a=this.chunks.BTAF,g=this.chunks.GMIF; if(!a||!g) throw new Error('NARC is missing BTAF/GMIF'); this.btaf=a.pos;this.gmifData=g.pos+8;this.memberCount=u32(bytes,this.btaf+8); }
  range(id){ if(id<0||id>=this.memberCount) throw new Error(`NARC member ${id} out of range`); const o=this.btaf+0x0c+id*8,rs=u32(this.bytes,o),re=u32(this.bytes,o+4); return {start:this.gmifData+rs,end:this.gmifData+re,size:re-rs,relStart:rs,relEnd:re}; }
  member(id){ const r=this.range(id); return this.bytes.slice(r.start,r.end); }
  buildFixedSlot(edits,encoder){ const out=new Uint8Array(this.bytes); const failures=[]; for(const [id,decoded] of edits){ const r=this.range(id),orig=this.member(id),enc=encoder(orig,decoded); if(enc.length>r.size){failures.push({id,original:r.size,newSize:enc.length});continue;} out.fill(0,r.start,r.end);out.set(enc,r.start); } if(failures.length) return {bytes:null,failures}; return {bytes:out,failures:[]}; }
}
