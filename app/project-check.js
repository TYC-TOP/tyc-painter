// Preflight metadata and packed array lengths before replacing the active model.
export function checkProject(project,zip){
  if(![undefined,1,2,3].includes(project.version))throw new Error('Unsupported project version');
  const entry=(name,bytes)=>{
    const file=typeof name==='string' && zip.file(name);
    if(!file)throw new Error('Missing project resource: '+name);
    const length=file._data?.uncompressedSize;
    if(bytes!==undefined && length!==undefined && length!==bytes)throw new Error('Invalid resource size: '+name);
  };
  for(const name of project.model?.files || [])entry(name);
  for(const mat of Object.values(project.mats || {}))for(const key of ['src','height','rough'])if(mat[key])entry(mat[key]);
  for(const part of Object.values(project.parts || {})){
    const {W,H,layers}=part;
    if(!Number.isSafeInteger(W)||!Number.isSafeInteger(H)||W<1||H<1||W*H>8192*8192)throw new Error('Invalid texture size');
    if(!Array.isArray(layers)||layers[0]?.type!=='base')throw new Error('Invalid base layer');
    const ids=new Map(layers.map(l=>[l.id,l]));
    if(ids.size!==layers.length)throw new Error('Duplicate layer ID');
    if(part.base)entry(part.base.file,part.base.w*part.base.h*4);
    if(part.uv)entry(part.uv);
    for(const l of layers){
      if(l.type==='paint')entry(l.raster,W*H*4);
      if(l.mask)entry(l.mask,W*H);
      if(l.type==='fill'||l.type==='decalUV'){
        if(!l.mat?.builtin && !project.mats?.[l.mat?.id])throw new Error('Missing layer material');
      }
      if(l.type==='seam' && (!Array.isArray(l.points)||!l.points.every(pt=>Array.isArray(pt)&&pt.length===2&&pt.every(v=>Number.isFinite(v)&&v>=0&&v<=1))||!(l.pitch>=3 && l.pitch<=80)||!(l.threadWidth>=1 && l.threadWidth<=20)))throw new Error('Invalid stitch path');
      const seen=new Set([l.id]);
      for(let parent=l.parentId;parent!=null;parent=ids.get(parent).parentId){
        if(seen.has(parent)||ids.get(parent)?.type!=='group')throw new Error('Invalid group hierarchy');
        seen.add(parent);
      }
    }
  }
}
