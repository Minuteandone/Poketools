// Native Nitro IMD (XML) geometry and palette texture decoder.
// This interprets exported model data, not a generic file listing.
// Supported: direct vertices, triangles/quads/strips, vertex colors, indexed textures,
// and display material assignments. Rigged ICA animations and packed NSBMD binaries
// are not decoded by this particular exhibit.
const nums=s=>String(s||"").trim().split(/\s+/).map(Number);
const bgr=v=>{const n=parseInt(v,16)||0;return [(n&31)*255/31,((n>>5)&31)*255/31,((n>>10)&31)*255/31];};
const attr=(e,k,d="")=>e?.getAttribute(k)??d;
const nattr=(e,k,d=0)=>Number(attr(e,k,d));
const children=(e,name)=>[...e?.children||[]].filter(x=>x.tagName===name);
const byIndex=(parent,name)=>children(parent,name).sort((a,b)=>nattr(a,"index")-nattr(b,"index"));
export function parseImd(text){
 const doc=new DOMParser().parseFromString(text,"application/xml");
 if(doc.querySelector("parsererror"))throw Error("Invalid Nitro IMD XML");
 const root=doc.querySelector("imd");
 if(!root)throw Error("No <imd> model in this file");
 const polygons=byIndex(doc.querySelector("polygon_array"),"polygon");
 const materials=byIndex(doc.querySelector("material_array"),"material");
 const tex=byIndex(doc.querySelector("tex_image_array"),"tex_image");
 const pal=byIndex(doc.querySelector("tex_palette_array"),"tex_palette");
 const nodes=byIndex(doc.querySelector("node_array"),"node");
 const displays=[];
 for(const node of nodes){
   for(const display of byIndex(node,"display"))
     displays.push({poly:nattr(display,"polygon"),mat:nattr(display,"material"),
                    node:nattr(node,"index"),name:attr(node,"name")});
 }
 if(!displays.length)polygons.forEach((poly,i)=>displays.push({poly:i,mat:0,node:0,name:attr(poly,"name")}));
 return {doc,root,polygons,materials,tex,pal,nodes,displays,create:doc.querySelector("create")?.getAttribute("date")||"",
   meta:doc.querySelector("head title")?.textContent||"",
   counts:{polygons:polygons.length,materials:materials.length,textures:tex.length,nodes:nodes.length,drawCalls:displays.length}};
}
export function textureRGBA(texNode,paletteNode){
 const width=nattr(texNode,"width"),height=nattr(texNode,"height"),fmt=attr(texNode,"format");
 if(width<=0||height<=0||width*height>1048576)throw Error("Invalid texture dimensions");
 const colors=(paletteNode?.textContent||"").trim().match(/[0-9a-fA-F]{4}/g)?.map(bgr)||[];
 const hex=(texNode.querySelector("bitmap")?.textContent||"").replace(/[^0-9a-f]/gi,"");
 if(!hex.length)throw Error("No embedded Nitro bitmap");
 const pix=new Uint8ClampedArray(width*height*4);
 // DS tiled texture data is organized in 8x8 blocks, with low bits read first.
 const bpp=fmt==="palette4"?2:fmt==="palette16"?4:fmt==="palette256"?8:0;
 if(!bpp)throw Error("Texture format "+fmt+" is not yet supported");
 const byteCount=Math.min(Math.floor(hex.length/2),Math.ceil(width*height*bpp/8));
 const raw=new Uint8Array(byteCount);
 for(let i=0;i<byteCount;i++)raw[i]=parseInt(hex.slice(i*2,i*2+2),16);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const blocksAcross=Math.ceil(width/8);
   const tile=(Math.floor(y/8)*blocksAcross+Math.floor(x/8))*64+(y%8)*8+(x%8);
   const bit=tile*bpp,idx=bit>>>3,shift=bit&7;
   const entry=(raw[idx]||0)>>>shift & ((1<<bpp)-1);
   const [r,g,b]=colors[entry]||[255,0,255];
   const p=(y*width+x)*4;
   pix[p]=r;pix[p+1]=g;pix[p+2]=b;
   pix[p+3]=entry===0&&attr(texNode,"color0_mode")==="transparency"?0:255;
 }
 return {width,height,data:pix,format:fmt};
}
function triangulate(verts,type){
 const faces=[],len=verts.length;
 if(type==="triangles")for(let i=0;i+2<len;i+=3)faces.push([i,i+1,i+2]);
 else if(type==="quads")for(let i=0;i+3<len;i+=4)faces.push([i,i+1,i+2],[i,i+2,i+3]);
 else if(type==="triangle_strip")for(let i=0;i+2<len;i++)faces.push(i%2?[i+1,i,i+2]:[i,i+1,i+2]);
 else if(type==="quad_strip")for(let i=0;i+3<len;i+=2)faces.push([i,i+1,i+3],[i,i+3,i+2]);
 else if(type==="triangle_fan")for(let i=1;i+1<len;i++)faces.push([0,i,i+1]);
 return faces;
}
function primitiveVertices(primitive){
 const verts=[];let current=[0,0,0],st=[0,0],color=[1,1,1];
 for(const e of primitive.children){
   const kind=e.tagName;
   if(kind==="tex"){st=nums(attr(e,"st"));continue;}
   if(kind==="clr"){color=nums(attr(e,"rgb")).map(v=>Math.max(0,Math.min(31,v))/31);continue;}
   let updated=false,xyz;
   if(kind==="pos_s"||kind==="pos_xyz"||kind==="pos"){xyz=nums(attr(e,"xyz"));if(xyz.length===3)current=[...xyz];updated=true;}
   else if(kind==="pos_xy"){const q=nums(attr(e,"xy"));current=[q[0],q[1],current[2]];updated=true;}
   else if(kind==="pos_xz"){const q=nums(attr(e,"xz"));current=[q[0],current[1],q[1]];updated=true;}
   else if(kind==="pos_yz"){const q=nums(attr(e,"yz"));current=[current[0],q[0],q[1]];updated=true;}
   else if(kind==="pos_diff"){const q=nums(attr(e,"xyz"));current=current.map((v,i)=>v+(q[i]||0));updated=true;}
   if(updated&&current.every(Number.isFinite))verts.push({xyz:[...current],st:[...st],color:[...color]});
 }
 return verts;
}
export function modelTriangles(model,polyNode,materialNode){
 const pos=[],uv=[],col=[];
 const paletteTex=model.tex[nattr(materialNode,"tex_image_idx",-1)];
 const tw=nattr(paletteTex,"width",1),th=nattr(paletteTex,"height",1);
 let count=0,unsupported=new Set();
 for(const primitive of polyNode.querySelectorAll("primitive")){
   const type=attr(primitive,"type");
   const vertices=primitiveVertices(primitive);
   const faces=triangulate(vertices,type);
   if(!faces.length){unsupported.add(type);continue;}
   for(const face of faces)for(const index of face){
     const v=vertices[index];if(!v)continue;
     pos.push(...v.xyz);uv.push((v.st[0]||0)/tw,1-(v.st[1]||0)/th);col.push(...v.color);
   }
   count+=faces.length;
 }
 return {pos,uv,col,triangles:count,unsupported:[...unsupported]};
}
export async function createThreeModel(THREE,text,{wireframe=false}={}){
 const parsed=parseImd(text);
 const model=new THREE.Group(),textureCache=new Map(),warnings=[];
 const makeTexture=mat=>{
   const ti=nattr(mat,"tex_image_idx",-1),pi=nattr(mat,"tex_palette_idx",-1);
   if(ti<0||pi<0||!parsed.tex[ti])return null;
   const key=ti+":"+pi;if(textureCache.has(key))return textureCache.get(key);
   const td=textureRGBA(parsed.tex[ti],parsed.pal[pi]);
   const texture=new THREE.DataTexture(td.data,td.width,td.height,THREE.RGBAFormat);
   texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;
   texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
   texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;
   textureCache.set(key,texture);return texture;
 };
 let triangleCount=0,drawn=0;
 for(const d of parsed.displays){
   const poly=parsed.polygons[d.poly],mat=parsed.materials[d.mat];
   if(!poly)continue;
   try{
     const faces=modelTriangles(parsed,poly,mat);
     if(!faces.pos.length)continue;
     const geometry=new THREE.BufferGeometry();
     geometry.setAttribute("position",new THREE.Float32BufferAttribute(faces.pos,3));
     geometry.setAttribute("uv",new THREE.Float32BufferAttribute(faces.uv,2));
     geometry.setAttribute("color",new THREE.Float32BufferAttribute(faces.col,3));
     geometry.computeVertexNormals();
     const texture=mat?makeTexture(mat):null;
     const material=new THREE.MeshLambertMaterial({
       map:texture,vertexColors:true,side:THREE.DoubleSide,
       transparent:!!texture,alphaTest:texture?0.02:0,wireframe});
     const mesh=new THREE.Mesh(geometry,material);
     mesh.name=d.name||attr(poly,"name");
     const node=parsed.nodes[d.node];
     if(node){
       const translate=nums(attr(node,"translate","0 0 0"));
       const scale=nums(attr(node,"scale","1 1 1"));
       const rot=nums(attr(node,"rotate","0 0 0"));
       // Nitro exporter uses degrees for the original node Euler rotations.
       if(translate.length===3)mesh.position.set(...translate);
       if(scale.length===3)mesh.scale.set(...scale);
       if(rot.length===3)mesh.rotation.set(...rot.map(x=>x*Math.PI/180));
     }
     model.add(mesh);drawn++;triangleCount+=faces.triangles;
     warnings.push(...faces.unsupported.map(x=>"Unsupported primitive: "+x));
   }catch(e){warnings.push("Polygon "+d.poly+": "+e.message);}
 }
 if(!drawn)throw Error("This IMD has no currently supported polygon primitives.");
 const bounds=new THREE.Box3().setFromObject(model);
 const size=new THREE.Vector3();bounds.getSize(size);
 const max=Math.max(size.x,size.y,size.z,0.001);
 const center=new THREE.Vector3();bounds.getCenter(center);
 model.position.sub(center);
 model.scale.multiplyScalar(4/max);
 return {object:model,info:{...parsed.counts,triangles:triangleCount,rendered:drawn,warnings:[...new Set(warnings)],created:parsed.create}};
}
