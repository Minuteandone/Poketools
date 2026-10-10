import {chromium} from "playwright";
import fs from "node:fs";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
 const p=await browser.newPage({viewport:{width:1280,height:1050}});
 const src=await p.goto("http://127.0.0.1:8765/sprite-history/",{waitUntil:"domcontentloaded"});
 const revisions=await p.evaluate(async()=>{
   const db=await(await fetch("./revisions.json")).json();
   const entry=db.entries.find(e=>e.id===1&&!e.form);
   const idx=entry.revs.findIndex(e=>db.commits[e[0]].sha.startsWith("b9c3a57e"));
   return{idx,count:entry.revs.length,date:idx>=0?db.commits[entry.revs[idx][0]].date:null};
 });
 if(revisions.idx<0)throw Error("missing Bulba June 2010 commit "+JSON.stringify(revisions));
 await p.evaluate(idx=>{location.hash="001::"+idx},revisions.idx);
 await p.reload({waitUntil:"domcontentloaded"});
 await p.waitForFunction(()=>document.getElementById("load-status").textContent.startsWith("Loaded"),{timeout:120000});
 await p.locator("#animate").uncheck();
 await p.locator("#compare").uncheck();
 await p.screenshot({path:"sprite-history/debug/bulbasaur-browser-full.png"});
 const canvas=await p.locator("#after-canvas").evaluate(cv=>cv.toDataURL("image/png"));
 fs.writeFileSync("sprite-history/debug/bulbasaur-browser-assembled.png",Buffer.from(canvas.slice(canvas.indexOf(",")+1),"base64"));
 console.log("CAPTURED",JSON.stringify({revision:revisions,status:await p.locator("#load-status").innerText(),map:await p.locator("#map").inputValue()}));
}finally{await browser.close()}
