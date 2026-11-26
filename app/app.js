// TYC Painter — UI (renderer process)
import {checkProject} from './project-check.js';
import {layerTree} from './layer-tree.js';
import {gearTextile} from './materials/gear-textiles.js';
import {configureKeys} from './keymap.js';
import {decalCache} from './decal-layer.js';
import {seamMaps} from './seam.js';
import {setupOutput} from './output-panel.js';
import {recoveryController} from './recovery.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { OBJLoader } from 'three/addons/OBJLoader.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import * as E from './engine.js';
import { t, pick, setLang, getLang, applyI18n, autoTranslate } from './i18n.js';
import { importModel, MODEL_FILE } from './model.js';
import { initPatchStudio } from './patch.js';

const DESK = window.desktop || null; // desktop API (Electron); null in a plain browser
const $ = id => document.getElementById(id);
const { hexToRgb, rgbToHex, clamp255 } = E;

// ============================================================ model data
const MODEL = 'assets/casco-obj.txt';
const STUD_M = 0.17; // 1 model stud ≈ 17 cm (helmet ≈ 1.6 studs)
const PARTS = {
  Meshes221:          { label:['Helmet shell', 'Carcasa del casco'], diff:'Meshes221_diff.png', nmap:'Meshes221_nmap.png', zones:{ velcro:[[0,172,400,304],[446,236,614,544],[0,756,504,1024]] } },
  RhinoOtherVariant1: { label:['Rhino / camo', 'Rhino / camuflaje'], diff:'RhinoOtherVariant1_diff.png' },
  Meshes2101:         { label:['Meshes2101', 'Meshes2101'], diff:'Meshes2101_diff.png' },
  Helmet1:            { label:['Helmet1', 'Helmet1'], diff:'Helmet1_diff.png', nmap:'Helmet1_nmap.png' },
  Up1:                { label:['PVS-14', 'PVS-14'], diff:'Up1_diff.png', nmap:'Up1_nmap.png' },
  Tatm31:             { label:['TATM', 'TATM'], diff:'Tatm31_diff.png', nmap:'Tatm31_nmap.png' },
  Mesheslpmainmount1: { label:['Wilcox mount', 'Montura Wilcox'], diff:'Mesheslpmainmount1_diff.png', nmap:'Mesheslpmainmount1_nmap.png' },
  Mesheslpplates1:    { label:['Mount plates', 'Placas de la montura'], diff:'Mesheslpplates1_diff.png', nmap:'Mesheslpplates1_nmap.png' },
  Meshesflipuparm1:   { label:['Flip-up arm', 'Brazo abatible'], diff:'Meshesflipuparm1_diff.png', nmap:'Meshesflipuparm1_nmap.png' },
  Meshesflipuphead1:  { label:['Flip-up head', 'Cabezal abatible'], diff:'Meshesflipuphead1_diff.png', nmap:'Meshesflipuphead1_nmap.png' },
  Middle1:            { label:['Head (mannequin)', 'Cabeza (maniquí)'], diff:'Middle1_diff.png', nmap:'Middle1_nmap.png' },
  Mcp1:               { label:['Mcp1', 'Mcp1'], diff:'Mcp1_diff.png', nmap:'Mcp1_nmap.png' },
  Color21:            { label:['Glass', 'Cristal'], diff:'Color21_diff.png', nmap:'Color21_nmap.png', glass:true },
  Color31:            { label:['Color31', 'Color31'], color:[0.007,0.019,0.032] },
  Lens1:              { label:['Lens', 'Lente'], color:[0,0,0] },
};
const PALETTES = [
  { n:['Arid', 'Árido'],                       c:['#c9b48a','#a88d63','#7b6a4c','#d9cfb4'] },
  { n:['3-colour desert', 'Desierto 3 colores'], c:['#d6c4a0','#b59a72','#8c7457','#c9b28a'] },
  { n:['Woodland', 'Woodland'],                c:['#4b5a32','#6b6a3a','#3a2f22','#1d1d17'] },
  { n:['Urban', 'Urbano'],                     c:['#8a8d8f','#5e6265','#b7b9ba','#2f3234'] },
  { n:['Snow', 'Nieve'],                       c:['#eef0f0','#c9cdd0','#9aa0a5','#ffffff'] },
  { n:['NATO green', 'Verde OTAN'],            c:['#4d5940','#3b4532','#646b4f','#2a2f24'] },
  { n:['Tactical black', 'Negro táctico'],     c:['#222324','#2e3031','#171818','#3a3c3d'] },
];
const DIGITAL_RE = /marpat|ucp|cadpat|emr|digi|pixel|m09|aor|abu|nwu|type 0[37]|xingkong|pixelado|ccu|amcu|philarpat|wavepat|granite|tsifra/i;
const REGEN = new Set(['white', 'black', 'zone', 'dirt', 'edges', 'cavity', 'noise', 'gradient','dustUp']); // masks that can be rebuilt at any resolution
const PARAM = new Set(['dirt', 'edges', 'cavity', 'noise', 'gradient','dustUp']);

// ============================================================ state
const S = {
  tool:'paint', sel:null, parts:new Map(), undo:[], redo:[], stroke:null,
  target:'content', maskWhite:true, view:'material', arm:false, modelSize:1, unitM:STUD_M, model:null,
  uv:{ on:false, z:300, ox:40, oy:40, sel:new Set(), mode:'move', pick:'island', drag:null, box:null }, // uv.sel = triangle indices
  decal:{ src:null, name:'' },
};
let LID = 1, MID = 1, BID = 1;
let customAlpha=null, pressure=1;
function alphaWeight(x,y,kind,angle){const c=Math.cos(angle),sn=Math.sin(angle),u=x*c+y*sn,v=-x*sn+y*c;if(kind==='scratch')return Math.max(0,1-Math.abs(v+.1*Math.sin(u*13))*22);if(kind==='stitch')return Math.max(0,1-Math.hypot(u*.85,v*4));if(kind==='speckle')return E.fbm(u*24,v*24,733,3)>.52?1:.08;if(kind==='custom'&&customAlpha){const a=customAlpha,ix=Math.floor((u*.5+.5)*a.w),iy=Math.floor((v*.5+.5)*a.h);if(ix<0||iy<0||ix>=a.w||iy>=a.h)return 0;const k=(iy*a.w+ix)*4;return (a.data[k]*.2126+a.data[k+1]*.7152+a.data[k+2]*.0722)/255*a.data[k+3]/255;}return 1;}
$('alphaLoad').onclick=()=>{const input=document.createElement('input');input.type='file';input.accept='image/*';input.onchange=async()=>{if(!input.files[0])return;try{const im=await createImageBitmap(input.files[0]);customAlpha=E.srcFromImage(im,512);im.close();$('brushAlpha').value='custom';}catch(e){toast(e.message);}};input.click();};
for(const ev of ['pointerdown','pointermove'])addEventListener(ev,e=>{pressure=e.pointerType==='pen'&&$('penPressure').checked?e.pressure:1;},true);


// ============================================================ three.js
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, preserveDrawingBuffer:false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c1e);
const studioRoom=new RoomEnvironment(), studioFilter=new THREE.PMREMGenerator(renderer);
let studioMap=studioFilter.fromScene(studioRoom,.04);
scene.environment=studioMap.texture;
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12;
let needs3d = true, last3d = 0;
const key = new THREE.DirectionalLight(0xffffff, 1.4); scene.add(key);
const rim = new THREE.DirectionalLight(0xbfd4ff, 0.6); scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 0.4));
const grid = new THREE.GridHelper(4, 20, 0x2c3034, 0x232629); scene.add(grid);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48),
  new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.85, depthTest:false, side:THREE.DoubleSide }));
ring.renderOrder = 999; ring.visible = false; scene.add(ring);
const root = new THREE.Group(); scene.add(root);
function setLight(deg){ const a = deg*Math.PI/180; key.position.set(5*Math.sin(a), 4, 5*Math.cos(a)); rim.position.set(-4.2*Math.sin(a), 1, -4.2*Math.cos(a)); }
setLight(35);
$('lightRot').addEventListener('input', e => setLight(+e.target.value));

function resize(){
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width/Math.max(1, r.height); camera.updateProjectionMatrix();
  resizeUV();
}
new ResizeObserver(resize).observe($('viewpane'));

// ============================================================ small utilities
function loadImage(src){ return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
let toastT;
function toast(s){ const el = $('toast'); el.textContent = s; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200); }
function setStatus(s){ $('status').textContent = s; }
function resetStatus(){ setStatus(t('st.keys')); }
const plabel = p => p.info && p.info.label ? pick(p.info.label) : p.name;
const FMT = {
  bSpace:v => v + '%', fRot:v => v + '°', dRot:v => v + '°', dSize:v => v + '%', dOp:v => v + '%', lOpacity:v => v + '%',
  aCon:v => (v > 0 ? '+' : '') + v, aSat:v => (v > 0 ? '+' : '') + v, aBri:v => (v > 0 ? '+' : '') + v, aHue:v => v + '°',
  mHeight:v => (v > 0 ? '+' : '') + v, gScale:v => (v/100).toFixed(1) + '×',
  fSx:v => Math.round(Math.pow(2, v/100)*100) + '%', fSy:v => Math.round(Math.pow(2, v/100)*100) + '%',
};
function syncVals(){
  document.querySelectorAll('input[type=range]').forEach(el => { const v = $(el.id + 'V'); if(v) v.textContent = (FMT[el.id] || (x => x))(+el.value); });
}
document.addEventListener('input', e => { if(e.target.type === 'range'){ const v = $(e.target.id + 'V'); if(v) v.textContent = (FMT[e.target.id] || (x => x))(+e.target.value); } });

