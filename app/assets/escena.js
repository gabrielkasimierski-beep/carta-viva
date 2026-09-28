/* =============================================================================
   CARTA VIVA — el escenario 3D
   Un solo lienzo WebGL, fijo detrás de la carta. Cada plato de la carta tiene un
   "escenario" (un div vacío en su pantalla): el plato 3D se dibuja justo ahí, lo sigue
   cuando la carta se desliza y se achica o se agranda si ese lugar cambia.

   Escena.iniciar({ lienzo, etiquetas })   → false si el celular no tiene 3D
   Escena.vincular(div, plato)             el plato vive en ese div
   Escena.cambiar(div, eleccion)           lo arma a gusto del comensal (con un saltito)
   Escena.explotar(div, si)                separa las capas y las nombra
   Escena.tono(luz, sombra)                la luz de atrás y la sombra toman el color del plato
   Escena.estilo(nombre)                   brasa · jugo · estudio: cómo se ilumina todo
   Escena.foto(plato, eleccion)            → Promise<dataURL> para listas y el pedido
   Escena.donde(div)                       → { x, y, r } en pantalla (para animar)
   ============================================================================= */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const T = THREE;
const FOV = 30, DIST = 14, GRADO = Math.PI / 180;
const MOVIMIENTO = !matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer, scene, camera, lienzo, capaEtiquetas, luzPrincipal, luzBorde, luzCielo;
let brasas = [];
let ancho = 1, alto = 1;
let reloj = performance.now();
let pausa = false;
const puestos = new Map();
const tono = new T.Color("#ffffff"), tonoObj = new T.Color("#ffffff");
const colorSombra = new T.Color("#000000"), colorSombraObj = new T.Color("#000000");

// Cómo se ilumina cada estilo
const AJUSTES = {
  brasa:   { entorno: 0.42, principal: 1.9, borde: 4.6, cielo: 0.25, exposicion: 1.0,  sombra: 0.5,  aditiva: true,  brasas: true },
  jugo:    { entorno: 0.9,  principal: 2.3, borde: 2.2, cielo: 0.55, exposicion: 1.05, sombra: 0.75, aditiva: false, brasas: false },
  estudio: { entorno: 1.0,  principal: 2.8, borde: 1.2, cielo: 0.6,  exposicion: 1.08, sombra: 0.95, aditiva: false, brasas: false },
};
let ajuste = AJUSTES.brasa;
const v = new T.Vector3();

function luces(escena, render) {
  const pmrem = new T.PMREMGenerator(render);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.85;
  const principal = new T.DirectionalLight("#FFF3E2", 2.4);
  principal.position.set(-4, 7, 6);
  const borde = new T.DirectionalLight("#ffffff", 2.2);
  borde.position.set(5, 3, -6);
  const cielo = new T.HemisphereLight("#ffffff", "#ffffff", 0.5);
  escena.add(principal, borde, cielo);
  return { principal, borde, cielo };
}

function ajustar(render) {
  render.setClearColor(0x000000, 0);
  render.outputColorSpace = T.SRGBColorSpace;
  render.toneMapping = T.NeutralToneMapping;
  render.toneMappingExposure = 1.05;
}

function iniciar(o) {
  lienzo = o.lienzo;
  capaEtiquetas = o.etiquetas;
  try {
    renderer = new T.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return false;
  }
  ajustar(renderer);
  scene = new T.Scene();
  ({ principal: luzPrincipal, borde: luzBorde, cielo: luzCielo } = luces(scene, renderer));
  camera = new T.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, DIST);
  brasas = [crearBrasas(150, 0.085, 0.9), crearBrasas(16, 0.55, 0.13)];
  estilo(Object.keys(AJUSTES).find(k => AJUSTES[k] === ajuste));
  medir();
  addEventListener("resize", medir);
  requestAnimationFrame(cuadro);
  return true;
}

function medir() {
  ancho = lienzo.clientWidth || innerWidth;
  alto = lienzo.clientHeight || innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(ancho, alto, false);
  camera.aspect = ancho / alto;
  camera.updateProjectionMatrix();
}

