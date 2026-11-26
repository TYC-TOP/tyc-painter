// Keep the source independent of target resolution and share it between duplicates.
const images=new WeakMap();
export function decalCache(layer,w,h){
  const key=[w,h,layer.mat.id,layer.offX,layer.offY,layer.rot,layer.decalWidth].join('|');
  if(layer.cache?.key===key) return layer.cache;
  const src=layer.mat.src;
  let image=images.get(src);
  if(!image){
    image=document.createElement('canvas');image.width=src.w;image.height=src.h;
    image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(src.data.buffer,src.data.byteOffset,src.data.byteLength),src.w,src.h),0,0);
    images.set(src,image);
  }
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  const width=layer.decalWidth*w,height=width*src.h/src.w;
  ctx.translate(layer.offX*w,layer.offY*h);ctx.rotate(layer.rot*Math.PI/180);
  ctx.drawImage(image,-width/2,-height/2,width,height);
  return {key,col:ctx.getImageData(0,0,w,h).data};
}
