/* =============================================================================
   CARTA VIVA — los platos en 3D, modelados por código
   Cada plato se arma por capas (pan, medallón, cheddar…). Así se puede:
     · "explotar" el plato para ver qué tiene, capa por capa;
     · cambiarlo en vivo cuando el comensal lo arma a su gusto.
   Cuando un local tenga sus platos escaneados (.glb), esos reemplazan a estos.

   Construir(plato, eleccion) devuelve un THREE.Group con:
     userData.capas      [{ nombre, detalle, obj, base }]
     userData.explotar   (0…1) separa las capas
     userData.animar     (t) burbujas y otros detalles vivos (opcional)
     userData.inclinacion  cuánto se inclina hacia la cámara
   ============================================================================= */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const T = THREE;
const PI = Math.PI;

/* ---------------------------------------------------------------------------
   Herramientas
   --------------------------------------------------------------------------- */

// Azar con semilla: el mismo plato sale siempre igual (en la carta y en la foto).
function azar(semilla) {
  let x = 0;
  for (const c of String(semilla)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  x = x || 1;
  const r = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  r.entre = (a, b) => a + (b - a) * r();
  return r;
}

// Ruido suave para que nada quede "de plástico": solo depende de la posición, así los
// bordes que comparten vértice se mueven juntos y no se abren grietas.
function ruido(x, y, z) {
  return Math.sin(x * 1.9 + Math.sin(y * 2.7 + z * 1.3) * 1.7) *
         Math.sin(y * 2.3 + Math.sin(z * 1.1 + x * 2.9) * 1.5) *
         Math.sin(z * 2.1 + Math.sin(x * 1.7 + y * 0.9) * 1.3);
}

function organico(geo, cant, frec, centroY = null) {
  geo.deleteAttribute("uv");
  geo.deleteAttribute("normal");
  const g = mergeVertices(geo);
  g.computeBoundingBox();
  const cy = centroY ?? (g.boundingBox.min.y + g.boundingBox.max.y) / 2;
  const p = g.attributes.position;
  const v = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = ruido(v.x * frec, v.y * frec, v.z * frec) * cant;
    const dir = new T.Vector3(v.x, v.y - cy, v.z).normalize();
    p.setXYZ(i, v.x + dir.x * d, v.y + dir.y * d, v.z + dir.z * d);
  }
  g.computeVertexNormals();
  return g;
}

// Torno: un perfil [radio, altura] que gira alrededor del eje. Con suave=true pasa una
// curva por los puntos.
function torno(puntos, seg = 48, suave = true) {
  let pts = puntos.map(([r, y]) => new T.Vector2(r, y));
  if (suave) pts = new T.SplineCurve(pts).getPoints(puntos.length * 8);
  return new T.LatheGeometry(pts, seg);
}

const materiales = new Map();
function mat(color, o = {}) {
  const k = o.map ? null : color + JSON.stringify(o);     // con textura propia no se comparte
  if (k && materiales.has(k)) return materiales.get(k);
  const fisico = o.brillo || o.vidrio;
  const m = new (fisico ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)({
    color,
    roughness: o.rug ?? 0.6,
    metalness: 0,
    side: o.doble ? T.DoubleSide : T.FrontSide,
    transparent: o.op != null,
    opacity: o.op ?? 1,
    map: o.map || null,
  });
  if (fisico) { m.clearcoat = o.brillo || 1; m.clearcoatRoughness = 0.18; }
  if (o.vidrio) { m.depthWrite = false; m.envMapIntensity = 1.6; }
  if (o.op != null && !o.vidrio) m.depthWrite = o.op > 0.8;
  if (k) materiales.set(k, m);
  return m;
}

const malla = (geo, material) => new T.Mesh(geo, material);

function grupo(...hijos) {
  const g = new T.Group();
  hijos.forEach(h => h && g.add(h));
  return g;
}

// Textura dibujada en un canvas (rayas del sorbete, la caja de papas, el limón…)
function textura(ancho, alto, dibujar, repetir) {
  const c = document.createElement("canvas");
  c.width = ancho; c.height = alto;
  dibujar(c.getContext("2d"), ancho, alto);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  if (repetir) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repetir); }
  return t;
}

// Muchas piezas iguales (semillas, papas, orégano) en una sola malla.
function instancias(geo, material, lista, colores) {
  const im = new T.InstancedMesh(geo, material, lista.length);
  const m = new T.Matrix4();
  lista.forEach((x, i) => {
    m.compose(x.p, x.q || new T.Quaternion(), x.s || new T.Vector3(1, 1, 1));
    im.setMatrixAt(i, m);
    if (colores) im.setColorAt(i, new T.Color(colores[i % colores.length]));
  });
  return im;
}

// Puntos repartidos en un disco sin encimarse demasiado.
function repartir(rnd, cant, radio, sep) {
  const pts = [];
  for (let intento = 0; pts.length < cant && intento < cant * 60; intento++) {
    const a = rnd() * PI * 2, r = Math.sqrt(rnd()) * radio;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (pts.every(p => Math.hypot(p.x - x, p.z - z) > sep)) pts.push({ x, z });
  }
  return pts;
}

// Apila capas de abajo hacia arriba y prepara la "explosión". Cada capa respeta la
// altura que ya traía (y0) y se le suma dónde le toca en la pila (base).
function apilar(capas, separacion = 0.42) {
  const g = new T.Group();
  let y = 0;
  capas.forEach((c, i) => {
    c.y0 = c.obj.position.y;
    c.base = y;
    c.i = i;
    y += c.alto;
    g.add(c.obj);
  });
  g.userData.capas = capas;
  g.userData.explotar = f => capas.forEach(c => { c.obj.position.y = c.y0 + c.base + c.i * separacion * f; });
  return g;
}

