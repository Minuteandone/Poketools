
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1250,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root='http://127.0.0.1:8765/resource-time-machine/';
 async function open(filename,expected){
  await page.goto(root+filename+'.html',{waitUntil:'domcontentloaded'});
  try{await page.waitForFunction(t=>document.getElementById('status').textContent.includes(t),expected,{timeout:65000});}
  catch(e){throw Error(filename+' failed '+await page.locator('#status').innerText()+' | '+errors.join(' | '));}
 }
 async function pixels(selector,min){
  const d=await page.locator(selector).evaluate(c=>{const raw=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<raw.length;i+=4)if(raw[i])n++;return {w:c.width,h:c.height,n};});
  if(d.n<min)throw Error(selector+' rendered no meaningful pixels '+JSON.stringify(d));return d;
 }
 await open('field-textures','Original field-character texture pixels rendered.');
 const field=await pixels('#preview',30);const sheet=await pixels('#sheet',30);
 if(await page.locator('#gallery button').count()<10)throw Error('Field atlases grid is missing');
 console.log('FIELD_TEXTURES_PASS',field,sheet);
 await page.screenshot({path:'/tmp/related-field-textures.png'});
 await open('battle-ui','Original battle background screen layer reconstructed.');
 const bg=await pixels('#preview',100),tiles=await pixels('#sheet',100);
 await page.locator('#query').fill('battle_w_bg0a');
 if(await page.locator('#gallery button').count()<1)throw Error('Cannot filter battle UI map variants');
 console.log('BATTLE_UI_PASS',bg,tiles);
 await page.screenshot({path:'/tmp/related-battle-ui.png'});
 await open('trainer-records','Original trainer CSV record decoded');
 const selected=await page.locator('#name').innerText();
 if(await page.locator('#fields > div').count()<8)throw Error('Trainer field cards not built');
 await page.locator('#query').fill('ケンタ');
 await page.waitForFunction(()=>document.getElementById('pager').textContent.includes('records'),null,{timeout:12000});
 if(await page.locator('#gallery button').count()<1)throw Error('Trainer search failed on original Japanese field value');
 await page.locator('#gallery button').first().click();
 if(! (await page.locator('#name').innerText()).includes('ケンタ'))throw Error('Selected trainer name not populated');
 console.log('TRAINER_RECORDS_PASS',selected,await page.locator('#name').innerText());
 await page.screenshot({path:'/tmp/related-trainer-records.png'});
 await page.goto(root);
 for(const file of ['field-textures','battle-ui','trainer-records'])if(await page.locator('a[href="./'+file+'.html"]').count()<1)throw Error('Museum missing '+file);
 if(errors.length)throw Error('JavaScript browser exceptions '+errors.join(' | '));
 console.log('RELATED_EXHIBITS_PASS');
}finally{await browser.close();}
