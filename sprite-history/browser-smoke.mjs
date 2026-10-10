import fs from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
const page = await browser.newPage({viewport:{width:1360,height:920},deviceScaleFactor:1});
const failures=[];
page.on("pageerror",error=>failures.push(error.message));
page.on("console",message=>{if(message.type()==="error")failures.push(message.text());});
try {
  await page.goto("http://127.0.0.1:8765/sprite-history/",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>{
    const t=document.getElementById("entry-count")?.textContent;
    return /^\d+$/.test(t||"") && Number(t)>700;
  }, null, {timeout:120000});
  await page.locator("#search").fill("190");
  await page.locator(".entry").first().click();
  await page.waitForFunction(()=>{
    const t=document.getElementById("load-status").textContent;
    return t.includes("Loaded")||t.includes("unavailable")||t.includes("Cannot assemble");
  },{timeout:120000});
  const status=await page.locator("#load-status").innerText();
  if (!status.startsWith("Loaded")) throw Error("Aipom did not load: "+status);
  const pixels=await page.locator("#after-canvas").evaluate(c=>{
    const x=c.getContext("2d").getImageData(0,0,c.width,c.height).data;
    let count=0;
    for(let k=3;k<x.length;k+=4)if(x[k]>0)count++;
    return count;
  });
  if (pixels < 70) throw Error("Sprite canvas is blank: "+pixels+" nontransparent pixels");
  const count=await page.locator("#revision-count").innerText();
  await page.locator("#prev").click();
  await page.waitForTimeout(250);
  await page.locator("#side").selectOption("back");
  await page.waitForFunction(()=>document.getElementById("load-status").textContent.includes("Loaded"),{timeout:120000});
  await page.screenshot({path:"/tmp/pokegra-sprite-history-screenshot.png"});
  console.log(JSON.stringify({passed:true,pixels,initialRevisionCount:count,backStatus:await page.locator("#load-status").innerText()},null,2));
  if(failures.length)console.warn("Browser console errors:",failures.slice(0,7));
} finally {
  await browser.close();
}