async function saveBytes(name, data, filters){
  if(DESK){
    const buf = data instanceof Blob ? await data.arrayBuffer() : data;
    const p = await DESK.saveFile(name, buf, filters);
    if(p) toast(t('msg.saved', p.split(/[\\/]/).pop()));
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// Long jobs (zip, project files): pause 3D rendering so the work is not interleaved with frames.
async function busy(statusKey, fn){
  setStatus(t(statusKey)); renderer.setAnimationLoop(null);
  await new Promise(r => setTimeout(r, 30));
  try{ return await fn(); } catch(err){ console.error(err); toast(err && err.message === 'no-model' ? t('msg.nomodel') : String(err.message || err)); }
  finally{ renderer.setAnimationLoop(tick); resetStatus(); }
}
async function netJSON(url){ return DESK ? DESK.getJSON(url) : (await fetch(url)).json(); }
async function netBlob(url){ return DESK ? new Blob([await DESK.getBytes(url)]) : (await fetch(url)).blob(); }
function mkCanvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function mkTex(c, srgb){
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// ============================================================ materials and layers
function mkMat(o){ return Object.assign({ id:MID++, ver:0 }, o); }
const SHADE = mkMat({ kind:'shade', builtin:'shade', name:'' });
const ORIG = mkMat({ kind:'orig', builtin:'orig', name:'' }); // the model's own texture, to bring back stitching, labels, buckles…
const DETAIL = {}; // grey detail textures (velcro, webbing)
async function loadDetail(name){
  const src = E.srcFromImage(await loadImage('assets/materials/' + name + '.png'), 1024);
  DETAIL[name] = mkMat({ kind:'image', gray:true, builtin:name, src, thumb:E.srcThumb(src), name });
}
function camoMat(type, colors, seed){
  const src = E.makeCamo(type, colors, seed);
  return mkMat({ kind:'camo', type, colors:colors.slice(), seed, src, thumb:E.srcThumb(src), digital:type === 'digital', name:t('mat.camo.' + type) });
}
function mkLayer(type, props){
  return Object.assign({ id:LID++, type, name:'', visible:true, opacity:1, blend:'normal',
    ch:{ color:true, rough:false, metal:false, height:false }, rough:0.8, metal:0, height:0.3,
    mask:null, maskGen:null, maskPainted:false, cache:null }, props);
}
function newFill(M, props){
  return mkLayer('fill', Object.assign({ mat:M, name:M.name, proj:'uv', filter:'bilinear', wrap:'repeat', tiling:1, sx:1, sy:1, rot:0, offX:0, offY:0,
    con:0, sat:0, bri:0, match:false, color:'#7c6447', real:false }, props));
}
const solidMat = () => mkMat({ kind:'solid', name:t('mat.solid') });
function cloneLayer(L){ return { ...L, ch:{ ...L.ch }, maskGen:L.maskGen ? { ...L.maskGen } : null }; }
const active = p => p.layers.find(l => l.id === p.activeId) || null;
function cur(){ const p = S.parts.get(S.sel); return p && p.editable ? p : null; }
const uvArr = p => p.mesh.geometry.attributes.uv.array;

function matMeanLum(M){
  if(M.meanLum) return M.meanLum;
  const s = E.mips(M.src).at(-1); let sl = 0;
  for(let i = 0; i < s.w*s.h; i++) sl += E.lum(s.data[i*4], s.data[i*4+1], s.data[i*4+2]);
  return M.meanLum = sl/(s.w*s.h);
}
function getShade(p){
  if(p.shade && p.shadeSrc === p.baseSrc) return p.shade;
  let s = p.baseSrc;
  if(Math.max(s.w, s.h) > 1024){ const k = 1024/Math.max(s.w, s.h), w = Math.round(s.w*k), h = Math.round(s.h*k); s = { w, h, data:E.resampleRGBA(s.data, s.w, s.h, w, h) }; }
  p.shade = E.extractShade(s.data, s.w, s.h); p.shadeSrc = p.baseSrc;
  return p.shade;
}
function getMaps(p){
  if(p.maps && p.maps.uvVer === p.uvVer) return p.maps;
  const g = p.mesh.geometry, w = 512, h = Math.max(8, Math.round(512*p.H0/p.W0));
  const geo = E.bakeGeo(g.attributes.position.array, g.attributes.normal ? g.attributes.normal.array : null, uvArr(p), w, h);
  let nm = null;
  if(p.nmapImg){ const c = mkCanvas(w, h), x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(p.nmapImg, 0, 0, w, h); nm = x.getImageData(0, 0, w, h).data; }
  const curv = E.bakeCurvature(geo, nm);
  if(!g.boundingBox) g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, dy = Math.max(1e-6, g.boundingBox.max.y - y0), posY = new Float32Array(w*h).fill(0.5);
  for(let i = 0; i < w*h; i++) if(geo.cover[i]) posY[i] = (geo.pos[i*3+1] - y0)/dy;
  const up=new Float32Array(w*h);
  for(let i=0;i<up.length;i++) if(geo.cover[i]){
    const j=i*3;
    up[i]=Math.max(0,geo.nrm[j+1]/(Math.hypot(geo.nrm[j],geo.nrm[j+1],geo.nrm[j+2]) || 1));
  }
  let occlusion=null;
  if(p.aoSource){
    const values=originalScalar(p.aoSource,w,h);
    occlusion={d:Float32Array.from(values,v=>1+(v/255-1)*p.aoStrength),w,h};
  }
  return p.maps = { uvVer:p.uvVer, occlusion, up:{d:up,w,h}, curv, posY:{ d:posY, w, h } };
}
function genCtx(p){
  const m = getMaps(p);
  return { W:p.W, H:p.H, ao:m.occlusion, up:m.up, curv:m.curv, posY:m.posY, zones:p.info.zones && p.info.zones.velcro };
}
const SMOOTH = new Set(['dirt', 'edges', 'cavity', 'noise', 'gradient','dustUp']);
function makeMask(g, p){
  const c = genCtx(p);
  if(!SMOOTH.has(g.type) || p.W <= 2048) return E.genMask(g, c);
  const k = 2048/p.W, w = Math.round(p.W*k), h = Math.round(p.H*k);
  return E.resampleGray(E.genMask(g, Object.assign(c, { W:w, H:h })), w, h, p.W, p.H);
}
function baseRaster(p){
  const b = p.layers[0], k = `${p.W}x${p.H}|${p.baseSrc.id}`;
  if(b._rk !== k){ const s = p.baseSrc; b.raster = (s.w === p.W && s.h === p.H) ? s.data : E.resampleRGBA(s.data, s.w, s.h, p.W, p.H); b._rk = k; }
  return b.raster;
}
function cacheKey(p, L){
  const M = L.mat;
  if(M.kind === 'shade') return `shade|${p.W}x${p.H}|${p.baseSrc.id}`;
  if(M.kind === 'orig') return `orig|${p.W}x${p.H}|${p.baseSrc.id}`;
  return [p.W, p.H, L.proj === 'tri' ? p.uvVer : 0, M.id, M.ver, L.proj, L.filter, L.wrap, L.tiling, L.sx ?? 1, L.sy ?? 1, L.rot, L.offX, L.offY, L.con, L.sat, L.bri, L.match, L.color, L.ch.height, L.ch.rough].join('|');
}
function ensureCache(p, L){
  if(L.type === 'base'){ baseRaster(p); return; }
  if(L.type==='decalUV'){L.cache=decalCache(L,p.W,p.H);return;}
  if(L.type==='seam'){L.cache=seamMaps(L,p.W,p.H);return;}
  if(L.type !== 'fill') return;
  const M = L.mat, W = p.W, H = p.H, k = cacheKey(p, L);
  if(L.cache && L.cache.key === k) return;
  if(M.kind === 'orig'){ L.cache = { key:k, col:baseRaster(p) }; return; }
  if(M.kind === 'shade'){
    const sh = getShade(p), gray = new Uint8Array(W*H), vm = sh.valid;
    for(let y = 0; y < H; y++){
      const v = (y + 0.5)/H, vy = Math.min(vm.h - 1, (v*vm.h) | 0)*vm.w;
      for(let x = 0; x < W; x++){
        const u = (x + 0.5)/W;
        gray[y*W + x] = vm.d[vy + Math.min(vm.w - 1, (u*vm.w) | 0)] ? clamp255(E.sampleMap(sh.ao, u, v)*E.sampleMap(sh.fine, u, v)*128) : 0;
      }
    }
    L.cache = { key:k, gray }; return;
  }
  const g = p.mesh.geometry;
  let expo = 1;
  if(L.match && M.src && !M.gray) expo = 1 + (Math.min(1.6, Math.max(0.5, getShade(p).ref/Math.max(1, matMeanLum(M)))) - 1)*0.85;
  const res = E.renderFill({
    W, H, P:g.attributes.position.array, Nn:g.attributes.normal ? g.attributes.normal.array : null, U:uvArr(p),
    src:M.kind === 'solid' ? null : M.src, roughSrc:M.roughSrc || null, heightSrc:M.heightSrc || null, solid:hexToRgb(L.color),
    proj:L.proj, filter:L.filter, wrap:L.wrap, tiling:L.tiling, sx:L.sx ?? 1, sy:L.sy ?? 1, rot:L.rot, offX:L.offX, offY:L.offY, modelSize:S.modelSize,
    con:L.con, sat:L.sat, bri:L.bri, expo, colorize:M.gray ? hexToRgb(L.color) : null,
    wantRough:L.ch.rough, wantHeight:L.ch.height && M.kind !== 'solid',
  });
  L.cache = Object.assign({ key:k }, res);
}

// ============================================================ output buffers, compositing, presenting
function originalScalar(source, width, height){
  if(!source) return null;
  const ctx = mkCanvas(width, height).getContext('2d');
  ctx.drawImage(source.image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  return Uint8Array.from({length:width * height}, (_, i) => Math.round(pixels[4*i + source.channel] * source.factor));
}
function allocOut(p){
  p.originalR = originalScalar(p.roughSource, p.W, p.H);
  p.originalAO = originalScalar(p.aoSource,p.W,p.H);
  if(p.originalAO){for(let i=0;i<p.originalAO.length;i++)p.originalAO[i]=255+(p.originalAO[i]-255)*p.aoStrength;}
  p.originalM = originalScalar(p.metalSource, p.W, p.H);
  for(const k of ['tex', 'texORM', 'texN', 'viewTex']) if(p[k]){ p[k].dispose(); p[k] = null; }
  p.out = new Uint8ClampedArray(p.W*p.H*4); p.imgData = new ImageData(p.out, p.W, p.H);
  p.outR = p.outM = p.outH = p.outN = p.baseN = p.ormImg = p.nImg = null; p.canvasORM = p.canvasN = p.viewCanvas = null;
  p.canvas = mkCanvas(p.W, p.H); p.ctx = p.canvas.getContext('2d');
  p.tex = mkTex(p.canvas, true); p.mat.map = p.tex; p.mat.needsUpdate = true;
}
function ensureChannels(p){
  let r = !!p.originalR, m = !!p.originalM, h = false;
  for(const L of p.layers) if(L.visible && L.type !== 'adjust' && L.type !== 'base'){ r = r || L.ch.rough; m = m || L.ch.metal; h = h || L.ch.height; }
  const N = p.W*p.H;
  p.useR = r; p.useM = m; p.useH = h;
  p.outR = r ? (p.outR || new Uint8Array(N)) : null;
  p.outM = m ? (p.outM || new Uint8Array(N)) : null;
  p.outH = h ? (p.outH || new Int16Array(N)) : null;
  if(r || m || p.originalAO){
    if(!p.canvasORM){ p.canvasORM = mkCanvas(p.W, p.H); p.ctxORM = p.canvasORM.getContext('2d'); p.texORM = mkTex(p.canvasORM, false); p.ormImg = new ImageData(p.W, p.H); p.ormImg.data.fill(255); }
  }
  if(h){
    if(!p.canvasN){
      p.canvasN = mkCanvas(p.W, p.H); p.ctxN = p.canvasN.getContext('2d'); p.texN = mkTex(p.canvasN, false);
      p.outN = new Uint8ClampedArray(N*4); p.nImg = new ImageData(p.outN, p.W, p.H);
      if(p.nmapImg){ const c = mkCanvas(p.W, p.H), x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(p.nmapImg, 0, 0, p.W, p.H); p.baseN = x.getImageData(0, 0, p.W, p.H).data; }
    }
  }
}
function syncMaterial(p){
  const m = p.mat; let dirty = false;
  const orm = (p.useR || p.useM || p.originalAO) ? p.texORM : null;
  if(m.roughnessMap !== orm || m.metalnessMap !== orm){ m.roughnessMap = m.metalnessMap = orm; dirty = true; }
  m.roughness = orm ? 1 : p.baseRough; m.metalness = orm ? 1 : p.baseMetal;
  const ao=p.originalAO ? orm : null;
  if(m.aoMap!==ao){m.aoMap=ao;dirty=true;}
  const n = p.useH ? p.texN : (p.texN0 || null);
  if(m.normalMap !== n){ m.normalMap = n; dirty = true; }
  if(m.map !== p.tex){ m.map = p.tex; dirty = true; }
  if(dirty) m.needsUpdate = true;
}
function recomposite(p, rect){
  for(const L of p.layers) if(L.visible) ensureCache(p, L);
  ensureChannels(p);
  const [x0, y0, x1, y1] = rect || [0, 0, p.W - 1, p.H - 1];
  E.composite(p, x0, y0, x1, y1);
  present(p, x0, y0, x1, y1);
}
function present(p, x0 = 0, y0 = 0, x1 = p.W - 1, y1 = p.H - 1){
  const w = x1 - x0 + 1, h = y1 - y0 + 1; if(w <= 0 || h <= 0) return;
  if(p.sel && S.sel === p.name){ // selection overlay (cyan stripes)
    const o = p.ctx.createImageData(w, h), od = o.data, d = p.out, m = p.sel;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const i = (y0 + y)*p.W + (x0 + x), k = i*4, j = (y*w + x)*4, s = m[i]/255, tt = s*((((x0 + x + y0 + y) >> 2) & 1) ? 0.45 : 0.3);
      od[j] = d[k]*(1 - tt) + 40*tt; od[j+1] = d[k+1]*(1 - tt) + 210*tt; od[j+2] = d[k+2]*(1 - tt) + 255*tt; od[j+3] = 255;
    }
    p.ctx.putImageData(o, x0, y0);
  } else p.ctx.putImageData(p.imgData, 0, 0, x0, y0, w, h);
  p.tex.needsUpdate = true; needs3d = true;
  if(p.useR || p.useM || p.originalAO){
    const d = p.ormImg.data, R = p.outR, M = p.outM, r0 = Math.round(p.baseRough*255), m0 = Math.round(p.baseMetal*255);
    for(let y = y0; y <= y1; y++) for(let x = x0, i = y*p.W + x0; x <= x1; x++, i++){ d[i*4] = p.originalAO ? p.originalAO[i] : 255; d[i*4+1] = R ? R[i] : r0; d[i*4+2] = M ? M[i] : m0; }
    p.ctxORM.putImageData(p.ormImg, 0, 0, x0, y0, w, h); p.texORM.needsUpdate = true;
  }
  if(p.useH){
    const a = Math.max(0, x0 - 1), b = Math.max(0, y0 - 1), c = Math.min(p.W - 1, x1 + 1), e = Math.min(p.H - 1, y1 + 1);
    E.normalRect(p, p.baseN, p.outN, a, b, c, e);
    p.ctxN.putImageData(p.nImg, 0, 0, a, b, c - a + 1, e - b + 1); p.texN.needsUpdate = true;
  }
  syncMaterial(p);
  if(S.view !== 'material' && S.sel === p.name) drawView(p);
  if(S.uv.on && S.sel === p.name) schedUV();
}
// Single-channel viewer (like a solo view): base colour, roughness, metallic, normal, height or the active layer's mask.
function drawView(p){
  if(S.view === 'material'){ p.mesh.material = p.mat; return; }
  if(!p.viewMat) p.viewMat = new THREE.MeshBasicMaterial();
  if(S.view === 'color'){ p.viewMat.map = p.tex; p.viewMat.needsUpdate = true; p.mesh.material = p.viewMat; return; }
  if(!p.viewCanvas){ p.viewCanvas = mkCanvas(p.W, p.H); p.viewTex = mkTex(p.viewCanvas, true); }
  const N = p.W*p.H, img = new ImageData(p.W, p.H), d = img.data, L = active(p);
  let src = null, uni = 255;
  if(S.view === 'rough'){ src = p.outR; uni = p.baseRough*255; }
  else if(S.view === 'metal'){ src = p.outM; uni = p.baseMetal*255; }
  else if(S.view === 'mask'){ src = L && L.mask; uni = 255; }
  if(S.view === 'normal'){
  const n = p.useH ? p.outN : p.baseN || null;
    if(n) d.set(n); else for(let i = 0; i < N; i++){ d[i*4] = d[i*4+1] = 128; d[i*4+2] = 255; d[i*4+3] = 255; }
    if(!p.useH && !p.baseN && p.nmapImg){ p.viewCanvas.getContext('2d').drawImage(p.nmapImg, 0, 0, p.W, p.H); p.viewTex.needsUpdate = true; p.viewMat.map = p.viewTex; p.viewMat.needsUpdate = true; p.mesh.material = p.viewMat; return; }
  } else if(S.view === 'height'){
    const H = p.outH; for(let i = 0; i < N; i++){ const v = H ? clamp255(128 + H[i]/2048*127) : 128; d[i*4] = d[i*4+1] = d[i*4+2] = v; d[i*4+3] = 255; }
  } else for(let i = 0; i < N; i++){ const v = src ? src[i] : uni; d[i*4] = d[i*4+1] = d[i*4+2] = v; d[i*4+3] = 255; }
  p.viewCanvas.getContext('2d').putImageData(img, 0, 0); p.viewTex.needsUpdate = true;
  p.viewMat.map = p.viewTex; p.viewMat.needsUpdate = true; p.mesh.material = p.viewMat;
}
$('viewMode').onchange = e => { S.view = e.target.value; const p = cur(); if(p) drawView(p); };

// deferred recompute: instant at 1K, debounced with a "computing" note at 2K/4K
let kickT = 0, kickRAF = 0, kickP = null;
function kick(p){
  if(kickP && kickP !== p) flush();
  markDirty(p); kickP = p;
  const N = p.W*p.H;
  if(N > 1.5e6){ setStatus(t('st.computing')); clearTimeout(kickT); kickT = setTimeout(() => { kickT = 0; run(p); }, N > 5e6 ? 280 : 90); }
  else if(!kickRAF) kickRAF = requestAnimationFrame(() => { kickRAF = 0; run(p); });
}
function run(p){ kickP = null; try{ recomposite(p); } catch(err){ console.error(err); toast(String(err.message || err)); } resetStatus(); }
function flush(){ if(!kickP) return; clearTimeout(kickT); kickT = 0; cancelAnimationFrame(kickRAF); kickRAF = 0; run(kickP); }
function after(p){ kick(p); renderLayers(); renderProps(); updateButtons(); }
function markDirty(p){ recovery?.edited(); if(!p.dirty){ p.dirty = true; refreshList(); } }

// ============================================================ undo / redo
function snapStack(p, uv){
  const keep = p.W*p.H <= 1.1e6; // keep render caches in history only at ≤1K (memory)
  return { t:'stack', part:p.name, W:p.W, H:p.H, layers:p.layers.map(L => { const c = cloneLayer(L); if(!keep) c.cache = null; return c; }),
    activeId:p.activeId, sel:p.sel, uv:uv || null, baseSrc:p.baseSrc, uvDirty:p.uvDirty, optics:{...p.optics}, dirty:p.dirty, bytes:0 };
}
function pushEntry(e){
  S.undo.push(e); S.redo.length = 0;
  let bytes = 0; for(const x of S.undo) bytes += x.bytes;
  while(S.undo.length > 40 || (bytes > 6e8 && S.undo.length > 2)){ bytes -= S.undo[0].bytes; S.undo.shift(); }
  updateButtons();
}
function pushStack(p, uv){ pushEntry(snapStack(p, uv)); }
function pushRaster(p, L, field){ const arr = field === 'mask' ? L.mask : L.raster; pushEntry({ t:'raster', part:p.name, id:L.id, field, data:arr.slice(), bytes:arr.length }); }
function restore(e){
  const p = S.parts.get(e.part);
  if(e.t === 'raster'){
    const L = p.layers.find(l => l.id === e.id); if(!L) return null;
    const arr = e.field === 'mask' ? L.mask : L.raster; if(!arr || arr.length !== e.data.length) return null;
    const inv = { ...e, data:arr.slice() }; arr.set(e.data); return inv;
  }
  const inv = snapStack(p, e.uv ? new Float32Array(uvArr(p)) : null);
  const resCh = e.W !== p.W || e.H !== p.H;
  setOptics(p,e.optics); syncOptics(p);
  p.layers = e.layers.map(cloneLayer); p.activeId = e.activeId; p.sel = e.sel; p.baseSrc = e.baseSrc; p.uvDirty = e.uvDirty; p.dirty = e.dirty;
  if(e.uv){ setUV(p, e.uv); p.uvVer++; p.isl = null; }
  if(resCh){ p.W = e.W; p.H = e.H; allocOut(p); }
  return inv;
}
function swapState(from, to){
  flush();
  const e = from.pop(); if(!e) return;
  const inv = restore(e); if(inv) to.push(inv);
  const p = S.parts.get(e.part);
  if(S.sel !== p.name) select(p.name);
  p.dirty = true; recovery?.edited(); refreshList();
  if(p.W*p.H > 1.5e6) setStatus(t('st.computing'));
  run(p); renderLayers(); renderProps(); updateButtons(); syncRes(); if(S.uv.on) drawUV();
}
$('undo').onclick = () => swapState(S.undo, S.redo);
$('redo').onclick = () => swapState(S.redo, S.undo);

// ============================================================ model loading
function setLoad(v, s){ const b = $('lbar'); if(!b) return; b.style.width = (v*100) + '%'; if(s) $('ltext').textContent = s; }
function toCanvas(img){ const c = mkCanvas(img.width, img.height); c.getContext('2d').drawImage(img, 0, 0); return c; }
function disposeModel(){
  flush();
  for(const p of S.parts.values()){
    p.mesh.geometry.dispose();
    for(const k of ['tex', 'texORM', 'texN', 'texN0', 'viewTex']) if(p[k]) p[k].dispose();
    p.mat.dispose(); if(p.viewMat) p.viewMat.dispose();
  }
  while(root.children.length) root.remove(root.children[0]);
  S.parts.clear(); S.undo.length = S.redo.length = 0; S.uv.sel.clear(); S.sel = null; S.stroke = null; ring.visible = false;
}
// def = { name, unitM, parts:[{ name, geo, img, nimg, color, glass, info }] }
async function buildModel(def){
  const grp = new THREE.Group(); let done = 0;
  const used = new Set();
  for(const d of def.parts){
    const info = d.info, mat = new THREE.MeshPhysicalMaterial({ roughness:0.82, metalness:0 });
    const mesh = new THREE.Mesh(d.geo, mat); mesh.name = d.name;
    const p = { name:d.name, info, mesh, mat, editable:false, uvDirty:false, dirty:false, uvVer:0, baseRough:0.82, baseMetal:0 };
    p.mat.envMapIntensity=Number($('displayEnvironment').value);
    p.baseRough = d.rough ?? p.baseRough;
    p.baseMetal = d.metal ?? p.baseMetal;
    if(d.aoImg){
      p.aoSource={image:d.aoImg,channel:0,factor:1};
      p.aoStrength=d.aoStrength;
    }
    if(d.roughImg) p.roughSource = { image:d.roughImg, channel:d.packed ? 1 : 0, factor:p.baseRough };
    if(d.metalImg) p.metalSource = { image:d.metalImg, channel:d.packed ? 2 : 0, factor:p.baseMetal };
    p.defaultOptics={transmission:d.optics?.transmission ?? 0,ior:d.optics?.ior ?? 1.5,clearcoat:d.optics?.clearcoat ?? 0,iridescence:d.optics?.iridescence ?? 0};
    setOptics(p,p.defaultOptics);
    if(d.nimg){
      const nc = toCanvas(d.nimg); p.texN0 = mkTex(nc, false); p.nmapImg = nc; mat.normalMap = p.texN0;
    }
    const hasUV = !!d.geo.attributes.uv;
    if(hasUV && (d.img || d.blank)){
      let src;
      if(d.img) src = E.srcFromImage(d.img, 8192);
      else { const R = d.blank, data = new Uint8ClampedArray(R*R*4), c = d.color.map(v => Math.round(Math.min(1, Math.max(0, v))*255)); for(let i = 0; i < R*R; i++){ data[i*4] = c[0]; data[i*4+1] = c[1]; data[i*4+2] = c[2]; data[i*4+3] = 255; } src = { w:R, h:R, data }; }
      src.id = BID++;
      let alpha = false; for(let i = 3; i < src.data.length; i += 4) if(src.data[i] < 250){ alpha = true; break; }
      if(d.glass){ p.baseRough = d.rough ?? 0.1; mat.transparent = true; mat.opacity = 0.55; mat.depthWrite = false; }
      // export file names must be unique across parts
      let fn = info.diff; if(used.has(fn.toLowerCase())) fn = `${d.name}_${fn}`; used.add(fn.toLowerCase()); info.diff = fn;
      Object.assign(p, { editable:true, W0:src.w, H0:src.h, W:src.w, H:src.h, baseSrc:src, baseSrc0:src, hasAlpha:alpha, sel:null });
      p.layers = [mkLayer('base', { name:'' })]; p.activeId = p.layers[0].id;
      allocOut(p); recomposite(p);
    } else mat.color.setRGB(...d.color);
    p.uvOrig = hasUV ? new Float32Array(d.geo.attributes.uv.array) : null;
    S.parts.set(d.name, p); grp.add(mesh);
    setLoad(0.45 + 0.55*(++done)/def.parts.length);
    if(done % 4 === 0) await new Promise(r => setTimeout(r, 0));
  }
  const box = new THREE.Box3().setFromObject(grp), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  S.modelSize = Math.max(sz.x, sz.y, sz.z) || 1; S.unitM = def.unitM || STUD_M;
  grp.position.sub(c); grp.position.y += sz.y/2;
  grid.scale.setScalar(S.modelSize/2.18);
  root.add(grp); root.updateMatrixWorld(true);
  S.order = def.parts.map(d => d.name);
  $('modelName').textContent = def.title ? pick(def.title) : def.name;
  buildPartList();
  const first = S.parts.has('Meshes221') ? 'Meshes221' : ([...S.parts.values()].filter(p => p.editable).sort((a, b) => b.mesh.geometry.attributes.position.count - a.mesh.geometry.attributes.position.count)[0] || [...S.parts.values()][0]).name;
  select(first);
  frame();
}
async function helmetDef(){
  const obj = await new OBJLoader().loadAsync(MODEL, e => { if(e.total) setLoad(0.4*e.loaded/e.total); });
  setLoad(0.45, t('load.tex'));
  const parts = [];
  const meshes = []; obj.traverse(o => { if(o.isMesh) meshes.push(o); });
  await Promise.all(meshes.map(async mesh => {
    const info = Object.assign({}, PARTS[mesh.name] || { label:[mesh.name, mesh.name] });
    parts.push({ name:mesh.name, geo:mesh.geometry, info, glass:!!info.glass, color:info.color || [0.6, 0.6, 0.6],
      img:info.diff ? await loadImage('assets/' + info.diff) : null, nimg:info.nmap ? await loadImage('assets/' + info.nmap) : null });
  }));
  const order = Object.keys(PARTS); parts.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  return { name:'helmet-pvs14', title:['Helmet · PVS-14 · arid pixel', 'Casco · PVS-14 · árido pixelado'], unitM:STUD_M, parts };
}
async function loadHelmet(){
  disposeModel(); setLoad(0.05, t('load.model'));
  await buildModel(await helmetDef());
  S.model = { kind:'builtin', id:'helmet', name:'helmet-pvs14' };
}
// files: [{ name, data }] — the model plus the files it references, or one .zip
async function openModelFiles(files, main){
  const def = await importModel(files, main);
  if(!def.parts.length) throw new Error(t('msg.modelempty'));
  const R = 1024;
  for(const d of def.parts){
    const stem = d.name.replace(/[^\w\-.]+/g, '_');
    d.info = { label:[d.name, d.name], diff:d.texName && d.img ? d.texName.replace(/\.(jpe?g|tga|bmp|webp)$/i, '.png') : `${stem}_diff.png`, nmap:d.nName ? d.nName.replace(/\.(jpe?g|tga|bmp|webp)$/i, '.png') : `${stem}_nmap.png` };
    if(!d.img && d.geo.attributes.uv) d.blank = R;
  }
  disposeModel();
  await buildModel(def);
  S.model = { kind:'import', name:def.name, main:main || null, files };
  if(S.uv.on){ uvFit(); drawUV(); }
  const noUV = def.parts.filter(d => !d.geo.attributes.uv).length;
  toast(t('msg.modelok', def.parts.length) + (noUV ? ' · ' + t('msg.nouv', noUV) : ''));
}
async function load(){
  resize();
  setLoad(0.05, t('load.model'));
  await Promise.all(['velcro_loop', 'velcro_hook', 'webbing_twill'].map(loadDetail));
  await buildModel(await helmetDef());
  S.model = { kind:'builtin', id:'helmet', name:'helmet-pvs14' };
  $('loading').remove();
  setTool('paint');
  buildLibrary();
  resetStatus();
}
function frame(){
  const box = new THREE.Box3();
  for(const p of S.parts.values()) if(p.mesh.visible) box.expandByObject(p.mesh);
  if(box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
  controls.target.copy(c);
  camera.position.copy(c).addScaledVector(new THREE.Vector3(1, 0.45, -1.1).normalize(), s*1.5);
  camera.near = s/200; camera.far = s*50; camera.updateProjectionMatrix(); controls.update();
}

// ============================================================ texture sets (parts)
const eyeOn = '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeOff = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.6M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7c1.6 0 3-.4 4.3-1"/></svg>';
function buildPartList(){
  const ul = $('parts'); ul.innerHTML = '';
  const order = (S.order || [...S.parts.keys()]).filter(n => S.parts.has(n));
  for(const n of order){
    const p = S.parts.get(n), li = document.createElement('li');
    li.innerHTML = `<span class="dot"></span><span class="nm"><b></b><small class="mono"></small></span><button class="eye"></button>`;
    li.onclick = e => { if(!e.target.closest('.eye')) select(n); };
    li.querySelector('.eye').onclick = () => { p.mesh.visible = !p.mesh.visible; refreshList(); };
    ul.appendChild(li); p.li = li;
  }
  refreshList();
}
function refreshList(){
  for(const p of S.parts.values()){
    if(!p.li) continue;
    p.li.querySelector('b').textContent = plabel(p);
    p.li.querySelector('small').textContent = p.name + (p.editable ? ` · ${p.W}×${p.H}` : ' · ' + t('sets.notex'));
    p.li.classList.toggle('sel', S.sel === p.name);
    p.li.classList.toggle('hidden', !p.mesh.visible);
    p.li.classList.toggle('dirty', !!p.dirty);
    p.li.classList.toggle('uvdirty', !p.dirty && p.uvDirty);
    p.li.querySelector('.eye').innerHTML = p.mesh.visible ? eyeOn : eyeOff;
  }
}
const opticalRanges={transmission:[0,1],ior:[1,2.33],clearcoat:[0,1],iridescence:[0,1]};
function setOptics(p,values){
  p.optics={};
  for(const [key,[min,max]] of Object.entries(opticalRanges)){
    const v=Number(values?.[key] ?? p.defaultOptics[key]);
    p.mat[key]=p.optics[key]=Number.isFinite(v)?Math.max(min,Math.min(max,v)):min;
  }
  p.mat.needsUpdate=true;
}
function syncOptics(p){
  $('opticalSet').hidden=!p.editable;
  for(const key of Object.keys(opticalRanges)) $('opt-'+key).value=p.optics[key];
}
for(const key of Object.keys(opticalRanges)){
  const field=$('opt-'+key);
  field.onchange=()=>{
    const p=cur();if(!p)return;flush();pushStack(p);
    setOptics(p,{...p.optics,[key]:Number(field.value)});markDirty(p);kick3d();
  };
}
$('displayExposure').oninput=e=>{renderer.toneMappingExposure=Number(e.target.value);kick3d();};
$('displayEnvironment').oninput=e=>{for(const p of S.parts.values())p.mat.envMapIntensity=Number(e.target.value);kick3d();};
$('displayRotation').onchange=e=>{
  studioRoom.rotation.y=Number(e.target.value)*Math.PI/180;
  studioRoom.updateMatrixWorld(true);
  const next=studioFilter.fromScene(studioRoom,.04);
  scene.environment=next.texture;studioMap.dispose();studioMap=next;kick3d();
};
function select(name){
  const p = S.parts.get(name); if(!p) return;
  flush();
  const old = S.parts.get(S.sel);
  if(old && old !== p){ old.mesh.material = old.mat; S.uv.sel.clear(); const hadSel = old.sel; S.sel = name; if(hadSel && old.editable) present(old); }
  S.sel = name; syncOptics(p);
  $('selname').innerHTML = `${t('sets.set')}: <b></b> <span class="mono small"></span>`;
  $('selname').querySelector('b').textContent = plabel(p); $('selname').querySelector('span').textContent = name;
  refreshList(); flash(p); syncRes(); renderLayers(); renderProps(); updateButtons();
  if(p.editable){ if(p.sel) present(p); drawView(p); }
  if(S.uv.on){ uvFit(); drawUV(); }
}
function flash(p){ p.mat.emissive.setHex(0x3a3420); needs3d = true; clearTimeout(p._ft); p._ft = setTimeout(() => { p.mat.emissive.setHex(0); needs3d = true; }, 260); }
$('isolate').onclick = () => { for(const p of S.parts.values()) p.mesh.visible = p.name === S.sel; refreshList(); frame(); };
$('showall').onclick = () => { for(const p of S.parts.values()) p.mesh.visible = true; refreshList(); frame(); };
$('frame').onclick = frame;

// ---- resolution ("quality") of the texture set: non-destructive, fills are re-rendered at the new size
function syncRes(){
  const p = cur(), el = $('res'); el.disabled = !p; if(!p) return;
  [...el.options].forEach(o => { if(o.dataset.tmp) o.remove(); });
  if(![...el.options].some(o => o.value === String(p.W))){ const o = new Option(`${p.W} × ${p.H}`, String(p.W)); o.dataset.tmp = '1'; el.add(o, 0); }
  el.value = String(p.W);
}
function setRes(p, R){
  const W = R, H = Math.max(1, Math.round(R*p.H0/p.W0)); if(W === p.W && H === p.H) return;
  flush(); pushStack(p);
  const ow = p.W, oh = p.H;
  p.layers = p.layers.map(cloneLayer);
  for(const L of p.layers){
    L.cache = null;
    if(L.type === 'paint') L.raster = E.resampleRGBA(L.raster, ow, oh, W, H);
    if(L.type === 'base'){ L.raster = null; L._rk = null; }
    if(L.mask){ if(L.maskGen && REGEN.has(L.maskGen.type) && !L.maskPainted) L._regen = true; else L.mask = E.resampleGray(L.mask, ow, oh, W, H); }
  }
  p.sel = null; p.W = W; p.H = H; allocOut(p);
  for(const L of p.layers) if(L._regen){ L.mask = makeMask(L.maskGen, p); delete L._regen; }
  refreshList(); after(p);
}
$('res').onchange = e => {
  const p = cur(); if(!p) return; const R = +e.target.value;
  setStatus(t('st.computing'));
  setTimeout(() => { setRes(p, R); if(R >= 4096) toast(t('msg.4k')); }, 30);
};

// ============================================================ layer stack
function insertAbove(p, L){ const target=active(p); L.parentId=target?.type==='group'?target.id:target?.parentId; const i = p.layers.indexOf(target); p.layers.splice(i < 0 ? p.layers.length : i + 1, 0, L); }
function applyMatDefaults(L, M, p){
  if(M.kind === 'image' && M.gray){ L.proj = 'tri'; L.tiling = M.builtin === 'webbing_twill' ? 12 : 6; L.ch = { color:true, rough:true, metal:false, height:true }; L.rough = 1; L.height = 0.35; if(M.tactical){L.rough=M.tactical.rough;L.ch.metal=true;L.metal=M.tactical.metal;L.height=.18;L.tiling=8;} }
  else if(M.kind === 'image' || M.kind === 'camo'){
    L.proj = 'tri'; L.filter = M.digital ? 'nearest' : 'bilinear';
    if(M.realTiling){ L.real = true; L.tiling = +(M.realTiling*S.modelSize).toFixed(3); L.match = true; }
    else if(M.kind === 'camo'){ L.tiling = 3; L.match = true; }
    else { L.tiling = 4; if(M.roughSrc) L.ch.rough = true; }
  }
}
// "Original details": the model's texture as a layer, hidden by a black mask; paint white (or use a selection) to bring parts back.
function addOrig(){
  const p = cur(); if(!p){ toast(t('msg.selpart')); return; }
  flush(); pushStack(p);
  const L = newFill(ORIG, { name:t('layer.orig') });
  if(p.sel){ L.mask = new Uint8Array(p.sel); L.maskGen = { type:'sel' }; p.sel = null; toast(t('msg.origsel')); }
  else { L.mask = new Uint8Array(p.W*p.H); L.maskGen = { type:'black' }; S.maskWhite = true; toast(t('msg.orig')); }
  p.layers.push(L); const sh = p.layers.findIndex(l => l.type === 'fill' && l.mat.kind === 'shade');
  if(sh >= 0 && sh < p.layers.length - 1){ p.layers.pop(); p.layers.splice(sh, 0, L); } // keep it under the shading
  p.activeId = L.id; setTarget(L.maskGen.type === 'sel' ? 'content' : 'mask'); if(L.maskGen.type !== 'sel') setTool('paint'); after(p);
}
function addShade(p){
  if(p.layers.some(l => l.type === 'fill' && l.mat.kind === 'shade')) return null;
  const L = newFill(SHADE, { name:t('layer.shade'), blend:'detail' }); p.layers.push(L); return L;
}
// Library click: new fill layer, or replace the material of the selected fill layer when "replace" is armed.
function applyMaterial(M, props){
  const p = cur(); if(!p){ toast(t('msg.selpart')); return; }
  flush();
  const A = active(p);
  if(S.arm && A && A.type === 'fill' && A.mat.kind !== 'shade'){
    pushStack(p); A.mat = M; A.name = M.name; applyMatDefaults(A, M, p); setArm(false); after(p); return;
  }
  pushStack(p);
  const first = p.layers.length === 1;
  const L = newFill(M, {}); applyMatDefaults(L, M, p); if(props) Object.assign(L, props);
  if(p.sel){ L.mask = new Uint8Array(p.sel); L.maskGen = { type:'sel' }; p.sel = null; }
  if(first) p.activeId = p.layers[0].id;
  insertAbove(p, L);
  if(first && !(props && props.noAuto)){
    if(p.info.zones && p.info.zones.velcro && DETAIL.velcro_loop && !L.mask){
      const V = newFill(DETAIL.velcro_loop, { name:t('layer.velcro') }); applyMatDefaults(V, V.mat, p);
      V.maskGen = { type:'zone' }; V.mask = makeMask(V.maskGen, p);
      p.layers.splice(p.layers.indexOf(L) + 1, 0, V);
    }
    addShade(p);
    toast(t('msg.autosetup'));
  }
  delete L.noAuto;
  p.activeId = L.id; after(p);
}
function setArm(on){ S.arm = on; $('armed').hidden = !on; $('matReplace').classList.toggle('on', on); }
$('matReplace').onclick = () => setArm(!S.arm);

const ICON = {
  base:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 15l5-5 4 4 3-3 4 4"/></svg>',
  paint:'<svg viewBox="0 0 24 24"><path d="M14 4l6 6-9 9H5v-6z"/></svg>',
  adjust:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  shade:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16 5 8 0 0 1 0-16z" fill="currentColor"/></svg>',
};
function layerTypeLabel(L){
  if(L.type === 'fill') return L.mat.kind === 'shade' ? t('ltype.shade') : L.mat.kind === 'orig' ? t('ltype.orig') : t('ltype.fill');
  return t('ltype.' + L.type);
}
const layerName = L => L.type === 'base' ? t('layer.base') : (L.name || layerTypeLabel(L));
function renderLayers(){
  const ul = $('layers'), p = cur(); ul.innerHTML = '';
  if(!p) return;
  for(const {layer:L,parents} of layerTree(p.layers).reverse()){
    const li=document.createElement('li');
    li.style.paddingLeft=(4+12*Math.min(8,parents.length))+'px';
    li.className = (L.id === p.activeId ? 'sel ' : '') + (L.visible ? '' : 'off');
    li.innerHTML = `<button class="eye">${L.visible ? eyeOn : eyeOff}</button><i class="lth"></i><span class="lname"><b></b><small></small></span>`;
    const th = li.querySelector('.lth');
    if(L.type==='group'){th.textContent='▤';}
    else if(L.type === 'fill' && L.mat.kind !== 'shade'){
      if(L.mat.kind === 'solid' || L.mat.gray) th.style.background = L.color; else if(L.mat.thumb) th.style.backgroundImage = `url(${L.mat.thumb})`;
    } else th.innerHTML = ICON[L.type === 'fill' ? 'shade' : ['decalUV','seam','group'].includes(L.type)?'paint':L.type];
    li.querySelector('b').textContent = layerName(L);
    const bl = L.blend !== 'normal' ? ' · ' + t('blend.' + L.blend) : '', op = L.opacity < 1 ? ' · ' + Math.round(L.opacity*100) + '%' : '';
    li.querySelector('small').textContent = layerTypeLabel(L) + bl + op;
    if(L.mask){ const m = document.createElement('i'); m.className = 'lmask' + (L.id === p.activeId && S.target === 'mask' ? ' tgt' : ''); m.title = t('layers.maskTip'); li.appendChild(m);
      m.onclick = e => { e.stopPropagation(); p.activeId = L.id; setTarget('mask'); renderLayers(); renderProps(); if(S.view === 'mask') drawView(p); }; }
    if(L.id === p.activeId && S.target === 'content' && L.type === 'paint') th.classList.add('tgt');
    li.querySelector('.eye').onclick = e => { e.stopPropagation(); flush(); pushStack(p); L.visible = !L.visible; after(p); };
    li.onclick = () => { p.activeId = L.id; setTarget(L.type !== 'paint' && L.mask ? 'mask' : 'content'); renderLayers(); renderProps(); updateButtons(); if(S.view === 'mask') drawView(p); };
    li.querySelector('.lname').ondblclick = e => {
      if(L.type === 'base') return; e.stopPropagation();
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = layerName(L);
      const b = li.querySelector('b'); b.replaceWith(inp); inp.focus(); inp.select();
      const done = () => { const v = inp.value.trim(); if(v && v !== L.name){ pushStack(p); L.name = v; markDirty(p); } renderLayers(); renderProps(); };
      inp.onblur = done; inp.onkeydown = ev => { ev.stopPropagation(); if(ev.key === 'Enter') inp.blur(); if(ev.key === 'Escape'){ inp.value = L.name; inp.blur(); } };
    };
    if(L.type!=='base'){
      li.draggable=true;li.ondragstart=e=>{e.dataTransfer.setData('application/x-tyc-layer',String(L.id));e.dataTransfer.effectAllowed='move';};li.ondragover=e=>{if(e.dataTransfer.types.includes('application/x-tyc-layer')){e.preventDefault();li.classList.add('drop-layer');}};li.ondragleave=()=>li.classList.remove('drop-layer');li.ondrop=e=>{e.preventDefault();e.stopPropagation();li.classList.remove('drop-layer');const id=+e.dataTransfer.getData('application/x-tyc-layer'),from=p.layers.findIndex(x=>x.id===id),to=p.layers.indexOf(L);if(from<1||from===to)return;
        const source=p.layers[from];
        if(layerTree(p.layers).find(row=>row.layer===L)?.parents.includes(source))return;
        flush();pushStack(p);
        source.parentId=L.type==='group'?L.id:L.parentId;
        p.layers.splice(to,0,p.layers.splice(from,1)[0]);p.activeId=id;after(p);};
      li.oncontextmenu=e=>{e.preventDefault();p.activeId=L.id;renderLayers();renderProps();updateButtons();showMenu(e.clientX,e.clientY,[...(L.type==='group'?[['Ungroup',()=>ungroup(p,L)]]:[]),['Black mask',()=>quickMask(p,L,'black')],['White mask',()=>quickMask(p,L,'white')],['Remove mask',()=>quickMask(p,L,'')],['Invert mask',()=>$('mInvert').click()],['Duplicate',()=>$('dupLayer').click()],['Delete',()=>$('delLayer').click()]]);};
    }ul.appendChild(li);
  }
}
function ungroup(p,L){
  flush();pushStack(p);
  p.layers=layerTree(p.layers).map(row=>row.layer).filter(item=>item!==L);
  const members=p.layers.filter(item=>item.parentId===L.id);
  for(const item of members)item.parentId=L.parentId;
  p.activeId=members.at(-1)?.id ?? p.layers[0].id;after(p);
}
$('addGroup').onclick=()=>{
  const p=cur();if(!p)return;flush();pushStack(p);
  const current=active(p), g=mkLayer('group',{name:t('ltype.group'),parentId:current?.parentId});
  if(current && current.type!=='base'){p.layers.splice(p.layers.indexOf(current),0,g);current.parentId=g.id;}
  else p.layers.push(g);
  p.activeId=g.id;after(p);
};
$('addFill').onclick = () => applyMaterial(solidMat(), { color:$('bColor').value, noAuto:true });
$('addPaint').onclick = () => { const p = cur(); if(!p) return; flush(); pushStack(p); const L = mkLayer('paint', { name:t('layer.paint'), raster:new Uint8ClampedArray(p.W*p.H*4) }); insertAbove(p, L); p.activeId = L.id; setTarget('content'); setTool('paint'); after(p); };
$('addSurface').onclick = () => {
  const p=cur(); if(!p) return;
  flush();pushStack(p);
  const L=mkLayer('paint',{name:'PBR Paint',surfacePaint:true,raster:new Uint8ClampedArray(p.W*p.H*4),
    ch:{color:false,rough:true,metal:true,height:true}});
  insertAbove(p,L);p.activeId=L.id;setTarget('content');setTool('paint');after(p);
};
$('addAdjust').onclick = () => { const p = cur(); if(!p) return; flush(); pushStack(p); const L = mkLayer('adjust', { name:t('layer.adjust'), con:0, sat:0, bri:0, hue:0 }); insertAbove(p, L); p.activeId = L.id; after(p); };
$('delLayer').onclick = () => { const p = cur(), L = p && active(p); if(!L || L.type === 'base') return; flush(); pushStack(p); const i = p.layers.indexOf(L); const removed=new Set(layerTree(p.layers).filter(r=>r.layer===L||r.parents.includes(L)).map(r=>r.layer));
  p.layers=p.layers.filter(item=>!removed.has(item)); p.activeId=p.layers[Math.min(p.layers.length-1,Math.max(0,i-1))].id; setTarget('content'); after(p); };
$('dupLayer').onclick = () => {
  const p = cur(), L = p && active(p); if(!L || L.type === 'base') return; flush(); pushStack(p);
  const rows=layerTree(p.layers).filter(r=>r.layer===L||r.parents.includes(L));
  const ids=new Map(rows.map(r=>[r.layer.id,LID++]));
  const copies=rows.map(({layer})=>{
    const c=cloneLayer(layer);c.id=ids.get(layer.id);c.parentId=ids.get(layer.parentId)??layer.parentId;
    if(layer===L)c.name=layerName(layer)+' '+t('layers.copy');
    if(c.raster)c.raster=c.raster.slice();if(c.mask)c.mask=c.mask.slice();return c;
  });
  p.layers.splice(p.layers.indexOf(L)+1,0,...copies);p.activeId=ids.get(L.id);after(p);
};
function moveLayer(d){
  const p=cur(),L=p&&active(p);if(!L||L.type==='base')return;
  const siblings=p.layers.filter(x=>x.type!=='base'&&(x.parentId??null)===(L.parentId??null));
  const other=siblings[siblings.indexOf(L)+d];if(!other)return;
  const i=p.layers.indexOf(L),j=p.layers.indexOf(other);
  flush(); pushStack(p); p.layers.splice(i, 1); p.layers.splice(j, 0, L); after(p);
}
$('upLayer').onclick = () => moveLayer(1);
$('downLayer').onclick = () => moveLayer(-1);

// ============================================================ properties panel
let editing = false;
// Bind a control to the active layer. One undo step per gesture; live preview while dragging.
function bind(id, apply){
  const el = $(id);
  const runIt = () => {
    const p = cur(), L = p && active(p); if(!L) return;
    if(!editing){ pushStack(p); editing = true; }
    if(apply(L, el, p) === false) return;
    kick(p);
  };
  el.addEventListener('input', runIt);
  el.addEventListener('change', () => { if(!editing) runIt(); editing = false; renderLayers(); renderProps(); });
}
const decalFields={decalU:'offX',decalV:'offY',decalWidth:'decalWidth',decalAngle:'rot',decalDepth:'height',decalRough:'rough'};
for(const [id,key] of Object.entries(decalFields)) bind(id,(L,el)=>{
  if(L.type!=='decalUV')return false;
  L[key]=Number(el.value);
  if(key==='height')L.ch.height=L.height!==0;
});
$('decalEditable').onclick=()=>{
  const p=cur(),src=S.decal.src;if(!p)return;
  if(!src){toast(t('msg.nodecal'));return;}
  flush(); pushStack(p);
  const L=mkLayer('decalUV',{name:S.decal.name,mat:mkMat({kind:'image',name:S.decal.name,src}),
    offX:.5,offY:.5,rot:+$('dRot').value,decalWidth:+$('dSize').value/100,opacity:+$('dOp').value/100,
    rough:.65,height:0,ch:{color:true,rough:true,metal:false,height:false}});
  insertAbove(p,L);p.activeId=L.id;setTarget('content');after(p);
};
const seamFields={seamWidth:'threadWidth',seamPitch:'pitch',seamColor:'color',seamHeight:'height',seamRough:'rough'};
for(const [id,key] of Object.entries(seamFields)) bind(id,(L,el)=>{if(L.type!=='seam')return false;L[key]=key==='color'?el.value:Number(el.value);});
function editSeamPoint(p,L,points){
  flush();pushStack(p);L.points=points;after(p);
}
$('seamPop').onclick=()=>{const p=cur(),L=p&&active(p);if(L?.type==='seam' && L.points.length)editSeamPoint(p,L,L.points.slice(0,-1));};
function drawSeam(){setWorkspaceView('f1');setUVMode('seam');}
$('seamEdit').onclick=drawSeam;
$('addSeam').onclick=()=>{
  const p=cur();if(!p)return;flush();pushStack(p);
  const L=mkLayer('seam',{name:t('ltype.seam'),points:[],pitch:14,threadWidth:3,color:'#bc9e73',rough:.82,height:.65,
    ch:{color:true,rough:true,metal:false,height:true}});
  insertAbove(p,L);p.activeId=L.id;drawSeam();after(p);
};
const til2s = v => Math.round(50*Math.log2(v)), s2til = s => +Math.pow(2, s/50).toFixed(3);
bind('lBlend', (L, el) => { L.blend = el.value; });
bind('lOpacity', (L, el) => { L.opacity = +el.value/100; });
bind('fProj', (L, el, p) => { L.proj = el.value; if(el.value === 'uv'){ L.real = false; if(L.tiling > 16) L.tiling = 4; } });
bind('fFilter', (L, el) => { L.filter = el.value; });
bind('fWrap', (L, el) => { L.wrap = el.value; });
bind('fTiling', (L, el) => { L.tiling = s2til(+el.value); L.real = false; $('fTilingN').value = L.tiling; $('fReal').checked = false; });
bind('fTilingN', (L, el) => { const v = Math.min(128, Math.max(0.05, +el.value || 1)); L.tiling = v; L.real = false; $('fTiling').value = til2s(v); });
bind('fReal', (L, el) => { L.real = el.checked; if(L.real && L.mat.realTiling){ L.proj = 'tri'; L.tiling = +(L.mat.realTiling*S.modelSize).toFixed(3); } });
bind('fRot', (L, el) => { L.rot = +el.value; });
// Stretch: X/Y proportions of the pattern (slider is log2*100, so 0 = 1×, 100 = 2×, -100 = ½×)
const s2k = v => +Math.pow(2, v/100).toFixed(3), k2s = k => Math.round(Math.log2(k)*100);
function syncStretch(L){ $('fSxV').textContent = Math.round((L.sx ?? 1)*100) + '%'; $('fSyV').textContent = Math.round((L.sy ?? 1)*100) + '%'; }
bind('fSx', (L, el) => { L.sx = s2k(+el.value); if($('fSLink').checked){ L.sy = L.sx; $('fSy').value = el.value; } syncStretch(L); });
bind('fSy', (L, el) => { L.sy = s2k(+el.value); if($('fSLink').checked){ L.sx = L.sy; $('fSx').value = el.value; } syncStretch(L); });
$('fSReset').onclick = () => { const p = cur(), L = p && active(p); if(!L || L.type !== 'fill') return; flush(); pushStack(p); L.sx = L.sy = 1; $('fSx').value = $('fSy').value = 0; syncStretch(L); after(p); };
bind('fOffX', (L, el) => { L.offX = +el.value/100; });
bind('fOffY', (L, el) => { L.offY = +el.value/100; });
bind('mColor', (L, el) => { L.color = el.value; $('mColorHex').textContent = el.value; });
bind('mRough', (L, el) => { L.rough = +el.value/100; });
bind('mMetal', (L, el) => { L.metal = +el.value/100; });
bind('mHeight', (L, el) => { L.height = +el.value/100; });
bind('aMatch', (L, el) => { L.match = el.checked; });
bind('aCon', (L, el) => { L.con = +el.value/100; });
bind('aSat', (L, el) => { L.sat = +el.value/100; });
bind('aBri', (L, el) => { L.bri = +el.value/100; });
bind('aHue', (L, el) => { L.hue = +el.value; });
document.querySelectorAll('#chans button').forEach(b => b.onclick = () => {
  const p = cur(), L = p && active(p); if(!L) return; flush(); pushStack(p); L.ch[b.dataset.c] = !L.ch[b.dataset.c]; after(p);
});
// procedural camo editing (replaces the layer's material so history keeps the old one)
function reCamo(L, colors, seed){ L.mat = camoMat(L.mat.type, colors, seed); }
for(const pl of PALETTES) $('cPreset').add(new Option('', ''));
bind('cPreset', (L, el) => { const pl = PALETTES[+el.value]; if(!pl || L.mat.kind !== 'camo') return false; reCamo(L, pl.c, L.mat.seed); });
for(let i = 0; i < 4; i++) bind('c' + i, (L, el) => { if(L.mat.kind !== 'camo') return false; const c = L.mat.colors.slice(); c[i] = el.value; reCamo(L, c, L.mat.seed); });
$('cSeed').onclick = () => { const p = cur(), L = p && active(p); if(!L || L.mat.kind !== 'camo') return; flush(); pushStack(p); reCamo(L, L.mat.colors, (Math.random()*1e9) | 0); after(p); };

// ---- masks
function setMaskGen(p, L, type){
  if(!type){ L.mask = null; L.maskGen = null; L.maskPainted = false; if(S.target === 'mask') setTarget('content'); return; }
  if(type === 'sel'){
    if(!p.sel){ toast(t('msg.nosel')); return false; }
    L.mask = new Uint8Array(p.sel); L.maskGen = { type }; L.maskPainted = false; p.sel = null; return;
  }
  if(type === 'islands'){
    if(!S.uv.sel.size){ toast(t('msg.noisl')); return false; }
    const m = new Uint8Array(p.W*p.H), U = uvArr(p);
    for(const tr of S.uv.sel) E.rasterTri(p.W, p.H, U[tr*6]*p.W, (1 - U[tr*6+1])*p.H, U[tr*6+2]*p.W, (1 - U[tr*6+3])*p.H, U[tr*6+4]*p.W, (1 - U[tr*6+5])*p.H, (x, y) => { m[y*p.W + x] = 255; });
    L.mask = m; L.maskGen = { type }; L.maskPainted = false; return;
  }
  if(type === 'zone' && !(p.info.zones && p.info.zones.velcro)){ toast(t('msg.nozone')); return false; }
  const old = L.maskGen || {};
  L.maskGen = { type, level:old.level ?? 0.5, contrast:old.contrast ?? 0.5, scale:old.scale ?? 1, invert:false, seed:(Math.random()*1e6) | 0 };
  L.mask = makeMask(L.maskGen, p); L.maskPainted = false;
}
bind('mGen', (L, el, p) => setMaskGen(p, L, el.value));
const regen = (L, p) => { if(!L.maskGen || !PARAM.has(L.maskGen.type)) return false; L.mask = makeMask(L.maskGen, p); L.maskPainted = false; };
bind('gLevel', (L, el, p) => { if(!L.maskGen) return false; L.maskGen.level = +el.value/100; return regen(L, p); });
bind('gCon', (L, el, p) => { if(!L.maskGen) return false; L.maskGen.contrast = +el.value/100; return regen(L, p); });
bind('gScale', (L, el, p) => { if(!L.maskGen) return false; L.maskGen.scale = +el.value/100; return regen(L, p); });
$('gSeed').onclick = () => { const p = cur(), L = p && active(p); if(!L || !L.maskGen) return; flush(); pushStack(p); L.maskGen.seed = (Math.random()*1e6) | 0; regen(L, p); after(p); };
$('mInvert').onclick = () => {
  const p = cur(), L = p && active(p); if(!L || !L.mask) return; flush(); pushStack(p);
  if(L.maskGen && REGEN.has(L.maskGen.type) && !L.maskPainted){ L.maskGen.invert = !L.maskGen.invert; L.mask = makeMask(L.maskGen, p); }
  else { const m = new Uint8Array(L.mask.length); for(let i = 0; i < m.length; i++) m[i] = 255 - L.mask[i]; L.mask = m; }
  after(p);
};
$('mRemove').onclick = () => { const p = cur(), L = p && active(p); if(!L || !L.mask) return; flush(); pushStack(p); setMaskGen(p, L, ''); after(p); };

function renderProps(){
  const p = cur(), L = p && active(p);
  const show = (id, on) => { $(id).hidden = !on; };
  const isFill = !!L && L.type === 'fill', orig = isFill && L.mat.kind === 'orig', shade = isFill && (L.mat.kind === 'shade' || orig), M = isFill ? L.mat : null;
  $('decalProps').hidden=L?.type!=='decalUV';
  if(L?.type==='decalUV') for(const [id,key] of Object.entries(decalFields)) $(id).value=L[key];
  $('seamProps').hidden=L?.type!=='seam';
  if(L?.type==='seam'){
    for(const [id,key] of Object.entries(seamFields)) $(id).value=L[key];
    $('seamNodes').textContent=String(L.points.length);
  }
  $('surfaceBrush').hidden=!L?.surfacePaint;
  $('colorBrush').hidden=!!L?.surfacePaint;
  document.querySelector('#chans [data-c=color]').disabled=!!L?.surfacePaint;
  $('propName').textContent = L ? layerName(L) : '';
  show('pNone', !L); show('pBase', !!L && L.type === 'base'); show('pShade', shade && !orig); show('pOrig', orig);
  const tex = isFill && !shade && M.kind !== 'solid';
  show('pFill', tex);
  show('pMat', !!L && (L.type === 'paint' || (isFill && !shade)));
  show('pAdj', !!L && (L.type === 'adjust' || tex));
  show('pMask', !!L && L.type !== 'base');
  $('lBlend').disabled = $('lOpacity').disabled = !L;
  if(!L){ syncVals(); return; }
  $('lBlend').value = L.blend; $('lOpacity').value = Math.round(L.opacity*100);
  $('lBlend').disabled = L.type === 'adjust' || L.type === 'base' || L.type==='group' || L.surfacePaint;
  if(tex){
    $('fProj').value = L.proj; $('fFilter').value = L.filter; $('fWrap').value = L.wrap;
    $('fTiling').value = til2s(L.tiling); $('fTilingN').value = L.tiling; $('fRot').value = L.rot;
    $('fSx').value = k2s(L.sx ?? 1); $('fSy').value = k2s(L.sy ?? 1); syncStretch(L);
    $('fOffX').value = Math.round(L.offX*100); $('fOffY').value = Math.round(L.offY*100);
    show('fRealRow', !!M.realTiling); $('fReal').checked = !!L.real;
  }
  if(L.type === 'paint' || (isFill && !shade)){
    document.querySelectorAll('#chans button').forEach(b => b.classList.toggle('on', !!L.ch[b.dataset.c]));
    show('matSlot', isFill); show('matColorRow', isFill && (M.kind === 'solid' || M.gray)); show('matCamo', isFill && M.kind === 'camo');
    if(isFill){
      $('matName').textContent = M.kind === 'solid' ? t('mat.solid') : M.name;
      $('matSw').style.background = (M.kind === 'solid' || M.gray) ? L.color : (M.thumb ? `url(${M.thumb}) center/cover` : '#333');
      $('mColor').value = L.color; $('mColorHex').textContent = L.color;
      if(M.kind === 'camo'){ M.colors.forEach((c, i) => $('c' + i).value = c); $('cPreset').value = String(PALETTES.findIndex(pl => pl.c.join() === M.colors.join())); }
    }
    show('rowRough', L.ch.rough && !L.surfacePaint); show('rowMetal', L.ch.metal && !L.surfacePaint); show('rowHeight', L.ch.height && !L.surfacePaint);
    $('mRough').value = Math.round(L.rough*100); $('mMetal').value = Math.round(L.metal*100); $('mHeight').value = Math.round(L.height*100);
  }
  if(L.type === 'adjust' || tex){
    show('aMatchRow', tex && !M.gray); show('aHueRow', L.type === 'adjust');
    $('aMatch').checked = !!L.match; $('aCon').value = Math.round((L.con || 0)*100); $('aSat').value = Math.round((L.sat || 0)*100); $('aBri').value = Math.round((L.bri || 0)*100); $('aHue').value = L.hue || 0;
  }
  if(L.type !== 'base'){
    const g = L.maskGen; $('mGen').value = L.mask ? (g ? g.type : 'white') : '';
    const prm = !!g && PARAM.has(g.type); show('mGenParams', prm);
    if(prm){ $('gLevel').value = Math.round(g.level*100); $('gCon').value = Math.round(g.contrast*100); $('gScale').value = Math.round(g.scale*100); }
    $('mInvert').disabled = $('mRemove').disabled = !L.mask;
  }
  syncVals(); syncTargetUI();
}
function updateButtons(){
  $('undo').disabled = !S.undo.length; $('redo').disabled = !S.redo.length;
  const p = cur(), L = p && active(p), ed = !!p, lay = !!L && L.type !== 'base';
  for(const id of ['expOne', 'resetPart', 'selAll', 'selInv', 'selNone', 'addFill', 'addPaint', 'addAdjust']) $(id).disabled = !ed;
  for(const id of ['delLayer', 'dupLayer', 'upLayer', 'downLayer']) $(id).disabled = !lay;
}
$('resetPart').onclick = () => {
  const p = cur(); if(!p) return; flush(); pushStack(p, new Float32Array(uvArr(p)));
  p.layers = [p.layers[0]].map(cloneLayer); p.layers[0].visible = true; p.layers[0].opacity = 1; p.activeId = p.layers[0].id; p.sel = null; p.baseSrc = p.baseSrc0;
  if(p.uvDirty){ setUV(p, p.uvOrig); p.uvVer++; p.isl = null; p.uvDirty = false; }
  if(p.W !== p.W0 || p.H !== p.H0){ p.W = p.W0; p.H = p.H0; allocOut(p); }
  setTarget('content'); recomposite(p); p.dirty = false; refreshList(); syncRes(); renderLayers(); renderProps(); updateButtons(); if(S.uv.on) drawUV();
};

// ============================================================ tools
function setTarget(v){ S.target = v; syncTargetUI(); }
function syncTargetUI(){
  document.querySelectorAll('#bTarget button').forEach(b => b.classList.toggle('on', b.dataset.v === S.target));
  document.querySelectorAll('#bMaskVal button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === S.maskWhite));
  $('bMaskRow').hidden = S.target !== 'mask';
}
document.querySelectorAll('#bTarget button').forEach(b => b.onclick = () => { setTarget(b.dataset.v); renderLayers(); });
document.querySelectorAll('#bMaskVal button').forEach(b => b.onclick = () => { S.maskWhite = b.dataset.v === '1'; syncTargetUI(); });
function setTool(tl){
  S.tool = tl;
  document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === tl));
  $('toolhint').textContent = t('tool.' + tl + '.hint');
  $('optBrush').hidden = !(tl === 'paint' || tl === 'erase' || tl === 'fill' || tl === 'pick');
  $('optFill').hidden = tl !== 'fill'; $('optWand').hidden = tl !== 'wand'; $('optDecal').hidden = tl !== 'decal';
  controls.mouseButtons = tl === 'orbit'
    ? { LEFT:THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.PAN }
    : { LEFT:null, MIDDLE:THREE.MOUSE.PAN, RIGHT:THREE.MOUSE.ROTATE };
  canvas.style.cursor = tl === 'orbit' ? 'grab' : 'crosshair';
  ring.visible = false;
  $('uvc').style.cursor = tl === 'wand' ? 'crosshair' : '';
  if(S.uv.on && typeof schedUV === 'function') schedUV();
}
document.querySelectorAll('#tools button').forEach(b => b.onclick = () => setTool(b.dataset.tool));
canvas.addEventListener('contextmenu', e => e.preventDefault());
$('bColor').addEventListener('input', () => $('bHex').textContent = $('bColor').value);

// ---- ray casting
const ray = new THREE.Raycaster(), ray2 = new THREE.Raycaster(), ndc = new THREE.Vector2();
const uvPx = (p, uv) => ({ x:(uv.x - Math.floor(uv.x))*p.W, y:(1 - (uv.y - Math.floor(uv.y)))*p.H });
function hit(e){
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left)/r.width)*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([...S.parts.values()].filter(p => p.mesh.visible).map(p => p.mesh), false);
  const h = hits.find(h => !S.parts.get(h.object.name).info.glass) || hits[0];
  if(!h) return null;
  const p = S.parts.get(h.object.name);
  if(!h.uv || !p.editable) return { p, h };
  return { p, h, ...uvPx(p, h.uv) };
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
function worldPerPixel(r){
  const g = r.h.object.geometry, pos = g.attributes.position, uv = g.attributes.uv, f = r.h.face, m = r.h.object.matrixWorld;
  _a.fromBufferAttribute(pos, f.a).applyMatrix4(m); _b.fromBufferAttribute(pos, f.b).applyMatrix4(m); _c.fromBufferAttribute(pos, f.c).applyMatrix4(m);
  const uvd = (i, j) => Math.hypot((uv.getX(i) - uv.getX(j))*r.p.W, (uv.getY(i) - uv.getY(j))*r.p.H);
  const w = _a.distanceTo(_b) + _b.distanceTo(_c) + _c.distanceTo(_a), tt = uvd(f.a, f.b) + uvd(f.b, f.c) + uvd(f.c, f.a);
  return tt > 1e-6 ? w/tt : 0;
}
const brushPx = p => +$('bSize').value*p.W/1024;
function updateRing(r){
  if(!r || !r.p.editable || !(S.tool === 'paint' || S.tool === 'erase')){ ring.visible = false; return; }
  const k = worldPerPixel(r); if(!k){ ring.visible = false; return; }
  const rad = (brushPx(r.p)/2)*k;
  _n.copy(r.h.face.normal).transformDirection(r.h.object.matrixWorld);
  ring.position.copy(r.h.point).addScaledVector(_n, rad*0.02);
  ring.lookAt(_a.copy(r.h.point).add(_n));
  ring.scale.setScalar(rad);
  ring.material.color.set(S.tool === 'erase' ? 0x9fd0ff : S.target === 'mask' ? (S.maskWhite ? 0xffffff : 0x202020) : $('bColor').value);
  ring.visible = true;
}
// Mirror symmetry: find the texel on the other side of the part's centre plane.
function mirrorHit(r){
  const v = $('bSym').value; if(v === '') return null; const ax = +v;
  const mesh = r.p.mesh, g = mesh.geometry; if(!g.boundingBox) g.computeBoundingBox();
  const c = g.boundingBox.getCenter(_c).getComponent(ax);
  const pl = mesh.worldToLocal(r.h.point.clone()); pl.setComponent(ax, 2*c - pl.getComponent(ax));
  const nl = r.h.face.normal.clone(); nl.setComponent(ax, -nl.getComponent(ax));
  const pw = mesh.localToWorld(pl), nw = nl.transformDirection(mesh.matrixWorld), eps = S.modelSize*0.03;
  ray2.set(pw.clone().addScaledVector(nw, eps), nw.clone().negate()); ray2.far = eps*3;
  const h = ray2.intersectObject(mesh, false)[0];
  return h && h.uv ? uvPx(r.p, h.uv) : null;
}

// Share of texels used by more than one place of the mesh (mirrored / stacked UVs): paint there shows up twice.
function overlapWarn(p){
  if(p.ovl === undefined){
    const W = 256, H = 256, U = uvArr(p), P = p.mesh.geometry.attributes.position.array, first = new Float32Array(W*H*3), cnt = new Uint8Array(W*H);
    let cov = 0, far = 0; const lim = S.modelSize*0.04;
    for(let tr = 0; tr < U.length/6; tr++) E.rasterTri(W, H, U[tr*6]*W, (1 - U[tr*6+1])*H, U[tr*6+2]*W, (1 - U[tr*6+3])*H, U[tr*6+4]*W, (1 - U[tr*6+5])*H, (x, y, w0, w1, w2) => {
      if(w0 < 0 || w1 < 0 || w2 < 0) return;
      const i = y*W + x, a = tr*9, px = P[a]*w0 + P[a+3]*w1 + P[a+6]*w2, py = P[a+1]*w0 + P[a+4]*w1 + P[a+7]*w2, pz = P[a+2]*w0 + P[a+5]*w1 + P[a+8]*w2;
      if(!cnt[i]){ cnt[i] = 1; cov++; first[i*3] = px; first[i*3+1] = py; first[i*3+2] = pz; }
      else if(cnt[i] === 1 && Math.hypot(px - first[i*3], py - first[i*3+1], pz - first[i*3+2]) > lim){ cnt[i] = 2; far++; }
    });
    p.ovl = cov ? far/cov : 0;
  }
  if(p.ovl > 0.12 && !p.ovlTold){ p.ovlTold = true; setTimeout(() => toast(t('msg.overlap', Math.round(p.ovl*100))), 2300); }
}
// ---- which raster does the brush touch? (paint layer colour, or a layer mask)
function resolveTarget(p){
  let L = active(p); const erase = S.tool === 'erase', N = p.W*p.H;
  if(L && L.type !== 'paint' && L.type !== 'base' && (S.target === 'mask' || erase)){
    if(!L.mask){ pushStack(p); L.mask = new Uint8Array(N).fill(255); L.maskGen = { type:'white' }; toast(t('msg.newmask')); }
    setTarget('mask'); renderLayers(); renderProps();
    return { L, kind:'mask', arr:L.mask };
  }
  if(L && L.type === 'paint'){
    if(S.target === 'mask' && L.mask) return { L, kind:'mask', arr:L.mask };
    return { L, kind:'paint', arr:L.raster };
  }
  pushStack(p);
  L = mkLayer('paint', { name:t('layer.paint'), raster:new Uint8ClampedArray(N*4) });
  insertAbove(p, L); p.activeId = L.id; setTarget('content'); renderLayers(); renderProps(); updateButtons(); toast(t('msg.newpaint'));
  return { L, kind:'paint', arr:L.raster };
}
function brushValues(layer){
  return layer.surfacePaint ? [+$('brushR').value,+$('brushM').value,128+(+$('brushH').value)] : hexToRgb($('bColor').value);
}
function stamp(p, T, cx, cy, erase){
  const r = Math.max(0.5, brushPx(p)/2), hard = +$('bHard').value/100, flow = +$('bFlow').value/100, W = p.W, H = p.H;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  if(x1 < x0 || y1 < y0) return null;
  const alphaKind=$('brushAlpha').value, alphaAngle=+$('alphaAngle').value*Math.PI/180;
  const d = T.arr, sel = p.sel, mask = T.kind === 'mask', tv = erase ? 0 : (S.maskWhite ? 255 : 0), [cr, cg, cb] = brushValues(T.L);
  for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){
    const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)/r; if(dist > 1) continue;
    let f = dist <= hard ? 1 : 1 - (dist - hard)/(1 - hard + 1e-6); f = f*f*(3 - 2*f);
    const i = y*W + x; let w = f*flow*pressure*alphaWeight((x+.5-cx)/r,(y+.5-cy)/r,alphaKind,alphaAngle); if(sel) w *= sel[i]/255; if(w <= 0) continue;
    if(mask){ d[i] = Math.round(d[i] + (tv - d[i])*w); continue; }
    const k = i*4;
    if(erase){ d[k+3] = d[k+3]*(1 - w); continue; }
    const a0 = d[k+3]/255, a1 = a0 + (1 - a0)*w, ff = w/a1;
    d[k] += (cr - d[k])*ff; d[k+1] += (cg - d[k+1])*ff; d[k+2] += (cb - d[k+2])*ff; d[k+3] = a1*255;
  }
  return [x0, y0, x1, y1];
}
function seg(st, keyName, x, y){
  const p = st.p, size = brushPx(p), step = Math.max(1, size*(+$('bSpace').value/100)), l = st[keyName];
  let rect = null; const grow = q => { if(!q) return; rect = rect ? [Math.min(rect[0], q[0]), Math.min(rect[1], q[1]), Math.max(rect[2], q[2]), Math.max(rect[3], q[3])] : q; };
  if(l){
    const dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy);
    if(d < size*3){ if(d < step) return; const n = Math.floor(d/step); for(let i = 1; i <= n; i++) grow(stamp(p, st.T, l.x + dx*i/n, l.y + dy*i/n, st.erase)); }
    else grow(stamp(p, st.T, x, y, st.erase));
  } else grow(stamp(p, st.T, x, y, st.erase));
  st[keyName] = { x, y };
  if(rect) recomposite(p, rect);
}
function fillTool(p, r){
  const T = resolveTarget(p); pushRaster(p, T.L, T.kind === 'mask' ? 'mask' : 'raster');
  const mode = $('fMode').value, U = uvArr(p), W = p.W, H = p.H, d = T.arr, mask = T.kind === 'mask';
  const tv = S.maskWhite ? 255 : 0, [cr, cg, cb] = brushValues(T.L);
  const put = i => { if(mask) d[i] = tv; else { d[i*4] = cr; d[i*4+1] = cg; d[i*4+2] = cb; d[i*4+3] = 255; } };
  if(mode === 'part'){ for(let i = 0; i < W*H; i++) put(i); }
  else {
    const isl = islands(p), tris = mode === 'tri' ? [r.h.faceIndex] : isl.trisOf[isl.triIsl[r.h.faceIndex]];
    for(const tr of tris) E.rasterTri(W, H, U[tr*6]*W, (1 - U[tr*6+1])*H, U[tr*6+2]*W, (1 - U[tr*6+3])*H, U[tr*6+4]*W, (1 - U[tr*6+5])*H, (x, y) => put(y*W + x));
  }
  if(mask) T.L.maskPainted = true;
  markDirty(p); recomposite(p);
}
// Decal / projection: stamps an image (patch, flag, logo) flat onto the surface around the clicked point.
function decalTool(p, r){
  const src = S.decal.src; if(!src){ toast(t('msg.nodecal')); return; }
  let L = active(p);
  if(!L || L.type !== 'paint' || L.surfacePaint){
    pushStack(p); L = mkLayer('paint', { name:t('layer.decal'), raster:new Uint8ClampedArray(p.W*p.H*4) });
    insertAbove(p, L); p.activeId = L.id; setTarget('content'); renderLayers(); renderProps(); updateButtons();
  }
  const T = { L, kind:'paint', arr:L.raster };
  pushRaster(p, T.L, 'raster');
  const mesh = p.mesh, inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const pl = r.h.point.clone().applyMatrix4(inv), n = r.h.face.normal.clone().normalize();
  let up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).transformDirection(inv);
  let right = new THREE.Vector3().crossVectors(up, n); if(right.lengthSq() < 1e-6) right.set(1, 0, 0); right.normalize(); up = new THREE.Vector3().crossVectors(n, right).normalize();
  const th = +$('dRot').value*Math.PI/180, R2 = right.clone().multiplyScalar(Math.cos(th)).addScaledVector(up, Math.sin(th)), U2 = up.clone().multiplyScalar(Math.cos(th)).addScaledVector(right, -Math.sin(th));
  const sw = +$('dSize').value/100*S.modelSize, shh = sw*src.h/src.w, rad = Math.hypot(sw, shh)/2, op = +$('dOp').value/100, depth = Math.max(sw, shh)*0.4;
  const P = mesh.geometry.attributes.position.array, U = uvArr(p), W = p.W, H = p.H, d = T.arr, seen = new Uint8Array(W*H), o = new Float64Array(4);
  let rx0 = W, ry0 = H, rx1 = 0, ry1 = 0;
  for(let tr = 0; tr < U.length/6; tr++){
    const i0 = tr*9; let near = false, me = 0;
    for(let v = 0; v < 3; v++){ const a = i0 + v*3, b = i0 + ((v + 1) % 3)*3; me = Math.max(me, Math.hypot(P[a]-P[b], P[a+1]-P[b+1], P[a+2]-P[b+2])); }
    for(let v = 0; v < 3 && !near; v++){ const a = i0 + v*3; if(Math.hypot(P[a]-pl.x, P[a+1]-pl.y, P[a+2]-pl.z) < rad + me) near = true; }
    if(!near) continue;
    const ax = P[i0+3]-P[i0], ay = P[i0+4]-P[i0+1], az = P[i0+5]-P[i0+2], bx = P[i0+6]-P[i0], by = P[i0+7]-P[i0+1], bz = P[i0+8]-P[i0+2];
    let fx = ay*bz - az*by, fy = az*bx - ax*bz, fz = ax*by - ay*bx; const fl = Math.hypot(fx, fy, fz) || 1;
    if((fx*n.x + fy*n.y + fz*n.z)/fl < 0.15) continue;
    E.rasterTri(W, H, U[tr*6]*W, (1 - U[tr*6+1])*H, U[tr*6+2]*W, (1 - U[tr*6+3])*H, U[tr*6+4]*W, (1 - U[tr*6+5])*H, (x, y, w0, w1, w2) => {
      const i = y*W + x; if(seen[i]) return;
      const dx = P[i0]*w0 + P[i0+3]*w1 + P[i0+6]*w2 - pl.x, dy = P[i0+1]*w0 + P[i0+4]*w1 + P[i0+7]*w2 - pl.y, dz = P[i0+2]*w0 + P[i0+5]*w1 + P[i0+8]*w2 - pl.z;
      if(Math.abs(dx*n.x + dy*n.y + dz*n.z) > depth) return;
      const u = (dx*R2.x + dy*R2.y + dz*R2.z)/sw + 0.5, v = 0.5 - (dx*U2.x + dy*U2.y + dz*U2.z)/shh;
      if(u < 0 || u > 1 || v < 0 || v > 1) return;
      seen[i] = 1;
      const sx = Math.min(src.w - 1, Math.max(0, Math.round(u*src.w - 0.5))), sy = Math.min(src.h - 1, Math.max(0, Math.round(v*src.h - 0.5))), sk = (sy*src.w + sx)*4;
      o[0] = src.data[sk]; o[1] = src.data[sk+1]; o[2] = src.data[sk+2]; o[3] = src.data[sk+3];
      const w = o[3]/255*op; if(w <= 0) return;
      const k = i*4, a0 = d[k+3]/255, a1 = a0 + (1 - a0)*w, ff = w/a1;
      d[k] += (o[0] - d[k])*ff; d[k+1] += (o[1] - d[k+1])*ff; d[k+2] += (o[2] - d[k+2])*ff; d[k+3] = a1*255;
      if(x < rx0) rx0 = x; if(x > rx1) rx1 = x; if(y < ry0) ry0 = y; if(y > ry1) ry1 = y;
    });
  }
  markDirty(p);
  if(rx1 >= rx0) recomposite(p, [rx0, ry0, rx1, ry1]); else toast(t('msg.decalmiss'));
}
$('decalLoad').onclick = async () => {
  const use = async (name, blob) => { S.decal.src = E.srcFromImage(await createImageBitmap(blob), 1024); S.decal.name = name; $('decalName').textContent = name + ` · ${S.decal.src.w}×${S.decal.src.h}`; };
  if(DESK){ const f = (await DESK.openFiles([{ name:'Images', extensions:['png', 'jpg', 'jpeg', 'webp'] }], false))[0]; if(f) await use(f.name, new Blob([f.data])); }
  else { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => inp.files[0] && use(inp.files[0].name, inp.files[0]); inp.click(); }
};