// Hoja (albahaca, menta)
function hoja(largo = 0.34, ancho = 0.13) {
  const s = new T.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(ancho, largo * 0.4, 0, largo);
  s.quadraticCurveTo(-ancho, largo * 0.4, 0, 0);
  const g = new T.ShapeGeometry(s, 10);
  g.rotateX(-PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getX(i) ** 2 * 3 + p.getZ(i) ** 2 * 0.4);
  g.computeVertexNormals();
  return g;
}

/* ---------------------------------------------------------------------------
   Hamburguesas
   --------------------------------------------------------------------------- */

const PANES = {
  papa:     { corteza: "#DB8A2E", miga: "#F5D39A", semilla: "#FFF1CC" },
  integral: { corteza: "#B8742F", miga: "#E3BC85", semilla: "#3A2A1E" },
};

function panAbajo(pan) {
  const c = PANES[pan];
  const g = torno([[0, 0], [0.9, 0], [1.0, 0.03], [1.05, 0.12], [1.04, 0.22], [0.99, 0.29], [0.9, 0.31], [0, 0.31]]);
  const miga = malla(new T.CylinderGeometry(0.93, 0.93, 0.012, 48), mat(c.miga, { rug: 0.95 }));
  miga.position.y = 0.305;
  return grupo(malla(g, mat(c.corteza, { rug: 0.55 })), miga);
}

function panArriba(pan, rnd) {
  const c = PANES[pan];
  const perfil = [[0, 0], [0.96, 0], [1.05, 0.05], [1.09, 0.16], [1.04, 0.32], [0.9, 0.5], [0.66, 0.66], [0.36, 0.75], [0, 0.78]];
  const curva = new T.SplineCurve(perfil.map(([r, y]) => new T.Vector2(r, y))).getPoints(80);
  const cupula = malla(new T.LatheGeometry(curva, 64), mat(c.corteza, { rug: 0.4, brillo: 0.45 }));

  // Semillas de sésamo, apoyadas sobre la cúpula
  const lista = [];
  const arriba = new T.Vector3(0, 1, 0);
  for (let i = 0; i < 70; i++) {
    const k = 33 + Math.floor(rnd() * 43);              // tramo de la cúpula (desde el borde hasta arriba)
    const a = curva[k], b = curva[k + 1];
    const phi = rnd() * PI * 2;
    const nr = b.y - a.y, ny = -(b.x - a.x);            // normal hacia afuera del perfil
    const largo = Math.hypot(nr, ny) || 1;
    const n = new T.Vector3((nr / largo) * Math.cos(phi), ny / largo, (nr / largo) * Math.sin(phi));
    const q = new T.Quaternion().setFromUnitVectors(arriba, n);
    q.multiply(new T.Quaternion().setFromAxisAngle(arriba, rnd() * PI));
    lista.push({ p: new T.Vector3(a.x * Math.cos(phi), a.y, a.x * Math.sin(phi)).addScaledVector(n, 0.006), q });
  }
  const semilla = new T.SphereGeometry(0.032, 8, 6);
  semilla.scale(1, 0.5, 1.9);
  return grupo(cupula, instancias(semilla, mat(c.semilla, { rug: 0.5 }), lista));
}

function medallon(tipo) {
  const g = torno([[0, 0], [1.02, 0], [1.1, 0.05], [1.13, 0.15], [1.1, 0.25], [1.02, 0.3], [0, 0.3]], 64);
  const carne = tipo === "carne";
  return malla(organico(g, carne ? 0.045 : 0.03, carne ? 5 : 8), mat(carne ? "#5A301F" : "#9C2F57", { rug: 0.72, brillo: 0.15 }));
}

function cheddar(rnd) {
  const g = new T.PlaneGeometry(2.15, 2.15, 30, 30);
  g.rotateX(-PI / 2);
  g.rotateY(PI / 4 + rnd.entre(-0.3, 0.3));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    const d = Math.max(0, r - 0.92);
    const s = 1 - d * 0.1;
    p.setXYZ(i, x * s, 0.012 - d * d * 1.25 - d * 0.12, z * s);
  }
  g.computeVertexNormals();
  return malla(g, mat("#F28705", { rug: 0.42, doble: true }));
}

function lechuga(rnd) {
  const g = new T.RingGeometry(0.001, 1.22, 80, 6);
  g.rotateX(-PI / 2);
  const f = rnd.entre(0, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const r2 = r * (1 + 0.06 * Math.sin(a * 9 + f) + 0.03 * Math.sin(a * 17));
    const y = (r / 1.22) ** 2 * (0.09 * Math.sin(a * 11 + f) + 0.05 * Math.sin(a * 5 + 2));
    p.setXYZ(i, Math.cos(a) * r2, y + 0.02, Math.sin(a) * r2);
  }
  g.computeVertexNormals();
  return malla(g, mat("#7BCB4B", { rug: 0.5, doble: true }));
}

function tomate(rnd) {
  const g = new T.Group();
  const cascara = mat("#E5382B", { rug: 0.35, brillo: 0.6 });
  const pulpa = mat("#F46A4E", { rug: 0.4, brillo: 0.4 });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + rnd.entre(-0.2, 0.2);
    const r = grupo(
      malla(new T.CylinderGeometry(0.45, 0.45, 0.09, 36), cascara),
      malla(new T.CylinderGeometry(0.33, 0.33, 0.1, 36), pulpa),
    );
    r.position.set(Math.cos(a) * 0.5, 0.045 + i * 0.012, Math.sin(a) * 0.5);
    g.add(r);
  }
  return g;
}

function cebolla(rnd) {
  const g = new T.Group();
  const m = mat("#B94A8C", { rug: 0.4, brillo: 0.3 });
  for (let i = 0; i < 5; i++) {
    const t = new T.TorusGeometry(rnd.entre(0.26, 0.46), 0.034, 8, 44);
    t.rotateX(PI / 2);
    const a = malla(t, m);
    a.position.set(rnd.entre(-0.4, 0.4), 0.03 + i * 0.008, rnd.entre(-0.4, 0.4));
    g.add(a);
  }
  return g;
}

