// TYC Painter — proceso principal de Electron
const { app, BrowserWindow, ipcMain, dialog, net, shell, Menu, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

// Esquema app:// para servir la interfaz (permite fetch y módulos ES, que file:// bloquea)
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const APP_DIR = path.join(__dirname, 'app');
function serveApp() {
  protocol.handle('app', req => {
    const rel = decodeURIComponent(new URL(req.url).pathname);
    const file = path.normalize(path.join(APP_DIR, rel));
    if (new URL(req.url).host !== 'bundle' || path.relative(APP_DIR, file).startsWith('..') || path.isAbsolute(path.relative(APP_DIR,file))) return new Response('No permitido', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

const UA = 'TYCPainter/1.0 (herramienta gratuita para Roblox)';
const cacheDir = () => path.join(app.getPath('userData'), 'cache-materiales');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 680,
    backgroundColor: '#0e0f0d', title: 'TYC Painter', show: false,
    webPreferences: { backgroundThrottling: false, preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (process.platform === 'darwin') {
    // macOS needs an app menu for Cmd+Q / Cmd+H and for copy & paste in text fields.
    // Undo/redo are left out on purpose so Cmd+Z reaches the app's own history.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' },
      { label: 'Edit', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { role: 'windowMenu' },
    ]));
  } else Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.on('will-navigate', (event, url) => { if(url !== 'app://bundle/index.html') event.preventDefault(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (allowedWeb(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i'))) win.webContents.toggleDevTools();
  });
  win.loadURL('app://bundle/index.html');
}

// Peticiones a internet (Poly Haven y ambientCG) desde el proceso principal, con User-Agent propio y caché en disco
function allowedWeb(value){
  try{
    const u=new URL(value);
    return u.protocol==='https:' && !u.username && !u.password && !u.port &&
      (u.hostname==='polyhaven.com' || u.hostname.endsWith('.polyhaven.com') || u.hostname==='dl.polyhaven.org' ||
       u.hostname==='ambientcg.com' || u.hostname.endsWith('.ambientcg.com') || u.hostname.endsWith('.struffelproductions.com'));
  }catch{return false;}
}
async function fetchResource(value){
  let url=value;
  for(let n=0;n<6;n++){
    if(!allowedWeb(url))throw new Error('Invalid resource URL');
    const res=await net.fetch(url,{redirect:'manual',headers:{'User-Agent':UA}});
    if(![301,302,303,307,308].includes(res.status))return res;
    url=new URL(res.headers.get('location'),url).href;
  }
  throw new Error('Too many redirects');
}
async function getJSON(url) {
  if(!allowedWeb(url)) throw new Error('Invalid resource URL');
  const res = await fetchResource(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function getBytes(url) {
  if(!allowedWeb(url)) throw new Error('Invalid resource URL');
  fs.mkdirSync(cacheDir(), { recursive: true });
  const file = path.join(cacheDir(), crypto.createHash('sha1').update(url).digest('hex'));
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const res = await fetchResource(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf;
}
ipcMain.handle('net:json', (_e, url) => getJSON(url));
ipcMain.handle('net:bytes', async (_e, url) => { const b = await getBytes(url); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });

ipcMain.handle('file:save', async (e, { name, data, filters }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters });
  if (r.canceled || !r.filePath) return null;
  const tmp=r.filePath+'.'+crypto.randomUUID()+'.tmp';
  try{
    await fs.promises.writeFile(tmp,Buffer.from(data),{flag:'wx'});
    await fs.promises.rename(tmp,r.filePath);
  }finally{await fs.promises.rm(tmp,{force:true});}
  return r.filePath;
});
ipcMain.handle('file:open', async (e, { filters, multi }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { filters, properties: multi ? ['openFile', 'multiSelections'] : ['openFile'] });
  if (r.canceled) return [];
  return r.filePaths.map(p => { const b = fs.readFileSync(p); return { name: path.basename(p), data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; });
});
ipcMain.handle('shell:open', (_e, url) => allowedWeb(url) && shell.openExternal(url));

// ---------------- Biblioteca de camuflajes (carpeta local del usuario)
const { nativeImage } = require('electron');
const cfgFile = () => path.join(app.getPath('userData'), 'config.json');
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); } catch { return {}; } };
const writeCfg = c => { fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(c, null, 2)); };
const IMG_EXT = /\.(png|jpe?g|webp)$/i;
function insideRoot(p) {
  const root = readCfg().camoRoot; if (!root) return false;
  if(typeof p!=='string' || !IMG_EXT.test(p))return false;
  const rel = path.relative(fs.realpathSync(root), fs.realpathSync(p));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}
function scanDir(root) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 8 || out.length > 20000) return;
    let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of list) {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) walk(full, depth + 1);
      else if (d.isFile() && IMG_EXT.test(d.name)) out.push({ abs: full, rel: path.relative(root, full).split(path.sep).join('/') });
    }
  };
  walk(root, 0);
  return out;
}
ipcMain.handle('camo:get', () => { const root = readCfg().camoRoot; return root && fs.existsSync(root) ? { root, files: scanDir(root) } : null; });
ipcMain.handle('camo:pick', async e => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { title: 'Camouflage folder · Carpeta de camuflajes', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const root = r.filePaths[0]; writeCfg({ ...readCfg(), camoRoot: root });
  return { root, files: scanDir(root) };
});
ipcMain.handle('camo:thumb', async (_e, p) => {
  if (!insideRoot(p)) throw new Error('Ruta no permitida');
  const st = fs.statSync(p);
  const dir = path.join(app.getPath('userData'), 'camo-thumbs'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, crypto.createHash('sha1').update(p + '|' + st.mtimeMs + '|' + st.size).digest('hex') + '.jpg');
  if (!fs.existsSync(file)) {
    const img = nativeImage.createFromPath(p);
    if (img.isEmpty()) throw new Error('Imagen no válida');
    fs.writeFileSync(file, img.resize({ width: 160, quality: 'good' }).toJPEG(82));
  }
  return 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');
});
ipcMain.handle('camo:read', (_e, p) => {
  if (!insideRoot(p)) throw new Error('Ruta no permitida');
  const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
});


