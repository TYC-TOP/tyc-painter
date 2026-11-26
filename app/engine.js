import {compositeLayers} from './layer-tree.js';
// TYC Painter — texture engine (layers, PBR channels, projections, generators).
// Pure data code: no UI. Canvas is only used for image resampling.

export const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
export const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
export function hexToRgb(h){ const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function rgbToHex(r, g, b){ return '#' + [r, g, b].map(x => Math.round(clamp255(x)).toString(16).padStart(2, '0')).join(''); }
export const lum = (r, g, b) => 0.3*r + 0.59*g + 0.11*b;

export function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s){ let h = (x*374761393 + y*668265263 + s*974711) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s){
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const sx = tx*tx*(3 - 2*tx), sy = ty*ty*(3 - 2*ty);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return (a*(1 - sx) + b*sx)*(1 - sy) + (c*(1 - sx) + d*sx)*sy;
}
export function fbm(x, y, s, oct = 4){
  let v = 0, amp = 0.5, tot = 0;
  for(let o = 0; o < oct; o++){ v += vnoise(x, y, s + o*17)*amp; tot += amp; x *= 2.03; y *= 2.03; amp *= 0.5; }
  return v/tot;
}

// ------------------------------------------------------------------ image sources
export function srcFromImage(im, max = 1024){
  const s = Math.min(1, max/Math.max(im.width, im.height));
  const w = Math.max(1, Math.round(im.width*s)), h = Math.max(1, Math.round(im.height*s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently:true }); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, 0, 0, w, h);
  return { w, h, data:ctx.getImageData(0, 0, w, h).data };
}
export function srcThumb(src, size = 96){
  const c = document.createElement('canvas'); c.width = src.w; c.height = src.h;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(src.data.buffer, src.data.byteOffset, src.w*src.h*4), src.w, src.h), 0, 0);
  const t = document.createElement('canvas'); t.width = t.height = size;
  t.getContext('2d').drawImage(c, 0, 0, size, size);
  return t.toDataURL('image/jpeg', 0.8);
}
// Resample an RGBA buffer with the browser's high quality scaler.
export function resampleRGBA(data, w, h, W, H){
  if(w === W && h === H) return new Uint8ClampedArray(data);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.buffer, data.byteOffset, w*h*4), w, h), 0, 0);
  const t = document.createElement('canvas'); t.width = W; t.height = H;
  const ctx = t.getContext('2d', { willReadFrequently:true }); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(c, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H).data;
}
export function resampleGray(data, w, h, W, H){
  if(w === W && h === H) return new Uint8Array(data);
  const rgba = new Uint8ClampedArray(w*h*4);
  for(let i = 0; i < w*h; i++){ rgba[i*4] = rgba[i*4+1] = rgba[i*4+2] = data[i]; rgba[i*4+3] = 255; }
  const r = resampleRGBA(rgba, w, h, W, H), out = new Uint8Array(W*H);
  for(let i = 0; i < W*H; i++) out[i] = r[i*4];
  return out;
}
// Mip pyramid (2×2 box) so minified sampling is neither noisy nor blurry.
export function mips(src){
  if(src.mips) return src.mips;
  const L = [src]; let c = src;
  while(c.w > 8 && c.h > 8){
    const w = Math.max(1, c.w >> 1), h = Math.max(1, c.h >> 1), d = new Uint8ClampedArray(w*h*4), s = c.data, cw = c.w;
    for(let y = 0; y < h; y++){
      const y0 = Math.min(c.h - 1, y*2), y1 = Math.min(c.h - 1, y*2 + 1);
      for(let x = 0; x < w; x++){
        const x0 = Math.min(cw - 1, x*2), x1 = Math.min(cw - 1, x*2 + 1), o = (y*w + x)*4;
        const a = (y0*cw + x0)*4, b = (y0*cw + x1)*4, e = (y1*cw + x0)*4, f = (y1*cw + x1)*4;
        d[o] = (s[a] + s[b] + s[e] + s[f])/4; d[o+1] = (s[a+1] + s[b+1] + s[e+1] + s[f+1])/4;
        d[o+2] = (s[a+2] + s[b+2] + s[e+2] + s[f+2])/4; d[o+3] = (s[a+3] + s[b+3] + s[e+3] + s[f+3])/4;
      }
    }
    c = { w, h, data:d }; L.push(c);
  }
  return src.mips = L;
}
function bilinear(L, u, v, o){ // u,v in [0,1]
  const W = L.w, H = L.h, d = L.data;
  const fx = u*W - 0.5, fy = v*H - 0.5;
  let x0 = Math.floor(fx), y0 = Math.floor(fy); const tx = fx - x0, ty = fy - y0;
  if(x0 < 0) x0 += W; else if(x0 >= W) x0 -= W; if(y0 < 0) y0 += H; else if(y0 >= H) y0 -= H;
  let x1 = x0 + 1; if(x1 >= W) x1 = 0; let y1 = y0 + 1; if(y1 >= H) y1 = 0;
  const a = (y0*W + x0)*4, b = (y0*W + x1)*4, c = (y1*W + x0)*4, e = (y1*W + x1)*4;
  const w00 = (1 - tx)*(1 - ty), w10 = tx*(1 - ty), w01 = (1 - tx)*ty, w11 = tx*ty;
  o[0] = d[a]*w00 + d[b]*w10 + d[c]*w01 + d[e]*w11;
  o[1] = d[a+1]*w00 + d[b+1]*w10 + d[c+1]*w01 + d[e+1]*w11;
  o[2] = d[a+2]*w00 + d[b+2]*w10 + d[c+2]*w01 + d[e+2]*w11;
  o[3] = d[a+3]*w00 + d[b+3]*w10 + d[c+3]*w01 + d[e+3]*w11;
}
function nearest(L, u, v, o){
  let x = Math.floor(u*L.w), y = Math.floor(v*L.h); if(x >= L.w) x = L.w - 1; if(y >= L.h) y = L.h - 1; if(x < 0) x = 0; if(y < 0) y = 0;
  const k = (y*L.w + x)*4, d = L.data; o[0] = d[k]; o[1] = d[k+1]; o[2] = d[k+2]; o[3] = d[k+3];
}
export function sampleSrc(src, u, v, o){ bilinear(src, u - Math.floor(u), v - Math.floor(v), o); return o; }
// Bilinear lookup in a low-res float/byte map.
export function sampleMap(m, u, v){
  const w=m.w, h=m.h, d=m.d;
  const fx=Math.max(0,Math.min(w-1,u*w-.5)), fy=Math.max(0,Math.min(h-1,v*h-.5));
  const x=Math.floor(fx), y=Math.floor(fy), right=Math.min(x+1,w-1), down=Math.min(y+1,h-1);
  const tx=fx-x, ty=fy-y;
  return (d[y*w+x]*(1-tx)+d[y*w+right]*tx)*(1-ty)+(d[down*w+x]*(1-tx)+d[down*w+right]*tx)*ty;
}

