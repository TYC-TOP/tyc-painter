// TYC Painter — Patch Creator.
// Builds a patch mesh (front, bevel/merrow edge, hook back) and its PBR maps (colour, normal, roughness)
// from a type preset (callsign, embroidered, PVC, laser-cut), a shape, and text or an image.
// Everything is generated procedurally here; no reference textures are bundled.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/GLTFExporter.js';
import { t } from './i18n.js';
import { dataPNG } from './materials/png.js';

// ------------------------------------------------------------------ fonts (SIL OFL, see fonts/FONTS-LICENSE.txt)
export const FONTS = {
  ir:       { label:'IR Stencil',      family:'TYC IR Stencil',      file:'fonts/ir-stencil.woff2',      bold:0 },
  narrow:   { label:'Tactical Narrow', family:'TYC Tactical Narrow', file:'fonts/tactical-narrow.woff2', bold:0 },
  operator: { label:'Operator',        family:'TYC Operator',        file:'fonts/operator.woff2',        bold:0.055 },
  block:    { label:'Block',           family:'TYC Block',           file:'fonts/block.woff2',           bold:0 },
  army:     { label:'Army Stencil',    family:'TYC Army Stencil',    file:'fonts/army-stencil.woff2',    bold:0 },
};
let fontsReady = null;
function loadFonts(){
  if(!fontsReady) fontsReady = Promise.all(Object.values(FONTS).map(async f => {
    try{ const ff = new FontFace(f.family, `url(${f.file})`); await ff.load(); document.fonts.add(ff); } catch(e){ console.warn('font', f.file, e); }
  }));
  return fontsReady;
}

// ------------------------------------------------------------------ presets
// Sizes are in studs. Callsign and laser-cut sizes follow common Roblox MilSim patches.
export const TYPES = {
  callsign:    { w:0.462, h:0.293, t:0.014, edge:0.0025, shape:'rect',  font:'ir',     bg:'#323334', fg:'#c6c6c6', ed:'#262728', ir:true,  stitch:true,  border:0.045, textH:0.50, depth:0.9, relief:1.0, rough:[0.76, 0.58], weave:1.0 },
  embroidered: { w:0.42,  h:0.27,  t:0.010, edge:0.0085, shape:'round', font:'block',  bg:'#151515', fg:'#d9d9d6', ed:'#151515', ir:false, stitch:false, border:0.05,  textH:0.50, depth:1.0, relief:1.0, rough:[0.82, 0.55], weave:1.0 },
  pvc:         { w:0.40,  h:0.26,  t:0.020, edge:0.004,  shape:'round', font:'block',  bg:'#262826', fg:'#cfc8b2', ed:'#cfc8b2', ir:false, stitch:false, border:0.05,  textH:0.48, depth:1.0, relief:1.0, rough:[0.62, 0.56], weave:1.0 },
  lasercut:    { w:0.338, h:0.215, t:0.006, edge:0.0015, shape:'rect',  font:'narrow', bg:'#4a4c3f', fg:'#1d1e1a', ed:'#1d1e1a', ir:false, stitch:true,  border:0.07,  textH:0.56, depth:0.6, relief:1.0, rough:[0.80, 0.74], weave:1.0 },
};
export const SWATCHES = [
  ['#1c1d1e', 'Black'], ['#323334', 'Wolf grey'], ['#3d4434', 'Ranger green'], ['#4f5136', 'OD green'], ['#6e5b42', 'Coyote'],
  ['#a8916b', 'Tan'], ['#1f2533', 'Navy'], ['#c6c6c6', 'IR grey'], ['#d9d9d6', 'White'], ['#9a2a22', 'Red'], ['#c9a43a', 'Gold'],
];
export function defaults(type = 'callsign'){
  const T = TYPES[type];
  return { mode:'auto', type, shape:T.shape, content:'text', text:'VIPER', font:T.font,
    bg:T.bg, fg:T.fg, ed:T.ed, ir:T.ir, stitch:T.stitch,
    w:T.w, h:T.h, t:T.t, edge:T.edge, border:T.border, textH:T.textH, spacing:0, textY:0, depth:T.depth, relief:T.relief,
    roughBg:T.rough[0], roughFg:T.rough[1], weave:T.weave, seed:7, res:1024,
    img:null, imgName:'', imgMono:false, imgInvert:false, imgKnock:true, img3d:false, imgFit:'fill', custom:null, zones:defaultZones(type) };
}
export function applyType(P, type){
  const T = TYPES[type], keep = { mode:P.mode, content:P.content, text:P.text, img:P.img, imgName:P.imgName, imgMono:P.imgMono, imgInvert:P.imgInvert, imgKnock:P.imgKnock, img3d:P.img3d, imgFit:P.imgFit, res:P.res, seed:P.seed, custom:P.custom };
  const Q = Object.assign(defaults(type), keep, { type, font:T.font });
  if(P.shape === 'custom' && P.custom){ Q.shape = 'custom'; customSize(Q); }
  return Q;
}

// ------------------------------------------------------------------ small helpers
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const u = clamp((x - a)/(b - a), 0, 1); return u*u*(3 - 2*u); };
const frac = x => x - Math.floor(x);
const hex2 = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255)/255, (n >> 8 & 255)/255, (n & 255)/255]; };
function rng(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let q = Math.imul(a ^ a >>> 15, 1 | a); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0)/4294967296; }; }
// value noise (tileable not needed)
function makeNoise(seed){
  const R = rng(seed), N = 256, tab = new Float32Array(N*N); for(let i = 0; i < N*N; i++) tab[i] = R();
  const at = (x, y) => tab[((y & 255) << 8) | (x & 255)];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx*fx*(3 - 2*fx), sy = fy*fy*(3 - 2*fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a)*sx + (c - a)*sy + (a - b - c + d)*sx*sy; };
}
function boxBlur(src, W, H, r, x0 = 0, y0 = 0, x1 = W, y1 = H){
  if(r < 1) return src.slice();
  const out = src.slice(), tmp = src.slice();
  for(let pass = 0; pass < 2; pass++){
    for(let y = y0; y < y1; y++){ let acc = 0, n = 0; const row = y*W;
      for(let x = x0 - r; x < x1; x++){
        const xa = x + r; if(xa < x1){ acc += out[row + xa]; n++; }
        const xr = x - r - 1; if(xr >= x0){ acc -= out[row + xr]; n--; }
        if(x >= x0) tmp[row + x] = acc/n;
      } }
    for(let x = x0; x < x1; x++){ let acc = 0, n = 0;
      for(let y = y0 - r; y < y1; y++){
        const ya = y + r; if(ya < y1){ acc += tmp[ya*W + x]; n++; }
        const yr = y - r - 1; if(yr >= y0){ acc -= tmp[yr*W + x]; n--; }
        if(y >= y0) out[y*W + x] = acc/n;
      } }
  }
  return out;
}

// ------------------------------------------------------------------ custom shape: outline traced from an image
// Returns { pts:[[x,y]] in a unit box (-0.5..0.5, y up), crop:[x, y, w, h] in image pixels, aspect:w/h } or null.
export function silhouette(img){
  const S = 640, k = Math.min(1, S/Math.max(img.width, img.height)), pad = 3;
  const W = Math.max(8, Math.round(img.width*k)) + 2*pad, H = Math.max(8, Math.round(img.height*k)) + 2*pad;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently:true }); g.drawImage(img, pad, pad, W - 2*pad, H - 2*pad);
  const d = g.getImageData(0, 0, W, H).data, N = W*H;
  const at = (x, y) => (y*W + x)*4;
  const cs = [[pad, pad], [W - pad - 1, pad], [pad, H - pad - 1], [W - pad - 1, H - pad - 1]];
  const useAlpha = cs.some(([x, y]) => d[at(x, y) + 3] < 128);
  const bgc = [0, 1, 2].map(j => cs.reduce((t2, [x, y]) => t2 + d[at(x, y) + j], 0)/4);
  const fg = new Uint8Array(N);
  for(let i = 0; i < N; i++){
    const a = d[i*4 + 3];
    if(useAlpha) fg[i] = a > 128 ? 1 : 0;
    else fg[i] = a > 128 && (Math.abs(d[i*4] - bgc[0]) + Math.abs(d[i*4 + 1] - bgc[1]) + Math.abs(d[i*4 + 2] - bgc[2])) > 60 ? 1 : 0;
  }
  // background = everything not in the drawing that touches the border; holes inside the drawing stay part of the patch
  const bg = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
  const seed = i => { if(!bg[i] && !fg[i]){ bg[i] = 1; q[qt++] = i; } };
  for(let x = 0; x < W; x++){ seed(x); seed((H - 1)*W + x); }
  for(let y = 0; y < H; y++){ seed(y*W); seed(y*W + W - 1); }
  while(qh < qt){ const i = q[qh++], x = i % W, y = (i/W) | 0;
    if(x > 0) seed(i - 1); if(x < W - 1) seed(i + 1); if(y > 0) seed(i - W); if(y < H - 1) seed(i + W); }
  // largest connected piece of the inside
  const lab = new Int32Array(N); let best = 0, bestN = 0, cur = 0;
  for(let s0 = 0; s0 < N; s0++){
    if(bg[s0] || lab[s0]) continue;
    cur++; let n = 0; qh = qt = 0; q[qt++] = s0; lab[s0] = cur;
    while(qh < qt){ const i = q[qh++], x = i % W, y = (i/W) | 0; n++;
      const push = j => { if(!bg[j] && !lab[j]){ lab[j] = cur; q[qt++] = j; } };
      if(x > 0) push(i - 1); if(x < W - 1) push(i + 1); if(y > 0) push(i - W); if(y < H - 1) push(i + W); }
    if(n > bestN){ bestN = n; best = cur; }
  }
  if(bestN < N*0.02 || bestN > N*0.985) return null;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && lab[y*W + x] === best;
  // Moore-neighbour contour tracing
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  let sx = -1, sy = -1;
  outer: for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(inside(x, y)){ sx = x; sy = y; break outer; }
  const pts = []; let cx = sx, cy = sy, back = 4, guard = 0;
  do{
    pts.push([cx, cy]);
    let found = false;
    for(let kk = 1; kk <= 8; kk++){
      const di = (back + kk) % 8, nx = cx + D[di][0], ny = cy + D[di][1];
      if(inside(nx, ny)){
        const pd = (back + kk - 1) % 8, px = cx + D[pd][0], py = cy + D[pd][1];
        cx = nx; cy = ny;
        back = D.findIndex(v => v[0] === px - cx && v[1] === py - cy); if(back < 0) back = (di + 4) % 8;
        found = true; break;
      }
    }
    if(!found) break;
  } while(!(cx === sx && cy === sy) && ++guard < 200000);
  if(pts.length < 12) return null;
  // smooth, then simplify (Ramer–Douglas–Peucker on the closed loop)
  const n = pts.length, sm = pts.map((_, i) => { let ax = 0, ay = 0; for(let j = -2; j <= 2; j++){ const p = pts[(i + j + n) % n]; ax += p[0]; ay += p[1]; } return [ax/5, ay/5]; });
  const rdp = (P2, eps) => {
    if(P2.length < 3) return P2;
    const [a, b] = [P2[0], P2[P2.length - 1]]; let dm = 0, im = 0;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
    for(let i = 1; i < P2.length - 1; i++){ const dd = Math.abs((b[0] - a[0])*(a[1] - P2[i][1]) - (a[0] - P2[i][0])*(b[1] - a[1]))/L; if(dd > dm){ dm = dd; im = i; } }
    if(dm <= eps) return [a, b];
    const l = rdp(P2.slice(0, im + 1), eps), r = rdp(P2.slice(im), eps);
    return l.slice(0, -1).concat(r);
  };
  const half = n >> 1;
  let eps = 0.6, simp;
  do{ simp = rdp(sm.slice(0, half + 1), eps).slice(0, -1).concat(rdp(sm.slice(half).concat([sm[0]]), eps).slice(0, -1)); eps *= 1.4; } while(simp.length > 320);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(const [x, y] of simp){ x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  return {
    pts:simp.map(([x, y]) => [(x - x0)/bw - 0.5, 0.5 - (y - y0)/bh]),
    crop:[(x0 - pad)/k, (y0 - pad)/k, bw/k, bh/k], aspect:bw/bh,
  };
}
// Sets a size for a traced shape: longest side 0.38 studs, keeping the drawing's proportions.
export function customSize(P){
  if(!P.custom) return;
  const L = 0.38, a = P.custom.aspect;
  if(a >= 1){ P.w = L; P.h = L/a; } else { P.h = L; P.w = L*a; }
}

