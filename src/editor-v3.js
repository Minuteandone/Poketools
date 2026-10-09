/* Pokémon BW Sprite Studio — Animation V3.
   Touch-first positioning, keyframe transforms and real NCER sprite-sheet mapping.
   Loaded before the self-contained studio script; invoked after it initializes. */
function createAnimationEditorV3({state,getAssets,refreshDirty,status}) {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const assets=()=>getAssets(), stageSize=192, zoom=3;
  const hiddenByMap=new Map();
  let selectedPart=-1, selectedFrame=0, hitboxes=[], drag=null, contextKey='';
  let tileX=0, tileY=0;
  const currentMap=()=>state.anim?.nmcr.value.maps[state.map]??null;
  const currentRecord=()=>currentMap()?.records[selectedPart]??null;
  const currentAnimation=()=>state.anim?.nanr.value.animations[currentRecord()?.animation]??null;
  const hiddenKey=()=>[state.species,state.form,state.side,state.map].join(':');
  const hidden=()=>{const key=hiddenKey();if(!hiddenByMap.has(key))hiddenByMap.set(key,new Set());return hiddenByMap.get(key);};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const pause=()=>{state.playing=false;updatePlayButton();};
  function updatePlayButton(){$('#play').textContent=state.playing?'⏸ Pause':'▶ Play';}
  function mark(type){assets().mark(state.anim[type].member);refreshDirty();}
  function frameStart(a,i){return a.frames.slice(0,i).reduce((sum,f)=>sum+Math.max(0,f.duration),0);}
  function activeFrameIndex(){const rec=currentRecord();return rec?Math.max(0,state.anim.nanr.value.frameIndex(rec.animation,state.tick)):0;}

  function bind(){
    $('#play').onclick=()=>{state.playing=!state.playing;updatePlayButton();};
    $('#stepBack').onclick=()=>{pause();state.tick=Math.max(0,Math.floor(state.tick)-1);refreshTimeline();render();};
    $('#stepForward').onclick=()=>{pause();state.tick=Math.floor(state.tick)+1;refreshTimeline();render();};
    $('#map').onchange=e=>{state.map=+e.target.value;state.tick=0;selectedPart=-1;selectedFrame=0;refreshEditors();render();};
    $('#speed').oninput=e=>state.speed=+e.target.value;
    $('#animScrub').oninput=e=>{pause();state.tick=+e.target.value;refreshTimeline();render();};
    $('#showBounds').onchange=render;
    $('#dragMode').onchange=()=>status('Touch tool: '+$('#dragMode').selectedOptions[0].textContent);
    $('#addPart').onclick=addPart;
    $('#duplicatePart').onclick=duplicatePart;
    $('#deletePart').onclick=deletePart;
    $('#showAllParts').onclick=()=>{hidden().clear();refreshPartList();render();};
    $('#hideSelectedPart').onclick=()=>{if(selectedPart<0)return;const h=hidden();h.has(selectedPart)?h.delete(selectedPart):h.add(selectedPart);refreshPartList();refreshSelectedPart();render();};
    $('#addKeyframe').onclick=addKeyframe;
    $('#deleteKeyframe').onclick=deleteKeyframe;
    $('#partBaseX').onchange=commitBaseFields;
    $('#partBaseY').onchange=commitBaseFields;
    ['frameCell','frameDuration','frameTX','frameTY','frameRotation','frameScaleX','frameScaleY'].forEach(id=>$('#'+id).addEventListener('change',commitFrameFields));
    const c=$('#animCanvas');
    c.addEventListener('pointerdown',pointerDown);
    c.addEventListener('pointermove',pointerMove);
    c.addEventListener('pointerup',pointerUp);
    c.addEventListener('pointercancel',pointerUp);
    $('#partSource').onchange=updateMapperVisibility;
    $('#mapSize').onchange=drawMapper;
    $('#mapTileX').onchange=()=>{tileX=+$('#mapTileX').value||0;drawMapper();};
    $('#mapTileY').onchange=()=>{tileY=+$('#mapTileY').value||0;drawMapper();};
    $('#newPartCell').onchange=()=>{};
    const sheet=$('#sheetMapCanvas');
    sheet.addEventListener('pointerdown',e=>{e.preventDefault();sheet.setPointerCapture?.(e.pointerId);pickTile(e);});
    sheet.addEventListener('pointermove',e=>{if(e.buttons)pickTile(e);});
    $('#rotateMinus').onclick=()=>nudge('rotation',-15);
    $('#rotatePlus').onclick=()=>nudge('rotation',15);
    $('#scaleMinus').onclick=()=>nudge('scale',-10);
    $('#scalePlus').onclick=()=>nudge('scale',10);
    $('#cellMinus').onclick=()=>nudge('cell',-1);
    $('#cellPlus').onclick=()=>nudge('cell',1);
    updateMapperVisibility();
  }

  function refresh(){
    if(!assets())return;
    const key=[state.species,state.form,state.side].join(':');
    if(key!==contextKey){selectedPart=-1;selectedFrame=0;state.map=0;state.tick=0;contextKey=key;}
    try{state.anim=assets().animationSet(state.species,state.form,{back:state.side==='back',shiny:state.shiny});}
    catch(err){console.error(err);status('Animation: '+err.message,true);state.anim=null;return;}
    const a=state.anim;
    const idle=a.nmar.value?.idleMap?.()??0;
    state.map=clamp(state.map,0,Math.max(0,a.nmcr.value.maps.length-1));
    if(!a.nmcr.value.maps.length){status('Animation has no maps.',true);return;}
    const m=$('#map');m.innerHTML='';
    a.nmcr.value.maps.forEach((map,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent='Map '+i+' · '+map.records.length+' parts'+(i===idle?' · idle':'');m.appendChild(opt);});
    m.value=state.map;
    if(selectedPart>=currentMap().records.length)selectedPart=-1;
    $('#animMeta').textContent='Animation V3 · '+a.ncer.value.cells.length+' sprite cells · '+a.nanr.value.animations.length+' animation tracks · '+a.nmcr.value.maps.length+' maps';
    const cell=$('#newPartCell'),old=cell.value;cell.innerHTML='';
    a.ncer.value.cells.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Cell '+i+' ('+c.oams.length+' object'+(c.oams.length===1?'':'s')+')';cell.appendChild(o);});
    if([...cell.options].some(o=>o.value===old))cell.value=old;
    updateScrubRange();refreshEditors();drawMapper();render();updatePlayButton();
  }

  function updateScrubRange(){
    const map=currentMap();if(!map)return;
    const max=Math.max(1,...map.records.map(r=>state.anim.nanr.value.totalDuration(r.animation)||1));
    const s=$('#animScrub');s.max=max;s.value=clamp(state.tick,0,max);$('#animRange').textContent='0–'+max+' ticks';
  }
  function render(){
    if(!state.anim||!currentMap())return;
    const a=state.anim;
    const result=renderAnimationFrame($('#animCanvas').getContext('2d'),a.ncgr.value,a.nclr.value,a.ncer.value,a.nanr.value,a.nmcr.value,state.map,state.tick,{zoom,stage:stageSize,hiddenRecords:hidden(),selectedRecord:selectedPart,showBounds:$('#showBounds').checked});
    hitboxes=result?.parts??[];
    $('#tick').textContent='tick '+Math.floor(state.tick);
    const scrub=$('#animScrub');if(document.activeElement!==scrub)scrub.value=clamp(state.tick,0,+scrub.max||1);
    const rec=currentRecord();if(rec){const active=state.anim.nanr.value.frameIndex(rec.animation,state.tick);$('#activeFrame').textContent='active keyframe '+active;$$('#keyframeStrip .keyframe').forEach((b,i)=>b.classList.toggle('active',i===active));}
  }
  function advance(dt){if(state.playing&&state.anim){state.tick+=dt*60*state.speed;render();}}
  function refreshEditors(){refreshPartList();refreshSelectedPart();refreshTimeline();updateScrubRange();}
  function refreshPartList(){
    const list=$('#partList');list.innerHTML='';
    const map=currentMap();if(!map)return;
    const h=hidden();
    map.records.forEach((r,i)=>{
      const row=document.createElement('div');row.className='partRow'+(i===selectedPart?' selected':'')+(h.has(i)?' hiddenPart':'');
      const eye=document.createElement('button');eye.className='iconButton';eye.textContent=h.has(i)?'🙈':'👁';eye.title=h.has(i)?'Show part':'Hide part';
      eye.onclick=()=>{h.has(i)?h.delete(i):h.add(i);refreshPartList();refreshSelectedPart();render();};
      const main=document.createElement('button');main.className='partMain';
      const f=state.anim.nanr.value.frame(r.animation,state.tick);
      main.innerHTML='<b>Part '+i+'</b><span>Cell '+(f?.cell??'—')+' · ('+r.x+', '+r.y+')</span>';
      main.onclick=()=>selectPart(i);row.append(eye,main);list.appendChild(row);
    });
    $('#partCount').textContent=map.records.length+' parts · '+h.size+' hidden in editor';
  }
  function selectPart(i){
    selectedPart=i;selectedFrame=activeFrameIndex();
    refreshPartList();refreshSelectedPart();refreshTimeline();render();
  }
  function refreshSelectedPart(){
    const rec=currentRecord();
    $('#partInspector').classList.toggle('disabled',!rec);
    ['duplicatePart','deletePart','hideSelectedPart','rotateMinus','rotatePlus','scaleMinus','scalePlus','cellMinus','cellPlus'].forEach(id=>$('#'+id).disabled=!rec);
    if(!rec){$('#selectedPartTitle').textContent='No part selected';$('#selectedPartMeta').textContent='Tap a part on the stage or choose one from the list.';return;}
    $('#selectedPartTitle').textContent='Part '+selectedPart;
    $('#selectedPartMeta').textContent='Animation track '+rec.animation+(hidden().has(selectedPart)?' · hidden in editor':'');
    $('#partBaseX').value=rec.x;$('#partBaseY').value=rec.y;
    $('#hideSelectedPart').textContent=hidden().has(selectedPart)?'👁 Show selected':'🙈 Hide selected';
  }
  function refreshTimeline(){
    const strip=$('#keyframeStrip');strip.innerHTML='';
    const rec=currentRecord();$('#frameInspector').classList.toggle('disabled',!rec);
    $('#addKeyframe').disabled=!rec;$('#deleteKeyframe').disabled=!rec;
    if(!rec){$('#trackTitle').textContent='Select a part to edit its animation';$('#activeFrame').textContent='';return;}
    const a=currentAnimation();if(!a)return;
    selectedFrame=clamp(selectedFrame,0,a.frames.length-1);
    $('#trackTitle').textContent='Animation '+rec.animation+' · '+a.frames.length+' keyframes · '+state.anim.nanr.value.totalDuration(rec.animation)+' ticks';
    const active=activeFrameIndex();
    a.frames.forEach((f,i)=>{
      const b=document.createElement('button');b.className='keyframe'+(i===selectedFrame?' selected':'')+(i===active?' active':'');
      b.innerHTML='<b>'+i+'</b><span>cell '+f.cell+'</span><small>'+f.duration+'t</small>';
      b.onclick=()=>{selectedFrame=i;state.tick=frameStart(a,i);pause();refreshTimeline();render();};
      strip.appendChild(b);
    });
    refreshFrameInspector();
  }
  function refreshFrameInspector(){
    const a=currentAnimation(),f=a?.frames[selectedFrame];if(!f)return;
    const cells=$('#frameCell');cells.innerHTML='';
    state.anim.ncer.value.cells.forEach((_,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Cell '+i;cells.appendChild(o);});
    cells.value=f.cell;
    $('#frameDuration').value=f.duration;
    $('#frameTX').value=f.translateX;$('#frameTY').value=f.translateY;
    $('#frameRotation').value=(f.rotation*360/65536).toFixed(1);
    $('#frameScaleX').value=((f.scaleX??4096)*100/4096).toFixed(1);
    $('#frameScaleY').value=((f.scaleY??4096)*100/4096).toFixed(1);
    $('#frameIndexLabel').textContent='Keyframe '+selectedFrame+' · format '+f.format;
  }
  function commitBaseFields(){
    if(!currentRecord())return;
    state.anim.nmcr.value.setRecord(state.map,selectedPart,+$('#partBaseX').value,+$('#partBaseY').value);
    mark('nmcr');refreshEditors();render();
  }
  function commitFrameFields(){
    const rec=currentRecord(),f=currentAnimation()?.frames[selectedFrame];if(!rec||!f)return;
    const patch={
      cell:clamp(+$('#frameCell').value||0,0,state.anim.ncer.value.cells.length-1),
      duration:clamp(+$('#frameDuration').value||0,0,65535),
      translateX:Math.round(+$('#frameTX').value||0),translateY:Math.round(+$('#frameTY').value||0),
      rotation:Math.round((+$('#frameRotation').value||0)*65536/360),
      scaleX:Math.round(clamp(+$('#frameScaleX').value||100,1,400)*4096/100),
      scaleY:Math.round(clamp(+$('#frameScaleY').value||100,1,400)*4096/100)
    };
    state.anim.nanr.value.setFrame(rec.animation,selectedFrame,patch);
    mark('nanr');refreshEditors();render();
  }
  function nudge(type,delta){
    const rec=currentRecord();if(!rec)return;
    pause();
    const ai=rec.animation,nanr=state.anim.nanr.value;
    const f=nanr.animations[ai]?.frames[selectedFrame];if(!f)return;
    const patch={};
    if(type==='rotation')patch.rotation=(f.rotation+Math.round(delta*65536/360));
    if(type==='scale'){patch.scaleX=clamp(f.scaleX+Math.round(delta*4096/100),41,16384);patch.scaleY=clamp(f.scaleY+Math.round(delta*4096/100),41,16384);}
    if(type==='cell')patch.cell=clamp(f.cell+delta,0,state.anim.ncer.value.cells.length-1);
    nanr.setFrame(ai,selectedFrame,patch);mark('nanr');refreshEditors();render();
  }

  function addPart(){
    if(!state.anim)return;
    const nanr=state.anim.nanr.value,mode=$('#partSource').value;
    let cell=+$('#newPartCell').value||0;
    if(mode==='mapped'){
      const [width,height]=$('#mapSize').value.split('x').map(Number);
      try{
        cell=state.anim.ncer.value.addMappedCell({tileX,tileY,width,height},state.anim.ncgr.value);
        mark('ncer');
      }catch(err){status('Sprite mapping: '+err.message,true);return;}
    }
    const ai=nanr.addAnimation(cell,'mapped_part_'+nanr.animations.length);
    mark('nanr');
    const old=currentRecord(),idx=state.anim.nmcr.value.addRecord(state.map,{animation:ai,x:old?old.x+6:0,y:old?old.y+6:0,flags:0x20});
    mark('nmcr');selectedPart=idx;selectedFrame=0;pause();
    status('Created part '+idx+' with independent animation track '+ai+' and sprite cell '+cell+'.');
    refresh();
  }
  function duplicatePart(){
    const rec=currentRecord();if(!rec)return;
    const ai=state.anim.nanr.value.cloneAnimation(rec.animation);mark('nanr');
    const idx=state.anim.nmcr.value.addRecord(state.map,{animation:ai,x:rec.x+6,y:rec.y+6,flags:rec.flags});mark('nmcr');
    selectedPart=idx;selectedFrame=0;pause();status('Duplicated part '+idx+' as independent track '+ai+'.');refresh();
  }
  function deletePart(){
    if(!currentRecord())return;
    const idx=selectedPart;
    if(!confirm('Delete part '+idx+' from this map? The animation track remains in the archive.'))return;
    state.anim.nmcr.value.deleteRecord(state.map,idx);mark('nmcr');
    const next=new Set();for(const i of hidden()){if(i<idx)next.add(i);else if(i>idx)next.add(i-1);}
    hiddenByMap.set(hiddenKey(),next);
    selectedPart=Math.min(idx,currentMap().records.length-1);selectedFrame=0;status('Deleted part '+idx+'.');refresh();
  }
  function addKeyframe(){
    const rec=currentRecord();if(!rec)return;
    const idx=state.anim.nanr.value.addFrame(rec.animation,selectedFrame);mark('nanr');
    selectedFrame=idx;pause();refreshTimeline();render();
  }
  function deleteKeyframe(){
    const rec=currentRecord(),a=currentAnimation();if(!rec||!a)return;
    if(a.frames.length<=1){status('Each animation needs at least one keyframe.',true);return;}
    state.anim.nanr.value.deleteFrame(rec.animation,selectedFrame);mark('nanr');
    selectedFrame=clamp(selectedFrame,0,a.frames.length-2);pause();refreshTimeline();render();
  }

  function canvasPoint(e){const c=$('#animCanvas'),r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width/zoom-stageSize/2,y:(e.clientY-r.top)*c.height/r.height/zoom-stageSize/2};}
  function hitTest(p){for(let i=hitboxes.length-1;i>=0;i--){const b=hitboxes[i];if(p.x>=b.x1&&p.x<=b.x2&&p.y>=b.y1&&p.y<=b.y2)return b.recordIndex;}return -1;}
  function pointerDown(e){
    if(!state.anim||drag)return;
    const p=canvasPoint(e),hit=hitTest(p);
    if(hit<0)return;
    if(hit!==selectedPart)selectPart(hit);
    const rec=currentRecord();if(!rec)return;
    pause();e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);
    const mode=$('#dragMode').value,fi=activeFrameIndex(),ai=rec.animation;
    if(mode!=='base'){if(state.anim.nanr.value.ensureEditable(ai))mark('nanr');selectedFrame=fi;}
    const f=state.anim.nanr.value.animations[ai].frames[fi];
    drag={pointerId:e.pointerId,mode,start:p,x:rec.x,y:rec.y,ai,fi,tx:f.translateX,ty:f.translateY,rotation:f.rotation,scaleX:f.scaleX,scaleY:f.scaleY,cell:f.cell,changed:false};
    refreshTimeline();
  }
  function pointerMove(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    e.preventDefault();
    const p=canvasPoint(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y,rec=currentRecord();if(!rec)return;
    const f=state.anim.nanr.value.animations[drag.ai]?.frames[drag.fi];if(!f)return;
    const mode=drag.mode;
    if(mode==='base'){rec.x=clamp(Math.round(drag.x+dx),-32768,32767);rec.y=clamp(Math.round(drag.y+dy),-32768,32767);$('#partBaseX').value=rec.x;$('#partBaseY').value=rec.y;}
    else if(mode==='keyframe'){f.translateX=clamp(Math.round(drag.tx+dx),-32768,32767);f.translateY=clamp(Math.round(drag.ty+dy),-32768,32767);$('#frameTX').value=f.translateX;$('#frameTY').value=f.translateY;}
    else if(mode==='rotate'){f.rotation=clamp(Math.round(drag.rotation+dx*65536/360),-32768,32767);$('#frameRotation').value=(f.rotation*360/65536).toFixed(1);}
    else if(mode==='scale'||mode==='scale-x'||mode==='scale-y'){
      const factor=Math.round(dx*4096/150);
      if(mode!=='scale-y')f.scaleX=clamp(drag.scaleX+factor,41,16384);
      if(mode!=='scale-x')f.scaleY=clamp(drag.scaleY+factor,41,16384);
      $('#frameScaleX').value=(f.scaleX*100/4096).toFixed(1);$('#frameScaleY').value=(f.scaleY*100/4096).toFixed(1);
    }else if(mode==='sprite'){f.cell=clamp(drag.cell+Math.round(dx/20),0,state.anim.ncer.value.cells.length-1);$('#frameCell').value=f.cell;}
    drag.changed=true;render();
  }
  function pointerUp(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    const was=drag;drag=null;
    if(was.changed){
      if(was.mode==='base'){state.anim.nmcr.value.rebuild();mark('nmcr');}
      else{state.anim.nanr.value.rebuild();mark('nanr');}
    }
    refreshEditors();render();
  }

  function updateMapperVisibility(){
    const mapped=$('#partSource').value==='mapped';
    $('#mappingControls').hidden=!mapped;$('#existingCellControl').hidden=mapped;
    if(mapped)drawMapper();
  }
  function mapperSize(){return $('#mapSize').value.split('x').map(Number);}
  function drawMapper(){
    if(!state.anim)return;
    const [width,height]=mapperSize(),nc=state.anim.ncgr.value;
    const tw=width/8,th=height/8,rowCount=Math.ceil(nc.tileCount/32);
    tileX=clamp(Math.floor(tileX),0,Math.max(0,32-tw));
    tileY=clamp(Math.floor(tileY),0,Math.max(0,rowCount-th));
    // The actual NCER tile addressing is 32 tiles across; this matches the renderer.
    const c=$('#sheetMapCanvas'),ctx=c.getContext('2d');
    renderNcgr(ctx,nc,state.anim.nclr.value,{stride:32,scale:2,grid:false});
    ctx.lineWidth=2;ctx.strokeStyle='#ffe16f';ctx.strokeRect(tileX*16+1,tileY*16+1,width*2-2,height*2-2);
    ctx.fillStyle='rgba(255,225,111,.1)';ctx.fillRect(tileX*16,tileY*16,width*2,height*2);
    $('#mapTileX').value=tileX;$('#mapTileY').value=tileY;
    $('#mapperInfo').textContent='Selected '+width+'×'+height+' pixels · tile ('+tileX+', '+tileY+') · tap the sheet to map a different region.';
  }
  function pickTile(e){
    if(!state.anim)return;
    const c=$('#sheetMapCanvas'),r=c.getBoundingClientRect();
    tileX=Math.floor((e.clientX-r.left)*c.width/r.width/16);
    tileY=Math.floor((e.clientY-r.top)*c.height/r.height/16);
    drawMapper();
  }
  return {bind,refresh,render,advance};
}

// Append a genuine NCER cell. Original OAM attribute words are preserved exactly.
Ncer.prototype.addMappedCell=function({tileX,tileY,width,height},ncgr){
  const shapeSizes=[[8,16,32,64],[16,32,32,64],[8,8,16,32]];
  const heightSizes=[[8,16,32,64],[8,8,16,32],[16,32,32,64]];
  let shape=-1,size=-1;
  for(let i=0;i<3;i++)for(let j=0;j<4;j++)if(shapeSizes[i][j]===width&&heightSizes[i][j]===height){shape=i;size=j;}
  if(shape<0)throw new Error('Choose a supported Nintendo DS OAM rectangle.');
  if(!Number.isInteger(tileX)||!Number.isInteger(tileY)||tileX<0||tileY<0||tileX+width/8>32||tileY+height/8>Math.ceil(ncgr.tileCount/32))throw new Error('The selected rectangle is outside the sheet.');
  if((tileY+height/8-1)*32+tileX+width/8>ncgr.tileCount)throw new Error('The selected rectangle extends beyond the sprite graphics.');
  const tile=tileY*32+tileX;if(tile>1023)throw new Error('NCER tile index exceeds 1023.');
  const attr0=((-Math.floor(height/2))&255)|(shape<<14);
  const attr1=((-Math.floor(width/2))&511)|(size<<14);
  const attr2=tile&1023;
  this.cells.push({attr:0,oams:[{attr0,attr1,attr2}]});
  const sections=sectionList(this.data),s=sections.find(s=>s.name==='KBEC');
  if(!s)throw new Error('NCER missing KBEC.');
  const tableOff=u32(s.bytes,12),headerSize=8+tableOff,n=this.cells.length;
  const count=this.cells.reduce((sum,c)=>sum+c.oams.length,0);
  const length=align(headerSize+n*8+count*6,4);
  const bytes=new Uint8Array(length);bytes.set(s.bytes.slice(0,headerSize));
  w32(bytes,4,length);w16(bytes,8,n);
  let offset=0;
  for(let i=0;i<n;i++){
    const cell=this.cells[i],entry=headerSize+i*8;
    w16(bytes,entry,cell.oams.length);w16(bytes,entry+2,cell.attr);
    w32(bytes,entry+4,offset);
    for(const oam of cell.oams){
      const dest=headerSize+n*8+offset;
      w16(bytes,dest,oam.attr0??0);w16(bytes,dest+2,oam.attr1??0);w16(bytes,dest+4,oam.attr2??0);
      offset+=6;
    }
  }
  const replacements={KBEC:bytes};
  const labels=sections.find(s=>s.name==='LBAL');
  if(labels){
    const base=8,strBase=8+(n-1)*4,names=[];
    for(let i=0;i<n-1;i++){
      const off=u32(labels.bytes,base+i*4);let pos=strBase+off,name='';
      while(pos<labels.bytes.length&&labels.bytes[pos])name+=String.fromCharCode(labels.bytes[pos++]);
      names.push(name);
    }
    names.push('mapped_'+(n-1));
    replacements.LBAL=buildLabelSection(names);
  }
  this.data=rebuildNitroFile(this.data,replacements);
  this.cells=new Ncer(this.data).cells;
  return this.cells.length-1;
};