// ------------------------------------------------------------------ UV-space rasteriser
// Calls cb(x, y, w0, w1, w2) for every texel covered by the triangle (pixel coords, wrapping).
export function rasterTri(W, H, ax, ay, bx, by, cx, cy, cb){
  const minx = Math.min(ax, bx, cx), miny = Math.min(ay, by, cy);
  const sx = Math.floor(minx/W)*W, sy = Math.floor(miny/H)*H;
  ax -= sx; bx -= sx; cx -= sx; ay -= sy; by -= sy; cy -= sy;
  const area = (bx - ax)*(cy - ay) - (by - ay)*(cx - ax);
  if(Math.abs(area) < 1e-9) return;
  const e = Math.min(0.35, 0.8/Math.sqrt(Math.abs(area)));
  const x0 = Math.floor(Math.min(ax, bx, cx)), x1 = Math.ceil(Math.max(ax, bx, cx));
  const y0 = Math.floor(Math.min(ay, by, cy)), y1 = Math.ceil(Math.max(ay, by, cy));
  const ia = 1/area;
  for(let y = y0; y <= y1; y++){
    const py = y + 0.5, yy = ((y % H) + H) % H;
    for(let x = x0; x <= x1; x++){
      const px = x + 0.5;
      const w0 = ((cx - bx)*(py - by) - (cy - by)*(px - bx))*ia;
      const w1 = ((ax - cx)*(py - cy) - (ay - cy)*(px - cx))*ia;
      const w2 = 1 - w0 - w1;
      if(w0 < -e || w1 < -e || w2 < -e) continue;
      cb(((x % W) + W) % W, yy, w0, w1, w2);
    }
  }
}
// Grow covered texels outwards so filtering never pulls in empty texels at island borders.
function dilate(col, W, H, passes, extra){
  const N = W*H; let frontier = null;
  for(let it = 0; it < passes; it++){
    const add = [];
    const test = i => {
      if(col[i*4+3]) return;
      const x = i % W, y = (i/W) | 0;
      let j = -1;
      if(x > 0 && col[(i-1)*4+3]) j = i - 1; else if(x < W-1 && col[(i+1)*4+3]) j = i + 1;
      else if(y > 0 && col[(i-W)*4+3]) j = i - W; else if(y < H-1 && col[(i+W)*4+3]) j = i + W;
      if(j >= 0) add.push(i, j);
    };
    if(!frontier) for(let i = 0; i < N; i++) test(i);
    else for(const i of frontier){ const x = i % W, y = (i/W) | 0; if(x > 0) test(i-1); if(x < W-1) test(i+1); if(y > 0) test(i-W); if(y < H-1) test(i+W); }
    frontier = [];
    for(let k = 0; k < add.length; k += 2){
      const i = add[k], j = add[k+1]; if(col[i*4+3]) continue;
      col[i*4] = col[j*4]; col[i*4+1] = col[j*4+1]; col[i*4+2] = col[j*4+2]; col[i*4+3] = 254;
      for(const e of extra) if(e) e[i] = e[j];
      frontier.push(i);
    }
    if(!frontier.length) break;
  }
}

// ------------------------------------------------------------------ fill layers
// World units per texel (average), from the mesh's 3D area and UV area.
export function texelSize(P, U, W, H){
  let a3 = 0, a2 = 0;
  for(let i = 0, t = 0; i < P.length; i += 9, t += 6){
    const ax = P[i+3]-P[i], ay = P[i+4]-P[i+1], az = P[i+5]-P[i+2], bx = P[i+6]-P[i], by = P[i+7]-P[i+1], bz = P[i+8]-P[i+2];
    a3 += 0.5*Math.hypot(ay*bz - az*by, az*bx - ax*bz, ax*by - ay*bx);
    a2 += 0.5*Math.abs((U[t+2]-U[t])*(U[t+5]-U[t+1]) - (U[t+3]-U[t+1])*(U[t+4]-U[t]))*W*H;
  }
  return Math.sqrt(a3/Math.max(1, a2));
}
/* o = { W, H, P, Nn, U, src, roughSrc, solid:[r,g,b], proj:'uv'|'tri', filter:'bilinear'|'nearest', wrap:'repeat'|'mirror'|'none',
         tiling, rot(deg), offX, offY, modelSize, con, sat, bri, expo, colorize:[r,g,b]|null, wantRough, wantHeight }
   returns { uni } for flat colours or { col, rgh, hgt } */
