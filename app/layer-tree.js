// Flat project records keep stable IDs. Sibling order is the record order.
// A folder follows its descendants in compositing order and precedes them in the panel.
export function layerTree(records){
  const children=new Map(),groups=new Set(records.filter(l=>l.type==='group').map(l=>l.id));
  for(const layer of records){
    const parent=groups.has(layer.parentId)?layer.parentId:null;
    if(!children.has(parent))children.set(parent,[]);
    children.get(parent).push(layer);
  }
  const rows=[],seen=new Set();
  function visit(layer,parents){
    if(seen.has(layer.id))return;
    seen.add(layer.id);
    for(const child of children.get(layer.id)||[]) visit(child,[...parents,layer]);
    rows.push({layer,parents});
  }
  for(const root of children.get(null)||[])visit(root,[]);
  return rows;
}
export function compositeLayers(records){
  if(!records.some(l=>l.type==='group'))return records;
  const result=[];
  for(const {layer,parents} of layerTree(records)){
    if(layer.type==='group' || parents.some(p=>!p.visible))continue;
    if(!parents.length){result.push(layer);continue;}
    const opacity=parents.reduce((v,p)=>v*p.opacity,layer.opacity);
    result.push({...layer,opacity,groupMasks:parents.map(p=>p.mask).filter(Boolean)});
  }
  return result;
}
