import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function pixel(selector){
  return page.locator(selector).evaluate(canvas=>{
   const p=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let opaque=0;for(let i=3;i<p.length;i+=4)if(p[i])opaque++;
   return {width:canvas.width,height:canvas.height,opaque};
  });
 }
 async function complete(title){
  try{await page.waitForFunction(()=>/original (Nintendo DS layout|BMP artwork) rendered successfully/i.test(document.getElementById('status').textContent),null,{timeout:45000});}
  catch(err){throw Error(title+' failed: '+await page.locator('#status').innerText()+'; page errors: '+errors.join(' / '));}
  const result=await pixel('#preview');
  if(result.opaque<16)throw Error(title+' produced no visible art: '+JSON.stringify(result));
  console.log('QUICK_WIN_RENDER',title,JSON.stringify(result));return result;
 }
 async function navigate(file){
  await page.goto('http://127.0.0.1:8765/resource-time-machine/'+file+'.html',{waitUntil:'domcontentloaded'});
  return complete(file);
 }
 async function choose(text,label){
  const item=page.locator('#items button').filter({hasText:text}).first();
  if(await item.count()!==1)throw Error('Missing source selection: '+label);
  await item.click();await complete(label);
 }
 await navigate('mail-gallery');
 await choose('Mail design 011','mail last stationery');
 await choose('Mailbox · lower','mailbox base');
 await page.screenshot({path:'/tmp/quick-mail.png'});
 await navigate('title-lab');
 await choose('White · logo layer','white title logo');
 await choose('fix blk logo','original black logo BMP');
 await page.screenshot({path:'/tmp/quick-title.png'});
 await navigate('trainer-cards');
 await choose('White card palette 0','White trainer card');
 await choose('Badge background 01','Gym Badge backdrop');
 await page.screenshot({path:'/tmp/quick-trainer.png'});
 await navigate('pokedex-ui');
 await choose('Species list · upper base','Pokédex list');
 await choose('Search · upper base','Pokédex search');
 await page.screenshot({path:'/tmp/quick-pokedex.png'});
 await page.locator('#mode').selectOption('tiles');
 await complete('raw source tiles');
 if(errors.length)throw Error('JavaScript errors: '+errors.join(' | '));
 console.log('QUICK_WIN_VIEWERS_PASS');
}finally{await browser.close()}
