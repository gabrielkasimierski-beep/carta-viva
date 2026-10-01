/* =============================================================================
   CARTA VIVA — la pizza con grosor: en 3D, armada con la foto de arriba (venía de mejoras/pizzas)
   La foto (vista desde arriba) se apoya sobre una pizza de verdad: masa con grosor, borde inflado,
   ocho porciones separadas por el corte. Gira con el dedo (con envión) y se inclina; con un toque
   se levanta la porción de adelante y el queso se estira hasta que se corta.

   crearPizza3D(contenedor, { foto, alfa, desfase, salsa, gestos }) → { tocar(), agarrar(), arrastrar(dx, dt), soltar(quieta), posar(si), destruir() }
     foto / alfa: la foto desde arriba y su transparencia (en gris)
     desfase: grados para que los cortes de la malla caigan sobre los de la foto ("auto": los busca)
     gestos: false si los toques los maneja otro (en la carta: escena-fotos.js, así el dedo
             para arriba y abajo sigue deslizando la carta); con agarrar/arrastrar/soltar/tocar.
   En la carta se carga dormida (como el 3D) y queda en window.Pizza3D.
   ============================================================================= */
import * as THREE from "three";

const cargar = src => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });
const suave = t => t * t * (3 - 2 * t);

// El perfil de la pizza (radio, altura; en radios), del centro al borde y por abajo de vuelta
//   y: arriba de la masa; rUV: de qué radio de la foto toma el color; sombra: más oscuro abajo
const PERFIL = [
  [0, 0.046, 0, 1], [0.25, 0.047, 0.25, 1], [0.5, 0.047, 0.5, 1], [0.7, 0.046, 0.7, 1], [0.8, 0.048, 0.8, 1],
  [0.845, 0.062, 0.845, 1], [0.875, 0.086, 0.875, 1], [0.905, 0.102, 0.905, 1], [0.935, 0.108, 0.935, 1],
  [0.962, 0.102, 0.962, 1], [0.982, 0.088, 0.982, 0.97], [0.995, 0.066, 0.993, 0.9], [1, 0.042, 0.996, 0.82],
  [0.996, 0.02, 0.996, 0.72], [0.984, 0.006, 0.99, 0.62], [0.965, 0, 0.97, 0.52], [0.6, 0, 0.6, 0.45], [0, 0, 0, 0.45],
];
const BORDE_ARRIBA = 12;           // hasta acá es la cara de arriba (lo demás: el costado y la base)

