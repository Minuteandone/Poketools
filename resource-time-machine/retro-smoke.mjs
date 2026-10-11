import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function check(name,minimum,expected){
  await page.goto('http://127.0.0.1:8765/resource-time-machine/'+name+'.html',{waitUntil:'domcontentloaded'});
  try{
   await page.waitForFunction(()=>/Rendered real|Decoded original footprint|Original source screenshot reconstructed|HTTP |Invalid|Broken|Truncated|No original|Only uncompressed|Expected original|No manual|Catalog/.test(document.getElementById('status').textContent),null,{timeout:90000});
  }catch(e){throw Error(name+' timed out; current status: '+await page.locator('#status').innerText()+'; page errors: '+errors.join(' / '));}
  const message=await page.locator('#status').innerText();
  if(!message.includes(expected))throw Error(name+' failed: '+message);
  const result=await page.locator('#image').evaluate(c=>{
   const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let nonEmpty=0;
   for(let i=3;i<pixels.length;i+=4)if(pixels[i])nonEmpty++;
   return {w:c.width,h:c.height,nonEmpty};
  });
  if(result.nonEmpty<minimum)throw Error(name+' not painted: '+JSON.stringify(result));
  console.log('CHECK',name,message,result);
  await page.screenshot({path:'/tmp/poketools-'+name+'.png'});
 }
 await check('seasons',200,'Rendered real');
 await page.locator('#mode').selectOption('tiles');if(await page.locator('#image').evaluate(c=>c.width)<128)throw Error('Source tile sheet mode broken');
 await check('footprints',5,'Decoded original footprint');
 await check('manuals',1000,'Original source screenshot reconstructed');
 if(errors.length)throw Error('Page errors: '+errors.slice(0,5).join(' | '));
 console.log('RETRO_EXHIBITS_PASS');
}finally{await browser.close();}