export function renderFill(o){
  const { W, H, src } = o, N = W*H;
  const sat = 1 + (o.sat || 0), con = 1 + (o.con || 0), bri = (o.bri || 0)*150, expo = o.expo || 1, cz = o.colorize;
  const t = new Float64Array(4), acc = new Float64Array(4);
  const adjust = () => { // acc -> acc
    let r = acc[0], g = acc[1], b = acc[2];
    if(cz){ const k = lum(r, g, b)/128; r = cz[0]*k; g = cz[1]*k; b = cz[2]*k; }
    else { r *= expo; g *= expo; b *= expo; }
    const l = lum(r, g, b);
    r = l + (r - l)*sat; g = l + (g - l)*sat; b = l + (b - l)*sat;
    acc[0] = (r - 128)*con + 128 + bri; acc[1] = (g - 128)*con + 128 + bri; acc[2] = (b - 128)*con + 128 + bri;
  };
  if(!src){
    acc[0] = o.solid[0]; acc[1] = o.solid[1]; acc[2] = o.solid[2];
    const k = cz; if(k){ acc[0] = acc[1] = acc[2] = 128; }
    adjust();
    return { uni:[clamp255(acc[0]), clamp255(acc[1]), clamp255(acc[2])] };
  }
  const pyr = mips(src), rpyr = o.roughSrc && o.wantRough ? mips(o.roughSrc) : null;
  const hpyr = o.heightSrc && o.wantHeight ? mips(o.heightSrc) : null;
  const col = new Uint8ClampedArray(N*4), rgh = rpyr ? new Uint8Array(N) : null, hgt = o.wantHeight ? new Uint8Array(N) : null;
  const tri = o.proj === 'tri';
  const reps = tri ? o.tiling/o.modelSize : o.tiling;
  const foot = tri ? texelSize(o.P, o.U, W, H)*reps*src.w : reps*src.w/W;
  const near = o.filter === 'nearest';
  let level = Math.max(0, Math.log2(Math.max(1e-6, foot)));
  if(near) level = Math.max(0, Math.round(level - 0.25));
  const top = pyr.length - 1, l0 = Math.min(top, Math.floor(level)), l1 = Math.min(top, l0 + 1), lt = near ? 0 : level - Math.floor(level);
  const A = pyr[l0], B = pyr[l1], RA = rpyr ? rpyr[Math.min(rpyr.length - 1, l0)] : null;
  const HA=hpyr?hpyr[Math.min(hpyr.length-1,l0)]:null;
  const wrap = o.wrap === 'mirror' ? 1 : o.wrap === 'none' ? 2 : 0;
  // mean luminance for height
  let mean = 128; { const s = pyr[top]; let sl = 0; for(let i = 0; i < s.w*s.h; i++) sl += lum(s.data[i*4], s.data[i*4+1], s.data[i*4+2]); mean = sl/(s.w*s.h); }
  const t2 = new Float64Array(4);
  let rv = 0, hv=128;
  const samp = (u, v) => { // -> t ; returns false when outside (wrap none)
    if(wrap === 2){ if(u < 0 || u > 1 || v < 0 || v > 1) return false; }
    else if(wrap === 1){ u -= 2*Math.floor(u/2); if(u > 1) u = 2 - u; v -= 2*Math.floor(v/2); if(v > 1) v = 2 - v; }
    else { u -= Math.floor(u); v -= Math.floor(v); }
    if(near) nearest(A, u, v, t);
    else { bilinear(A, u, v, t); if(lt > 0.02 && l1 !== l0){ bilinear(B, u, v, t2); t[0] += (t2[0]-t[0])*lt; t[1] += (t2[1]-t[1])*lt; t[2] += (t2[2]-t[2])*lt; } }
    if(RA){ bilinear(RA, u, v, t2); rv = t2[0]; } if(HA){bilinear(HA,u,v,t2);hv=t2[0];}
    return true;
  };
  const rot = (o.rot || 0)*Math.PI/180, ox = o.offX || 0, oy = o.offY || 0, ka = 1/Math.max(0.05, o.sx || 1), kb = 1/Math.max(0.05, o.sy || 1);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const put = (i, hl) => {
    adjust();
    const k = i*4; col[k] = acc[0]; col[k+1] = acc[1]; col[k+2] = acc[2]; col[k+3] = 255;
    if(hgt) hgt[i] = HA ? clamp255(hl) : clamp255(128 + (hl - mean)*0.99);
  };
  if(!tri){
    for(let y = 0; y < H; y++){
      const vv = (y + 0.5)/H - 0.5;
      for(let x = 0; x < W; x++){
        const uu = (x + 0.5)/W - 0.5;
        if(!samp((cs*uu - sn*vv)*reps*ka + 0.5 + ox, (sn*uu + cs*vv)*reps*kb + 0.5 + oy)) continue;
        acc[0] = t[0]; acc[1] = t[1]; acc[2] = t[2];
        const i = y*W + x; if(rgh) rgh[i] = rv;
        put(i, HA?hv:lum(t[0], t[1], t[2]));
      }
    }
    return { col, rgh, hgt };
  }
  const P = o.P, Nn = o.Nn, U = o.U, pw = near ? 12 : 4;
  for(let v0 = 0; v0 < U.length/2; v0 += 3){
    const i0 = v0*3, i1 = i0 + 3, i2 = i0 + 6, u0 = v0*2;
    let fx = 0, fy = 0, fz = 0;
    if(!Nn){
      const ax = P[i1]-P[i0], ay = P[i1+1]-P[i0+1], az = P[i1+2]-P[i0+2], bx = P[i2]-P[i0], by = P[i2+1]-P[i0+1], bz = P[i2+2]-P[i0+2];
      fx = ay*bz - az*by; fy = az*bx - ax*bz; fz = ax*by - ay*bx;
    }
    rasterTri(W, H, U[u0]*W, (1 - U[u0+1])*H, U[u0+2]*W, (1 - U[u0+3])*H, U[u0+4]*W, (1 - U[u0+5])*H, (x, y, w0, w1, w2) => {
      const px = P[i0]*w0 + P[i1]*w1 + P[i2]*w2, py = P[i0+1]*w0 + P[i1+1]*w1 + P[i2+1]*w2, pz = P[i0+2]*w0 + P[i1+2]*w1 + P[i2+2]*w2;
      let nx = Nn ? Nn[i0]*w0 + Nn[i1]*w1 + Nn[i2]*w2 : fx, ny = Nn ? Nn[i0+1]*w0 + Nn[i1+1]*w1 + Nn[i2+1]*w2 : fy, nz = Nn ? Nn[i0+2]*w0 + Nn[i1+2]*w1 + Nn[i2+2]*w2 : fz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx = Math.pow(Math.abs(nx/nl), pw); ny = Math.pow(Math.abs(ny/nl), pw); nz = Math.pow(Math.abs(nz/nl), pw);
      let sw = 0, r = 0, g = 0, b = 0, rr = 0, hh = 0;
      if(nx > 0.01 && samp((cs*pz + sn*py)*reps*ka + ox, (sn*pz - cs*py)*reps*kb + oy)){ r += t[0]*nx; g += t[1]*nx; b += t[2]*nx; rr += rv*nx; hh += hv*nx; sw += nx; }
      if(ny > 0.01 && samp((cs*px - sn*pz)*reps*ka + ox, (sn*px + cs*pz)*reps*kb + oy)){ r += t[0]*ny; g += t[1]*ny; b += t[2]*ny; rr += rv*ny; hh += hv*ny; sw += ny; }
      if(nz > 0.01 && samp((cs*px + sn*py)*reps*ka + ox, (sn*px - cs*py)*reps*kb + oy)){ r += t[0]*nz; g += t[1]*nz; b += t[2]*nz; rr += rv*nz; hh += hv*nz; sw += nz; }
      if(sw <= 0) return;
      acc[0] = r/sw; acc[1] = g/sw; acc[2] = b/sw;
      const i = y*W + x; if(rgh) rgh[i] = rr/sw;
      put(i, HA?hh/sw:lum(acc[0], acc[1], acc[2]));
    });
  }
  dilate(col, W, H, W > 2048 ? 4 : W > 1024 ? 3 : 2, [rgh, hgt]);
  return { col, rgh, hgt };
}