// Un punto de luz redondo y difuso (para sombras y brasas). Es blanco: el color lo pone el material.
function degradeRedondo(tam, paradas) {
  const c = document.createElement("canvas");
  c.width = c.height = tam;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  paradas.forEach(([p, a]) => g.addColorStop(p, `rgba(255,255,255,${a})`));
  x.fillStyle = g;
  x.fillRect(0, 0, tam, tam);
  return new T.CanvasTexture(c);
}

// Sombra de contacto debajo del plato. En "brasa" es al revés: un charco de luz.
let texSombra;
function crearSombra() {
  texSombra ||= degradeRedondo(128, [[0, 0.55], [0.5, 0.22], [1, 0]]);
  const geo = new T.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  return new T.Mesh(geo, new T.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false, opacity: 0.6, color: 0x000000 }));
}
function aplicarSombra(p) {
  p.sombra.material.blending = ajuste.aditiva ? T.AdditiveBlending : T.NormalBlending;
  p.sombra.material.needsUpdate = true;
}

// Brasas: chispitas que suben despacio por delante y por detrás de los platos
function crearBrasas(cant, tam, opacidad) {
  const pos = new Float32Array(cant * 3);
  const datos = Array.from({ length: cant }, () => ({
    x: (Math.random() - 0.5) * 16, y: (Math.random() - 0.5) * 11, z: (Math.random() - 0.5) * 7 - 1,
    v: 0.12 + Math.random() * 0.34, f: Math.random() * 6.28, amp: 0.08 + Math.random() * 0.25,
  }));
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  const mat = new T.PointsMaterial({
    size: tam, map: degradeRedondo(64, [[0, 1], [0.25, 0.65], [1, 0]]),
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: opacidad,
  });
  const puntos = new T.Points(geo, mat);
  puntos.frustumCulled = false;
  puntos.userData = { datos, pos, geo };
  scene.add(puntos);
  return puntos;
}
function moverBrasas(t, dt) {
  brasas.forEach(b => {
    if (!b.visible) return;
    const { datos, pos, geo } = b.userData;
    datos.forEach((d, i) => {
      d.y += d.v * dt;
      if (d.y > 5.8) { d.y = -5.8; d.x = (Math.random() - 0.5) * 16; }
      pos[i * 3] = d.x + Math.sin(t * 0.7 + d.f) * d.amp;
      pos[i * 3 + 1] = d.y;
      pos[i * 3 + 2] = d.z;
    });
    geo.attributes.position.needsUpdate = true;
    b.material.color.copy(tono);
  });
}

function estilo(nombre) {
  ajuste = AJUSTES[nombre] || AJUSTES.brasa;
  if (!renderer) return;
  scene.environmentIntensity = ajuste.entorno;
  luzPrincipal.intensity = ajuste.principal;
  luzBorde.intensity = ajuste.borde;
  luzCielo.intensity = ajuste.cielo;
  renderer.toneMappingExposure = ajuste.exposicion;
  brasas.forEach(b => { b.visible = ajuste.brasas && MOVIMIENTO; });
  for (const p of puestos.values()) aplicarSombra(p);
}

// Tamaño del plato armado y de sus capas, quieto y "explotado"
function medirModelo(m) {
  const cajaDe = o => new T.Box3().setFromObject(o);
  m.userData.explotar(1);
  const b1 = cajaDe(m);
  m.userData.explotar(0);
  const b0 = cajaDe(m);
  m.userData.capas.forEach(c => {
    const b = cajaDe(c.obj);
    c.cy = (b.isEmpty() ? c.obj.position.y : b.min.y * 0.35 + b.max.y * 0.65) - c.obj.position.y;   // un poco arriba del medio: lo que cuelga (cheddar, lechuga) no confunde
  });
  const s = b0.getSize(new T.Vector3());
  return {
    centro: b0.getCenter(new T.Vector3()),
    min: b0.min.y, minExp: b1.min.y,
    ancho: Math.max(s.x, s.z), alto: s.y, altoExp: b1.max.y - b1.min.y,
  };
}