function palta(rnd) {
  const g = new T.Group();
  const m = mat("#A5CF4A", { rug: 0.35, brillo: 0.4 });
  for (let i = 0; i < 5; i++) {
    const s = new T.SphereGeometry(0.5, 24, 12);
    s.scale(0.24, 0.07, 0.66);
    const f = malla(s, m);
    f.rotation.y = i * 0.62 - 1.2 + rnd.entre(-0.1, 0.1);
    f.position.set(Math.sin(f.rotation.y) * 0.3, 0.04 + i * 0.006, Math.cos(f.rotation.y) * 0.3);
    g.add(f);
  }
  return g;
}

function salsa(color, rnd) {
  const g = new T.RingGeometry(0.001, 1.02, 72, 3);
  g.rotateX(-PI / 2);
  const f = rnd.entre(0, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const r2 = r * (1 + 0.14 * Math.max(0, Math.sin(a * 5 + f)) ** 3);
    p.setXYZ(i, Math.cos(a) * r2, 0.012, Math.sin(a) * r2);
  }
  g.computeVertexNormals();
  return malla(g, mat(color, { rug: 0.25, brillo: 0.7, doble: true }));
}

function bacon(rnd) {
  const tex = textura(16, 64, (x, w, h) => {
    const bandas = [["#A8352A", 0.28], ["#F2C2A4", 0.14], ["#C0452F", 0.3], ["#F4CDB2", 0.12], ["#9E2F25", 0.16]];
    let y = 0;
    bandas.forEach(([c, f]) => { x.fillStyle = c; x.fillRect(0, y, w, f * h + 1); y += f * h; });
  });
  const m = mat("#ffffff", { rug: 0.5, brillo: 0.3, doble: true, map: tex });
  const g = new T.Group();
  [[0.45, 0.02], [-0.55, 0.06]].forEach(([rot, y]) => {
    const t = new T.PlaneGeometry(2.05, 0.34, 56, 1);
    t.rotateX(-PI / 2);
    const p = t.attributes.position;
    const f = rnd.entre(0, 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setY(i, Math.sin(x * 5.5 + f) * 0.05 + Math.sin(x * 2.3) * 0.02);
    }
    t.computeVertexNormals();
    const tira = malla(t, m);
    tira.rotation.y = rot;
    tira.position.y = y + 0.04;
    g.add(tira);
  });
  return g;
}

function huevo(rnd) {
  const g = new T.RingGeometry(0.001, 0.92, 72, 6);
  g.rotateX(-PI / 2);
  const f = rnd.entre(0, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    const r2 = r * (1 + 0.1 * Math.sin(a * 3 + f) + 0.05 * Math.sin(a * 7));
    p.setXYZ(i, Math.cos(a) * r2, 0.035 * (1 - (r / 0.92) ** 2) + 0.01, Math.sin(a) * r2);
  }
  g.computeVertexNormals();
  const yema = new T.SphereGeometry(0.3, 32, 16);
  yema.scale(1, 0.55, 1);
  const y = malla(yema, mat("#FFB000", { rug: 0.2, brillo: 1 }));
  y.position.set(0.12, 0.05, -0.05);
  return grupo(malla(g, mat("#FFFAF0", { rug: 0.35, brillo: 0.4, doble: true })), y);
}

function hamburguesa(cfg, rnd) {
  const pan = cfg.pan || "papa";
  const con = new Set(cfg.con || []);
  const extras = new Set(cfg.extras || []);
  const conCheddar = cfg.cheddar !== false;
  const carne = cfg.medallon !== "remolacha";
  const capas = [];
  const sumar = (nombre, detalle, obj, alto) => capas.push({ nombre, detalle, obj, alto });

  sumar(pan === "integral" ? "Pan integral" : "Pan de papa", "horneado en el día", panAbajo(pan), 0.31);
  if (con.has("lechuga")) sumar("Lechuga", "", lechuga(rnd), 0.05);
  if (con.has("tomate")) sumar("Tomate", "", tomate(rnd), 0.1);
  for (let i = 0; i < (cfg.medallones || 1); i++) {
    sumar("Medallón", carne ? "180 g, smasheado" : "remolacha y garbanzos", medallon(carne ? "carne" : "remolacha"), 0.3);
    if (conCheddar) sumar("Cheddar", "", cheddar(rnd), 0.03);
    if (i === 0 && extras.has("cheddar")) sumar("Cheddar extra", "", cheddar(rnd), 0.03);
  }
  if (extras.has("bacon")) sumar("Panceta", "crocante", bacon(rnd), 0.1);
  if (extras.has("huevo")) sumar("Huevo frito", "", huevo(rnd), 0.12);
  if (cfg.palta) sumar("Palta", "", palta(rnd), 0.08);
  if (con.has("cebolla")) sumar("Cebolla morada", "", cebolla(rnd), 0.05);
  sumar(cfg.salsaNombre || "Salsa", "", salsa(cfg.salsa || "#F3B63F", rnd), 0.03);
  sumar(pan === "integral" ? "Pan integral" : "Pan de papa", "con sésamo", panArriba(pan, rnd), 0.78);

  const g = apilar(capas, 0.44);
  g.userData.inclinacion = 0.2;
  return g;
}

/* ---------------------------------------------------------------------------
   Pizzas
   --------------------------------------------------------------------------- */

