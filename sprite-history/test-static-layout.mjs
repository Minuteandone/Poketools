import { chromium } from "playwright";
import fs from "node:fs";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
const p=await browser.newPage();
await p.goto("http://127.0.0.1:8765/sprite-history/",{waitUntil:"domcontentloaded"});
const r=await p.evaluate(async()=>{
 const [nr,ni,lz]=await Promise.all([import("../src/narc.js"),import("../src/nitro.js"),import("../src/lz.js")]);
 const base="https://raw.githubusercontent.com/e-minence/black_white/b9c3a57e3167/resource/pokegra/";
 const [b,t]=await Promise.all([fetch(base+"pokegra_wb.narc"),fetch(base+"pokegra_wb.naix")]);
 const nar=new nr.Narc(new Uint8Array(await b.arrayBuffer()));
 const idx=Object.fromEntries([...(await t.text()).matchAll(/NARC_pokegra_wb_([A-Za-z0-9_]+)\s*=\s*(\d+)/g)].map(x=>[x[1],+x[2]]));
 const result={};const ncgr=new ni.Ncgr(lz.decompress(nar.member(idx["pfwb_001_m_NCGR"])));
 const pal=new ni.Nclr(lz.decompress(nar.member(idx["pmwb_001_n_NCLR"])));
 result.source={widthTiles:ncgr.widthTiles,heightTiles:ncgr.heightTiles,tileCount:ncgr.tileCount,characterType:ncgr.characterType,linear4:ncgr.linear4,dataSize:ncgr.dataSize,renderStride:ncgr.renderStride};
 // Reinterpreting linear packed source with different row widths.
 const styles=[{name:"current",mode:"existing",width:256},{name:"packed96",mode:"linear",width:96},{name:"packed128",mode:"linear",width:128},{name:"packed192",mode:"linear",width:192},{name:"packed256",mode:"linear",width:256},{name:"tiles12",mode:"tile",width:96},{name:"tiles16",mode:"tile",width:128}];
 for(const style of styles){
  const width=style.width,height=Math.ceil(ncgr.dataSize*2/width);
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");
  let im=ctx.createImageData(width,height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=y*width+x;let index=0;
   if(style.mode==="linear"){const packed=ncgr.data[ncgr.offset+(i>>1)]??0;index=(i&1)?packed>>4:packed&15;}
   else{index=ncgr.pixelAt(x,y,style.width/8);}
   const off=i*4;
   if(index){const c=pal.raw(index),r=c&31,g=(c>>>5)&31,b=(c>>>10)&31;im.data[off]=(r<<3)|(r>>>2);im.data[off+1]=(g<<3)|(g>>>2);im.data[off+2]=(b<<3)|(b>>>2);im.data[off+3]=255;}
  }
  ctx.putImageData(im,0,0);
  result[style.name]={image:canvas.toDataURL(),width,height};
 }
 return result;
});
fs.mkdirSync("sprite-history/debug",{recursive:true});
for(const [key,val] of Object.entries(r)){
 if(key==="source")continue;
 fs.writeFileSync("sprite-history/debug/static-"+key+".png",Buffer.from(val.image.split(",")[1],"base64"));delete val.image;
}
console.log(JSON.stringify(r));
} finally {await browser.close();}