function vincular(el, plato) {
  const p = {
    el, plato, eleccion: null, sucio: true,
    pivote: new T.Group(), inclinado: new T.Group(), flotador: new T.Group(), giro: new T.Group(),
    sombra: crearSombra(), modelo: null, med: null,
    giroY: -0.7, vel: 0, arrastrando: false,
    exp: 0, expObj: 0, salto: 0, pop: 0,
    pos: new T.Vector3(), esc: 0, listo: false, fase: Math.random() * 6, etqs: null,
  };
  p.pivote.add(p.inclinado);
  p.inclinado.add(p.sombra, p.flotador);
  p.flotador.add(p.giro);
  p.pivote.visible = false;
  scene.add(p.pivote);
  aplicarSombra(p);
  gestos(p);
  puestos.set(el, p);
}

function armarModelo(p) {
  const nuevo = window.Platos3D.construir(p.plato, p.eleccion, window.LOCAL.nombre);
  if (p.modelo) {
    p.giro.remove(p.modelo);
    window.Platos3D.liberar(p.modelo);
    p.pop = 1;
  }
  quitarEtiquetas(p);
  p.modelo = nuevo;
  p.med = medirModelo(nuevo);
  p.inclinado.rotation.x = nuevo.userData.inclinacion;
  p.giro.add(nuevo);
  p.sucio = false;
}

// Girar con el dedo (lo vertical queda para deslizar la carta) y tocar para un saltito
function gestos(p) {
  const el = p.el;
  let x0 = 0, t0 = 0, recorrido = 0, dedo = null;
  el.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    dedo = e.pointerId; x0 = e.clientX; t0 = performance.now(); recorrido = 0;
    p.arrastrando = true;
    if (e.pointerType === "mouse") el.setPointerCapture(dedo);
  });
  el.addEventListener("pointermove", e => {
    if (e.pointerId !== dedo || !p.arrastrando) return;
    const dx = e.clientX - x0, ahora = performance.now();
    const dt = Math.max(8, ahora - t0) / 1000;
    x0 = e.clientX; t0 = ahora;
    recorrido += Math.abs(dx);
    const d = dx * 0.011;
    p.giroY += d;
    p.vel = Math.max(-14, Math.min(14, d / dt));
    if (recorrido > 12) el.dispatchEvent(new CustomEvent("escena:giro", { bubbles: true }));
  });
  const fin = e => {
    if (e.pointerId !== dedo) return;
    p.arrastrando = false;
    dedo = null;
    if (performance.now() - t0 > 120) p.vel *= 0.3;     // si soltó quieto, no sale disparado
    if (e.type === "pointerup" && recorrido < 6) {
      p.salto = 1;
      p.vel += 9;
      el.dispatchEvent(new CustomEvent("escena:toque", { bubbles: true }));
    }
  };
  el.addEventListener("pointerup", fin);
  el.addEventListener("pointercancel", fin);
}

