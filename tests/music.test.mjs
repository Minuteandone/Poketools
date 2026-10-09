import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeSong,addTrack,addNote,validateProject,totalTicks,importSequence,midi,sseq} from '../music/core.js';

test('touch DAW UI and local-ROM imports are wired',()=>{
 const html=readFileSync(new URL('../music/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../music/app.js',import.meta.url),'utf8');
 for(const id of ['rom','template','name','tempo','beats','measures','volume','loop','instrumentSearch','instrument','variant','roll','tool','noteLength','velocity','preview','addTrack','exportSseq','exportMidi','saveProject','openProject'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/findSdat/);assert.match(js,/new Audio\.SDAT/);assert.match(js,/new Audio\.SBNK/);assert.match(js,/new Audio\.SWAR/);assert.match(js,/new Audio\.SSEQ/);
 assert.match(js,/BW_SWAV_LABELS/);assert.match(js,/setPointerCapture/);
});
test('notes can be created, sorted and serialized',()=>{
 const s=makeSong('New MSM idea'),t=addTrack(s,{bankId:8,program:3});
 addNote(t,{pitch:67,start:48,length:24});addNote(t,{pitch:60,start:0,length:12});
 assert.equal(t.notes[0].pitch,60);
 assert.equal(totalTicks(s),8*4*48);
 const saved=validateProject(JSON.parse(JSON.stringify(s)));
 assert.equal(saved.tracks[0].notes.length,2);
 assert.equal(saved.tracks[0].instrument.bankId,8);
});
test('single-bank composition exports a real SSEQ header and command section',()=>{
 const s=makeSong('Test');
 addNote(addTrack(s,{bankId:15,program:1}),{pitch:60,start:0,length:48});
 addNote(addTrack(s,{bankId:15,program:2}),{pitch:65,start:48,length:24});
 const b=sseq(s),v=new DataView(b.buffer);
 assert.equal(new TextDecoder().decode(b.slice(0,4)),'SSEQ');
 assert.equal(new TextDecoder().decode(b.slice(16,20)),'DATA');
 assert.equal(v.getUint32(8,true),b.length);
 assert.equal(v.getUint32(20,true),b.length-16);
 assert.equal(v.getUint32(24,true),0x1c);
 assert.equal(b[28],0xfe); // allocate tracks
 assert.equal(b[31],0x93); // open track 1
 assert.equal(b[32],1);
 const track1=b[33]|b[34]<<8|b[35]<<16;
 assert.ok(track1<b.length-28);
 assert.equal(b[28+track1],0x81); // program change for track 1
});
test('mixing banks cannot be misrepresented as a single-bank DS SSEQ',()=>{
 const s=makeSong();addTrack(s,{bankId:1,program:2});addTrack(s,{bankId:4,program:3});
 assert.throws(()=>sseq(s),/single instrument bank/);
});
test('MIDI is a valid type 1 SMF with one conductor and one lane',()=>{
 const s=makeSong();addNote(addTrack(s,{bankId:6,program:2}),{pitch:62,start:0,length:24});
 const b=midi(s),v=new DataView(b.buffer);
 assert.equal(new TextDecoder().decode(b.slice(0,4)),'MThd');
 assert.equal(v.getUint32(4,false),6);
 assert.equal(v.getUint16(8,false),1);
 assert.equal(v.getUint16(10,false),2);
 assert.equal(new TextDecoder().decode(b.slice(14,18)),'MTrk');
});
test('SSEQ command importer preserves note timeline, tracks, programs, fanfare metadata',()=>{
 const cmds=[
 {type:0x93,track:1,offset:6},{type:0xE1,tempo:140},{type:0x81,program:3},
 {type:0,note:60,velocity:100,duration:24},{type:0x80,duration:24},{type:0xFF},
 {type:0x81,program:4},{type:0,note:72,velocity:120,duration:36},{type:0x80,duration:36},{type:0xFF}
 ];
 const r=importSequence(cmds,{name:'Fanfare',sequenceId:18,bankId:20});
 assert.equal(r.song.source.id,18);assert.equal(r.song.tempo,140);
 assert.equal(r.song.tracks.length,2);
 assert.equal(r.song.tracks[0].notes[0].pitch,60);
 assert.equal(r.song.tracks[1].notes[0].pitch,72);
 assert.equal(r.song.tracks[1].instrument.program,4);
});
test('imported backward jumps stop at a safety cap',()=>{
 const r=importSequence([{type:0,note:60,velocity:80,duration:12},{type:0x80,duration:12},{type:0x94,offset:0}],{bankId:1,maxTicks:96,maxSteps:500});
 assert.ok(r.truncated);assert.ok(r.song.tracks[0].notes.length>0);
});