// ------------------------------------------------------------------ procedural camouflage
function periodicNoise(size, gx, gy, rnd){
  const g = new Float32Array(gx*gy); for(let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(size*size);
  for(let y = 0; y < size; y++){ const fy = y/size*gy, iy = fy | 0; let ty = fy - iy; ty = ty*ty*(3 - 2*ty); const y0 = iy % gy, y1 = (iy + 1) % gy;
    for(let x = 0; x < size; x++){ const fx = x/size*gx, ix = fx | 0; let tx = fx - ix; tx = tx*tx*(3 - 2*tx); const x0 = ix % gx, x1 = (ix + 1) % gx;
      out[y*size + x] = (g[y0*gx + x0]*(1 - tx) + g[y0*gx + x1]*tx)*(1 - ty) + (g[y1*gx + x0]*(1 - tx) + g[y1*gx + x1]*tx)*ty; } }
  return out;
}
function quantize(vals, props){
  const s = Float32Array.from(vals).sort(); const th = []; let acc = 0;
  for(let i = 0; i < props.length - 1; i++){ acc += props[i]; th.push(s[Math.min(s.length - 1, Math.floor(acc*s.length))]); }
  const idx = new Uint8Array(vals.length);
  for(let i = 0; i < vals.length; i++){ let k = 0; while(k < th.length && vals[i] > th[k]) k++; idx[i] = k; }
  return idx;
}
export function makeCamo(type, cols, seed, size = 512){
  const rnd = mulberry(seed), data = new Uint8ClampedArray(size*size*4);
  let idx;
  if(type === 'digital'){
    const bs = 8, n = size/bs;
    const a = periodicNoise(n, 8, 8, rnd), b = periodicNoise(n, 24, 24, rnd);
    const q = quantize(a.map((v, i) => v*0.68 + b[i]*0.32), [0.36, 0.28, 0.2, 0.16]);
    idx = new Uint8Array(size*size);
    for(let y = 0; y < size; y++) for(let x = 0; x < size; x++) idx[y*size + x] = q[((y/bs) | 0)*n + ((x/bs) | 0)];
  } else {
    const gx = type === 'tiger' ? 4 : 6, gy = type === 'tiger' ? 22 : 6;
    const a = periodicNoise(size, gx, gy, rnd), b = periodicNoise(size, gx*3, gy*3, rnd);
    idx = quantize(a.map((v, i) => v*0.75 + b[i]*0.25), type === 'tiger' ? [0.45, 0.25, 0.18, 0.12] : [0.36, 0.28, 0.2, 0.16]);
  }
  const rgb = cols.map(hexToRgb);
  for(let i = 0; i < size*size; i++){ const c = rgb[idx[i]]; data[i*4] = c[0]; data[i*4+1] = c[1]; data[i*4+2] = c[2]; data[i*4+3] = 255; }
  return { w:size, h:size, data };
}

// ------------------------------------------------------------------ mesh maps
function blurF(arr, w, h, sigma){
  const r = Math.ceil(sigma*3), k = []; let ks = 0; for(let i = -r; i <= r; i++){ const v = Math.exp(-i*i/(2*sigma*sigma)); k.push(v); ks += v; }
  const t = new Float32Array(w*h), out = new Float32Array(w*h);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ let s = 0; for(let i = -r; i <= r; i++){ const xx = Math.min(w - 1, Math.max(0, x + i)); s += arr[y*w + xx]*k[i + r]; } t[y*w + x] = s/ks; }
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ let s = 0; for(let i = -r; i <= r; i++){ const yy = Math.min(h - 1, Math.max(0, y + i)); s += t[yy*w + x]*k[i + r]; } out[y*w + x] = s/ks; }
  return out;
}
/* Recover the hand-painted shading of the original texture WITHOUT its camouflage:
   ao = local high percentile (smoothed) relative to the median, fine = high-frequency detail (weave, fuzz). */