// ------------------------------------------------------------------ shapes (studs, centred, counter-clockwise, y up)
function outline(shape, w, h, custom){
  const pts = [];
  if(shape === 'custom' && !custom) shape = 'round';
  const rrect = (r, seg) => {
    r = Math.min(r, w/2 - 1e-5, h/2 - 1e-5);
    const cs = [[w/2 - r, h/2 - r, 0], [-w/2 + r, h/2 - r, 90], [-w/2 + r, -h/2 + r, 180], [w/2 - r, -h/2 + r, 270]];
    for(const [cx, cy, a0] of cs) for(let i = 0; i <= seg; i++){ const a = (a0 + 90*i/seg)*Math.PI/180; pts.push([cx + r*Math.cos(a), cy + r*Math.sin(a)]); }
  };
  const m = Math.min(w, h);
  if(shape === 'rect') rrect(m*0.045, 4);
  else if(shape === 'round') rrect(m*0.2, 10);
  else if(shape === 'custom') for(const [x, y] of custom.pts) pts.push([x*w, y*h]);
  else if(shape === 'circle' || shape === 'oval'){ const n = 120; for(let i = 0; i < n; i++){ const a = 2*Math.PI*i/n; pts.push([w/2*Math.cos(a), h/2*Math.sin(a)]); } }
  else if(shape === 'shield'){
    // flat top with rounded corners, straight sides, curved to a point at the bottom
    const r = m*0.08, yS = h*0.12, n = 26, right = [];
    for(let i = 0; i <= 5; i++){ const a = Math.PI/2*i/5; right.push([w/2 - r + r*Math.sin(a), h/2 - r + r*Math.cos(a)]); }
    for(let i = 1; i <= n; i++){ const s = i/n, y = yS - s*(yS + h/2); right.push([w/2*(1 - Math.pow(s, 2.1)), y]); }
    // right side goes top → tip; mirror for left side tip → top
    const left = right.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
    const all = [...right, ...left];
    // close top edge: right[0] is (w/2-r, h/2) ... left ends at (-(w/2-r), h/2)
    pts.push(...all);
  }
  // make counter-clockwise
  let A = 0; for(let i = 0; i < pts.length; i++){ const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; A += x1*y2 - x2*y1; }
  if(A < 0) pts.reverse();
  // drop duplicates
  return pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-7; });
}
// outward unit normals per vertex (averaged) and miter factor
function vnormals(O){
  const n = O.length, N = [];
  for(let i = 0; i < n; i++){
    const p = O[(i - 1 + n) % n], c = O[i], q = O[(i + 1) % n];
    const e1 = [c[0] - p[0], c[1] - p[1]], e2 = [q[0] - c[0], q[1] - c[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const n1 = [e1[1]/l1, -e1[0]/l1], n2 = [e2[1]/l2, -e2[0]/l2];
    let nx = n1[0] + n2[0], ny = n1[1] + n2[1]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const miter = 1/Math.max(0.35, nx*n1[0] + ny*n1[1]);
    N.push([nx, ny, miter]);
  }
  return N;
}
const offsetPts = (O, N, d) => O.map((p, i) => [p[0] - N[i][0]*d*N[i][2], p[1] - N[i][1]*d*N[i][2]]);

// ------------------------------------------------------------------ edge profile: [[inset, z], ...] from front cap edge to back cap edge
function profile(P){
  const t = P.t, pts = [];
  if(P.type === 'embroidered'){
    // merrow: round tube that stands proud of the fabric
    const R = Math.max(P.edge, t*0.55), tb = t, phi0 = Math.PI - Math.asin(clamp(tb/2/R, 0, 0.99)), n = 14;
    for(let i = 0; i <= n; i++){ const ph = phi0 - (2*phi0)*i/n; pts.push([R - R*Math.cos(ph), R*Math.sin(ph)]); }
    return { pts, front:tb/2, back:-tb/2, capInset:pts[0][0] };
  }
  const b = clamp(P.edge, 0.0003, t*0.48), n = 5;
  for(let i = 0; i <= n; i++){ const a = Math.PI/2*i/n; pts.push([b - b*Math.sin(a), t/2 - b + b*Math.cos(a)]); }
  for(let i = 0; i <= n; i++){ const a = Math.PI/2*i/n; pts.push([b - b*Math.cos(a), -t/2 + b - b*Math.sin(a)]); }
  return { pts, front:t/2, back:-t/2, capInset:b };
}

// ------------------------------------------------------------------ atlas layout
function layout(P, RES){
  const HF = Math.round(RES*0.6875), m = Math.max(4, RES/128);
  const s = Math.min((RES - 2*m)/P.w, (HF - 2*m)/P.h);
  const front = { cx:RES/2, cy:HF/2, s, x0:Math.floor(RES/2 - P.w*s/2) - 2, y0:Math.floor(HF/2 - P.h*s/2) - 2 };
  front.x1 = Math.ceil(RES/2 + P.w*s/2) + 2; front.y1 = Math.ceil(HF/2 + P.h*s/2) + 2;
  const BW = RES - HF, pad = Math.max(3, RES/256);
  const back = { x0:pad, y0:HF + pad, x1:BW - pad, y1:RES - pad };
  const side = { x0:BW + pad, y0:HF + pad, x1:RES - pad, y1:RES - pad };
  return { RES, HF, front, back, side };
}

// ------------------------------------------------------------------ geometry
export function buildGeometry(P, L){
  const O = outline(P.shape, P.w, P.h, P.custom), N = vnormals(O), prof = profile(P);
  const n = O.length;
  // perimeter parameter
  const sArr = [0]; for(let i = 1; i <= n; i++){ const a = O[i - 1], b = O[i % n]; sArr.push(sArr[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const per = sArr[n];
  // profile arc parameter
  const pr = prof.pts, pa = [0]; for(let k = 1; k < pr.length; k++) pa.push(pa[k - 1] + Math.hypot(pr[k][0] - pr[k - 1][0], pr[k][1] - pr[k - 1][1]));
  const plen = pa[pa.length - 1];
  // profile normals (in out/z plane, out = outward)
  // profile normals in the (out, z) plane: tangent (to, tz) rotated +90°
  const pn = pr.map((_, k) => {
    const a = pr[Math.max(0, k - 1)], b = pr[Math.min(pr.length - 1, k + 1)];
    const to = -(b[0] - a[0]), tz = b[1] - a[1], l = Math.hypot(to, tz) || 1;
    return [-tz/l, to/l];
  });
  const pos = [], nor = [], uv = [];
  const U = L.RES;
  const fUV = (x, y) => [(L.front.cx + x*L.front.s)/U, 1 - (L.front.cy - y*L.front.s)/U];
  const sUV = (s, a) => [(L.side.x0 + (L.side.x1 - L.side.x0)*s)/U, 1 - (L.side.y0 + (L.side.y1 - L.side.y0)*a)/U];
  const bUV = (x, y) => [(L.back.x0 + (L.back.x1 - L.back.x0)*(0.5 - x/P.w))/U, 1 - (L.back.y0 + (L.back.y1 - L.back.y0)*(0.5 - y/P.h))/U];
  const push = (p, nn, t) => { pos.push(...p); nor.push(...nn); uv.push(...t); };
  // caps
  const capF = offsetPts(O, N, prof.capInset), capB = capF;
  const tris = THREE.ShapeUtils.triangulateShape(capF.map(p => new THREE.Vector2(p[0], p[1])), []);
  for(let [a, b, c] of tris){
    // orient each triangle counter-clockwise (seen from the front)
    const ar = (capF[b][0] - capF[a][0])*(capF[c][1] - capF[a][1]) - (capF[c][0] - capF[a][0])*(capF[b][1] - capF[a][1]);
    if(ar < 0) [b, c] = [c, b];
    for(const i of [a, b, c]) push([capF[i][0], capF[i][1], prof.front], [0, 0, 1], fUV(capF[i][0], capF[i][1]));
    for(const i of [a, c, b]) push([capB[i][0], capB[i][1], prof.back], [0, 0, -1], bUV(capB[i][0], capB[i][1]));
  }
  // edge (profile swept along the outline)
  const vtx = (i, k, sU) => {
    const ii = i % n, d = pr[k][0], z = pr[k][1];
    const p = [O[ii][0] - N[ii][0]*d*N[ii][2], O[ii][1] - N[ii][1]*d*N[ii][2], z];
    const nn = [N[ii][0]*pn[k][0], N[ii][1]*pn[k][0], pn[k][1]];
    return [p, nn, sUV(sU, pa[k]/plen)];
  };
  for(let i = 0; i < n; i++){
    const s0 = sArr[i]/per, s1 = sArr[i + 1]/per;
    for(let k = 0; k < pr.length - 1; k++){
      const a = vtx(i, k, s0), b = vtx(i + 1, k, s1), c = vtx(i + 1, k + 1, s1), d = vtx(i, k + 1, s0);
      // front→back with outward normal: (a, d, c) and (a, c, b) keep CCW seen from outside
      for(const v of [a, d, c, a, c, b]) push(...v);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // Roblox convention: a part's Front face looks down -Z, so turn the patch to face that way.
  g.rotateY(Math.PI);
  return { geo:g, O, N, per, prof, sArr };
}

// ------------------------------------------------------------------ art (text or image) rasterised into the front region
function drawArt(P, L, O){
  const { RES, front:F } = L;
  const c = document.createElement('canvas'); c.width = RES; c.height = L.HF;
  const g = c.getContext('2d', { willReadFrequently:true });
  // inner box available for art
  const m = Math.min(P.w, P.h), inset = (P.type === 'embroidered' ? Math.max(P.edge, P.t*0.55)*1.6 : 0) + P.border*m;
  let bw = P.w - 2*Math.max(inset, P.w*0.085), bh = P.h - 2*inset;
  if(P.shape === 'circle' || P.shape === 'oval'){ bw *= 0.74; bh *= 0.74; }
  if(P.shape === 'shield'){ bw *= 0.86; bh *= 0.7; }
  const cy = F.cy - (P.shape === 'shield' ? P.h*0.08 : 0)*F.s - P.textY*P.h*F.s;
  if(P.content === 'image' && P.img){
    const im = P.img, custom = P.shape === 'custom' && P.custom;
    let [sx, sy, sw, sh] = custom ? P.custom.crop : [0, 0, im.width, im.height];
    // keep the art on the face: inside the merrow (embroidered), whole face otherwise
    const edgeIn = P.type === 'embroidered' ? Math.max(P.edge, P.t*0.55)*1.75 : P.type === 'pvc' ? Math.min(P.w, P.h)*0.012 : 0;
    const clipPts = offsetPts(O, vnormals(O), edgeIn);
    g.save(); g.beginPath();
    clipPts.forEach(([x, y], i) => { const px = F.cx + x*F.s, py = F.cy - y*F.s; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.closePath(); g.clip();
    let dx, dy, dw, dh;
    if(custom){ dw = P.w*F.s; dh = P.h*F.s; dx = F.cx - dw/2; dy = F.cy - dh/2; }
    else if(P.imgFit === 'contain'){ const k = Math.min(bw*F.s/sw, bh*F.s/sh); dw = sw*k; dh = sh*k; dx = F.cx - dw/2; dy = cy - dh/2; }
    else {
      const fw = (P.w - 2*edgeIn)*F.s, fh = (P.h - 2*edgeIn)*F.s;
      if(P.imgFit === 'stretch'){ dw = fw; dh = fh; }
      else { const k = Math.max(fw/sw, fh/sh); dw = sw*k; dh = sh*k; }
      dx = F.cx - dw/2; dy = F.cy - dh/2;
    }
    g.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
    g.restore();
  } else {
    const f = FONTS[P.font] || FONTS.ir;
    const lines = String(P.text || '').toUpperCase().split(/\n|\\n/).map(s => s.trim()).filter(Boolean);
    if(lines.length){
      g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const set = px => { g.font = `${px}px "${f.family}"`; g.letterSpacing = (P.spacing*px).toFixed(2) + 'px'; };
      set(100);
      const met = lines.map(s => g.measureText(s));
      const capH = Math.max(...met.map(mm => mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent)) || 70;
      const wid = Math.max(...met.map(mm => mm.width - P.spacing*100)) || 100;
      const gap = 0.28, totH = capH*(lines.length + gap*(lines.length - 1));
      const hBox = Math.min(bh, P.h*P.textH*(lines.length > 1 ? 1.5 : 1))*F.s;
      const k = Math.min(bw*F.s/wid, hBox/totH);
      const px = 100*k; set(px);
      let y = cy - totH*k/2;
      for(let i = 0; i < lines.length; i++){
        const mm = g.measureText(lines[i]);
        const asc = mm.actualBoundingBoxAscent, desc = mm.actualBoundingBoxDescent, lh = capH*k;
        const base = y + (lh - (asc + desc))/2 + asc;
        g.fillText(lines[i], F.cx + P.spacing*px/2, base);
        if(f.bold){ g.lineWidth = px*f.bold; g.lineJoin = 'round'; g.strokeText(lines[i], F.cx + P.spacing*px/2, base); }
        y += lh*(1 + gap);
      }
    }
  }
  const d = g.getImageData(0, 0, RES, L.HF).data;
  const N = RES*L.HF, a = new Float32Array(N), hm = new Float32Array(N), col = new Float32Array(N*3);
  const colourImg = P.content === 'image' && P.img && !P.imgMono;
  // optional: knock out a flat background colour taken from the image corners
  let kb = null;
  if(P.content === 'image' && P.img && P.imgKnock && P.shape !== 'custom' && P.imgFit === 'contain'){
    const cc = document.createElement('canvas'); cc.width = P.img.width; cc.height = P.img.height;
    const cg = cc.getContext('2d', { willReadFrequently:true }); cg.drawImage(P.img, 0, 0);
    const px = (x, y) => cg.getImageData(x, y, 1, 1).data;
    const s = [px(0, 0), px(cc.width - 1, 0), px(0, cc.height - 1), px(cc.width - 1, cc.height - 1)];
    if(s.every(q => q[3] > 200)){ const avg = [0, 1, 2].map(j => s.reduce((t2, q) => t2 + q[j], 0)/4);
      const sd = s.reduce((t2, q) => t2 + Math.abs(q[0] - avg[0]) + Math.abs(q[1] - avg[1]) + Math.abs(q[2] - avg[2]), 0)/4;
      if(sd < 40) kb = avg; }
  }
  // 3D embroidery: raise everything that differs from the image's background colour (average of the 4 corners)
  let bgc = null;
  if(P.img3d && colourImg){
    // background = the most common colour of the image (not the corners: a flag's arms can reach them)
    const cc = document.createElement('canvas'); cc.width = 96; cc.height = 96;
    const cg = cc.getContext('2d', { willReadFrequently:true }); cg.drawImage(P.img, 0, 0, 96, 96);
    const dd0 = cg.getImageData(0, 0, 96, 96).data, bins = new Map();
    for(let k = 0; k < 96*96; k++){ const key = (dd0[k*4] >> 4)*256 + (dd0[k*4 + 1] >> 4)*16 + (dd0[k*4 + 2] >> 4); const e = bins.get(key) || [0, 0, 0, 0]; e[0]++; e[1] += dd0[k*4]; e[2] += dd0[k*4 + 1]; e[3] += dd0[k*4 + 2]; bins.set(key, e); }
    let best = null; for(const e of bins.values()) if(!best || e[0] > best[0]) best = e;
    bgc = [best[1]/best[0]/255, best[2]/best[0]/255, best[3]/best[0]/255];
  }
  for(let i = 0; i < N; i++){
    let al = d[i*4 + 3]/255; const r = d[i*4]/255, gg = d[i*4 + 1]/255, b = d[i*4 + 2]/255;
    if(al > 0 && kb){ const dist = Math.abs(d[i*4] - kb[0]) + Math.abs(d[i*4 + 1] - kb[1]) + Math.abs(d[i*4 + 2] - kb[2]); al *= smooth(30, 70, dist); }
    if(P.content === 'image' && P.imgMono){ const lu = 0.3*r + 0.59*gg + 0.11*b; let v = smooth(0.42, 0.58, lu); if(P.imgInvert) v = 1 - v; al *= v; }
    a[i] = al; col[i*3] = r; col[i*3 + 1] = gg; col[i*3 + 2] = b;
    // relief: for a full-colour image the light parts stand out (or the dark ones, with Invert)
    if(bgc){ const dd = Math.abs(r - bgc[0]) + Math.abs(gg - bgc[1]) + Math.abs(b - bgc[2]); let v = smooth(0.25, 0.5, dd); if(P.imgInvert) v = 1 - v; hm[i] = al*v; }
    else if(colourImg){ let v = smooth(0.28, 0.45, 0.3*r + 0.59*gg + 0.11*b); if(P.imgInvert) v = 1 - v; hm[i] = al*v; } else hm[i] = al;
  }
  return { a, hm, col };
}

// signed distance (studs, positive inside) and perimeter parameter (studs) for the front region; computed on a 2x grid
function edgeField(P, L, O){
  const { RES, HF, front:F } = L, n = O.length, N = RES*HF;
  const dist = new Float32Array(N).fill(-1), sp = new Float32Array(N);
  const segs = []; let acc = 0;
  for(let i = 0; i < n; i++){ const a = O[i], b = O[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push([a[0], a[1], b[0] - a[0], b[1] - a[1], len, acc]); acc += len; }
  const inside = (x, y) => { let c = false; for(let i = 0, j = n - 1; i < n; j = i++){ const [xi, yi] = O[i], [xj, yj] = O[j]; if((yi > y) !== (yj > y) && x < (xj - xi)*(y - yi)/(yj - yi) + xi) c = !c; } return c; };
  const st = 2, gw = Math.ceil((F.x1 - F.x0)/st) + 2, gh = Math.ceil((F.y1 - F.y0)/st) + 2;
  const gd = new Float32Array(gw*gh), gs = new Float32Array(gw*gh);
  for(let gy = 0; gy < gh; gy++) for(let gx = 0; gx < gw; gx++){
    const px = F.x0 + gx*st, py = F.y0 + gy*st, x = (px - F.cx)/F.s, y = (F.cy - py)/F.s;
    let best = 1e9, bs = 0;
    for(const [ax, ay, dx, dy, len, s0] of segs){ const tt = clamp(((x - ax)*dx + (y - ay)*dy)/(len*len || 1), 0, 1); const ex = ax + dx*tt - x, ey = ay + dy*tt - y, d2 = ex*ex + ey*ey; if(d2 < best){ best = d2; bs = s0 + tt*len; } }
    const d = Math.sqrt(best); gd[gy*gw + gx] = inside(x, y) ? d : -d; gs[gy*gw + gx] = bs;
  }
  const per = acc;
  for(let py = Math.max(0, F.y0); py < Math.min(HF, F.y1); py++) for(let px = Math.max(0, F.x0); px < Math.min(RES, F.x1); px++){
    const fx = (px - F.x0)/st, fy = (py - F.y0)/st, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const i00 = y0*gw + x0, i10 = i00 + 1, i01 = i00 + gw, i11 = i01 + 1;
    dist[py*RES + px] = (gd[i00]*(1 - tx) + gd[i10]*tx)*(1 - ty) + (gd[i01]*(1 - tx) + gd[i11]*tx)*ty;
    // perimeter param: avoid interpolating across the seam
    let s = gs[i00]; const ref = s, w = [(1 - tx)*(1 - ty), tx*(1 - ty), (1 - tx)*ty, tx*ty], q = [gs[i00], gs[i10], gs[i01], gs[i11]];
    s = 0; for(let j = 0; j < 4; j++){ let v = q[j]; if(v - ref > per/2) v -= per; else if(ref - v > per/2) v += per; s += v*w[j]; }
    sp[py*RES + px] = (s + per) % per;
  }
  return { dist, sp, per };
}

// ------------------------------------------------------------------ texture generation
let hookImg = null;
async function hookData(){
  if(hookImg) return hookImg;
  const im = new Image(); im.src = 'assets/materials/velcro_hook.png'; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, im.width, im.height).data, v = new Float32Array(im.width*im.height);
  for(let i = 0; i < v.length; i++) v[i] = d[i*4]/255;
  return hookImg = { w:im.width, h:im.height, v };
}
// hexagon cell-edge distance for the IR film: 0 on the cell border, 1 at the centre (pointy-top cells of radius r)
function hexEdge(x, y, r){
  const sq3 = Math.sqrt(3), q = (sq3/3*x - y/3)/r, rr = (2/3*y)/r;
  const cx = q, cz = rr, cy = -q - rr;
  let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
  const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
  if(dx > dy && dx > dz) rx = -ry - rz; else if(dy > dz) ry = -rx - rz; else rz = -rx - ry;
  const px = x - r*sq3*(rx + rz/2), py = y - r*1.5*rz, ap = r*sq3/2;
  const m = Math.max(Math.abs(px), Math.abs(px*0.5 + py*sq3/2), Math.abs(px*0.5 - py*sq3/2));
  return clamp((ap - m)/ap, 0, 1);
}

// ------------------------------------------------------------------ materials (per zone: background, art, edge, back)
// A material is a tileable sample: albedo, normal (OpenGL, +Y up) and roughness, with its real size in studs.
export const ZONES = ['bg', 'art', 'edge', 'back'];
export const MATS = new Map();
MATS.set('proc', { id:'proc', name:['Generated (TYC)', 'Generado (TYC)'], src:'proc' });
const REMOTE_TILE = 0.6;   // studs covered by one tile of a downloaded material (scale changes it)
const REMOTE_TILE_MAX = 0.8;
function readPixels(img, max){
  const k = Math.min(1, max/Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width*k)), h = Math.max(1, Math.round(img.height*k));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently:true });
  g.drawImage(img, 0, 0, w, h); return { w, h, d:g.getImageData(0, 0, w, h).data, c };
}
// meta: { id, name, src, tile:[w,h] }; images: albedo (required), normal and roughness (optional)
export function makeMaterial(meta, dImg, nImg, rImg, max = 1024){
  const D = readPixels(dImg, max), w = D.w, h = D.h, N = w*h;
  const alb = new Float32Array(N*3), lr = new Float32Array(N), nx = new Float32Array(N), ny = new Float32Array(N), rd = new Float32Array(N);
  let lm = 0, cr = 0, cg = 0, cb = 0;
  for(let i = 0; i < N; i++){
    const r = D.d[i*4]/255, g = D.d[i*4 + 1]/255, b = D.d[i*4 + 2]/255;
    alb[i*3] = r; alb[i*3 + 1] = g; alb[i*3 + 2] = b; lr[i] = 0.3*r + 0.59*g + 0.11*b; lm += lr[i]; cr += r; cg += g; cb += b;
  }
  lm = Math.max(1e-3, lm/N); for(let i = 0; i < N; i++) lr[i] = Math.min(3, lr[i]/lm);
  const resample = (img, fn) => {
    const Q = readPixels(img, Math.max(w, h)), sx = Q.w/w, sy = Q.h/h;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++) fn(y*w + x, (Math.min(Q.h - 1, (y*sy) | 0)*Q.w + Math.min(Q.w - 1, (x*sx) | 0))*4, Q.d);
  };
  if(nImg) resample(nImg, (i, j, q) => { const vz = Math.max(0.2, q[j + 2]/127.5 - 1); nx[i] = (q[j]/127.5 - 1)/vz; ny[i] = (q[j + 1]/127.5 - 1)/vz; });
  let rm = 0.7;
  if(rImg){ let t2 = 0; resample(rImg, (i, j, q) => { rd[i] = q[j]/255; t2 += rd[i]; }); rm = t2/N; for(let i = 0; i < N; i++) rd[i] -= rm; }
  // thumbnail
  const tc = document.createElement('canvas'); tc.width = tc.height = 96; const tg = tc.getContext('2d');
  if(meta.src === 'ref'){
    // show the sample at a readable zoom, repeated
    const k = Math.max(1, Math.min(4, 48/Math.min(w, h)));
    tg.save(); tg.scale(k, k); tg.fillStyle = tg.createPattern(D.c, 'repeat'); tg.fillRect(0, 0, 96/k, 96/k); tg.restore();
  } else tg.drawImage(D.c, 0, 0, 96, 96);
  const M = Object.assign({ tile:[REMOTE_TILE, REMOTE_TILE*h/w] }, meta, { w, h, alb, lr, nx, ny, rd, rough:rm, color:[cr/N, cg/N, cb/N], thumb:tc.toDataURL('image/jpeg', 0.85) });
  MATS.set(M.id, M); return M;
}
let refsReady = null;
export function loadRefMaterials(){
  if(!refsReady) refsReady = (async () => {
    const cat = await (await fetch('assets/patchmats/materials.json')).json();
    const img = async f => { const im = new Image(); im.src = 'assets/patchmats/' + f; await im.decode(); return im; };
    await Promise.all(cat.map(async c => makeMaterial({ id:'ref:' + c.id, name:c.name, src:'ref', tile:c.tile, zones:c.zones },
      await img(c.id + '_d.png'), await img(c.id + '_n.png'), await img(c.id + '_r.png'))));
    return cat;
  })();
  return refsReady;
}
// default materials per patch type
export const ZONE_DEFAULTS = {
  callsign:    { bg:'ref:nylon', art:'ref:irlight', edge:'ref:nylon',  back:'ref:hook' },
  lasercut:    { bg:'ref:woven', art:'proc',        edge:'proc',       back:'ref:hook' },
  embroidered: { bg:'ref:twill', art:'ref:satin',   edge:'ref:merrow', back:'ref:hook' },
  pvc:         { bg:'proc',      art:'proc',        edge:'proc',       back:'ref:hook' },
};
export function defaultZones(type){
  const z = {}; for(const k of ZONES) z[k] = { mat:ZONE_DEFAULTS[type][k], own:false, scale:1, rot:0 }; return z;
}
// sampler for one zone: (x, y) in studs, y up -> o = { r, g, b, lr, nx, ny, rd }
function zoneSampler(Z){
  const M = Z && MATS.get(Z.mat); if(!M || M.src === 'proc' || !M.alb) return null;
  const tw = M.tile[0]*Z.scale, th = M.tile[1]*Z.scale, an = (Z.rot || 0)*Math.PI/180, c = Math.cos(an), s = Math.sin(an), W = M.w, H = M.h;
  return (x, y, o) => {
    const xr = x*c + y*s, yr = -x*s + y*c;
    let u = xr/tw, v = -yr/th; u -= Math.floor(u); v -= Math.floor(v);
    const fx = u*W - 0.5, fy = v*H - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const xa = (x0 + W) % W, xb = (x0 + 1) % W, ya = (y0 + H) % H, yb = (y0 + 1) % H;
    const i00 = ya*W + xa, i10 = ya*W + xb, i01 = yb*W + xa, i11 = yb*W + xb;
    const w00 = (1 - tx)*(1 - ty), w10 = tx*(1 - ty), w01 = (1 - tx)*ty, w11 = tx*ty;
    const A = M.alb;
    o.r = A[i00*3]*w00 + A[i10*3]*w10 + A[i01*3]*w01 + A[i11*3]*w11;
    o.g = A[i00*3 + 1]*w00 + A[i10*3 + 1]*w10 + A[i01*3 + 1]*w01 + A[i11*3 + 1]*w11;
    o.b = A[i00*3 + 2]*w00 + A[i10*3 + 2]*w10 + A[i01*3 + 2]*w01 + A[i11*3 + 2]*w11;
    const f = a => a[i00]*w00 + a[i10]*w10 + a[i01]*w01 + a[i11]*w11;
    o.lr = f(M.lr); o.rd = f(M.rd);
    const nxx = f(M.nx), nyy = f(M.ny);
    o.nx = nxx*c - nyy*s; o.ny = nxx*s + nyy*c;
    return o;
  };
}
// colour of a sampled zone: the material's own colours, or the zone colour shaded by the material
const zcol = (Z, o, base, out) => { if(Z.own){ out[0] = o.r; out[1] = o.g; out[2] = o.b; } else { out[0] = base[0]*o.lr; out[1] = base[1]*o.lr; out[2] = base[2]*o.lr; } return out; };

export async function generate(P){
  await loadFonts();
  const RES = P.res, L = layout(P, RES), G = buildGeometry(P, L);
  const NP = RES*RES;
  const col = new Float32Array(NP*3), hgt = new Float32Array(NP), rgh = new Float32Array(NP);
  const bg = hex2(P.bg), fg = hex2(P.fg), ed = hex2(P.ed);
  const noise = makeNoise(P.seed), noise2 = makeNoise(P.seed + 101), R = rng(P.seed);
  const F = L.front, HF = L.HF;
  const art = drawArt(P, L, G.O);
  const E = edgeField(P, L, G.O);
  const pxPerStud = F.s, m = Math.min(P.w, P.h);
  const unit = pxPerStud*0.001;   // pixels per 1/1000 stud
  // blurred art masks for relief
  const aSoft = boxBlur(art.hm, RES, HF, Math.max(1, Math.round(unit*1.0)), F.x0 < 0 ? 0 : F.x0, Math.max(0, F.y0), Math.min(RES, F.x1), Math.min(HF, F.y1));
  const aWide = boxBlur(art.hm, RES, HF, Math.max(2, Math.round(unit*3.2)), Math.max(0, F.x0), Math.max(0, F.y0), Math.min(RES, F.x1), Math.min(HF, F.y1));
  const useArtCol = P.content === 'image' && P.img && !P.imgMono;
  const type = P.type, rel = P.relief;
  const aBig = P.img3d ? boxBlur(art.hm, RES, HF, Math.max(6, Math.round(pxPerStud*0.017)), Math.max(0, F.x0), Math.max(0, F.y0), Math.min(RES, F.x1), Math.min(HF, F.y1)) : null;
  const aFz = P.img3d ? boxBlur(art.hm, RES, HF, Math.max(2, Math.round(unit*2.4)), Math.max(0, F.x0), Math.max(0, F.y0), Math.min(RES, F.x1), Math.min(HF, F.y1)) : null;
  // 3D embroidery: local direction of each raised shape (structure tensor of the mask edges), so satin stitches run across it
  let tdx = null, tdy = null;
  if(P.img3d && useArtCol && type === 'embroidered'){
    const fx0 = Math.max(0, F.x0), fy0 = Math.max(0, F.y0), fx1 = Math.min(RES, F.x1), fy1 = Math.min(HF, F.y1);
    const NN = RES*HF, jxx = new Float32Array(NN), jyy = new Float32Array(NN), jxy = new Float32Array(NN);
    for(let yy = Math.max(1, fy0); yy < Math.min(HF - 1, fy1); yy++) for(let xx = Math.max(1, fx0); xx < Math.min(RES - 1, fx1); xx++){
      const q = yy*RES + xx, gx = aSoft[q + 1] - aSoft[q - 1], gy = aSoft[q + RES] - aSoft[q - RES];
      jxx[q] = gx*gx; jyy[q] = gy*gy; jxy[q] = gx*gy;
    }
    const rT = Math.max(6, Math.round(pxPerStud*0.05));
    const bxx = boxBlur(jxx, RES, HF, rT, fx0, fy0, fx1, fy1), byy = boxBlur(jyy, RES, HF, rT, fx0, fy0, fx1, fy1), bxy = boxBlur(jxy, RES, HF, rT, fx0, fy0, fx1, fy1);
    tdx = new Float32Array(NN); tdy = new Float32Array(NN);
    // dominant band directions: magnitude-weighted histogram of edge orientations (mod 180°), top two peaks
    const NB = 180, hist = new Float64Array(NB);
    for(let yy = Math.max(1, fy0); yy < Math.min(HF - 1, fy1); yy += 2) for(let xx = Math.max(1, fx0); xx < Math.min(RES - 1, fx1); xx += 2){
      const q = yy*RES + xx, gx = aSoft[q + 1] - aSoft[q - 1], gy = aSoft[q + RES] - aSoft[q - RES], mg = Math.hypot(gx, gy);
      if(mg < 0.02) continue;
      let an = Math.atan2(gy, gx); if(an < 0) an += Math.PI; if(an >= Math.PI) an -= Math.PI;
      hist[Math.min(NB - 1, Math.floor(an/Math.PI*NB))] += mg;
    }
    const sm = new Float64Array(NB); for(let k = 0; k < NB; k++) for(let j = -3; j <= 3; j++) sm[k] += hist[(k + j + NB) % NB]*(4 - Math.abs(j));
    let p1 = 0; for(let k = 1; k < NB; k++) if(sm[k] > sm[p1]) p1 = k;
    let p2 = -1; for(let k = 0; k < NB; k++){ const dk = Math.min((k - p1 + NB) % NB, (p1 - k + NB) % NB); if(dk >= 20 && (p2 < 0 || sm[k] > sm[p2])) p2 = k; }
    const dirs = [p1]; if(p2 >= 0 && sm[p2] > sm[p1]*0.35) dirs.push(p2);
    const dc = dirs.map(k => [Math.cos((k + 0.5)/NB*Math.PI), Math.sin((k + 0.5)/NB*Math.PI)]);
    // band membership: for each direction, width of the mask measured across that band; the narrower one is the band the pixel sits in (the top band wins an overlap)
    const chord = (q0x, q0y, nx, ny) => { let len = 0; for(const sg of [1, -1]){ let k = 0; for(; k < 110; k++){ const xx = Math.round(q0x + sg*nx*k*3), yy = Math.round(q0y + sg*ny*k*3); if(xx < fx0 || xx >= fx1 || yy < fy0 || yy >= fy1 || aSoft[yy*RES + xx] < 0.5) break; } len += k*3; } return len; };
    for(let yy = fy0; yy < fy1; yy++) for(let xx = fx0; xx < fx1; xx++){
      const q = yy*RES + xx; let cx = 1, cy = 0;
      if(dc.length === 1){ cx = dc[0][0]; cy = dc[0][1]; }
      else if(dc.length === 2){
        if(aSoft[q] > 0.5){
          const c0 = chord(xx, yy, dc[0][0], dc[0][1])*0.82, c1 = chord(xx, yy, dc[1][0], dc[1][1]), k = c0 <= c1 ? 0 : 1; cx = dc[k][0]; cy = dc[k][1];
        } else { const th = 0.5*Math.atan2(2*bxy[q], bxx[q] - byy[q]); const a0 = Math.abs(Math.cos(th)*dc[0][0] + Math.sin(th)*dc[0][1]), a1 = Math.abs(Math.cos(th)*dc[1][0] + Math.sin(th)*dc[1][1]), k = a0 >= a1 ? 0 : 1; cx = dc[k][0]; cy = dc[k][1]; }
      } else { const th = 0.5*Math.atan2(2*bxy[q], bxx[q] - byy[q]); cx = Math.cos(th); cy = Math.sin(th); }
      tdx[q] = cx; tdy[q] = cy;
    }
  }
  const mer = type === 'embroidered' ? Math.max(P.edge, P.t*0.55) : 0;        // merrow radius (studs)
  const stitchIn = m*Math.min(0.05, P.border*0.55), stitchW = Math.max(0.9, unit*0.55);
  const dashLen = Math.max(0.0075, 9/pxPerStud);
  const weaveP = Math.max(3.2, unit*4.4/P.weave);       // basket weave period (px)
  await loadRefMaterials();
  const Zs = P.zones || defaultZones(type);
  const SB = zoneSampler(Zs.bg), SA = zoneSampler(Zs.art), SE = zoneSampler(Zs.edge), SK = zoneSampler(Zs.back);
  const sb = {}, sa = {}, se = {}, sk = {}, tc = [0, 0, 0];
  const dnX = new Float32Array(NP), dnY = new Float32Array(NP);   // material normal detail (slopes)
 
  // ---------------- front region
  for(let py = 0; py < HF; py++) for(let px = 0; px < RES; px++){
    const i = py*RES + px;
    let d = E.dist[i]; if(px < F.x0 || px >= F.x1 || py < F.y0 || py >= F.y1) d = -1;
    const x = px, y = py;
    let r = bg[0], g = bg[1], b = bg[2], h = 0, ro = P.roughBg;
    const nz = noise(x*0.21, y*0.21)*0.6 + noise2(x*0.9, y*0.9)*0.4;
    const a = art.a[i] || 0;
    let ar = fg[0], ag = fg[1], ab = fg[2];
    if(useArtCol){ ar = art.col[i*3]; ag = art.col[i*3 + 1]; ab = art.col[i*3 + 2]; }
    // material samples for this pixel (studs, y up)
    const xs = (px - F.cx)/F.s, ys = (F.cy - py)/F.s;
    let bnx = 0, bny = 0, anx = 0, any = 0, upv = 0;
    if(SB){ SB(xs, ys, sb); bnx = sb.nx; bny = sb.ny; }
    if(SA && a > 0){ SA(xs, ys, sa); anx = sa.nx; any = sa.ny; }
    if(type === 'callsign' || type === 'lasercut'){
      // nylon / cordura basket weave
      const pp = type === 'lasercut' ? weaveP*0.7 : weaveP;
      const u = x/pp, v = y/pp, cu = Math.floor(u), cv = Math.floor(v), fu = u - cu, fv = v - cv;
      const horiz = ((cu >> 1) + (cv >> 1)) & 1;   // 2x2 basket blocks alternate direction
      const across = horiz ? fv : fu, along = horiz ? fu : fv;
      const yarn = Math.pow(Math.sin(Math.PI*across), 0.7) * (0.85 + 0.15*Math.sin(Math.PI*along));
      if(SB){ zcol(Zs.bg, sb, bg, tc); r = tc[0]; g = tc[1]; b = tc[2]; h = 0; ro = P.roughBg + sb.rd; }
      else { const sh = 0.92 + 0.1*yarn + (nz - 0.5)*0.07; r *= sh; g *= sh; b *= sh; h = 0.13*yarn*rel; }
      // laser-cut letters: the top layer is cut away and the film below shows through
      const cut = aSoft[i];
      let hl = -P.depth*rel;
      if(a > 0){
        let fr = ar, fg2 = ag, fb = ab;
        if(SA){ zcol(Zs.art, sa, [ar, ag, ab], tc); fr = tc[0]; fg2 = tc[1]; fb = tc[2]; }
        else if(P.ir && !useArtCol){
          const e = hexEdge(x, y, Math.max(6, unit*7.5)), line = 1 - smooth(0.0, 0.2, e);
          const kk = 0.9 + 0.16*line + (nz - 0.5)*0.05; fr *= kk; fg2 *= kk; fb *= kk; hl += 0.1*line*rel;
        } else { const kk = 0.96 + (nz - 0.5)*0.06; fr *= kk; fg2 *= kk; fb *= kk; }
        r += (fr - r)*a; g += (fg2 - g)*a; b += (fb - b)*a;
        ro += (P.roughFg + (SA ? sa.rd : 0) - ro)*a;
      }
      h = h*(1 - cut) + hl*cut;
      // darker cut wall around letters
      const wall = clamp(aWide[i] - aSoft[i], 0, 1); if(wall > 0 && a < 0.5){ const k = 1 - 0.35*wall; r *= k; g *= k; b *= k; }
      // stitched border: dashed (callsign) or printed frame line (laser-cut)
      if(type === 'callsign' && P.stitch){
        const dd = Math.abs(d - stitchIn)*pxPerStud;
        if(dd < stitchW + 1){
          const ph = frac(E.sp[i]/dashLen), on = smooth(0.0, 0.08, ph)*(1 - smooth(0.7, 0.8, ph));
          const prof = (1 - smooth(stitchW*0.4, stitchW + 0.8, dd))*on;
          const k = 1 - 0.32*prof; r *= k; g *= k; b *= k; h += 0.55*prof*Math.sin(Math.PI*clamp(ph/0.75, 0, 1))*rel; ro += (0.7 - ro)*prof;
        }
      }
      if(type === 'lasercut' && P.stitch){
        const lw = m*0.012*pxPerStud, dd = Math.abs(d - stitchIn*0.9)*pxPerStud, prof = 1 - smooth(lw*0.5, lw*0.5 + 1.2, dd);
        if(prof > 0){ r += (ar - r)*prof; g += (ag - g)*prof; b += (ab - b)*prof; h -= P.depth*0.6*prof*rel; }
      }
      // heat-sealed outer edge
      const edgeK = smooth(0, 0.006, d); const k = 0.8 + 0.2*edgeK; r *= k; g *= k; b *= k; h -= (1 - edgeK)*0.25;
    }
    else if(type === 'embroidered'){
      // tatami fill (background) at 45°
      const s2 = Math.SQRT1_2, uu = P.img3d ? (x - y)*s2 : (x + y)*s2, vv = P.img3d ? (x + y)*s2 : (x - y)*s2;
      const rowH = P.img3d ? Math.max(2.4, unit*1.25/P.weave) : Math.max(2.6, unit*3.2/P.weave), stl = rowH*5.5;
      const row = Math.floor(vv/rowH), fv = vv/rowH - row, ofs = ((row % 3) + 3) % 3/3;
      const tt = frac(uu/stl + ofs + (noise(row*0.7, 3.1) - 0.5)*0.15);
      let thread = Math.pow(Math.sin(Math.PI*fv), 0.6)*(0.75 + 0.25*Math.sin(Math.PI*tt))*smooth(0, 0.05, tt)*(1 - smooth(0.95, 1, tt));
      if(P.img3d) thread = (0.5 + 0.5*Math.sin(2*Math.PI*vv/(rowH*1.0)))*(0.9 + 0.1*Math.sin(2*Math.PI*uu/(rowH*0.5)));
      if(SB){ zcol(Zs.bg, sb, bg, tc); r = tc[0]; g = tc[1]; b = tc[2]; h = 0; ro = P.roughBg + sb.rd; }
      else { const sh = P.img3d ? 0.99 + 0.012*thread + (nz - 0.5)*0.012 : 0.72 + 0.4*thread + (nz - 0.5)*0.08; r *= sh; g *= sh; b *= sh; h = (P.img3d ? 0.1 : 0.32)*thread*rel; ro = P.roughBg - 0.06*thread; }
      if(a > 0.001 && P.img3d && useArtCol){
        // 3D embroidery: the image's flat colours keep the fabric weave (colour = image colour x weave shade); everything else is raised satin
        const bl = (bg[0] + bg[1] + bg[2])/3 || 1, q = clamp(((r + g + b)/3)/bl, 0.5, 1.25)*1.0;
        r += (Math.min(1, ar*q) - r)*a; g += (Math.min(1, ag*q) - g)*a; b += (Math.min(1, ab*q) - b)*a;
        const up0 = clamp(aFz[i], 0, 1);
        if(up0 > 0.002 && tdx){
          const nxv = -tdy[i], nyv = tdx[i], cw = Math.max(4.6, unit*1.7/P.weave), sx = (x*nxv + y*nyv)/cw, col2 = Math.floor(sx), fx = sx - col2;
          const jj = noise(col2*1.7, 7.3) - 0.5, jit2 = noise(col2*0.9, 2.1) - 0.5;
          const up = smooth(0.5 + jj*0.6 - 0.2, 0.5 + jj*0.6 + 0.2, up0);
          upv = up;
          if(up > 0.001){
            const st = Math.pow(Math.sin(Math.PI*fx), 0.6);
            const dome = Math.pow(clamp(aBig[i]/0.72, 0, 1), 0.85);
            const sh2 = 0.89*(0.9 + 0.1*st + jit2*0.05)*(0.86 + 0.22*dome);
            r += (Math.min(1, ar*sh2) - r)*up; g += (Math.min(1, ag*sh2) - g)*up; b += (Math.min(1, ab*sh2) - b)*up;
            h = h*(1 - up) + up*(0.45 + 2.1*dome + 0.14*st)*P.depth*rel;
            ro += (P.roughFg - 0.14*st - ro)*up;
          }
          const wall = clamp(aWide[i] - up0, 0, 1)*(1 - up); if(wall > 0){ const k3 = 1 - 0.24*wall; r *= k3; g *= k3; b *= k3; }
        }
      }
      else if(a > 0.001){
        // satin stitches (vertical, slightly slanted) raised over the fill
        const cw = Math.max(2.2, unit*2.2/P.weave), sx = (x + y*0.18)/cw, col2 = Math.floor(sx), fx = sx - col2;
        const jitter = noise(col2*1.3, y*0.02)*0.3;
        const st = Math.pow(Math.sin(Math.PI*fx), 0.55);
        const sh2 = 0.74 + 0.36*st + jitter*0.12 - 0.08;
        const dome = clamp(aWide[i]*1.3, 0, 1);
        if(SA){ zcol(Zs.art, sa, [ar, ag, ab], tc); r += (tc[0] - r)*a; g += (tc[1] - g)*a; b += (tc[2] - b)*a; h = h*(1 - a) + a*(0.35 + 1.1*dome)*P.depth*rel; ro += (P.roughFg + sa.rd - ro)*a; }
        else {
        r += (ar*sh2 - r)*a; g += (ag*sh2 - g)*a; b += (ab*sh2 - b)*a;
        h = h*(1 - a) + a*(0.35 + 1.1*dome + 0.3*st)*P.depth*rel;
        ro += (P.roughFg - 0.05*st - ro)*a; }
      }
      if(P.img3d){ const rc = mer*2.15, rw = mer*0.32, dd = Math.abs(d - rc), pr = 1 - smooth(rw*0.5, rw, dd); if(pr > 0){ const kq = 1 - 0.12*pr; r *= kq; g *= kq; b *= kq; h += 0.55*pr*rel*(0.8 + 0.2*Math.sin(E.sp[i]/0.0042)); } }
      // merrow zone (geometry tube covers this; colour it like the thread)
      if(d < mer*1.05){ const k2 = 1 - smooth(mer*0.85, mer*1.05, d); r += (ed[0] - r)*k2; g += (ed[1] - g)*k2; b += (ed[2] - b)*k2; }
      // fabric shadow next to merrow
      const capIn = mer*1.8, sh3 = 1 - (P.img3d ? 0.1 : 0.4)*(1 - smooth(capIn, capIn + 0.006, d)); r *= sh3; g *= sh3; b *= sh3; h -= 0.3*(1 - smooth(capIn, capIn + 0.006, d));
    }
    else if(type === 'pvc'){
      // moulded rubber: raised rim + raised art, flat field
      const rimW = m*Math.max(0.035, P.border*0.7), rimIn = m*0.012;
      const rim = smooth(rimIn*0.25, rimIn, d)*(1 - smooth(rimW - 0.004, rimW, d));
      const field = 0.0;
      const ar2 = clamp(aWide[i]*0.5 + aSoft[i]*0.5, 0, 1);
      h = (field + rim*1.0 + ar2*P.depth)*rel;
      // colour: rim uses edge colour, art uses fg/image
      const rk = smooth(0.5, 0.9, rim); r += (ed[0] - r)*rk; g += (ed[1] - g)*rk; b += (ed[2] - b)*rk;
      const ak = smooth(0.35, 0.65, a); r += (ar - r)*ak; g += (ag - g)*ak; b += (ab - b)*ak;
      if(useArtCol && P.shape !== 'custom'){ r += (ed[0] - r)*rk; g += (ed[1] - g)*rk; b += (ed[2] - b)*rk; }
      const sh = 0.97 + (nz - 0.5)*0.05; r *= sh; g *= sh; b *= sh;
      ro = P.roughBg + (P.roughFg - P.roughBg)*ak + (nz - 0.5)*0.05;
      if(SB && ak < 1){ zcol(Zs.bg, sb, rk > 0.5 ? ed : bg, tc); const wb = 1 - ak; r += (tc[0]*sh - r)*wb; g += (tc[1]*sh - g)*wb; b += (tc[2]*sh - b)*wb; ro += sb.rd*wb; }
      if(SA && ak > 0){ zcol(Zs.art, sa, [ar, ag, ab], tc); r += (tc[0] - r)*ak; g += (tc[1] - g)*ak; b += (tc[2] - b)*ak; ro += sa.rd*ak; }
      // outer bevel
      h -= (1 - smooth(0, rimIn, d))*0.8;
    }
    const wa = (P.img3d && useArtCol && tdx) ? 0 : clamp(a, 0, 1); dnX[i] = bnx*(1 - wa) + anx*wa; dnY[i] = bny*(1 - wa) + any*wa;
    col[i*3] = r; col[i*3 + 1] = g; col[i*3 + 2] = b; hgt[i] = h; rgh[i] = ro;
  }
 
  // PVC: soft ambient occlusion at the foot of raised shapes
  if(type === 'pvc'){
    const hb = boxBlur(hgt, RES, HF, Math.max(2, Math.round(unit*4)), 0, 0, RES, HF);
    for(let i = 0; i < RES*HF; i++){ const ao = clamp((hb[i] - hgt[i])*0.9, 0, 0.45); const k = 1 - ao; col[i*3] *= k; col[i*3 + 1] *= k; col[i*3 + 2] *= k; }
  }
  // ---------------- back: hook velcro
  const hook = await hookData();
  { const B = L.back;
    for(let py = HF; py < RES; py++) for(let px = 0; px < L.side.x0 - 1; px++){
      const i = py*RES + px;
      const base = type === 'pvc' ? bg : [0.15, 0.15, 0.155];
      if(SK){
        const xs = ((px - B.x0)/(B.x1 - B.x0) - 0.5)*P.w, ys = (0.5 - (py - B.y0)/(B.y1 - B.y0))*P.h;
        SK(xs, ys, sk); zcol(Zs.back, sk, base, tc);
        col[i*3] = tc[0]; col[i*3 + 1] = tc[1]; col[i*3 + 2] = tc[2]; hgt[i] = 0; rgh[i] = 0.8 + sk.rd; dnX[i] = sk.nx; dnY[i] = sk.ny;
      } else {
        const hv = hook.v[((py*2) % hook.h)*hook.w + ((px*2) % hook.w)], k = 0.55 + 0.7*hv;
        col[i*3] = base[0]*k; col[i*3 + 1] = base[1]*k; col[i*3 + 2] = base[2]*k; hgt[i] = hv*0.9; rgh[i] = 0.78;
      }
    }
    void B;
  }
  // ---------------- edge strip
  { const S = L.side, SW = S.x1 - S.x0, SH = S.y1 - S.y0, per = G.per, plen = G.prof.pts.length;
    for(let py = HF; py < RES; py++) for(let px = L.side.x0 - 1; px < RES; px++){
      const i = py*RES + px, u = clamp((px - S.x0)/SW, 0, 1), v = clamp((py - S.y0)/SH, 0, 1);
      let r, g, b, h, ro;
      if(SE){
        // along the perimeter in studs; across the edge one tile covers the whole profile
        const M = MATS.get(Zs.edge.mat), xs = u*per, ys = (0.5 - v)*M.tile[1]*Zs.edge.scale;
        SE(xs, ys, se); zcol(Zs.edge, se, type === 'embroidered' || type === 'pvc' ? ed : bg, tc);
        r = tc[0]; g = tc[1]; b = tc[2]; h = 0; ro = (type === 'pvc' ? P.roughBg : 0.7) + se.rd; dnX[i] = se.nx; dnY[i] = se.ny;
      }
      else if(type === 'embroidered'){
        // merrow wrap stitches: slanted threads around the tube
        const nper = per/Math.max(0.0042, 5/(SW/per));     // number of wraps
        const tt = frac(u*nper + v*0.9);
        const th = Math.pow(Math.sin(Math.PI*tt), 0.55);
        const sh = 0.62 + 0.5*th + (noise(px*0.3, py*0.3) - 0.5)*0.08;
        r = ed[0]*sh; g = ed[1]*sh; b = ed[2]*sh; h = th*0.8; ro = 0.6;
      } else {
        const base = bg, sh = (type === 'pvc' ? 0.92 : 0.78) + (noise(px*0.4, py*0.4) - 0.5)*0.08;
        r = base[0]*sh; g = base[1]*sh; b = base[2]*sh; h = noise2(px*0.5, py*0.5)*0.2; ro = type === 'pvc' ? P.roughBg : 0.74;
      }
      col[i*3] = r; col[i*3 + 1] = g; col[i*3 + 2] = b; hgt[i] = h; rgh[i] = ro;
    }
    void plen;
  }
 
  // ---------------- encode maps
  const C = new Uint8ClampedArray(NP*4), Nm = new Uint8ClampedArray(NP*4), Rg = new Uint8ClampedArray(NP*4);
  const k = 2.2*(RES/1024)**0.5;
  for(let y = 0; y < RES; y++) for(let x = 0; x < RES; x++){
    const i = y*RES + x;
    const g2 = j => Math.pow(clamp(col[j], 0, 1), 1)*255;
    C[i*4] = g2(i*3); C[i*4 + 1] = g2(i*3 + 1); C[i*4 + 2] = g2(i*3 + 2); C[i*4 + 3] = 255;
    const xl = x > 0 ? i - 1 : i, xr = x < RES - 1 ? i + 1 : i, yu = y > 0 ? i - RES : i, yd = y < RES - 1 ? i + RES : i;
    // keep regions apart: don't take slopes across the front/bottom boundary
    const cross = (y === HF - 1) || (y === HF);
    const dx = (hgt[xr] - hgt[xl])*k, dy = cross ? 0 : (hgt[yd] - hgt[yu])*k;
    const kd = 0.5 + 0.5*P.relief;
    let nx = -dx + dnX[i]*kd, ny = dy + dnY[i]*kd, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    Nm[i*4] = (nx*0.5 + 0.5)*255; Nm[i*4 + 1] = (ny*0.5 + 0.5)*255; Nm[i*4 + 2] = (nz*0.5 + 0.5)*255; Nm[i*4 + 3] = 255;
    const rv = clamp(rgh[i], 0.02, 1)*255; Rg[i*4] = Rg[i*4 + 1] = Rg[i*4 + 2] = rv; Rg[i*4 + 3] = 255;
  }
  void R;
  // 16-bit height (32768 = flat), for engines/tools that use a height or displacement map
  const Hg = new Uint16Array(NP); for(let i = 0; i < NP; i++) Hg[i] = Math.max(0, Math.min(65535, Math.round(32768 + hgt[i]*8000)));
  return { RES, L, geo:G.geo, color:C, normal:Nm, rough:Rg, height:Hg, dims:[P.w, P.h, Math.max(P.t, mer*2)] };
}

// ------------------------------------------------------------------ export helpers
const toCanvas = (rgba, W, H) => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0); return c; };
const pngOf = c => new Promise(res => c.toBlob(b => res(b), 'image/png'));
export function objOf(geo, name){
  const P = geo.attributes.position.array, U = geo.attributes.uv.array, N = geo.attributes.normal.array;
  const out = ['# TYC Painter — Patch Creator', `mtllib ${name}.mtl`, `o ${name}`];
  const vk = new Map(), tk = new Map(), nk = new Map(), V = [], T = [], NN = [], F = [];
  const idx = (map, arr, k) => { let i = map.get(k); if(i === undefined){ i = arr.length; map.set(k, i); arr.push(k); } return i + 1; };
  for(let i = 0; i < P.length/3; i++){
    const v = idx(vk, V, `${P[i*3].toFixed(6)} ${P[i*3 + 1].toFixed(6)} ${P[i*3 + 2].toFixed(6)}`);
    const tt = idx(tk, T, `${U[i*2].toFixed(6)} ${U[i*2 + 1].toFixed(6)}`);
    const n = idx(nk, NN, `${N[i*3].toFixed(5)} ${N[i*3 + 1].toFixed(5)} ${N[i*3 + 2].toFixed(5)}`);
    F.push(`${v}/${tt}/${n}`);
  }
  for(const v of V) out.push('v ' + v);
  for(const x of T) out.push('vt ' + x);
  for(const n of NN) out.push('vn ' + n);
  out.push(`usemtl ${name}`, 's 1');
  for(let i = 0; i < F.length; i += 3) out.push(`f ${F[i]} ${F[i + 1]} ${F[i + 2]}`);
  return out.join('\n') + '\n';
}
const mtlOf = (name, nmap = `${name}_nmap.png`) => `newmtl ${name}\nKd 1 1 1\nmap_Kd ${name}_diff.png\nmap_Bump ${nmap}\nmap_Pr ${name}_rough.png\n`;

// opts.dx: write the normal PNG in DirectX convention (green flipped). opts.height: add a 16-bit height PNG.
// The GLB always keeps OpenGL normals, as glTF requires.
export async function packFiles(P, R, name, opts = {}){
  const W = R.RES;
  const cC = toCanvas(R.color, W, W), cN = toCanvas(R.normal, W, W), cR = toCanvas(R.rough, W, W);
  const files = [
    { name:`${name}.obj`, data:new TextEncoder().encode(objOf(R.geo, name)) },
    { name:`${name}.mtl`, data:new TextEncoder().encode(mtlOf(name, opts.dx ? `${name}_nmap_dx.png` : undefined)) },
    { name:`${name}_diff.png`, blob:await pngOf(cC) },
    { name:opts.dx ? `${name}_nmap_dx.png` : `${name}_nmap.png`, blob:opts.dx ? await dataPNG(W, W, R.normal, 'normal', true) : await pngOf(cN) },
    { name:`${name}_rough.png`, blob:await pngOf(cR) },
  ];
  if(opts.height && R.height) files.push({ name:`${name}_height.png`, blob:await dataPNG(W, W, R.height, 'height') });
  return { files, canvases:{ cC, cN, cR } };
}
// One map as a PNG (for "Export selected map")
export async function mapPNG(R, which, dx = false){
  const W = R.RES;
  if(which === 'height') return dataPNG(W, W, R.height, 'height');
  if(which === 'normal') return dx ? dataPNG(W, W, R.normal, 'normal', true) : pngOf(toCanvas(R.normal, W, W));
  return pngOf(toCanvas(which === 'rough' ? R.rough : R.color, W, W));
}
export async function glbOf(R, canv, name){
  // glTF: metres. 1 stud = 0.28 m; Roblox's importer converts back to studs.
  const g = R.geo.clone(); g.scale(0.28, 0.28, 0.28);
  // metallic-roughness texture: G = roughness, B = metalness (0)
  const W = R.RES, mr = new Uint8ClampedArray(W*W*4);
  for(let i = 0; i < W*W; i++){ mr[i*4 + 1] = R.rough[i*4]; mr[i*4 + 3] = 255; }
  const tex = c => { const t2 = new THREE.CanvasTexture(c); t2.flipY = false; return t2; };
  // geometry UVs follow OBJ (v up); glTF wants v down
  const uv = g.attributes.uv.array; for(let i = 1; i < uv.length; i += 2) uv[i] = 1 - uv[i];
  const map = tex(canv.cC); map.colorSpace = THREE.SRGBColorSpace;
  const mrt = tex(toCanvas(mr, W, W));
  const mat = new THREE.MeshStandardMaterial({ name, map, normalMap:tex(canv.cN), roughnessMap:mrt, metalnessMap:mrt, roughness:1, metalness:0 });
  const mesh = new THREE.Mesh(g, mat); mesh.name = name;
  const sc = new THREE.Scene(); sc.add(mesh);
  const buf = await new GLTFExporter().parseAsync(sc, { binary:true });
  return new Uint8Array(buf);
}
export const README = (name, dims) => t('pc.readme', name, dims.map(v => v.toFixed(3)).join(' × '));

// ------------------------------------------------------------------ UI
export function initPatchStudio(api){
  const $ = id => document.getElementById(id);
  const root = $('patchStudio'); if(!root) return null;
  let P = defaults('callsign'), last = null, busy = false, again = false, timer = 0;
  // 3D preview
  const cv = $('pcView');
  const renderer = new THREE.WebGLRenderer({ canvas:cv, antialias:true, preserveDrawingBuffer:true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x15171a);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.001, 50); cam.position.set(0.18, 0.12, 1.15);
  const ctl = new OrbitControls(cam, cv); ctl.enableDamping = true; ctl.target.set(0, 0, 0);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(0.6, 0.9, -1.2); scene.add(key);
  const mat = new THREE.MeshStandardMaterial({ roughness:1, metalness:0 });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); scene.add(mesh);
  const tex2D = $('pcTex');
  let open = false, view = '3d';
  function size(){ const r = cv.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width/Math.max(1, r.height); cam.updateProjectionMatrix(); }
  new ResizeObserver(() => open && size()).observe(cv);
  function loop(){ if(!open) return; ctl.update(); key.position.set(Math.sin(+$('pcLight').value*Math.PI/180)*1.3, 0.9, -Math.cos(+$('pcLight').value*Math.PI/180)*1.3); renderer.render(scene, cam); requestAnimationFrame(loop); }
  function frame(){ const s = Math.max(P.w, P.h); cam.position.set(-s*0.35, s*0.22, -s*2.6); ctl.target.set(0, 0, 0); ctl.update(); }

  const mkTex = (rgba, W, srgb) => { const tx = new THREE.DataTexture(rgba, W, W); tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; tx.anisotropy = 8; tx.generateMipmaps = true; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.magFilter = THREE.LinearFilter; tx.needsUpdate = true; return tx; };
  let mapView = 'color';
  function draw2D(R){
    if(!R) return;
    let src = R[mapView === 'rough' ? 'rough' : mapView === 'normal' ? 'normal' : 'color'];
    if(mapView === 'height'){ src = new Uint8ClampedArray(R.RES*R.RES*4); for(let i = 0; i < R.RES*R.RES; i++){ const v = Math.max(0, Math.min(255, 128 + (R.height[i] - 32768)/64)); src[i*4] = src[i*4 + 1] = src[i*4 + 2] = v; src[i*4 + 3] = 255; } }
    tex2D.width = R.RES; tex2D.height = R.RES; tex2D.getContext('2d').drawImage(toCanvas(src, R.RES, R.RES), 0, 0);
  }
  function show(R){
    // DataTexture rows start at the bottom; flip the arrays so UVs (v up) match the PNGs
    const flip = a => { const W = R.RES, o = new Uint8ClampedArray(a.length); for(let y = 0; y < W; y++) o.set(a.subarray((W - 1 - y)*W*4, (W - y)*W*4), y*W*4); return o; };
    for(const k of ['map', 'normalMap', 'roughnessMap']) if(mat[k]) mat[k].dispose();
    const c = mkTex(flip(R.color), R.RES, true), n = mkTex(flip(R.normal), R.RES, false), r = mkTex(flip(R.rough), R.RES, false);
    c.flipY = n.flipY = r.flipY = false;
    mat.map = c; mat.normalMap = n; mat.roughnessMap = r; mat.needsUpdate = true;
    mesh.geometry.dispose(); mesh.geometry = R.geo;
    // 2D atlas view
    draw2D(R);
    $('pcInfo').textContent = t('pc.info', R.dims.map(v => v.toFixed(3)).join(' × '), R.RES);
  }
  // While editing, a fast 512 preview; after a short pause, the full-size maps.
  let fullT = 0, lastFull = false;
  async function regen(quick = false){
    if(busy){ again = again === 'full' ? 'full' : (quick ? 'quick' : 'full'); return; }
    busy = true; $('pcBusy').hidden = false; clearTimeout(fullT);
    try{
      await new Promise(r => setTimeout(r, 15));
      const res = quick ? Math.min(512, P.res) : P.res;
      last = await generate(Object.assign({}, P, { res })); lastFull = res === P.res; show(last);
    }
    catch(e){ console.error(e); api.toast(String(e.message || e)); }
    finally{
      busy = false; $('pcBusy').hidden = true;
      if(again){ const q = again === 'quick'; again = false; regen(q); }
      else if(!lastFull) fullT = setTimeout(() => regen(false), 650);
    }
  }
  const schedule = (ms = 160) => { clearTimeout(timer); clearTimeout(fullT); timer = setTimeout(() => regen(true), ms); };
  async function ensureFull(){ if(!last || !lastFull || busy){ while(busy) await new Promise(r => setTimeout(r, 50)); if(!lastFull) await regen(false); } }

  // ------------- controls
  const seg = (id, key, after) => {
    const el = $(id);
    el.querySelectorAll('button').forEach(b => b.onclick = () => { P[key] = b.dataset.v; after && after(b.dataset.v); sync(); schedule(80); });
  };
  seg('pcMode', 'mode');
  seg('pcType', 'type', v => { P = applyType(P, v); frame(); });
  const traceShape = () => {
    const c = P.img && silhouette(P.img);
    if(!c){ P.custom = null; api.toast(t('pc.trace.fail')); return false; }
    P.custom = c; customSize(P); P.content = 'image'; return true;
  };
  seg('pcShape', 'shape', v => { if(v === 'custom'){ if(P.img) traceShape(); else fileIn.click(); frame(); return; } if(v === 'circle'){ P.h = P.w = Math.max(P.w, P.h)*0.7; } else if(P.mode === 'auto'){ const T = TYPES[P.type]; P.w = T.w; P.h = T.h; if(v === 'shield'){ P.w = T.h*1.05; P.h = T.h*1.3; } if(v === 'oval'){ P.w = T.w; P.h = T.h*1.05; } } frame(); });
  seg('pcContent', 'content');
  seg('pcFit', 'imgFit');
  $('pcText').oninput = e => { P.text = e.target.value; drawFontList(); schedule(); };
  const colorIn = (id, key) => { $(id).oninput = e => { P[key] = e.target.value; schedule(120); }; };
  colorIn('pcBg', 'bg'); colorIn('pcFg', 'fg'); colorIn('pcEd', 'ed');
  const chk = (id, key) => { $(id).onchange = e => { P[key] = e.target.checked; schedule(60); }; };
  chk('pcStitch', 'stitch'); chk('pcMono', 'imgMono'); chk('pcInvert', 'imgInvert'); chk('pcKnock', 'imgKnock'); chk('pc3d', 'img3d');
  // swatches: click = background, shift/right click = letters
  const sw = $('pcSwatches');
  sw.innerHTML = SWATCHES.map(([c, n]) => `<i style="background:${c}" data-c="${c}" title="${n}"></i>`).join('');
  sw.onclick = e => { const c = e.target.dataset && e.target.dataset.c; if(!c) return; const k = e.shiftKey ? 'fg' : (e.altKey ? 'ed' : 'bg'); P[k] = c; if(k === 'bg' && P.type !== 'pvc' && P.type !== 'lasercut') P.ed = c; sync(); schedule(60); };
  sw.oncontextmenu = e => { e.preventDefault(); const c = e.target.dataset && e.target.dataset.c; if(!c) return; P.fg = c; sync(); schedule(60); };
  // manual sliders: [id, key, min, max, step, fmt]
  const SL = [
    ['pcW', 'w', 0.15, 1.2, 0.001, v => v.toFixed(3)], ['pcH', 'h', 0.1, 1.2, 0.001, v => v.toFixed(3)], ['pcT', 't', 0.003, 0.05, 0.0005, v => v.toFixed(4)],
    ['pcEdge', 'edge', 0.0005, 0.02, 0.0005, v => v.toFixed(4)], ['pcBorder', 'border', 0, 0.2, 0.005, v => Math.round(v*100) + '%'],
    ['pcTextH', 'textH', 0.15, 0.9, 0.01, v => Math.round(v*100) + '%'], ['pcSpacing', 'spacing', -0.1, 0.4, 0.01, v => v.toFixed(2)], ['pcTextY', 'textY', -0.3, 0.3, 0.01, v => v.toFixed(2)],
    ['pcDepth', 'depth', 0, 2.5, 0.05, v => v.toFixed(2)], ['pcRelief', 'relief', 0, 3, 0.05, v => v.toFixed(2)],
    ['pcRoughBg', 'roughBg', 0.2, 1, 0.01, v => v.toFixed(2)], ['pcRoughFg', 'roughFg', 0.1, 1, 0.01, v => v.toFixed(2)], ['pcWeave', 'weave', 0.4, 2.5, 0.05, v => v.toFixed(2) + '×'],
  ];
  for(const [id, k, mn, mx, st, fmt] of SL){
    const el = $(id); el.min = mn; el.max = mx; el.step = st;
    el.oninput = () => { P[k] = +el.value; $(id + 'O').textContent = fmt(+el.value); schedule(); };
  }
  $('pcSeed').onclick = () => { P.seed = (Math.random()*1e6) | 0; $('pcSeedValue').value = P.seed; schedule(20); };
  $('pcRes').onchange = e => { P.res = +e.target.value; schedule(20); };
  $('pcReset').onclick = () => { P = applyType(P, P.type); sync(); frame(); schedule(20); };
  // image
  const fileIn = $('pcFile');
  $('pcImgBtn').onclick = () => fileIn.click();
  async function loadImage(f){
    try{ P.img = await createImageBitmap(f); P.imgName = f.name; P.content = 'image'; if(P.shape === 'custom'){ traceShape(); frame(); } sync(); schedule(20); }
    catch{ api.toast(t('pc.badimg')); }
  }
  fileIn.onchange = async () => { const f = fileIn.files[0]; if(f) await loadImage(f); fileIn.value = ''; };
  // ------------- materials: zones + shelf (References · Poly Haven · ambientCG)
  let zone = 'bg', shelfTab = 'ref';
  const L2 = pair => pair ? pair[document.documentElement.lang === 'es' ? 1 : 0] : '';
  const Z = () => P.zones[zone];
  function syncZone(){
    const z = Z(), M = MATS.get(z.mat);
    $('pcZone').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === zone));
    $('pcZoneName').textContent = M ? (typeof M.name === 'string' ? M.name : L2(M.name)) : z.mat;
    $('pcZoneSrc').textContent = M ? t('pc.src.' + M.src) : '';
    $('pcZoneThumb').style.background = M && M.thumb ? `url(${M.thumb}) center/cover` : 'repeating-linear-gradient(45deg,#2a2e32 0 6px,#1d2023 6px 12px)';
    $('pcZoneOwn').checked = !!z.own; $('pcZoneOwn').disabled = !M || M.src === 'proc';
    $('pcZScale').value = Math.round(Math.log2(z.scale)*100); $('pcZScaleO').textContent = Math.round(z.scale*100) + '%';
    $('pcZRot').value = z.rot; $('pcZRotO').textContent = z.rot + '°';
    $('pcZoneOpts').hidden = !M || M.src === 'proc';
    document.querySelectorAll('#pcShelfGrid .mat').forEach(el => el.classList.toggle('on', el.dataset.id === z.mat));
  }
  $('pcZone').querySelectorAll('button').forEach(b => b.onclick = () => { zone = b.dataset.v; syncZone(); });
  $('pcZoneOwn').onchange = e => { Z().own = e.target.checked; schedule(60); };
  $('pcZScale').oninput = e => { Z().scale = Math.pow(2, +e.target.value/100); $('pcZScaleO').textContent = Math.round(Z().scale*100) + '%'; schedule(); };
  $('pcZRot').oninput = e => { Z().rot = +e.target.value; $('pcZRotO').textContent = Z().rot + '°'; schedule(); };
  $('pcZoneProc').onclick = () => setZoneMat('proc');
  $('pcZoneReset').onclick = () => { P.zones[zone] = defaultZones(P.type)[zone]; syncZone(); syncIR(); schedule(40); };
  function setZoneMat(id, own){
    const z = Z(); z.mat = id; if(own !== undefined) z.own = own; z.scale = 1; z.rot = 0;
    syncZone(); syncIR(); schedule(40);
  }
  const syncIR = () => { $('pcIR').checked = P.zones.art.mat === 'ref:irlight'; };
  $('pcIR').onchange = e => { P.zones.art = Object.assign(P.zones.art, { mat:e.target.checked ? 'ref:irlight' : 'proc', own:false }); P.ir = e.target.checked; syncZone(); schedule(40); };

  // shelf
  const grid = $('pcShelfGrid'), msg = $('pcShelfMsg');
  function tile(o){
    const el = document.createElement('div'); el.className = 'mat'; el.dataset.id = o.id;
    el.innerHTML = '<i class="th"></i><span></span><small></small>';
    el.querySelector('span').textContent = o.label; el.querySelector('span').title = o.label; el.querySelector('small').textContent = o.sub || '';
    if(o.thumb) el.querySelector('.th').style.background = `url(${o.thumb}) center/cover`;
    else if(o.swatch) el.querySelector('.th').style.background = o.swatch;
    el.onclick = async () => {
      if(el.classList.contains('loading')) return;
      el.classList.add('loading');
      try{ await o.pick(); } catch(e){ console.error(e); api.toast(t('pc.dlfail', e.message || e)); }
      el.classList.remove('loading');
      document.querySelectorAll('#pcShelfGrid .mat').forEach(x => x.classList.toggle('on', x === el));
    };
    el.classList.toggle('on', o.id === Z().mat);
    grid.appendChild(el); return el;
  }
  async function showRefs(){
    grid.innerHTML = ''; msg.textContent = t('pc.shelf.refs');
    const cat = await loadRefMaterials();
    tile({ id:'proc', label:t('pc.src.proc'), sub:t('pc.shelf.proc'), swatch:'repeating-linear-gradient(45deg,#3a3f44 0 6px,#23272b 6px 12px)', pick:() => setZoneMat('proc') });
    // materials that suit the active zone first
    const list = [...cat].sort((a, b) => (b.zones.includes(zone) ? 1 : 0) - (a.zones.includes(zone) ? 1 : 0));
    for(const c of list){ const M = MATS.get('ref:' + c.id); tile({ id:M.id, label:L2(M.name), sub:'TYC · ' + Math.round(M.tile[0]*1000)/1000 + ' st', thumb:M.thumb, pick:() => setZoneMat(M.id, false) }); }
  }
  // Poly Haven (CC0): full list once, filtered locally
  const PHL = { list:null };
  const PH_DEFAULT = /fabric|cloth|leather|rubber|plastic|carpet|denim|canvas|felt|nylon|wool|velvet|knit/i;
  async function showPH(q){
    grid.innerHTML = ''; msg.textContent = t('pc.shelf.connecting');
    if(!PHL.list){
      const all = await api.netJSON('https://api.polyhaven.com/assets?t=textures');
      PHL.list = Object.entries(all).map(([id, a]) => ({ id, ...a })).sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    }
    const qq = (q || '').trim().toLowerCase();
    const L = PHL.list.filter(a => {
      const hay = [a.id, a.name || '', ...(a.categories || []), ...(a.tags || [])].join(' ').toLowerCase();
      return qq ? hay.includes(qq) : PH_DEFAULT.test(hay);
    }).slice(0, 120);
    msg.textContent = L.length ? t('pc.shelf.count', L.length) + ' · Poly Haven (CC0)' : t('pc.shelf.none');
    for(const a of L){
      const id = 'ph:' + a.id;
      tile({ id, label:a.name || a.id, sub:'Poly Haven', thumb:`https://cdn.polyhaven.com/asset_img/thumbs/${a.id}.png?width=192&height=192`, pick:async () => {
        if(!MATS.get(id)){
          const files = await api.netJSON('https://api.polyhaven.com/files/' + a.id);
          const grab = async re => {
            const k = Object.keys(files).find(x => re.test(x)); if(!k) return null;
            const rs = files[k]['1k'] || files[k]['2k'] || Object.values(files[k])[0]; const f = rs.jpg || rs.png || Object.values(rs)[0];
            return createImageBitmap(await api.netBlob(f.url));
          };
          const d = await grab(/^diff/i) || await grab(/col|albedo/i); if(!d) throw new Error(t('ph.nocolor'));
          const n = await grab(/^nor_gl/i).catch(() => null), r = await grab(/^rough/i).catch(() => null);
          const dims = a.dimensions ? a.dimensions[0]/1000/0.28 : 2/0.28;   // mm → studs
          makeMaterial({ id, name:a.name || a.id, src:'ph', tile:[Math.min(dims, REMOTE_TILE_MAX), Math.min(dims, REMOTE_TILE_MAX)] }, d, n, r);
        }
        setZoneMat(id, true);
      } });
    }
  }
  // ambientCG (CC0): search API
  const ACG_CACHE = new Map();
  async function showACG(q){
    grid.innerHTML = ''; msg.textContent = t('pc.shelf.connecting');
    const qq = (q || '').trim() || 'fabric';
    let found = ACG_CACHE.get(qq);
    if(!found){
      // the v2 API renamed its "include" groups over time: try the current and the older names
      const base = 'https://ambientcg.com/api/v2/full_json?type=Material&limit=90&sort=Popular&q=' + encodeURIComponent(qq);
      let err = null; found = null;
      for(const inc of ['&include=imageData,downloadData,previewData,fileData', '&include=imageData,downloadData', '']){
        try{ const j = await api.netJSON(base + inc); found = j.foundAssets || j.assets || []; if(found.length || !inc) break; } catch(e){ err = e; }
      }
      if(!found) throw err || new Error('ambientCG');
      ACG_CACHE.set(qq, found);
    }
    msg.textContent = found.length ? t('pc.shelf.count', found.length) + ' · ambientCG (CC0)' : t('pc.shelf.none');
    for(const a of found){
      const aid = a.assetId || a.id, id = 'acg:' + aid;
      const pv = a.previewImage || {};
      const thumbUrl = pv['256-PNG'] || pv['256-JPG-242424'] || pv['128-PNG'] || Object.values(pv)[0] || `https://acg-media.struffelproductions.com/file/ambientCG-Web/media/thumbnail/256-JPG-242424/${aid}.jpg`;
      const el = tile({ id, label:a.displayName || aid, sub:'ambientCG', pick:async () => {
        if(!MATS.get(id)){
          let link = null;
          try{ const dl = a.downloadFolders.default.downloadFiletypeCategories.zip.downloads; const pickD = dl.find(x => /^1K-JPG$/i.test(x.attribute)) || dl.find(x => /1K/i.test(x.attribute)) || dl[0]; link = pickD.fullDownloadPath || pickD.downloadLink; } catch{}
          link = link || `https://ambientcg.com/get?file=${aid}_1K-JPG.zip`;
          const zip = await JSZip.loadAsync(await (await api.netBlob(link)).arrayBuffer());
          const find = re => { const f = Object.values(zip.files).find(x => re.test(x.name)); return f ? f.async('blob').then(b => createImageBitmap(b)) : null; };
          const d = await find(/_Color\.(jpe?g|png)$/i); if(!d) throw new Error(t('ph.nocolor'));
          const n = await find(/_NormalGL\.(jpe?g|png)$/i), r = await find(/_Roughness\.(jpe?g|png)$/i);
          const dim = a.dimensionX ? a.dimensionX/100/0.28 : REMOTE_TILE_MAX;
          makeMaterial({ id, name:a.displayName || aid, src:'acg', tile:[Math.min(dim, REMOTE_TILE_MAX), Math.min(dim, REMOTE_TILE_MAX)] }, d, n, r);
        }
        setZoneMat(id, true);
      } });
      // thumbnails come through the app (the page itself only loads local images)
      api.netBlob(thumbUrl).then(b => { el.querySelector('.th').style.background = `url(${URL.createObjectURL(b)}) center/cover`; }).catch(() => {});
    }
  }
  async function showShelf(){
    $('pcShelfTabs').querySelectorAll('button[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === shelfTab));
    $('pcShelfQ').hidden = shelfTab === 'ref'; $('pcShelfChips').hidden = shelfTab === 'ref';
    try{
      if(shelfTab === 'ref') await showRefs();
      else if(shelfTab === 'ph') await showPH($('pcShelfQ').value);
      else await showACG($('pcShelfQ').value);
    } catch(e){ console.error(e); msg.textContent = t('pc.shelf.fail'); }
  }
  $('pcShelfTabs').querySelectorAll('button[data-t]').forEach(b => b.onclick = () => { shelfTab = b.dataset.t; showShelf(); });
  let qT; $('pcShelfQ').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(showShelf, 450); });
  $('pcShelfChips').innerHTML = ['fabric', 'leather', 'rubber', 'plastic', 'carpet', 'felt', 'metal'].map(k => `<button data-q="${k}">${k}</button>`).join('');
  $('pcShelfChips').querySelectorAll('button').forEach(b => b.onclick = () => { $('pcShelfQ').value = b.dataset.q; showShelf(); });
  // fonts
  function drawFontList(){
    const box = $('pcFonts'); const txt = (P.text || 'VIPER').toUpperCase().split(/\n/)[0].slice(0, 12) || 'VIPER';
    box.innerHTML = Object.entries(FONTS).map(([k, f]) => `<button data-v="${k}" class="${P.font === k ? 'on' : ''}"><b style="font-family:'${f.family}'${f.bold ? ';-webkit-text-stroke:1px currentColor' : ''}">${txt.replace(/[<&>]/g, '')}</b><small>${f.label}</small></button>`).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = () => { P.font = b.dataset.v; drawFontList(); schedule(40); });
  }
  // view toggles
  $('pcViewMode').querySelectorAll('button').forEach(b => b.onclick = () => { view = b.dataset.v; $('pcViewMode').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); root.querySelector('.pcViewArea').dataset.view = view; $('pcMap').hidden = view === '3d'; size(); });
  $('pcMap').onchange = e => { mapView = e.target.value; draw2D(last); };
  $('pcSeedValue').onchange = e => { const v = Math.max(0, Math.min(2147483647, Math.floor(+e.target.value || 0))); P.seed = v; schedule(20); };
  $('pcFrame').onclick = frame;

  function sync(){
    const setSeg = (id, v) => $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    setSeg('pcMode', P.mode); setSeg('pcType', P.type); setSeg('pcShape', P.shape); setSeg('pcContent', P.content); setSeg('pcFit', P.imgFit);
    $('pcFitRow').hidden = P.shape === 'custom'; $('pcCustomHint').hidden = P.shape !== 'custom';
    $('pcManual').hidden = P.mode !== 'manual';
    $('pcTextBox').hidden = P.content !== 'text'; $('pcImgBox').hidden = P.content !== 'image';
    $('pcImgName').textContent = P.imgName || t('pc.noimg');
    $('pcText').value = P.text;
    $('pcBg').value = P.bg; $('pcFg').value = P.fg; $('pcEd').value = P.ed;
    syncIR(); $('pcStitch').checked = P.stitch; $('pcMono').checked = P.imgMono; $('pcInvert').checked = P.imgInvert; $('pcKnock').checked = P.imgKnock; $('pc3d').checked = !!P.img3d; $('pc3dRow').hidden = P.type !== 'embroidered' || P.imgMono;
    $('pcIRRow').hidden = P.type !== 'callsign';
    $('pcStitchRow').hidden = !(P.type === 'callsign' || P.type === 'lasercut');
    $('pcEdRow').hidden = !(P.type === 'embroidered' || P.type === 'pvc' || P.type === 'lasercut');
    $('pcEdLabel').textContent = t(P.type === 'embroidered' ? 'pc.col.merrow' : P.type === 'pvc' ? 'pc.col.rim' : 'pc.col.frame');
    $('pcMonoRow').hidden = false;
    $('pcRes').value = String(P.res); $('pcSeedValue').value = P.seed;
    { const m = $('pcMap'), cur = mapView; m.replaceChildren(...['color', 'normal', 'rough', 'height'].map(v => new Option(t('pc.map.' + v), v))); m.value = cur; m.title = t('pc.map.select'); }
    for(const [id, k, , , , fmt] of SL){ $(id).value = P[k]; $(id + 'O').textContent = fmt(P[k]); }
    drawFontList(); syncZone();
  }
  // export
  const safeName = () => (P.content === 'text' ? (P.text || 'patch').split('\n')[0] : (P.imgName || 'patch').replace(/\.\w+$/, '')).replace(/[^\w\-]+/g, '_').slice(0, 24) + '_' + P.type;
  $('pcExport').onclick = async () => {
    await ensureFull(); if(!last) return; const name = safeName();
    $('pcBusy').hidden = false;
    try{
      const { files, canvases } = await packFiles(P, last, name, { dx:$('pcNormalFormat').value === 'dx', height:true });
      const zip = new JSZip(); for(const f of files) zip.file(f.name, f.blob || f.data);
      zip.file(`${name}.glb`, await glbOf(last, canvases, name));
      zip.file('README.txt', README(name, last.dims));
      await api.saveBytes(`${name}.zip`, await zip.generateAsync({ type:'uint8array' }), [{ name:'ZIP', extensions:['zip'] }]);
    } catch(e){ console.error(e); api.toast(String(e.message || e)); }
    finally{ $('pcBusy').hidden = true; }
  };
  $('pcExportMap').onclick = async () => {
    await ensureFull(); if(!last) return; const name = safeName(), dx = $('pcNormalFormat').value === 'dx';
    try{
      const blob = await mapPNG(last, mapView, dx), suf = { color:'diff', normal:dx ? 'nmap_dx' : 'nmap', rough:'rough', height:'height' }[mapView];
      await api.saveBytes(`${name}_${suf}.png`, new Uint8Array(await blob.arrayBuffer()), [{ name:'PNG', extensions:['png'] }]);
    } catch(e){ console.error(e); api.toast(String(e.message || e)); }
  };
  $('pcToPainter').onclick = async () => {
    await ensureFull(); if(!last) return; const name = safeName();
    $('pcBusy').hidden = false;
    try{
      const { files } = await packFiles(P, last, name);
      const list = await Promise.all(files.map(async f => ({ name:f.name, data:f.data ? f.data.buffer : await f.blob.arrayBuffer() })));
      close();
      await api.openModelFiles(list, `${name}.obj`);
    } catch(e){ console.error(e); api.toast(String(e.message || e)); }
    finally{ $('pcBusy').hidden = true; }
  };
  $('pcClose').onclick = () => close();
  root.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });
  function close(){ open = false; root.hidden = true; api.onClose && api.onClose(); }
  async function openStudio(){
    root.hidden = false; open = true; size(); sync(); await Promise.all([loadFonts(), hookData(), loadRefMaterials()]); drawFontList(); syncZone(); showShelf(); frame(); loop(); if(!last) regen(false);
  }
  return { open:openStudio, loadImage, relabel(){ if(!root.hidden){ sync(); if(last) $('pcInfo').textContent = t('pc.info', last.dims.map(v => v.toFixed(3)).join(' × '), last.RES); } } , get P(){ return P; }, set P(v){ P = v; sync(); frame(); schedule(10); }, regen, ensureFull, get last(){ return last; } };
}
