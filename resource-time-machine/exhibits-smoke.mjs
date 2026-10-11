import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
try{
 const page=await browser.newPage({viewport:{width:1280,height:880}});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8765/resource-time-machine/",{waitUntil:"domcontentloaded"});
 for(const name of ["models.html","narc-lab.html","films.html","files.html"]){
   const anchor=await page.locator('a[href="./'+name+'"]').count();
   if(!anchor)throw Error("Homepage missing exhibit: "+name);
 }
 console.log("HUB exhibits found, all four links");
 await page.goto("http://127.0.0.1:8765/resource-time-machine/models.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>/Loaded true 3D geometry|Unable to display|HTTP |Cannot/.test(document.getElementById("status").textContent),{timeout:85000});
 let status=await page.locator("#status").innerText();
 if(!status.startsWith("Loaded true 3D geometry"))throw Error("3D opening model failed: "+status);
 const meshes=await page.locator("#stats").innerText();
 if(!/Triangles: [1-9]/.test(meshes))throw Error("No 3D model triangles: "+meshes);
 await page.locator("#family").selectOption("weather");
 await page.locator(".pick").first().click();
 await page.waitForFunction(()=>document.getElementById("status").textContent.startsWith("Loaded true 3D geometry"),{timeout:85000});
 console.log("3D loaded models",meshes);
 await page.goto("http://127.0.0.1:8765/resource-time-machine/narc-lab.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>/Archive decoded|Could not open archive/.test(document.getElementById("status").textContent),{timeout:90000});
 status=await page.locator("#status").innerText();
 if(!status.startsWith("Archive decoded"))throw Error("NARC opening failed: "+status);
 let count=await page.locator(".member").count();if(!count)throw Error("No NARC members parsed");
 const firstName=await page.locator("#title").innerText();
 await page.locator("[data-mode=binary]").click();
 const hex=await page.locator("#hex").innerText();
 if(hex.length<20)throw Error("Binary member preview empty");
 await page.locator("#archive").selectOption("titles");
 await page.waitForFunction(()=>/Archive decoded|Could not open archive/.test(document.getElementById("status").textContent),{timeout:85000});
 status=await page.locator("#status").innerText();
 if(!status.startsWith("Archive decoded"))throw Error("Title NARC failed: "+status);
 console.log("NARC archives decoded",count,"members in weather archive",firstName);
 await page.screenshot({path:"/tmp/pokegra-specialized-narc.png",fullPage:true});
 if(errors.length)throw Error("Browser errors: "+errors.slice(0,7).join(" | "));
 console.log("EXHIBIT_BROWSER_CHECK_PASS");
}finally{await browser.close()}
