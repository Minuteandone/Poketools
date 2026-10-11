
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1250,height:890}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/failed to load module|SyntaxError|Unexpected token/.test(m.text()))errors.push(m.text());});
 const base='http://127.0.0.1:8765/resource-time-machine/';
 async function visit(url,label,target,timeout=100000){
  await page.goto(base+url,{waitUntil:'domcontentloaded'});
  try{await page.waitForFunction(x=>document.getElementById('status')?.textContent.includes(x),target,{timeout});}
  catch(e){throw Error(label+' failed: '+await page.locator('#status').innerText()+' / '+errors.join(' ; ').slice(0,550));}
 }
 async function pixels(sel,min){
  const res=await page.locator(sel).evaluate(cv=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let painted=0;for(let i=3;i<d.length;i+=4)if(d[i])painted++;return {w:cv.width,h:cv.height,painted};});
  if(res.painted<min)throw Error(sel+' empty source graphics '+JSON.stringify(res));
  return res;
 }
 for(const [file,label] of [
  ['field-model-atlas.html','Field Model Atlas'],
  ['cutscene-studio.html','Cutscene Model Studio'],
  ['overworld-terrain.html','Overworld Terrain Lab']
 ]){
  await visit(file,label,'Loaded true 3D geometry',90000);
  const count=await page.locator('#models button').count();
  if(count<20)throw Error(label+' only has '+count+' list entries');
  const stats=await page.locator('#stats').innerText();
  if(!stats.includes('Triangles:'))throw Error(label+' did not render real mesh counts');
  console.log('THREE_D_PASS',label,'entries',count,'stats',stats.replace(/\n/g,' ').slice(0,130));
  await page.screenshot({path:'/tmp/extended-'+file.replace('.html','.png')});
 }
 await visit('musical-accessories.html','Musical accessories','Real Musical accessory decoded',45000);
 const musical=await pixels('#art',20);
 const origin=await page.locator('#item-title').innerText();
 const detail=await page.locator('#details').innerText();
 if(!origin.includes('ピンク')||!detail.includes('Source style:'))throw Error('Item metadata not displayed '+origin+' '+detail);
 console.log('MUSICAL_PASS',musical,origin,detail.slice(0,125));
 await page.screenshot({path:'/tmp/extended-musical.png'});
 await visit('move-effects.html','Move Effects','Rendered real move-effect source graphics',45000);
 const art=await pixels('#art',100),sheet=await pixels('#sheet',100);
 const source=await page.locator('#sequence').innerText();
 if(!source.includes('EFFSEQ'))throw Error('Not showing matched original effect script: '+source.slice(0,180));
 console.log('MOVE_EFFECT_PASS',art,sheet,'script chars',source.length);
 await page.screenshot({path:'/tmp/extended-effects.png'});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 for(const filename of ['field-model-atlas','cutscene-studio','overworld-terrain','musical-accessories','move-effects']){
  if(await page.locator('a[href="./'+filename+'.html"]').count()<1)throw Error('Homepage missing '+filename);
 }
 if(errors.length)throw Error('Unexpected browser JS errors '+errors.join(' | '));
 console.log('EXTENDED_EXHIBITS_PASS');
}finally{await browser.close();}