// ---------------- Model import: reads the model file plus the files it references (MTL, textures, glTF buffers)
const recoveryFile = () => path.join(app.getPath('userData'),'recovery.mrtx');
ipcMain.handle('project:recover', async () => {
  try { return await fs.promises.readFile(recoveryFile()); }
  catch(error){ if(error.code==='ENOENT') return null; throw error; }
});
ipcMain.handle('project:snapshot', async (_event, bytes) => {
  const target=recoveryFile(), temp=target+'.'+crypto.randomUUID()+'.tmp';
  try{
    await fs.promises.writeFile(temp, Buffer.from(bytes), {flag:'wx'});
    await fs.promises.rename(temp,target);
  } finally { await fs.promises.rm(temp,{force:true}); }
});
const MODEL_EXT = /\.(obj|zip|glb|gltf|fbx)$/i;
const IMG_ANY = /\.(png|jpe?g|webp|tga|bmp)$/i;
function collectModel(file) {
  const dir = path.dirname(file), out = new Map(); let total = 0;
  const add = p => {
    try {
      if (!p || out.has(path.basename(p).toLowerCase())) return false;
      const st = fs.statSync(p); if (!st.isFile() || total + st.size > 900e6) return false;
      const b = fs.readFileSync(p); total += b.length;
      out.set(path.basename(p).toLowerCase(), { name: path.basename(p), data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) });
      return true;
    } catch { return false; }
  };
  const ref = r => { // a referenced path: as written, relative to the model, or by file name next to it
    r = r.trim().replace(/^"|"$/g, '').replace(/\\/g, '/');
    if (!r || /^(data|https?):/i.test(r)) return;
    const cands = [path.isAbsolute(r) ? r : path.join(dir, r), path.join(dir, path.basename(r))];
    for (const c of cands) {
      try{
        const rel=path.relative(fs.realpathSync(dir),fs.realpathSync(c));
        if(!rel.startsWith('..') && !path.isAbsolute(rel) && add(c)) return;
      }catch{}
    }
  };
  add(file);
  const ext = path.extname(file).toLowerCase();
  if (ext === '.obj') {
    const txt = fs.readFileSync(file, 'utf8');
    const libs = [...txt.matchAll(/^mtllib\s+(.+)$/gm)].map(m => m[1]);
    if (!libs.length) libs.push(path.basename(file, '.obj') + '.mtl');
    for (const l of libs) {
      ref(l);
      const mf = out.get(path.basename(l.trim()).toLowerCase()); if (!mf) continue;
      const mtl = Buffer.from(mf.data).toString('utf8');
      for (const m of mtl.matchAll(/^\s*(?:map_\w+|bump|norm|disp|refl)\s+(.+)$/gim)) ref(m[1].split(/\s+-\w+\s+[\d.\s]+/).pop().split(/\s+/).pop());
    }
  } else if (ext === '.gltf') {
    try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); for (const b of [...(j.buffers || []), ...(j.images || [])]) if (b.uri) ref(decodeURIComponent(b.uri)); } catch {}
  } else if (ext === '.fbx') { // FBX textures are usually next to the file or in a textures folder
    for (const d of [dir, path.join(dir, 'textures'), path.join(dir, 'Textures')]) {
      let list = []; try { list = fs.readdirSync(d); } catch {}
      for (const n of list.slice(0, 120)) if (IMG_ANY.test(n)) add(path.join(d, n));
    }
  }
  return { main: path.basename(file), files: [...out.values()] };
}
ipcMain.handle('model:open', async e => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { title: 'Open model · Abrir modelo', filters: [{ name: '3D model', extensions: ['obj', 'zip', 'glb', 'gltf', 'fbx'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return collectModel(r.filePaths[0]);
});
ipcMain.handle('model:read', (_e, p) => (typeof p === 'string' && MODEL_EXT.test(p) && fs.existsSync(p)) ? collectModel(p) : null);

app.whenReady().then(() => { serveApp(); createWindow(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
