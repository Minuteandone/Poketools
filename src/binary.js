export function u16(b,o){ return b[o] | (b[o+1]<<8); }
export function s16(b,o){ const v=u16(b,o); return v&0x8000 ? v-0x10000 : v; }
export function u32(b,o){ return (b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24)) >>> 0; }
export function s32(b,o){ return u32(b,o)|0; }
export function w16(b,o,v){ b[o]=v&255; b[o+1]=(v>>>8)&255; }
export function w32(b,o,v){ b[o]=v&255;b[o+1]=(v>>>8)&255;b[o+2]=(v>>>16)&255;b[o+3]=(v>>>24)&255; }
export function ascii(b,o,n){ let s=''; for(let i=0;i<n;i++){ const c=b[o+i]; if(!c) break; s+=String.fromCharCode(c); } return s; }
export function magic(b,o,s){ if(o+s.length>b.length) return false; for(let i=0;i<s.length;i++) if(b[o+i]!==s.charCodeAt(i)) return false; return true; }
export function downloadBlob(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000); }
export function downloadBytes(bytes,name,type='application/octet-stream'){ downloadBlob(new Blob([bytes],{type}),name); }
export function cloneBytes(b){ return new Uint8Array(b); }
export function align(n,a){ return Math.ceil(n/a)*a; }
