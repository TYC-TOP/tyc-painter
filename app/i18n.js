// Interface languages: English and Spanish. Each entry is [en, es]; {0}, {1}… are placeholders.
const D = {
  'app.title': ['TYC Painter', 'TYC Painter'],
  'app.model': ['Helmet · PVS-14 · arid pixel', 'Casco · PVS-14 · árido pixelado'],
  'load.model': ['Loading model…', 'Cargando modelo…'],
  'load.tex': ['Loading textures…', 'Cargando texturas…'],

  'model.title': ['Model', 'Modelo'], 'model.open': ['Open model…', 'Abrir modelo…'], 'model.helmet': ['Example helmet', 'Casco de ejemplo'],
  'model.hint': ['OBJ (with its MTL and textures, or all of them in a .zip), GLB/glTF or FBX. You can also drag the file onto the window. Each mesh or material becomes a part; parts without a texture get a blank 1024 one.', 'OBJ (con su MTL y texturas, o todo en un .zip), GLB/glTF o FBX. También puedes arrastrar el archivo a la ventana. Cada malla o material es una pieza; las que no traen textura reciben una en blanco de 1024.'],
  'st.importing': ['Opening model…', 'Abriendo modelo…'],
  'msg.modelok': ['Model opened: {0} part(s)', 'Modelo abierto: {0} pieza(s)'], 'msg.nouv': ['{0} without UVs (not paintable)', '{0} sin UV (no se pueden pintar)'],
  'msg.modelempty': ['The file has no meshes', 'El archivo no tiene mallas'], 'msg.nomodel': ['No OBJ, GLB, glTF or FBX found', 'No se ha encontrado ningún OBJ, GLB, glTF o FBX'],
  'msg.dropwhat': ['Drop a model (OBJ, ZIP, GLB, FBX) or a project (.mrtx)', 'Suelta un modelo (OBJ, ZIP, GLB, FBX) o un proyecto (.mrtx)'],

  // texture sets
  'sets.title': ['Texture sets', 'Piezas'],
  'sets.set': ['Part', 'Pieza'],
  'sets.isolate': ['Isolate', 'Aislar pieza'],
  'sets.showall': ['Show all', 'Mostrar todo'],
  'sets.res': ['Resolution', 'Calidad'],
  'sets.resHint': ['Texture size of the selected part. You can change it at any time: materials and generators are rebuilt at the new size.', 'Tamaño de la textura de la pieza seleccionada. Puedes cambiarlo cuando quieras: los materiales y generadores se recalculan al nuevo tamaño.'],
  'sets.notex': ['no texture', 'sin textura'],

  // tools
  'tools.title': ['Tools', 'Herramientas'],
  'tool.orbit': ['Move', 'Mover'], 'tool.paint': ['Brush', 'Pincel'], 'tool.erase': ['Eraser', 'Borrador'], 'tool.fill': ['Fill', 'Rellenar'],
  'tool.pick': ['Picker', 'Color'], 'tool.wand': ['Select', 'Varita'], 'tool.decal': ['Decal', 'Parche'],
  'tool.orbit.tip': ['Move the camera / pick a part (O)', 'Mover la cámara / elegir pieza (O)'],
  'tool.paint.tip': ['Brush (B)', 'Pincel (B)'], 'tool.erase.tip': ['Eraser (E)', 'Borrador (E)'], 'tool.fill.tip': ['Polygon fill (G)', 'Rellenar polígonos (G)'],
  'tool.pick.tip': ['Colour picker (I)', 'Cuentagotas (I)'], 'tool.wand.tip': ['Select by colour (W)', 'Seleccionar por color (W)'], 'tool.decal.tip': ['Project an image: patch, flag, logo (D)', 'Proyectar una imagen: parche, bandera, logo (D)'],
  'tool.orbit.hint': ['Drag to orbit, wheel to zoom, right-drag to pan. Click a part to select it (with the UV editor open, click selects the island).', 'Arrastra para girar, rueda para zoom, clic derecho para desplazar. Clic en una pieza para seleccionarla (con el editor UV abierto, selecciona la isla).'],
  'tool.paint.hint': ['Paints on the selected paint layer, or on the mask of the selected layer. Right-drag orbits. Alt+click picks another part.', 'Pinta en la capa de pintura seleccionada, o en la máscara de la capa seleccionada. Clic derecho gira. Alt+clic elige otra pieza.'],
  'tool.erase.hint': ['Erases paint. On a fill layer it hides the material there (it paints its mask black).', 'Borra la pintura. En una capa de relleno oculta el material en esa zona (pinta su máscara de negro).'],
  'tool.fill.hint': ['Click to fill a whole UV island, the whole part or a single triangle with the brush colour (or white/black on a mask).', 'Clic para rellenar una isla UV entera, la pieza entera o un triángulo con el color del pincel (o blanco/negro en una máscara).'],
  'tool.pick.hint': ['Click the model to take its colour for the brush.', 'Clic en el modelo para coger su color para el pincel.'],
  'tool.wand.hint': ['Click a colour on the model to select it. Shift adds, Alt removes.', 'Clic en un color del modelo para seleccionarlo. Shift suma, Alt resta.'],
  'tool.decal.hint': ['Load an image and click the model to stamp it flat on the surface, facing the camera\'s "up".', 'Carga una imagen y haz clic en el modelo para estamparla plana sobre la superficie, con el «arriba» de la cámara.'],

  'brush.color': ['Colour', 'Color'], 'brush.size': ['Size', 'Tamaño'], 'brush.hard': ['Hardness', 'Dureza'], 'brush.flow': ['Flow', 'Flujo'], 'brush.spacing': ['Spacing', 'Espaciado'],
  'brush.target': ['Paint on', 'Pintar en'], 'brush.target.layer': ['Layer', 'Capa'], 'brush.target.mask': ['Mask', 'Máscara'],
  'brush.maskval': ['Mask value', 'Valor'], 'brush.white': ['White (show)', 'Blanco (ver)'], 'brush.black': ['Black (hide)', 'Negro (ocultar)'],
  'brush.sym': ['Symmetry', 'Simetría'], 'brush.sym.off': ['Off', 'Desactivada'],
  'brush.lock': ['Paint only on the selected part', 'Pintar solo en la pieza seleccionada'],
  'fill.mode': ['Fill', 'Rellenar'], 'fill.island': ['UV island', 'Isla UV'], 'fill.part': ['Whole part', 'Pieza entera'], 'fill.tri': ['Triangle', 'Triángulo'],
  'fill.hint': ['Uses the brush colour above.', 'Usa el color del pincel de arriba.'],
  'wand.tol': ['Tolerance', 'Tolerancia'], 'wand.src': ['Sample', 'Muestrear'], 'wand.match': ['Match', 'Comparar'], 'wand.match.pattern': ['Colour + pattern', 'Color + textura'], 'wand.match.colour': ['Colour only', 'Solo color'], 'wand.src.orig': ['Original texture', 'Textura original'], 'wand.src.out': ['Current result', 'Resultado actual'], 'wand.cont': ['Contiguous only', 'Solo zona conectada'], 'wand.all': ['All', 'Todo'], 'wand.inv': ['Invert', 'Invertir'], 'wand.none': ['Clear', 'Quitar'],
  'wand.hint': ['Works on the model and in the UV editor. Brush and fill only affect the selection. A new fill layer takes the selection as its mask.', 'Funciona en el modelo y en el editor UV. El pincel y el relleno solo afectan a la selección. Una capa de relleno nueva usa la selección como máscara.'],
  'decal.load': ['Load image…', 'Cargar imagen…'], 'decal.size': ['Size', 'Tamaño'], 'decal.rot': ['Rotation', 'Rotación'], 'decal.opacity': ['Opacity', 'Opacidad'],
  'decal.none': ['No image loaded. PNG with transparency works best.', 'Sin imagen. Lo mejor es un PNG con transparencia.'],

  // history, project, export
  'hist.title': ['History', 'Historial'], 'hist.undo': ['Undo', 'Deshacer'], 'hist.redo': ['Redo', 'Rehacer'], 'hist.reset': ['Reset part to original', 'Restaurar pieza original'],
  'proj.title': ['Project', 'Proyecto'], 'proj.open': ['Open…', 'Abrir…'], 'proj.save': ['Save…', 'Guardar…'],
  'proj.hint': ['A project file (.mrtx) keeps every layer editable.', 'El archivo de proyecto (.mrtx) conserva todas las capas editables.'],
  'exp.title': ['Export', 'Exportar'], 'exp.part': ['Part textures', 'Texturas de la pieza'], 'exp.all': ['Everything (.zip)', 'Todo (.zip)'],
  'exp.objPart': ['Part mesh (.obj)', 'Malla de la pieza (.obj)'], 'exp.objAll': ['Model (.obj)', 'Modelo (.obj)'],
  'exp.hint': ['Colour keeps the original file name: upload it as the ColorMap of the SurfaceAppearance. Normal, roughness and metalness maps are added when a layer uses those channels. If you changed UVs, import the new mesh too.', 'El color conserva el nombre original: súbelo como ColorMap del SurfaceAppearance. Los mapas de normales, rugosidad y metal se añaden cuando alguna capa usa esos canales. Si cambias las UV, importa también la malla nueva.'],
  'exp.readmeName': ['README.txt', 'LEEME.txt'],
  'exp.readme': ['Exported with TYC Painter.\n\n- *_diff.png  -> ColorMap of the part\'s SurfaceAppearance\n- *_nmap.png  -> NormalMap (OpenGL format)\n- *_rough.png -> RoughnessMap\n- *_metal.png -> MetalnessMap\n- Maps that are not in this folder did not change: keep the originals.\n- A "meshes" folder means those parts have new UVs: import the .obj in Roblox and replace the MeshId.\n\nPoly Haven and TextureCan materials are CC0.\n',
                 'Exportado con TYC Painter.\n\n- *_diff.png  -> ColorMap del SurfaceAppearance de la pieza\n- *_nmap.png  -> NormalMap (formato OpenGL)\n- *_rough.png -> RoughnessMap\n- *_metal.png -> MetalnessMap\n- Los mapas que no están en esta carpeta no han cambiado: deja los originales.\n- Si hay carpeta "meshes", esas piezas tienen UV nuevas: importa el .obj en Roblox y cambia el MeshId.\n\nLos materiales de Poly Haven y TextureCan son CC0.\n'],

  // viewport
  'view.tip': ['Channel shown on the selected part', 'Canal que se muestra en la pieza seleccionada'],
  'view.material': ['Material', 'Material'], 'view.color': ['Base colour', 'Color base'], 'view.rough': ['Roughness', 'Rugosidad'], 'view.metal': ['Metallic', 'Metal'],
  'view.normal': ['Normal', 'Normales'], 'view.height': ['Height', 'Altura'], 'view.mask': ['Layer mask', 'Máscara de la capa'],
  'view.light': ['Light', 'Luz'], 'view.light.tip': ['Rotate the light', 'Girar la luz'],
  'view.cmp': ['Original', 'Ver original'], 'view.cmp.tip': ['Hold to see the original texture', 'Mantén pulsado para ver la textura original'],
  'view.uv': ['UV editor', 'Editor UV'], 'view.frame': ['Centre', 'Centrar'],
  'uv.move': ['Move', 'Mover'], 'uv.rotate': ['Rotate', 'Rotar'], 'uv.scale': ['Scale', 'Escalar'], 'uv.all': ['All', 'Todas'], 'uv.fit': ['Fit', 'Encuadrar'], 'uv.carry': ['Carry the texture', 'Llevar la textura'],
  'uv.info': ['{0} islands · click to select · Shift adds · drag on empty space (or Ctrl+drag) for a box · right-drag or wheel to navigate', '{0} islas · clic para seleccionar · Shift suma · arrastra en vacío (o Ctrl+arrastrar) para un recuadro · clic derecho o rueda para moverte'],
  'uv.info.faces': ['{0} face(s) selected in {1} island(s) · drag to {2}', '{0} cara(s) seleccionada(s) en {1} isla(s) · arrastra para {2}'],
  'uv.info.wand': ['{0} islands · Select tool: click the texture to select by colour (Shift adds, Alt removes)', '{0} islas · Varita: clic en la textura para seleccionar por color (Shift suma, Alt resta)'],
  'uv.pick.island': ['Island', 'Isla'], 'uv.pick.face': ['Face', 'Cara'], 'uv.linked': ['Linked', 'Conectadas'],

  // layers
  'layers.title': ['Layers', 'Capas'], 'layers.addFill': ['+ Fill', '+ Relleno'], 'layers.addPaint': ['+ Paint', '+ Pintura'], 'layers.addAdjust': ['+ Filter', '+ Filtro'],
  'layers.addFill.tip': ['Fill layer: a colour or material over the whole part, limited by its mask', 'Capa de relleno: un color o material en toda la pieza, limitado por su máscara'],
  'layers.addPaint.tip': ['Paint layer: brush strokes, fills and decals', 'Capa de pintura: pinceladas, rellenos y parches'],
  'layers.addAdjust.tip': ['Filter layer: brightness, contrast, saturation and hue of everything below', 'Capa de filtro: brillo, contraste, saturación y tono de todo lo que hay debajo'],
  'layers.dup': ['Duplicate layer', 'Duplicar capa'], 'layers.up': ['Move up', 'Subir'], 'layers.down': ['Move down', 'Bajar'], 'layers.del': ['Delete layer', 'Eliminar capa'],
  'layers.blend': ['Blending', 'Fusión'], 'layers.opacity': ['Opacity', 'Opacidad'], 'layers.copy': ['copy', 'copia'], 'layers.maskTip': ['Mask: click to paint on it', 'Máscara: clic para pintar en ella'],
  'layer.base': ['Original texture', 'Textura original'], 'layer.orig': ['Original details', 'Detalles originales'], 'layer.shade': ['Original shading', 'Sombreado original'], 'layer.velcro': ['Velcro', 'Velcro'],
  'layer.paint': ['Paint', 'Pintura'], 'layer.adjust': ['Filter', 'Filtro'], 'layer.decal': ['Decals', 'Parches'],
  'uv.seam':['Stitch','Costura'], 'uv.paint':['Brush','Pincel'], 'ltype.group':['Group','Grupo'], 'ltype.decalUV':['UV decal','Calcomanía UV'], 'ltype.seam':['Stitch path','Trayectoria de costura'], 'ltype.base': ['Base', 'Base'], 'ltype.fill': ['Fill', 'Relleno'], 'ltype.paint': ['Paint', 'Pintura'], 'ltype.adjust': ['Filter', 'Filtro'], 'ltype.shade': ['Shading', 'Sombreado'], 'ltype.orig': ['Original', 'Original'],
  'blend.normal': ['Normal', 'Normal'], 'blend.multiply': ['Multiply', 'Multiplicar'], 'blend.detail': ['Detail (×2 multiply)', 'Detalle (multiplicar ×2)'], 'blend.screen': ['Screen', 'Trama'],
  'blend.overlay': ['Overlay', 'Superponer'], 'blend.add': ['Add', 'Sumar'], 'blend.darken': ['Darken', 'Oscurecer'], 'blend.lighten': ['Lighten', 'Aclarar'],
  'blend.color': ['Colour (tint)', 'Color (teñir)'], 'blend.luminosity': ['Luminosity', 'Luminosidad'],

  // properties
  'props.title': ['Properties', 'Propiedades'],
  'props.none': ['Select a part with a texture.', 'Selecciona una pieza con textura.'],
  'props.base': ['The model\'s original texture. Add layers above it; hide it with the eye to see only your layers.', 'La textura original del modelo. Añade capas encima; ocúltala con el ojo para ver solo tus capas.'],
  'props.shade': ['Shadows, folds, weave and fuzz recovered from the original texture without its camouflage. It multiplies everything below, so any material keeps the hand-painted detail. Lower the opacity for a flatter look.', 'Sombras, pliegues, trama y pelusa recuperados de la textura original sin su camuflaje. Multiplica todo lo de debajo, así cualquier material conserva el detalle pintado a mano. Baja la opacidad para un aspecto más plano.'],
  'fillp.title': ['Fill', 'Relleno'], 'fillp.proj': ['Projection', 'Proyección'], 'fillp.proj.uv': ['UV projection', 'Proyección UV'], 'fillp.proj.tri': ['Tri-planar projection', 'Proyección triplanar'],
  'fillp.filter': ['Filtering', 'Filtrado'], 'fillp.filter.bi': ['Bilinear | HQ', 'Bilineal | HQ'], 'fillp.filter.near': ['Nearest (crisp pixels)', 'Vecino más cercano (píxel nítido)'],
  'fillp.wrap': ['UV wrap', 'Repetición'], 'fillp.wrap.repeat': ['Repeat', 'Repetir'], 'fillp.wrap.mirror': ['Mirror', 'Espejo'], 'fillp.wrap.none': ['None', 'Ninguna'],
  'fillp.uvx': ['UV transformations', 'Transformaciones UV'], 'fillp.tiling': ['Tiling', 'Mosaico'], 'fillp.rot': ['Rotation', 'Rotación'], 'fillp.sx': ['Scale X', 'Escala X'], 'fillp.sy': ['Scale Y', 'Escala Y'], 'fillp.slink': ['Keep proportions', 'Mantener proporción'], 'fillp.sreset': ['Reset', 'Restablecer'], 'fillp.offset': ['Offset', 'Desplazamiento'],
  'fillp.real': ['True size (camouflage pack)', 'Tamaño real (pack de camuflajes)'],
  'mat.title': ['Material', 'Material'], 'mat.mode': ['Material mode', 'Modo material'], 'mat.replace': ['Replace', 'Cambiar'],
  'mat.replace.tip': ['Then click a material in the library to put it in this layer', 'Después haz clic en un material de la biblioteca para ponerlo en esta capa'],
  'mat.nrm.tip': ['The normal map is built from the height channel', 'El mapa de normales se genera a partir del canal de altura'],
  'mat.basecolor': ['Base colour', 'Color base'], 'mat.palette': ['Palette', 'Paleta'], 'mat.colors': ['Colours', 'Colores'], 'mat.variation': ['Variation', 'Variación'], 'mat.newseed': ['New', 'Nueva'],
  'mat.rough': ['Roughness', 'Rugosidad'], 'mat.metal': ['Metallic', 'Metal'], 'mat.height': ['Height', 'Altura'],
  'mat.solid': ['Solid colour', 'Color sólido'], 'mat.tint': ['Tint', 'Teñir'],
  'mat.camo.digital': ['Digital camo', 'Camuflaje pixelado'], 'mat.camo.woodland': ['Blotch camo', 'Camuflaje de manchas'], 'mat.camo.tiger': ['Tiger stripes', 'Rayas tiger'],
  'mat.velcro_loop': ['Velcro (loop)', 'Velcro (rizo)'], 'mat.velcro_hook': ['Velcro (hook)', 'Velcro (gancho)'], 'mat.webbing_twill': ['Webbing weave', 'Trama de cinta'],
  'adj.title': ['Adjustments', 'Ajustes'], 'adj.match': ['Match the original\'s brightness', 'Igualar la luz del original'],
  'adj.con': ['Contrast', 'Contraste'], 'adj.sat': ['Saturation', 'Saturación'], 'adj.bri': ['Brightness', 'Brillo'], 'adj.hue': ['Hue', 'Tono'],
  'mask.title': ['Mask', 'Máscara'], 'mask.gen': ['Mask', 'Máscara'],
  'mask.gen.none': ['No mask', 'Sin máscara'], 'mask.gen.white': ['White (paint to hide)', 'Blanca (pinta para ocultar)'], 'mask.gen.black': ['Black (paint to reveal)', 'Negra (pinta para mostrar)'],
  'mask.gen.sel': ['From the selection', 'Desde la selección'], 'mask.gen.dirt': ['Generator: dirt in recesses', 'Generador: suciedad en huecos'], 'mask.gen.edges': ['Generator: edge wear', 'Generador: desgaste de bordes'],
  'mask.gen.cavity': ['Generator: cavities', 'Generador: cavidades'], 'mask.gen.noise': ['Generator: grunge noise', 'Generador: ruido sucio'], 'mask.gen.dustUp':['Directional dust · world +Y','Polvo direccional · eje +Y'], 'mask.gen.gradient': ['Generator: top-down gradient', 'Generador: degradado vertical'],
  'mask.gen.zone': ['Velcro zones of this part', 'Zonas de velcro de la pieza'], 'mask.gen.islands': ['Faces selected in the UV editor', 'Caras seleccionadas en el editor UV'],
  'mask.level': ['Amount', 'Cantidad'], 'mask.contrast': ['Contrast', 'Contraste'], 'mask.scale': ['Scale', 'Escala'], 'mask.seed': ['Variation', 'Variación'],
  'mask.invert': ['Invert', 'Invertir'], 'mask.remove': ['Remove mask', 'Quitar máscara'],
  'mask.hint': ['White shows the layer, black hides it. Click the mask square in the layer list to paint on it.', 'El blanco muestra la capa y el negro la oculta. Haz clic en el cuadro de máscara de la lista para pintar en ella.'],

  // library
  'lib.base': ['Basics', 'Básicos'], 'lib.smart': ['Smart materials', 'Materiales inteligentes'], 'lib.camo': ['Camouflage', 'Camuflajes'], 'lib.mine': ['Mine', 'Míos'],
  'lib.armed': ['Click a material to replace the one in the selected layer', 'Haz clic en un material para sustituir el de la capa seleccionada'],
  'lib.sub.fill': ['fill layer', 'capa de relleno'], 'lib.sub.tint': ['keeps the detail', 'conserva el detalle'], 'lib.sub.proc': ['procedural', 'procedural'],
  'lib.sub.detail': ['detail + relief', 'detalle + relieve'], 'lib.sub.shade': ['from the original', 'del original'], 'lib.sub.orig': ['stitching, labels…', 'costuras, etiquetas…'], 'lib.sub.smart': ['layer stack', 'pila de capas'],
  'camo.empty': ['Choose the folder with your camouflage pack (for example the unzipped "Debilniy camo texture folder"). The app sorts it by country, branch and pattern, and remembers the folder.', 'Elige la carpeta donde tienes tu pack de camuflajes (por ejemplo, el «Debilniy camo texture folder» ya descomprimido). La app lo ordena por país, rama y patrón y recuerda la carpeta.'],
  'camo.pick': ['Choose folder…', 'Elegir carpeta…'], 'camo.change': ['Change folder', 'Cambiar carpeta'], 'camo.search': ['Search: MARPAT, Flecktarn, EMR…', 'Buscar: MARPAT, Flecktarn, EMR…'],
  'camo.all': ['All', 'Todos'], 'camo.count': ['{0} patterns', '{0} patrones'], 'camo.results': ['{0} result(s)', '{0} resultado(s)'],
  'camo.reading': ['Reading folder…', 'Leyendo carpeta…'], 'camo.noimg': ['No PNG/JPG images in that folder.', 'No hay imágenes PNG/JPG en esa carpeta.'],
  'camo.desktop': ['Available in the desktop app.', 'Disponible en la app de escritorio.'], 'camo.openfail': ['Could not open: {0}', 'No se pudo abrir: {0}'],
  'ph.search': ['Search: fabric, metal, leather…', 'Buscar: fabric, metal, leather…'], 'ph.allcats': ['All categories', 'Todas las categorías'], 'ph.more': ['Load more', 'Cargar más'],
  'ph.credit': ['CC0 materials · Powered by', 'Materiales CC0 · Powered by'], 'ph.connecting': ['Connecting to Poly Haven…', 'Conectando con Poly Haven…'],
  'ph.fail': ['Could not reach Poly Haven. Check your internet connection.', 'No se ha podido conectar con Poly Haven. Comprueba tu conexión a internet.'], 'ph.retry': ['Retry', 'Reintentar'],
  'ph.count': ['{0} materials', '{0} materiales'], 'ph.none': ['No results.', 'Sin resultados.'], 'ph.nocolor': ['no colour map', 'sin mapa de color'], 'ph.dlfail': ['Download failed: {0}', 'No se pudo descargar: {0}'],
  'mine.import': ['Import image…', 'Importar imagen…'], 'mine.hint': ['Any tileable texture (PNG/JPG): your own camo, or one downloaded from ambientCG, TextureCan or Poly Haven.', 'Cualquier textura repetible (PNG/JPG): tu propio camuflaje, o una bajada de ambientCG, TextureCan o Poly Haven.'],
  'sm.dirt': ['Dirt', 'Suciedad'], 'sm.dust': ['Dust', 'Polvo'], 'sm.paint': ['Paint coat', 'Capa de pintura'], 'sm.bare': ['Bare metal edges', 'Metal al aire en bordes'],
  'sm.polymer': ['Polymer', 'Polímero'], 'sm.scuff': ['Scuffed edges', 'Bordes rozados'], 'sm.rubber': ['Rubber', 'Goma'], 'sm.grain': ['Grain', 'Grano'],
  'sm.webbing': ['Webbing', 'Cinta'], 'sm.mud': ['Mud', 'Barro'], 'sm.fade': ['Sun fade', 'Descolorido'], 'sm.crev': ['Dark crevices', 'Huecos oscuros'],

  // status and messages
  'st.keys': ['B brush · E eraser · G fill · I picker · W select · D decal · O move · U UV editor · X mask white/black · [ ] size · Ctrl+Z undo · Ctrl+S save',
              'B pincel · E borrador · G rellenar · I cuentagotas · W varita · D parche · O mover · U editor UV · X máscara blanco/negro · [ ] tamaño · Ctrl+Z deshacer · Ctrl+S guardar'],
  'st.computing': ['Computing…', 'Calculando…'], 'st.exporting': ['Exporting…', 'Exportando…'], 'st.saving': ['Saving project…', 'Guardando proyecto…'], 'st.loading': ['Opening project…', 'Abriendo proyecto…'],
  'st.sel': ['Selection: {0}% of the texture of "{1}"', 'Selección: {0}% de la textura de «{1}»'],
  'msg.saved': ['Saved: {0}', 'Guardado: {0}'], 'msg.selpart': ['Select a part with a texture', 'Selecciona una pieza con textura'],
  'msg.notex': ['This part has no texture to edit', 'Esta pieza no tiene textura que editar'], 'msg.locked': ['Part locked: Alt+click to select "{0}"', 'Pieza bloqueada: Alt+clic para seleccionar «{0}»'],
  'msg.color': ['Colour {0}', 'Color {0}'], 'msg.nosel': ['Make a selection with the Select tool first', 'Primero haz una selección con la varita'],
  'msg.noisl': ['Select some islands or faces in the UV editor first', 'Primero selecciona alguna isla o cara en el editor UV'], 'msg.orig': ['Original details added: paint white on its mask to bring back stitching, labels…', 'Detalles originales añadidos: pinta en blanco su máscara para recuperar costuras, etiquetas…'],
  'msg.origsel': ['Original details added inside the selection', 'Detalles originales añadidos dentro de la selección'],
  'props.orig': ['The model\'s own texture. Its mask starts black: paint white on it to bring back stitching, labels or buckles over your new material. Tip: Select by colour on the original first.', 'La textura propia del modelo. Su máscara empieza en negro: píntala de blanco para recuperar costuras, etiquetas o hebillas encima del material nuevo. Truco: primero usa la Varita sobre el original.'],
  'msg.nozone': ['This part has no velcro zones defined', 'Esta pieza no tiene zonas de velcro definidas'],
  'msg.newmask': ['White mask added to the layer', 'Máscara blanca añadida a la capa'], 'msg.newpaint': ['New paint layer', 'Nueva capa de pintura'],
  'msg.nodecal': ['Load an image first', 'Primero carga una imagen'], 'msg.decalmiss': ['The decal did not land on this part', 'El parche no ha caído en esta pieza'],
  'msg.autosetup': ['Added too: velcro and original shading layers', 'Añadidas también: capas de velcro y de sombreado original'],
  'msg.smart': ['{0} layer(s) added', '{0} capa(s) añadida(s)'], 'msg.hasshade': ['This part already has a shading layer', 'Esta pieza ya tiene una capa de sombreado'],
  'msg.nochange': ['You have not changed any part yet', 'Aún no has cambiado ninguna pieza'], 'msg.4k': ['4K: each change takes a few seconds. Tip: work at 1024 and switch to 4096 before exporting.', '4K: cada cambio tarda unos segundos. Consejo: trabaja a 1024 y pasa a 4096 antes de exportar.'],
  'msg.overlap': ['Heads-up: about {0}% of this part shares texture space between several places (overlapping UVs), so paint and decals can show up in more than one spot.', 'Aviso: en torno al {0}% de esta pieza comparte textura entre varios sitios (UV superpuestas), así que la pintura y los parches pueden aparecer en más de un punto.'],
  'msg.badproj': ['Not a TYC Painter project', 'No es un proyecto de TYC Painter'], 'msg.loaded': ['Project opened', 'Proyecto abierto'],
  // Patch Creator
  'pc.title': ['Patch Creator', 'Creador de parches'], 'pc.open': ['Patch Creator…', 'Creador de parches…'],
  'pc.hint': ['Make a patch from text or an image: mesh plus colour, normal and roughness maps, ready for Roblox.', 'Crea un parche a partir de texto o de una imagen: malla y mapas de color, normal y rugosidad, listo para Roblox.'],
  'pc.close': ['Close (Esc)', 'Cerrar (Esc)'],
  'pc.mode': ['Mode', 'Modo'], 'pc.auto': ['Automatic', 'Automático'], 'pc.manual': ['Manual', 'Manual'],
  'pc.type': ['Patch type', 'Tipo de parche'],
  'pc.t.callsign': ['Callsign', 'Callsign'], 'pc.t.callsign.d': ['Laser-cut nylon, IR film letters, velcro back', 'Nailon cortado a láser, letras con lámina IR, velcro detrás'],
  'pc.t.embroidered': ['Embroidered', 'Bordado'], 'pc.t.embroidered.d': ['Thread fill, satin letters, merrow edge', 'Relleno de hilo, letras en satén, borde merrow'],
  'pc.t.pvc': ['PVC', 'PVC'], 'pc.t.pvc.d': ['Moulded rubber, raised rim and art', 'Goma moldeada, borde y dibujo en relieve'],
  'pc.t.lasercut': ['Laser-cut', 'Cortado a láser'], 'pc.t.lasercut.d': ['Cordura, cut letters and frame (FBI/ATF style)', 'Cordura, letras y marco cortados (estilo FBI/ATF)'],
  'pc.shape': ['Shape', 'Forma'],
  'pc.s.rect': ['Rectangle', 'Rectangular'], 'pc.s.round': ['Rounded rectangle', 'Rectángulo redondeado'], 'pc.s.circle': ['Circle', 'Circular'], 'pc.s.oval': ['Oval', 'Ovalada'], 'pc.s.shield': ['Shield', 'Escudo'],
  'pc.s.custom': ['From image (traced outline)', 'Desde imagen (contorno del logo)'],
  'pc.custom.hint': ['The patch takes the outline of your image. Use a logo on a plain or transparent background.', 'El parche toma el contorno de tu imagen. Usa un logo con fondo liso o transparente.'],
  'pc.trace.fail': ['Could not find an outline: use an image with a plain or transparent background', 'No se ha encontrado el contorno: usa una imagen con fondo liso o transparente'],
  'pc.fit': ['Fit', 'Ajuste'],
  'pc.fit.contain': ['Fit inside', 'Encajar'], 'pc.fit.fill': ['Fill patch', 'Rellenar'], 'pc.fit.stretch': ['Stretch', 'Estirar'],
  'pc.fit.contain.tip': ['Whole image inside the margins', 'Toda la imagen dentro de los márgenes'],
  'pc.fit.fill.tip': ['Covers the whole patch; the edges may be trimmed', 'Cubre todo el parche; puede recortar los bordes'],
  'pc.fit.stretch.tip': ['Covers the whole patch, changing the proportions', 'Cubre todo el parche cambiando las proporciones'],
  'pc.mats': ['Materials', 'Materiales'],
  'pc.z.bg': ['Background', 'Fondo'], 'pc.z.art': ['Letters/art', 'Letras/dibujo'], 'pc.z.edge': ['Edge', 'Borde'], 'pc.z.back': ['Back', 'Reverso'],
  'pc.z.own': ["Use the material's own colours", 'Usar los colores del material'], 'pc.z.scale': ['Scale', 'Escala'], 'pc.z.rot': ['Rotation', 'Rotación'],
  'pc.z.proc': ['Generated', 'Generado'], 'pc.z.reset': ['Default', 'Por defecto'],
  'pc.z.hint': ['Pick a zone, then click a material in the shelf below.', 'Elige una zona y haz clic en un material de la estantería de abajo.'],
  'pc.src.ref': ['TYC reference material', 'Material de referencia TYC'], 'pc.src.ph': ['Poly Haven · CC0', 'Poly Haven · CC0'], 'pc.src.acg': ['ambientCG · CC0', 'ambientCG · CC0'], 'pc.src.proc': ['Generated (TYC)', 'Generado (TYC)'],
  'pc.tab.ref': ['References', 'Referencias'], 'pc.shelf.search': ['Search materials…', 'Buscar materiales…'],
  'pc.shelf.refs': ['Materials cut from the reference patches', 'Materiales sacados de los parches de referencia'],
  'pc.shelf.proc': ['made by the app', 'lo hace la app'],
  'pc.shelf.connecting': ['Connecting…', 'Conectando…'], 'pc.shelf.count': ['{0} materials', '{0} materiales'], 'pc.shelf.none': ['Nothing found', 'No se ha encontrado nada'],
  'pc.shelf.fail': ['Could not connect. Check your internet connection.', 'No se ha podido conectar. Revisa la conexión a internet.'],
  'pc.dlfail': ['Download failed: {0}', 'Error al descargar: {0}'],
  'pc.view.split': ['3D + 2D', '3D + 2D'],
  'pc.content': ['Content', 'Contenido'], 'pc.c.text': ['Text', 'Texto'], 'pc.c.image': ['Image', 'Imagen'],
  'pc.text.hint': ['Callsign, unit or name. A new line makes a second row.', 'Callsign, unidad o nombre. Con salto de línea haces una segunda fila.'],
  'pc.font': ['Lettering', 'Tipo de letra'],
  'pc.img.load': ['Upload image…', 'Subir imagen…'], 'pc.noimg': ['No image yet (PNG, JPG or WebP).', 'Aún no hay imagen (PNG, JPG o WebP).'],
  'pc.img.mono': ['One colour (uses the Letters colour, or IR film on callsigns)', 'Un solo color (usa el color de letras, o lámina IR en callsigns)'],
  'pc.img.invert': ['Invert (one-colour mask, or which parts stand out)', 'Invertir (máscara de un color, o qué partes van en relieve)'],
  'pc.img.3d': ['3D embroidery (raise everything except the background colour)', 'Bordado 3D (en relieve todo lo que no sea el color de fondo)'],
  'pc.img.knock': ['Remove flat background', 'Quitar fondo liso'],
  'pc.badimg': ['Could not read that image', 'No se ha podido leer esa imagen'],
  'pc.colors': ['Colours', 'Colores'], 'pc.col.bg': ['Background', 'Fondo'], 'pc.col.fg': ['Letters / art', 'Letras / dibujo'],
  'pc.col.merrow': ['Merrow thread', 'Hilo del borde'], 'pc.col.rim': ['Rim', 'Borde'], 'pc.col.frame': ['Frame line', 'Línea del marco'],
  'pc.sw.hint': ['Click a swatch: background · Right-click: letters · Alt+click: edge', 'Clic en un color: fondo · Clic derecho: letras · Alt+clic: borde'],
  'pc.ir': ['Reflective backing film (IR appearance)', 'Lámina reflectante de fondo (apariencia IR)'], 'pc.stitch': ['Stitch line / frame', 'Línea de costura / marco'],
  'pc.manualT': ['Manual settings', 'Ajustes manuales'],
  'pc.m.w': ['Width (studs)', 'Ancho (studs)'], 'pc.m.h': ['Height (studs)', 'Alto (studs)'], 'pc.m.t': ['Thickness', 'Grosor'],
  'pc.m.edge': ['Edge / merrow', 'Bisel / merrow'], 'pc.m.border': ['Margin', 'Margen'], 'pc.m.textH': ['Text size', 'Tamaño texto'],
  'pc.m.spacing': ['Letter spacing', 'Espaciado'], 'pc.m.textY': ['Text up/down', 'Texto arriba/abajo'], 'pc.m.depth': ['Letter relief', 'Relieve letras'],
  'pc.m.relief': ['Normal strength', 'Fuerza del normal'], 'pc.m.roughBg': ['Roughness bg', 'Rugosidad fondo'], 'pc.m.roughFg': ['Roughness art', 'Rugosidad letras'],
  'pc.m.weave': ['Material scale', 'Escala del material'], 'pc.res': ['Export size', 'Tamaño de exportación'],
  'pc.seed': ['New variation', 'Nueva variación'], 'pc.reset': ['Reset type', 'Restablecer tipo'],
  'pc.export': ['Export patch (.zip)…', 'Exportar parche (.zip)…'], 'pc.topainter': ['Open in TYC Painter', 'Abrir en TYC Painter'],
  'pc.view.tex': ['Texture', 'Textura'], 'pc.busy': ['Generating…', 'Generando…'],
  'pc.info': ['{0} studs · {1}px', '{0} studs · {1}px'],
  'pc.material': ["Procedural material", "Material procedural"],
  'pc.seed.value': ["Seed", "Semilla"],
  'pc.normalFormat': ["Normal format", "Formato normal"],
  'pc.exportMap': ["Export selected map…", "Exportar mapa seleccionado…"],
  'pc.map.select': ["PBR texture channel", "Canal de textura PBR"],
  'pc.map.color': ["Base color", "Color base"],
  'pc.map.normal': ["Tangent normal", "Normal tangente"],
  'pc.map.height': ["Height", "Altura"],
  'pc.map.rough': ["Roughness", "Rugosidad"],
  'pc.map.ao': ["Ambient occlusion", "Oclusión ambiental"],
  'pc.map.metal': ["Metallic", "Metalicidad"],
  'pc.map.opacity': ["Atlas opacity", "Opacidad del atlas"],
  'pc.map.anisotropy': ["Thread direction", "Dirección de los hilos"],
  'pc.mat.stitchStyle': ["Stitch", "Tipo de puntada"],
  'pc.mat.autoDirection': ["Follow design contours", "Seguir los contornos del diseño"],
  'pc.mat.threadThickness': ["Thread thickness", "Grosor del hilo"],
  'pc.mat.threadDensity': ["Stitch density", "Densidad de puntadas"],
  'pc.mat.stitchLength': ["Stitch length", "Longitud de puntada"],
  'pc.mat.stitchDirection': ["Stitch angle (°)", "Ángulo de puntada (°)"],
  'pc.mat.tension': ["Thread tension", "Tensión del hilo"],
  'pc.mat.fiberDensity': ["Fiber detail", "Detalle de fibras"],
  'pc.mat.fiberVariation': ["Fiber variation", "Variación de fibras"],
  'pc.mat.fabricTension': ["Fabric tension", "Tensión del tejido"],
  'pc.mat.fabric': ["Weave", "Tipo de tejido"],
  'pc.mat.finish': ["Rubber finish", "Acabado del caucho"],
  'pc.mat.levels': ["Art relief levels", "Niveles de relieve del dibujo"],
  'pc.mat.imperfections': ["Mould flaws", "Imperfecciones del molde"],
  'pc.mat.edgeRoundness': ["Edge roundness", "Redondez del borde"],
  'pc.mat.colorVariation': ["Color variation", "Variación de color"],
  'pc.mat.wear': ["Wear", "Desgaste"],
  'pc.mat.dirt': ["Dirt", "Suciedad"],
  'pc.mat.backing': ["Velcro backing", "Velcro del reverso"],
  'pc.opt.stitchStyle.satin': ["Satin", "Satén"],
  'pc.opt.stitchStyle.tatami': ["Tatami fill", "Relleno tatami"],
  'pc.opt.stitchStyle.running': ["Running", "Pespunte"],
  'pc.opt.stitchStyle.cross': ["Cross-stitch", "Punto de cruz"],
  'pc.opt.stitchStyle.zigzag': ["Zigzag", "Zigzag"],
  'pc.opt.fabric.cordura': ["Cordura basket weave", "Cordura"],
  'pc.opt.fabric.nylon': ["Plain nylon", "Nailon"],
  'pc.opt.fabric.ripstop': ["Ripstop", "Ripstop"],
  'pc.opt.finish.matte': ["Matte", "Mate"],
  'pc.opt.finish.satin': ["Semi-matte", "Semimate"],
  'pc.opt.finish.gloss': ["Glossy", "Brillante"],
  'pc.opt.backing.hook': ["Hook", "Gancho"],
  'pc.opt.backing.loop': ["Loop", "Bucle"],
  'pc.readme.maps': ["_height.png    Linear 16-bit height, 0 maps to −0.024 stud and 65535 to +0.024 stud.\n_ao.png        Linear ambient occlusion.\n_metal.png     Linear metalness. Patch materials are dielectric.\n_opacity.png   Linear atlas coverage (optional when making a flat decal).\n\nSet Base Color to sRGB and all data maps to Non-Color/Linear. The GLB uses OpenGL normals, RGB-packed occlusion/roughness/metalness and opaque geometry. Height adds optional displacement in the destination.\n{0}{1}", "_height.png    Altura lineal de 16 bits. 0 equivale a −0,024 stud y 65535 a +0,024 stud.\n_ao.png        Oclusión ambiental lineal.\n_metal.png     Metalicidad lineal. Los materiales del parche son dieléctricos.\n_opacity.png   Cobertura lineal del atlas (opcional para crear una calcomanía plana).\n\nConfigura el color base como sRGB y los mapas de datos como Non-Color/Linear. El GLB usa normales OpenGL, oclusión/rugosidad/metalicidad en RGB y geometría opaca. La altura permite añadir desplazamiento en el programa de destino.\n{0}{1}"],
  'pc.readme.dx': ["_nmap_dx.png   DirectX normal (green inverted), for engines that expect −Y.\n", "_nmap_dx.png   Normal DirectX (verde invertido), para motores que esperan −Y.\n"],
  'pc.readme.aniso': ["_anisotropy.png  Tangent direction in RG and relative strength in B, also embedded in glTF. Resolution is at most 1024.\n", "_anisotropy.png  Dirección tangente en RG e intensidad relativa en B, incluido también en el glTF. Resolución máxima de 1024.\n"],
  'pc.readme': ['Patch made with TYC Painter — Patch Creator\n\nSize: {1} studs (width × height × thickness)\n\nFiles\n  {0}.glb         mesh with its PBR material (colour, normal, roughness) embedded\n  {0}.obj / .mtl  the same mesh as OBJ, in studs\n  {0}_diff.png    ColorMap\n  {0}_nmap.png    NormalMap\n  {0}_rough.png   RoughnessMap\n\nRoblox Studio\n  1. Import the .glb with the 3D Importer (Avatar → Import 3D or File → Import 3D).\n     If the SurfaceAppearance does not come in, or you import the .obj instead, add one to the MeshPart\n     and upload the three PNGs to ColorMap, NormalMap and RoughnessMap.\n  2. Check the size: it should be {1} studs. If not, set MeshPart.Size to it.\n', 'Parche hecho con TYC Painter — Creador de parches\n\nTamaño: {1} studs (ancho × alto × grosor)\n\nArchivos\n  {0}.glb         malla con su material PBR (color, normal, rugosidad) incluido\n  {0}.obj / .mtl  la misma malla en OBJ, en studs\n  {0}_diff.png    ColorMap\n  {0}_nmap.png    NormalMap\n  {0}_rough.png   RoughnessMap\n\nRoblox Studio\n  1. Importa el .glb con el importador 3D (Avatar → Importar 3D o Archivo → Importar 3D).\n     Si no aparece el SurfaceAppearance, o si importas el .obj, añade uno a la MeshPart\n     y sube los tres PNG a ColorMap, NormalMap y RoughnessMap.\n  2. Comprueba el tamaño: debería ser {1} studs. Si no, pon ese valor en MeshPart.Size.\n'],
};

