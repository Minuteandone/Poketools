// Gen V Music Studio — pure project, MIDI and SSEQ operations. No game assets bundled.
export const TICKS=48;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0));
export const makeSong=(name='New song')=>({format:'poketools-music-v1',name,tempo:120,beats:4,measures:8,volume:100,loop:true,tracks:[],source:null});
export const addTrack=(song,instrument)=>{if(song.tracks.length>=16)throw Error('Nintendo DS supports at most 16 sequence tracks.');const t={id:Math.max(0,...song.tracks.map(t=>t.id))+1,name:'Track '+(song.tracks.length+1),instrument:{bankId:instrument.bankId,program:instrument.program},mute:false,volume:100,pan:0,notes:[]};song.tracks.push(t);return t;};
export function addNote(track,note){const n={pitch:clamp(Math.round(note.pitch),0,127),start:Math.max(0,Math.round(note.start)),length:Math.max(1,Math.round(note.length??12)),velocity:clamp(note.velocity??105,1,127)};track.notes.push(n);track.notes.sort((a,b)=>a.start-b.start||b.pitch-a.pitch);return n;}
export const totalTicks=song=>Math.max(1,song.measures)*Math.max(1,song.beats)*TICKS;
export const qtime=(tick,tempo)=>tick/48*60/tempo;
export function validateProject(obj){
 if(!obj||obj.format!=='poketools-music-v1'||!Array.isArray(obj.tracks))throw Error('Not a Poketools Music Studio project.');
 const s=makeSong(String(obj.name||'Untitled').slice(0,160));s.tempo=clamp(obj.tempo,30,300);s.beats=clamp(obj.beats,1,12);s.measures=clamp(obj.measures,1,256);s.volume=clamp(obj.volume??100,0,100);s.loop=!!obj.loop;
 s.source=obj.source&&typeof obj.source==='object'?{id:Number(obj.source.id)||0,name:String(obj.source.name||'')}:null;
 for(const tr of obj.tracks.slice(0,16)){
  const t=addTrack(s,{bankId:Math.round(Number(tr.instrument?.bankId)||0),program:Math.round(Number(tr.instrument?.program)||0)});
  t.name=String(tr.name||t.name).slice(0,120);t.mute=!!tr.mute;t.volume=clamp(tr.volume??100,0,100);t.pan=clamp(tr.pan??0,-100,100);
  for(const n of (tr.notes||[]).slice(0,20000))addNote(t,n);
 }
 return s;
}
const vlq=n=>{let v=Math.max(0,Math.round(n)),arr=[v&127];while(v>>=7)arr.unshift(128|(v&127));return arr;};
const w16=(a,v)=>a.push(v&255,(v>>8)&255);
const w32=(a,v)=>a.push(v&255,(v>>8)&255,(v>>16)&255,(v>>24)&255);
const be16=(a,v)=>a.push((v>>8)&255,v&255);
const be32=(a,v)=>a.push((v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255);
const chars=(a,s)=>{for(const c of s)a.push(c.charCodeAt(0));};
const chunk=(type,bytes)=>{const result=[];chars(result,type);be32(result,bytes.length);result.push(...bytes);return result;};
const u24=(a,v)=>a.push(v&255,(v>>>8)&255,(v>>>16)&255);
export function midi(song){
 const division=TICKS,head=[];be16(head,1);be16(head,song.tracks.length+1);be16(head,division);
 const meta=[0,255,81,3,...[(Math.round(60000000/song.tempo)>>>16)&255,(Math.round(60000000/song.tempo)>>>8)&255,Math.round(60000000/song.tempo)&255],0,255,88,4,song.beats,2,24,8,0,255,47,0];
 const tracks=[chunk('MTrk',meta)];
 song.tracks.forEach((tr,i)=>{
  const ch=i===9?15:i%16,events=[{time:0,priority:0,data:[0xC0|ch,tr.instrument.program&127]}];
  for(const n of tr.notes){events.push({time:n.start,priority:2,data:[0x90|ch,n.pitch,n.velocity]});events.push({time:n.start+n.length,priority:1,data:[0x80|ch,n.pitch,0]});}
  events.sort((a,b)=>a.time-b.time||a.priority-b.priority);
  let last=0;const data=[];for(const e of events){data.push(...vlq(e.time-last),...e.data);last=e.time;}data.push(0,255,47,0);tracks.push(chunk('MTrk',data));
 });
 const out=[];chars(out,'MThd');be32(out,6);out.push(...head);for(const c of tracks)out.push(...c);return Uint8Array.from(out);
}
export function sseq(song){
 if(song.tracks.length>16)throw Error('SSEQ cannot contain more than 16 tracks.');
 const ids=new Set(song.tracks.map(t=>t.instrument.bankId));if(ids.size!==1)throw Error('SSEQ requires a single instrument bank; export MIDI or JSON for mixed-bank songs.');
 const patterns=song.tracks.map((tr,i)=>{
  const list=[0x81,...vlq(tr.instrument.program),0xC7,0x00,0xC0,Math.round((tr.pan+100)*127/200)];
  if(i===0){list.push(0xE1);w16(list,song.tempo);}
  let pos=0;
  for(const n of [...tr.notes].sort((a,b)=>a.start-b.start||a.pitch-b.pitch)){
   if(n.start>pos){list.push(0x80,...vlq(n.start-pos));pos=n.start;}
   list.push(n.pitch,n.velocity,...vlq(n.length));
  }
  list.push(0xFF);return list;
 });
 const root=[];if(patterns.length>1){root.push(0xFE);w16(root,(1<<patterns.length)-1);for(let i=1;i<patterns.length;i++){root.push(0x93,i,0,0,0);}}
 // Track 0 executes the header. The other tracks are entered by 24-bit data offsets.
 const offsets=[];let cursor=root.length;for(const p of patterns){offsets.push(cursor);cursor+=p.length;}
 if(patterns.length>1)for(let i=1;i<patterns.length;i++){const p=3+(i-1)*5+2;root[p]=offsets[i]&255;root[p+1]=(offsets[i]>>>8)&255;root[p+2]=(offsets[i]>>>16)&255;}
 const data=[...root,...patterns.flat()];
 const out=[];chars(out,'SSEQ');w16(out,0xFEFF);w16(out,0x0100);w32(out,0x1c+data.length);w16(out,0x10);w16(out,1);
 chars(out,'DATA');w32(out,0x0c+data.length);w32(out,0x1c);out.push(...data);return Uint8Array.from(out);
}
export function importSequence(commands,{name,bankId,sequenceId=0,maxTicks=48*4*64,maxSteps=160000}={}){
 const song=makeSong(name||'Imported song');song.source={id:sequenceId,name:name||''};
 song.measures=8;
 let detectedTempo=120,usedSteps=0,limit=false;
 const pending=[{num:0,pc:0}],visited=new Set(),lanes=new Map();
 function lane(num,program){const key=num+':'+program;if(!lanes.has(key)){if(song.tracks.length>=16)return null;const t=addTrack(song,{bankId,program});t.name='DS track '+num+(lanesFor(num)>0?' · program '+program:'');lanes.set(key,t);}return lanes.get(key);}
 function lanesFor(n){return [...lanes.keys()].filter(k=>k.startsWith(n+':')).length;}
 const iter=new Map();
 for(let i=0;i<pending.length&&i<16;i++){
  const seed=pending[i];let idx=seed.pc,tick=0,program=0,transpose=0,noteWait=false,step=0,call=[],vol=127;
  const localStates=new Map();
  while(idx>=0&&idx<commands.length&&tick<maxTicks&&step<maxSteps){
   const c=commands[idx],at=idx;idx++;step++;usedSteps++;
   const key=at+':'+tick+':'+program;
   if((localStates.get(key)||0)>2){limit=true;break;}localStates.set(key,(localStates.get(key)||0)+1);
   switch(c.type){
    case 0x93:if(!pending.some(p=>p.num===c.track))pending.push({num:c.track,pc:c.offset});break;
    case 0x94:if(c.offset<=at&&tick>maxTicks-48*8){limit=true;idx=-1;}else idx=c.offset;break;
    case 0x95:if(call.length<6){call.push(idx);idx=c.offset;}break;
    case 0xFD:if(call.length)idx=call.pop();else idx=-1;break;
    case 0xFF:idx=-1;break;
    case 0x80:tick+=Math.max(0,c.duration||0);break;
    case 0x81:program=c.program;break;
    case 0xC3:transpose=c.transpose||0;break;
    case 0xC7:noteWait=!!c.enabled;break;
    case 0xC1:vol=c.volume;break;
    case 0xE1:if(!seed.num&&c.tempo&&tick===0)detectedTempo=c.tempo;break;
    default:
     if(c.type>=0&&c.type<=127){const n=lane(seed.num,program);if(n)addNote(n,{pitch:clamp(c.note+transpose,0,127),start:tick,length:Math.max(1,c.duration||1),velocity:clamp(Math.round((c.velocity??100)*vol/127),1,127)});if(noteWait)tick+=Math.max(1,c.duration||1);}
   }
  }
  if(step>=maxSteps||tick>=maxTicks)limit=true;
 }
 song.tempo=clamp(detectedTempo,30,300);
 const highest=Math.max(0,...song.tracks.flatMap(t=>t.notes.map(n=>n.start+n.length)));
 song.measures=clamp(Math.ceil(highest/(song.beats*TICKS))||8,1,256);
 return {song,truncated:limit,processed:usedSteps};
}
