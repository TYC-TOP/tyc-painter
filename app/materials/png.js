// Data maps go to PNG without an sRGB tag. Height retains its 16-bit values
// rather than passing through Canvas, whose ImageData is limited to 8 bits.
const signature = Uint8Array.of(137,80,78,71,13,10,26,10);
const crcTable = Uint32Array.from({ length:256 }, (_, i) => {
  for(let k = 0; k < 8; k++) i = (i >>> 1) ^ ((i & 1) ? 0xedb88320 : 0);
  return i >>> 0;
});
function chunk(type, data){
  const header = new Uint8Array(8), checksum = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, data.length);
  for(let i = 0; i < 4; i++) header[4 + i] = type.charCodeAt(i);
  let crc = 0xffffffff;
  for(let i = 4; i < 8; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ header[i]) & 255];
  for(const v of data) crc = (crc >>> 8) ^ crcTable[(crc ^ v) & 255];
  new DataView(checksum.buffer).setUint32(0, (crc ^ 0xffffffff) >>> 0);
  return [header, data, checksum];
}

export async function dataPNG(width, height, map, format = 'gray', directX = false){
  const rgb = format === 'normal', deep = format === 'height';
  const rgba = format==='rgba';
  const channels = rgba ? 4 : rgb ? 3 : deep ? 2 : 1;
  const head = new Uint8Array(13), view = new DataView(head.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  head[8] = deep ? 16 : 8; head[9] = rgba ? 6 : rgb ? 2 : 0;
  let y = 0;
  const input = new ReadableStream({
    pull(controller){
      if(y === height){ controller.close(); return; }
      const rows = Math.min(32, height - y), rowBytes = 1 + width * channels;
      const block = new Uint8Array(rowBytes * rows);
      for(let j = 0; j < rows; j++, y++){
        const start = j * rowBytes, end = (y + 1) * width;
        let offset = start + 1, a = 0, b = 0, c = 0, alpha=0;
        block[start] = 1;
        for(let i = y * width; i < end; i++){
          if(rgb || rgba){
            const r = map[4 * i], g = directX ? 255 - map[4 * i + 1] : map[4 * i + 1], bl = map[4 * i + 2];
            block[offset++] = r - a; block[offset++] = g - b; block[offset++] = bl - c;
            if(rgba){const v=map[4*i+3];block[offset++]=v-alpha;alpha=v;}
            a = r; b = g; c = bl;
          } else if(deep){
            const hi = map[i] >>> 8, lo = map[i] & 255;
            block[offset++] = hi - a; block[offset++] = lo - b;
            a = hi; b = lo;
          } else {
            const v = map ? map[i] : 0;
            block[offset++] = v - a;
            a = v;
          }
        }
      }
      controller.enqueue(block);
    },
  });
  const encoded = new Uint8Array(await new Response(input.pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  return new Blob([signature, ...chunk('IHDR', head), ...chunk('IDAT', encoded), ...chunk('IEND', new Uint8Array())], { type:'image/png' });
}