function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, (ahora - reloj) / 1000);
  reloj = ahora;
  if (document.hidden || pausa) return;
  const t = ahora / 1000;

  tono.lerp(tonoObj, 1 - Math.exp(-dt * 4));
  colorSombra.lerp(colorSombraObj, 1 - Math.exp(-dt * 4));
  luzBorde.color.copy(tono);
  luzCielo.groundColor.copy(tono);
  if (MOVIMIENTO) moverBrasas(t, dt);

  const wpp = (2 * DIST * Math.tan((FOV / 2) * GRADO)) / alto;     // unidades 3D por pixel
  const kPos = 1 - Math.exp(-dt * 22);
  let armados = 0;

  for (const p of puestos.values()) {
    const r = p.el.getBoundingClientRect();
    const cerca = r.width > 0 && r.bottom > -alto * 0.3 && r.top < alto * 1.3;
    if (!cerca) {
      p.pivote.visible = false;
      quitarEtiquetas(p);
      continue;
    }
    if (p.sucio) {
      if (armados++ > 0 && p.modelo) continue;    // de a uno por cuadro, para no trabar
      armarModelo(p);
    }
    const m = p.modelo, med = p.med;
    p.pivote.visible = true;

    // Explosión
    p.exp += (p.expObj - p.exp) * (1 - Math.exp(-dt * 5));
    if (Math.abs(p.exp - p.expObj) < 0.001) p.exp = p.expObj;
    m.userData.explotar(p.exp);
    const h = med.alto + (med.altoExp - med.alto) * p.exp;
    const minY = med.min + (med.minExp - med.min) * p.exp;
    m.position.set(-med.centro.x, -minY - h / 2, -med.centro.z);
    p.sombra.position.y = -h / 2 - 0.02;
    p.sombra.scale.setScalar(med.ancho * 1.35);

    // Dónde y de qué tamaño
    const inc = m.userData.inclinacion;
    const altoVisto = h * Math.cos(inc) + med.ancho * Math.sin(inc);
    // En pantallas angostas, al explotar, el plato se corre a la izquierda y los
    // carteles van todos a la derecha
    const angosto = ancho < 640;
    p.cx = r.left + r.width / 2 - (angosto ? r.width * 0.22 * p.exp : 0);
    const lugarAncho = r.width * wpp * (angosto ? 1.3 - 0.82 * p.exp : 1.08 - 0.6 * p.exp);
    const lugarAlto = r.height * wpp * (angosto ? 1.06 : 1.04);
    const esc = Math.min(lugarAncho / med.ancho, lugarAlto / altoVisto);
    v.set((p.cx - ancho / 2) * wpp, -(r.top + r.height / 2 - alto / 2) * wpp, 0);
    if (!p.listo) { p.pos.copy(v); p.esc = MOVIMIENTO ? 0 : esc; p.listo = true; }
    p.pos.lerp(v, kPos);
    p.esc += (esc - p.esc) * (1 - Math.exp(-dt * 9));
    p.pop = Math.max(0, p.pop - dt * 2.4);
    const rebote = 1 + 0.1 * Math.sin((1 - p.pop) * Math.PI) * (p.pop > 0 ? 1 : 0);
    p.pivote.position.copy(p.pos);
    p.pivote.scale.setScalar(p.esc * rebote);

    // Giro: sigue al dedo y, suelto, vuelve de a poco a girar solo
    if (!p.arrastrando) {
      const solo = MOVIMIENTO ? (p.exp > 0.5 ? 0.22 : 0.42) : 0;
      p.vel += (solo - p.vel) * (1 - Math.exp(-dt * 1.6));
      p.giroY += p.vel * dt;
    }
    p.giro.rotation.y = p.giroY;

    // Flota, y con un toque salta
    p.salto = Math.max(0, p.salto - dt * 1.8);
    const salto = Math.sin((1 - p.salto) * Math.PI) * (p.salto > 0 ? 1 : 0);
    const flota = MOVIMIENTO ? Math.sin(t * 1.5 + p.fase) * 0.05 * med.alto : 0;
    p.flotador.position.y = flota + salto * med.alto * 0.35;
    p.sombra.material.opacity = (0.6 - salto * 0.35 - flota * 0.8) * ajuste.sombra;
    p.sombra.material.color.copy(colorSombra);

    if (m.userData.animar && MOVIMIENTO) m.userData.animar(t);
    if (p.exp > 0.02) ponerEtiquetas(p, r, wpp); else quitarEtiquetas(p);
  }
  renderer.render(scene, camera);
}

// Carteles con el nombre de cada capa, a los costados del plato
function ponerEtiquetas(p, r, wpp) {
  const capas = p.modelo.userData.capas;
  if (!p.etqs) {
    const angosto = ancho < 640;
    p.etqs = capas.map((c, i) => {
      const d = document.createElement("div");
      d.className = "etiqueta " + (i % 2 && !angosto ? "etiqueta--izq" : "etiqueta--der");
      d.innerHTML = `<span class="etiqueta__linea"></span><span class="etiqueta__texto"><b></b><small></small></span>`;
      d.querySelector("b").textContent = c.nombre;
      d.querySelector("small").textContent = c.detalle || "";
      capaEtiquetas.appendChild(d);
      return d;
    });
  }
  const cx = p.cx;
  const radio = (p.med.ancho * p.esc) / wpp / 2;
  p.modelo.updateWorldMatrix(true, false);
  const lista = capas.map((c, i) => {
    v.set(0, c.obj.position.y + c.cy, 0);
    p.modelo.localToWorld(v);
    v.project(camera);
    const d = p.etqs[i];
    return { d, y: (-v.y * 0.5 + 0.5) * alto, izq: d.classList.contains("etiqueta--izq"), h: d.offsetHeight || 30 };
  });
  // que no se pisen: de abajo hacia arriba, cada cartel deja lugar al de abajo
  for (const lado of [true, false]) {
    const col = lista.filter(x => x.izq === lado).sort((a, b) => b.y - a.y);
    for (let k = 1; k < col.length; k++) {
      const minimo = (col[k - 1].h + col[k].h) / 2 + 4;
      if (col[k - 1].y - col[k].y < minimo) col[k].y = col[k - 1].y - minimo;
    }
  }
  const op = Math.min(1, (p.exp - 0.3) / 0.5).toFixed(2);
  lista.forEach(({ d, y, izq }) => {
    const x = izq ? Math.max(8, cx - radio - 6) : Math.min(ancho - 60, cx + radio + 6);
    d.style.maxWidth = (izq ? x - 8 : ancho - x - 8) + "px";
    d.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    d.style.opacity = op;
  });
}

