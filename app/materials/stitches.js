import { clamp, fract, hash, mix, noise, smooth, TAU } from './math.js';

export function threadProfile(across, along, radius, pixel, phase, fibers) {
  const crown = Math.sqrt(Math.max(0, 1 - across * across));
  const turns = along / (radius * 6) + phase;
  const twist = (0.5 + 0.5 * Math.cos(TAU * (turns + across * 1.36))) ** 2;
  const strands = 1 - smooth(radius * 0.33, radius * 1.05, pixel);
  const filament = Math.cos(TAU * (turns * 1.9 + across * 3.6 + 0.09 * Math.sin(TAU * turns)));
  const fine = strands * (0.11 * (twist - 0.5) + 0.035 * filament) * fibers;
  return crown * (0.86 + fine);
}

export function stitchDimensions(P) {
  const pitch = 0.00255 / (P.weave * P.threadDensity);
  return {
    pitch,
    radius:0.00113 * P.threadThickness / (P.weave * Math.sqrt(P.threadDensity)),
    length:0.013 * P.stitchLength / P.weave,
    tension:P.tension,
  };
}

// Trace real stitch paths in design space. For satin, the tensor's dominant normal
// spans strokes. For running stitches, its tangent follows each contour instead.
export function stitchPaths(art, P, atlas) {
  const { pitch, radius, length, tension } = stitchDimensions(P);
  const style = P.stitchStyle, angle = P.stitchDirection * Math.PI / 180;
  const artXY = (x, y) => [atlas.cx + x * atlas.scale - 0.5, atlas.cy + y * atlas.scale - 0.5];
  const inRegion = (x, y) => art.region(...artXY(x, y));
  const paths = [];
  const p = Math.max(0.0006, Math.min(pitch, radius * 2));
  if(!art.present) return paths;
  const isGrid = style === 'cross' || style === 'zigzag';
  const running = style === 'running';
  const satin = style === 'satin';
  const occupancyStep = p * 0.50;
  const gridW = Math.ceil(P.w / occupancyStep) + 4, gridH = Math.ceil(P.h / occupancyStep) + 4;
  const occupied = isGrid ? null : new Uint8Array(gridW * gridH);
  const cell = (x, y) => {
    const i = Math.floor((x + P.w / 2) / occupancyStep) + 2;
    const j = Math.floor((y + P.h / 2) / occupancyStep) + 2;
    return i < 0 || j < 0 || i >= gridW || j >= gridH ? -1 : j * gridW + i;
  };
  const localAngle = (x, y, prev) => {
    let direction = P.autoDirection ? art.angle(...artXY(x, y), angle, running) : angle;
    if(P.autoDirection && !running) direction += (P.stitchDirection - 75) * Math.PI / 240;
    if(Math.cos(direction - prev) < 0) direction += Math.PI;
    return direction;
  };
  const add = (points, phase) => { if(points.length > 1) paths.push({ points, phase }); };

  if(isGrid){
    const cellW = style === 'cross' ? Math.max(pitch * 2.65, length * 0.45) : Math.max(pitch * 2, length * 0.46);
    const cellH = style === 'cross' ? cellW : pitch * 1.55;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const border = Math.hypot(P.w, P.h) / 2 + cellW;
    for(let row = Math.floor(-border / cellH); row * cellH <= border; row++){
      for(let col = Math.floor(-border / cellW); col * cellW <= border; col++){
        const u = col * cellW, v = row * cellH;
        const xy = (a, b) => [a * cos - b * sin, a * sin + b * cos];
        const center = xy(u, v);
        if(inRegion(...center) < -cellW * 0.65) continue;
        const phase = hash(col, row, P.seed);
        const slant = style === 'cross' ? 1 : (row & 1) ? -1 : 1;
        add([xy(u - 0.46 * cellW, v - slant * 0.47 * cellH), xy(u + 0.46 * cellW, v + slant * 0.47 * cellH)], phase);
        if(style === 'cross') add([xy(u - 0.44 * cellW, v + 0.44 * cellH), xy(u + 0.44 * cellW, v - 0.44 * cellH)], phase + 0.31);
      }
    }
    return paths;
  }

  const step = p * 0.59;
  function trace(x, y, initial) {
    const pts = [];
    let prev = initial;
    const extent = length * (satin ? 1.1 : running ? 0.32 : 0.53);
    for(let s = step; s <= extent; s += step){
      const dir = localAngle(x, y, prev);
      const halfX = x + 0.5 * step * Math.cos(dir), halfY = y + 0.5 * step * Math.sin(dir);
      const next = localAngle(halfX, halfY, dir);
      const bend = Math.atan2(Math.sin(next - prev), Math.cos(next - prev));
      prev += clamp(bend, -0.38, 0.38);
      const nx = x + step * Math.cos(prev), ny = y + step * Math.sin(prev);
      const idx = cell(nx, ny);
      const d = inRegion(nx, ny);
      if(d < radius * 0.20 || idx < 0 || occupied[idx] ||
        (running && d > 2.15 * radius) || !art.sameRegion(...artXY(x,y), ...artXY(nx,ny))) break;
      pts.push([nx, ny]); x = nx; y = ny;
    }
    return pts;
  }
  const stride = p * (running ? 0.67 : 0.86);
  const mark = Math.max(p * 0.45, radius * 0.63);
  for(let row = 0; row * stride < P.h; row++){
    const y = -P.h / 2 + (row + 0.5) * stride;
    for(let col = 0; col * stride < P.w; col++){
      const phase = hash(col, row, P.seed + 17);
      const x = -P.w / 2 + (col + 0.27 + (row & 1) * 0.5 + 0.2 * phase) * stride;
      const d = inRegion(x, y), idx = cell(x, y);
      if(d <= radius * 0.30 || idx < 0 || occupied[idx] || (running && d > 1.75 * radius)) continue;
      const direction = localAngle(x, y, angle);
      const a = trace(x, y, direction + Math.PI), b = trace(x, y, direction);
      const pts = a.reverse().concat([[x, y]], b);
      if(pts.length < 2) continue;
      add(pts, phase);
      const footprint = mark * (running ? 1.6 : 1 - 0.13 * tension);
      for(const [ax, ay] of pts){
        for(let dy = -footprint; dy <= footprint + occupancyStep * 0.05; dy += occupancyStep){
          for(let dx = -footprint; dx <= footprint + occupancyStep * 0.05; dx += occupancyStep){
            const j = cell(ax + dx, ay + dy);
            if(j >= 0) occupied[j] = 1;
          }
        }
        const j = cell(ax, ay);
        if(j >= 0) occupied[j] = 1;
      }
    }
  }
  return paths;
}

