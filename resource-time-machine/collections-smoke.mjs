
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function visit(name,message){
  await page.goto('http://127.0.0.1:8765/resource-time-machine/'+name+'.html',{waitUntil:'domcontentloaded'});
  try{await page.waitForFunction(expected=>document.getElementById('status').textContent.includes(expected),message,{timeout:55000});}
  catch(e){throw Error(name+' failed to render: '+await page.locator('#status').innerText()+' | '+errors.join(' | '));}
 }
 async function pixels(selector,min){
  const stats=await page.locator(selector).evaluate(c=>{let nonempty=0;const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   for(let i=3;i<data.length;i+=4)if(data[i])nonempty++;return {width:c.width,height:c.height,nonempty};});
  if(stats.nonempty<min)throw Error(selector+' has insufficient source pixels '+JSON.stringify(stats));
  return stats;
 }
 await visit('wallpapers','Original PC wallpaper reconstructed.');
 const box=await pixels('#preview',300);
 await page.locator('#query').fill('wpex01');
 await page.locator('#gallery button').first().click();
 await page.waitForFunction(()=>document.getElementById('title').textContent.includes('Extra wallpaper'),{timeout:30000});
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Original PC wallpaper reconstructed.'),{timeout:55000});
 const extra=await pixels('#preview',300);console.log('BOX_WALLPAPERS_PASS',box,extra);
 await page.screenshot({path:'/tmp/source-collection-wallpapers.png'});
 await visit('monolith','Monolith backgrounds reconstructed from original tiles.');
 // Upper and lower original files download independently. Do not mistake
 // one canvas finishing first for a failed second renderer.
 try{
  await page.waitForFunction(()=>{
   const ready=id=>{const c=document.getElementById(id),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let count=0;for(let i=3;i<d.length;i+=4)if(d[i])count++;return count>=300;};
   return ready('upperCanvas')&&ready('lowerCanvas');
  },null,{timeout:55000});
 }catch(e){throw Error('Monolith images incomplete: '+await page.locator('#status').innerText()+' | upper '+await page.locator('#upperStats').innerText()+' | lower '+await page.locator('#lowerStats').innerText());}
 const upper=await pixels('#upperCanvas',300),lower=await pixels('#lowerCanvas',300);
 await page.locator('#lower').selectOption('rireki');
 await page.waitForFunction(()=>document.getElementById('lowerCanvas').height===512,{timeout:55000});
 console.log('MONOLITH_PASS',upper,lower,'history 256x512');
 await page.screenshot({path:'/tmp/source-collection-monolith.png'});
 await visit('party-icons','Original icon rendered with palette bank');
 const icon=await pixels('#preview',15);
 const sheet=await pixels('#sheet',25);
 const metadata=await page.locator('#metadata').innerText();
 if(!metadata.includes('ATTR bank 2'))throw Error('Wrong icon ATTR palette bank '+metadata);
 await page.locator('#frame').selectOption('1');
 await pixels('#preview',15);
 await page.locator('#play').click();
 if(await page.locator('#play').getAttribute('aria-pressed')!=='true')throw Error('Animation did not start');
 await page.locator('#play').click();
 console.log('PARTY_ICON_PASS',icon,sheet,metadata);
 await page.screenshot({path:'/tmp/source-collection-icons.png'});
 if(errors.length)throw Error('Browser errors: '+errors.join(' | '));
 console.log('SOURCE_COLLECTIONS_PASS');
}finally{await browser.close();}