function pizza(cfg, rnd) {
  const tops = new Set(cfg.toppings || []);
  const capas = [];
  const sumar = (nombre, detalle, obj, alto) => capas.push({ nombre, detalle, obj, alto });

  // Masa con borde inflado y alguna mancha de horno
  const base = malla(new T.CylinderGeometry(1.45, 1.42, 0.1, 72), mat("#F0C98A", { rug: 0.85 }));
  base.position.y = 0.05;
  const borde = new T.TorusGeometry(1.45, 0.17, 20, 110);
  borde.rotateX(PI / 2);
  const bordeM = malla(organico(borde, 0.035, 4, 0), mat("#D98F3E", { rug: 0.7 }));
  bordeM.position.y = 0.1;
  const manchas = [];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * PI * 2;
    manchas.push({
      p: new T.Vector3(Math.cos(a) * 1.45, 0.25, Math.sin(a) * 1.45),
      q: new T.Quaternion().setFromEuler(new T.Euler(0, -a, 0)),
      s: new T.Vector3(rnd.entre(0.6, 1.4), 0.25, rnd.entre(0.6, 1.4)),
    });
  }
  const mancha = new T.SphereGeometry(0.07, 10, 6);
  sumar("Masa", "fermentación lenta", grupo(base, bordeM, instancias(mancha, mat("#7A4318", { rug: 0.9 }), manchas)), 0.1);

  const salsaG = organico(new T.CylinderGeometry(1.34, 1.34, 0.03, 72, 1), 0.02, 5, 0);
  sumar("Salsa de tomate", "", malla(salsaG, mat("#D2381F", { rug: 0.3, brillo: 0.5 })), 0.03);

  const quesoG = organico(new T.CylinderGeometry(1.26, 1.26, 0.05, 72, 2), 0.03, 6, 0);
  const burbujas = [];
  for (const p of repartir(rnd, 14, 1.1, 0.3)) {
    burbujas.push({ p: new T.Vector3(p.x, 0.03, p.z), s: new T.Vector3(rnd.entre(0.8, 1.6), 0.35, rnd.entre(0.8, 1.6)) });
  }
  sumar("Muzzarella", "", grupo(
    malla(quesoG, mat("#FFE08A", { rug: 0.4, brillo: 0.3 })),
    instancias(new T.SphereGeometry(0.1, 12, 8), mat("#F3BE58", { rug: 0.45, brillo: 0.3 }), burbujas),
  ), 0.05);

  if (tops.has("pepperoni")) {
    const lista = repartir(rnd, 15, 1.08, 0.36).map(p => ({
      p: new T.Vector3(p.x, 0.02, p.z),
      q: new T.Quaternion().setFromEuler(new T.Euler(rnd.entre(-0.08, 0.08), 0, rnd.entre(-0.08, 0.08))),
    }));
    const disco = new T.CylinderGeometry(0.2, 0.21, 0.035, 30);
    sumar("Pepperoni", "", instancias(disco, mat("#B8322A", { rug: 0.4, brillo: 0.4 }), lista), 0.04);
  }
  if (tops.has("cebolla")) {
    const g = new T.Group();
    const m1 = mat("#FBF1E1", { rug: 0.3, brillo: 0.5 }), m2 = mat("#E9C58F", { rug: 0.4, brillo: 0.4 });
    for (const p of repartir(rnd, 40, 1.12, 0.12)) {
      const t = new T.TorusGeometry(rnd.entre(0.14, 0.3), 0.022, 6, 22, rnd.entre(2.2, 3.6));
      t.rotateX(PI / 2);
      const a = malla(t, rnd() < 0.3 ? m2 : m1);
      a.position.set(p.x, 0.025, p.z);
      a.rotation.y = rnd() * PI * 2;
      g.add(a);
    }
    sumar("Cebolla en pluma", "dulce, bien cocida", g, 0.04);
  }
  if (tops.has("albahaca")) {
    const g = new T.Group();
    const m = mat("#2F9E48", { rug: 0.45, brillo: 0.3, doble: true });
    repartir(rnd, 6, 0.8, 0.35).forEach(p => {
      const h = malla(hoja(0.36, 0.14), m);
      h.position.set(p.x, 0.03, p.z);
      h.rotation.y = rnd() * PI * 2;
      g.add(h);
    });
    sumar("Albahaca", "fresca", g, 0.03);
  }
  if (tops.has("oregano")) {
    const lista = repartir(rnd, 140, 1.15, 0.05).map(p => ({
      p: new T.Vector3(p.x, 0.02, p.z),
      q: new T.Quaternion().setFromEuler(new T.Euler(rnd() * 3, rnd() * 3, rnd() * 3)),
    }));
    sumar("Orégano", "", instancias(new T.BoxGeometry(0.035, 0.012, 0.025), mat("#4E6B2A", { rug: 0.8 }), lista), 0.02);
  }
  const g = apilar(capas, 0.34);
  g.userData.inclinacion = 0.62;
  return g;
}

/* ---------------------------------------------------------------------------
   Para picar
   --------------------------------------------------------------------------- */