export function rasterStitches(paths, art, artAtlas, L, P) {
  const { RES, HF, front } = L, { radius, tension } = stitchDimensions(P);
  const count = RES * HF, top = new Float32Array(count);
  const coverage = new Uint8Array(count), direction = new Uint8Array(count);
  const pixel = 1 / front.s, s = front.s;
  for(const { points, phase } of paths){
    const total = points.reduce((acc, pt, j) => j ? acc + Math.hypot(pt[0] - points[j - 1][0], pt[1] - points[j - 1][1]) : 0, 0);
    const r = radius * mix(0.87, 1.15, phase) * mix(1.13, 0.89, tension);
    const extent = r + pixel * 0.65;
    let start = 0;
    for(let k = 1; k < points.length; k++){
      const [ax, ay] = points[k - 1], [bx, by] = points[k];
      const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
      if(length < 1e-8) continue;
      const tx = dx / length, ty = dy / length;
      const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - extent) * s + front.cx - 0.5));
      const x1 = Math.min(RES - 1, Math.ceil((Math.max(ax, bx) + extent) * s + front.cx - 0.5));
      const y0 = Math.max(0, Math.floor((Math.min(ay, by) - extent) * s + front.cy - 0.5));
      const y1 = Math.min(HF - 1, Math.ceil((Math.max(ay, by) + extent) * s + front.cy - 0.5));
      // Keep a continuous vector per segment. Material anisotropy is invariant to its sign.
      const orientation = 1 + Math.round(fract(Math.atan2(-dy, dx) / TAU) * 253);
      for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++){
        const wx = (x + 0.5 - front.cx) * pixel, wy = (y + 0.5 - front.cy) * pixel;
        const ex = wx - ax, ey = wy - ay;
        const u = clamp(ex * tx + ey * ty, 0, length);
        const nx = ex - u * tx, ny = ey - u * ty;
        const d2 = nx * nx + ny * ny;
        if(d2 >= extent * extent) continue;
        const boundary = art.region(artAtlas.cx + wx * artAtlas.scale - 0.5, artAtlas.cy + wy * artAtlas.scale - 0.5);
        if(boundary < -pixel * 0.5) continue;
        const progress = start + u;
        const taper = smooth(0, r * 2, Math.min(progress, total - progress));
        const width = r * (0.73 + 0.27 * taper);
        const across = Math.sqrt(d2);
        const alpha = (1 - smooth(width - pixel * 0.60, width + pixel * 0.60, across))
          * smooth(-pixel * 0.5, pixel * 0.7, boundary);
        if(alpha < 0.005) continue;
        const signed = Math.sign(nx * -ty + ny * tx) * across / width;
        const profile = threadProfile(signed, progress, r, pixel, phase, P.fiberVariation * P.fiberDensity);
        const height = r * (0.36 + 0.32 * taper + profile * (0.64 + 0.12 * (1 - tension))) * alpha;
        const i = y * RES + x;
        const old = top[i];
        if(height > old){
          top[i] = height;
          direction[i] = orientation;
        }
        coverage[i] = Math.max(coverage[i], Math.round(alpha * 255));
      }
      start += length;
    }
  }
  return { top, coverage, direction };
}

export function fillStitches(x, y, P, pixel, out) {
  const pitch = 0.0030 / P.weave, len = 0.014 / P.weave;
  const angle = 0.58, cos = Math.cos(angle), sin = Math.sin(angle);
  const u = x * cos + y * sin, v = -x * sin + y * cos;
  const warp = (noise(u * 22, v * 32, P.seed) - 0.5) * pitch * 0.35;
  const row = Math.floor((v + warp) / pitch);
  const t = u / len + row * 0.36 + hash(row, 1, P.seed) * 0.12;
  const across = (fract((v + warp) / pitch) - 0.5) * 2;
  const along = fract(t);
  const tight = smooth(0.0, 0.12, along) * (1 - smooth(0.87, 1, along));
  const profile = threadProfile(across, along * len, pitch * 0.5, pixel, hash(Math.floor(t), row, P.seed), P.fiberVariation * P.fiberDensity);
  const lod = 1 - smooth(pitch * 0.34, pitch * 0.84, pixel);
  out.h = 0.00065 + 0.00083 * mix(0.58, profile * (0.62 + 0.38 * tight), lod);
  out.value = (profile * (0.55 + 0.45 * tight) - 0.55) * lod * 0.14;
  out.angle = -angle; out.aniso = 0.55 * lod;
}