let lang = 'en';
try{ lang = localStorage.getItem('lang') || ((navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'); } catch{}
export const getLang = () => lang;
export function setLang(l){ lang = l === 'es' ? 'es' : 'en'; try{ localStorage.setItem('lang', lang); } catch{} }
export const pick = pair => pair[lang === 'es' ? 1 : 0];
export function t(key, ...args){
  const e = D[key]; if(!e) return key;
  return pick(e).replace(/\{(\d+)\}/g, (_, i) => args[+i] ?? '');
}
export function applyI18n(root){
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}
export const KEYS = Object.keys(D);

// ---------------------------------------------------------------- automatic translation of fixed English labels
// Menus, dialogs and panels added in 1.0 build their text in code. Exact English strings found in the page
// are swapped for Spanish (and back) here, including elements created later (watched with a MutationObserver).
const AUTO = {
  'File':'Archivo', 'Edit':'Editar', 'View':'Ver', 'Mode':'Modo', 'Window':'Ventana', 'Help':'Ayuda',
  'Open model':'Abrir modelo', 'Open project':'Abrir proyecto', 'Save project':'Guardar proyecto', 'Recover autosave':'Recuperar autoguardado',
  'Export textures…':'Exportar texturas…', 'Export changed sets':'Exportar piezas modificadas', 'Undo':'Deshacer', 'Redo':'Rehacer',
  'Frame':'Encuadrar', 'Toggle UV':'Mostrar u ocultar UV', 'Focus mode':'Modo enfoque', 'Patch Studio':'Creador de parches',
  'Bake Mesh Maps…':'Hornear mapas de malla…', 'Focus':'Enfoque', 'Full screen':'Pantalla completa', 'Reset panels':'Restablecer paneles',
  'Keyboard shortcuts…':'Atajos de teclado…', 'Focus · Tab':'Enfoque · Tab',
  'Alpha':'Alfa', 'Round':'Redondo', 'Scratch':'Arañazo', 'Speckle':'Moteado', 'Stitch':'Puntada', 'Custom':'Personalizado', 'Angle':'Ángulo', 'Pen':'Presión',
  'Roughness':'Rugosidad', 'Metalness':'Metalicidad', 'Height ±':'Altura ±', 'Height':'Altura', 'Add editable UV decal':'Añadir calcomanía UV editable',
  'Display Settings':'Ajustes de visualización', 'Exposure':'Exposición', 'Environment':'Entorno', 'Rotation':'Rotación',
  'Optical shader · texture set':'Shader óptico · pieza', 'Transmission':'Transmisión', 'Ior':'IOR', 'Clearcoat':'Barniz', 'Iridescence':'Iridiscencia',
  'Brush':'Pincel', '+ Group':'+ Grupo', '+ Stitch':'+ Costura', 'Scale':'Escala', 'Relief':'Relieve', 'Edit UV path':'Editar trazado UV',
  'Remove last point':'Quitar último punto', 'UV points ·':'Puntos UV ·', 'Thread width':'Grosor del hilo', 'Stitch pitch':'Separación de puntadas',
  'Thread':'Hilo', 'Loading…':'Cargando…', 'rough':'rugos.', 'height':'altura', 'nrm':'normal',
  'TYC Painter · Keyboard shortcuts':'TYC Painter · Atajos de teclado', 'Tab · Focus　 Ctrl/Cmd + Shift + E · Export':'Tab · Enfoque　 Ctrl/Cmd + Shift + E · Exportar',
  'Search assets':'Buscar recursos', 'Create editable stitch path':'Crear costura editable', 'Group selected layer':'Agrupar la capa seleccionada',
  'Paint / erase in UV space':'Pintar / borrar en el espacio UV', 'Paint roughness, metalness and height per texel':'Pintar rugosidad, metalicidad y altura por texel',
  'Painting tools':'Herramientas de pintura', 'Close':'Cerrar',
  // Export / bake dialog
  'Export Textures':'Exportar texturas', 'Bake Mesh Maps':'Hornear mapas de malla', 'Texture Set':'Pieza', 'All texture sets':'Todas las piezas',
  'Preset':'Preajuste', 'Roblox / Blender · separate PNG':'Roblox / Blender · PNG separados', 'Maps':'Mapas', 'Base color':'Color base',
  'Surface channels':'Canales de superficie', 'Height · 16 bit':'Altura · 16 bits', 'Mesh map':'Mapa de malla', 'World Space Normal':'Normal en espacio mundo',
  'Position · normalized per set':'Posición · normalizada por pieza', 'Resolution':'Resolución', 'Padding':'Margen', 'Export PNG set…':'Exportar PNG…',
  'Bake PNG…':'Hornear PNG…', 'Select at least one map':'Elige al menos un mapa',
  // keyboard shortcuts dialog
  'Reset shortcuts':'Restablecer atajos', 'Press a key · Esc to cancel':'Pulsa una tecla · Esc para cancelar', 'Unavailable or already assigned':'No disponible o ya asignada',
  'paint':'pincel', 'erase':'borrador', 'fill':'rellenar', 'orbit':'mover', 'pick':'cuentagotas', 'decal':'calcomanía', 'wand':'varita', 'frame':'encuadrar',
  'channel':'canal', 'split':'vista dividida', 'view3D':'vista 3D', 'viewUV':'vista UV',
  // layer menu and layer names
  'Duplicate':'Duplicar', 'Delete':'Eliminar', 'Ungroup':'Desagrupar', 'White mask':'Máscara blanca', 'Black mask':'Máscara negra', 'Invert mask':'Invertir máscara',
  'Remove mask':'Quitar máscara', 'PBR Paint':'Pintura PBR', 'Procedural PBR':'PBR procedural',
  'Cordura-style 330D':'Tipo Cordura 330D', 'Cordura-style 500D':'Tipo Cordura 500D', 'Cordura-style 1000D':'Tipo Cordura 1000D', 'Spacer mesh':'Malla espaciadora',
  'Cordura-style nylon':'Nailon tipo Cordura', 'Ripstop nylon':'Nailon ripstop', 'Nylon webbing':'Cincha de nailon', 'Molded polymer':'Polímero moldeado',
  'Ceramic coating':'Recubrimiento cerámico', 'Textured rubber':'Goma texturizada', 'Woven composite':'Composite tejido', 'Anodized metal':'Metal anodizado',
  'No recovery snapshot yet':'Todavía no hay copia de recuperación',
  // project checks
  'Unsupported project version':'Versión de proyecto no compatible', 'Invalid texture size':'Tamaño de textura no válido', 'Invalid base layer':'Capa base no válida',
  'Duplicate layer ID':'ID de capa duplicado', 'Missing layer material':'Falta el material de una capa', 'Invalid stitch path':'Costura no válida',
  'Invalid group hierarchy':'Jerarquía de grupos no válida',
};
const AUTO_EN = Object.fromEntries(Object.entries(AUTO).map(([en, es]) => [es, en]));
const ORIG = new WeakMap(), ATTRS = ['title', 'placeholder', 'aria-label'];
function autoText(n){
  const raw = n.nodeValue, key = raw.trim(); if(!key) return;
  let en = ORIG.get(n);
  if(en === undefined || (key !== en && key !== AUTO[en])){ en = key in AUTO ? key : AUTO_EN[key]; if(en === undefined){ ORIG.delete(n); return; } ORIG.set(n, en); }
  const want = lang === 'es' ? AUTO[en] : en;
  if(key !== want) n.nodeValue = raw.replace(key, want);
}
function autoAttrs(el){
  for(const a of ATTRS){
    const v = el.getAttribute && el.getAttribute(a); if(!v) continue;
    const store = 'data-en-' + a; let en = el.getAttribute(store);
    if(!en || (v !== en && v !== AUTO[en])){ en = v in AUTO ? v : AUTO_EN[v]; if(!en) continue; el.setAttribute(store, en); }
    const want = lang === 'es' ? AUTO[en] : en; if(v !== want) el.setAttribute(a, want);
  }
}
function autoTree(root){
  if(!root) return;
  if(root.nodeType === 3){ autoText(root); return; }
  if(root.nodeType !== 1 || root.closest?.('script,style,textarea')) return;
  autoAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
  while((n = w.nextNode())){ if(n.nodeType === 3) autoText(n); else autoAttrs(n); }
  root.querySelectorAll?.('option').forEach(o => { const k = o.textContent; if(k in AUTO || k in AUTO_EN){ const en = k in AUTO ? k : AUTO_EN[k]; o.textContent = lang === 'es' ? AUTO[en] : en; } });
}
let autoObs = null;
export function autoTranslate(){
  autoTree(document.body);
  if(autoObs) return;
  autoObs = new MutationObserver(list => { for(const m of list){
    if(m.type === 'characterData') autoText(m.target);
    else if(m.type === 'attributes') autoAttrs(m.target);
    else m.addedNodes.forEach(autoTree);
  } });
  autoObs.observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATTRS });
}
