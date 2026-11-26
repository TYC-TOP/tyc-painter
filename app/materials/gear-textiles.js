import {weave} from './textile.js';
const yarnCounts={nylon330:32,nylon500:24,nylon1000:16};
export function gearTextile(kind,rough,size){
  if(!(kind in yarnCounts) && kind!=='spacer')return null;
  const map=()=>({w:size,h:size,data:new Uint8ClampedArray(size*size*4)});
  const color=map(),height=map(),roughness=map();
  const write=(m,i,v)=>{m.data[i]=m.data[i+1]=m.data[i+2]=v;m.data[i+3]=255;};
  const pitch=1/(yarnCounts[kind] || 16), settings={seed:72,fabricTension:0,fiberDensity:.8,fiberVariation:.7},sample={};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size,i=4*(y*size+x);
    let h,shade;
    if(kind==='spacer'){
      const row=Math.floor(v*12), px=((u*16+(row%2)*.5)%1)-.5, py=(v*12%1)-.5;
      const radius=Math.hypot(px/.43,py/.4);
      const rim=Math.exp(-((radius-1)**2)/.12),fiber=Math.cos(2*Math.PI*(u*64+v*36));
      h=.18+.62*rim+.08*fiber;shade=.46+.36*rim+.07*fiber;
    }else{
      weave(u,v,pitch,'cordura',1/size,settings,sample);
      h=sample.h/pitch;shade=.50+sample.value;
    }
    write(color,i,shade*255);write(height,i,90+h*170);write(roughness,i,(rough+(h-.35)*.09)*255);
  }
  return {color,height,rough:roughness};
}
