
import {bytes,revisions,repoUrl} from './shared.js';
import {parseTiles,parsePalette,parseScreen,renderMap,renderSheet,decodeBmp,copyCanvas,saveCanvas} from './source-tiles.js';
const $=id=>document.getElementById(id);
export function launchQuickViewer(config){
 const items=config.entries,root=config.root,cache=new Map();
 let current=items.find(x=>x.id===config.initial)||items[0],selectedRef='main',mode='layout',active=null,serial=0,filtered=items.slice(),index=0;
 let modeIsBmp=false;
 function stat(text,bad=false){const n=$('status');n.textContent=text;n.classList.toggle('error',bad);}
 function chosenPath(item){return root+item.files.at(-1);}
 async function build(item,ref='main'){
  const key=item.id+'@'+ref;if(cache.has(key))return cache.get(key);
  const promise=(async()=>{
   const files=item.files.map(f=>root+f);
   if(item.kind==='bmp'){
    const image=decodeBmp(await bytes(files[0],ref));
    return {layout:image,tiles:image,kind:'bmp',palette:0,count:0,map:null};
   }
   if(item.files.length!==3)throw Error('Invalid source trio definition');
   const [raw,pal,screen]=await Promise.all(files.map(p=>bytes(p,ref)));
   const tiles=parseTiles(raw),colors=parsePalette(pal),map=parseScreen(screen);
   return {layout:renderMap(tiles,colors,map),tiles:renderSheet(tiles,colors),kind:'tiles',palette:colors.length,count:tiles.count,map};
  })();
  cache.set(key,promise);if(cache.size>55)cache.delete(cache.keys().next().value);
  try{return await promise;}catch(e){cache.delete(key);throw e;}
 }
 function list(){
  const q=$('query').value.trim().toLowerCase(),g=$('group').value;
  filtered=items.filter(x=>(g==='all'||x.group===g)&&(x.name.toLowerCase().includes(q)||x.id.toLowerCase().includes(q)||x.files.some(f=>f.toLowerCase().includes(q))));
  index=Math.max(0,filtered.findIndex(x=>x.id===current.id));
  $('counter').textContent=filtered.length+' of '+items.length+' layouts';
  $('prev').disabled=filtered.length===0||index===0;$('next').disabled=filtered.length===0||index===filtered.length-1;
  $('items').replaceChildren(...filtered.map(item=>{
   const button=document.createElement('button');button.className=item.id===current.id?'active':'';
   const title=document.createElement('span');title.textContent=item.name;const category=document.createElement('small');category.textContent=item.group;
   button.append(title,category);button.onclick=()=>choose(item);return button;
  }));
 }
 function metadata(a){
  const entries=[a.layout.width+' × '+a.layout.height+' image pixels',a.kind==='bmp'?'Source 24-bit BMP':a.count+' source tiles',a.kind==='bmp'?'Uncompressed screenshot':a.palette+' palette entries'];
  $('stats').replaceChildren(...entries.map(s=>{const node=document.createElement('span');node.textContent=s;return node;}));
 }
 async function paint(){
  const token=++serial,item=current,ref=selectedRef,activeMode=mode;
  const isBmp=item.kind==='bmp';modeIsBmp=isBmp;
  $('mode').disabled=isBmp;if(isBmp){mode='layout';$('mode').value='layout';}
  $('selected-name').textContent=item.name;
  $('original').href=repoUrl(chosenPath(item),ref);
  $('paths').textContent=item.files.map(f=>root+f).join('\n')+'\n\nRevision: '+ref+'\nImages are original source files, not recreated mockups.';
  $('compare-panel').hidden=ref==='main'||!$('compare').checked;
  stat('Reading original source graphics and mapping tile indices…');
  try{
   const data=await build(item,ref);if(token!==serial)return;
   active=data;copyCanvas($('preview'),data[mode]);metadata(data);
   if(!$('compare-panel').hidden){const latest=await build(item,'main');if(token!==serial)return;copyCanvas($('comparison'),latest[mode]);}
   stat('Original '+(data.kind==='bmp'?'BMP artwork':'Nintendo DS layout')+' rendered successfully.');
  }catch(e){if(token!==serial)return;active=null;stat('Cannot render '+item.name+': '+e.message,true);}
 }
 async function choose(item){
  current=item;selectedRef='main';$('revision').replaceChildren(new Option('Latest source','main'));list();paint();
  const selection=item.id;
  try{const history=await revisions(chosenPath(item));if(current.id!==selection)return;
   $('revision').replaceChildren(new Option('Latest source','main'),...history.map(x=>new Option(x.date+' · '+x.sha.slice(0,8),x.sha)));
  }catch{/* Main branch source can still render when revisions are rate-limited. */}
 }
 const groups=[...new Set(items.map(x=>x.group))];
 $('group').replaceChildren(new Option('Every category','all'),...groups.map(x=>new Option(x,x)));
 $('query').oninput=list;$('group').onchange=list;
 $('prev').onclick=()=>{if(index>0)choose(filtered[index-1]);};
 $('next').onclick=()=>{if(index<filtered.length-1)choose(filtered[index+1]);};
 $('revision').onchange=()=>{selectedRef=$('revision').value;paint();};
 $('mode').onchange=()=>{mode=$('mode').value;paint();};
 $('compare').onchange=paint;
 $('export').onclick=()=>{if(active)saveCanvas($('preview'),config.id+'-'+current.id+'-'+mode+'.png');};
 choose(current);
}
