const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  recover: () => ipcRenderer.invoke('project:recover'),
  snapshot: bytes => ipcRenderer.invoke('project:snapshot', bytes),
  getJSON: url => ipcRenderer.invoke('net:json', url),
  getBytes: url => ipcRenderer.invoke('net:bytes', url),
  saveFile: (name, data, filters) => ipcRenderer.invoke('file:save', { name, data, filters }),
  openFiles: (filters, multi) => ipcRenderer.invoke('file:open', { filters, multi }),
  openExternal: url => ipcRenderer.invoke('shell:open', url),
  openModel: () => ipcRenderer.invoke('model:open'),
  readDroppedModel: file => {
    const filePath=webUtils.getPathForFile(file);
    return filePath ? ipcRenderer.invoke('model:read',filePath) : null;
  },
  camoGet: () => ipcRenderer.invoke('camo:get'),
  camoPick: () => ipcRenderer.invoke('camo:pick'),
  camoThumb: p => ipcRenderer.invoke('camo:thumb', p),
  camoRead: p => ipcRenderer.invoke('camo:read', p),
});