// ---- pointer handling on the 3D view
canvas.addEventListener('pointerdown', e => {
  if(e.button !== 0) return;
  if(S.tool === 'orbit' && !e.altKey){ S._down = [e.clientX, e.clientY, e.shiftKey]; return; }
  const r = hit(e); if(!r) return;
  if(S.tool === 'orbit' || (e.altKey && S.tool !== 'wand')){ select(r.p.name); return; }
  if(!r.p.editable){ select(r.p.name); toast(t('msg.notex')); return; }
  if(r.p.name !== S.sel){
    if($('lock').checked && !(S.tool === 'wand' || S.tool === 'pick')){ toast(t('msg.locked', plabel(r.p))); return; }
    select(r.p.name);
  }
  const p = r.p; flush();
  if(S.tool === 'paint' || S.tool === 'erase' || S.tool === 'fill' || S.tool === 'decal') overlapWarn(p);
  if(S.tool === 'pick'){
    const k = (Math.min(p.H - 1, Math.floor(r.y))*p.W + Math.min(p.W - 1, Math.floor(r.x)))*4, hex = rgbToHex(p.out[k], p.out[k+1], p.out[k+2]);
    $('bColor').value = hex; $('bHex').textContent = hex; toast(t('msg.color', hex)); return;
  }
  if(S.tool === 'wand'){ wand(p, Math.floor(r.x), Math.floor(r.y), e.shiftKey ? 'add' : e.altKey ? 'sub' : 'new'); return; }
  if(S.tool === 'fill'){ fillTool(p, r); return; }
  if(S.tool === 'decal'){ decalTool(p, r); return; }
  canvas.setPointerCapture(e.pointerId);
  const T = resolveTarget(p);
  pushRaster(p, T.L, T.kind === 'mask' ? 'mask' : 'raster');
  if(T.kind === 'mask') T.L.maskPainted = true;
  S.stroke = { p, T, erase:S.tool === 'erase', last:null, lastM:null };
  markDirty(p);
  seg(S.stroke, 'last', r.x, r.y);
  const m = mirrorHit(r); if(m) seg(S.stroke, 'lastM', m.x, m.y);
});
canvas.addEventListener('pointermove', e => {
  if(S.tool === 'orbit') return;
  const r = hit(e);
  updateRing(r && (!$('lock').checked || r.p.name === S.sel) ? r : null);
  const st = S.stroke; if(!st) return;
  if(!r || r.p !== st.p || r.x === undefined){ st.last = st.lastM = null; return; }
  seg(st, 'last', r.x, r.y);
  if($('bSym').value !== ''){ const m = mirrorHit(r); if(m) seg(st, 'lastM', m.x, m.y); else st.lastM = null; }
});
canvas.addEventListener('pointerup', e => {
  S.stroke = null;
  if(S.tool === 'orbit' && S._down && e.button === 0){
    const moved = Math.hypot(e.clientX - S._down[0], e.clientY - S._down[1]), add = S._down[2]; S._down = null;
    if(moved < 4){
      const r = hit(e); if(!r) return;
      if(S.uv.on && r.p.name === S.sel && r.p.editable){
        uvClick(r.p, r.h.faceIndex, add);
        drawUV();
      } else select(r.p.name);
    }
  }
});
canvas.addEventListener('pointerleave', () => { ring.visible = false; });