function papas(cfg, rnd, local) {
  // La caja lleva el nombre del local
  const tex = textura(1024, 256, (x, w, h) => {
    x.fillStyle = "#FF3D57"; x.fillRect(0, 0, w, h);
    x.fillStyle = "#FFF6E9"; x.fillRect(0, h * 0.58, w, h * 0.16);
    x.fillStyle = "#FFF6E9";
    x.font = `800 ${h * 0.15}px "Archivo", "Arial Black", system-ui, sans-serif`;
    x.textAlign = "center"; x.textBaseline = "middle";
    for (let i = 0; i < 4; i++) x.fillText(String(local || "").toUpperCase(), w / 8 + (i * w) / 4, h * 0.38);
  });
  const cajaG = new T.CylinderGeometry(0.8, 0.56, 1.15, 4, 1, true);
  cajaG.rotateY(PI / 4);
  const caja = malla(cajaG, mat("#ffffff", { rug: 0.55, doble: true, map: tex }));
  caja.position.y = 0.575;
  const fondo = malla(new T.BoxGeometry(0.78, 0.02, 0.78), mat("#E02C47", { rug: 0.6 }));
  fondo.position.y = 0.01;

  // Como un ramo: abajo se juntan y arriba se abren
  const lista = [];
  for (let i = 0; i < 56; i++) {
    const x = rnd.entre(-0.3, 0.3), z = rnd.entre(-0.3, 0.3);
    lista.push({
      p: new T.Vector3(x, rnd.entre(0.72, 1.08), z),
      q: new T.Quaternion().setFromEuler(new T.Euler(z * 0.8 + rnd.entre(-0.08, 0.08), 0, -x * 0.8 + rnd.entre(-0.08, 0.08))),
    });
  }
  const papa = new RoundedBoxGeometry(0.13, 1.25, 0.13, 2, 0.035);
  const fritas = instancias(papa, mat("#ffffff", { rug: 0.55 }), lista, ["#FFC43D", "#F5B52E", "#FFD15C", "#EFA728"]);

  const cheddarG = organico(new T.SphereGeometry(0.44, 48, 20, 0, PI * 2, 0, PI / 2), 0.05, 5, 0);
  cheddarG.scale(1, 0.42, 1);
  const mc = mat("#F28705", { rug: 0.35, brillo: 0.4 });
  const queso = grupo(malla(cheddarG, mc));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2 + 0.3;
    const gota = malla(new T.CapsuleGeometry(0.06, rnd.entre(0.12, 0.32), 4, 10), mc);
    gota.position.set(Math.cos(a) * 0.4, -0.08, Math.sin(a) * 0.4);
    queso.add(gota);
  }
  const verdeo = [];
  for (const p of repartir(rnd, 26, 0.38, 0.07)) {
    const y = 0.42 * 0.44 * Math.sqrt(Math.max(0, 1 - (p.x * p.x + p.z * p.z) / 0.19)) + 0.01;
    verdeo.push({ p: new T.Vector3(p.x, y, p.z), q: new T.Quaternion().setFromEuler(new T.Euler(rnd() * 3, 0, rnd() * 3)) });
  }
  const aro = new T.TorusGeometry(0.035, 0.013, 6, 14);

  // las papas salen de adentro de la caja
  const g = apilar([
    { nombre: "Caja", detalle: "", obj: grupo(caja, fondo), alto: 0 },
    { nombre: "Papas rústicas", detalle: "con cáscara", obj: fritas, alto: 1.18 },
    { nombre: "Cheddar fundido", detalle: "", obj: queso, alto: 0.02 },
    { nombre: "Verdeo", detalle: "", obj: instancias(aro, mat("#5DBB45", { rug: 0.5 }), verdeo), alto: 0 },
  ], 0.45);
  g.userData.inclinacion = 0.18;
  return g;
}

function aros(cfg, rnd) {
  const torre = new T.Group();
  const m = mat("#E3A13C", { rug: 0.72 });
  for (let i = 0; i < 5; i++) {
    const t = organico(new T.TorusGeometry(0.66 - i * 0.04, 0.15, 22, 64), 0.04, 7, 0);
    t.rotateX(PI / 2);
    const a = malla(t, m);
    a.position.set(i * 0.07 + rnd.entre(-0.05, 0.05), 0.15 + i * 0.25, rnd.entre(-0.08, 0.08));
    a.rotation.set(rnd.entre(-0.15, 0.15), 0, rnd.entre(-0.18, 0.05));
    torre.add(a);
  }
  torre.position.x = -0.35;
  const cuenco = malla(torno([[0, 0], [0.32, 0], [0.42, 0.1], [0.46, 0.3], [0.44, 0.32], [0.38, 0.14], [0, 0.12]], 48, false), mat("#FFF6E9", { rug: 0.3, brillo: 0.5 }));
  const dip = malla(new T.CylinderGeometry(0.41, 0.36, 0.14, 40), mat("#7E2410", { rug: 0.2, brillo: 0.8 }));
  dip.position.y = 0.19;
  const bowl = grupo(cuenco, dip);
  bowl.position.set(0.95, 0, 0.45);
  const g = apilar([
    { nombre: "Dip de barbacoa", detalle: "", obj: bowl, alto: 0 },
    { nombre: "Aros rebozados", detalle: "en birra", obj: torre, alto: 1.6 },
  ], 0.5);
  g.userData.inclinacion = 0.55;
  return g;
}

/* ---------------------------------------------------------------------------
   Postres
   --------------------------------------------------------------------------- */

function plato(color = "#FBF7FF") {
  return malla(torno([[0, 0], [1.2, 0], [1.33, 0.05], [1.44, 0.14], [1.42, 0.16], [1.22, 0.09], [0, 0.08]], 72, false), mat(color, { rug: 0.2, brillo: 0.7 }));
}

function crema(escala = 1) {
  const g = new T.Group();
  const m = mat("#FFFDF6", { rug: 0.6 });
  [[0.3, 0.12], [0.24, 0.1], [0.17, 0.085], [0.1, 0.065]].forEach(([r, t], i) => {
    const anillo = new T.TorusGeometry(r, t, 14, 40);
    anillo.rotateX(PI / 2);
    const a = malla(anillo, m);
    a.position.y = 0.1 + i * 0.13;
    g.add(a);
  });
  const punta = malla(new T.ConeGeometry(0.07, 0.18, 16), m);
  punta.position.y = 0.66;
  g.add(punta);
  g.scale.setScalar(escala);
  return g;
}

