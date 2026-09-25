import {openNds} from './nds.js';
import {Narc} from './narc.js';
import {PokemonAssets,ROLES,ROLE_EXT} from './pokegra.js';
import {renderNcgr,renderAnimationFrame,bgr555ToHex} from './nitro.js';
import {downloadBytes,downloadBlob} from './binary.js';
import {recompressLike} from './lz.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={nds:null,narc:null,assets:null,species:25,form:0,side:'front',shiny:false,source:'sheet',selectedColor:1,tool:'pencil',zoom:6,map:0,tick:0,playing:true,speed:1,last:0};
const status=(t,bad=false)=>{$('#status').textContent=t;$('#status').classList.toggle('bad',bad);};

function bind(){
  $('#rom').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;status('Opening ROM…');try{state.nds=await openNds(file);state.narc=new Narc(state.nds.narc);state.assets=new PokemonAssets(state.narc,state.nds.isSequel);$('#romInfo').textContent=`${state.nds.title} · ${state.nds.gameCode} · Pokégra ${state.narc.memberCount.toLocaleString()} members`;$('#workspace').hidden=false;status('ROM loaded locally. Nothing has been uploaded.');refreshAll();}catch(err){console.error(err);status(err.message,true);}});
  $('#species').addEventListener('change',()=>{state.species=Math.max(0,Math.min(649,+$('#species').value||0));refreshAll();});
  $('#form').addEventListener('change',()=>{state.form=Math.max(0,+$('#form').value||0);refreshAll();});
  $$('[data-tab]').forEach(b=>b.onclick=()=>{ $$('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));$$('.tab').forEach(x=>x.hidden=x.id!==`tab-${b.dataset.tab}`); if(b.dataset.tab==='animation')refreshAnimation();if(b.dataset.tab==='raw')refreshRaw();});
  $$('[name=side]').forEach(x=>x.onchange=()=>{state.side=x.value;refreshEditor();refreshAnimation();refreshOverview();});
  $('#shiny').onchange=e=>{state.shiny=e.target.checked;refreshEditor();refreshAnimation();refreshOverview();};
  $('#source').onchange=e=>{state.source=e.target.value;refreshEditor();};
  $('#zoom').oninput=e=>{state.zoom=+e.target.value;refreshEditor();};
  $$('[data-tool]').forEach(b=>b.onclick=()=>{$$('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));state.tool=b.dataset.tool;});
  $('#spriteCanvas').addEventListener('pointerdown',paint);$('#spriteCanvas').addEventListener('pointermove',e=>{if(e.buttons&&state.tool!=='fill')paint(e)});
  $('#palette').addEventListener('click',e=>{const sw=e.target.closest('[data-color]');if(!sw)return;state.selectedColor=+sw.dataset.color;renderPalette();});
  $('#palette').addEventListener('dblclick',e=>{const sw=e.target.closest('[data-color]');if(!sw)return;$('#colorEdit').value=sw.dataset.hex;$('#colorEdit').click();});
  $('#colorEdit').addEventListener('input',e=>{editPalette(state.selectedColor,e.target.value);});
  $('#play').onclick=()=>{state.playing=!state.playing;$('#play').textContent=state.playing?'⏸ Pause':'▶ Play';};
  $('#map').onchange=e=>{state.map=+e.target.value;state.tick=0;renderAnim();refreshAnimEditors();};
  $('#speed').oninput=e=>state.speed=+e.target.value;
  $('#exportManifest').onclick=exportManifest;$('#exportRom').onclick=exportRom;$('#downloadMember').onclick=downloadCurrentMember;
  $('#resetCurrent').onclick=resetCurrent;
  requestAnimationFrame(loop);
}

function currentOpts(){return {back:state.side==='back',shiny:state.shiny};}
function refreshAll(){if(!state.assets)return;$('#species').value=state.species;$('#form').value=state.form;refreshOverview();refreshEditor();refreshAnimation();refreshRaw();refreshDirty();}
function safe(fn,ctx){try{return fn();}catch(err){console.warn(ctx,err);status(`${ctx}: ${err.message}`,true);return null;}}

function drawPreview(canvas,back,shiny){const set=safe(()=>state.assets.animationSet(state.species,state.form,{back,shiny}),'Preview');if(!set)return;const idle=set.nmar.value?.idleMap?.()??0,ctx=canvas.getContext('2d');renderAnimationFrame(ctx,set.ncgr.value,set.nclr.value,set.ncer.value,set.nanr.value,set.nmcr.value,Math.min(idle,set.nmcr.value.maps.length-1),0,{zoom:2,stage:144});canvas.style.maxWidth='100%';canvas.style.height='auto';}
function refreshOverview(){if(!state.assets)return;drawPreview($('#frontNormal'),false,false);drawPreview($('#frontShiny'),false,true);drawPreview($('#backNormal'),true,false);drawPreview($('#backShiny'),true,true);$('#dexLabel').textContent=`#${String(state.species).padStart(3,'0')} · form ${state.form}`;}

function editorSet(){return state.assets.spriteSet(state.species,state.form,{...currentOpts(),sheet:state.source==='sheet'});}
function refreshEditor(){if(!state.assets)return;const s=safe(editorSet,'Sprite editor');if(!s)return;state.editor=s;const nc=s.ncgr.value,pal=s.nclr.value;const ctx=$('#spriteCanvas').getContext('2d');renderNcgr(ctx,nc,pal,{scale:state.zoom,grid:true});$('#spriteMeta').textContent=`${state.source} · ${nc.tileCount} tiles · ${nc.bpp}bpp · ${nc.dimensions().w}×${nc.dimensions().h}px`;renderPalette();}
function renderPalette(){if(!state.editor)return;const p=state.editor.nclr.value,el=$('#palette');el.innerHTML='';for(let i=0;i<p.count;i++){const b=document.createElement('button');b.className='swatch'+(i===state.selectedColor?' selected':'');b.dataset.color=i;b.dataset.hex=p.hex(i);b.title=`${i}: ${p.hex(i)}`;b.style.background=i===0?'repeating-conic-gradient(#aaa 0 25%,#666 0 50%) 50%/10px 10px':p.hex(i);b.textContent=i;el.appendChild(b);}$('#colorEdit').value=p.hex(Math.min(state.selectedColor,p.count-1));}
function canvasPixel(e){const c=$('#spriteCanvas'),r=c.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)*c.width/r.width/state.zoom),y=Math.floor((e.clientY-r.top)*c.height/r.height/state.zoom);return {x,y};}
function floodFill(nc,startX,startY,replacement){
  const {w,h}=nc.dimensions(),target=nc.pixelAt(startX,startY);
  if(target===replacement)return false;
  const seen=new Uint8Array(w*h),stack=[startY*w+startX];
  while(stack.length){
    const p=stack.pop();
    if(seen[p])continue;
    seen[p]=1;
    const x=p%w,y=Math.floor(p/w);
    if(nc.pixelAt(x,y)!==target)continue;
    nc.setPixelAt(x,y,replacement);
    if(x>0)stack.push(p-1);
    if(x+1<w)stack.push(p+1);
    if(y>0)stack.push(p-w);
    if(y+1<h)stack.push(p+w);
  }
  return true;
}
function paint(e){if(!state.editor)return;e.preventDefault();const {x,y}=canvasPixel(e),nc=state.editor.ncgr.value,{w,h}=nc.dimensions();if(x<0||y<0||x>=w||y>=h)return;if(state.tool==='eyedropper'){state.selectedColor=nc.pixelAt(x,y);renderPalette();return;}if(state.tool==='fill'){if(!floodFill(nc,x,y,state.selectedColor))return;}else nc.setPixelAt(x,y,state.tool==='erase'?0:state.selectedColor);state.assets.mark(state.editor.ncgr.member);refreshEditor();refreshDirty();}
function editPalette(i,hex){if(!state.editor)return;state.editor.nclr.value.setHex(i,hex);state.assets.mark(state.editor.nclr.member);refreshEditor();refreshOverview();refreshAnimation();refreshDirty();}

function refreshAnimation(){if(!state.assets)return;const a=safe(()=>state.assets.animationSet(state.species,state.form,currentOpts()),'Animation');if(!a)return;state.anim=a;const idle=a.nmar.value?.idleMap?.()??0;state.map=Math.min(state.map,a.nmcr.value.maps.length-1);if(!Number.isFinite(state.map)||state.map<0)state.map=idle;const sel=$('#map');sel.innerHTML='';a.nmcr.value.maps.forEach((m,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`Map ${i} · ${m.records.length} parts${i===idle?' · idle':''}`;sel.appendChild(o);});sel.value=state.map;$('#animMeta').textContent=`${a.ncer.value.cells.length} cells · ${a.nanr.value.animations.length} part animations · ${a.nmcr.value.maps.length} maps`;renderAnim();refreshAnimEditors();}
function renderAnim(){if(!state.anim)return;renderAnimationFrame($('#animCanvas').getContext('2d'),state.anim.ncgr.value,state.anim.nclr.value,state.anim.ncer.value,state.anim.nanr.value,state.anim.nmcr.value,state.map,state.tick,{zoom:3,stage:192});$('#tick').textContent=`tick ${Math.floor(state.tick)}`;}
function refreshAnimEditors(){if(!state.anim)return;const map=state.anim.nmcr.value.maps[state.map],rt=$('#recordTable tbody');rt.innerHTML='';map.records.forEach((r,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${i}</td><td>${r.animation}</td><td><input type=number value="${r.x}" data-r="${i}" data-k=x></td><td><input type=number value="${r.y}" data-r="${i}" data-k=y></td></tr>`;rt.appendChild(tr);});rt.querySelectorAll('input').forEach(inp=>inp.onchange=()=>{const r=map.records[+inp.dataset.r],x=inp.dataset.k==='x'?+inp.value:r.x,y=inp.dataset.k==='y'?+inp.value:r.y;state.anim.nmcr.value.setRecord(state.map,+inp.dataset.r,x,y);state.assets.mark(state.anim.nmcr.member);renderAnim();refreshDirty();});const anims=[...new Set(map.records.map(r=>r.animation))],fs=$('#sequence');fs.innerHTML='';anims.forEach(ai=>{const o=document.createElement('option');o.value=ai;o.textContent=`Part animation ${ai}`;fs.appendChild(o);});fs.onchange=refreshFrames;refreshFrames();}
function refreshFrames(){if(!state.anim)return;const ai=+$('#sequence').value,a=state.anim.nanr.value.animations[ai],tb=$('#frameTable tbody');tb.innerHTML='';if(!a)return;a.frames.forEach((f,i)=>{const editable=f.format===1||f.format===2;const tr=document.createElement('tr');tr.innerHTML=`<td>${i}</td><td>${f.cell}</td><td><input type=number min=0 max=65535 value="${f.duration}" data-i="${i}" data-k=d></td><td>${editable?`<input type=number value="${f.translateX}" data-i="${i}" data-k=x>`:f.translateX}</td><td>${editable?`<input type=number value="${f.translateY}" data-i="${i}" data-k=y>`:f.translateY}</td><td>${f.rotation}</td></tr>`;tb.appendChild(tr);});tb.querySelectorAll('input').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.i,k=inp.dataset.k;if(k==='d')state.anim.nanr.value.setDuration(ai,i,+inp.value);else{const f=a.frames[i],x=k==='x'?+inp.value:f.translateX,y=k==='y'?+inp.value:f.translateY;state.anim.nanr.value.setTranslate(ai,i,x,y);}state.assets.mark(state.anim.nanr.member);renderAnim();refreshDirty();});}

function refreshRaw(){if(!state.assets)return;const body=$('#rawTable tbody');body.innerHTML='';for(let role=0;role<20;role++){const m=safe(()=>state.assets.loadMember(state.species,state.form,role),'Raw member');if(!m)continue;const tr=document.createElement('tr');tr.innerHTML=`<td>${role}</td><td>${ROLES[role]}</td><td>${m.id}</td><td>${m.compression}</td><td>${m.raw.length.toLocaleString()}</td><td>${m.decoded.length.toLocaleString()}</td><td>${state.assets.dirty.has(m.id)?'● edited':''}</td><td><button data-id="${m.id}">download</button></td>`;body.appendChild(tr);}body.querySelectorAll('button').forEach(b=>b.onclick=()=>{const m=state.assets.cache.get(+b.dataset.id);downloadBytes(m.decoded,`${String(state.species).padStart(3,'0')}_${ROLES[m.role]}.${ROLE_EXT[m.role]}`);});}
function refreshDirty(){if(!state.assets)return;$('#dirty').textContent=`${state.assets.dirty.size} modified member${state.assets.dirty.size===1?'':'s'}`;}
function exportManifest(){const obj=state.assets.patchManifest();downloadBlob(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),`bw-studio-${state.nds.gameCode}-patch.json`);}
function exportRom(){const built=state.assets.buildNarc();if(!built.bytes){const msg=built.failures.map(f=>`member ${f.id}: ${f.newSize} > ${f.original}`).join('\n');alert(`These edits do not fit their original compressed slots, so the ROM was NOT built:\n${msg}\n\nYou can still export the edited member or patch manifest.`);return;}const file=state.nds.file,blob=new Blob([file.slice(0,state.nds.narcStart),built.bytes,file.slice(state.nds.narcEnd)],{type:'application/octet-stream'});downloadBlob(blob,file.name.replace(/\.nds$/i,'')+' (BW Studio edited).nds');status('Patched ROM copy built. Original ROM was not changed.');}
function downloadCurrentMember(){const role=(state.side==='back'?9:0)+(state.source==='sheet'?2:0),m=state.assets.loadMember(state.species,state.form,role),enc=recompressLike(m.raw,m.decoded);downloadBytes(enc,`${String(state.species).padStart(3,'0')}_${ROLES[role]}_rom-member.bin`);}
function resetCurrent(){if(!state.editor)return;state.assets.resetMember(state.editor.ncgr.member.id);refreshAll();}
function loop(ts){if(state.playing&&state.anim){if(!state.last)state.last=ts;const dt=(ts-state.last)/1000;state.tick+=dt*60*state.speed;renderAnim();}state.last=ts;requestAnimationFrame(loop);}

bind();
