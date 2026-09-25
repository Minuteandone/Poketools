import {u32} from './binary.js';

export function compressionType(data){ if(!data?.length) return 'none'; if(data[0]===0x10) return 'lz10'; if(data[0]===0x11) return 'lz11'; return 'none'; }

export function decompress(data){
  const type=compressionType(data);
  if(type==='none') return new Uint8Array(data);
  let size=data[1]|(data[2]<<8)|(data[3]<<16), ip=4;
  if(type==='lz11' && size===0){ if(data.length<8) throw new Error('Bad LZ11 header'); size=u32(data,4); ip=8; }
  if(size<=0) throw new Error('Invalid compressed size');
  const out=new Uint8Array(size); let op=0;
  while(op<size){
    if(ip>=data.length) throw new Error('Unexpected end of LZ stream');
    const flags=data[ip++];
    for(let bit=7;bit>=0 && op<size;bit--){
      if(!(flags&(1<<bit))){ if(ip>=data.length) throw new Error('Unexpected end of LZ literal'); out[op++]=data[ip++]; continue; }
      let len,disp;
      if(type==='lz10'){
        if(ip+1>=data.length) throw new Error('Unexpected end of LZ10 match');
        const b1=data[ip++],b2=data[ip++]; len=(b1>>>4)+3; disp=((b1&15)<<8)|b2;
      }else{
        if(ip>=data.length) throw new Error('Unexpected end of LZ11 match');
        const b1=data[ip++], hi=b1>>>4;
        if(hi===0){ if(ip+1>=data.length) throw new Error('Unexpected end of LZ11 long match'); const b2=data[ip++],b3=data[ip++]; len=(((b1&15)<<4)|(b2>>>4))+0x11; disp=((b2&15)<<8)|b3; }
        else if(hi===1){ if(ip+2>=data.length) throw new Error('Unexpected end of LZ11 very long match'); const b2=data[ip++],b3=data[ip++],b4=data[ip++]; len=(((b1&15)<<12)|(b2<<4)|(b3>>>4))+0x111; disp=((b3&15)<<8)|b4; }
        else { if(ip>=data.length) throw new Error('Unexpected end of LZ11 short match'); const b2=data[ip++]; len=hi+1; disp=((b1&15)<<8)|b2; }
      }
      const src=op-disp-1; if(src<0) throw new Error('Invalid LZ back-reference');
      for(let i=0;i<len && op<size;i++) out[op++]=out[src+i];
    }
  }
  return out;
}

function key3(d,p){ return ((d[p]||0)<<16)|((d[p+1]||0)<<8)|(d[p+2]||0); }
function findMatch(data,pos,table,maxLen){
  if(pos+2>=data.length) return null;
  const arr=table.get(key3(data,pos)); if(!arr?.length) return null;
  let bestLen=0,bestDisp=0;
  for(let ai=arr.length-1,checked=0; ai>=0 && checked<96; ai--,checked++){
    const prev=arr[ai], dist=pos-prev; if(dist<=0) continue; if(dist>4096) break;
    let len=0, lim=Math.min(maxLen,data.length-pos);
    while(len<lim && data[prev+len]===data[pos+len]) len++;
    if(len>=3 && len>bestLen){ bestLen=len; bestDisp=dist-1; if(len===lim) break; }
  }
  return bestLen>=3?{len:bestLen,disp:bestDisp}:null;
}
function addPos(data,pos,table){ if(pos+2>=data.length) return; const k=key3(data,pos); let a=table.get(k); if(!a){a=[];table.set(k,a);} a.push(pos); while(a.length && pos-a[0]>4096) a.shift(); if(a.length>128) a.splice(0,a.length-128); }

