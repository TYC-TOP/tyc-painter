// Rasterize the single UV tile used by Painter. On overlaps the last triangle wins.
export function bakeMap({position, normal, uv, size, kind, padding}, progress = () => {}){
  const pixels = new Uint8ClampedArray(size * size * 4);
  const low = [Infinity,Infinity,Infinity], high = [-Infinity,-Infinity,-Infinity];
  for(let k=0;k<position.length;k++){
    const axis=k%3;
    low[axis]=Math.min(low[axis],position[k]);
    high[axis]=Math.max(high[axis],position[k]);
  }
  const source = kind === 'position' ? position : normal;
  for(let t=0;t<uv.length;t+=6){
    const ax=uv[t]*size, ay=(1-uv[t+1])*size;
    const bx=uv[t+2]*size, by=(1-uv[t+3])*size;
    const cx=uv[t+4]*size, cy=(1-uv[t+5])*size;
    const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    if(Math.abs(det)<1e-9) continue;
    const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))), maxX=Math.min(size-1,Math.ceil(Math.max(ax,bx,cx)));
    const minY=Math.max(0,Math.floor(Math.min(ay,by,cy))), maxY=Math.min(size-1,Math.ceil(Math.max(ay,by,cy)));
    for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++){
      const a=((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/det;
      const b=((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/det;
      const c=1-a-b;
      if(Math.min(a,b,c)<-1e-7) continue;
      const j=4*(y*size+x), i=t/2*3;
      const component = k => a*source[i+k]+b*source[i+3+k]+c*source[i+6+k];
      const length = kind==='normal' ? Math.hypot(component(0),component(1),component(2)) || 1 : 1;
      for(let k=0;k<3;k++){
        const value = component(k);
        const range=high[k]-low[k];
        pixels[j+k]=255*(kind==='normal' ? .5+.5*value/length : range ? (value-low[k])/range : .5);
      }
      pixels[j+3]=255;
    }
    if(t%6144===0) progress(.85*t/uv.length);
  }
  // Alpha temporarily records the dilation generation to prevent in-pass propagation.
  for(let step=1;step<=padding;step++){
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const i=(y*size+x)*4;
      if(pixels[i+3]) continue;
      let n=-1;
      if(x && pixels[i-1]>step) n=i-4;
      else if(x+1<size && pixels[i+7]>step) n=i+4;
      else if(y && pixels[i-size*4+3]>step) n=i-size*4;
      else if(y+1<size && pixels[i+size*4+3]>step) n=i+size*4;
      if(n<0) continue;
      pixels[i]=pixels[n]; pixels[i+1]=pixels[n+1]; pixels[i+2]=pixels[n+2]; pixels[i+3]=step;
    }
    for(let i=3;i<pixels.length;i+=4) if(pixels[i]===step) pixels[i]=255;
    progress(.85+.15*step/padding);
  }
  return pixels;
}