function flan(cfg, rnd) {
  const caramelo = mat("#8A3E12", { rug: 0.12, brillo: 1 });
  const charco = new T.RingGeometry(0.001, 1.0, 64, 2);
  charco.rotateX(-PI / 2);
  const p = charco.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
    const r2 = r * (1 + 0.08 * Math.sin(a * 4 + 1) + 0.04 * Math.sin(a * 9));
    p.setXYZ(i, Math.cos(a) * r2, 0.09, Math.sin(a) * r2);
  }
  charco.computeVertexNormals();
  const base = grupo(plato(), malla(charco, caramelo));

  const cuerpo = malla(organico(torno([[0, 0], [0.82, 0], [0.8, 0.1], [0.72, 0.55], [0.66, 0.66], [0.6, 0.7], [0, 0.72]], 64), 0.012, 6), mat("#F2BE4E", { rug: 0.22, brillo: 0.7 }));
  const tapa = malla(torno([[0, 0], [0.62, 0], [0.64, 0.015], [0.5, 0.045], [0, 0.05]], 64), caramelo);
  tapa.position.y = 0.7;
  const flanG = grupo(cuerpo, tapa);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI * 2 + rnd.entre(-0.2, 0.2);
    const largo = rnd.entre(0.1, 0.35);
    const gota = malla(new T.CapsuleGeometry(0.04, largo, 4, 8), caramelo);
    const y = 0.66 - largo / 2;
    const r = 0.66 + (0.66 - y) * 0.15;
    gota.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    gota.rotation.set(Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14);
    flanG.add(gota);
  }
  flanG.position.y = 0.09;

  const ddlG = organico(new T.SphereGeometry(0.32, 32, 16), 0.035, 6);
  ddlG.scale(1.25, 0.55, 0.95);
  const ddl = malla(ddlG, mat("#A8612A", { rug: 0.2, brillo: 0.8 }));
  ddl.position.set(0.88, 0.2, 0.62);
  const cremaG = crema(0.9);
  cremaG.position.set(-0.95, 0.06, 0.55);

  const g = apilar([
    { nombre: "Plato", detalle: "con caramelo", obj: base, alto: 0 },
    { nombre: "Flan casero", detalle: "de huevo", obj: flanG, alto: 0 },
    { nombre: "Dulce de leche", detalle: "", obj: ddl, alto: 0 },
    { nombre: "Crema", detalle: "batida", obj: cremaG, alto: 0 },
  ], 0.4);
  g.userData.inclinacion = 0.35;
  return g;
}

function helado(cfg, rnd) {
  const tex = textura(256, 256, (x, w, h) => {
    x.fillStyle = "#D99E55"; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#B27433"; x.lineWidth = 10;
    for (let i = -w; i < w * 2; i += 42) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke();
      x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke();
    }
  }, [3, 2]);
  const conoG = new T.ConeGeometry(0.48, 1.55, 40, 1, true);
  conoG.rotateX(PI);
  const cono = malla(conoG, mat("#ffffff", { rug: 0.7, map: tex, doble: true }));
  cono.position.y = 0.775;
  const borde = new T.TorusGeometry(0.48, 0.06, 10, 48);
  borde.rotateX(PI / 2);
  const bordeM = malla(borde, mat("#C88A45", { rug: 0.7 }));
  bordeM.position.y = 1.55;
  const cucurucho = grupo(cono, bordeM);

  const bocha = (color, r) => {
    const esfera = malla(organico(new T.SphereGeometry(r, 48, 28), 0.045, 4.5), mat(color, { rug: 0.55 }));
    const falda = organico(new T.TorusGeometry(r * 0.86, r * 0.2, 14, 56), 0.05, 8, 0);
    falda.rotateX(PI / 2);
    const f = malla(falda, mat(color, { rug: 0.55 }));
    f.position.y = -r * 0.5;
    const b = grupo(esfera, f);
    return b;
  };
  const b1 = bocha("#C98B4E", 0.52); b1.position.y = 0.4;
  const b2 = bocha("#FF94B5", 0.48); b2.position.set(0.1, 0.36, 0.02);
  const b3 = bocha("#A9D18E", 0.44); b3.position.set(-0.08, 0.32, -0.03);

  const cereza = malla(new T.SphereGeometry(0.13, 24, 16), mat("#D7263D", { rug: 0.15, brillo: 1 }));
  const cabo = malla(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0, 0.1, 0), new T.Vector3(0.03, 0.25, 0), new T.Vector3(0.12, 0.36, 0)]), 12, 0.014, 6), mat("#5A7A2A", { rug: 0.6 }));
  const cerezaG = grupo(cereza, cabo);
  cerezaG.position.y = 0.12;

  const g = apilar([
    { nombre: "Cucurucho", detalle: "crocante", obj: cucurucho, alto: 1.55 },
    { nombre: "Dulce de leche", detalle: "", obj: b1, alto: 0.72 },
    { nombre: "Frutilla a la crema", detalle: "", obj: b2, alto: 0.66 },
    { nombre: "Pistacho", detalle: "", obj: b3, alto: 0.6 },
    { nombre: "Cereza", detalle: "", obj: cerezaG, alto: 0.2 },
  ], 0.34);
  g.userData.inclinacion = 0.08;
  return g;
}

function cuna(radio, angulo, alto) {
  const s = new T.Shape();
  s.moveTo(0, 0);
  s.lineTo(radio, 0);
  s.absarc(0, 0, radio, 0, angulo, false);
  s.lineTo(0, 0);
  const g = new T.ExtrudeGeometry(s, { depth: alto, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 28 });
  g.rotateX(-PI / 2);
  return g;
}

