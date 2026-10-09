import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const animation=readFileSync(new URL('../src/editor-v3.js',import.meta.url),'utf8');
const begin=html.indexOf('<script>// src/binary.js')+8;
const end=html.lastIndexOf('</script></body></html>');
assert.ok(begin>8&&end>begin,'Expected embedded studio script');
const inline=html.slice(begin,end).replace(/\bbind\(\);\s*$/,'');
const load=new Function(inline+'\n'+animation+'\nreturn {Ncer,installMappedCell,availableForms,POKEMON_NAMES,state,fourcc,w16,w32,sectionList};');
const {Ncer,installMappedCell,availableForms,POKEMON_NAMES,state,fourcc,w16,w32,sectionList}=load();
installMappedCell();

function fixture(){
  // Small synthetic NCER; no assets from a game or ROM.
  const b=new Uint8Array(64);
  fourcc(b,0,'RECN');w32(b,8,64);w16(b,14,1);
  fourcc(b,16,'KBEC');w32(b,20,48);w16(b,24,1);w32(b,28,24);
  w16(b,48,1);w16(b,50,7);w32(b,52,0);
  w16(b,56,0x1234);w16(b,58,0x5678);w16(b,60,0x09ab);
  return new Ncer(b);
}
test('touch editor and sprite mapping controls exist',()=>{
  for(const id of ['species','form','formGroup','dragMode','partSource','newPartCell','sheetMapCanvas','mapSize','mapTileX','mapTileY','rotateMinus','rotatePlus','scaleMinus','scalePlus','cellMinus','cellPlus']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.ok(html.includes('src="./src/editor-v3.js"'));
  assert.ok(html.includes('oams.push({attr0:a0,attr1:a1,attr2:a2'));
});
test('new cell roundtrips and preserves existing OAM attributes',()=>{
  const nc=fixture();
  assert.equal(nc.addMappedCell({tileX:1,tileY:2,width:16,height:16},{tileCount:1024}),1);
  const parsed=new Ncer(nc.data);
  assert.equal(parsed.cells.length,2);
  assert.equal(parsed.cells[0].attr,7);
  const old=parsed.cells[0].oams[0],added=parsed.cells[1].oams[0];
  assert.deepEqual([old.attr0,old.attr1,old.attr2],[0x1234,0x5678,0x09ab]);
  assert.deepEqual([added.tile,added.width,added.height,added.x,added.y],[65,16,16,-8,-8]);
  assert.equal(sectionList(nc.data)[0].size,nc.data.length-16);
});
test('multiple additions can be parsed again',()=>{
  const nc=fixture(),tiles={tileCount:1024};
  assert.equal(nc.addMappedCell({tileX:0,tileY:0,width:8,height:8},tiles),1);
  assert.equal(nc.addMappedCell({tileX:4,tileY:4,width:32,height:16},tiles),2);
  assert.deepEqual(new Ncer(nc.data).cells.map(c=>c.oams.length),[1,1,1]);
});
test('invalid mapping rectangles are rejected',()=>{
  assert.throws(()=>fixture().addMappedCell({tileX:31,tileY:1,width:32,height:32},{tileCount:1024}),/outside/);
  assert.throws(()=>fixture().addMappedCell({tileX:0,tileY:0,width:24,height:24},{tileCount:1024}),/supported/);
});
test('all 649 species are named',()=>{
  assert.equal(POKEMON_NAMES.length,650);
  assert.ok(POKEMON_NAMES.slice(1).every(Boolean));
  assert.equal(POKEMON_NAMES[25],'Pikachu');
  assert.equal(POKEMON_NAMES[649],'Genesect');
});
test('form lists are version-aware',()=>{
  state.nds={isSequel:false};
  assert.equal(availableForms(201).length,28);
  assert.equal(availableForms(479).length,6);
  assert.deepEqual(availableForms(641),['Normal']);
  state.nds.isSequel=true;
  assert.deepEqual(availableForms(641),['Incarnate','Therian']);
  assert.equal(availableForms(646).length,3);
  assert.deepEqual(availableForms(25),['Normal']);
});
