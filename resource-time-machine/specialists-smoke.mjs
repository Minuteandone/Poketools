import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const results=[];
try{
const page=await browser.newPage({viewport:{width:1440,height:960}});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
async function visit(route,expect,status){
 await page.goto("http://127.0.0.1:8765/resource-time-machine/"+route,{waitUntil:"domcontentloaded"});
 await page.waitForFunction(([selector,match])=>{
  const s=document.querySelector(selector)?.textContent||"";
  return s.includes(match)||s.includes("HTTP ")||s.includes("No complete")||s.includes("No event source");
 },[status,expect],{timeout:95000});
 const message=await page.locator(status).innerText();
 if(!message.includes(expect))throw Error(route+" did not load: "+message);
 return message;
}
let status=await visit("events.html","Loaded ","#status");
const eventCount=await page.locator("#events .event").count();
const coords=await page.locator("#map").evaluate(c=>{
 const arr=c.getContext("2d").getImageData(0,0,c.width,c.height).data;return arr.length/4
});
if(eventCount<2)throw Error("Event map has no selectable source objects: "+eventCount);
results.push({viewer:"field events",status,eventCount,canvasPixels:coords});
await page.screenshot({path:"/tmp/time-machine-event-atlas.png"});
status=await visit("dialogue.html","Loaded ","#status");
const dialogueRows=await page.locator("#lines tr").count();
if(dialogueRows<1)throw Error("Dialogue viewer has no message rows");
results.push({viewer:"dialogue",status,rows:dialogueRows});
await page.screenshot({path:"/tmp/time-machine-dialogue.png"});
status=await visit("items.html","Decoded original","#status");
const art=await page.locator("#preview").evaluate(c=>{
const a=c.getContext("2d").getImageData(0,0,c.width,c.height).data;
let solid=0;for(let i=3;i<a.length;i+=4)if(a[i])solid++;
return {w:c.width,h:c.height,solid};
});
if(art.solid<25)throw Error("Item sprite wasn't rendered: "+JSON.stringify(art));
results.push({viewer:"item icon",status,art});
await page.screenshot({path:"/tmp/time-machine-item-icons.png"});
if(errors.length)throw Error("Browser errors: "+errors.slice(0,8).join("; "));
console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
