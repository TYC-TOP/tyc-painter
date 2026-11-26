import { bakeMap } from './mesh-baker.js';
self.onmessage = async ({data}) => {
  try {
    const pixels = bakeMap(data, progress=>self.postMessage({progress}));
    const canvas = new OffscreenCanvas(data.size,data.size);
    canvas.getContext('2d').putImageData(new ImageData(pixels,data.size,data.size),0,0);
    self.postMessage({blob:await canvas.convertToBlob({type:'image/png'})});
  } catch(error){ self.postMessage({error:error.message}); }
};
