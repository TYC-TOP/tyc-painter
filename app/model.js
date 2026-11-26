// Model import: OBJ (+MTL +textures, or a .zip with all of them), glTF/GLB and FBX.
// Produces a plain description the app turns into texture sets: one part per mesh / material group.
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/OBJLoader.js';
import { GLTFLoader } from './vendor/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from './vendor/jsm/loaders/FBXLoader.js';

const base = n => n.replace(/\\/g, '/').split('/').pop().toLowerCase();
const IMG = /\.(png|jpe?g|webp|bmp|tga)$/i;

// files: [{ name, data:ArrayBuffer }]  ->  Map(lowercase basename -> { name, data })
async function expandZips(files){
  const out = new Map();
  for(const f of files){
    if(/\.zip$/i.test(f.name)){
      const zip = await JSZip.loadAsync(f.data);
      for(const e of Object.values(zip.files)) if(!e.dir && !/(^|\/)__MACOSX\//.test(e.name)) out.set(base(e.name), { name:e.name.split('/').pop(), data:await e.async('arraybuffer') });
    } else out.set(base(f.name), f);
  }
  return out;
}
async function toImage(f){
  if(!f) return null;
  if(/\.tga$/i.test(f.name)) return decodeTGA(f.data);
  try{ return await createImageBitmap(new Blob([f.data])); } catch{ return null; }
}
// Minimal uncompressed / RLE true-colour TGA reader (Roblox and many packs still ship .tga).
function decodeTGA(buf){
  const d = new Uint8Array(buf), idl = d[0], type = d[2], w = d[12] | d[13] << 8, h = d[14] | d[15] << 8, bpp = d[16] >> 3, top = d[17] & 32;
  if(d.length<18 || !(type===2 || type===10) || ![3,4].includes(bpp) || !w || !h || w*h>8192*8192) return null;
  if(type===2 && 18+idl+w*h*bpp>d.length)throw new Error('Incomplete TGA');
  const out = new Uint8ClampedArray(w*h*4); let p = 18 + idl, i = 0;
  const px = () => { if(p+bpp>d.length)throw new Error('Incomplete TGA pixels'); const b = d[p], g = d[p+1], r = d[p+2], a = bpp === 4 ? d[p+3] : 255; p += bpp; return [r, g, b, a]; };
  const put = c => { const x = i % w, y = (i/w) | 0, yy = top ? y : h - 1 - y, k = (yy*w + x)*4; out[k] = c[0]; out[k+1] = c[1]; out[k+2] = c[2]; out[k+3] = c[3]; i++; };
  while(i < w*h){
    if(type === 2) put(px());
    else { const hdr = d[p++], n = (hdr & 127) + 1; if(hdr & 128){ const c = px(); for(let k = 0; k < n; k++) put(c); } else for(let k = 0; k < n; k++) put(px()); }
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
  return c;
}
function parseMTL(txt){
  const mats = {}; let cur = null;
  for(const raw of txt.split(/\r?\n/)){
    const line = raw.trim(); if(!line || line[0] === '#') continue;
    const [k, ...rest] = line.split(/\s+/), v = rest.join(' ');
    const file = () => v.split(/\s+-\w+(?:\s+[-\d.]+)*/).join(' ').trim().split(/\s+/).pop();
    if(k === 'newmtl'){ cur = mats[v] = { name:v }; continue; }
    if(!cur) continue;
    if(k === 'Kd') cur.kd = rest.slice(0, 3).map(Number);
    else if(k === 'd') cur.d = +rest[0];
    else if(k === 'Tr') cur.d = 1 - +rest[0];
    else if(k === 'map_Pr') cur.roughMap = file();
    else if(k === 'map_Pm') cur.metalMap = file();
    else if(k === 'Pr') cur.rough = +v;
    else if(k === 'Pm') cur.metal = +v;
    else if(k === 'map_Kd') cur.map = file();
    else if(/^(map_bump|bump|norm|map_Bump)$/i.test(k)) cur.nmap = file();
  }
  return mats;
}
// Bake the world transform into a non-indexed geometry and split multi-material meshes into one geometry per material.
function pieces(mesh){
  mesh.updateWorldMatrix(true, false);
  let g = mesh.geometry.clone();
  if(g.index) g = g.toNonIndexed();
  for(const k of Object.keys(g.attributes)) if(!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  g.applyMatrix4(mesh.matrixWorld);
  if(!g.attributes.normal) g.computeVertexNormals();
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if(!Array.isArray(mesh.material) || !g.groups.length) return [{ geo:g, mat:mats[0] }];
  return g.groups.map(gr => {
    const ng = new THREE.BufferGeometry();
    for(const [k, a] of Object.entries(g.attributes)) ng.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start*a.itemSize, (gr.start + gr.count)*a.itemSize), a.itemSize));
    return { geo:ng, mat:mats[gr.materialIndex] || mats[0] };
  }).filter(x => x.geo.attributes.position.count >= 3);
}
const imgOf = tex => tex && tex.image && (tex.image.width || tex.image.videoWidth) ? tex.image : null;