function cheesecake(cfg, rnd) {
  const ANG = 0.95, R = 1.35;
  const armar = (alto, color, o) => malla(cuna(R, ANG, alto), mat(color, o));
  const porcion = new T.Group();
  const baseG = armar(0.16, "#B97B45", { rug: 0.9 });
  const cuerpo = armar(0.56, "#FFF1D6", { rug: 0.55 }); cuerpo.position.y = 0.18;
  porcion.add(baseG, cuerpo);
  const coulis = armar(0.06, "#C0142F", { rug: 0.12, brillo: 1 });
  const frutos = new T.Group();
  const arandano = mat("#3B3F8C", { rug: 0.3, brillo: 0.5 });
  const frambuesa = mat("#E03A5C", { rug: 0.4, brillo: 0.4 });
  const centro = (a, k) => new T.Vector3(Math.cos(a) * R * k, 0.08, -Math.sin(a) * R * k);
  [[0.3, 0.5], [0.55, 0.62], [0.72, 0.45]].forEach(([a, k]) => {
    const b = malla(new T.SphereGeometry(0.1, 20, 14), arandano);
    b.position.copy(centro(a, k)).add(new T.Vector3(0, 0.02, 0));
    frutos.add(b);
  });
  [0.4, 0.7].forEach(a => {
    const f = new T.Group();
    for (let i = 0; i < 16; i++) {
      const d = new T.Vector3(rnd.entre(-1, 1), rnd.entre(0, 1.4), rnd.entre(-1, 1)).normalize().multiplyScalar(0.075);
      const bolita = malla(new T.SphereGeometry(0.045, 10, 8), frambuesa);
      bolita.position.copy(d);
      f.add(bolita);
    }
    f.position.copy(centro(a, 0.82)).add(new T.Vector3(0, 0.05, 0));
    frutos.add(f);
  });
  const mentaH = malla(hoja(0.26, 0.1), mat("#3FBF55", { rug: 0.45, doble: true }));
  mentaH.position.copy(centro(0.48, 0.3)).add(new T.Vector3(0, 0.06, 0));
  frutos.add(mentaH);

  const platoG = plato();
  platoG.position.set(R * 0.56, -0.09, -R * 0.29);
  const g = apilar([
    { nombre: "Plato", detalle: "", obj: platoG, alto: 0 },
    { nombre: "Cheesecake", detalle: "base de galletitas", obj: porcion, alto: 0.74 },
    { nombre: "Coulis", detalle: "de frutos rojos", obj: coulis, alto: 0.06 },
    { nombre: "Frutos rojos", detalle: "arándanos y frambuesas", obj: frutos, alto: 0.1 },
  ], 0.34);
  g.userData.inclinacion = 0.45;
  return g;
}

/* ---------------------------------------------------------------------------
   Bebidas
   --------------------------------------------------------------------------- */

const vidrio = () => mat("#FFFFFF", { vidrio: true, op: 0.2, rug: 0.04, doble: true });