// ---- colour selection (wand)
// Per-pixel features for "pattern" matching: local mean colour + local roughness (std-dev of brightness), box radius R.
function wandFeat(d, W, H){
  const R = Math.max(2, Math.round(W/256)), N = W*H, I = (W + 1)*(H + 1);
  const sr = new Float64Array(I), sg = new Float64Array(I), sb = new Float64Array(I), sl = new Float64Array(I), sl2 = new Float64Array(I);
  for(let y = 0; y < H; y++){ let ar = 0, ag = 0, ab = 0, al = 0, al2 = 0;
    for(let x = 0; x < W; x++){ const k = (y*W + x)*4, l = 0.299*d[k] + 0.587*d[k+1] + 0.114*d[k+2];
      ar += d[k]; ag += d[k+1]; ab += d[k+2]; al += l; al2 += l*l; const j = (y + 1)*(W + 1) + x + 1, u = j - W - 1;
      sr[j] = sr[u] + ar; sg[j] = sg[u] + ag; sb[j] = sb[u] + ab; sl[j] = sl[u] + al; sl2[j] = sl2[u] + al2; } }
  const f = new Float32Array(N*4);
  for(let y = 0; y < H; y++){ const y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1);
    for(let x = 0; x < W; x++){ const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), n = (x1 - x0)*(y1 - y0);
      const S = a => a[y1*(W + 1) + x1] - a[y0*(W + 1) + x1] - a[y1*(W + 1) + x0] + a[y0*(W + 1) + x0];
      const m = S(sl)/n, i = (y*W + x)*4; f[i] = S(sr)/n; f[i+1] = S(sg)/n; f[i+2] = S(sb)/n; f[i+3] = Math.sqrt(Math.max(0, S(sl2)/n - m*m))*3; } }
  return f;
}
function wand(p, x, y, mode){
  pushStack(p);
  const orig = $('wSrc').value === 'orig', d = orig ? baseRaster(p) : p.out, N = p.W*p.H, pat = $('wMatch').value === 'pattern';
  let near;
  if(pat){
    const key = (orig ? 'o' : 'r') + p.W + 'x' + p.H + '|' + (orig ? p.baseSrc.id : Math.random());
    if(!p._wf || p._wf.key !== key) p._wf = { key, f:wandFeat(d, p.W, p.H) };
    const f = p._wf.f, k0 = (y*p.W + x)*4, r0 = f[k0], g0 = f[k0+1], b0 = f[k0+2], t0 = f[k0+3], tol = +$('wTol').value*1.25, tol2 = tol*tol;
    near = i => { const k = i*4, a = f[k] - r0, b = f[k+1] - g0, c = f[k+2] - b0, e = f[k+3] - t0; return a*a + b*b + c*c + e*e <= tol2; };
  } else {
    const tol = +$('wTol').value*4.42, tol2 = tol*tol, k0 = (y*p.W + x)*4, r0 = d[k0], g0 = d[k0+1], b0 = d[k0+2];
    near = i => { const k = i*4, a = d[k] - r0, b = d[k+1] - g0, c = d[k+2] - b0; return a*a + b*b + c*c <= tol2; };
  }
  const sel = new Uint8Array(N);
  if($('wCont').checked){
    const stack = new Int32Array(N); let sp = 0; stack[sp++] = y*p.W + x; sel[y*p.W + x] = 1;
    while(sp){
      const i = stack[--sp], cx = i % p.W, cy = (i/p.W) | 0;
      for(const j of [cx > 0 ? i - 1 : -1, cx < p.W - 1 ? i + 1 : -1, cy > 0 ? i - p.W : -1, cy < p.H - 1 ? i + p.W : -1]) if(j >= 0 && !sel[j] && near(j)){ sel[j] = 1; stack[sp++] = j; }
    }
  } else for(let i = 0; i < N; i++) if(near(i)) sel[i] = 1;
  const m = (mode === 'new' || !p.sel) ? new Uint8Array(N) : new Uint8Array(p.sel);
  let cnt = 0;
  for(let i = 0; i < N; i++){ if(sel[i]) m[i] = mode === 'sub' ? 0 : 255; if(m[i]) cnt++; }
  p.sel = cnt ? m : null;
  present(p); updateButtons();
  setStatus(t('st.sel', (100*cnt/N).toFixed(1), plabel(p)));
}
$('selAll').onclick = () => { const p = cur(); if(!p) return; pushStack(p); p.sel = new Uint8Array(p.W*p.H).fill(255); present(p); };
$('selInv').onclick = () => { const p = cur(); if(!p) return; pushStack(p); const m = new Uint8Array(p.W*p.H); for(let i = 0; i < m.length; i++) m[i] = 255 - (p.sel ? p.sel[i] : 0); p.sel = m; present(p); };
$('selNone').onclick = () => { const p = cur(); if(!p || !p.sel) return; pushStack(p); p.sel = null; present(p); };