export function extractShade(o, W, H){
  const N = W*H, L = new Float32Array(N), valid = new Uint8Array(N);
  for(let i = 0; i < N; i++){ L[i] = lum(o[i*4], o[i*4+1], o[i*4+2]); valid[i] = L[i] > 10 ? 1 : 0; }
  const B = 8, w = Math.ceil(W/B), h = Math.ceil(H/B), base = new Float32Array(w*h), wt = new Float32Array(w*h), tmp = [];
  for(let by = 0; by < h; by++) for(let bx = 0; bx < w; bx++){
    tmp.length = 0;
    for(let y = by*B; y < Math.min(H, by*B + B); y++) for(let x = bx*B; x < Math.min(W, bx*B + B); x++){ const i = y*W + x; if(valid[i]) tmp.push(L[i]); }
    if(tmp.length > 8){ tmp.sort((a, b) => a - b); base[by*w + bx] = tmp[Math.floor(tmp.length*0.75)]; wt[by*w + bx] = 1; }
  }
  const bw = blurF(base.map((v, i) => v*wt[i]), w, h, 1.5), ww = blurF(wt, w, h, 1.5);
  const lowm = { d:new Float32Array(w*h), w, h };
  for(let i = 0; i < w*h; i++) lowm.d[i] = ww[i] > 1e-3 ? bw[i]/ww[i] : 0;
  const gl = blurF(L.map((v, i) => v*valid[i]), W, H, 1.2), gv = blurF(Float32Array.from(valid), W, H, 1.2);
  const vals = []; for(let i = 0; i < w*h; i++) if(wt[i]) vals.push(lowm.d[i]); vals.sort((a, b) => a - b);
  const ref = vals[vals.length >> 1] || 100;
  const ao = new Float32Array(N), fine = new Float32Array(N);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const i = y*W + x, lv = sampleMap(lowm, (x + 0.5)/W, (y + 0.5)/H);
    ao[i] = lv > 0 ? Math.min(1.5, lv/ref) : 1;
    if(!valid[i]){ fine[i] = 1; continue; }
    const g = gv[i] > 1e-3 ? gl[i]/gv[i] : L[i];
    fine[i] = Math.min(1.4, Math.max(0.6, L[i]/Math.max(1, g)));
  }
  return { ao:{ d:ao, w:W, h:H }, fine:{ d:fine, w:W, h:H }, valid:{ d:valid, w:W, h:H }, ref };
}
// Position / normal per texel at low resolution (for generators).
export function bakeGeo(P, Nn, U, W, H){
  const N = W*H, pos = new Float32Array(N*3), nrm = new Float32Array(N*3), cover = new Uint8Array(N);
  for(let v0 = 0; v0 < U.length/2; v0 += 3){
    const i0 = v0*3, i1 = i0 + 3, i2 = i0 + 6, u0 = v0*2;
    let fx = 0, fy = 0, fz = 1;
    if(!Nn){
      const ax = P[i1]-P[i0], ay = P[i1+1]-P[i0+1], az = P[i1+2]-P[i0+2], bx = P[i2]-P[i0], by = P[i2+1]-P[i0+1], bz = P[i2+2]-P[i0+2];
      fx = ay*bz - az*by; fy = az*bx - ax*bz; fz = ax*by - ay*bx; const l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l;
    }
    rasterTri(W, H, U[u0]*W, (1 - U[u0+1])*H, U[u0+2]*W, (1 - U[u0+3])*H, U[u0+4]*W, (1 - U[u0+5])*H, (x, y, w0, w1, w2) => {
      const i = (y*W + x)*3;
      pos[i] = P[i0]*w0 + P[i1]*w1 + P[i2]*w2; pos[i+1] = P[i0+1]*w0 + P[i1+1]*w1 + P[i2+1]*w2; pos[i+2] = P[i0+2]*w0 + P[i1+2]*w1 + P[i2+2]*w2;
      if(Nn){ nrm[i] = Nn[i0]*w0 + Nn[i1]*w1 + Nn[i2]*w2; nrm[i+1] = Nn[i0+1]*w0 + Nn[i1+1]*w1 + Nn[i2+1]*w2; nrm[i+2] = Nn[i0+2]*w0 + Nn[i1+2]*w1 + Nn[i2+2]*w2; }
      else { nrm[i] = fx; nrm[i+1] = fy; nrm[i+2] = fz; }
      cover[y*W + x] = 1;
    });
  }
  return { pos, nrm, cover, w:W, h:H };
}
// Curvature (convex > 0) from geometry normals plus the tangent-space normal map, normalised to about [-1, 1].
export function bakeCurvature(geo, nmap){
  const W = geo.w, H = geo.h, N = W*H, cg = new Float32Array(N), cn = new Float32Array(N), { pos, nrm, cover } = geo;
  for(let y = 1; y < H - 1; y++) for(let x = 1; x < W - 1; x++){
    const i = y*W + x; if(!cover[i]) continue;
    let s = 0, n = 0;
    for(const j of [i - 2, i + 2, i - 2*W, i + 2*W]){
      if(j < 0 || j >= N || !cover[j] || Math.abs(j%W-x)>2) continue;
      const dx = pos[j*3]-pos[i*3], dy = pos[j*3+1]-pos[i*3+1], dz = pos[j*3+2]-pos[i*3+2], l2 = dx*dx + dy*dy + dz*dz;
      if(l2 < 1e-12 || l2 > 0.05) continue;
      s += ((nrm[j*3]-nrm[i*3])*dx + (nrm[j*3+1]-nrm[i*3+1])*dy + (nrm[j*3+2]-nrm[i*3+2])*dz)/Math.sqrt(l2); n++;
    }
    if(n) cg[i] = s/n;
    if(nmap){ const k = i*4; cn[i] = (nmap[k+4] - nmap[k-4]) - (nmap[k + W*4 + 1] - nmap[k - W*4 + 1]); }
  }
  const norm = a => { let s = 0, c = 0; for(let i = 0; i < N; i++) if(cover[i]){ s += a[i]*a[i]; c++; } const sd = Math.sqrt(s/Math.max(1, c)) || 1; for(let i = 0; i < N; i++) a[i] /= 2.5*sd; };
  norm(cg); if(nmap) norm(cn);
  const out = new Float32Array(N);
  for(let i = 0; i < N; i++) out[i] = Math.max(-1, Math.min(1, cg[i]*0.7 + cn[i]*0.8));
  return { d:blurF(out, W, H, 0.8), w:W, h:H };
}

