import { exportSet } from './texture-output.js';
export function setupOutput({parts, current, flush, saveBytes, pngBlob, grayRGBA, baseRaster}){
  const dialog=document.createElement('dialog');
  dialog.id='outputPanel';
  dialog.innerHTML=`<form method="dialog"><header><strong></strong><button value="close" aria-label="Close">×</button></header></form>
    <label>Texture Set<select data-field="set"></select></label>
    <section data-mode="export"><label>Preset<select data-field="preset"><option value="separate">Roblox / Blender · separate PNG</option><option value="orm">Unreal · ORM</option><option value="urp">Unity URP</option><option value="hdrp">Unity HDRP</option></select></label>
    <label>Normal<select data-field="normal"><option value="gl">OpenGL · Y+</option><option value="dx">DirectX · Y−</option></select></label>
    <fieldset><legend>Maps</legend><label>Base color<input type="checkbox" value="color" checked></label><label>Normal<input type="checkbox" value="normal" checked></label><label>Surface channels<input type="checkbox" value="surface" checked></label><label>Height · 16 bit<input type="checkbox" value="height"></label></fieldset></section>
    <section data-mode="bake"><label>Mesh map<select data-field="kind"><option value="normal">World Space Normal</option><option value="position">Position · normalized per set</option></select></label>
    <label>Resolution<select data-field="size"><option>512</option><option selected>1024</option><option>2048</option><option>4096</option></select></label>
    <label>Padding<select data-field="pad"><option>0</option><option selected>2</option><option>4</option><option>8</option></select></label></section>
    <progress hidden max="1"></progress><output aria-live="polite"></output><footer><button type="button"></button></footer>`;
  document.body.append(dialog);
  const field=name=>dialog.querySelector('[data-field="'+name+'"]');
  const run=dialog.querySelector('footer button'), progress=dialog.querySelector('progress'), status=dialog.querySelector('output');
  let mode, worker=null, epoch=0;
  function stop(){epoch++; worker?.terminate();worker=null;}
  dialog.addEventListener('close',()=>{if(!dialog.open)stop();});
  field('preset').onchange=()=>{field('normal').value=field('preset').value==='orm'?'dx':'gl';};
  function open(next){
    mode=next; stop(); field('set').replaceChildren();
    for(const p of parts()) if(p.editable) field('set').add(new Option(p.name,p.name));
    if(!field('set').options.length) return;
    if(current()) field('set').value=current().name;
    if(mode==='export') field('set').add(new Option('All texture sets',''));
    for(const section of dialog.querySelectorAll('[data-mode]')) section.hidden=section.dataset.mode!==mode;
    dialog.querySelector('strong').textContent=mode==='export'?'Export Textures':'Bake Mesh Maps';
    run.textContent=mode==='export'?'Export PNG set…':'Bake PNG…';
    run.disabled=false;status.textContent='';progress.hidden=true;dialog.showModal();
  }
  run.onclick=async()=>{
    const ticket=++epoch;
    try{
      flush();run.disabled=true;progress.hidden=false;progress.value=0;
      const selected=[...parts()].filter(p=>p.editable && (!field('set').value || p.name===field('set').value));
      const p=selected[0];
      if(mode==='export'){
        const maps=[...dialog.querySelectorAll('fieldset input:checked')].map(el=>el.value);
        if(!maps.length)throw new Error('Select at least one map');
        const zip=new JSZip(), preset=field('preset').value, dx=field('normal').value==='dx';
        for(let i=0;i<selected.length;i++){
          if(ticket!==epoch) return;
          const item=selected[i];status.textContent=item.name;
          await exportSet(item,preset,dx,zip,item.name,{pngBlob,grayRGBA,baseRaster},maps);progress.value=(i+1)/selected.length;
        }
        const bytes=await zip.generateAsync({type:'uint8array'});
        if(ticket!==epoch) return;
        await saveBytes('TYC-textures.zip',bytes,[{name:'Texture set',extensions:['zip']}]);
      } else {
        const a=p.mesh.geometry.attributes, size=Number(field('size').value), kind=field('kind').value;
        const url=new URL('./bake-worker.js',import.meta.url);
        const bootstrap=URL.createObjectURL(new Blob(['import '+JSON.stringify(url.href)],{type:'text/javascript'}));
        try{worker=new Worker(bootstrap,{type:'module'});}finally{URL.revokeObjectURL(bootstrap);}
        const blob=await new Promise((resolve,reject)=>{
          const active=worker;
          const cancel=()=>{if(!dialog.open)reject(new DOMException('Cancelled','AbortError'));};
          dialog.addEventListener('close',cancel,{once:true});
          function finish(fn,v){dialog.removeEventListener('close',cancel);active.terminate();if(worker===active) worker=null;fn(v);}
          active.onerror=e=>finish(reject,new Error(e.message));
          active.onmessage=({data})=>{
            if(data.error) finish(reject,new Error(data.error));
            else if(data.blob) finish(resolve,data.blob);
            else progress.value=data.progress;
          };
          active.postMessage({position:a.position.array,normal:a.normal.array,uv:a.uv.array,size,kind,padding:Number(field('pad').value)});
        });
        if(ticket!==epoch) return;
        await saveBytes(p.name+'_'+kind+'.png',blob,[{name:'PNG',extensions:['png']}]);
      }
      if(ticket===epoch) dialog.close();
    } catch(e){if(ticket===epoch) status.textContent=e.message;}
    finally{if(ticket===epoch){run.disabled=false;progress.hidden=true;}}
  };
  return open;
}