// ============================================================ asset shelf
function addTile(gridEl, o){
  const el = document.createElement('div'); el.className = 'mat' + (o.cls ? ' ' + o.cls : '');
  el.innerHTML = `<i class="th"></i><span></span><small></small>`;
  el.querySelector('span').textContent = o.label; el.querySelector('span').title = o.label; el.querySelector('small').textContent = o.sub || '';
  if(o.swatch) el.querySelector('.th').style.background = o.swatch;
  if(o.thumb) el.querySelector('.th').style.background = `url(${o.thumb}) center/cover`;
  el.onclick = () => o.click(el);
  gridEl.appendChild(el); return el;
}
const rnd = () => (Math.random()*1e6) | 0;
const gen = (type, o) => Object.assign({ type, level:0.5, contrast:0.5, scale:1, invert:false, seed:rnd() }, o);
function fillSolid(name, color, props){ return newFill(solidMat(), Object.assign({ name, color }, props)); }
function withGen(L, p, type, o){ L.maskGen = gen(type, o); L.mask = makeMask(L.maskGen, p); return L; }
// Smart materials = ready-made stacks of layers with generator masks.
const SMART = [
  { n:['Field wear: dirt + dust', 'Desgaste de campo: suciedad y polvo'], sw:'linear-gradient(120deg,#3b3024,#9a8a6a)', make:p => [
      withGen(fillSolid(t('sm.dirt'), '#33291f', { blend:'multiply', opacity:0.8, ch:{ color:true, rough:true, metal:false, height:false }, rough:0.95 }), p, 'dirt', { level:0.5, contrast:0.35 }),
      withGen(fillSolid(t('sm.dust'), '#a8987a', { opacity:0.45 }), p, 'noise', { level:0.42, contrast:0.3, scale:1.6 }) ] },
  { n:['Painted metal, chipped edges', 'Metal pintado, bordes pelados'], sw:'linear-gradient(120deg,#3d4136 55%,#a9acae 55%)', make:p => [
      fillSolid(t('sm.paint'), '#3d4136', { ch:{ color:true, rough:true, metal:true, height:false }, rough:0.55, metal:0 }),
      withGen(fillSolid(t('sm.bare'), '#a9acae', { ch:{ color:true, rough:true, metal:true, height:true }, rough:0.32, metal:1, height:-0.25 }), p, 'edges', { level:0.38, contrast:0.6, scale:2.5 }),
      withGen(fillSolid(t('sm.dirt'), '#2a221a', { blend:'multiply', opacity:0.7 }), p, 'dirt', { level:0.45, contrast:0.35 }) ] },
  { n:['Matte black polymer', 'Polímero negro mate'], sw:'linear-gradient(120deg,#1b1c1d,#3a3b3c)', make:p => [
      fillSolid(t('sm.polymer'), '#1c1d1e', { ch:{ color:true, rough:true, metal:false, height:false }, rough:0.62 }),
      withGen(fillSolid(t('sm.scuff'), '#55585a', { opacity:0.55, ch:{ color:true, rough:true, metal:false, height:false }, rough:0.4 }), p, 'edges', { level:0.33, contrast:0.6, scale:3 }) ] },
  { n:['Rubber', 'Goma'], sw:'linear-gradient(120deg,#141414,#2a2a2a)', make:p => [
      fillSolid(t('sm.rubber'), '#161616', { ch:{ color:true, rough:true, metal:false, height:false }, rough:0.92 }),
      withGen(fillSolid(t('sm.grain'), '#202020', { ch:{ color:true, rough:false, metal:false, height:true }, height:0.25 }), p, 'noise', { level:0.5, contrast:0.25, scale:7 }) ] },
  { n:['Velcro panel', 'Panel de velcro'], sw:'#7c6447', thumb:() => DETAIL.velcro_loop.thumb, make:p => {
      const V = newFill(DETAIL.velcro_loop, { name:t('layer.velcro') }); applyMatDefaults(V, V.mat, p);
      if(p.info.zones && p.info.zones.velcro) withGen(V, p, 'zone', {});
      return [V]; } },
  { n:['Nylon webbing', 'Cinta de nailon'], sw:'#4d5240', thumb:() => DETAIL.webbing_twill.thumb, make:p => {
      const V = newFill(DETAIL.webbing_twill, { name:t('sm.webbing'), color:'#4d5240' }); applyMatDefaults(V, V.mat, p); return [V]; } },
  { n:['Mud splatter', 'Salpicaduras de barro'], sw:'linear-gradient(120deg,#4a3a28,#6b563c)', make:p => [
      withGen(fillSolid(t('sm.mud'), '#4f3f2c', { ch:{ color:true, rough:true, metal:false, height:true }, rough:1, height:0.5 }), p, 'noise', { level:0.36, contrast:0.75, scale:2.2 }) ] },
  { n:['Sun-faded top', 'Descolorido por el sol'], sw:'linear-gradient(180deg,#d8d2c0,#7d7355)', make:p => [
      withGen(mkLayer('adjust', { name:t('sm.fade'), con:-0.12, sat:-0.4, bri:0.07, hue:0 }), p, 'gradient', { level:0.55, contrast:0.2 }) ] },
  { n:['Dark crevices', 'Oscurecer huecos'], sw:'linear-gradient(120deg,#111,#666)', make:p => [
      withGen(fillSolid(t('sm.crev'), '#17130f', { blend:'multiply', opacity:0.75 }), p, 'cavity', { level:0.42, contrast:0.5, scale:2 }) ] },
];
function addSmart(def){
  const p = cur(); if(!p){ toast(t('msg.selpart')); return; }
  flush(); setStatus(t('st.computing'));
  setTimeout(() => {
    pushStack(p);
    const Ls = def.make(p);
    for(const L of Ls){ insertAbove(p, L); p.activeId = L.id; }
    after(p); toast(t('msg.smart', Ls.length));
  }, 20);
}
const tacticalMats=new Map();
const tacticalDefs=[
  ['nylon330','Cordura-style 330D','#797259',.84,0],
  ['nylon500','Cordura-style 500D','#746547',.86,0],
  ['nylon1000','Cordura-style 1000D','#726345',.90,0],
  ['spacer','Spacer mesh','#424740',.93,0],
  ['cordura','Cordura-style nylon','#776b4d',.88,0],['ripstop','Ripstop nylon','#68704f',.84,0],['webbing','Nylon webbing','#575c42',.9,0],['polymer','Molded polymer','#343537',.72,0],['ceramic','Ceramic coating','#8b795e',.7,0],['metal','Anodized metal','#575b60',.43,1],['rubber','Textured rubber','#292a28',.94,0],['composite','Woven composite','#4b4c43',.65,0]];
