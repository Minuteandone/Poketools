import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAnimationTick, DS_ANIMATION_HZ} from './playback-clock.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);

test('original playback advances at DS VBlank timing (not 26.7 ticks/s)',()=>{
 let t=0;
 for(let i=0;i<60;i++) t=advanceAnimationTick(t,1000/60,1);
 close(t, DS_ANIMATION_HZ);
});
test('frame rate independence',()=>{
 let smooth=0, slow=0;
 for(let i=0;i<120;i++) smooth=advanceAnimationTick(smooth,1000/120);
 for(let i=0;i<30;i++) slow=advanceAnimationTick(slow,1000/30);
 close(smooth, slow);
});
test('rate controls preserve timing',()=>{
 close(advanceAnimationTick(4,100,2),4+DS_ANIMATION_HZ*0.2);
 close(advanceAnimationTick(4,100,0.5),4+DS_ANIMATION_HZ*0.05);
});
test('first frame and background stalls are safe',()=>{
 close(advanceAnimationTick(30,0),30);
 close(advanceAnimationTick(30,-10),30);
 close(advanceAnimationTick(30,20000),30+DS_ANIMATION_HZ*0.25);
});
