import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"]});
try{
 const page=await browser.newPage({viewport:{width:1280,height:880}});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8765/resource-time-machine/",{waitUntil:"domcontentloaded"});
 for(const name of ["models.html","narc-lab.html","films.html","files.html","events.html","dialogue.html","items.html","battle-stages.html","seasons.html","footprints.html","manuals.html","wallpapers.html","party-icons.html","monolith.html","mail-gallery.html","title-lab.html","trainer-cards.html","pokedex-ui.html"]){
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
 await page.goto("http://127.0.0.1:8765/resource-time-machine/battle-stages.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>/Loaded true 3D geometry|Unable to display|HTTP |Cannot/.test(document.getElementById("status").textContent),{timeout:85000});
 const battleStatus=await page.locator("#status").innerText();
 if(!battleStatus.startsWith("Loaded true 3D geometry"))throw Error("3D battle stage failed: "+battleStatus);
 const battleStats=await page.locator("#stats").innerText();
 if(!/Triangles: [1-9]/.test(battleStats))throw Error("No battle scenery triangles: "+battleStats);
 await page.screenshot({path:"/tmp/pokegra-battle-stage.png"});
 console.log("BATTLE STAGE 3D:",battleStats);
 await page.goto("http://127.0.0.1:8765/resource-time-machine/narc-lab.html",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelectorAll(".member").length>0 || document.getElementById("status").textContent.startsWith("Could not open archive"),{timeout:90000});
 status=await page.locator("#status").innerText();
 if(status.startsWith("Could not open archive"))throw Error("NARC opening failed: "+status);
 let count=await page.locator(".member").count();if(!count)throw Error("No NARC members parsed");
 const graphicState=await page.locator("#status").innerText();
 const visible=await page.locator("#canvas").evaluate(c=>{const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let count=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)count++;return count;});
 console.log("NARC GRAPHICS:",graphicState,"Visible pixels:",visible, "TECH",await page.locator("#technical").innerText(), "MEMBERS", (await page.locator("#members").innerText()).slice(0,320), "PALETTES", (await page.locator("#palette option").allTextContents()).slice(0,10));
 if(/Cannot preview|Cannot decode/.test(graphicState)||visible<100)throw Error("Weather archive graphics did not render: "+graphicState+" ("+visible+" pixels)");
 const firstName=await page.locator("#title").innerText();
 if(!firstName.includes("arare_NCGR")){
  const debug=await page.evaluate(async()=>{const r=await fetch("./narc-indexes.json");return {status:r.status,available:(await r.text()).slice(0,170)};});
  console.log("NAIX FALLBACK DEBUG",JSON.stringify(debug));
  throw Error("NAIX member name lookup missing: "+firstName);
 }
 await page.locator("[data-mode=binary]").click();
 const hex=await page.locator("#hex").innerText();
 if(hex.length<20)throw Error("Binary member preview empty");
 await page.locator("#archive").selectOption("titles");
 await page.waitForFunction(()=>document.getElementById("source").textContent.includes("titledemo.narc") && document.querySelectorAll(".member").length>0 || document.getElementById("status").textContent.startsWith("Could not open archive"),{timeout:85000});
 status=await page.locator("#status").innerText();
 if(status.startsWith("Could not open archive"))throw Error("Title NARC failed: "+status);
 console.log("NARC archives decoded",count,"members in weather archive",firstName);
 await page.screenshot({path:"/tmp/pokegra-specialized-narc.png",fullPage:true});
 if(errors.length)throw Error("Browser errors: "+errors.slice(0,7).join(" | "));
 console.log("EXHIBIT_BROWSER_CHECK_PASS");
}finally{await browser.close()}
