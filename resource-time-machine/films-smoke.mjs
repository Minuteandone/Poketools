import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 const page=await browser.newPage({viewport:{width:1360,height:960}});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8765/resource-time-machine/films.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.getElementById("metrics").textContent.includes("995 latest-version frames"),{timeout:90000});
 let status=await page.locator("#status").innerText();
 await page.waitForFunction(()=>document.getElementById("status").textContent.includes("Showing original frame"),{timeout:90000});
 const opacity=await page.locator("#after").evaluate(c=>{
    let n=0;const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;
    for(let i=3;i<d.length;i+=4)if(d[i])n++;
    return n;
 });
 if(opacity<1500)throw Error("Opening frame is blank, visible="+opacity);
 const initial=await page.locator("#frame-number").innerText();
 await page.locator("#next").click();
 await page.waitForFunction(()=>document.getElementById("status").textContent.includes("Showing original frame"),{timeout:90000});
 const after=await page.locator("#frame-number").innerText();
 if(initial===after)throw Error("Next frame did not advance");
 await page.locator("#film").selectOption("gf_logo");
 await page.waitForFunction(()=>document.getElementById("status").textContent.includes("Showing original frame"),{timeout:90000});
 await page.locator("#compare").check();
 await page.waitForFunction(()=>!document.getElementById("before-stage").classList.contains("hide"),{timeout:10000});
 const history=await page.locator(".version").count();
 if(history<5)throw Error("Historical revisions missing");
 await page.screenshot({path:"/tmp/bw-film-timeline.png",fullPage:true});
 if(errors.length)throw Error("Browser errors: "+errors.join("; "));
 console.log(JSON.stringify({passed:true,first:initial,next:after,visible:opacity,historicalRevisions:history,film:"Game Freak logo",status:await page.locator("#status").innerText()}));
}finally{await browser.close();}