/* Returns { name, kind, unitM, parts:[{ name, geo, img, nimg, color:[r,g,b] (0..1), glass }] }  */
export async function importModel(fileList, mainName){
  const files = await expandZips(fileList);
  const all = [...files.values()];
  const main = (mainName && files.get(base(mainName)) && !/\.zip$/i.test(mainName)) ? files.get(base(mainName))
    : all.find(f => /\.(glb|gltf)$/i.test(f.name)) || all.find(f => /\.fbx$/i.test(f.name)) || all.find(f => /\.obj$/i.test(f.name));
  if(!main) throw new Error('no-model');
  const ext = main.name.split('.').pop().toLowerCase(), name = main.name.replace(/\.\w+$/, '');
  const blobURLs = [];
  const urlFor = n => { const f = files.get(base(decodeURIComponent(n.split('?')[0]))); if(!f) return null; const u = URL.createObjectURL(new Blob([f.data])); blobURLs.push(u); return u; };
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier(u => (/^(blob|data):/.test(u) ? u : urlFor(u)) || u);
  const parts = [];
  const seen = new Map();
  const uniq = n => { n = (n || 'Part').replace(/[^\w\-. ]+/g, '_').trim() || 'Part'; const k = seen.get(n) || 0; seen.set(n, k + 1); return k ? `${n}_${k + 1}` : n; };
  try{
    if(ext === 'obj'){
      const txt = new TextDecoder().decode(main.data);
      const mtlName = (txt.match(/^mtllib\s+(.+)$/m) || [])[1];
      const mf = files.get(base(mtlName || name + '.mtl')) || all.find(f => /\.mtl$/i.test(f.name));
      const mtl = mf ? parseMTL(new TextDecoder().decode(mf.data)) : {};
      const obj = new OBJLoader().parse(txt);
      const imgs = new Map();
      const getImg = async n => { if(!n) return null; const k = base(n); if(!imgs.has(k)) imgs.set(k, await toImage(files.get(k))); return imgs.get(k); };
      for(const mesh of obj.children.filter(o => o.isMesh || o.isSkinnedMesh)){
        for(const pc of pieces(mesh)){
          const mi = mtl[pc.mat && pc.mat.name] || {};
          const pname = uniq(mesh.children.length || !Array.isArray(mesh.material) ? mesh.name || mi.name : `${mesh.name}_${mi.name || ''}`);
          parts.push({ name:pname, geo:pc.geo, img:await getImg(mi.map), texName:mi.map ? mi.map.split(/[\\/]/).pop() : null, nimg:await getImg(mi.nmap), nName:mi.nmap ? mi.nmap.split(/[\\/]/).pop() : null,
            roughImg:await getImg(mi.roughMap), metalImg:await getImg(mi.metalMap), rough:mi.rough ?? (mi.roughMap ? 1 : undefined), metal:mi.metal ?? (mi.metalMap ? 1 : undefined), color:mi.kd || [0.6, 0.6, 0.6], glass:mi.d !== undefined && mi.d < 0.99 });
        }
      }
      return { name, kind:'obj', unitM:0.17, parts };
    }
    let root;
    if(ext === 'glb' || ext === 'gltf'){
      const gl = await new GLTFLoader(mgr).parseAsync(main.data, '');
      root = gl.scene;
    } else if(ext === 'fbx'){
      root = new FBXLoader(mgr).parse(main.data, '');
      await new Promise(res => { let done = false; mgr.onLoad = () => { done = true; res(); }; setTimeout(() => !done && res(), 4000); });
      await new Promise(r => setTimeout(r, 50));
    } else throw new Error('format');
    root.updateMatrixWorld(true);
    const meshes = []; root.traverse(o => { if(o.isMesh || o.isSkinnedMesh) meshes.push(o); });
    const gltf = ext !== 'fbx';
    for(const mesh of meshes){
      for(const pc of pieces(mesh)){
        const m = pc.mat || {};
        // glTF stores V top-down; flip so every part follows the OBJ convention used by the editor.
        if(gltf && pc.geo.attributes.uv){ const a = pc.geo.attributes.uv.array; for(let i = 1; i < a.length; i += 2) a[i] = 1 - a[i]; }
        const c = m.color ? [m.color.r, m.color.g, m.color.b].map(v => Math.pow(v, 1/2.2)) : [0.6, 0.6, 0.6];
        const pn = uniq(Array.isArray(mesh.material) ? `${mesh.name}_${m.name || ''}` : (mesh.name || m.name));
        const im = imgOf(m.map), nm = imgOf(m.normalMap);
        parts.push({ name:pn, geo:pc.geo, img:im, texName:m.map && m.map.name ? m.map.name : null, nimg:nm, nName:null, color:c, rough:m.roughness, metal:m.metalness, roughImg:imgOf(m.roughnessMap), metalImg:imgOf(m.metalnessMap), optics:{transmission:m.transmission,ior:m.ior,clearcoat:m.clearcoat,iridescence:m.iridescence}, aoImg:!m.aoMap?.channel ? imgOf(m.aoMap) : null, aoStrength:m.aoMapIntensity ?? 1, packed:true,
          glass:!!m.transparent && (m.opacity ?? 1) < 0.99, flipImg:gltf });
      }
    }
    return { name, kind:ext, unitM:ext === 'fbx' ? 0.01 : 1, parts };
  } finally { setTimeout(() => blobURLs.forEach(u => URL.revokeObjectURL(u)), 5000); }
}
export const MODEL_FILE = /\.(obj|zip|glb|gltf|fbx)$/i;
export { IMG };