// ------------------------------------------------------------------ mask generators
/* ctx = { W, H, ao, curv, posY (low-res maps {d,w,h}), zones:[[x0,y0,x1,y1] in 1024 space], sel, islandsMask }
   g = { type, level 0..1, contrast 0..1, scale 0.1..8, invert, seed } */
export function genMask(g, ctx){
  const { W, H } = ctx, N = W*H, out = new Uint8Array(N);
  const type = g.type, lvl = g.level ?? 0.5, k = 1 + (g.contrast ?? 0.5)*14, sc = g.scale ?? 1, seed = g.seed | 0, inv = !!g.invert;
  if(type === 'white'){ out.fill(inv ? 0 : 255); return out; }
  if(type === 'black'){ out.fill(inv ? 255 : 0); return out; }
  if(type === 'zone'){
    const sx = W/1024, sy = H/1024; if(inv) out.fill(255);
    for(const [x0, y0, x1, y1] of (ctx.zones || [])) for(let y = Math.floor(y0*sy); y < Math.min(H, y1*sy); y++) for(let x = Math.floor(x0*sx); x < Math.min(W, x1*sx); x++) out[y*W + x] = inv ? 0 : 255;
    return out;
  }
  const f = 6*sc;
  for(let y = 0; y < H; y++){
    const v = (y + 0.5)/H;
    for(let x = 0; x < W; x++){
      const u = (x + 0.5)/W; let val;
      const n = fbm(u*f, v*f, seed, 4);
      if(type === 'dirt'){ const ao = ctx.ao ? sampleMap(ctx.ao, u, v) : 1; val = clamp01((1 - ao)*1.7)*0.72 + n*0.38; }
      else if(type==='dustUp'){const up=ctx.up ? sampleMap(ctx.up,u,v) : 0;val=up*(.75+.25*n);}
      else if(type === 'edges'){ const c = ctx.curv ? sampleMap(ctx.curv, u, v) : 0; val = clamp01(0.5 + c*1.6)*0.8 + n*0.3 - 0.1; }
      else if(type === 'cavity'){ const c = ctx.curv ? sampleMap(ctx.curv, u, v) : 0; val = clamp01(0.5 - c*1.6)*0.8 + n*0.3 - 0.1; }
      else if(type === 'gradient'){ const p = ctx.posY ? sampleMap(ctx.posY, u, v) : 1 - v; val = p*0.85 + n*0.15; }
      else val = fbm(u*f*1.7, v*f*1.7, seed + 5, 5); // noise
      let m = clamp01((val - (1 - lvl))*k + 0.5);
      out[y*W + x] = (inv ? 1 - m : m)*255;
    }
  }
  return out;
}

