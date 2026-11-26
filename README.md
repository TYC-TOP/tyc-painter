# TYC Painter

Free 3D PBR texturing tool with procedural fabrics, camouflage and an embroidered-patch studio, built for retexturing Roblox MilSim meshes. Substance-Painter-style workflow in a small Electron app. Made by TYC Workshop.

## Features

- Paint directly on the 3D model: brush, fill, eraser, picker, select, decals, symmetry
- Layers, groups, masks, generators and smart materials (wear, dirt, dust)
- PBR paint layer (roughness, metalness, height), UV seam/stitch layers, editable UV decals
- Camouflage library with true-scale patterns, Poly Haven and ambientCG materials
- UV editor, mesh baking (world-space normal, position), project autosave and recovery
- Export Textures: Roblox/Blender separate PNGs, Unreal ORM, Unity URP/HDRP; GL or DX normals; 16-bit height
- **Patch Creator**: callsign nylon, embroidered, PVC and laser-cut patches, with per-zone materials and 3D embroidery from any image; exports OBJ, GLB and maps or opens straight in the painter
- Interface in English and Spanish

## Run from source

```bash
npm install --save-dev electron
npx electron .
```

Requires Node.js 18+. Windows (Electron 45) and macOS (Electron 43, last version supporting macOS 12) are the targets.

## Package

```bash
npx @electron/packager . "TYC Painter" --platform=win32 --arch=x64 --out=dist
```

## Project layout

- `main.js`, `preload.js`: Electron main process, IPC and network allow-list
- `app/`: renderer (three.js r160), painter, Patch Creator (`patch.js`), exporters, baker, UI strings (`i18n.js`)
- `app/assets/`: sample model and material samples

## Notes

The status is a preview (1.0.0-preview.2). Projects saved by 1.0 (format v3) do not open in 0.9.x.

## License

GPL-3.0. See [LICENSE](LICENSE). Third-party components (three.js, fonts) keep their own licenses.