function tacticalMaterial(def){const [kind,name,color,rough,metal]=def;if(tacticalMats.has(kind))return tacticalMats.get(kind);const maps=gearTextile(kind,rough,256) || E.tacticalSurface(kind,rough,256),M=mkMat({kind:'image',name,gray:true,src:maps.color,roughSrc:maps.rough,heightSrc:maps.height,tactical:{metal,rough},thumb:E.srcThumb(maps.color)});tacticalMats.set(kind,M);return M;}
function buildLibrary(){
  const g = $('gridBase'); g.innerHTML = '';
  addTile(g, { label:t('mat.solid'), sub:t('lib.sub.fill'), swatch:'#4a4f3a', click:() => applyMaterial(solidMat(), { color:$('bColor').value, noAuto:true }) });
  addTile(g, { label:t('mat.tint'), sub:t('lib.sub.tint'), swatch:'linear-gradient(135deg,#6b6a3a,#c9b48a)', click:() => applyMaterial(solidMat(), { name:t('mat.tint'), color:$('bColor').value, blend:'color', noAuto:true }) });
  for(const type of ['digital', 'woodland', 'tiger']){
    const prev = E.makeCamo(type, PALETTES[type === 'woodland' ? 2 : 0].c, 1234, 128);
    addTile(g, { label:t('mat.camo.' + type), sub:t('lib.sub.proc'), thumb:E.srcThumb(prev), click:() => applyMaterial(camoMat(type, PALETTES[type === 'woodland' ? 2 : 0].c, rnd())) });
  }
  const det = [['velcro_loop', '#7c6447'], ['velcro_hook', '#2a2a29'], ['webbing_twill', '#4d5240']];
  for(const [k, color] of det){ const M = DETAIL[k]; M.name = t('mat.' + k); addTile(g, { label:M.name, sub:t('lib.sub.detail'), thumb:M.thumb, click:() => applyMaterial(M, { color, noAuto:true }) }); }
  ORIG.name = t('layer.orig');
  addTile(g, { label:t('layer.orig'), sub:t('lib.sub.orig'), swatch:'linear-gradient(135deg,#5a5446 0 45%,#c8b98f 45% 55%,#5a5446 55%)', click:addOrig });
  SHADE.name = t('layer.shade');
  addTile(g, { label:t('layer.shade'), sub:t('lib.sub.shade'), swatch:'radial-gradient(circle at 35% 35%,#bbb,#333)', click:() => {
    const p = cur(); if(!p) return; flush(); pushStack(p); const L = addShade(p); if(!L){ S.undo.pop(); toast(t('msg.hasshade')); return; } p.activeId = L.id; after(p); } });
  for(const def of tacticalDefs){const M=tacticalMaterial(def);addTile(g,{label:def[1],sub:'Procedural PBR',thumb:M.thumb,click:()=>applyMaterial(M,{color:def[2],noAuto:true})});}
  const gs = $('gridSmart'); gs.innerHTML = '';
  for(const d of SMART) addTile(gs, { label:pick(d.n), sub:t('lib.sub.smart'), swatch:d.sw, thumb:d.thumb ? d.thumb() : null, click:() => addSmart(d) });
  [...$('cPreset').options].forEach((o, i) => { o.value = String(i); o.textContent = pick(PALETTES[i].n); });
}
document.querySelectorAll('#libTabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#libTabs button').forEach(x => x.classList.toggle('on', x === b));
  for(const k of ['base', 'smart', 'camo', 'ph', 'mine']) $('lib-' + k).hidden = k !== b.dataset.t;
  if(b.dataset.t === 'ph') initPolyHaven();
  if(b.dataset.t === 'camo') initCamo();
});

// ---- Poly Haven (CC0 materials, fetched on the user's machine)
const PH = { list:null, shown:0, filtered:[] };
$('phLink').onclick = e => { e.preventDefault(); DESK ? DESK.openExternal('https://polyhaven.com') : window.open('https://polyhaven.com'); };
async function initPolyHaven(){
  if(PH.list || PH.loading) return;
  PH.loading = true; $('phMsg').textContent = t('ph.connecting');
  try{
    const all = await netJSON('https://api.polyhaven.com/assets?t=textures');
    PH.list = Object.entries(all).map(([id, a]) => ({ id, ...a })).sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    const cats = new Map();
    for(const a of PH.list) for(const c of (a.categories || [])) cats.set(c, (cats.get(c) || 0) + 1);
    [...cats.entries()].sort((a, b) => b[1] - a[1]).forEach(([c, n]) => $('phCat').add(new Option(`${c} (${n})`, c)));
    phFilter();
  } catch(err){
    PH.loading = false;
    $('phMsg').innerHTML = ''; $('phMsg').append(t('ph.fail') + ' ');
    const a = document.createElement('a'); a.href = '#'; a.textContent = t('ph.retry'); a.onclick = e => { e.preventDefault(); initPolyHaven(); }; $('phMsg').append(a);
  }
}
function phFilter(){
  const q = $('phSearch').value.trim().toLowerCase(), c = $('phCat').value;
  PH.filtered = PH.list.filter(a => (!c || (a.categories || []).includes(c)) &&
    (!q || a.id.includes(q) || (a.name || '').toLowerCase().includes(q) || (a.tags || []).some(x => x.toLowerCase().includes(q))));
  $('gridPH').innerHTML = ''; PH.shown = 0; phMore();
  $('phMsg').textContent = PH.filtered.length ? t('ph.count', PH.filtered.length) : t('ph.none');
}
function phMore(){
  const next = PH.filtered.slice(PH.shown, PH.shown + 40); PH.shown += next.length;
  for(const a of next){
    let M = null;
    addTile($('gridPH'), { label:a.name || a.id, thumb:a.thumbnail_url || `https://cdn.polyhaven.com/asset_img/thumbs/${a.id}.png?width=256&height=256`, click:async el => {
      if(M) return applyMaterial(M);
      el.classList.add('loading');
      try{
        const files = await netJSON('https://api.polyhaven.com/files/' + a.id);
        const grab = async re => {
          const k = Object.keys(files).find(x => re.test(x)); if(!k) return null;
          const rs = files[k]['2k'] || files[k]['1k'] || Object.values(files[k])[0], f = rs.jpg || rs.png || Object.values(rs)[0];
          return E.srcFromImage(await createImageBitmap(await netBlob(f.url)), 2048);
        };
        const src = await grab(/^diff/i) || await grab(/col|albedo/i);
        if(!src) throw new Error(t('ph.nocolor'));
        let rough = null; try{ rough = await grab(/^rough/i); } catch{}
        M = mkMat({ kind:'image', name:a.name || a.id, src, roughSrc:rough, thumb:E.srcThumb(src), source:'Poly Haven' });
        applyMaterial(M);
      } catch(err){ toast(t('ph.dlfail', err.message)); }
      el.classList.remove('loading');
    } });
  }
  $('phMore').hidden = PH.shown >= PH.filtered.length;
}
let phT; $('phSearch').addEventListener('input', () => { clearTimeout(phT); phT = setTimeout(() => PH.list && phFilter(), 250); });
$('phCat').onchange = () => PH.list && phFilter();
$('phMore').onclick = phMore;

// ---- my materials
async function addMine(name, blob){
  const src = E.srcFromImage(await createImageBitmap(blob), 2048);
  const M = mkMat({ kind:'image', name, src, thumb:E.srcThumb(src), digital:DIGITAL_RE.test(name) });
  addTile($('gridMine'), { label:name, thumb:M.thumb, click:() => applyMaterial(M) }); applyMaterial(M);
}
$('importMat').onclick = async () => {
  if(DESK){
    const files = await DESK.openFiles([{ name:'Images', extensions:['png', 'jpg', 'jpeg', 'webp'] }], true);
    for(const f of files) await addMine(f.name.replace(/\.\w+$/, ''), new Blob([f.data]));
  } else {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async () => { for(const f of inp.files) await addMine(f.name.replace(/\.\w+$/, ''), f); };
    inp.click();
  }
};

// ---- camouflage library (user's local folder) sorted Country > Branch > Pattern
const CAMO = { items:[], tree:null, path:[], catalog:null, root:'' };
const thumbObs = new IntersectionObserver(ents => {
  for(const en of ents){
    if(!en.isIntersecting) continue;
    const el = en.target; thumbObs.unobserve(el);
    DESK.camoThumb(el.dataset.abs).then(u => { el.style.backgroundImage = `url(${u})`; }).catch(() => { el.style.background = '#3a2020'; });
  }
}, { root:$('lib-camo'), rootMargin:'200px' });
async function loadCatalog(){
  if(CAMO.catalog) return CAMO.catalog;
  try{ CAMO.catalog = (await (await fetch('camo-catalog.json')).json()).items; } catch { CAMO.catalog = {}; }
  return CAMO.catalog;
}
function prettyFolder(s){ return s.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || s; }
async function buildCamo(res){
  const cat = await loadCatalog();
  CAMO.items = res.files.map(f => {
    let rel = f.rel, hitK = null;
    for(;;){ if(cat[rel]){ hitK = rel; break; } const i = rel.indexOf('/'); if(i < 0) break; rel = rel.slice(i + 1); }
    if(hitK) return { abs:f.abs, c:cat[hitK].c, n:cat[hitK].n };
    const parts = f.rel.split('/'), file = parts.pop().replace(/\.\w+$/, ''), dirs = parts.map(prettyFolder);
    const c = dirs.length >= 3 ? dirs.slice(-3) : ['Other', ...dirs, 'General'].slice(0, 3);
    while(c.length < 3) c.push('General');
    return { abs:f.abs, c, n:file.replace(/_/g, ' ') };
  });
  const rootN = { name:'', kids:new Map(), items:[] };
  for(const it of CAMO.items){
    let n = rootN;
    for(const k of it.c){ if(!n.kids.has(k)) n.kids.set(k, { name:k, kids:new Map(), items:[] }); n = n.kids.get(k); }
    n.items.push(it);
  }
  const count = n => n.count = n.items.length + [...n.kids.values()].reduce((a, k) => a + count(k), 0);
  count(rootN);
  CAMO.tree = rootN; CAMO.path = []; CAMO.root = res.root;
  $('camoEmpty').hidden = true; $('camoBrowser').hidden = false;
  renderCamo();
}
function camoNode(){ let n = CAMO.tree; for(const k of CAMO.path) n = n.kids.get(k); return n; }
function firstItem(n){ return n.items[0] || firstItem([...n.kids.values()][0]); }
function renderCamo(){
  if(!CAMO.tree) return;
  const q = $('camoSearch').value.trim().toLowerCase(), g = $('gridCamoPack'), crumbs = $('crumbs');
  g.innerHTML = ''; crumbs.innerHTML = '';
  $('camoCount').textContent = t('camo.count', CAMO.items.length) + ' · ' + CAMO.root;
  if(q){
    const words = q.split(/\s+/);
    const hits = CAMO.items.filter(it => { const s = (it.n + ' ' + it.c.join(' ')).toLowerCase(); return words.every(w => s.includes(w)); });
    const a = document.createElement('a'); a.className = 'cur'; a.textContent = t('camo.results', hits.length); crumbs.appendChild(a);
    hits.slice(0, 200).forEach(it => camoTile(it, true));
    return;
  }
  let n = camoNode();
  while(n.kids.size === 1 && !n.items.length && CAMO.path.length < 3){ const k = [...n.kids.keys()][0]; CAMO.path.push(k); n = n.kids.get(k); }
  const trail = [t('camo.all'), ...CAMO.path];
  trail.forEach((s, i) => {
    if(i) crumbs.insertAdjacentHTML('beforeend', '<span>›</span>');
    const a = document.createElement('a'); a.textContent = s; if(i === trail.length - 1) a.className = 'cur';
    a.onclick = () => { CAMO.path = CAMO.path.slice(0, i); renderCamo(); };
    crumbs.appendChild(a);
  });
  const kids = [...n.kids.values()].sort((a, b) => CAMO.path.length ? b.count - a.count : a.name.localeCompare(b.name));
  for(const k of kids){
    const el = addTile(g, { label:k.name, sub:String(k.count), cls:'folder', click:() => { CAMO.path.push(k.name); renderCamo(); $('lib-camo').scrollTop = 0; } });
    const th = el.querySelector('.th'); th.dataset.abs = firstItem(k).abs; thumbObs.observe(th);
  }
  n.items.forEach(it => camoTile(it, false));
}
function camoTile(it, showPath){
  const el = addTile($('gridCamoPack'), { label:it.n, sub:showPath ? `${it.c[0]} › ${it.c[2]}` : it.c[2], click:async tile => {
    tile.classList.add('loading');
    try{
      const bmp = await createImageBitmap(new Blob([await DESK.camoRead(it.abs)])), bw = bmp.width;
      const src = E.srcFromImage(bmp, 4096);
      // the pack is drawn at 150 ppi, so the true size of one repeat is known
      applyMaterial(mkMat({ kind:'image', name:`${it.n} · ${it.c[0]}`, src, thumb:E.srcThumb(src), realTiling:S.unitM/(bw/150*0.0254), digital:DIGITAL_RE.test(it.n + ' ' + it.c[2]) }));
    } catch(err){ toast(t('camo.openfail', err.message)); }
    tile.classList.remove('loading');
  } });
  const th = el.querySelector('.th'); th.dataset.abs = it.abs; thumbObs.observe(th);
}
async function initCamo(){
  if(CAMO.tree || CAMO.init) return; CAMO.init = true;
  if(!DESK){ $('camoMsg').textContent = t('camo.desktop'); $('camoPick').disabled = true; return; }
  const res = await DESK.camoGet();
  if(res && res.files.length) buildCamo(res);
}
async function pickCamo(){
  $('camoMsg').textContent = t('camo.reading');
  const res = await DESK.camoPick();
  if(!res){ $('camoMsg').textContent = ''; return; }
  if(!res.files.length){ $('camoMsg').textContent = t('camo.noimg'); return; }
  $('camoMsg').textContent = '';
  buildCamo(res);
}
$('camoPick').onclick = pickCamo;
$('camoChange').onclick = pickCamo;
let camoT; $('camoSearch').addEventListener('input', () => { clearTimeout(camoT); camoT = setTimeout(renderCamo, 200); });