// ------------------------------------------------------------------ compositing
export const BLENDS = ['normal', 'multiply', 'detail', 'screen', 'overlay', 'add', 'darken', 'lighten', 'color', 'luminosity'];
const _sl = [0, 0, 0];
function setLum(r, g, b, l){ // W3C "color" blend helper -> _sl
  const d = l - lum(r, g, b); r += d; g += d; b += d;
  const L = lum(r, g, b), n = Math.min(r, g, b), x = Math.max(r, g, b);
  if(n < 0){ r = L + (r - L)*L/(L - n); g = L + (g - L)*L/(L - n); b = L + (b - L)*L/(L - n); }
  if(x > 255){ r = L + (r - L)*(255 - L)/(x - L); g = L + (g - L)*(255 - L)/(x - L); b = L + (b - L)*(255 - L)/(x - L); }
  _sl[0] = r; _sl[1] = g; _sl[2] = b;
}
/* p = { W, H, layers (bottom→top), out (RGBA), outR, outM (Uint8|null), outH (Int16|null), baseRough, baseMetal }
   Layer: { visible, opacity, blend, type, mask, ch:{color,rough,metal,height}, rough, metal, height, raster, cache:{col,uni,gray,rgh,hgt}, con, sat, bri, hue } */
export function composite(p, x0, y0, x1, y1){
  const { W, out, outR, outM, outH } = p, INV = 1/255;
  const r0 = Math.round(p.baseRough*255), m0 = Math.round(p.baseMetal*255);
  for(let y = y0; y <= y1; y++){
    const a = y*W + x0, b = y*W + x1 + 1;
    for(let i = a; i < b; i++){ const k = i*4; out[k] = out[k+1] = out[k+2] = 110; out[k+3] = 255; }
    if(outR){ if(p.originalR) outR.set(p.originalR.subarray(a,b),a); else outR.fill(r0,a,b); }
    if(outM){ if(p.originalM) outM.set(p.originalM.subarray(a,b),a); else outM.fill(m0,a,b); } if(outH) outH.fill(0, a, b);
  }
  for(const L of compositeLayers(p.layers)){
    if(!L.visible || L.opacity <= 0) continue;
    const m = L.mask, op = L.opacity;
    if(L.type === 'adjust'){
      const sat = 1 + (L.sat || 0), con = 1 + (L.con || 0), bri = (L.bri || 0)*150, hue = (L.hue || 0)*Math.PI/180;
      const ch = Math.cos(hue), sh = Math.sin(hue);
      // hue rotation matrix around the grey axis
      const h00 = 0.299 + 0.701*ch + 0.168*sh, h01 = 0.587 - 0.587*ch + 0.330*sh, h02 = 0.114 - 0.114*ch - 0.497*sh;
      const h10 = 0.299 - 0.299*ch - 0.328*sh, h11 = 0.587 + 0.413*ch + 0.035*sh, h12 = 0.114 - 0.114*ch + 0.292*sh;
      const h20 = 0.299 - 0.300*ch + 1.250*sh, h21 = 0.587 - 0.588*ch - 1.050*sh, h22 = 0.114 + 0.886*ch - 0.203*sh;
      for(let y = y0; y <= y1; y++) for(let x = x0, i = y*W + x0; x <= x1; x++, i++){
        let a = m ? op*m[i]*INV : op; if(L.groupMasks) for(const mask of L.groupMasks)a*=mask[i]*INV; if(a <= 0) continue;
        const k = i*4; let r = out[k], g = out[k+1], b = out[k+2];
        if(hue){ const R = r*h00 + g*h01 + b*h02, G = r*h10 + g*h11 + b*h12, B = r*h20 + g*h21 + b*h22; r = R; g = G; b = B; }
        const l = lum(r, g, b);
        r = ((l + (r - l)*sat) - 128)*con + 128 + bri; g = ((l + (g - l)*sat) - 128)*con + 128 + bri; b = ((l + (b - l)*sat) - 128)*con + 128 + bri;
        out[k] += (r - out[k])*a; out[k+1] += (g - out[k+1])*a; out[k+2] += (b - out[k+2])*a;
      }
      continue;
    }
    const c = L.cache || {}, ras = L.raster || c.col || null, gray = c.gray || null, uni = c.uni || [128, 128, 128];
    const mode = BLENDS.indexOf(L.blend), chC = L.ch.color, chR = L.ch.rough && outR, chM = L.ch.metal && outM, chH = L.ch.height && outH;
    const rgh = c.rgh || null, hgt = c.hgt || null, Lr = Math.round(L.rough*255), Lm = Math.round(L.metal*255), Lh = L.height*2048;
    if(!ras && !gray && !c.uni) continue;
    const opq = L.type === 'base';
    for(let y = y0; y <= y1; y++) for(let x = x0, i = y*W + x0; x <= x1; x++, i++){
      let a = m ? op*m[i]*INV : op; if(L.groupMasks) for(const mask of L.groupMasks)a*=mask[i]*INV; if(a <= 0) continue;
      const k = i*4; let sr, sg, sb;
      if(ras){ if(!opq){ const sa = ras[k+3]; if(!sa) continue; if(sa < 254) a *= sa*INV; } sr = ras[k]; sg = ras[k+1]; sb = ras[k+2]; }
      else if(gray){ sr = sg = sb = gray[i]; }
      else { sr = uni[0]; sg = uni[1]; sb = uni[2]; }
      if(chC){
        const dr = out[k], dg = out[k+1], db = out[k+2]; let r, g, b;
        switch(mode){
          case 1: r = dr*sr*INV; g = dg*sg*INV; b = db*sb*INV; break;
          case 2: r = dr*sr/128; g = dg*sg/128; b = db*sb/128; break;
          case 3: r = 255 - (255-dr)*(255-sr)*INV; g = 255 - (255-dg)*(255-sg)*INV; b = 255 - (255-db)*(255-sb)*INV; break;
          case 4: r = dr < 128 ? 2*dr*sr*INV : 255 - 2*(255-dr)*(255-sr)*INV; g = dg < 128 ? 2*dg*sg*INV : 255 - 2*(255-dg)*(255-sg)*INV; b = db < 128 ? 2*db*sb*INV : 255 - 2*(255-db)*(255-sb)*INV; break;
          case 5: r = dr + sr; g = dg + sg; b = db + sb; break;
          case 6: r = Math.min(dr, sr); g = Math.min(dg, sg); b = Math.min(db, sb); break;
          case 7: r = Math.max(dr, sr); g = Math.max(dg, sg); b = Math.max(db, sb); break;
          case 8: setLum(sr, sg, sb, lum(dr, dg, db)); r = _sl[0]; g = _sl[1]; b = _sl[2]; break;
          case 9: setLum(dr, dg, db, lum(sr, sg, sb)); r = _sl[0]; g = _sl[1]; b = _sl[2]; break;
          default: r = sr; g = sg; b = sb;
        }
        out[k] = dr + (r - dr)*a; out[k+1] = dg + (g - dg)*a; out[k+2] = db + (b - db)*a;
      }
      if(chR) outR[i] += ((L.surfacePaint ? sr : rgh ? rgh[i] : Lr) - outR[i])*a;
      if(chM) outM[i] += ((L.surfacePaint ? sg : Lm) - outM[i])*a;
      if(chH) outH[i] = Math.max(-32000, Math.min(32000, outH[i] + (L.surfacePaint ? (sb-128)/127*2048 : (hgt ? (hgt[i] - 128)/127 : 1)*Lh)*a));
    }
  }
}
// Tangent-space normal (OpenGL, Y+) = original normal map + slope of the height channel.
export function normalRect(p, baseN, outN, x0, y0, x1, y1){
  const { W, H, outH } = p, amp = 4*(W/1024)/2048;
  for(let y = y0; y <= y1; y++){
    const yu = y > 0 ? y - 1 : H - 1, yd = y < H - 1 ? y + 1 : 0;
    for(let x = x0; x <= x1; x++){
      const xl = x > 0 ? x - 1 : W - 1, xr = x < W - 1 ? x + 1 : 0, i = y*W + x, k = i*4;
      const hx = -(outH[y*W + xr] - outH[y*W + xl])*amp, hy = (outH[yd*W + x] - outH[yu*W + x])*amp;
      let bx = 0, by = 0, bz = 1;
      if(baseN){ bx = baseN[k]/127.5 - 1; by = baseN[k+1]/127.5 - 1; bz = Math.max(0.05, baseN[k+2]/127.5 - 1); }
      let nx = bx + hx, ny = by + hy, nz = bz; const l = Math.hypot(nx, ny, nz) || 1;
      outN[k] = (nx/l*0.5 + 0.5)*255; outN[k+1] = (ny/l*0.5 + 0.5)*255; outN[k+2] = (nz/l*0.5 + 0.5)*255; outN[k+3] = 255;
    }
  }
}

