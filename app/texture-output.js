import {dataPNG} from './materials/png.js';
// Output always reads from the current layer composite, never the viewport overlay.
export async function exportSet(part, preset, normalDX, zip, folder, api, maps=['color','normal','surface']){
  const {W,H}=part, count=W*H;
  if(part.optics && (part.optics.transmission || part.optics.iridescence || part.optics.clearcoat)){
    zip.file(folder+'/optics.json',JSON.stringify(part.optics,null,2));
  }
  const put=async (name,data)=>zip.file(folder+'/'+name+'.png',await api.pngBlob(data,W,H));
  const rgba=new Uint8ClampedArray(part.out);
  if(part.hasAlpha){
    const original=api.baseRaster(part);
    for(let k=3;k<rgba.length;k+=4) rgba[k]=original[k];
  }
  if(maps.includes('color'))await put('BaseColor',rgba);
  if(maps.includes('normal')){
  if(part.useH) rgba.set(part.outN);
  else if(part.nmapImg){
    const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d'); ctx.drawImage(part.nmapImg,0,0,W,H);
    rgba.set(ctx.getImageData(0,0,W,H).data);
  } else {
    for(let k=0;k<rgba.length;k+=4){rgba[k]=128; rgba[k+1]=128; rgba[k+2]=255; rgba[k+3]=255;}
  }
  if(normalDX) for(let k=1;k<rgba.length;k+=4) rgba[k]=255-rgba[k];
  await put(normalDX?'Normal_DX':'Normal_GL',rgba);
  }
  if(maps.includes('height')){
    const height=Uint16Array.from({length:count},(_,i)=>32768+(part.outH?.[i]??0));
    zip.file(folder+'/Height.png',await dataPNG(W,H,height,'height'));
  }
  if(!maps.includes('surface'))return;
  const rough=part.outR || new Uint8Array(count).fill(Math.round(part.baseRough*255));
  const metal=part.outM || new Uint8Array(count).fill(Math.round(part.baseMetal*255));
  if(preset==='orm'){
    for(let i=0;i<count;i++){const k=i*4; rgba[k]=part.originalAO?.[i] ?? 255; rgba[k+1]=rough[i]; rgba[k+2]=metal[i]; rgba[k+3]=255;}
    await put('ORM',rgba);
  } else if(preset==='urp' || preset==='hdrp'){
    for(let i=0;i<count;i++){
      const k=i*4;
      rgba[k]=metal[i];rgba[k+1]=part.originalAO?.[i]??255;
      rgba[k+2]=preset==='hdrp'?255:0;rgba[k+3]=255-rough[i];
    }
    zip.file(folder+(preset==='hdrp'?'/MaskMap.png':'/MetallicSmoothness.png'),await dataPNG(W,H,rgba,'rgba'));
  } else {
    await put('Roughness',api.grayRGBA(rough,count));
    await put('Metalness',api.grayRGBA(metal,count));
  }
}