function quitarEtiquetas(p) {
  if (!p.etqs) return;
  p.etqs.forEach(d => d.remove());
  p.etqs = null;
}

/* ---------------------------------------------------------------------------
   Fotos de los platos (para la carta completa, el pedido y la cocina)
   --------------------------------------------------------------------------- */
let fotoR, fotoEscena, fotoCam;
const fotos = new Map();
let cola = Promise.resolve();

function sacarFoto(plato, eleccion) {
  if (!fotoR) {
    fotoR = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    ajustar(fotoR);
    fotoR.setPixelRatio(1);
    fotoR.setSize(360, 360, false);
    fotoEscena = new T.Scene();
    luces(fotoEscena, fotoR);
    fotoCam = new T.PerspectiveCamera(FOV, 1, 0.1, 200);
  }
  const m = window.Platos3D.construir(plato, eleccion, window.LOCAL.nombre);
  const med = medirModelo(m);
  const inc = m.userData.inclinacion;
  m.position.set(-med.centro.x, -med.min - med.alto / 2, -med.centro.z);
  const giro = new T.Group();
  giro.rotation.y = -0.7;
  giro.add(m);
  const inclinado = new T.Group();
  inclinado.rotation.x = inc;
  inclinado.add(giro);
  fotoEscena.add(inclinado);
  const tam = Math.max(med.ancho, med.alto * Math.cos(inc) + med.ancho * Math.sin(inc));
  fotoCam.position.set(0, 0, (tam / 2 / Math.tan((FOV / 2) * GRADO)) * 1.15);
  fotoCam.lookAt(0, 0, 0);
  fotoR.render(fotoEscena, fotoCam);
  const url = fotoR.domElement.toDataURL("image/png");
  fotoEscena.remove(inclinado);
  window.Platos3D.liberar(m);
  return url;
}

function foto(plato, eleccion) {
  const k = window.Platos3D.clave(plato, eleccion);
  if (fotos.has(k)) return Promise.resolve(fotos.get(k));
  cola = cola
    .then(() => new Promise(r => setTimeout(r, 30)))
    .then(() => {
      if (!fotos.has(k)) {
        try { fotos.set(k, sacarFoto(plato, eleccion)); } catch { fotos.set(k, ""); }
      }
      return fotos.get(k);
    });
  return cola;
}

/* ---------------------------------------------------------------------------
   Lo que usa la carta
   --------------------------------------------------------------------------- */
window.Escena = {
  iniciar,
  vincular,
  cambiar(el, eleccion) {
    const p = puestos.get(el);
    if (!p) return;
    p.eleccion = eleccion;
    p.sucio = true;
  },
  explotar(el, si) {
    const p = puestos.get(el);
    if (p) p.expObj = si ? 1 : 0;
  },
  pausar(si) { pausa = !!si; },
  estilo,
  tono(luz, sombra) { tonoObj.set(luz); colorSombraObj.set(sombra || "#000000"); },
  foto,
  fotoLista: (plato, eleccion) => fotos.get(window.Platos3D.clave(plato, eleccion)) || null,
  donde(el) {
    const p = puestos.get(el);
    const r = el.getBoundingClientRect();
    const radio = p && p.med ? (p.med.ancho * p.esc) / ((2 * DIST * Math.tan((FOV / 2) * GRADO)) / alto) / 2 : r.width / 4;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: radio };
  },
};