// Tactical material approximations. Shared procedural microstructure, separate channel sources.
export function tacticalSurface(kind,rough=.8,size=256){const make=()=>({w:size,h:size,data:new Uint8ClampedArray(size*size*4)}),color=make(),height=make(),r=make(),tau=2*Math.PI,put=(m,i,v)=>{m.data[i]=m.data[i+1]=m.data[i+2]=clamp255(v);m.data[i+3]=255;};for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size,v=y/size,ix=Math.floor(u*16),iy=Math.floor(v*16),a=Math.abs(Math.sin(tau*u*16)),b=Math.abs(Math.sin(tau*v*16)),weave=(ix+iy)%2===0?Math.pow(a,.6)*(.45+.55*b):Math.pow(b,.6)*(.45+.55*a),g=hash2(x,y,813)-.5,slow=Math.sin(tau*(u*3+v*2))*Math.cos(tau*(u*2-v*5)),fiber=Math.sin(tau*(u*64+v*16));let h=0,c=0;switch(kind){case 'cordura':h=weave*.72+.08*fiber;c=weave*.12+g*.08;break;case 'ripstop':h=weave*.48+.27*Math.pow(Math.max(Math.abs(Math.cos(tau*u*4)),Math.abs(Math.cos(tau*v*4))),18);c=weave*.08+g*.06;break;case 'webbing':h=.65*Math.pow(Math.abs(Math.sin(tau*u*24)),.65)+.12*Math.sin(tau*(u*8+v*16));c=.1*h+g*.05;break;case 'composite':h=weave*.6;c=weave*.25+g*.04;break;case 'metal':h=.09*Math.sin(tau*v*96)+g*.05;c=.025*slow+g*.025;break;case 'rubber':h=.42*Math.pow(a*b,.4)+g*.09;c=.04*slow+g*.035;break;default:h=.12*slow+g*(kind==='polymer'?.32:.18);c=.035*slow+g*.045;}const i=(y*size+x)*4;put(color,i,128+c*150);put(height,i,128+(h-.3)*125);put(r,i,255*clamp01(rough+(h-.3)*.07+g*.045));}return {color,height,rough:r};}
