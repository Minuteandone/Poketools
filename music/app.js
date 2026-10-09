import {Audio,BufferReader} from "https://esm.sh/nitro-fs@1.1.1?bundle";
import {SONG_USAGE} from "./song-usage.js";
import {BW_SWAV_LABELS} from "./instrument-labels.js";
import {TICKS,clamp,makeSong,addTrack,addNote,totalTicks,qtime,validateProject,midi,sseq,importSequence} from "./core.js";

const $=id=>document.getElementById(id);
const state={sdat:null,rom:null,songs:[],song:makeSong(),bankCache:new Map(),waveCache:new Map(),soundCache:new Map(),library:[],groups:new Map(),track:0,page:0,octave:48,tool:'draw',pointer:null,ctx:null,live:null,engine:null,playing:false,started:0,events:[],eventPos:0,cycle:0,playTimer:null};
const status=(s,error=false)=>{$('status').textContent=s;$('status').classList.toggle('error',error)};
const noteName=n=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n%12]+(Math.floor(n/12)-1);
const safeFile=s=>(s||'music').replace(/[\\/:*?"<>|]/g,'_').slice(0,100);
const usage=s=>SONG_USAGE[s.name]||s.name||('Sequence '+s.id);
const number=n=>String(n).padStart(2,'0');
function download(bytes,name,mime='application/octet-stream'){
 const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type:mime}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
}
async function findSdat(file){
 const read=async(a,b)=>new Uint8Array(await file.slice(a,b).arrayBuffer());
 const head=await read(0,0x200),v=new DataView(head.buffer);
 const read32=o=>v.getUint32(o,true);
 const fntOff=read32(0x40),fntSize=read32(0x44),fatOff=read32(0x48),fatSize=read32(0x4c);
 if(!fntOff||!fntSize||!fatOff||!fatSize||fntOff+fntSize>file.size||fatOff+fatSize>file.size)throw Error('Not a valid DS ROM filesystem.');
 const fnt=await read(fntOff,fntOff+fntSize),fat=await read(fatOff,fatOff+fatSize);
 const u16=(b,o)=>b[o]|b[o+1]<<8,u32=(b,o)=>(b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0;
 const dirs=u16(fnt,6),seen=new Set(),decode=new TextDecoder('ascii');
 function walk(dir,path){
  if(seen.has(dir))return null;seen.add(dir);
  const index=dir-0xf000;if(index<0||index>=dirs)return null;
  const rec=index*8;let pos=u32(fnt,rec),fileId=u16(fnt,rec+4);
  while(pos<fnt.length){
   const kind=fnt[pos++];if(!kind)break;const isDir=!!(kind&128),len=kind&127;
   if(!len||pos+len>fnt.length)break;
   const name=decode.decode(fnt.subarray(pos,pos+len));pos+=len;
   if(isDir){if(pos+2>fnt.length)break;const sub=u16(fnt,pos);pos+=2;const found=walk(sub,path+'/'+name);if(found)return found;}
   else{if(/^(?:wb_)?sound_data\.sdat$/i.test(name)){const p=fileId*8;if(p+8>fat.length)throw Error('Invalid audio FAT record');const a=u32(fat,p),b=u32(fat,p+4);if(b<=a||b>file.size)throw Error('Invalid audio archive bounds');return {path:path+'/'+name,start:a,end:b};}fileId++;}
  }return null;
 }
 const found=walk(0xf000,'');if(!found)throw Error('Could not find the BW sound_data.sdat archive.');
 return {...found,buffer:await file.slice(found.start,found.end).arrayBuffer()};
}
function bankInfo(id){
 if(state.bankCache.has(id))return state.bankCache.get(id);
 const file=state.sdat?.fs.banks.find(b=>b.id===id);if(!file)return null;
 try{const bank=new Audio.SBNK(file.buffer);const data={file,bank};state.bankCache.set(id,data);return data;}
 catch(err){console.warn('Bank parse',id,err);return null;}
}
function waves(id){
 if(state.waveCache.has(id))return state.waveCache.get(id);
 const file=state.sdat?.fs.waveArchives.find(f=>f.id===id);if(!file)return null;
 try{const swar=new Audio.SWAR(file.buffer);state.waveCache.set(id,swar);return swar;}
 catch(err){console.warn('Archive',id,err);return null;}
}
function region(inst,pitch=60){
 if(!inst)return null;
 if(inst.type===16){const key=clamp(pitch,inst.lowerKey,inst.upperKey),item=inst.instruments[key-inst.lowerKey];return item?{type:item.type,info:item.noteInfo}:null;}
 if(inst.type===17){let index=inst.regions.findIndex(end=>pitch<=end);if(index<0)index=inst.regions.length-1;const item=inst.instruments[index];return item?{type:item.type,info:item.noteInfo}:null;}
 return inst.noteInfo?{type:inst.type,info:inst.noteInfo}:null;
}
function resolveInstrument(bankId,program,pitch=60){
 const info=bankInfo(bankId);if(!info)return null;
 const inst=info.bank.instruments[program],reg=region(inst,pitch);if(!reg)return null;
 const archiveId=info.file.fileInfo.waveArchives[reg.info.waveArchiveId];
 const archive=state.sdat.fs.waveArchives.find(f=>f.id===archiveId);
 return {...reg,archiveId,archiveName:archive?.name??'',waveId:reg.info.waveId};
}
function sampleVariants(bankId,program){
 const file=bankInfo(bankId),inst=file?.bank.instruments[program];if(!inst)return [];
 let pitchList=[60];
 if(inst.type===16)pitchList=Array.from({length:Math.max(0,Math.min(128,inst.upperKey-inst.lowerKey+1))},(_,i)=>inst.lowerKey+i);
 if(inst.type===17){
  let low=0;pitchList=inst.regions.map(upper=>{const key=Math.floor((low+upper)/2);low=upper+1;return key;});
 }
 const variants=[],seen=new Set();
 for(const samplePitch of pitchList){
  const r=resolveInstrument(bankId,program,samplePitch);if(!r)continue;
  const identity=r.type+':'+r.archiveId+':'+r.waveId;
  if(seen.has(identity))continue;seen.add(identity);
  const label=r.archiveName?(BW_SWAV_LABELS[r.archiveName]?.[r.waveId]||''):'';
  variants.push({bankId,program,label,samplePitch,waveId:r.waveId,archiveId:r.archiveId,kind:r.type,key:bankId+':'+program+':'+identity});
 }
 return variants;
}
function buildLibrary(){
 state.library=[];state.groups.clear();
 const bankUses=new Map();
 for(const song of state.songs){
  const id=song.fileInfo.bankId;
  if(!bankUses.has(id))bankUses.set(id,new Set());
  bankUses.get(id).add(usage(song));
 }
 for(const [bankId,songs] of bankUses){
  const data=bankInfo(bankId);if(!data)continue;
  for(let program=0;program<data.bank.instruments.length;program++){
   if(!data.bank.instruments[program])continue;
   for(const variant of sampleVariants(bankId,program)){
    const item={...variant,songs:[...songs].sort((a,b)=>a.localeCompare(b))};
    state.library.push(item);
    if(!state.groups.has(item.label))state.groups.set(item.label,[]);
    state.groups.get(item.label).push(item);
   }
  }
 }
 // Index song membership once so large unlabeled groups stay fast on iPads.
 for(const items of state.groups.values()){
  const bySong=new Map();
  for(const item of items)for(const name of item.songs){if(!bySong.has(name))bySong.set(name,[]);bySong.get(name).push(item);}
  const positions=new Map();
  for(const [name,variants] of bySong){variants.sort((a,b)=>a.bankId-b.bankId||a.program-b.program||a.samplePitch-b.samplePitch);positions.set(name,new Map(variants.map((item,i)=>[item.key,i+1])));}
  for(const item of items)item.songLabels=item.songs.map(name=>name+((bySong.get(name)?.length||0)>1?' #'+positions.get(name).get(item.key):''));
 }
 $('instrumentCount').textContent=state.library.length+' sample variants · '+state.groups.size+' label groups';
 renderInstruments();
}
function renderInstruments(){
 const sel=$('instrument'),search=$('instrumentSearch').value.trim().toLowerCase(),prev=sel.value;
 sel.innerHTML='';
 const groups=[...state.groups].sort((a,b)=>a[0]===b[0]?0:!a[0]?1:!b[0]?-1:a[0].localeCompare(b[0]));
 for(const [label,items] of groups){
  if(search&&!(label.toLowerCase().includes(search)||items.some(x=>x.songLabels.some(s=>s.toLowerCase().includes(search))||x.key.includes(search))))continue;
  const option=document.createElement('option');option.value=label||'__unlabeled';option.textContent=label||'(unlabeled)';
  sel.append(option);
 }
 if([...sel.options].some(x=>x.value===prev))sel.value=prev;
 renderVariants();
}
function selectedGroup(){return $('instrument').value==='__unlabeled'?'':$('instrument').value;}
function renderVariants(){
 const chosen=selectedGroup(),variant=$('variant'),last=variant.value;variant.innerHTML='';
 const list=state.groups.get(chosen)||[];
 const sorted=[...list].sort((a,b)=>(a.songLabels[0]||'').localeCompare(b.songLabels[0]||'')||a.bankId-b.bankId||a.program-b.program);
 const sections=new Map();
 for(const item of sorted){
  const heading=item.songLabels[0]||'Other';
  if(!sections.has(heading)){const group=document.createElement('optgroup');group.label=heading;sections.set(heading,group);variant.append(group);}
  const o=document.createElement('option');o.value=item.key;
  const extra=item.songLabels.slice(1);
  o.textContent=(extra.length?'Also '+extra.slice(0,3).join(', ')+(extra.length>3?' +'+(extra.length-3)+' more':'')+' — ':'')+'Bank '+item.bankId+' / Program '+item.program+' · SWAV '+item.waveId+' (key '+noteName(item.samplePitch)+')';
  // The group is the source song. Missing instrument labels remain unnamed.
  sections.get(heading).append(o);
 }
 if([...variant.options].some(x=>x.value===last))variant.value=last;
 syncSamplePitch();
 const exists=!!state.library.length&&variant.querySelectorAll('option').length>0;
 $('preview').disabled=!exists;$('addTrack').disabled=!exists;$('variant').disabled=!exists;
}
function selectedInstrument(){return state.library.find(x=>x.key===$('variant').value)||null;}
function syncSamplePitch(){
 const sound=selectedInstrument();if(!sound)return;
 const options=[...$('previewPitch').options];
 const closest=options.sort((a,b)=>Math.abs(+a.value-sound.samplePitch)-Math.abs(+b.value-sound.samplePitch))[0];
 if(closest)$('previewPitch').value=closest.value;
}
function renderSongs(){
 const template=$('template');template.innerHTML='<option value="">Choose a song or fanfare…</option>';
 const groups={Music:[],Fanfares:[]};
 for(const s of state.songs){(s.name?.startsWith('SEQ_ME_')?groups.Fanfares:groups.Music).push(s);}
 for(const [label,songs] of Object.entries(groups)){
  const optgroup=document.createElement('optgroup');optgroup.label=label;
  for(const seq of songs){const option=document.createElement('option');option.value=seq.id;option.textContent=usage(seq)+(seq.name?' · '+seq.name:'');optgroup.append(option);}
  template.append(optgroup);
 }
 template.disabled=false;$('loadTemplate').disabled=false;
 renderSongBrowser();
}
function projectFields(){
 const s=state.song;
 for(const id of ['name','tempo','beats','measures','volume'])$(id).value=s[id];
 $('loop').checked=s.loop;
 $('origin').textContent=s.source?'Editing notes imported from '+s.source.name+'. Some game-specific controller events and loops may not carry across.':'Blank composition. Choose instruments, add tracks and draw notes.';
 $('importSummary').hidden=!s.source;
 renderTrackList();updateExportInfo();drawRoll();
}
function readFields(){
 for(const id of ['name','tempo','beats','measures','volume']){
  if(id==='name')state.song.name=$(id).value.slice(0,120)||'New song';
  else state.song[id]=clamp($(id).value,id==='tempo'?30:id==='beats'?1:id==='measures'?1:0,id==='tempo'?300:id==='beats'?12:id==='measures'?256:100);
 }
 state.song.loop=$('loop').checked;
 state.page=clamp(state.page,0,Math.max(0,Math.ceil(state.song.measures/4)-1));
 updateExportInfo();drawRoll();
}
function songEnd(){return Math.max(totalTicks(state.song),...state.song.tracks.flatMap(t=>t.notes.map(n=>n.start+n.length)),1);}
function updateExportInfo(){
 const banks=new Set(state.song.tracks.map(t=>t.instrument.bankId));
 $('exportSseq').disabled=state.song.tracks.length===0||banks.size!==1;
 $('exportSseq').title=banks.size>1?'Mixed-bank compositions require custom SBNK merging; export MIDI or project JSON.':'Save a single-bank DS SSEQ sequence.';
}
function renderTrackList(){
 const box=$('tracks');box.innerHTML='';
 if(!state.song.tracks.length){box.innerHTML='<p class="quiet">No tracks. Choose an instrument above and tap Add instrument track.</p>';$('play').disabled=true;drawRoll();return;}
 state.track=clamp(state.track,0,state.song.tracks.length-1);
 state.song.tracks.forEach((t,i)=>{
  const row=document.createElement('div');row.className='track'+(state.track===i?' selected':'');
  const dot=document.createElement('span');dot.className='dot';dot.style.background=['#8fd5ff','#b0a0ff','#9cf5d0','#ffbb8c','#ffd98f','#f3a6d2'][i%6];
  const button=document.createElement('button');button.className='main';
  const ref=state.library.find(x=>x.bankId===t.instrument.bankId&&x.program===t.instrument.program&&x.samplePitch===t.instrument.samplePitch)||state.library.find(x=>x.bankId===t.instrument.bankId&&x.program===t.instrument.program);
  const label=ref?.label||'';
  const details=ref?.songLabels[0]||'';
  button.innerHTML='';
  const title=document.createElement('span');title.textContent=t.name+(label?' · '+label:'');
  const sub=document.createElement('small');sub.textContent='Bank '+t.instrument.bankId+' / Program '+t.instrument.program+(Number.isInteger(t.instrument.samplePitch)?' · SWAV '+(ref?.waveId??'?'):'')+(details?' · '+details:'')+' · '+t.notes.length+' notes';
  button.append(title,sub);
  button.onclick=()=>{state.track=i;renderTrackList();drawRoll();};
  const mute=document.createElement('button');mute.className='tinyButton';mute.textContent=t.mute?'🔇':'🔊';mute.title='Mute';mute.onclick=()=>{t.mute=!t.mute;renderTrackList();};
  const volume=document.createElement('input');volume.type='range';volume.min=0;volume.max=100;volume.value=t.volume;volume.title='Track volume';volume.oninput=()=>t.volume=+volume.value;
  const remove=document.createElement('button');remove.className='tinyButton del';remove.textContent='✕';remove.title='Delete track';remove.onclick=()=>{stop();state.song.tracks.splice(i,1);if(state.track>=state.song.tracks.length)state.track=Math.max(0,state.song.tracks.length-1);renderTrackList();updateExportInfo();};
  row.append(dot,button,mute,volume,remove);box.append(row);
 });
 $('play').disabled=false;updateExportInfo();
}
const KEY_W=66,STEP_W=30,KEY_H=23,ROWS=36;
function rollBounds(){const from=state.page*4*state.song.beats*TICKS,span=4*state.song.beats*TICKS;return {from,to:from+span,span,cols:span/12};}
function rectFor(note){
 const {from}=rollBounds();
 return {x:KEY_W+(note.start-from)/12*STEP_W,y:(state.octave+ROWS-1-note.pitch)*KEY_H,w:Math.max(8,note.length/12*STEP_W),h:KEY_H};
}
function drawRoll(){
 const c=$('roll'),ctx=c.getContext('2d');if(!ctx)return;
 const s=state.song,cols=4*s.beats*4;
 c.width=KEY_W+cols*STEP_W;c.height=ROWS*KEY_H;
 ctx.fillStyle='#0b1727';ctx.fillRect(0,0,c.width,c.height);
 for(let r=0;r<ROWS;r++){
  const pitch=state.octave+ROWS-1-r,y=r*KEY_H;
  ctx.fillStyle=[1,3,6,8,10].includes(pitch%12)?'#1c293a':'#1c354a';ctx.fillRect(0,y,KEY_W-1,KEY_H-1);
  ctx.fillStyle='#e8f5ff';ctx.font='12px system-ui';ctx.fillText(noteName(pitch),6,y+15);
  ctx.fillStyle=pitch%12===0?'#1a2e47':'#101d2e';ctx.fillRect(KEY_W,y,c.width-KEY_W,KEY_H);
  ctx.strokeStyle='#27394e';ctx.beginPath();ctx.moveTo(KEY_W,y+.5);ctx.lineTo(c.width,y+.5);ctx.stroke();
 }
 for(let i=0;i<=cols;i++){
  const x=KEY_W+i*STEP_W,bar=i%(4*s.beats)===0,beat=i%4===0;
  ctx.strokeStyle=bar?'#7995bf':beat?'#466280':'#2b3f59';ctx.lineWidth=bar?2:1;ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,c.height);ctx.stroke();
  if(bar&&i<cols){ctx.fillStyle='#acdcff';ctx.fillRect(x+2,0,26,18);ctx.fillStyle='#102238';ctx.font='bold 11px system-ui';ctx.fillText(String(state.page*4+Math.floor(i/(4*s.beats))+1),x+6,13);}
 }
 const tr=s.tracks[state.track];if(tr)for(const note of tr.notes){
  const r=rectFor(note);if(r.x+r.w<KEY_W||r.x>c.width||r.y+KEY_H<0||r.y>=c.height)continue;
  ctx.fillStyle='#93d6ff';ctx.fillRect(Math.max(KEY_W,r.x)+1,r.y+2,Math.min(r.w,c.width-r.x)-2,r.h-4);
  ctx.fillStyle='#122640';ctx.fillRect(Math.max(KEY_W,r.x+r.w-6),r.y+2,4,r.h-4);
  if(r.w>=36){ctx.fillStyle='#13253b';ctx.font='12px system-ui';ctx.fillText(noteName(note.pitch),r.x+5,r.y+KEY_H-7);}
 }
 if(state.playing&&state.ctx){
  const elapsed=(state.ctx.currentTime-state.started)*s.tempo/60*TICKS;
  const tick=s.loop?elapsed%songEnd():Math.min(elapsed,songEnd());
  const x=KEY_W+(tick-rollBounds().from)/12*STEP_W;
  if(x>=KEY_W&&x<=c.width){ctx.strokeStyle='#ffc970';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke();}
 }
 $('pageLabel').textContent=(state.page*4+1)+'–'+Math.min(s.measures,(state.page+1)*4);
 $('prevPage').disabled=state.page<=0;$('nextPage').disabled=(state.page+1)*4>=s.measures;
}
function point(e){const c=$('roll'),r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};}
function gridPoint(e){
 const p=point(e),{from}=rollBounds();
 return {pitch:clamp(state.octave+ROWS-1-Math.floor(p.y/KEY_H),0,127),start:from+Math.max(0,Math.floor((p.x-KEY_W)/STEP_W))*12,x:p.x};
}
function hitNote(g){const tr=state.song.tracks[state.track];return tr?.notes.findLast(n=>n.pitch===g.pitch&&g.start>=n.start&&g.start<n.start+n.length);}
function down(e){
 const tr=state.song.tracks[state.track];if(!tr||state.pointer)return;
 const g=gridPoint(e);
 if(g.x<KEY_W){void previewNote(tr.instrument,g.pitch,.5);return;}
 e.preventDefault();$('roll').setPointerCapture?.(e.pointerId);
 const tool=$('tool').value;
 const hit=hitNote(g);
 if(tool==='erase'){if(hit){tr.notes.splice(tr.notes.indexOf(hit),1);drawRoll();renderTrackList();}return;}
 if(tool==='draw'){
  const note=addNote(tr,{pitch:g.pitch,start:g.start,length:+$('noteLength').value,velocity:+$('velocity').value});
  state.pointer={id:e.pointerId,tool,note,start:g.start,pitch:g.pitch,originalLength:note.length};void previewNote(tr.instrument,g.pitch,.28);
 }else if(hit)state.pointer={id:e.pointerId,tool,note:hit,start:g.start,pitch:g.pitch,originalStart:hit.start,originalPitch:hit.pitch,originalLength:hit.length};
 drawRoll();
}
function move(e){
 const p=state.pointer;if(!p||p.id!==e.pointerId)return;e.preventDefault();
 const g=gridPoint(e),n=p.note,delta=g.start-p.start;
 if(p.tool==='draw'||p.tool==='resize'){n.length=clamp((p.originalLength||12)+delta,12,48*128);}
 else if(p.tool==='move'){n.start=Math.max(0,p.originalStart+delta);n.pitch=clamp(p.originalPitch+g.pitch-p.pitch,0,127);}
 drawRoll();
}
function up(e){
 if(!state.pointer||state.pointer.id!==e.pointerId)return;
 const p=state.pointer;state.pointer=null;
 const tr=state.song.tracks[state.track];tr.notes.sort((a,b)=>a.start-b.start||b.pitch-a.pitch);
 renderTrackList();drawRoll();
}

