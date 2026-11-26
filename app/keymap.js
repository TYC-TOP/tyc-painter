// Tool and viewport keys are configurable. Modified system/project commands stay available.
const defaults={paint:'b',erase:'e',fill:'g',orbit:'o',pick:'i',decal:'d',wand:'w',frame:'f',material:'m',channel:'c',split:'f1',view3D:'f2',viewUV:'f3'};
const reserved=new Set(['a','l','r','s','u','x','1','2','4','[',']','tab']);
const storage='tyc-painter.keys.v1';
function valid(keys){
  const values=Object.values(keys);
  return values.every(k=>typeof k==='string' && /^(?:[a-z0-9]|f[1-9]|f10|f11)$/.test(k) && !reserved.has(k)) && new Set(values).size===values.length;
}
export function configureKeys(dialog){
  let keys={...defaults};
  try{
    const prior=JSON.parse(localStorage.getItem(storage));
    const candidate=Object.fromEntries(Object.keys(defaults).map(k=>[k,prior?.[k]??defaults[k]]));
    if(valid(candidate))keys=candidate;
  }catch{}
  const grid=document.createElement('div'), message=document.createElement('output');
  grid.className='key-grid';
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset shortcuts';
  function render(){
    grid.replaceChildren();
    for(const [name,key] of Object.entries(keys)){
      const b=document.createElement('button');b.type='button';b.textContent=key.toUpperCase();
      b.onclick=()=>{
        b.textContent='…';message.textContent='Press a key · Esc to cancel';
        b.onblur=()=>{b.onkeydown=null;b.textContent=keys[name].toUpperCase();};
        b.onkeydown=e=>{
          e.preventDefault();e.stopPropagation();
          if(e.key==='Escape'){render();message.textContent='';return;}
          const fresh={...keys,[name]:e.key.toLowerCase()};
          if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||!valid(fresh)){message.textContent='Unavailable or already assigned';return;}
          keys=fresh;localStorage.setItem(storage,JSON.stringify(keys));message.textContent='';render();
        };
      };
      const label=document.createElement('label');label.textContent=name;label.append(b);grid.append(label);
    }
  }
  reset.onclick=()=>{keys={...defaults};localStorage.removeItem(storage);message.textContent='';render();};
  dialog.querySelector('strong').after(grid,message,reset);render();
  return key=>Object.keys(keys).find(action=>keys[action]===key);
}
