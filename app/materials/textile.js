import { fract, hash, mix, noise, smooth, TAU } from './math.js';
import { threadProfile } from './stitches.js';

// Interlaced warp and weft have an elliptical crown and dive underneath at their crossings.
export function weave(x, y, pitch, kind, pixel, P, out) {
  const lod = 1 - smooth(pitch * 0.30, pitch * 0.88, pixel);
  const warp = (noise(x * 32, y * 33, P.seed + 3) - 0.5) * 0.48 * P.fabricTension;
  const u = x / pitch + warp, v = y / pitch - warp * 0.62;
  const cu = Math.floor(u), cv = Math.floor(v);
  const fu = fract(u), fv = fract(v);
  const basket = kind === 'cordura';
  const cross = basket ? ((cu >> 1) + (cv >> 1)) & 1 : (cu + cv) & 1;
  const profile = (d, span, i, j) =>
    threadProfile(d * 2.23, span * pitch, pitch / 2, pixel, hash(i, j, P.seed), P.fiberDensity * P.fiberVariation);
  const a = profile(fu - 0.5, v, cu, 1) * (cross ? 0.67 : 1);
  const b = profile(fv - 0.5, u, 3, cv) * (cross ? 1 : 0.67);
  const yarn = Math.max(a, b);
  let rib = 0;
  if(kind === 'ripstop'){
    const nx = Math.abs(fract(u / 12 + 0.5) - 0.5), ny = Math.abs(fract(v / 12 + 0.5) - 0.5);
    rib = (1 - smooth(0.016, 0.064, Math.min(nx, ny))) * (0.60 + yarn * 0.40);
  }
  const variation = (hash(a > b ? cu : cv, a > b ? 31 : 123, P.seed) - 0.5) * 0.08;
  out.h = pitch * (0.12 + (0.29 * mix(0.59, yarn, lod) + 0.22 * rib));
  out.value = ((yarn - 0.54) * 0.20 + variation + rib * 0.15) * lod;
  out.angle = a > b ? Math.PI / 2 : 0;
  out.aniso = 0.50 * lod;
  return out;
}
export function merrow(x, y, pixelX, pixelY, per, P, out) {
  const wraps = Math.max(10, Math.round(per / (0.0034 * P.threadThickness / P.weave)));
  const pitch = per / wraps, phase = x / pitch + y / 0.037;
  const interlock = x / pitch + 0.49 - y / 0.027;
  const turn = fract(phase), turn2 = fract(interlock);
  const aa = Math.max(pixelX, pixelY);
  const upper = threadProfile((turn - 0.5) * 2.14, y, pitch * 0.47, aa, 0.65, P.fiberDensity * P.fiberVariation);
  const binder = threadProfile((turn2 - 0.5) * 3.1, y, pitch * 0.30, aa, 0.21, P.fiberDensity);
  const tight = 0.68 + 0.23 * Math.cos(y * 210 + Math.sin(phase * TAU) * 0.45);
  const h = Math.max(upper, binder * tight);
  const lod = 1 - smooth(pitch * 0.31, pitch * 0.84, aa);
  out.h = 0.00045 + (0.00135 * mix(0.53, h, lod));
  out.value = (h - 0.49) * 0.23 * lod;
  out.angle = 1.62; out.aniso = 0.77 * lod;
}
export function film(x, y, pixel, P, out) {
  const pitch = 0.00245 / P.weave, u = x / pitch, v = y / pitch;
  const q = u * Math.sqrt(3) / 3 - v / 3, r = v * 2 / 3, h = -q - r;
  let cq = Math.round(q), cr = Math.round(r);
  const dq = Math.abs(cq - q), dr = Math.abs(cr - r), dh = Math.abs(Math.round(h) - h);
  if(dq > dr && dq > dh) cq = -Math.round(h) - cr;
  else if(dr > dh) cr = -cq - Math.round(h);
  const localX = u - Math.sqrt(3) * (cq + cr / 2), localY = v - cr * 1.5;
  const extent = Math.max(Math.abs(localX), Math.abs(localX * 0.5) + Math.abs(localY) * Math.sqrt(3) / 2);
  const edge = 1 - extent * 2 / Math.sqrt(3);
  const groove = (1 - smooth(0.035, 0.16, edge)) * (1 - smooth(pitch * 0.25, pitch * 0.73, pixel));
  out.h = -groove * 0.000085;
  out.value = -groove * 0.10 + (noise(u, v, P.seed + 122) - 0.5) * 0.045;
  out.angle = 0; out.aniso = 0;
}
export function cutSeal(distance, radius) {
  return smooth(radius * 0.22, radius * 1.5, distance) * (1 - smooth(radius * 1.7, radius * 4, distance));
}
