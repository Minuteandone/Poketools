import {chromium} from "playwright";
import fs from "node:fs";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
 const page=await browser.newPage({viewport:{width:900,height:700}});
 await page.goto("http://127.0.0.1:8765/sprite-history/",{waitUntil:"domcontentloaded"});
 const images=await page.evaluate(async()=>{
   const [nr,nitro,lz]=await Promise.all([import("../src/narc.js"),import("../src/nitro.js"),import("../src/lz.js")]);
   const root="https://raw.githubusercontent.com/e-minence/black_white/b9c3a57e3167/resource/pokegra/";
   const [bin,txt]=await Promise.all([fetch(root+"pokegra_wb.narc"),fetch(root+"pokegra_wb.naix")]);
   const arc=new nr.Narc(new Uint8Array(await bin.arrayBuffer()));
   const idx=Object.fromEntries([...(await txt.text()).matchAll(/NARC_pokegra_wb_([A-Za-z0-9_]+)\s*=\s*(\d+)/g)].map(m=>[m[1],+m[2]]));
   const o=(nm,T)=>new T(lz.decompress(arc.member(idx[nm])));
   const gr=o("pfwb_001c_m_NCBR",nitro.Ncgr),pal=o("pmwb_001_n_NCLR",nitro.Nclr),
      ncer=o("pfwb_001_NCER",nitro.Ncer),nanr=o("pfwb_001_NANR",nitro.Nanr),nmcr=o("pfwb_001_NMCR",nitro.Nmcr);
   const periods=nmcr.maps[0].records.map(rec=>{
      const a=nanr.animations[rec.animation];
      return {index:rec.animation,playback:a?.playback,loop:a?.loopStart,frames:a?.frames?.length,
         duration:a?.frames?.reduce((n,f)=>n+f.duration,0),
         first:{cell:a?.frames?.[0]?.cell,tx:a?.frames?.[0]?.translateX,ty:a?.frames?.[0]?.translateY},
         last:{cell:a?.frames?.at(-1)?.cell,tx:a?.frames?.at(-1)?.translateX,ty:a?.frames?.at(-1)?.translateY}};
   });
   const cv=document.createElement("canvas"),c=cv.getContext("2d");
   const renders=[];
   for(const map of [0,1]) for(const tick of [0,10,30,60,90,120,180,240,360,480,600,800,1200]){
     nitro.renderAnimationFrame(c,gr,pal,ncer,nanr,nmcr,map,tick,{zoom:2,stage:192});
     const pixels=c.getImageData(0,0,cv.width,cv.height).data;
     let minx=9999,miny=9999,maxx=-1,maxy=-1,visible=0;
     for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
        if(pixels[(y*cv.width+x)*4+3]<20)continue;
        visible++;minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);
     }
     renders.push({map,tick,image:cv.toDataURL("image/png"),bounds:[minx,miny,maxx,maxy],visible});
   }
   return{periods,renders};
 });
 fs.mkdirSync("sprite-history/debug",{recursive:true});
 for(const x of images.renders){
   fs.writeFileSync("sprite-history/debug/bulba-tick-"+String(x.tick).padStart(4,"0")+".png",Buffer.from(x.image.split(",")[1],"base64"));
   delete x.image;
 }
 fs.writeFileSync("sprite-history/debug/tick-report.json",JSON.stringify(images,null,2));
 console.log("RENDER TICKS",JSON.stringify(images));
}finally{await browser.close()}
