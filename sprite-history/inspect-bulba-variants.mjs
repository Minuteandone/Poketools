import {chromium} from "playwright";
import fs from "node:fs";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
 const page=await browser.newPage({viewport:{width:900,height:700}});
 await page.goto("http://127.0.0.1:8765/sprite-history/",{waitUntil:"domcontentloaded"});
 const result=await page.evaluate(async()=>{
  const [nr,nitro,lz]=await Promise.all([import("../src/narc.js"),import("../src/nitro.js"),import("../src/lz.js")]);
  const root="https://raw.githubusercontent.com/e-minence/black_white/b9c3a57e3167/resource/pokegra/";
  const [bin,txt]=await Promise.all([fetch(root+"pokegra_wb.narc"),fetch(root+"pokegra_wb.naix")]);
  const arc=new nr.Narc(new Uint8Array(await bin.arrayBuffer()));
  const idx=Object.fromEntries([...(await txt.text()).matchAll(/NARC_pokegra_wb_([A-Za-z0-9_]+)\s*=\s*(\d+)/g)].map(m=>[m[1],+m[2]]));
  const res=(name,Type)=>{
   const id=idx[name];if(id==null)return {error:"missing",name};
   const raw=arc.member(id);if(!raw.length)return {error:"empty",name};
   const bytes=lz.decompress(raw);try{return {name,raw:raw.length,decoded:bytes.length,asset:new Type(bytes)}}catch(e){return {name,raw:raw.length,decoded:bytes.length,error:e.message}};
  };
  const vals=[];
  for(const side of ["pfwb","pbwb"]){
   for(const gender of ["m","f"]){
    const src=res(side+"_001c_"+gender+"_NCBR",nitro.Ncgr),other=res(side+"_001_m_NCGR",nitro.Ncgr);
    const ncer=res(side+"_001_NCER",nitro.Ncer),nanr=res(side+"_001_NANR",nitro.Nanr),
        nmcr=res(side+"_001_NMCR",nitro.Nmcr),nmar=res(side+"_001_NMAR",nitro.Nmar);
    for(const shiny of [false,true]){
     const pal=res("pmwb_001_"+(shiny?"r":"n")+"_NCLR",nitro.Nclr);
     const cv=document.createElement("canvas"),c=cv.getContext("2d");
     let kind="assembled",error=null;
     try {
       if(src.asset && ncer.asset && nanr.asset && nmcr.asset){
         nitro.renderAnimationFrame(c,src.asset,pal.asset,ncer.asset,nanr.asset,nmcr.asset,nmar.asset?.idleMap()??0,0,{zoom:2,stage:192});
       }else{
         kind="fallback";
         nitro.renderNcgr(c,other.asset,pal.asset,{scale:2});
       }
     }catch(e){error=e.message;}
     let bbox=[null,null,null,null],pixelCount=0;
     if(cv.width&&cv.height){
       const p=c.getImageData(0,0,cv.width,cv.height).data;let minx=999999,miny=999999,maxx=-1,maxy=-1;
       for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){
         if(p[(y*cv.width+x)*4+3]<20)continue;
         minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);pixelCount++;
       }
       bbox=[minx,miny,maxx,maxy];
     }
     vals.push({side,gender,shiny,kind,error,sheet:{name:src.name,raw:src.raw,decoded:src.decoded,tiles:src.asset?.tileCount,error:src.error},
      ncer:{error:ncer.error,cells:ncer.asset?.cells?.length},nanr:{error:nanr.error,animations:nanr.asset?.animations?.length},
      nmcr:{error:nmcr.error,maps:nmcr.asset?.maps?.length},
      size:[cv.width,cv.height],bbox,pixelCount,image:cv.toDataURL("image/png")});
    }
   }
  }
  return vals;
 });
 fs.mkdirSync("sprite-history/debug",{recursive:true});
 for(const x of result){
   const n="sprite-history/debug/bulba-"+(x.side==="pfwb"?"front":"back")+"-"+(x.gender==="m"?"male":"female")+"-"+(x.shiny?"shiny":"normal")+".png";
   fs.writeFileSync(n,Buffer.from(x.image.split(",")[1],"base64"));delete x.image;
 }
 fs.writeFileSync("sprite-history/debug/bulbasaur-variants.json",JSON.stringify(result,null,2));
 console.log("VARIANTS",JSON.stringify(result));
}finally{await browser.close()}
