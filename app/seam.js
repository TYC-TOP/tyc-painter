// Stitch dimensions are expressed in texels on a 1024-wide texture.
// Re-evaluate the stored UV path whenever its parameters or the working size change.
export function seamMaps(layer,w,h){
  const key=[w,h,layer.color,layer.threadWidth,layer.pitch,layer.points].join('|');
  if(layer.cache?.key===key) return layer.cache;
  const col=new Uint8ClampedArray(w*h*4), hgt=new Uint8Array(w*h);
  const scale=w/1024, pitch=Math.max(1,layer.pitch*scale);
  const radius=Math.max(.55,layer.threadWidth*scale/2), half=Math.max(.65,pitch*.36);
  const rgb=parseInt(layer.color.slice(1),16);
  let next=pitch/2;
  for(let n=1;n<layer.points.length;n++){
    const [u,v]=layer.points[n-1], [u1,v1]=layer.points[n];
    const x=u*w, y=(1-v)*h, dx=(u1-u)*w, dy=(v-v1)*h;
    const length=Math.hypot(dx,dy);
    if(!length) continue;
    const tx=dx/length, ty=dy/length;
    const rx=Math.abs(tx)*half+Math.abs(ty)*radius+1, ry=Math.abs(ty)*half+Math.abs(tx)*radius+1;
    for(;next<=length;next+=pitch){
      const cx=x+tx*next, cy=y+ty*next;
      for(let j=Math.max(0,Math.floor(cy-ry));j<=Math.min(h-1,Math.ceil(cy+ry));j++){
        for(let i=Math.max(0,Math.floor(cx-rx));i<=Math.min(w-1,Math.ceil(cx+rx));i++){
          const px=i+.5-cx,py=j+.5-cy;
          const d=Math.hypot((px*tx+py*ty)/half,(py*tx-px*ty)/radius);
          const coverage=Math.max(0,Math.min(1,(1-d)*radius+.5));
          const index=j*w+i,k=index*4;
          if(coverage*255<=col[k+3]) continue;
          col[k]=rgb>>16;col[k+1]=(rgb>>8)&255;col[k+2]=rgb&255;col[k+3]=coverage*255;
          hgt[index]=128+127*Math.sqrt(Math.max(0,1-d*d));
        }
      }
    }
    next-=length;
  }
  return {key,col,hgt};
}