// El corte visto de costado: queso, salsa, masa aireada, base tostada (se dibuja una vez)
function texturaCorte(conSalsa) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  const masa = g.createLinearGradient(0, 0, 0, 128);
  masa.addColorStop(0, "#f1dcae"); masa.addColorStop(0.85, "#e8cb92"); masa.addColorStop(1, "#b9793d");
  g.fillStyle = masa; g.fillRect(0, 0, 256, 128);
  // alveolos de la masa
  for (let k = 0; k < 260; k++) {
    const x = Math.random() * 256, y = 20 + Math.random() * 100, r = 0.6 + Math.random() * (x > 215 ? 4.5 : 2.2);
    g.fillStyle = `rgba(150,105,55,${0.12 + Math.random() * 0.2})`; g.beginPath(); g.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2); g.fill();
  }
  // arriba, hasta el borde (u < 0.84): salsa y queso
  const fin = 256 * 0.84;
  if (conSalsa) { g.fillStyle = "#b9321c"; g.fillRect(0, 10, fin, 9); }
  g.fillStyle = "#f6e2a6"; g.fillRect(0, 0, fin, conSalsa ? 11 : 16);
  g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(0, 0, fin, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// El costado del borde: masa horneada con manchas tostadas (del color del borde de la foto)
function texturaCostado([r, g, b]) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96;
  const x = c.getContext("2d");
  const gr = x.createLinearGradient(0, 0, 0, 96);
  const tono = k => `rgb(${(r * k[0]) | 0},${(g * k[1]) | 0},${(b * k[2]) | 0})`;
  gr.addColorStop(0, tono([1, 1, 1])); gr.addColorStop(0.55, tono([0.93, 0.86, 0.78])); gr.addColorStop(1, tono([0.62, 0.5, 0.4]));
  x.fillStyle = gr; x.fillRect(0, 0, 512, 96);
  for (let k = 0; k < 900; k++) {                                         // textura de la masa
    x.fillStyle = Math.random() < 0.5 ? "rgba(255,235,200,.10)" : "rgba(90,50,20,.10)";
    x.fillRect(Math.random() * 512, Math.random() * 96, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }
  for (let k = 0; k < 55; k++) {                                          // manchas tostadas, más arriba
    const cx = Math.random() * 512, cy = Math.random() ** 1.6 * 70, rr = 1.5 + Math.random() * 5;
    const m = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    m.addColorStop(0, "rgba(35,18,8,.85)"); m.addColorStop(1, "rgba(35,18,8,0)");
    x.fillStyle = m; x.beginPath(); x.ellipse(cx, cy, rr * 1.3, rr, 0, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Una porción: la tapa (con la foto), el costado, la base y las dos caras del corte
function porcion(a0, a1, uv0, mats) {
  const SEG = 18, [cx, cy, ru] = uv0;
  const pos = [], uv = [], col = [], idx = [];
  const TAPA = PERFIL.slice(0, BORDE_ARRIBA + 1), n = TAPA.length;
  for (let j = 0; j <= SEG; j++) {
    const a = a0 + ((a1 - a0) * j) / SEG, ca = Math.cos(a), sa = Math.sin(a);
    for (const [r, y, rUV, s] of TAPA) {
      pos.push(r * ca, y, -r * sa);
      uv.push(cx + rUV * ru * ca, cy + rUV * ru * sa);
      col.push(s, s * 0.97, s * 0.93);
    }
  }
  for (let j = 0; j < SEG; j++) for (let i = 0; i < n - 1; i++) {
    const p = j * n + i, q = (j + 1) * n + i;
    idx.push(p, p + 1, q, q, p + 1, q + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const tapa = new THREE.Mesh(g, mats.foto);

  // El costado (con su textura de masa) y la base
  const banda = (puntos, mat, uvDe) => {
    const P = [], U = [], I = [], m = puntos.length;
    for (let j = 0; j <= SEG; j++) {
      const a = a0 + ((a1 - a0) * j) / SEG, ca = Math.cos(a), sa = Math.sin(a);
      puntos.forEach(([r, y], i) => { P.push(r * ca, y, -r * sa); U.push(...uvDe(a, i / (m - 1), r, ca, sa)); });
    }
    for (let j = 0; j < SEG; j++) for (let i = 0; i < m - 1; i++) { const p = j * m + i, q = (j + 1) * m + i; I.push(p, p + 1, q, q, p + 1, q + 1); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    gg.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    gg.setIndex(I); gg.computeVertexNormals();
    return new THREE.Mesh(gg, mat);
  };
  const costado = banda(PERFIL.slice(BORDE_ARRIBA, 16), mats.costado, (a, v) => [(a / (Math.PI * 2)) * 6, 1 - v]);
  const base = banda(PERFIL.slice(15), mats.base, (a, v, r, ca, sa) => [0.5 + r * ca * 0.5, 0.5 + r * sa * 0.5]);

  // Las caras del corte (de la punta al borde, de abajo hasta arriba)
  const cara = a => {
    const ca = Math.cos(a), sa = Math.sin(a), P = [], U = [], I = [];
    const arriba = PERFIL.slice(0, BORDE_ARRIBA + 1);
    arriba.forEach(([r, y]) => { P.push(r * ca, y, -r * sa, r * ca, 0, -r * sa); U.push(r, 1, r, 0); });
    for (let i = 0; i < arriba.length - 1; i++) { const k = i * 2; I.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    gg.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    gg.setIndex(I);
    gg.computeVertexNormals();
    return new THREE.Mesh(gg, mats.corte);
  };
  const grupo = new THREE.Group();
  grupo.add(tapa, costado, base, cara(a0), cara(a1));
  grupo.userData.medio = (a0 + a1) / 2;
  grupo.userData.a0 = a0; grupo.userData.a1 = a1;
  return grupo;
}

// Un hilo de queso entre dos puntos, colgando (más fino cuanto más largo)
function hilo(mat) {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  m.userData.actualizar = (a, b, grosor) => {
    const medio = a.clone().lerp(b, 0.5); medio.y -= a.distanceTo(b) * 0.28;
    const curva = new THREE.QuadraticBezierCurve3(a, medio, b);
    m.geometry.dispose();
    m.geometry = new THREE.TubeGeometry(curva, 14, grosor, 6, false);
  };
  return m;
}

export async function crearPizza3D(contenedor, o) {
  const [foto, alfa] = await Promise.all([cargar(o.foto), cargar(o.alfa)]);
  // Dónde está la pizza en la foto (centro y radio, en fracción de la foto)
  const W = foto.naturalWidth, H = foto.naturalHeight, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const gc = c.getContext("2d", { willReadFrequently: true });
  gc.drawImage(alfa, 0, 0, W, H);
  const da = gc.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (da[(y * W + x) * 4] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  // (un poco adentro del contorno: el borde de la foto trae restos del fondo)
  const uv0 = [(x0 + x1) / 2 / W, 1 - (y0 + y1) / 2 / H, ((x1 - x0) / 2 / W) * 0.975];
  // El relieve: lo claro (queso, burbujas, borde) un poco más alto
  gc.drawImage(foto, 0, 0, W, H);
  const dd = gc.getImageData(0, 0, W, H), px = dd.data;
  for (let i = 0; i < px.length; i += 4) { const l = px[i] * 0.3 + px[i + 1] * 0.55 + px[i + 2] * 0.15; px[i] = px[i + 1] = px[i + 2] = l; }
  gc.putImageData(dd, 0, 0);
  const relieve = new THREE.CanvasTexture(c);

  // El color del borde (para el costado): el promedio en el anillo de afuera
  let sr = 0, sg = 0, sb = 0, sn = 0;
  const c2 = document.createElement("canvas"); c2.width = W; c2.height = H;
  const g2 = c2.getContext("2d", { willReadFrequently: true }); g2.drawImage(foto, 0, 0, W, H);
  const df = g2.getImageData(0, 0, W, H).data, ccx = uv0[0] * W, ccy = (1 - uv0[1]) * H, rr0 = uv0[2] * W;
  for (let k = 0; k < 720; k++) {
    const a = (k / 720) * Math.PI * 2, rr = rr0 * (0.95 + (k % 3) * 0.012), x = (ccx + Math.cos(a) * rr) | 0, y = (ccy + Math.sin(a) * rr) | 0, i = (y * W + x) * 4;
    if (df[i + 3] > 0) { sr += df[i]; sg += df[i + 1]; sb += df[i + 2]; sn++; }
  }
  const colorBorde = sn ? [sr / sn, sg / sn, sb / sn] : [200, 140, 80];
  // Dónde están los cortes de la foto: el ángulo (cada 45°) donde la foto es más oscura a lo largo del radio
  let desfaseAuto = 0, mejor = Infinity;
  const lum = (x, y) => { const i = ((y | 0) * W + (x | 0)) * 4; return df[i] * 0.3 + df[i + 1] * 0.55 + df[i + 2] * 0.15; };
  for (let d = 0; d < 45; d += 0.25) {
    let suma = 0;
    for (let k = 0; k < 8; k++) {
      const a = ((d + k * 45) * Math.PI) / 180;
      for (let f = 0.22; f < 0.8; f += 0.03) suma += lum(ccx + Math.cos(a) * rr0 * f, ccy - Math.sin(a) * rr0 * f);
    }
    if (suma < mejor) { mejor = suma; desfaseAuto = d; }
  }
  // La foto sin su fondo: lo que queda afuera de la pizza (fondo negro, pelusa roja) pasa a ser
  // del color del borde, así no aparece en el canto de la masa
  const limpia = document.createElement("canvas"); limpia.width = W; limpia.height = H;
  const gl = limpia.getContext("2d");
  const recortada = new ImageData(W, H), rp = recortada.data;
  for (let i = 0; i < rp.length; i += 4) {
    rp[i] = df[i]; rp[i + 1] = df[i + 1]; rp[i + 2] = df[i + 2];
    rp[i + 3] = Math.max(0, Math.min(255, (da[i] - 90) * 2.2));     // más duro que el alfa: sin halo
  }
  const capaFoto = document.createElement("canvas"); capaFoto.width = W; capaFoto.height = H;
  capaFoto.getContext("2d").putImageData(recortada, 0, 0);
  gl.fillStyle = `rgb(${colorBorde.map(v => v | 0).join(",")})`;
  gl.fillRect(0, 0, W, H);
  gl.drawImage(capaFoto, 0, 0);
  const tFoto = new THREE.CanvasTexture(limpia);
  tFoto.colorSpace = THREE.SRGBColorSpace; tFoto.anisotropy = 8;
  const mats = {
    foto: new THREE.MeshStandardMaterial({ map: tFoto, bumpMap: relieve, bumpScale: 1.6, roughness: 0.62, metalness: 0, vertexColors: true }),
    corte: new THREE.MeshStandardMaterial({ map: texturaCorte(o.salsa !== false), roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
    costado: new THREE.MeshStandardMaterial({ map: texturaCostado(colorBorde), roughness: 0.8, metalness: 0 }),
    base: new THREE.MeshStandardMaterial({ color: new THREE.Color(colorBorde[0] / 400, colorBorde[1] / 470, colorBorde[2] / 560), roughness: 0.9, metalness: 0 }),
    queso: new THREE.MeshStandardMaterial({ color: 0xf7e2a2, roughness: 0.35, metalness: 0, emissive: 0x3a2a08 }),
  };

  // La escena
  const render = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  render.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  render.outputColorSpace = THREE.SRGBColorSpace;
  render.toneMapping = THREE.NoToneMapping;
  contenedor.appendChild(render.domElement);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  escena.add(new THREE.HemisphereLight(0xfff4e6, 0x3a2418, 1.75));
  const sol = new THREE.DirectionalLight(0xfff0dc, 1.5); sol.position.set(-1.2, 2.4, 1.6); escena.add(sol);
  const contra = new THREE.DirectionalLight(0xffd6a8, 0.55); contra.position.set(1.4, 0.8, -1.8); escena.add(contra);

  // Sombra suave abajo
  const sc = document.createElement("canvas"); sc.width = sc.height = 128;
  const gs = sc.getContext("2d"), rg = gs.createRadialGradient(64, 64, 10, 64, 64, 64);
  rg.addColorStop(0, "rgba(0,0,0,.55)"); rg.addColorStop(0.7, "rgba(0,0,0,.25)"); rg.addColorStop(1, "rgba(0,0,0,0)");
  gs.fillStyle = rg; gs.fillRect(0, 0, 128, 128);
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = -0.004;

  const pizza = new THREE.Group();
  const desf = ((o.desfase == null || o.desfase === "auto" ? desfaseAuto : o.desfase) * Math.PI) / 180, hueco = 0.0028;
  const porciones = [];
  for (let k = 0; k < 8; k++) {
    const a0 = desf + (k * Math.PI) / 4 + hueco, a1 = desf + ((k + 1) * Math.PI) / 4 - hueco;
    const p = porcion(a0, a1, uv0, mats);
    porciones.push(p); pizza.add(p);
  }
  const giro = new THREE.Group();
  giro.add(pizza);
  escena.add(sombra, giro);
  const hilos = Array.from({ length: 6 }, () => hilo(mats.queso));
  hilos.forEach(h => { h.visible = false; escena.add(h); });

  // Estado: giro (con envión), inclinación, y la porción que se levanta
  let ang = 0.35, vel = 0.35, incl = 0.62, inclMeta = 0.62, dedo = null, xAnt = 0, yAnt = 0, tAnt = 0, mueve = 0, quieto = 0;
  let sube = null, t0 = 0, vivo = true, ultimo = performance.now(), quieta = false;

  function medir() {
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    render.setSize(w, h, false);
    render.domElement.style.width = "100%"; render.domElement.style.height = "100%";
    camara.aspect = w / h;
    // que entre la pizza entera (radio 1) con un poco de aire
    // de ancho, que ocupe casi todo; de alto, que quede aire para la porción que sube
    const porAncho = 2 * Math.atan(Math.tan((13.2 * Math.PI) / 180) / camara.aspect) * 180 / Math.PI;
    camara.fov = Math.max(porAncho, 25);
    camara.updateProjectionMatrix();
  }
  medir();
  const alCambiar = new ResizeObserver(medir); alCambiar.observe(contenedor);

  // La porción de adelante (la que mira a la cámara)
  function deAdelante() {
    let mejor = null, d = Infinity;
    for (const p of porciones) {
      const a = p.userData.medio + ang, dx = Math.cos(a), dz = -Math.sin(a);   // hacia dónde apunta, ya girada
      const dist = Math.hypot(dx - 0, dz - 1);
      if (dist < d) { d = dist; mejor = p; }
    }
    return mejor;
  }
  function tocar() {
    if (sube) return;
    sube = { p: deAdelante() }; t0 = performance.now(); vel *= 0.2;
  }

  // Con el dedo: horizontal gira, vertical inclina; un toque levanta una porción
  const el = render.domElement;
  if (o.gestos !== false) {
  el.style.touchAction = "none";
  el.addEventListener("pointerdown", e => { dedo = e.pointerId; xAnt = e.clientX; yAnt = e.clientY; tAnt = performance.now(); mueve = 0; el.setPointerCapture(dedo); });
  el.addEventListener("pointermove", e => {
    if (e.pointerId !== dedo) return;
    const dx = e.clientX - xAnt, dy = e.clientY - yAnt, ahora = performance.now(), dt = Math.max(8, ahora - tAnt) / 1000;
    xAnt = e.clientX; yAnt = e.clientY; tAnt = ahora; mueve += Math.abs(dx) + Math.abs(dy);
    ang += dx * 0.011; vel = vel * 0.5 + ((dx * 0.011) / dt) * 0.5;
    inclMeta = Math.max(0.28, Math.min(1.25, inclMeta + dy * 0.006));
    quieto = 0;
  });
  const soltar = e => { if (e.pointerId !== dedo) return; dedo = null; if (mueve < 6) tocar(); else if (performance.now() - tAnt > 120) vel = 0; };
  el.addEventListener("pointerup", soltar); el.addEventListener("pointercancel", soltar);
  }

  const A = new THREE.Vector3(), B = new THREE.Vector3();
  function cuadro(ahora) {
    if (!vivo) return;
    requestAnimationFrame(cuadro);
    const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora;
    if (dedo === null) {
      vel += ((quieta ? 0 : 0.32) - vel) * (1 - Math.exp(-dt * (quieta ? 3 : 0.6)));     // si nadie la toca, sigue girando despacito
      ang += vel * dt;
      quieto += dt;
      if (quieto > 3 || quieta) inclMeta += ((quieta ? 0.8 : 0.62) - inclMeta) * (1 - Math.exp(-dt * 1.5));
    }
    incl += (inclMeta - incl) * (1 - Math.exp(-dt * 10));
    giro.rotation.y = ang;
    // La cámara: más arriba o más de costado según la inclinación
    const d = 4.6;
    camara.position.set(0, Math.sin(incl) * d, Math.cos(incl) * d);
    camara.lookAt(0, 0.02, 0);
    sombra.rotation.z = 0;

    // La porción que sube, y el queso que se estira
    hilos.forEach(h => { h.visible = false; });
    if (sube) {
      const t = (ahora - t0) / 1000, DUR = 3.2;
      // sube (0–1 s), se queda (1–1,9 s), baja (1,9–3,2 s)
      const k = t < 1 ? suave(t) : t < 1.9 ? 1 : 1 - suave(Math.min(1, (t - 1.9) / 1.3));
      const m = sube.p.userData.medio, dir = new THREE.Vector3(Math.cos(m), 0, -Math.sin(m));
      sube.p.position.set(dir.x * 0.42 * k, 0.6 * k, dir.z * 0.42 * k);
      sube.p.rotation.set(0, 0, 0);
      sube.p.rotateOnAxis(new THREE.Vector3(-dir.z, 0, dir.x), -0.42 * k);
      // Hilos de queso: de los bordes de la porción a los de las vecinas (los más largos se cortan)
      giro.updateMatrixWorld(true);
      const p = sube.p, { a0, a1 } = p.userData;
      for (let i = 0; i < hilos.length; i++) {
        const borde = i % 2 ? a1 : a0, afuera = i % 2 ? 0.035 : -0.035, f = (Math.floor(i / 2) + 0.5) / 3, rr = 0.18 + f * 0.58;
        A.set(Math.cos(borde + afuera) * rr, 0.05, -Math.sin(borde + afuera) * rr).applyMatrix4(giro.matrixWorld);
        B.set(Math.cos(borde) * rr, 0.045, -Math.sin(borde) * rr).applyMatrix4(p.matrixWorld);
        const largo = A.distanceTo(B);
        if (largo < 0.02 || largo > 0.72 - f * 0.22) continue;
        hilos[i].userData.actualizar(A.clone(), B.clone(), Math.max(0.005, 0.022 - largo * 0.028));
        hilos[i].visible = true;
      }
      if (t >= DUR) { sube.p.position.set(0, 0, 0); sube.p.rotation.set(0, 0, 0); sube = null; }
    }
    render.render(escena, camara);
  }
  requestAnimationFrame(cuadro);

  return {
    tocar,
    // Para cuando los toques los maneja la carta
    agarrar() { dedo = "carta"; mueve = 0; },
    arrastrar(dx, dt) { ang += dx * 0.011; vel = vel * 0.5 + ((dx * 0.011) / Math.max(0.008, dt)) * 0.5; quieto = 0; },
    soltar(sinEnvion) { dedo = null; if (sinEnvion) vel = 0; },
    // Quieta (en "¿Qué tiene?"): deja de girar sola y se ve más desde arriba
    posar(si) { quieta = !!si; quieto = 0; },
    destruir() {
      vivo = false; alCambiar.disconnect();
      Object.values(mats).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      relieve.dispose(); render.dispose(); render.forceContextLoss(); el.remove();
    },
  };
}

window.Pizza3D = { crearPizza3D };