// Burbujas que suben y vuelven a empezar
function burbujas(rnd, cant, radio, desde, hasta, color) {
  const im = new T.InstancedMesh(new T.SphereGeometry(0.022, 8, 6), mat(color, { op: 0.75, rug: 0.1 }), cant);
  const datos = Array.from({ length: cant }, () => ({ x: rnd.entre(-radio, radio), z: rnd.entre(-radio, radio), f: rnd(), v: rnd.entre(0.18, 0.4) }));
  const m = new T.Matrix4();
  im.userData.animar = t => {
    datos.forEach((d, i) => {
      const y = desde + ((d.f + t * d.v) % 1) * (hasta - desde);
      m.makeTranslation(d.x + Math.sin(t * 3 + i) * 0.01, y, d.z);
      im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true;
  };
  im.userData.animar(0);
  return im;
}

function hielos(rnd, cant, y, radio, tam = 0.3) {
  const g = new T.Group();
  const m = mat("#EAFBFF", { op: 0.6, rug: 0.05, brillo: 1 });
  for (let i = 0; i < cant; i++) {
    const c = malla(new RoundedBoxGeometry(tam, tam, tam, 3, 0.06), m);
    const a = (i / cant) * PI * 2 + rnd.entre(-0.3, 0.3);
    c.position.set(Math.cos(a) * radio, y + rnd.entre(-0.12, 0.08), Math.sin(a) * radio);
    c.rotation.set(rnd() * 2, rnd() * 2, rnd() * 2);
    g.add(c);
  }
  return g;
}

function conAnimacion(g, ...animados) {
  g.userData.animar = t => animados.forEach(a => a.userData.animar(t));
  return g;
}

function limonada(cfg, rnd) {
  const vaso = malla(torno([[0, 0], [0.5, 0], [0.53, 0.05], [0.63, 1.62], [0.61, 1.62], [0.52, 0.1], [0, 0.1]], 64, false), vidrio());
  vaso.renderOrder = 2;
  const liquido = malla(torno([[0, 0.1], [0.51, 0.1], [0.595, 1.32], [0, 1.32]], 64, false), mat("#FFE45A", { op: 0.9, rug: 0.15, brillo: 0.4 }));
  const bur = burbujas(rnd, 26, 0.3, 0.2, 1.3, "#FFFBE0");
  const bebida = grupo(liquido, bur);

  const hielo = hielos(rnd, 4, 1.25, 0.24);
  const menta = new T.Group();
  const mm = mat("#3FBF55", { rug: 0.45, doble: true });
  for (let i = 0; i < 4; i++) {
    const h = malla(hoja(0.34, 0.14), mm);
    h.position.set(rnd.entre(-0.2, 0.2), 1.36, rnd.entre(-0.2, 0.2));
    h.rotation.set(rnd.entre(-0.4, 0.4), rnd() * 6, rnd.entre(-0.4, 0.4));
    menta.add(h);
  }
  const cara = textura(256, 256, (x, w, h) => {
    x.fillStyle = "#F7D02C"; x.beginPath(); x.arc(w / 2, h / 2, w / 2, 0, PI * 2); x.fill();
    x.fillStyle = "#FFF7D6"; x.beginPath(); x.arc(w / 2, h / 2, w * 0.44, 0, PI * 2); x.fill();
    x.fillStyle = "#FFE35C";
    for (let i = 0; i < 10; i++) {
      x.beginPath(); x.moveTo(w / 2, h / 2);
      x.arc(w / 2, h / 2, w * 0.41, (i / 10) * PI * 2 + 0.05, ((i + 1) / 10) * PI * 2 - 0.05);
      x.fill();
    }
  });
  const rodajaG = new T.CylinderGeometry(0.36, 0.36, 0.07, 48);
  const rodaja = new T.Mesh(rodajaG, [mat("#F2C318", { rug: 0.4 }), mat("#ffffff", { map: cara, rug: 0.35, brillo: 0.5 }), mat("#ffffff", { map: cara, rug: 0.35, brillo: 0.5 })]);
  rodaja.rotation.x = PI / 2;
  rodaja.position.set(0.5, 1.62, 0.12);
  rodaja.rotation.z = 0.2;

  const rayas = textura(64, 64, (x, w, h) => {
    x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, w, h);
    x.fillStyle = "#FF3E8A"; x.fillRect(0, 0, w, h / 2);
  }, [1, 14]);
  const curva = new T.CatmullRomCurve3([new T.Vector3(-0.12, 0.2, 0), new T.Vector3(-0.2, 1.3, 0), new T.Vector3(-0.3, 2.02, 0), new T.Vector3(-0.42, 2.18, 0), new T.Vector3(-0.62, 2.22, 0)]);
  const sorbete = malla(new T.TubeGeometry(curva, 48, 0.048, 12), mat("#ffffff", { map: rayas, rug: 0.35, brillo: 0.4 }));

  const g = apilar([
    { nombre: "Vaso", detalle: "500 ml", obj: vaso, alto: 0 },
    { nombre: "Limonada", detalle: "con jengibre", obj: bebida, alto: 0 },
    { nombre: "Hielo", detalle: "", obj: hielo, alto: 0 },
    { nombre: "Menta", detalle: "fresca", obj: menta, alto: 0 },
    { nombre: "Limón", detalle: "", obj: rodaja, alto: 0 },
    { nombre: "Sorbete", detalle: "de papel", obj: sorbete, alto: 0 },
  ], 0.3);
  g.userData.inclinacion = 0.1;
  return conAnimacion(g, bur);
}

function pinta(cfg, rnd) {
  const vaso = malla(torno([[0, 0], [0.52, 0], [0.55, 0.06], [0.64, 1.5], [0.69, 1.78], [0.67, 1.78], [0.62, 1.5], [0.53, 0.12], [0, 0.12]], 64, false), vidrio());
  vaso.renderOrder = 2;
  const cerveza = malla(torno([[0, 0.12], [0.525, 0.12], [0.62, 1.47], [0, 1.47]], 64, false), mat("#E88A06", { op: 0.96, rug: 0.12, brillo: 0.4 }));
  const bur = burbujas(rnd, 40, 0.34, 0.2, 1.45, "#FFE9A8");
  const espumaG = organico(torno([[0, 1.46], [0.63, 1.46], [0.68, 1.6], [0.62, 1.74], [0.4, 1.82], [0, 1.84]], 64), 0.02, 9, 1.5);
  const espuma = malla(espumaG, mat("#FFF7E3", { rug: 0.9 }));
  const g = apilar([
    { nombre: "Pinta", detalle: "473 ml", obj: vaso, alto: 0 },
    { nombre: "IPA", detalle: "tirada", obj: grupo(cerveza, bur), alto: 0 },
    { nombre: "Espuma", detalle: "", obj: espuma, alto: 0 },
  ], 0.42);
  g.userData.inclinacion = 0.1;
  return conAnimacion(g, bur);
}

function fernet(cfg, rnd) {
  const vaso = malla(torno([[0, 0], [0.45, 0], [0.47, 0.05], [0.5, 1.92], [0.48, 1.92], [0.45, 0.12], [0, 0.12]], 64, false), vidrio());
  vaso.renderOrder = 2;
  const bebida = malla(torno([[0, 0.12], [0.455, 0.12], [0.49, 1.42], [0, 1.42]], 64, false), mat("#2A1208", { op: 0.95, rug: 0.2, brillo: 0.5 }));
  const bur = burbujas(rnd, 22, 0.28, 0.25, 1.4, "#C9A27A");
  const espuma = malla(organico(torno([[0, 1.41], [0.49, 1.41], [0.5, 1.6], [0.44, 1.72], [0, 1.76]], 64), 0.02, 9, 1.5), mat("#D9B98E", { rug: 0.85 }));
  const hielo = hielos(rnd, 3, 1.2, 0.2, 0.27);
  const g = apilar([
    { nombre: "Vaso", detalle: "trago largo", obj: vaso, alto: 0 },
    { nombre: "Hielo", detalle: "", obj: hielo, alto: 0 },
    { nombre: "Fernet con coca", detalle: "30 y 70", obj: grupo(bebida, bur), alto: 0 },
    { nombre: "Espuma", detalle: "dos dedos", obj: espuma, alto: 0 },
  ], 0.4);
  g.userData.inclinacion = 0.1;
  return conAnimacion(g, bur);
}

/* ---------------------------------------------------------------------------
   Armado final
   --------------------------------------------------------------------------- */

const TIPOS = { hamburguesa, pizza, papas, aros, flan, helado, cheesecake, limonada, pinta, fernet };

// La elección del comensal ("Armala a tu gusto") cambia la receta de base.
function receta(plato, eleccion) {
  const m = { ...plato.modelo };
  if (!eleccion || m.tipo !== "hamburguesa") return m;
  if (eleccion.medallones) m.medallones = Number(eleccion.medallones);
  const sacar = new Set(eleccion.sacale || []);
  m.con = (m.con || []).filter(x => !sacar.has(x));
  m.extras = [...new Set([...(m.extras || []), ...(eleccion.sumale || [])])];
  return m;
}

function construir(plato, eleccion, local) {
  const cfg = receta(plato, eleccion);
  const hacer = TIPOS[cfg.tipo];
  if (!hacer) throw new Error(`No sé dibujar "${cfg.tipo}"`);
  const g = hacer(cfg, azar(plato.id), local);
  g.userData.inclinacion ??= 0.2;
  g.userData.explotar(0);
  return g;
}

// Clave para no dibujar dos veces lo mismo
function clave(plato, eleccion) {
  return plato.id + (eleccion ? JSON.stringify(receta(plato, eleccion)) : "");
}

// Libera la memoria de la placa de video de un modelo que ya no se usa
// (los materiales se comparten entre platos y quedan).
function liberar(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    [].concat(o.material || []).forEach(m => { if (m.map) { m.map.dispose(); m.dispose(); } });
  });
}

window.Platos3D = { construir, clave, liberar };