class MinSegTree{
  constructor(n){ this.n=1; while(this.n<n)this.n<<=1; this.val=new Float64Array(this.n*2); this.arg=new Int32Array(this.n*2); this.val.fill(Number.POSITIVE_INFINITY); this.arg.fill(-1); }
  set(i,v){ let p=i+this.n; this.val[p]=v;this.arg[p]=i;p>>=1;while(p){const l=p*2,r=l+1;if(this.val[l]<=this.val[r]){this.val[p]=this.val[l];this.arg[p]=this.arg[l];}else{this.val[p]=this.val[r];this.arg[p]=this.arg[r];}p>>=1;} }
  query(l,r){ if(l>r)return {v:Number.POSITIVE_INFINITY,i:-1};l+=this.n;r+=this.n;let bv=Number.POSITIVE_INFINITY,bi=-1;while(l<=r){if(l&1){if(this.val[l]<bv){bv=this.val[l];bi=this.arg[l];}l++;}if(!(r&1)){if(this.val[r]<bv){bv=this.val[r];bi=this.arg[r];}r--;}l>>=1;r>>=1;}return {v:bv,i:bi}; }
}
function precomputeMatches(src,maxLen){
  const table=new Map(),lens=new Uint32Array(src.length),disps=new Uint16Array(src.length);
  for(let pos=0;pos<src.length;pos++){
    const m=findMatch(src,pos,table,maxLen); if(m){lens[pos]=m.len;disps[pos]=m.disp;}
    addPos(src,pos,table);
  }
  return {lens,disps};
}

export function compressLz11(data){
  const src=data instanceof Uint8Array?data:new Uint8Array(data), n=src.length;
  const {lens,disps}=precomputeMatches(src,0x10110);
  const dp=Array.from({length:8},()=>new Float64Array(n+1));
  const choice=Array.from({length:8},()=>new Int32Array(n));
  const seg=Array.from({length:8},()=>new MinSegTree(n+1));
  for(let s=0;s<8;s++){ dp[s][n]=0;seg[s].set(n,0); }
  for(let pos=n-1;pos>=0;pos--){
    for(let s=0;s<8;s++){
      const ns=(s+1)&7, flag=s===0?1:0;
      let best=flag+1+dp[ns][pos+1], next=pos+1;
      const L=Math.min(lens[pos],n-pos);
      if(L>=3){
        const ranges=[[3,Math.min(16,L),2],[17,Math.min(272,L),3],[273,L,4]];
        for(const [lo,hi,bytes] of ranges){ if(hi<lo)continue; const q=seg[ns].query(pos+lo,pos+hi),cost=flag+bytes+q.v;if(q.i>=0&&cost<best){best=cost;next=q.i;} }
      }
      dp[s][pos]=best;choice[s][pos]=next;seg[s].set(pos,best);
    }
  }
  const out=[0x11,n&255,(n>>>8)&255,(n>>>16)&255]; let pos=0,state=0;
  while(pos<n){ const flagIndex=out.length;out.push(0);let flags=0;for(let bit=7;bit>=0&&pos<n;bit--){const next=choice[state][pos]||pos+1,len=next-pos;if(len<=1){out.push(src[pos]);pos++;}else{flags|=1<<bit;const disp=disps[pos];if(len<=0x10){out.push(((len-1)<<4)|((disp>>>8)&15),disp&255);}else if(len<=0x110){const x=len-0x11;out.push((x>>>4)&15,((x&15)<<4)|((disp>>>8)&15),disp&255);}else{const x=len-0x111;out.push(0x10|((x>>>12)&15),(x>>>4)&255,((x&15)<<4)|((disp>>>8)&15),disp&255);}pos=next;}state=(state+1)&7;}out[flagIndex]=flags; }
  return Uint8Array.from(out);
}

export function compressLz10(data){
  const src=data instanceof Uint8Array?data:new Uint8Array(data); const out=[0x10,src.length&255,(src.length>>>8)&255,(src.length>>>16)&255];
  const table=new Map(); let pos=0;
  while(pos<src.length){
    const flagIndex=out.length;out.push(0);let flags=0;
    for(let bit=7;bit>=0 && pos<src.length;bit--){
      const m=findMatch(src,pos,table,18);
      if(m){ flags|=1<<bit; const len=m.len,disp=m.disp; out.push(((len-3)<<4)|((disp>>>8)&15),disp&255); const old=pos;pos+=len;for(let p=old;p<pos;p++)addPos(src,p,table); }
      else{out.push(src[pos]);addPos(src,pos,table);pos++;}
    }
    out[flagIndex]=flags;
  }
  return Uint8Array.from(out);
}

export function recompressLike(original,decoded){ const t=compressionType(original); return t==='lz11'?compressLz11(decoded):t==='lz10'?compressLz10(decoded):new Uint8Array(decoded); }
