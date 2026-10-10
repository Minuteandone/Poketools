import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
const page=await browser.newPage({viewport:{width:1360,height:920}});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
await page.goto("http://127.0.0.1:8765/resource-time-machine/",{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>document.getElementById("counts").textContent.includes("files"),{timeout:180000});
const fileCount=await page.locator("#counts").innerText();
if(!/2\d,\d{3}/.test(fileCount))throw Error("Resource catalog incomplete: "+fileCount);
await page.locator("#search").fill("title/fix_blk_logo.bmp");
await page.locator(".result").first().click();
await page.waitForFunction(()=>document.getElementById("load-status").textContent.includes("Showing original"),{timeout:90000});
const bmp=await page.locator("#new-preview img").count();
if(bmp!==1)throw Error("BMP image didn't render");
await page.locator("#search").fill("op_demo/op000.tga");
await page.locator(".result").first().click();
await page.waitForFunction(()=>document.getElementById("load-status").textContent.includes("Showing original"),{timeout:90000});
const pixels=await page.locator("#new-preview canvas").evaluate(c=>{
 const a=c.getContext("2d").getImageData(0,0,c.width,c.height).data;
 let pixels=0;for(let i=3;i<a.length;i+=4)if(a[i]>0)pixels++;
 return {w:c.width,h:c.height,pixels};
});
if(pixels.w!==256||pixels.h!==170||pixels.pixels<1000)throw Error("TGA preview was blank: "+JSON.stringify(pixels));
await page.locator("#search").fill("eventdata/data/c01.mev");
await page.locator(".result").first().click();
await page.waitForFunction(()=>document.getElementById("load-status").textContent.includes("Showing original"),{timeout:90000});
const text=await page.locator("#new-preview pre").innerText();
if(!text.includes("#event data"))throw Error("MEV event source not displayed correctly");
await page.locator("#search").fill("musical/dressup/anime_ue.ncg");
await page.locator(".result").first().click();
await page.waitForFunction(()=>document.getElementById("load-status").textContent.includes("Showing original")||document.getElementById("load-status").classList.contains("error"),{timeout:90000});
const ncgr=await page.locator("#load-status").innerText();
console.log(JSON.stringify({files:fileCount,bmp,basicTga:pixels,mevContainsEventData:true,ncgrStatus:ncgr,errors},null,2));
await page.screenshot({path:"/tmp/resource-time-machine.png"});
if(errors.length)throw Error("JS errors: "+errors.join("; "));
}finally{await browser.close();}