async function context(){
 if(!state.ctx){const Native=window.AudioContext||window.webkitAudioContext;if(!Native)throw Error('Web Audio is not supported by this browser.');state.ctx=new Native();}
 if(state.ctx.state==='suspended')await state.ctx.resume();
 return state.ctx;
}
function sample(bankId,program,pitch,samplePitch=null){
 const res=resolveInstrument(bankId,program,Number.isInteger(samplePitch)?samplePitch:pitch);if(!res)return null;
 if(res.type===2)return {kind:'psg',duty:res.info.waveId,info:res.info};
 if(res.type===3)return {kind:'noise',info:res.info};
 if(res.type!==1&&res.type!==4)return null;
 if(res.archiveId==null||res.archiveId<0)return null;
 const archive=waves(res.archiveId),swav=archive?.waves[res.waveId];if(!swav)return null;
 const key=res.archiveId+':'+res.waveId;
 let decoded=state.soundCache.get(key);
 if(!decoded){
  const pcm=swav.toPCM();if(!pcm?.length)return null;
  decoded={pcm,rate:swav.dataBlock.sampleRate||22050,loop:!!swav.dataBlock.loop,loopStart:swav.dataBlock.loopStart||0,loopLength:swav.dataBlock.loopLength||0};
  state.soundCache.set(key,decoded);
 }
 return {kind:'pcm',info:res.info,data:decoded};
}
function playAt(inst,pitch,velocity,at,length,trackVolume=100,trackPan=0){
 if(!state.ctx)return false;
 const voice=sample(inst.bankId,inst.program,pitch,inst.samplePitch);if(!voice)return false;
 const ctx=state.ctx,now=ctx.currentTime,start=Math.max(at,now+.004),duration=Math.max(.03,length);
 const gain=ctx.createGain(),pan=ctx.createStereoPanner?.();let node;
 const amplitude=clamp(velocity,1,127)/127*Math.pow(clamp(trackVolume,0,100)/100,1.1)*state.song.volume/100*.55;
 gain.gain.setValueAtTime(0,start);
 gain.gain.linearRampToValueAtTime(amplitude,start+.009);
 gain.gain.setValueAtTime(amplitude,start+Math.max(.02,duration-.035));
 gain.gain.linearRampToValueAtTime(0,start+duration+.05);
 if(pan){pan.pan.value=clamp(trackPan,-100,100)/100;gain.connect(pan);pan.connect(ctx.destination);}else gain.connect(ctx.destination);
 if(voice.kind==='pcm'){
  const d=voice.data,cacheKey=voice.data;
  if(!d.buffer||d.buffer.sampleRate!==d.rate){const buffer=ctx.createBuffer(1,d.pcm.length,d.rate);buffer.copyToChannel(d.pcm,0);d.buffer=buffer;}
  node=ctx.createBufferSource();node.buffer=d.buffer;node.playbackRate.value=Math.pow(2,(pitch-(voice.info.baseNote||60))/12);
  if(d.loop&&d.loopLength>0){node.loop=true;node.loopStart=clamp(d.loopStart/d.rate,0,d.buffer.duration);node.loopEnd=clamp((d.loopStart+d.loopLength)/d.rate,node.loopStart+.001,d.buffer.duration);}
 }else if(voice.kind==='psg'){node=ctx.createOscillator();node.type='square';node.frequency.value=440*Math.pow(2,(pitch-69)/12);}
 else{const noise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.35),ctx.sampleRate),arr=noise.getChannelData(0);for(let i=0;i<arr.length;i++)arr[i]=Math.random()*2-1;node=ctx.createBufferSource();node.buffer=noise;node.loop=true;}
 node.connect(gain);node.start(start);node.stop(start+duration+.055);
 if(state.engine){const engine=state.engine;engine.sources.push(node);node.onended=()=>{const i=engine.sources.indexOf(node);if(i>=0)engine.sources.splice(i,1);};}
 return true;
}
async function previewNote(inst,pitch,duration=.7){
 try{await context();if(!playAt(inst,pitch,106,state.ctx.currentTime+.015,duration))status('That instrument program has no playable sample at '+noteName(pitch)+'.',true);}
 catch(err){status(err.message,true);}
}
function eventList(){
 const list=[];
 for(const tr of state.song.tracks){if(tr.mute)continue;
  for(const n of tr.notes)if(n.start<songEnd())list.push({time:qtime(n.start,state.song.tempo),length:qtime(n.length,state.song.tempo),note:n,track:tr});}
 list.sort((a,b)=>a.time-b.time);return list;
}
function pump(){
 if(!state.engine||!state.ctx)return;
 const eng=state.engine,now=state.ctx.currentTime,cycleLen=qtime(songEnd(),state.song.tempo);
 const horizon=now+.35;
 if(cycleLen<=0)return;
 let guard=0;
 while(guard++<3000){
  if(eng.index>=eng.events.length){
   if(!state.song.loop)break;
   eng.index=0;eng.cycle++;
  }
  if(!eng.events.length)break;
  const event=eng.events[eng.index],when=state.started+event.time+eng.cycle*cycleLen;
  if(when>horizon)break;
  if(when>=now-.2)playAt(event.track.instrument,event.note.pitch,event.note.velocity,when,event.length,event.track.volume,event.track.pan);
  eng.index++;
 }
 const passed=now-state.started;
 const tick=passed*state.song.tempo/60*TICKS;
 $('position').textContent=(Math.floor((state.song.loop?tick%songEnd():tick)/(state.song.beats*TICKS))+1)+':'+(Math.floor(tick/TICKS)%state.song.beats+1);
 if(!state.song.loop&&passed>cycleLen+.1){stop();return;}
 drawRoll();
}
async function play(){
 if(!state.song.tracks.length)return;
 stop();
 try{const ctx=await context();state.playing=true;state.started=ctx.currentTime+.07;state.engine={events:eventList(),index:0,cycle:0,sources:[]};$('play').textContent='❚❚ Pause';state.playTimer=setInterval(pump,80);pump();}
 catch(err){stop();status('Cannot play: '+err.message,true);}
}
function stop(){
 if(state.playTimer){clearInterval(state.playTimer);state.playTimer=null;}
 if(state.engine)for(const source of state.engine.sources){try{source.stop();}catch{}}
 state.engine=null;state.playing=false;$('play').textContent='▶ Play';$('position').textContent='1:1';drawRoll();
}
async function loadRom(file){
 stop();status('Reading ROM audio archive locally…');$('rom').disabled=true;
 try{
  const result=await findSdat(file),sdat=new Audio.SDAT(BufferReader.new(result.buffer));
  state.sdat=sdat;state.rom=file.name;state.songs=sdat.fs.sequences.filter(s=>s.buffer&&/^SEQ_(?:BGM|ME)_/.test(s.name||''));
  state.library=[];state.groups.clear();state.bankCache.clear();state.waveCache.clear();state.soundCache.clear();
  renderSongs();buildLibrary();
  for(const id of ['instrumentSearch','instrument','addTrack','preview'])$(id).disabled=false;
  $('romInfo').textContent=file.name+' · '+state.songs.length+' sequences · '+state.library.length+' instruments';
  status('Loaded '+result.path+' · '+state.songs.length+' songs/fanfares · '+state.library.length+' instrument variations. ROM/audio never uploaded.');
  renderTrackList();
 }catch(err){console.error(err);status('ROM loading failed: '+err.message,true);}
 finally{$('rom').disabled=false;}
}
function renderSongBrowser(){
 const box=$('songList'),term=$('songSearch').value.trim().toLowerCase();
 box.innerHTML='';
 const found=state.songs.filter(s=>(usage(s)+' '+s.name).toLowerCase().includes(term));
 const parts=[['🎼 Songs',found.filter(x=>!x.name?.startsWith('SEQ_ME_'))],['✨ Fanfares',found.filter(x=>x.name?.startsWith('SEQ_ME_'))]];
 for(const [title,items] of parts){
  if(!items.length)continue;
  const header=document.createElement('div');header.className='songCategory';header.textContent=title;box.append(header);
  for(const s of items){
   const button=document.createElement('button');button.className='songOption';button.type='button';
   const text=document.createElement('strong');text.textContent=usage(s);
   const detail=document.createElement('span');detail.textContent=s.name+' · Bank '+s.fileInfo.bankId;
   button.append(text,detail);button.onclick=()=>{const dialog=$('songDialog');dialog.close();$('template').value=String(s.id);void loadSourceSong(s.id);};
   box.append(button);
  }
 }
 $('songCount').textContent=found.length+' available '+(term?'matching':'')+' song / fanfare sequences';
 if(!found.length)box.textContent='No matching songs. Try another search.';
}
function showSongPicker(){
 if(!state.sdat){status('Open your Pokémon ROM before browsing songs.',true);return;}
 $('songSearch').value='';
 renderSongBrowser();
 const dialog=$('songDialog');
 if(typeof dialog.showModal==='function')dialog.showModal();
 else{dialog.setAttribute('open','');}
 $('songSearch').focus();
}
function focusImportedNotes(song){
 const populated=song.tracks.map((t,i)=>({t,i,count:t.notes.length})).filter(x=>x.count);
 if(!populated.length)return;
 const best=populated.sort((a,b)=>b.count-a.count)[0];
 state.track=best.i;
 const note=best.t.notes.reduce((earliest,n)=>n.start<earliest.start?n:earliest);
 state.page=clamp(Math.floor(note.start/(Math.max(1,song.beats)*TICKS*4)),0,Math.ceil(song.measures/4)-1);
 const octave=Math.max(0,Math.min(84,Math.floor((note.pitch-17)/12)*12));
 state.octave=octave;
 $('octave').value=octave;
}
async function loadSourceSong(songId){
 const id=songId??Number($('template').value);
 if(!$('template').value&&songId==null){showSongPicker();return;}
 const src=state.songs.find(s=>s.id===id);
 if(!src){status('Select a valid song or fanfare from the list first.',true);showSongPicker();return;}
 status('Importing '+usage(src)+'…');
 $('loadTemplate').disabled=true;
 // Yield a frame so the browser can display progress on iPad.
 await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
 try{
  const source=new Audio.SSEQ(src.buffer);
  const result=importSequence(source.data.commands,{name:usage(src),bankId:src.fileInfo.bankId,sequenceId:id});
  const noteCount=result.song.tracks.reduce((sum,t)=>sum+t.notes.length,0);
  if(!noteCount){status(usage(src)+' contains no note events the importer understands. Your current project was not replaced.',true);showSongPicker();return;}
  stop();state.song=result.song;state.track=0;state.page=0;
  focusImportedNotes(result.song);
  projectFields();
  $('template').value=String(id);
  $('importStats').textContent=usage(src)+' · '+noteCount+' notes · '+state.song.tracks.length+' tracks';
  status('Imported '+usage(src)+'! '+noteCount+' notes across '+state.song.tracks.length+' tracks.'+(result.truncated?' Some game-specific/repeating events were omitted.':''));
  $('rollWrap').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(err){console.error(err);status('Song import failed: '+err.message,true);}
 finally{$('loadTemplate').disabled=false;}
}
function bind(){
 $('rom').onchange=e=>{if(e.target.files[0])void loadRom(e.target.files[0]);};
 $('instrumentSearch').oninput=renderInstruments;
 $('instrument').onchange=renderVariants;
 $('variant').onchange=syncSamplePitch;
 $('preview').onclick=()=>{const inst=selectedInstrument();if(inst)void previewNote(inst,+$('previewPitch').value);};
 $('addTrack').onclick=()=>{
  const inst=selectedInstrument();if(!inst)return;try{
   const t=addTrack(state.song,inst);state.track=state.song.tracks.indexOf(t);state.octave=clamp(Math.floor((inst.samplePitch-18)/12)*12,24,60);$('octave').value=state.octave;renderTrackList();drawRoll();status('Added '+(inst.label||'unlabeled sound')+' · bank '+inst.bankId+' program '+inst.program+' wave '+inst.waveId+'.');
  }catch(err){status(err.message,true);}
 };
 $('newSong').onclick=()=>{if(state.song.tracks.some(t=>t.notes.length)&&!confirm('Create a blank song? Save your current project first if you want to keep it.'))return;stop();state.song=makeSong();state.track=0;state.page=0;projectFields();$('template').value='';};
 $('loadTemplate').onclick=()=>{
  if(!$('template').value){showSongPicker();return;}
  if(state.song.tracks.some(t=>t.notes.length)&&!confirm('Replace this song with the selected ROM sequence?'))return;
  void loadSourceSong();
 };
 $('closeSongDialog').onclick=()=>$('songDialog').close();
 $('songSearch').oninput=renderSongBrowser;
 $('jumpNotes').onclick=()=>$('rollWrap').scrollIntoView({behavior:'smooth',block:'center'});
 for(const id of ['name','tempo','beats','measures','volume','loop'])$(id).addEventListener('change',()=>{stop();readFields();});
 $('play').onclick=()=>state.playing?stop():void play();
 $('stop').onclick=stop;$('rewind').onclick=()=>{stop();state.page=0;drawRoll();};
 $('prevPage').onclick=()=>{state.page=Math.max(0,state.page-1);drawRoll();};
 $('nextPage').onclick=()=>{state.page=Math.min(Math.ceil(state.song.measures/4)-1,state.page+1);drawRoll();};
 $('octave').onchange=()=>{state.octave=+$('octave').value;drawRoll();};
 $('tool').onchange=()=>{state.tool=$('tool').value;};
 const canvas=$('roll');
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
 $('saveProject').onclick=()=>download(new Blob([JSON.stringify(state.song,null,2)],{type:'application/json'}),safeFile(state.song.name)+'.poketools.json');
 $('openProject').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const parsed=validateProject(JSON.parse(await f.text()));stop();state.song=parsed;state.page=0;state.track=0;projectFields();status('Loaded editable project '+f.name+'. Open the source ROM to hear instruments.');}catch(err){status('Project import: '+err.message,true);}e.target.value='';};
 $('exportMidi').onclick=()=>{try{download(midi(state.song),safeFile(state.song.name)+'.mid','audio/midi');status('MIDI exported. DS bank samples are not embedded in MIDI.');}catch(err){status(err.message,true);}};
 $('exportSseq').onclick=()=>{try{const banks=new Set(state.song.tracks.map(t=>t.instrument.bankId));if(banks.size!==1)throw Error('This project uses more than one DS bank. Use MIDI or project JSON.');download(sseq(state.song),safeFile(state.song.name)+'-bank-'+[...banks][0]+'.sseq');status('SSEQ exported for bank '+[...banks][0]+'. Keep its original SBNK and SWAR resources.');}catch(err){status(err.message,true);}};
 projectFields();
}
bind();
