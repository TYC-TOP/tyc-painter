// Patch material coordinates are in studs, with X to the right and Y down in the atlas.
export const TAU = 2 * Math.PI;
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const fract = x => x - Math.floor(x);
export const smooth = (lo, hi, v) => {
  const t = clamp((v - lo) / Math.max(1e-9, hi - lo));
  return t * t * (3 - 2 * t);
};
export const srgbToLinear = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const encode = v => v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const encoded = Uint8Array.from({ length:4097 }, (_, i) => Math.round(255 * encode(i / 4096)));
export const linearByte = v => encoded[Math.round(clamp(v) * 4096)];
export const SRGB = Float32Array.from({ length:256 }, (_, i) => srgbToLinear(i / 255));
export function linearHex(hex) {
  const rgb = parseInt(hex.slice(1), 16);
  return [SRGB[(rgb >>> 16) & 255], SRGB[(rgb >>> 8) & 255], SRGB[rgb & 255]];
}

export function hash(x, y, seed) {
  let n = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ Math.imul(seed, 0x6c8e9cf5);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, y, seed) {
  const i = Math.floor(x), j = Math.floor(y);
  const u = fract(x), v = fract(y), a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return mix(mix(hash(i,j,seed), hash(i+1,j,seed), a), mix(hash(i,j+1,seed), hash(i+1,j+1,seed), a), b);
}
export function sampler(data, width, height, x, y) {
  x = clamp(x, 0, width - 1); y = clamp(y, 0, height - 1);
  const ix = Math.floor(x), iy = Math.floor(y), j = iy * width + ix;
  const rx = ix < width - 1 ? 1 : 0, ry = iy < height - 1 ? width : 0;
  return mix(mix(data[j], data[j + rx], x - ix), mix(data[j + ry], data[j + ry + rx], x - ix), y - iy);
}

// Exact squared Euclidean distance via the lower envelope of parabolas.
// Felzenszwalb & Huttenlocher, Distance Transforms of Sampled Functions.
export function distance(seeds, width, height) {
  const max = Math.max(width, height);
  const f = new Float64Array(max), envelope = new Int32Array(max), cuts = new Float64Array(max + 1);
  const result = new Float32Array(width * height);
  function line(length, offset, stride) {
    let top = 0;
    envelope[0] = 0; cuts[0] = -Infinity; cuts[1] = Infinity;
    for(let q = 1; q < length; q++){
      let p = envelope[top], cross = ((f[q] + q * q) - (f[p] + p * p)) / (2 * (q - p));
      while(cross <= cuts[top]){
        p = envelope[--top];
        cross = ((f[q] + q * q) - (f[p] + p * p)) / (2 * (q - p));
      }
      envelope[++top] = q; cuts[top] = cross; cuts[top + 1] = Infinity;
    }
    top = 0;
    for(let q = 0; q < length; q++){
      while(cuts[top + 1] < q) top++;
      const p = envelope[top];
      result[offset + q * stride] = (q - p) ** 2 + f[p];
    }
  }
  for(let y = 0; y < height; y++){
    const row = y * width;
    for(let x = 0; x < width; x++) f[x] = seeds[row + x] ? 0 : 1e9;
    line(width, row, 1);
  }
  for(let x = 0; x < width; x++){
    for(let y = 0; y < height; y++) f[y] = result[y * width + x];
    line(height, x, width);
  }
  return result;
}

export function signedDistance(mask, width, height) {
  const outside = Uint8Array.from(mask, v => +!v);
  const toInside = distance(mask, width, height), toOutside = distance(outside, width, height);
  for(let i = 0; i < mask.length; i++) {
    toInside[i] = mask[i] ? Math.sqrt(toOutside[i]) - 0.5 : 0.5 - Math.sqrt(toInside[i]);
  }
  return toInside;
}

export function blur(data, width, height, radius) {
  const tmp = new Float32Array(data.length), out = new Float32Array(data.length);
  const diameter = 2 * radius + 1;
  const pass = (src, dest, lines, length, lineStride, pixelStride) => {
    for(let line = 0; line < lines; line++){
      const offset = line * lineStride;
      let sum = 0;
      for(let x = -radius; x <= radius; x++) sum += src[offset + clamp(x, 0, length - 1) * pixelStride];
      for(let x = 0; x < length; x++){
        dest[offset + x * pixelStride] = sum / diameter;
        sum += src[offset + Math.min(length - 1, x + radius + 1) * pixelStride];
        sum -= src[offset + Math.max(0, x - radius) * pixelStride];
      }
    }
  };
  pass(data, tmp, height, width, width, 1);
  pass(tmp, out, width, height, 1, width);
  return out;
}

export function capsule(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const u = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - ax - dx * u, y - ay - dy * u);
}
