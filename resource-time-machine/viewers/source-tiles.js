// Decoder for NitroSystem g2dcvtr *source* files (.ncg/.ncl/.nsc),
// which use NCCG/NCCL/NCSC, not the compiled NCGR/NCLR/NSCR magic.
// Fail explicitly instead of painting a plausible but wrong image.
function view(data){if(!(data instanceof Uint8Array))throw Error('Expected Uint8Array');return new DataView(data.buffer,data.byteOffset,data.byteLength);}
function tag(data,at){return String.fromCharCode(...data.subarray(at,at+4));}
function requireChunk(data,magic,chunk,min){
 if(data.length<min||tag(data,0)!==magic||tag(data,16)!==chunk)throw Error('Expected original '+magic+'/'+chunk+' resource');
 const d=view(data),size=d.getUint32(20,true);
 if(size<min-16||size+16>data.length)throw Error('Broken '+chunk+' chunk length');
 return d;
}
export function parsePalette(data){
 const d=requireChunk(data,'NCCL','PALT',32);
 // Preserve all source palette banks, not just the declared colors-per-bank.
 const count=Math.min(256,Math.floor((d.getUint32(20,true)-16)/2));
 if(!count||32+count*2>data.length)throw Error('Invalid Nitro palette count');
 const colors=[];
 for(let i=0;i<count;i++){const v=d.getUint16(32+i*2,true);colors.push([(v&31)*255/31|0,((v>>5)&31)*255/31|0,((v>>10)&31)*255/31|0,i===0?0:255]);}
 return colors;
}
export function parseTiles(data){
 const d=requireChunk(data,'NCCG','CHAR',36),cols=d.getUint32(24,true),rows=d.getUint32(28,true),count=cols*rows;
 if(!cols||!rows||count>8192)throw Error('Invalid source graphic tile dimensions');
 const bytes=(d.getUint32(20,true)-20)/count;
 if(bytes!==32&&bytes!==64)throw Error('Unsupported source graphic bit depth or layout');
 if(36+count*bytes>data.length)throw Error('Truncated source graphic tiles');
 return {data,cols,rows,count,bytes,bpp:bytes===32?4:8};
}
export function parseScreen(data){
 const d=requireChunk(data,'NCSC','SCRN',36),cols=d.getUint32(24,true),rows=d.getUint32(28,true);
 if(!cols||!rows||cols*rows>4096||36+cols*rows*2>data.length)throw Error('Invalid tilemap dimensions');
 const entries=[];for(let i=0;i<cols*rows;i++)entries.push(d.getUint16(36+i*2,true));
 return {cols,rows,entries};
}
function palettePixel(palette,index,bank){return index===0?[0,0,0,0]:palette[bank*16+index]||palette[index]||[0,0,0,0];}
export function renderSheet(tiles,palette,bank=0){
 const canvas=document.createElement('canvas');canvas.width=tiles.cols*8;canvas.height=tiles.rows*8;
 const pixels=new Uint8ClampedArray(canvas.width*canvas.height*4),b=tiles.data;
 for(let t=0;t<tiles.count;t++){
  const tx=t%tiles.cols,ty=Math.floor(t/tiles.cols),offset=36+t*tiles.bytes;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const i=y*8+x,pi=tiles.bytes===64?b[offset+i]:(b[offset+(i>>1)]>>(i%2?4:0))&15;
   pixels.set(palettePixel(palette,pi,bank),((ty*8+y)*canvas.width+tx*8+x)*4);
  }
 }
 canvas.getContext('2d').putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);
 return canvas;
}
export function renderMap(tiles,palette,map){
 const out=document.createElement('canvas');out.width=map.cols*8;out.height=map.rows*8;
 const ctx=out.getContext('2d');
 const cache=new Map(),b=tiles.data;
 for(let i=0;i<map.entries.length;i++){
  const entry=map.entries[i],tile=entry&1023,bank=entry>>>12;if(tile>=tiles.count)continue;
  const key=tile+':'+bank;let piece=cache.get(key);
  if(!piece){piece=document.createElement('canvas');piece.width=8;piece.height=8;
   const buf=new Uint8ClampedArray(8*8*4),off=36+tile*tiles.bytes;
   for(let j=0;j<64;j++){const pi=tiles.bytes===64?b[off+j]:(b[off+(j>>1)]>>(j&1?4:0))&15;buf.set(palettePixel(palette,pi,bank),j*4);}
   piece.getContext('2d').putImageData(new ImageData(buf,8,8),0,0);cache.set(key,piece);
  }
  const x=i%map.cols*8,y=Math.floor(i/map.cols)*8;
  ctx.save();ctx.translate(x+(entry&1024?8:0),y+(entry&2048?8:0));
  ctx.scale(entry&1024?-1:1,entry&2048?-1:1);ctx.drawImage(piece,0,0);ctx.restore();
 }
 return out;
}
export function tightCrop(canvas){
 const ctx=canvas.getContext('2d'),{width:w,height:h}=canvas,px=ctx.getImageData(0,0,w,h).data;
 let left=w,right=-1,top=h,bottom=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(px[(y*w+x)*4+3]){
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 if(right<left)return {canvas,empty:true,bounds:null};
 const out=document.createElement('canvas');out.width=right-left+1;out.height=bottom-top+1;
 out.getContext('2d').drawImage(canvas,left,top,out.width,out.height,0,0,out.width,out.height);
 return {canvas:out,empty:false,bounds:[left,top,right,bottom]};
}
export function decodeBmp(data){
 const d=view(data);
 if(data[0]!==0x42||data[1]!==0x4d||data.length<54||d.getUint32(14,true)<40)throw Error('Not a supported Windows BMP');
 const w=d.getInt32(18,true),signedH=d.getInt32(22,true),h=Math.abs(signedH),depth=d.getUint16(28,true),compression=d.getUint32(30,true),offset=d.getUint32(10,true);
 if(w<1||w>4096||h<1||h>4096||![16,24].includes(depth)||compression!==0)
  throw Error('Only uncompressed 16-bit RGB555 or 24-bit BMP source graphics are supported');
 const step=depth/8,stride=(w*step+3)&~3;
 if(offset+stride*h>data.length)throw Error('Truncated BMP pixels');
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++){
  const src=offset+(signedH>0?h-1-y:y)*stride;
  for(let x=0;x<w;x++){
   const p=src+x*step,o=(y*w+x)*4;
   if(depth===16){
    // Windows BI_RGB with 16 bits per pixel stores RGB555; high bit is reserved.
    const v=d.getUint16(p,true);
    rgba[o]=((v>>10)&31)*255/31|0;rgba[o+1]=((v>>5)&31)*255/31|0;rgba[o+2]=(v&31)*255/31|0;
   }else{rgba[o]=data[p+2];rgba[o+1]=data[p+1];rgba[o+2]=data[p];}
   rgba[o+3]=255;
  }
 }
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 canvas.getContext('2d').putImageData(new ImageData(rgba,w,h),0,0);return canvas;
}
export function copyCanvas(destination,source){
 destination.width=source.width;destination.height=source.height;
 destination.getContext('2d').clearRect(0,0,source.width,source.height);destination.getContext('2d').drawImage(source,0,0);
}
export function saveCanvas(canvas,name){
 const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=name;a.click();
}

export function iconPaletteBank(data){
 const d=view(data),at=16+d.getUint32(20,true);
 if(at+22>data.length||tag(data,at)!=='ATTR'||d.getUint32(at+4,true)<22)return 0;
 return data[at+21]&15;
}