// ============================================================ UV editor
const uvc = $('uvc'), uctx = uvc.getContext('2d');
function resizeUV(){
  if(!S.uv.on) return;
  const r = uvc.parentElement.getBoundingClientRect(), dpr = devicePixelRatio;
  uvc.width = Math.max(1, r.width*dpr); uvc.height = Math.max(1, r.height*dpr);
  drawUV();
}
$('uvBtn').onclick = () => {
  S.uv.on = !S.uv.on; $('views').classList.remove('uv-only');
  $('views').classList.toggle('split', S.uv.on);
  $('uvBtn').classList.toggle('primary', S.uv.on);
  requestAnimationFrame(() => { resize(); if(S.uv.on){ uvFit(); drawUV(); } });
};
function setUV(p, arr){ const a = p.mesh.geometry.attributes.uv; a.array.set(arr); a.needsUpdate = true; }
function islands(p){
  if(p.isl) return p.isl;
  const U = uvArr(p), nT = U.length/6;
  const parent = new Int32Array(nT).map((_, i) => i);
  const find = i => { while(parent[i] !== i){ parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const seen = new Map();
  for(let tr = 0; tr < nT; tr++) for(let v = 0; v < 3; v++){
    const k = Math.round(U[(tr*3 + v)*2]*1e5) + ',' + Math.round(U[(tr*3 + v)*2 + 1]*1e5);
    const o = seen.get(k);
    if(o === undefined) seen.set(k, tr); else { const a = find(o), b = find(tr); if(a !== b) parent[a] = b; }
  }
  const map = new Map(), triIsl = new Int32Array(nT), trisOf = [];
  for(let tr = 0; tr < nT; tr++){ const r = find(tr); if(!map.has(r)){ map.set(r, trisOf.length); trisOf.push([]); } const id = map.get(r); triIsl[tr] = id; trisOf[id].push(tr); }
  return p.isl = { triIsl, trisOf, count:trisOf.length };
}
const toScr = (u, v) => [S.uv.ox + u*S.uv.z, S.uv.oy + (1 - v)*S.uv.z];
const toUV = (sx, sy) => [(sx - S.uv.ox)/S.uv.z, 1 - (sy - S.uv.oy)/S.uv.z];
function uvFit(){
  const p = cur(); if(!p) return;
  const dpr = devicePixelRatio, W = uvc.width/dpr, H = uvc.height/dpr, U = uvArr(p);
  let a = 0, b = 0, c = 1, d = 1;
  for(let i = 0; i < U.length; i += 2){ a = Math.min(a, U[i]); c = Math.max(c, U[i]); b = Math.min(b, U[i+1]); d = Math.max(d, U[i+1]); }
  const z = Math.min((W - 60)/(c - a), (H - 110)/(d - b));
  S.uv.z = z; S.uv.ox = (W - (c - a)*z)/2 - a*z; S.uv.oy = 70 + ((H - 110) - (d - b)*z)/2 - (1 - d)*z;
}
$('uvFit').onclick = () => { uvFit(); drawUV(); };
let uvRAF = 0;
function schedUV(){ if(!uvRAF) uvRAF = requestAnimationFrame(() => { uvRAF = 0; drawUV(); }); }
function drawUV(){
  if(!S.uv.on) return;
  const dpr = devicePixelRatio, W = uvc.width/dpr, H = uvc.height/dpr;
  uctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  uctx.fillStyle = '#121314'; uctx.fillRect(0, 0, W, H);
  const p = cur();
  if(!p){ uctx.fillStyle = '#8b918c'; uctx.font = '13px sans-serif'; uctx.fillText(t('msg.selpart'), 20, 90); return; }
  const z = S.uv.z;
  const t0x = Math.floor(-S.uv.ox/z), t1x = Math.ceil((W - S.uv.ox)/z), t0y = Math.floor(-S.uv.oy/z), t1y = Math.ceil((H - S.uv.oy)/z);
  uctx.imageSmoothingEnabled = z < p.W;
  for(let ty = t0y; ty < t1y; ty++) for(let tx = t0x; tx < t1x; tx++){
    if((t1x - t0x)*(t1y - t0y) > 64 && !(tx === 0 && ty === 0)) continue;
    uctx.globalAlpha = tx === 0 && ty === 0 ? 1 : 0.22;
    uctx.drawImage(p.canvas, S.uv.ox + tx*z, S.uv.oy + ty*z, z, z);
  }
  uctx.globalAlpha = 1;
  uctx.strokeStyle = 'rgba(200,178,115,.6)'; uctx.lineWidth = 1; uctx.strokeRect(S.uv.ox + .5, S.uv.oy + .5, z, z);
  const U = uvArr(p), isl = islands(p), nT = U.length/6, wire = new Path2D(), selp = new Path2D();
  for(let tr = 0; tr < nT; tr++){
    const path = S.uv.sel.has(tr) ? selp : wire;
    const [ax, ay] = toScr(U[tr*6], U[tr*6+1]), [bx, by] = toScr(U[tr*6+2], U[tr*6+3]), [cx, cy] = toScr(U[tr*6+4], U[tr*6+5]);
    path.moveTo(ax, ay); path.lineTo(bx, by); path.lineTo(cx, cy); path.closePath();
  }
  uctx.strokeStyle = 'rgba(255,255,255,.32)'; uctx.lineWidth = 0.6; uctx.stroke(wire);
  uctx.fillStyle = 'rgba(200,178,115,.28)'; uctx.fill(selp);
  uctx.strokeStyle = 'rgba(230,205,130,.95)'; uctx.lineWidth = 0.8; uctx.stroke(selp);
  const B = S.uv.box;
  if(B){ uctx.fillStyle = 'rgba(230,205,130,.10)'; uctx.strokeStyle = 'rgba(230,205,130,.9)'; uctx.lineWidth = 1; uctx.setLineDash([4, 3]);
    const x = Math.min(B.sx, B.x), y = Math.min(B.sy, B.y), w = Math.abs(B.x - B.sx), h = Math.abs(B.y - B.sy); uctx.fillRect(x, y, w, h); uctx.strokeRect(x + .5, y + .5, w, h); uctx.setLineDash([]); }
  if(S.uv.sel.size){ let n = 0; const seen = new Set(); for(const tr of S.uv.sel) if(!seen.has(isl.triIsl[tr])){ seen.add(isl.triIsl[tr]); n++; }
    $('uvinfo').textContent = t('uv.info.faces', S.uv.sel.size, n, t('uv.' + S.uv.mode).toLowerCase()); }
  else $('uvinfo').textContent = t(S.tool === 'wand' ? 'uv.info.wand' : 'uv.info', isl.count);
}
// Selection unit: one face (triangle) or its whole island
function uvUnit(p, tr){ if(S.uv.pick === 'face') return [tr]; const isl = islands(p); return isl.trisOf[isl.triIsl[tr]]; }
function uvClick(p, tr, add){
  const u = uvUnit(p, tr);
  if(!add){ S.uv.sel.clear(); for(const x of u) S.uv.sel.add(x); return; }
  if(u.every(x => S.uv.sel.has(x))) for(const x of u) S.uv.sel.delete(x); else for(const x of u) S.uv.sel.add(x);
}
function uvBoxSelect(p, B, add){
  const [ua, va] = toUV(B.sx, B.sy), [ub, vb] = toUV(B.x, B.y), u0 = Math.min(ua, ub), u1 = Math.max(ua, ub), v0 = Math.min(va, vb), v1 = Math.max(va, vb);
  const U = uvArr(p); if(!add) S.uv.sel.clear();
  for(let tr = 0; tr < U.length/6; tr++){
    const cu = (U[tr*6] + U[tr*6+2] + U[tr*6+4])/3, cv = (U[tr*6+1] + U[tr*6+3] + U[tr*6+5])/3;
    if(cu >= u0 && cu <= u1 && cv >= v0 && cv <= v1) for(const x of uvUnit(p, tr)) S.uv.sel.add(x);
  }
}
function uvLinked(){ const p = cur(); if(!p || !S.uv.sel.size) return; const isl = islands(p); for(const tr of [...S.uv.sel]) for(const x of isl.trisOf[isl.triIsl[tr]]) S.uv.sel.add(x); drawUV(); }
function setUVPick(m){ S.uv.pick = m; document.querySelectorAll('#uvPick button').forEach(b => b.classList.toggle('on', b.dataset.p === m)); drawUV(); }
document.querySelectorAll('#uvPick button').forEach(b => b.onclick = () => setUVPick(b.dataset.p));
$('uvLinked').onclick = uvLinked;
function triAt(p, u, v){
  const U = uvArr(p);
  for(let tr = U.length/6 - 1; tr >= 0; tr--){
    const ax = U[tr*6], ay = U[tr*6+1], bx = U[tr*6+2], by = U[tr*6+3], cx = U[tr*6+4], cy = U[tr*6+5];
    const d = (by - cy)*(ax - cx) + (cx - bx)*(ay - cy); if(Math.abs(d) < 1e-14) continue;
    const l1 = ((by - cy)*(u - cx) + (cx - bx)*(v - cy))/d, l2 = ((cy - ay)*(u - cx) + (ax - cx)*(v - cy))/d;
    if(l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) return tr;
  }
  return -1;
}
function selVerts(p){ const out = []; for(const tr of S.uv.sel) out.push(tr*3, tr*3 + 1, tr*3 + 2); return out; }
function pivotOf(p, verts){
  const U = uvArr(p); let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for(const v of verts){ a = Math.min(a, U[v*2]); c = Math.max(c, U[v*2]); b = Math.min(b, U[v*2+1]); d = Math.max(d, U[v*2+1]); }
  return [(a + c)/2, (b + d)/2];
}
function applyXf(p, uv0, verts, fn){
  const a = p.mesh.geometry.attributes.uv, U = a.array;
  U.set(uv0);
  for(const v of verts){ const [u, w] = fn(uv0[v*2], uv0[v*2+1]); U[v*2] = u; U[v*2+1] = w; }
  a.needsUpdate = true;
}
// Move the pixels of a raster (1 or 4 channels) along with the selected islands; returns a new array.
function carry(p, arr, ch, uv0){
  const W = p.W, H = p.H, U = uvArr(p), out = arr.slice();
  for(const tr of S.uv.sel){
    const o = [0, 1, 2].map(v => [uv0[(tr*3 + v)*2], uv0[(tr*3 + v)*2 + 1]]);
    E.rasterTri(W, H, U[tr*6]*W, (1 - U[tr*6+1])*H, U[tr*6+2]*W, (1 - U[tr*6+3])*H, U[tr*6+4]*W, (1 - U[tr*6+5])*H, (x, y, w0, w1, w2) => {
      let u = o[0][0]*w0 + o[1][0]*w1 + o[2][0]*w2, v = 1 - (o[0][1]*w0 + o[1][1]*w1 + o[2][1]*w2);
      u -= Math.floor(u); v -= Math.floor(v);
      const fx = u*W - 0.5, fy = v*H - 0.5; let xa = Math.floor(fx), ya = Math.floor(fy); const tx = fx - xa, ty = fy - ya;
      xa = (xa + W) % W; ya = (ya + H) % H; const xb = (xa + 1) % W, yb = (ya + 1) % H, k = (y*W + x)*ch;
      for(let c = 0; c < ch; c++) out[k + c] = (arr[(ya*W + xa)*ch + c]*(1 - tx) + arr[(ya*W + xb)*ch + c]*tx)*(1 - ty) + (arr[(yb*W + xa)*ch + c]*(1 - tx) + arr[(yb*W + xb)*ch + c]*tx)*ty;
    });
  }
  return out;
}
function finishXf(p, uv0){
  const U = uvArr(p);
  let changed = false; for(let i = 0; i < U.length; i++) if(U[i] !== uv0[i]){ changed = true; break; }
  if(!changed) return;
  flush(); pushStack(p, uv0);
  p.uvVer++; p.uvDirty = true; p.isl = null;
  if($('uvCarry').checked){
    p.layers = p.layers.map(cloneLayer);
    p.baseSrc = { w:p.W, h:p.H, data:carry(p, baseRaster(p), 4, uv0), id:BID++ };
    for(const L of p.layers){
      if(L.type === 'paint') L.raster = carry(p, L.raster, 4, uv0);
      if(L.mask){ if(L.maskGen && PARAM.has(L.maskGen.type) && !L.maskPainted) L._regen = true; else L.mask = carry(p, L.mask, 1, uv0); }
    }
    for(const L of p.layers) if(L._regen){ L.mask = makeMask(L.maskGen, p); delete L._regen; }
    p.sel = null;
  }
  refreshList(); after(p); drawUV();
}
function quickXf(fn){
  const p = cur(); if(!p) return;
  if(!S.uv.sel.size){ toast(t('msg.noisl')); return; }
  const uv0 = new Float32Array(uvArr(p)), verts = selVerts(p), [cx, cy] = pivotOf(p, verts);
  applyXf(p, uv0, verts, (u, v) => fn(u - cx, v - cy, cx, cy));
  finishXf(p, uv0);
}
$('uvR90').onclick = () => quickXf((x, y, cx, cy) => [cx - y, cy + x]);
$('uvFH').onclick = () => quickXf((x, y, cx, cy) => [cx - x, cy + y]);
$('uvFV').onclick = () => quickXf((x, y, cx, cy) => [cx + x, cy - y]);
$('uvAll').onclick = () => { const p = cur(); if(!p) return; S.uv.sel = new Set([...Array(uvArr(p).length/6).keys()]); drawUV(); };
function setUVMode(m){ S.uv.mode = m; document.querySelectorAll('#uvMode button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); drawUV(); }
document.querySelectorAll('#uvMode button').forEach(b => b.onclick = () => {setUVMode(b.dataset.m);if(b.dataset.m==='paint' && S.tool!=='erase')setTool('paint');});
uvc.addEventListener('contextmenu', e => e.preventDefault());
uvc.addEventListener('wheel', e => {
  e.preventDefault();
  const r = uvc.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top, f = Math.exp(-e.deltaY*0.0015);
  S.uv.ox = sx - (sx - S.uv.ox)*f; S.uv.oy = sy - (sy - S.uv.oy)*f; S.uv.z *= f; drawUV();
}, { passive:false });
let uvStroke=null;
uvc.addEventListener('lostpointercapture',()=>{uvStroke=null;});
uvc.addEventListener('pointerdown', e => {
  const p = cur(); if(!p) return;
  const r = uvc.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  uvc.setPointerCapture(e.pointerId);
  if(e.button !== 0){ S.uv.drag = { pan:true, sx, sy, ox:S.uv.ox, oy:S.uv.oy }; return; }
  const [u, v] = toUV(sx, sy);
  if(S.uv.mode==='seam'){
    const L=active(p);
    if(L?.type==='seam' && u>=0 && u<=1 && v>=0 && v<=1) editSeamPoint(p,L,[...L.points,[u,v]]);
    return;
  }
  if(S.uv.mode==='paint' && ['paint','erase'].includes(S.tool)){
    if(u<0 || u>=1 || v<=0 || v>1) return;
    flush();
    const T=resolveTarget(p);
    pushRaster(p,T.L,T.kind==='mask'?'mask':'raster');
    if(T.kind==='mask') T.L.maskPainted=true;
    uvStroke={p,T,erase:S.tool==='erase',last:null,pointer:e.pointerId};
    markDirty(p); seg(uvStroke,'last',u*p.W,(1-v)*p.H);
    return;
  }
  if(S.tool === 'wand'){ // select by colour straight on the texture
    const x = Math.floor((u - Math.floor(u))*p.W), y = Math.floor((1 - (v - Math.floor(v)))*p.H);
    flush(); wand(p, Math.min(p.W - 1, x), Math.min(p.H - 1, y), e.shiftKey ? 'add' : e.altKey ? 'sub' : 'new'); return;
  }
  const tr = triAt(p, u, v);
  if(S.uv.mode==='paint') return;
  if(tr < 0 || e.ctrlKey || e.metaKey){ S.uv.box = { sx, sy, x:sx, y:sy, add:e.shiftKey }; drawUV(); return; }
  if(e.shiftKey){ uvClick(p, tr, true); drawUV(); return; }
  if(!S.uv.sel.has(tr)) uvClick(p, tr, false);
  const verts = selVerts(p);
  S.uv.drag = { p, u, v, uv0:new Float32Array(uvArr(p)), verts, pivot:pivotOf(p, verts) };
  drawUV();
});
uvc.addEventListener('pointermove', e => {
  const r = uvc.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  if(uvStroke && uvStroke.pointer===e.pointerId){
    const [u,v]=toUV(sx,sy);
    if(u>=0 && u<1 && v>0 && v<=1) seg(uvStroke,'last',u*uvStroke.p.W,(1-v)*uvStroke.p.H);
    else uvStroke.last=null;
    return;
  }
  if(S.uv.box){ S.uv.box.x = sx; S.uv.box.y = sy; schedUV(); return; }
  const D = S.uv.drag; if(!D) return;
  if(D.pan){ S.uv.ox = D.ox + sx - D.sx; S.uv.oy = D.oy + sy - D.sy; drawUV(); return; }
  const [u, v] = toUV(sx, sy), [cx, cy] = D.pivot;
  let fn;
  if(S.uv.mode === 'move'){
    let du = u - D.u, dv = v - D.v;
    if(e.ctrlKey){ const st = 8/Math.max(D.p.W, D.p.H); du = Math.round(du/st)*st; dv = Math.round(dv/st)*st; }
    fn = (a, b) => [a + du, b + dv];
  } else if(S.uv.mode === 'rotate'){
    let ang = Math.atan2(v - cy, u - cx) - Math.atan2(D.v - cy, D.u - cx);
    if(e.ctrlKey) ang = Math.round(ang/(Math.PI/12))*(Math.PI/12);
    const c = Math.cos(ang), s = Math.sin(ang);
    fn = (a, b) => [cx + (a - cx)*c - (b - cy)*s, cy + (a - cx)*s + (b - cy)*c];
  } else {
    const k = Math.max(0.02, Math.hypot(u - cx, v - cy)/Math.max(1e-6, Math.hypot(D.u - cx, D.v - cy)));
    fn = (a, b) => [cx + (a - cx)*k, cy + (b - cy)*k];
  }
  applyXf(D.p, D.uv0, D.verts, fn);
  drawUV();
});
uvc.addEventListener('pointerup', () => {
  const B = S.uv.box; S.uv.box = null;
  if(B){ const p = cur(); if(p){ if(Math.hypot(B.x - B.sx, B.y - B.sy) < 3){ if(!B.add) S.uv.sel.clear(); } else uvBoxSelect(p, B, B.add); } drawUV(); return; }
  const D = S.uv.drag; S.uv.drag = null; if(D && !D.pan) finishXf(D.p, D.uv0);
});
let uvHover = false;
uvc.addEventListener('pointerenter', () => uvHover = true); uvc.addEventListener('pointerleave', () => uvHover = false);

// ============================================================ export
function pngBlob(rgba, W, H){
  const c = mkCanvas(W, H); c.getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0);
  return new Promise(res => c.toBlob(res, 'image/png'));
}
function grayRGBA(g, N){ const d = new Uint8ClampedArray(N*4); for(let i = 0; i < N; i++){ d[i*4] = d[i*4+1] = d[i*4+2] = g[i]; d[i*4+3] = 255; } return d; }
// The maps Roblox's SurfaceAppearance takes: ColorMap, NormalMap, RoughnessMap, MetalnessMap.
async function partFiles(p){
  const N = p.W*p.H, stem = p.info.diff.replace(/_diff\.png$/i, '').replace(/\.png$/i, '');
  let col = p.out;
  if(p.hasAlpha){ col = new Uint8ClampedArray(p.out); const b = baseRaster(p); for(let i = 3; i < N*4; i += 4) col[i] = b[i]; }
  const files = [{ name:p.info.diff, blob:await pngBlob(col, p.W, p.H) }];
  if(p.useH) files.push({ name:p.info.nmap || stem + '_nmap.png', blob:await pngBlob(p.outN, p.W, p.H) });
  else if(p.nmapImg){
    const c = mkCanvas(p.W,p.H);
    c.getContext('2d').drawImage(p.nmapImg,0,0,p.W,p.H);
    files.push({name:p.info.nmap || stem + '_nmap.png', blob:await new Promise(resolve=>c.toBlob(resolve))});
  }
  if(p.useR) files.push({ name:stem + '_rough.png', blob:await pngBlob(grayRGBA(p.outR, N), p.W, p.H) });
  if(p.useM) files.push({ name:stem + '_metal.png', blob:await pngBlob(grayRGBA(p.outM, N), p.W, p.H) });
  return files;
}
function objText(parts){
  const out = ['# Exported with TYC Painter', ''];
  let vo = 0, to = 0, no = 0;
  for(const p of parts){
    const g = p.mesh.geometry, P = g.attributes.position.array, U = g.attributes.uv ? g.attributes.uv.array : null, N = g.attributes.normal ? g.attributes.normal.array : null;
    const vs = new Map(), ts = new Map(), ns = new Map(), V = [], T = [], NN = [], F = [];
    const idx = (map, arr, k) => { let i = map.get(k); if(i === undefined){ i = arr.length; map.set(k, i); arr.push(k); } return i; };
    for(let i = 0; i < P.length/3; i++){
      const vi = idx(vs, V, `${P[i*3].toFixed(5)} ${P[i*3+1].toFixed(5)} ${P[i*3+2].toFixed(5)}`);
      const ti = U ? idx(ts, T, `${U[i*2].toFixed(6)} ${U[i*2+1].toFixed(6)}`) : -1;
      const ni = N ? idx(ns, NN, `${N[i*3].toFixed(4)} ${N[i*3+1].toFixed(4)} ${N[i*3+2].toFixed(4)}`) : -1;
      const tt = U ? String(ti + 1 + to) : '';
      F.push(N ? `${vi + 1 + vo}/${tt}/${ni + 1 + no}` : U ? `${vi + 1 + vo}/${tt}` : `${vi + 1 + vo}`);
    }
    out.push('g ' + p.name);
    for(const v of V) out.push('v ' + v);
    for(const x of T) out.push('vt ' + x);
    for(const n of NN) out.push('vn ' + n);
    for(let i = 0; i < F.length; i += 3) out.push(`f ${F[i]} ${F[i+1]} ${F[i+2]}`);
    out.push('');
    vo += V.length; to += T.length; no += NN.length;
  }
  return out.join('\n');
}
const F_PNG = [{ name:'PNG', extensions:['png'] }], F_OBJ = [{ name:'Wavefront OBJ', extensions:['obj'] }], F_ZIP = [{ name:'ZIP', extensions:['zip'] }], F_PROJ = [{ name:'TYC Painter', extensions:['mrtx'] }];
$('expOne').onclick = () => busy('st.exporting', async () => {
  const p = cur(); if(!p) return; flush();
  const files = await partFiles(p);
  if(files.length === 1) return saveBytes(files[0].name, files[0].blob, F_PNG);
  const zip = new JSZip(); for(const f of files) zip.file(f.name, f.blob);
  zip.file(t('exp.readmeName'), t('exp.readme'));
  await saveBytes(p.name + '_maps.zip', await zip.generateAsync({ type:'uint8array' }), F_ZIP);
});
$('expObjOne').onclick = () => { const p = S.parts.get(S.sel); if(!p) return; saveBytes(p.name + '.obj', new TextEncoder().encode(objText([p])), F_OBJ); };
$('expObjAll').onclick = () => saveBytes(S.model.name + '.obj', new TextEncoder().encode(objText([...S.parts.values()])), F_OBJ);
$('expAll').onclick = () => busy('st.exporting', async () => {
  flush();
  const zip = new JSZip(); let n = 0, uvn = 0;
  for(const p of S.parts.values()){
    if(p.editable && p.dirty){ for(const f of await partFiles(p)) zip.file(f.name, f.blob); n++; }
    if(p.uvDirty){ zip.file('meshes/' + p.name + '.obj', objText([p])); uvn++; }
  }
  if(!n && !uvn){ toast(t('msg.nochange')); return; }
  zip.file(t('exp.readmeName'), t('exp.readme'));
  await saveBytes('retexture-' + S.model.name + '.zip', await zip.generateAsync({ type:'uint8array' }), F_ZIP);
});

// ============================================================ project files (.mrtx = zip with JSON + raw buffers)
const LAYER_KEYS = ['parentId','decalWidth','points','pitch','threadWidth','surfacePaint','id', 'type', 'name', 'visible', 'opacity', 'blend', 'ch', 'rough', 'metal', 'height', 'maskGen', 'maskPainted', 'proj', 'filter', 'wrap', 'tiling', 'sx', 'sy', 'rot', 'offX', 'offY', 'con', 'sat', 'bri', 'hue', 'match', 'color', 'real'];
async function projectZip(){
  flush();
  const zip = new JSZip(), mats = {}, pngs = [], proj = { app:'tyc-painter', version:3, model:{ kind:S.model.kind, name:S.model.name, main:S.model.main || null, files:[] }, parts:{}, mats };
  if(S.model.kind === 'import') for(const f of S.model.files){ const n = 'model/' + f.name; zip.file(n, f.data, { compression:'STORE' }); proj.model.files.push(n); }
  const bin = (name, arr) => { zip.file(name, new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength).slice()); return name; };
  const matRef = M => {
    if(M.builtin) return { builtin:M.builtin };
    if(!mats[M.id]){
      const o = { kind:M.kind, name:M.name, type:M.type, colors:M.colors, seed:M.seed, realTiling:M.realTiling, digital:M.digital, gray:M.gray, tactical:M.tactical };
      if(M.kind === 'image'){ o.src = `m/${M.id}.png`; pngs.push([o.src, M.src]); if(M.roughSrc){ o.rough = `m/${M.id}_rough.png`; pngs.push([o.rough, M.roughSrc]); } if(M.heightSrc){o.height=`m/${M.id}_height.png`;pngs.push([o.height,M.heightSrc]);} }
      mats[M.id] = o;
    }
    return { id:M.id };
  };
  for(const p of S.parts.values()){
    if(!p.editable || !(p.dirty || p.uvDirty)) continue;
    const pd = { W:p.W, H:p.H, activeId:p.activeId, layers:[], optics:p.optics, uvDirty:p.uvDirty };
    if(p.uvDirty) pd.uv = bin(`p/${p.name}/uv.f32`, uvArr(p));
    if(p.baseSrc !== p.baseSrc0) pd.base = { w:p.baseSrc.w, h:p.baseSrc.h, file:bin(`p/${p.name}/base.rgba`, p.baseSrc.data) };
    for(const L of p.layers){
      const o = {}; for(const k of LAYER_KEYS) if(L[k] !== undefined) o[k] = L[k];
      if(L.type === 'fill' || L.type==='decalUV') o.mat = matRef(L.mat);
      if(L.type === 'paint') o.raster = bin(`p/${p.name}/l${L.id}.rgba`, L.raster);
      if(L.mask) o.mask = bin(`p/${p.name}/l${L.id}.mask`, L.mask);
      pd.layers.push(o);
    }
    proj.parts[p.name] = pd;
  }
  for(const [name, src] of pngs) zip.file(name, await pngBlob(new Uint8ClampedArray(src.data.buffer, src.data.byteOffset, src.w*src.h*4), src.w, src.h), { compression:'STORE' });
  zip.file('project.json', JSON.stringify(proj));
  return zip.generateAsync({ type:'uint8array', compression:'DEFLATE', compressionOptions:{ level:3 } });
}
async function loadProject(buf){
  const zip = await JSZip.loadAsync(buf), proj = JSON.parse(await zip.file('project.json').async('string'));
  if(proj.app !== 'tyc-painter' && proj.app !== 'milsim-retexturer') throw new Error(t('msg.badproj'));
  checkProject(proj,zip);
  const u8 = async f => zip.file(f).async('uint8array');
  const mats = {};
  for(const [id, o] of Object.entries(proj.mats || {})){
    let M;
    if(o.kind === 'camo') M = camoMat(o.type, o.colors, o.seed);
    else if(o.kind === 'solid') M = solidMat();
    else {
      const img = async f => E.srcFromImage(await createImageBitmap(new Blob([await u8(f)], { type:'image/png' })), 8192);
      const src = await img(o.src);
      M = mkMat({ kind:'image', src, thumb:E.srcThumb(src), realTiling:o.realTiling, digital:o.digital, gray:o.gray, tactical:o.tactical });
      if(o.rough) M.roughSrc = await img(o.rough); if(o.height) M.heightSrc=await img(o.height);
    }
    M.name = o.name; mats[id] = M;
  }
  // the project carries its model: reopen it unless it is the one already loaded
  const pm = proj.model && typeof proj.model === 'object' ? proj.model : { kind:'builtin' };
  if(pm.kind === 'import'){
    const files = []; for(const n of pm.files) files.push({ name:n.slice(6), data:(await u8(n)).slice().buffer });
    await openModelFiles(files, pm.main);
  } else if(S.model.kind !== 'builtin') await loadHelmet();
  S.undo.length = S.redo.length = 0;
  for(const p of S.parts.values()){
    if(!p.editable) continue;
    const pd = proj.parts[p.name];
    setUV(p, p.uvOrig); p.uvVer++; p.isl = null; p.sel = null; p.baseSrc = p.baseSrc0; p.uvDirty = false; p.dirty = false;
    const base = cloneLayer(p.layers[0]); base.visible = true; base.opacity = 1; base.raster = null; base._rk = null;
    p.layers = [base]; p.W = p.W0; p.H = p.H0;
    setOptics(p,pd?.optics || p.defaultOptics);
    if(pd){
      p.W = pd.W; p.H = pd.H; p.uvDirty = !!pd.uvDirty; p.dirty = true;
      if(pd.uv){ const d = await u8(pd.uv); setUV(p, new Float32Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength))); }
      if(pd.base){ const d = await u8(pd.base.file); p.baseSrc = { w:pd.base.w, h:pd.base.h, data:new Uint8ClampedArray(d.buffer, d.byteOffset, d.byteLength), id:BID++ }; }
      p.layers = [];
      for(const o of pd.layers){
        const L = mkLayer(o.type, {}); for(const k of LAYER_KEYS) if(o[k] !== undefined) L[k] = o[k];
        if(o.type === 'fill' || o.type==='decalUV') L.mat = o.mat.builtin ? (o.mat.builtin === 'shade' ? SHADE : o.mat.builtin === 'orig' ? ORIG : DETAIL[o.mat.builtin]) : mats[o.mat.id];
        if(o.raster){ const d = await u8(o.raster); L.raster = new Uint8ClampedArray(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength)); }
        if(o.mask){ const d = await u8(o.mask); L.mask = new Uint8Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength)); }
        LID = Math.max(LID, L.id + 1); p.layers.push(L);
      }
      p.activeId = pd.activeId;
    } else p.activeId = base.id;
    allocOut(p); recomposite(p);
  }
  refreshList(); select(S.sel); if(S.uv.on) drawUV();
}
async function readDropped(fileList){
  const fs = [...fileList];
  const proj = fs.find(f => /\.mrtx$/i.test(f.name));
  if(proj) return busy('st.loading', async () => { await loadProject(await proj.arrayBuffer()); toast(t('msg.loaded')); });
  const m = fs.find(f => MODEL_FILE.test(f.name)); if(!m){ toast(t('msg.dropwhat')); return; }
  await busy('st.importing', async () => {
    let res = null;
    // a single dropped .obj/.fbx/.gltf: let the desktop side collect the MTL and textures next to it
    if(DESK && fs.length === 1){ res = await DESK.readDroppedModel(m); }
    if(!res) res = { main:m.name, files:await Promise.all(fs.map(async f => ({ name:f.name, data:await f.arrayBuffer() }))) };
    await openModelFiles(res.files, res.main);
  });
}
$('modelOpen').onclick = async () => {
  if(DESK){ const res = await DESK.openModel(); if(res) await busy('st.importing', () => openModelFiles(res.files, res.main)); }
  else { const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.obj,.mtl,.zip,.glb,.gltf,.bin,.fbx,image/*'; inp.onchange = () => readDropped(inp.files); inp.click(); }
};
$('modelHelmet').onclick = () => busy('st.importing', loadHelmet);
addEventListener('dragover', e => { if(!e.dataTransfer.types.includes('Files'))return; e.preventDefault(); document.body.classList.add('dropping'); });
addEventListener('dragleave', e => { if(!e.relatedTarget) document.body.classList.remove('dropping'); });
addEventListener('drop', e => {
  e.preventDefault(); document.body.classList.remove('dropping');
  const fl = e.dataTransfer.files; if(!fl.length) return;
  if(!$('patchStudio').hidden){ if(/\.(png|jpe?g|webp)$/i.test(fl[0].name)) PATCH.loadImage(fl[0]); return; }
  readDropped(fl);
});
$('projSave').onclick = () => busy('st.saving', async () => saveBytes('project.mrtx', await projectZip(), F_PROJ));
$('projOpen').onclick = async () => {
  let buf = null;
  if(DESK){ const f = (await DESK.openFiles(F_PROJ, false))[0]; if(f) buf = f.data; }
  else buf = await new Promise(res => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.mrtx'; inp.onchange = async () => res(inp.files[0] ? await inp.files[0].arrayBuffer() : null); inp.click(); });
  if(!buf) return;
  await busy('st.loading', async () => { await loadProject(buf); toast(t('msg.loaded')); });
};

// ============================================================ compare, shortcuts, language
const cmp = $('cmp');
function showOrig(on){
  const p = cur(); if(!p) return; flush();
  if(on){
    p.ctx.putImageData(new ImageData(baseRaster(p), p.W, p.H), 0, 0); p.tex.needsUpdate = true;
    const m=p.mat;
    m.normalMap=p.texN0 || null;
    m.roughnessMap=m.metalnessMap=null;
    m.roughness=p.baseRough; m.metalness=p.baseMetal;
    if(p.ormImg && (p.originalR || p.originalM || p.originalAO)){
      const d=p.ormImg.data;
      for(let i=0;i<p.W*p.H;i++){
        d[i*4]=p.originalAO?.[i]??255;
        d[i*4+1]=p.originalR?.[i]??Math.round(p.baseRough*255);
        d[i*4+2]=p.originalM?.[i]??Math.round(p.baseMetal*255);
      }
      p.ctxORM.putImageData(p.ormImg,0,0);p.texORM.needsUpdate=true;
      m.roughnessMap=m.metalnessMap=p.texORM;m.roughness=m.metalness=1;
    }
    m.needsUpdate=true;
  } else present(p);
}
cmp.addEventListener('pointerdown', () => showOrig(true));
for(const ev of ['pointerup', 'pointerleave']) cmp.addEventListener(ev, () => showOrig(false));
addEventListener('keydown', e => {
  if(e.target.matches('input[type=text],input[type=search],input[type=number],select,textarea')) return;
  if(!$('patchStudio').hidden || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if(mod && k === 'z'){ e.preventDefault(); e.shiftKey ? swapState(S.redo, S.undo) : swapState(S.undo, S.redo); return; }
  if(mod && k === 'y'){ e.preventDefault(); swapState(S.redo, S.undo); return; }
  if(mod && e.shiftKey && k==='e'){e.preventDefault();$('textureExport').click();return;}
  if(mod && k === 's'){ e.preventDefault(); $('projSave').click(); return; }
  if(mod || e.altKey) return;
  if(uvHover && S.uv.on){ const m = { g:'move', r:'rotate', s:'scale' }[k]; if(m){ setUVMode(m); return; } if(k === 'a'){ $('uvAll').click(); return; } if(k === '1'){ setUVPick('island'); return; } if(k === '2'){ setUVPick('face'); return; } if(k === 'l'){ uvLinked(); return; } }
  if(k==='tab'){e.preventDefault();$('focusView').click();return;}
  const action=keyAction(k);
  const viewKey={split:'f1',view3D:'f2',viewUV:'f3'}[action];
  if(viewKey){e.preventDefault();setWorkspaceView(viewKey);return;}
  if(action==='material' || action==='channel'){
    const v=$('viewMode');
    v.selectedIndex=action==='material'?0:(v.selectedIndex+1)%v.options.length;
    v.dispatchEvent(new Event('change'));return;
  }
  if(['paint','erase','fill','orbit','pick','wand','decal'].includes(action)) setTool(action);
  if(k==='4')setTool('fill');
  if(action==='frame')frame();
  if(k === 'x'){ S.maskWhite = !S.maskWhite; syncTargetUI(); }
  if(k === '[' || k === ']'){ $('bSize').value = Math.max(2, Math.min(300, +$('bSize').value + (k === '[' ? -5 : 5))); syncVals(); }

  if(k === 'u') $('uvBtn').click();
});
function relabel(){
  applyI18n(document); autoTranslate();
  document.documentElement.lang = getLang(); document.title = t('app.title');
  document.querySelectorAll('#lang button').forEach(b => b.classList.toggle('on', b.dataset.l === getLang()));
  $('toolhint').textContent = t('tool.' + S.tool + '.hint');
  if(!S.decal.src) $('decalName').textContent = t('decal.none');
  if(S.parts.size){
    for(const p of S.parts.values()) if(p.editable) for(const L of p.layers) if(L.type === 'fill' && L.mat.kind === 'shade') L.name = L.name || t('layer.shade');
    buildLibrary(); refreshList(); select(S.sel); renderCamo(); resetStatus();
  }
  syncVals(); syncTargetUI();
  if(typeof PATCH !== 'undefined' && PATCH) PATCH.relabel();
}
// ============================================================ Patch Creator
let PATCH = null;
{
  const toastHome = $('toast').parentElement;
  PATCH = initPatchStudio({
    toast, saveBytes, netJSON, netBlob,
    openModelFiles: (files, main) => busy('st.importing', () => openModelFiles(files, main)),
    onClose: () => { toastHome.appendChild($('toast')); kick3d && kick3d(); },
  });
  $('patchOpen').onclick = () => { document.querySelector('#patchStudio .pcStage').appendChild($('toast')); PATCH.open(); };
}
document.querySelectorAll('#lang button').forEach(b => b.onclick = () => { setLang(b.dataset.l); relabel(); });

function quickMask(p,L,type){flush();pushStack(p);setMaskGen(p,L,type);setTarget(L.mask?'mask':'content');after(p);}
function setWorkspaceView(k){const split=k!=='f2';if(S.uv.on!==split)$('uvBtn').click();$('views').classList.toggle('uv-only',k==='f3');requestAnimationFrame(resize);}
function showMenu(x,y,items){document.querySelector('.workmenu')?.remove();const menu=document.createElement('div');menu.className='workmenu';for(const [name,fn] of items){const b=document.createElement('button');b.textContent=name;b.onclick=()=>{menu.remove();fn();};menu.append(b);}document.body.append(menu);menu.style.left=Math.max(0,Math.min(x,innerWidth-menu.offsetWidth))+'px';menu.style.top=Math.max(0,Math.min(y,innerHeight-menu.offsetHeight))+'px';}
function setupWorkspace(){const left=document.querySelector('#app > .left'),right=document.querySelector('#app > .right'),tools=$('tools'),toolSection=tools.closest('section');$('textureDock').append($('parts').closest('section'));const rail=document.createElement('nav');rail.id='toolRail';rail.setAttribute('aria-label','Painting tools');rail.append(tools);$('app').prepend(rail);left.querySelector('header').after(toolSection);
const menus=[['File',[['Open model','modelOpen'],['Open project','projOpen'],['Save project','projSave'],['Recover autosave','recoverProject'],['Export textures…','textureExport'],['Export changed sets','expAll']]],['Edit',[['Undo','undo'],['Redo','redo']]],['View',[['Frame','frame'],['Toggle UV','uvBtn'],['Focus mode','focusView']]],['Mode',[['Patch Studio','patchOpen'],['Bake Mesh Maps…','meshBake']]],['Window',[['Focus','focusView'],['Full screen','fullWindow'],['Reset panels','resetLayout']]],['Help',[['Keyboard shortcuts…','keyHelp']]]];for(const [name,entries] of menus){const b=document.createElement('button');b.textContent=name;b.onclick=()=>{const r=b.getBoundingClientRect();showMenu(r.left,r.bottom,entries.map(([n,id])=>[n,()=>$(id).click()]));};$('workmenus').append(b);}
$('focusView').onclick=()=>{document.body.classList.toggle('focus-workspace');requestAnimationFrame(resize);};const model=$('modelName');new MutationObserver(()=>{$('workspaceModel').textContent=model.textContent;}).observe(model,{childList:true,subtree:true,characterData:true});$('workspaceModel').textContent=model.textContent;const search=$('assetSearch');function filter(){const q=search.value.trim().toLowerCase();document.querySelectorAll('#shelf .mat').forEach(tile=>tile.classList.toggle('asset-filtered',!tile.textContent.toLowerCase().includes(q)));}search.oninput=filter;new MutationObserver(filter).observe($('shelf'),{childList:true,subtree:true});
function splitter(parent,cls,axis,fn){const d=document.createElement('div');d.className='splitter '+cls;parent.append(d);d.onpointerdown=e=>{e.preventDefault();d.setPointerCapture(e.pointerId);d.onpointermove=m=>fn(axis==='x'?m.clientX:m.clientY);d.onpointerup=d.onpointercancel=()=>{d.onpointermove=null;storeLayout();};};}
splitter(left,'left-split','x',x=>document.documentElement.style.setProperty('--work-left',Math.max(190,Math.min(400,x-46))+'px'));splitter(right,'right-split','x',x=>document.documentElement.style.setProperty('--work-right',Math.max(260,Math.min(520,innerWidth-x))+'px'));splitter($('shelf'),'shelf-split','y',y=>document.documentElement.style.setProperty('--work-shelf',Math.max(120,Math.min(innerHeight*.55,innerHeight-y))+'px'));addEventListener('pointerdown',e=>{if(!e.target.closest('.workmenu,#workmenus'))document.querySelector('.workmenu')?.remove();});}
const recovery = DESK && recoveryController({zip:projectZip,write:DESK.snapshot,warn:message=>toast('Autosave: '+message)});
const openOutput=setupOutput({parts:()=>S.parts.values(),current:cur,flush,saveBytes,pngBlob,grayRGBA,baseRaster});
$('textureExport').onclick=()=>openOutput('export');
$('meshBake').onclick=()=>openOutput('bake');
$('recoverProject').onclick=()=>busy('st.loading',async()=>{
  const bytes=await DESK?.recover();
  if(bytes) await loadProject(bytes); else toast(getLang()==='es'?'Todavía no hay copia de recuperación':'No recovery snapshot yet');
});
const keyAction=configureKeys($('quickKeys'));
const layoutProperties=['--work-left','--work-right','--work-shelf'];
function storeLayout(){
  const style=document.documentElement.style;
  localStorage.setItem('tyc-workspace-dimensions',JSON.stringify(layoutProperties.map(key=>style.getPropertyValue(key))));
}
try{
  const values=JSON.parse(localStorage.getItem('tyc-workspace-dimensions') || '[]');
  layoutProperties.forEach((key,i)=>{if(/^\d+(\.\d+)?px$/.test(values[i])) document.documentElement.style.setProperty(key,values[i]);});
}catch{}
$('fullWindow').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
$('resetLayout').onclick=()=>{for(const key of layoutProperties)document.documentElement.style.removeProperty(key);storeLayout();resize();};
$('keyHelp').onclick=()=>$('quickKeys').showModal();
setupWorkspace();relabel();

// Render on demand: only when something changed (saves CPU/GPU), plus a slow keep-alive.
function kick3d(){ needs3d = true; }
controls.addEventListener('change', kick3d);
for(const ev of ['pointermove', 'pointerdown', 'pointerup', 'wheel', 'keydown', 'input', 'change', 'click', 'resize']) addEventListener(ev, kick3d, true);
const tick = () => {
  const moved = controls.update(), now = performance.now();
  if(moved || needs3d || now - last3d > 300){ needs3d = false; last3d = now; renderer.render(scene, camera); }
};
renderer.setAnimationLoop(tick);
load().catch(err => { $('ltext').textContent = 'Error: ' + err.message; console.error(err); });

// test / showcase hook (no effect on normal use)
window.__app = { get PATCH(){ return PATCH; }, uvClick, uvBoxSelect, uvLinked, setUVPick, addOrig, wand, setMaskGen, baseRaster, drawUV, toUV, triAt, islands, toScr, busy, openModelFiles, loadHelmet, THREE, E, S, scene, camera, controls, renderer, grid, frame, select, cur, active, applyMaterial, setRes, recomposite, flush, projectZip, loadProject, partFiles, addSmart, SMART, DETAIL, mkMat, setTool, swapState, t, setLang, relabel };
