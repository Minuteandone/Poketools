import {decompress,compressionType,recompressLike} from './lz.js';
import {Ncgr,Nclr,Ncer,Nanr,Nmcr,Nmar} from './nitro.js';

export const ROLES=['front_static','front_static_female','front_sheet','front_sheet_female','front_cells','front_anim','front_map','front_timing','front_coords','back_static','back_static_female','back_sheet','back_sheet_female','back_cells','back_anim','back_map','back_timing','back_coords','palette_normal','palette_shiny'];
export const ROLE_EXT=['ncgr','ncgr','ncgr','ncgr','ncer','nanr','nmcr','nmar','bin','ncgr','ncgr','ncgr','ncgr','ncer','nanr','nmcr','nmar','bin','nclr','nclr'];
export function formBlock(species,form,isSequel){ if(!form)return species; const b=isSequel?{201:685,351:712,386:715,412:718,413:720,421:722,422:723,423:724,479:725,487:730,492:731,550:732,555:733,585:734,586:737,641:740,642:741,645:742,647:745,648:746,649:747}:{201:652,351:679,386:682,412:685,413:687,421:689,422:690,423:691,479:692,487:697,492:698,550:699,555:700,585:701,586:704,648:707,649:708};if(species===646&&isSequel)return form===1?744:form===2?743:species;if(!b[species])return species;if([421,422,423,487,492,550,555,641,642,645,647,648].includes(species))return b[species];return b[species]+form-1; }

export class PokemonAssets{
  constructor(narc,isSequel){this.narc=narc;this.isSequel=isSequel;this.cache=new Map();this.dirty=new Map();}
  memberId(species,form,role){return formBlock(species,form,this.isSequel)*20+role;}
  loadMember(species,form,role){const id=this.memberId(species,form,role);if(this.cache.has(id))return this.cache.get(id);const raw=this.narc.member(id),comp=compressionType(raw),decoded=decompress(raw);const item={id,role,raw,compression:comp,decoded,originalDecoded:new Uint8Array(decoded)};this.cache.set(id,item);return item;}
  mark(item){this.dirty.set(item.id,item.decoded);}
  typed(species,form,role,type){const m=this.loadMember(species,form,role);if(!m[type])m[type]= type==='ncgr'?new Ncgr(m.decoded):type==='nclr'?new Nclr(m.decoded):type==='ncer'?new Ncer(m.decoded):type==='nanr'?new Nanr(m.decoded):type==='nmcr'?new Nmcr(m.decoded):type==='nmar'?new Nmar(m.decoded):null;return {member:m,value:m[type]};}
  spriteSet(species,form,{back=false,shiny=false,sheet=true}={}){const base=back?9:0,gr=base+(sheet?2:0),pal=shiny?19:18;return {ncgr:this.typed(species,form,gr,'ncgr'),nclr:this.typed(species,form,pal,'nclr')};}
  animationSet(species,form,{back=false,shiny=false}={}){const b=back?9:0;return {ncgr:this.typed(species,form,b+2,'ncgr'),ncer:this.typed(species,form,b+4,'ncer'),nanr:this.typed(species,form,b+5,'nanr'),nmcr:this.typed(species,form,b+6,'nmcr'),nmar:this.typed(species,form,b+7,'nmar'),nclr:this.typed(species,form,shiny?19:18,'nclr')};}
  resetMember(id){const m=this.cache.get(id);if(!m)return;m.decoded.set(m.originalDecoded);this.cache.delete(id);this.dirty.delete(id);}
  buildNarc(){return this.narc.buildFixedSlot(this.dirty,(orig,dec)=>recompressLike(orig,dec));}
  patchManifest(){return {format:'pokemon-bw-studio-patch-v1',members:[...this.dirty.entries()].map(([id,bytes])=>({id,decodedBase64:bytesToBase64(bytes)}))};}
}
function bytesToBase64(bytes){let s='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)s+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(s);}
