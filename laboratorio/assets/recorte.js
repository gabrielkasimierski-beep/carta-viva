/* =============================================================================
   CARTA VIVA · laboratorio — sacar el plato de la foto
   Con el contorno marcado a mano (unos puntos alrededor del plato) deja transparente
   lo de alrededor, para que el plato flote sobre el color de la carta como el 3D.
   Alcanza con marcar "más o menos": cerca del contorno mira de qué color es el plato
   y de qué color es el fondo, y después afina el borde con un filtro que sigue los
   bordes de la imagen (filtro guiado). La cuenta pesada va en segundo plano (worker)
   para que la carta no se trabe.

   Recorte.cortar(src, forma) → Promise<{ url, ancho, alto, caja, color }>
     forma: { tam: [W, H], contorno: [[x, y]…] | elipse: [cx, cy, rx, ry], huecos: [[[x, y]…]],
              afinar (true), banda (0.022: cuánto se puede corregir, en fracción del plato) }
     Todo en px de la foto de referencia (tam); si la foto vino de otro tamaño, se escala.
     caja: [x0, y0, x1, y1] del recorte, en px de la foto original.
   Sin forma (una foto cualquiera), recorta un óvalo con el borde suave.
   ============================================================================= */
(function () {
  "use strict";
  const TRABAJO = 520;          // lado de la imagen con la que se calcula el borde
  const SALIDA = 1100;          // lado máximo del recorte

  /* ---------- La cuenta (pura: corre igual en el worker o acá) ---------- */
  function calcularAlfa(rgba, M, w, h, banda, soloSuave) {
    const n = w * h;
    const integ = new Float64Array((w + 1) * (h + 1));
    const F = () => new Float32Array(n);
    // Promedio en una ventana de (2r+1)², con imagen integral (cuesta lo mismo para cualquier r)
    function caja(src, r, out) {
      const W1 = w + 1;
      for (let x = 0; x <= w; x++) integ[x] = 0;
      for (let y = 1; y <= h; y++) {
        let fila = 0;
        const o = y * W1, oa = o - W1, s = (y - 1) * w;
        integ[o] = 0;
        for (let x = 1; x <= w; x++) { fila += src[s + x - 1]; integ[o + x] = integ[oa + x] + fila; }
      }
      for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1), a0 = y0 * W1, a1 = y1 * W1, dy = y1 - y0;
        for (let x = 0; x < w; x++) {
          const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
          out[y * w + x] = (integ[a1 + x1] - integ[a0 + x1] - integ[a1 + x0] + integ[a0 + x0]) / (dy * (x1 - x0));
        }
      }
      return out;
    }
    const prom = (src, r) => caja(src, r, F());
    if (soloSuave) return prom(prom(M, banda), banda);      // sin afinar: el contorno con el borde suave
    const por = (a, b) => { const o = F(); for (let i = 0; i < n; i++) o[i] = a[i] * b[i]; return o; };
    const R = F(), G = F(), B = F();
    for (let i = 0, j = 0; i < n; i++, j += 4) { R[i] = rgba[j] / 255; G[i] = rgba[j + 1] / 255; B[i] = rgba[j + 2] / 255; }

    // 1. La rampa del contorno: 1 bien adentro, 0 bien afuera, y en el medio la franja dudosa
    const P = prom(M, banda);

    // 2. En la franja: ¿este punto se parece más al plato o al fondo de al lado?
    const seguroP = F(), seguroF = F();
    for (let i = 0; i < n; i++) { seguroP[i] = P[i] > 0.995 ? 1 : 0; seguroF[i] = P[i] < 0.005 ? 1 : 0; }
    const rc = Math.round(banda * 1.7);
    const nP = prom(seguroP, rc), nF = prom(seguroF, rc);
    const pR = prom(por(R, seguroP), rc), pG = prom(por(G, seguroP), rc), pB = prom(por(B, seguroP), rc);
    const fR = prom(por(R, seguroF), rc), fG = prom(por(G, seguroF), rc), fB = prom(por(B, seguroF), rc);
    const A = F();
    for (let i = 0; i < n; i++) {
      const pr = P[i];
      if (pr >= 0.995 || pr <= 0.005 || nP[i] < 1e-4 || nF[i] < 1e-4) { A[i] = pr; continue; }
      const cr = pR[i] / nP[i], cg = pG[i] / nP[i], cb = pB[i] / nP[i];      // color del plato cerca
      const dr = fR[i] / nF[i], dg = fG[i] / nF[i], db = fB[i] / nF[i];      // color del fondo cerca
      const vr = cr - dr, vg = cg - dg, vb = cb - db, v2 = vr * vr + vg * vg + vb * vb;
      const t = Math.max(0, Math.min(1, ((R[i] - dr) * vr + (G[i] - dg) * vg + (B[i] - db) * vb) / (v2 + 1e-6)));
      const conf = Math.max(0, Math.min(1, (Math.sqrt(v2) - 0.05) / 0.17));  // colores parecidos: manda el contorno
      const x = conf * t + (1 - conf) * pr;
      A[i] = 0.75 * x + 0.25 * pr;
    }
    for (let i = 0; i < n; i++) { const t = Math.max(0, Math.min(1, (A[i] - 0.3) / 0.4)); A[i] = t * t * (3 - 2 * t); }

    // 3. Filtro guiado (con los tres colores): el borde se pega a los bordes de la foto
    const r = Math.max(2, Math.round(banda * 0.45)), eps = 2e-4;
    const mR = prom(R, r), mG = prom(G, r), mB = prom(B, r), mA = prom(A, r);
    const mRA = prom(por(R, A), r), mGA = prom(por(G, A), r), mBA = prom(por(B, A), r);
    const vRR = prom(por(R, R), r), vRG = prom(por(R, G), r), vRB = prom(por(R, B), r);
    const vGG = prom(por(G, G), r), vGB = prom(por(G, B), r), vBB = prom(por(B, B), r);
    const aR = F(), aG = F(), aB = F(), bb = F();
    for (let i = 0; i < n; i++) {
      const mr = mR[i], mg = mG[i], mb = mB[i], ma = mA[i];
      const cr = mRA[i] - mr * ma, cg = mGA[i] - mg * ma, cb = mBA[i] - mb * ma;
      const rr = vRR[i] - mr * mr + eps, rg = vRG[i] - mr * mg, rb = vRB[i] - mr * mb;
      const gg = vGG[i] - mg * mg + eps, gb = vGB[i] - mg * mb, bv = vBB[i] - mb * mb + eps;
      const i00 = gg * bv - gb * gb, i01 = gb * rb - rg * bv, i02 = rg * gb - gg * rb;
      const i11 = rr * bv - rb * rb, i12 = rb * rg - rr * gb, i22 = rr * gg - rg * rg;
      const det = rr * i00 + rg * i01 + rb * i02;
      const ar = (i00 * cr + i01 * cg + i02 * cb) / det;
      const ag = (i01 * cr + i11 * cg + i12 * cb) / det;
      const ab = (i02 * cr + i12 * cg + i22 * cb) / det;
      aR[i] = ar; aG[i] = ag; aB[i] = ab;
      bb[i] = ma - ar * mr - ag * mg - ab * mb;
    }
    const maR = prom(aR, r), maG = prom(aG, r), maB = prom(aB, r), mbb = prom(bb, r);
    const q = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = maR[i] * R[i] + maG[i] * G[i] + maB[i] * B[i] + mbb[i];
      if (P[i] >= 0.995) v = Math.max(v, 0.85);           // lo que seguro es plato no se agujerea
      if (P[i] <= 0.005) v = 0;                           // y lo de afuera no aparece
      q[i] = Math.max(0, Math.min(1, v));
    }
    return q;
  }

  /* ---------- En segundo plano ---------- */
  let worker = null, pedidos = 0;
  const esperando = new Map();
  function enWorker(rgba, M, w, h, banda) {
    if (worker === null) {
      try {
        const codigo = `const calcularAlfa = ${calcularAlfa.toString()};
          onmessage = e => { const { id, rgba, M, w, h, banda } = e.data; const q = calcularAlfa(rgba, M, w, h, banda); postMessage({ id, q }, [q.buffer]); };`;
        worker = new Worker(URL.createObjectURL(new Blob([codigo], { type: "text/javascript" })));
        worker.onmessage = e => { const f = esperando.get(e.data.id); esperando.delete(e.data.id); if (f) f.ok(e.data.q); };
        worker.onerror = () => { for (const f of esperando.values()) f.mal(); esperando.clear(); worker = false; };
      } catch { worker = false; }
    }
    if (!worker) return Promise.resolve(calcularAlfa(rgba, M, w, h, banda));
    return new Promise((ok, mal) => {
      const id = ++pedidos;
      esperando.set(id, { ok, mal });
      worker.postMessage({ id, rgba, M, w, h, banda }, [rgba.buffer, M.buffer]);
    }).catch(() => calcularAlfa(rgba, M, w, h, banda));
  }

  /* ---------- Armar el recorte ---------- */
  const cargar = src => new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = mal;
    img.src = src;
  });
  const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  // Los puntos del contorno, en px de la foto que llegó
  function puntos(forma, W, H) {
    const [RW, RH] = forma.tam || [W, H];
    const kx = W / RW, ky = H / RH;
    const esc = ps => ps.map(([x, y]) => [x * kx, y * ky]);
    return { contorno: esc(contornoDe(forma)), huecos: (forma.huecos || []).map(esc), extra: (forma.extra || []).map(esc) };
  }
  // elipse: [cx, cy, rx, ry] · superelipse: [cx, cy, rx, ry, n] (n > 2: más cuadrada, como una fuente ovalada)
  function contornoDe(forma) {
    const e = forma.elipse ? [...forma.elipse, 2] : forma.superelipse;
    if (!e) return forma.contorno;
    const [cx, cy, rx, ry, k] = e, ps = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      ps.push([cx + Math.sign(c) * Math.abs(c) ** (2 / k) * rx, cy + Math.sign(s) * Math.abs(s) ** (2 / k) * ry]);
    }
    return ps;
  }

  function colorDe(rgba, alfa, n) {
    let r = 0, v = 0, a = 0, peso = 0;
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      if (alfa[i] < 0.6) continue;
      const R = rgba[j], G = rgba[j + 1], B = rgba[j + 2];
      const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
      const w = ((max - min) / 255) ** 2 * (1 - Math.abs(l - 128) / 128) + 0.001;   // lo vivo, ni muy claro ni muy oscuro
      r += R * w; v += G * w; a += B * w; peso += w;
    }
    if (!peso) return null;
    return "#" + [r, v, a].map(x => Math.round(x / peso).toString(16).padStart(2, "0")).join("");
  }

  // La caja del plato (lo que ocupa el recorte), con un poco de aire
  function cajaDe(contorno, extra, W, H) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of contorno.concat(...extra)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const aire = Math.max(x1 - x0, y1 - y0) * 0.025;
    return [Math.max(0, Math.floor(x0 - aire)), Math.max(0, Math.floor(y0 - aire)), Math.min(W, Math.ceil(x1 + aire)), Math.min(H, Math.ceil(y1 + aire))];
  }
  const ovalo = (W, H) => ({ elipse: [W / 2, H / 2, W * 0.42, H * 0.42], tam: [W, H], afinar: false, suave: 0.07 });

  async function hacer(src, forma) {
    const img = await cargar(src);
    const W = img.naturalWidth, H = img.naturalHeight;
    let f = forma || ovalo(W, H);
    if (f.auto) f = { ...f, tam: [W, H], contorno: [[0, 0], [W, 0], [W, H], [0, H]] };   // fondo liso: se saca solo
    const { contorno, huecos, extra } = puntos(f, W, H);
    const [x0, y0, x1, y1] = cajaDe(contorno, extra, W, H);
    const cw = x1 - x0, ch = y1 - y0;

    // Donde se calcula el borde (más chico) y el recorte final (hasta SALIDA)
    const kt = Math.min(1, TRABAJO / Math.max(cw, ch)), tw = Math.max(8, Math.round(cw * kt)), th = Math.max(8, Math.round(ch * kt));
    const ks = Math.min(1, SALIDA / Math.max(cw, ch)), sw = Math.round(cw * ks), sh = Math.round(ch * ks);
    const t = lienzo(tw, th), gt = t.getContext("2d", { willReadFrequently: true });
    gt.drawImage(img, x0, y0, cw, ch, 0, 0, tw, th);
    const rgba = gt.getImageData(0, 0, tw, th).data;
    // El contorno pintado: blanco adentro (los huecos, negros)
    const m = lienzo(tw, th), gm = m.getContext("2d", { willReadFrequently: true });
    gm.fillStyle = "#fff";
    const trazo = ps => ps.forEach(([x, y], i) => (i ? gm.lineTo : gm.moveTo).call(gm, (x - x0) * kt, (y - y0) * kt));
    gm.beginPath(); trazo(contorno); gm.closePath();
    extra.forEach(ps => { trazo(ps); gm.closePath(); });
    gm.fill("nonzero");
    if (huecos.length) { gm.globalCompositeOperation = "destination-out"; gm.beginPath(); huecos.forEach(ps => { trazo(ps); gm.closePath(); }); gm.fill(); }
    const md = gm.getImageData(0, 0, tw, th).data;
    const M = new Float32Array(tw * th);
    for (let i = 0; i < M.length; i++) M[i] = md[i * 4 + 3] / 255;

    let alfa;
    if (f.auto) {
      // Foto sobre fondo liso: lo que se parece al color de los bordes y toca el borde es fondo
      const n = tw * th, fondo = new Uint8Array(n), cola = new Int32Array(n);
      let r = 0, g = 0, b = 0, c = 0;
      const borde = i => { r += rgba[i * 4]; g += rgba[i * 4 + 1]; b += rgba[i * 4 + 2]; c++; };
      for (let x = 0; x < tw; x++) { borde(x); borde((th - 1) * tw + x); }
      for (let y = 0; y < th; y++) { borde(y * tw); borde(y * tw + tw - 1); }
      r /= c; g /= c; b /= c;
      const tol = (f.tolerancia || 38) ** 2;
      const parecido = i => (rgba[i * 4] - r) ** 2 + (rgba[i * 4 + 1] - g) ** 2 + (rgba[i * 4 + 2] - b) ** 2 < tol;
      let fin = 0;
      const sembrar = i => { if (!fondo[i] && parecido(i)) { fondo[i] = 1; cola[fin++] = i; } };
      for (let x = 0; x < tw; x++) { sembrar(x); sembrar((th - 1) * tw + x); }
      for (let y = 0; y < th; y++) { sembrar(y * tw); sembrar(y * tw + tw - 1); }
      for (let k = 0; k < fin; k++) {
        const i = cola[k], x = i % tw;
        if (x > 0) sembrar(i - 1);
        if (x < tw - 1) sembrar(i + 1);
        if (i >= tw) sembrar(i - tw);
        if (i < n - tw) sembrar(i + tw);
      }
      for (let i = 0; i < n; i++) M[i] = fondo[i] ? 0 : 1;
      alfa = calcularAlfa(null, M, tw, th, Math.max(1, Math.round(Math.max(tw, th) * 0.004)), true);
    } else if (f.afinar === false) {
      // Sin afinar: el contorno con el borde suavizado
      const suave = Math.max(1, Math.round(Math.max(tw, th) * (f.suave || 0.006) / 1.6));
      alfa = calcularAlfa(null, M, tw, th, suave, true);
    } else {
      // Cuánto puede corregir: una parte del plato, y nunca menos de unos 16 px de la foto
      const banda = Math.max(3, Math.round(Math.max(Math.max(tw, th) * (f.banda || 0.026), 16 * kt)));
      alfa = await enWorker(new Uint8ClampedArray(rgba), M, tw, th, banda);
    }
    const color = colorDe(rgba, alfa, tw * th);

    // El recorte final: la foto a buen tamaño y el borde agrandado suave (bilineal) y nítido
    const s = lienzo(sw, sh), gs = s.getContext("2d", { willReadFrequently: true });
    gs.drawImage(img, x0, y0, cw, ch, 0, 0, sw, sh);
    const out = gs.getImageData(0, 0, sw, sh), od = out.data;
    const fx = (tw - 1) / Math.max(1, sw - 1), fy = (th - 1) / Math.max(1, sh - 1);
    const nitido = f.afinar === false ? 0 : 0.18;
    for (let y = 0; y < sh; y++) {
      const ty = y * fy, ya = Math.floor(ty), yb = Math.min(th - 1, ya + 1), wy = ty - ya;
      for (let x = 0; x < sw; x++) {
        const tx = x * fx, xa = Math.floor(tx), xb = Math.min(tw - 1, xa + 1), wx = tx - xa;
        let a = (alfa[ya * tw + xa] * (1 - wx) + alfa[ya * tw + xb] * wx) * (1 - wy) + (alfa[yb * tw + xa] * (1 - wx) + alfa[yb * tw + xb] * wx) * wy;
        if (nitido) { a = Math.max(0, Math.min(1, (a - nitido) / (1 - 2 * nitido))); a = a * a * (3 - 2 * a); }
        od[(y * sw + x) * 4 + 3] = Math.round(a * 255);
      }
    }
    gs.putImageData(out, 0, 0);
    const blob = await new Promise(ok => s.toBlob(ok, "image/webp", 0.9));
    const url = blob ? URL.createObjectURL(blob) : s.toDataURL("image/png");
    // Dónde está de verdad el plato adentro del recorte (0 a 1), por si sobró fondo alrededor
    let ux0 = 1, uy0 = 1, ux1 = 0, uy1 = 0;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (alfa[y * tw + x] > 0.5) { ux0 = Math.min(ux0, x / tw); ux1 = Math.max(ux1, (x + 1) / tw); uy0 = Math.min(uy0, y / th); uy1 = Math.max(uy1, (y + 1) / th); }
    return { url, ancho: sw, alto: sh, caja: [x0, y0, x1, y1], foto: [W, H], color, util: ux1 > ux0 ? [ux0, uy0, ux1, uy1] : [0, 0, 1, 1] };
  }

  const hechos = new Map();
  // De a uno por vez (el primero que se pide, primero)
  let cola = Promise.resolve();
  function cortar(src, forma) {
    const clave = src + "|" + JSON.stringify(forma ? [forma.contorno, forma.elipse, forma.superelipse, forma.extra, forma.huecos, forma.banda, forma.afinar, forma.auto] : "ovalo");
    if (!hechos.has(clave)) {
      const p = cola.then(() => hacer(src, forma)).catch(() => null);
      cola = p.then(() => new Promise(r => setTimeout(r, 16)));
      hechos.set(clave, p);
    }
    return hechos.get(clave);
  }

  // La caja que va a tener el recorte, antes de hacerlo (para ubicar el plato de entrada)
  function caja(forma) {
    const [W, H] = forma.tam;
    const { contorno, extra } = puntos(forma, W, H);
    return cajaDe(contorno, extra, W, H);
  }

  window.Recorte = { cortar, contornoDe, caja };
})();
