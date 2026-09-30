/* =============================================================================
   CARTA VIVA · laboratorio — los juegos de los postres y las bebidas
   Cada plato con "juego" (fotos.js) se puede tocar y hace algo que sorprende:
   · servir   (bebidas): el vaso se llena con el dedo; la primera vez que aparece se sirve solo,
              y con un toque se vacía y se vuelve a servir. Son los cuadros de un video.
   · flan:    tiembla como un flan de verdad (se deforma por franjas, con resortes).
   · helado:  las bochas se hamacan una sobre otra al mover el cucurucho; la cereza salta.
   · cuchara: el cheesecake se come: la cuchara corta, se lleva el bocado y caen migas.

   Juegos.crear(p, d) → juego       p: el plato en la carta (escena-fotos), d: sus datos (fotos.js)
     juego.armar(r)                 el recorte está listo
     juego.abajo(e, x, y) → bool    empieza un toque (x, y: en px del plato); true: lo agarra el juego
     juego.mover(e, x, y, dx) · juego.arriba(e, toque, x, y)
     juego.cuadro(t, dt, v)         cada cuadro (v: { cerca, visible, centrado })
     juego.lejos()                  quedó lejos: suelta lo que ocupa memoria
     juego.pista                    qué decirle al comensal la primera vez
   ============================================================================= */
(function () {
  "use strict";
  const MOVIMIENTO = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const topes = (x, a, b) => Math.max(a, Math.min(b, x));
  const DPR = () => Math.min(devicePixelRatio || 1, 2);
  const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const cargar = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  const azar = (a, b) => a + Math.random() * (b - a);
  const caja = u => [u[0], u[1], u[2] - u[0], u[3] - u[1]];
  // Pone un elemento sobre el plato: lo que ocupa su imagen (u, fracción de sí mismo) cae en c (x, y, ancho, alto: fracción del plato)
  function calzar(el, u, c) {
    const [u0, v0, u1, v1] = u, [x, y, w, h] = c, W = w / (u1 - u0), H = h / (v1 - v0);
    Object.assign(el.style, { left: `${(x - u0 * W) * 100}%`, top: `${(y - v0 * H) * 100}%`, width: `${W * 100}%`, height: `${H * 100}%` });
  }

  /* ---------- Servir: el vaso se llena (cuadros de un video) ---------- */
  function servir(p, d) {
    const def = d.cuadros, FPS = 13;
    let atlas = null, pedido = 0, cv = null, g = null, f = 0, pintado = -1, modo = "espera", vista = {};
    function poner() {
      if (!cv || !atlas || !p.r) return;
      cv.width = atlas.tam[0]; cv.height = atlas.tam[1];
      g = cv.getContext("2d");
      calzar(cv, Cuadros.util(atlas, atlas.n - 1), caja(p.r.util));
      cv.hidden = false;
      p.fp.classList.add("jugando");
      pintado = -1;
      pintar();
    }
    function pintar() {
      if (!g || Math.abs(f - pintado) < 0.01) return;
      Cuadros.dibujar(g, atlas, f, cv.width, cv.height, false);
      pintado = f;
    }
    return {
      pista: "Deslizá el vaso para servirlo · tocalo y se sirve otro",
      armar() {
        cv = document.createElement("canvas");
        cv.className = "fp__juego";
        cv.hidden = true;
        p.plato3.appendChild(cv);
        poner();
      },
      cuadro(t, dt, v) {
        vista = v;
        if (v.cerca && !pedido) {
          const yo = (pedido = Math.random());
          Cuadros.pedir(def).then(a => {
            if (pedido !== yo) { if (a) Cuadros.soltar(def); return; }
            atlas = a;
            if (!a) return;
            // Si ya está a la vista, queda servido; si no, se sirve cuando llegue
            f = vista.visible ? a.n - 1 : 0;
            modo = vista.visible ? "lleno" : "espera";
            poner();
          });
        }
        if (!atlas || !g) return;
        const n = atlas.n;
        if (modo === "espera" && v.centrado) modo = "sirviendo";
        if (modo === "sirviendo") { f += dt * FPS; if (f >= n - 1) { f = n - 1; modo = "lleno"; } }
        else if (modo === "rebobinando") { f -= dt * 80; if (f <= 0) { f = 0; modo = "sirviendo"; } }
        if (v.visible) pintar();
      },
      abajo() { if (!atlas) return false; modo = "dedo"; return true; },
      mover(e, x, y, dx) { if (modo === "dedo") f = topes(f + (dx / Math.max(80, p.w)) * atlas.n * 1.3, 0, atlas.n - 1); },
      arriba(e, toque) {
        if (!atlas) return;
        if (toque) modo = f > 2 ? "rebobinando" : "sirviendo";
        else modo = f >= atlas.n - 1 ? "lleno" : "sirviendo";
      },
      lejos() {
        if (atlas) Cuadros.soltar(def);
        atlas = null; g = null; pedido = 0;
        if (cv) cv.hidden = true;
        p.fp.classList.remove("jugando");
      },
    };
  }

  /* ---------- Flan: tiembla (la foto por franjas, cada una corrida según su altura) ---------- */
  function flan(p, d) {
    const base = d.base, tope = d.arriba, cx = d.centro, [cl, cr] = d.columna || [0, 1];
    let img = null, solo = null, resto = null, cv = null, g = null, s = 0, vs = 0, m = 0, vm = 0, q = 0, vq = 0, dedo = false, meta = 0, x0 = 0, espera = 2.5, quieto = true;
    function pintar() {
      const W = Math.round(p.w * DPR()), H = Math.round(p.h * DPR());
      if (!W || !H) return;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const iw = solo.width, ih = solo.height, ky = ih / H;
      g.clearRect(0, 0, W, H);
      const yb = base * H, alto = yb - tope * H, paso = 2;
      g.drawImage(resto, 0, 0, W, H);                                        // el plato, quieto
      const comp = 1 - q, ancho = 1 + q * 0.5;
      for (let y = yb; y > 0; y -= paso) {
        const hs = (yb - y) / alto / comp;                                   // de qué altura del flan sale esta franja
        if (hs > 1.15) break;
        const h = Math.min(1, hs), peso = Math.pow(h, 1.5);
        const corre = (s * peso + m * (h * h * h - 0.45 * h)) * W;
        const a = 1 + (ancho - 1) * (0.4 + 0.6 * (1 - h));                  // aplastado, se ensancha (más abajo)
        const ys = (yb - hs * alto) * ky;
        g.drawImage(solo, 0, ys, iw, (paso / comp) * ky + 0.5, cx * W * (1 - a) + corre, y - paso, W * a, paso + 0.7);
      }
    }
    return {
      pista: "Tocalo y mirá cómo tiembla",
      armar(r) {
        cv = document.createElement("canvas");
        cv.className = "fp__juego";
        cv.hidden = true;
        p.plato3.appendChild(cv);
        g = cv.getContext("2d");
        cargar(r.url).then(i => {
          if (!i) return;
          // El flan solo (su columna, arriba de donde apoya) y lo demás (el plato), por separado
          const w = i.naturalWidth, h = i.naturalHeight, x0 = cl * w, x1 = cr * w, yb = base * h;
          solo = lienzo(w, h); resto = lienzo(w, h);
          const gs = solo.getContext("2d"), gr = resto.getContext("2d");
          gs.drawImage(i, x0, 0, x1 - x0, yb, x0, 0, x1 - x0, yb);
          gr.drawImage(i, 0, 0);
          gr.clearRect(x0, 0, x1 - x0, yb);
          img = i;
        });
      },
      cuadro(t, dt, v) {
        if (!img || !v.visible) return;
        // De vez en cuando tiembla solo, un poquito (para que se note que se mueve)
        if (MOVIMIENTO && v.centrado && !dedo && (espera -= dt) <= 0) {
          vs += azar(0.25, 0.4) * (Math.random() < 0.5 ? -1 : 1); vq += 0.5;
          espera = azar(4.5, 7.5);
        }
        dt = Math.min(dt, 1 / 30);
        if (dedo) { s += (meta - s) * (1 - Math.exp(-dt * 16)); vs = 0; }
        else { vs += (-150 * s - 2.6 * vs) * dt; s += vs * dt; }            // flojo, y tarda en quedarse quieto
        vm += (-620 * m - 5 * vm) * dt; m += vm * dt;
        vq += (-260 * q - 5.5 * vq) * dt; q = topes(q + vq * dt, -0.14, 0.2);
        const energia = Math.abs(s) + Math.abs(vs) * 0.05 + Math.abs(m) + Math.abs(vm) * 0.05 + Math.abs(q) + Math.abs(vq) * 0.05;
        if (energia < 0.0008 && !dedo) {
          if (!quieto) { quieto = true; cv.hidden = true; p.fp.classList.remove("jugando"); }
          return;
        }
        if (quieto) { quieto = false; cv.hidden = false; p.fp.classList.add("jugando"); }
        pintar();
      },
      abajo(e, x) { if (!img) return false; dedo = true; x0 = x; meta = s; return true; },
      mover(e, x) { if (dedo) meta = topes(((x - x0) / Math.max(80, p.w)) * 0.45, -0.13, 0.13); },
      arriba(e, toque, x) {
        dedo = false;
        if (toque) {
          const lado = x / Math.max(1, p.w) - cx;
          vs += -lado * 2.6 + azar(-0.25, 0.25);
          vq += 2.3;
          vm += azar(-0.5, 0.5);
        } else vs += (meta - s) * 2;
      },
      lejos() {},
    };
  }

  /* ---------- Helado: las bochas se hamacan (cada una en su franja, encima de la de abajo) ---------- */
  function helado(p, d) {
    const cortes = d.cortes;                                                 // de arriba hacia abajo
    let raiz = null, niveles = [], a0 = 0, va0 = 0, vaAntes = 0, meta = 0, dedo = false, x0 = 0, espera = 3;
    const ang = [0, 0, 0, 0], vel = [0, 0, 0, 0];
    let salto = 0, vsalto = 0, giroC = 0;
    return {
      pista: "Movelo con el dedo · tocá la cereza",
      armar(r) {
        raiz = document.createElement("div");
        raiz.className = "torre";
        const lim = [1, ...cortes.slice().reverse(), 0];                     // de abajo hacia arriba
        let cont = null;
        for (let i = 0; i < 5; i++) {
          const abajo = lim[i], arriba = lim[i + 1];
          const nivel = i === 0 ? raiz : document.createElement("div");
          if (i > 0) { nivel.className = "torre__nivel"; nivel.style.transformOrigin = `50% ${abajo * 100}%`; cont.appendChild(nivel); }
          else nivel.style.transformOrigin = "50% 99%";                       // el cucurucho se apoya en la punta
          const capa = document.createElement("div");
          capa.className = "torre__capa";
          const sube = i === 4 ? -20 : arriba * 100, baja = i === 0 ? 110 : abajo * 100 + 1.4;   // cada una tapa un poco la de abajo
          capa.style.clipPath = `polygon(-20% ${sube}%, 120% ${sube}%, 120% ${baja}%, -20% ${baja}%)`;
          capa.innerHTML = `<img src="${r.url}" alt="" draggable="false">`;
          nivel.prepend(capa);
          niveles.push(nivel);
          cont = nivel;
        }
        p.plato3.appendChild(raiz);
        p.fp.classList.add("jugando");
      },
      cuadro(t, dt, v) {
        if (!raiz || !v.visible) return;
        dt = Math.min(dt, 1 / 30);
        if (MOVIMIENTO && v.centrado && !dedo && (espera -= dt) <= 0) {
          vel[3] += azar(40, 70) * (Math.random() < 0.5 ? -1 : 1); vel[2] += azar(-20, 20);
          espera = azar(5, 8);
        }
        const antes = a0;
        if (dedo) { a0 += (meta - a0) * (1 - Math.exp(-dt * 14)); va0 = (a0 - antes) / Math.max(dt, 0.001); }
        else { va0 += (-110 * a0 - 8 * va0) * dt; a0 += va0 * dt; }
        const acel = topes((va0 - vaAntes) / Math.max(dt, 0.001), -6000, 6000);
        vaAntes = va0;
        // Cada bocha quiere quedar derecha sobre la de abajo; si la de abajo se mueve, se queda atrás
        const K = [300, 250, 200, 150], C = [7, 6, 5, 3.5];
        for (let i = 0; i < 4; i++) {
          const empuje = i ? vel[i - 1] * 0.9 : 0;
          vel[i] += (-K[i] * ang[i] - C[i] * vel[i] - acel * 0.16 * (1 + i * 0.3) - empuje * 2) * dt;
          ang[i] = topes(ang[i] + vel[i] * dt, -22, 22);
        }
        // La cereza: salta, gira y rebota
        if (salto > 0 || vsalto > 0) {
          vsalto -= 2600 * dt; salto += vsalto * dt; giroC += vsalto * dt * 0.9;
          if (salto <= 0) { salto = 0; vsalto = vsalto < -160 ? -vsalto * 0.32 : 0; if (!vsalto) giroC = 0; vel[2] += 25; }
        }
        raiz.style.transform = `rotate(${a0.toFixed(2)}deg)`;
        for (let i = 0; i < 4; i++) {
          const extra = i === 3 && salto > 0 ? ` translateY(${(-salto).toFixed(1)}px) rotate(${(giroC % 360).toFixed(1)}deg)` : "";
          niveles[i + 1].style.transform = `rotate(${ang[i].toFixed(2)}deg)${extra}`;
        }
      },
      abajo(e, x) { if (!raiz) return false; dedo = true; x0 = x; meta = a0; return true; },
      mover(e, x) { if (dedo) meta = topes((x - x0) * 0.1, -14, 14); },
      arriba(e, toque, x, y) {
        dedo = false;
        if (!toque) return;
        const fy = y / Math.max(1, p.h);
        if (fy < cortes[0] + 0.06) { vsalto = 560; vel[3] += azar(-30, 30); }  // la cereza
        else {
          const k = fy < cortes[1] ? 2 : fy < cortes[2] ? 1 : 0, lado = x / Math.max(1, p.w) - 0.5;
          vel[k] += -lado * 260 + azar(-30, 30);
          if (k === 2) vsalto = Math.max(vsalto, 300);
        }
      },
      lejos() {},
    };
  }

  /* ---------- Cuchara: el cheesecake se come ----------
     La porción es un lienzo: la cuchara le saca pedacitos (con la forma de su hueco). Donde se sacó
     se ve el adentro, más oscuro y con la sombra del borde; donde se sacó mucho, se ve el plato.
     Lo que se saca va a la cuchara (el bocado), que se lo lleva. Caen migas al plato. */
  function cuchara(p, d) {
    const cp = d.porcion.caja, cq = d.platito.caja, dc = d.cuchara;
    let listo = false, ancho = 0, alto = 0, rx = 0, ry = 0, total = 1;
    let platoEl, cvP, gP, frente, fondo, hondo, bocado, tmp, cuch, cvB, migasCv, migasG, hx = 0.2, hy = 0.45, aspecto = 3;
    let sucio = false, sombra = null, bx = 0, by = 0, ang = -28, alfa = 1, modo = "quieta", tiempo = 0, x0 = 0, y0 = 0, movio = false, desde = null, tap = null, comido = 0, cajaB = null;
    const migas = [];
    const descanso = () => ({ x: 0.52, y: 0.84, ang: -6 });                  // la cuchara apoyada en el plato, adelante de la porción
    const ancC = () => cp[2] * 0.5;                                         // el largo de la cuchara (fracción del plato)

    function armarTodo([rP, rQ, rC]) {
      if (!rP || !rQ || !rC) return;
      // El plato
      platoEl = document.createElement("div");
      platoEl.className = "cheese__plato";
      platoEl.innerHTML = `<img src="${rQ.url}" alt="" draggable="false">`;
      calzar(platoEl, rQ.util, cq);
      // La porción: solo lo que ocupa, a buen tamaño
      const [u0, v0, u1, v1] = rP.util;
      ancho = Math.round(Math.min(620, (u1 - u0) * rP.ancho));
      alto = Math.round((ancho * (v1 - v0) * rP.alto) / ((u1 - u0) * rP.ancho));
      cvP = lienzo(ancho, alto);
      cvP.className = "cheese__porcion";
      Object.assign(cvP.style, { left: `${cp[0] * 100}%`, top: `${cp[1] * 100}%`, width: `${cp[2] * 100}%`, height: `${cp[3] * 100}%` });
      gP = cvP.getContext("2d");
      sombra = lienzo(ancho / 4, alto / 4);
      frente = lienzo(ancho, alto); fondo = lienzo(ancho, alto); hondo = lienzo(ancho, alto); bocado = lienzo(ancho, alto); tmp = lienzo(ancho, alto);
      cargar(rP.url).then(img => {
        const sx = u0 * img.naturalWidth, sy = v0 * img.naturalHeight, sw = (u1 - u0) * img.naturalWidth, sh = (v1 - v0) * img.naturalHeight;
        frente.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, ancho, alto);
        // El adentro: la misma porción, más oscura y más cálida
        const gf = fondo.getContext("2d", { willReadFrequently: true });
        gf.drawImage(frente, 0, 0);
        const px = gf.getImageData(0, 0, ancho, alto), dd = px.data;
        for (let i = 0; i < dd.length; i += 4) { dd[i] *= 0.76; dd[i + 1] *= 0.66; dd[i + 2] *= 0.52; }
        gf.putImageData(px, 0, 0);
        fondo.orig = lienzo(ancho, alto); fondo.orig.getContext("2d").drawImage(frente, 0, 0);
        total = cuanto(frente) || 1;
        pintar();
        // La cuchara
        cuch = document.createElement("div");
        cuch.className = "cheese__cuchara";
        const [c0, e0, c1, e1] = rC.util;
        aspecto = ((c1 - c0) * rC.ancho) / ((e1 - e0) * rC.alto);
        hx = (dc.hueco[0] - c0) / (c1 - c0); hy = (dc.hueco[1] - e0) / (e1 - e0);
        cuch.innerHTML = `<img src="${rC.url}" alt="" draggable="false" style="width:${100 / (c1 - c0)}%;height:${100 / (e1 - e0)}%;left:${(-c0 / (c1 - c0)) * 100}%;top:${(-e0 / (e1 - e0)) * 100}%">`;
        cvB = lienzo(160, 120);
        cvB.className = "cheese__bocado";
        cuch.appendChild(cvB);
        cuch.style.transformOrigin = `${hx * 100}% ${hy * 100}%`;
        migasCv = document.createElement("canvas");
        migasCv.className = "cheese__migas";
        migasG = migasCv.getContext("2d");
        p.plato3.append(platoEl, cvP, cuch, migasCv);
        const r = descanso(); bx = r.x; by = r.y; ang = r.ang;
        listo = true;
        p.fp.classList.add("jugando");
      });
    }
    // Cuánto queda (suma de lo que no es transparente, en chiquito)
    const chico = lienzo(64, 48), gChico = chico.getContext("2d", { willReadFrequently: true });
    function cuanto(c) {
      gChico.clearRect(0, 0, 64, 48); gChico.drawImage(c, 0, 0, 64, 48);
      const dd = gChico.getImageData(0, 0, 64, 48).data; let s = 0;
      for (let i = 3; i < dd.length; i += 4) s += dd[i];
      return s;
    }
    function pintar() {
      gP.clearRect(0, 0, ancho, alto);
      gP.globalCompositeOperation = "source-over"; gP.drawImage(fondo, 0, 0);
      gP.globalCompositeOperation = "destination-out"; gP.drawImage(hondo, 0, 0);
      // El borde que queda tira sombra adentro del hueco (la porción en chiquito y oscura: al agrandarla queda borrosa)
      const gs = sombra.getContext("2d");
      gs.globalCompositeOperation = "source-over"; gs.clearRect(0, 0, sombra.width, sombra.height);
      gs.drawImage(frente, 0, 0, sombra.width, sombra.height);
      gs.globalCompositeOperation = "source-in"; gs.fillStyle = "rgba(60,28,4,.62)"; gs.fillRect(0, 0, sombra.width, sombra.height);
      gP.globalCompositeOperation = "source-atop"; gP.imageSmoothingQuality = "high";
      gP.drawImage(sombra, 0, ancho * 0.014, ancho, alto);
      gP.globalCompositeOperation = "source-over"; gP.drawImage(frente, 0, 0);
    }
    // Un bocadito: donde está el hueco de la cuchara
    function sacar(fx, fy) {
      const X = ((fx - cp[0]) / cp[2]) * ancho, Y = ((fy - cp[1]) / cp[3]) * alto;
      rx = ((ancC() * 0.36) / cp[2]) * ancho * 0.5; ry = rx * 0.6;
      if (X < -rx || X > ancho + rx || Y < -ry || Y > alto + ry) return 0;
      const rad = (ang * Math.PI) / 180;
      const elipse = (g, k) => { g.beginPath(); g.ellipse(X, Y, rx * k, ry * k, rad, 0, Math.PI * 2); g.fill(); };
      const gt = tmp.getContext("2d", { willReadFrequently: true });
      gt.globalCompositeOperation = "source-over"; gt.clearRect(0, 0, ancho, alto); gt.fillStyle = "#fff"; elipse(gt, 1);
      gt.globalCompositeOperation = "source-in"; gt.drawImage(frente, 0, 0);
      // cuánto había ahí (para el bocado y las migas)
      const bx0 = Math.max(0, Math.floor(X - rx)), by0 = Math.max(0, Math.floor(Y - rx)), bw = Math.min(ancho, Math.ceil(X + rx)) - bx0, bh = Math.min(alto, Math.ceil(Y + rx)) - by0;
      if (bw <= 0 || bh <= 0) return 0;
      const dd = gt.getImageData(bx0, by0, bw, bh).data;
      let s = 0, col = null;
      for (let i = 3; i < dd.length; i += 16) { s += dd[i]; if (!col && dd[i] > 200) col = `rgb(${dd[i - 3]},${dd[i - 2]},${dd[i - 1]})`; }
      if (s < 800) return 0;
      bocado.getContext("2d").drawImage(tmp, 0, 0);
      cajaB = cajaB ? [Math.min(cajaB[0], bx0), Math.min(cajaB[1], by0), Math.max(cajaB[2], bx0 + bw), Math.max(cajaB[3], by0 + bh)] : [bx0, by0, bx0 + bw, by0 + bh];
      const gf = frente.getContext("2d"); gf.globalCompositeOperation = "destination-out"; gf.fillStyle = "#000"; elipse(gf, 1); gf.globalCompositeOperation = "source-over";
      sucio = true;
      if (MOVIMIENTO) for (let k = 0; k < 2 + Math.random() * 2; k++) migas.push({ x: fx * p.w + azar(-6, 6), y: fy * p.h, vx: azar(-70, 70), vy: azar(-170, -60), r: azar(1.2, 2.8), col: Math.random() < 0.3 ? "#c99250" : col || "#f1e3bf", vida: 1, piso: (cq[1] + cq[3] * azar(0.35, 0.6)) * p.h });
      comido += s;
      return s;
    }
    function mostrarBocado() {
      const g = cvB.getContext("2d");
      g.clearRect(0, 0, cvB.width, cvB.height);
      if (!cajaB) return;
      const [a, b, c, e] = cajaB, w = c - a, h = e - b, k = Math.min(cvB.width / w, cvB.height / h) * 0.95;
      g.drawImage(bocado, a, b, w, h, (cvB.width - w * k) / 2, cvB.height - h * k, w * k, h * k);
    }
    function nuevaPorcion() {
      const gf = frente.getContext("2d"); gf.clearRect(0, 0, ancho, alto); gf.drawImage(fondo.orig, 0, 0);
      hondo.getContext("2d").clearRect(0, 0, ancho, alto);
      pintar();
      if (MOVIMIENTO) cvP.animate([{ transform: "translateY(-28%) scale(.92)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 620, easing: "cubic-bezier(.3,1.5,.5,1)" });
    }
    // La cuchara en su lugar (x, y: el hueco, en fracción del plato)
    function ubicarCuchara() {
      const w = ancC() * p.w, h = w / aspecto;
      Object.assign(cuch.style, { width: `${w}px`, height: `${h}px` });
      cuch.style.transform = `translate(${(bx * p.w - hx * w).toFixed(1)}px, ${(by * p.h - hy * h).toFixed(1)}px) rotate(${ang.toFixed(1)}deg)`;
      cuch.style.opacity = alfa.toFixed(3);
      // el bocado, derecho, apoyado en el hueco
      const bw = w * 0.34, bh = bw * 0.75;
      Object.assign(cvB.style, { width: `${bw}px`, height: `${bh}px`, left: `${hx * w - bw / 2}px`, top: `${hy * h - bh * 0.95}px`, transform: `rotate(${(-ang).toFixed(1)}deg)` });
    }
    function pintarMigas(dt) {
      const W = Math.round(p.w * DPR()), H = Math.round(p.h * DPR());
      if (migasCv.width !== W || migasCv.height !== H) { migasCv.width = W; migasCv.height = H; }
      migasG.setTransform(1, 0, 0, 1, 0, 0);
      migasG.clearRect(0, 0, W, H);
      if (!migas.length) return;
      migasG.setTransform(DPR(), 0, 0, DPR(), 0, 0);
      for (let i = migas.length - 1; i >= 0; i--) {
        const m = migas[i];
        if (m.y < m.piso) { m.vy += 900 * dt; m.x += m.vx * dt; m.y += m.vy * dt; }
        else { m.y = m.piso; m.vida -= dt * 0.9; }
        if (m.vida <= 0) { migas.splice(i, 1); continue; }
        migasG.globalAlpha = Math.min(1, m.vida * 2);
        migasG.fillStyle = m.col;
        migasG.beginPath(); migasG.arc(m.x, m.y, m.r, 0, Math.PI * 2); migasG.fill();
      }
      migasG.globalAlpha = 1;
    }
    function comer() {
      if (cajaB) {
        // Donde se sacó, queda más hondo (en el medio): dos cucharadas en el mismo lugar ya dejan ver el plato
        const [a, b, c, e] = cajaB, mx = (a + c) / 2, my = (b + e) / 2, gh = hondo.getContext("2d");
        for (const [k, al] of [[0.62, 0.45], [0.42, 0.5]]) { gh.save(); gh.globalAlpha = al; gh.translate(mx, my); gh.scale(k, k); gh.translate(-mx, -my); gh.drawImage(bocado, 0, 0); gh.restore(); }
        sucio = true;
        mostrarBocado(); modo = "comiendo"; tiempo = 0; desde = { x: bx, y: by, ang }; }
      else volver();
    }
    function volver() { modo = "volviendo"; tiempo = 0; desde = { x: bx, y: by, ang }; }
    const suave = t => t * t * (3 - 2 * t);

    return {
      pista: "Agarrá la cuchara y probalo",
      get estado() { return { modo, tiempo, bx, by, ang, listo, cajaB, ancho, alto }; },
      armar() {
        Promise.all([Recorte.cortar(d.porcion.foto, { alfa: d.porcion.alfa }), Recorte.cortar(d.platito.foto, { alfa: d.platito.alfa }), Recorte.cortar(dc.foto, { alfa: dc.alfa })]).then(armarTodo);
      },
      cuadro(t, dt, v) {
        if (!listo || !v.visible) return;
        dt = Math.min(dt, 1 / 30);
        if (modo === "dedo") {
          const obj = { x: tap.x, y: tap.y };
          const k = 1 - Math.exp(-dt * 22), nx = bx + (obj.x - bx) * k, ny = by + (obj.y - by) * k;
          const vx = (nx - bx) / dt;
          ang += (topes(-18 + vx * 60, -60, 20) - ang) * (1 - Math.exp(-dt * 10));
          // Corta de a pasitos (para que no queden huecos en el camino)
          if (movio) { const pasos = Math.ceil(Math.hypot((nx - bx) * p.w, (ny - by) * p.h) / 4) || 1; for (let i = 1; i <= pasos; i++) sacar(bx + ((nx - bx) * i) / pasos, by + ((ny - by) * i) / pasos); }
          bx = nx; by = ny;
          if (cajaB) mostrarBocado();
        } else if (modo === "auto") {
          // Un toque en la porción: la cuchara va, saca una cucharada y se la lleva
          tiempo += dt;
          const ir = 0.22, cavar = 0.3;
          if (tiempo < ir) { const k = suave(tiempo / ir); bx = desde.x + (tap.x - 0.035 - desde.x) * k; by = desde.y + (tap.y - 0.02 - desde.y) * k; ang = desde.ang + (-8 - desde.ang) * k; }
          else if (tiempo < ir + cavar) {
            const k = (tiempo - ir) / cavar, nx = tap.x - 0.035 + 0.075 * k, ny = tap.y - 0.02 + Math.sin(k * Math.PI) * 0.05 - 0.03 * k;
            const pasos = 4; for (let i = 1; i <= pasos; i++) sacar(bx + ((nx - bx) * i) / pasos, by + ((ny - by) * i) / pasos);
            bx = nx; by = ny; ang = -8 - 22 * k;
            if (cajaB) mostrarBocado();
          } else comer();
        } else if (modo === "comiendo") {
          // Se va para arriba con el bocado
          tiempo += dt;
          const k = Math.min(1, tiempo / 0.5), e = k * k;
          bx = desde.x + 0.08 * e; by = desde.y - 0.75 * e; ang = desde.ang - 30 * e; alfa = 1 - Math.max(0, (k - 0.55) / 0.45);
          if (k >= 1) {
            bocado.getContext("2d").clearRect(0, 0, ancho, alto); cajaB = null; mostrarBocado();
            if (cuanto(frente) < total * 0.22) nuevaPorcion();
            const r = descanso(); bx = r.x; by = r.y - 0.08; ang = r.ang; alfa = 0;
            modo = "volviendo"; tiempo = 0; desde = { x: bx, y: by, ang, aparece: true };
          }
        } else if (modo === "volviendo") {
          tiempo += dt;
          const r = descanso(), k = suave(Math.min(1, tiempo / 0.38));
          bx = desde.x + (r.x - desde.x) * k; by = desde.y + (r.y - desde.y) * k; ang = desde.ang + (r.ang - desde.ang) * k;
          alfa = desde.aparece ? k : 1;
          if (k >= 1) { modo = "quieta"; alfa = 1; }
        } else if (MOVIMIENTO) {
          const r = descanso(); by = r.y + Math.sin(t * 2.2) * 0.004; ang = r.ang + Math.sin(t * 1.3) * 1.5;
        }
        if (sucio) { pintar(); sucio = false; }
        ubicarCuchara();
        pintarMigas(dt);
      },
      abajo(e, x, y) {
        if (!listo || modo === "comiendo" || modo === "auto") return !!listo;
        x0 = x; y0 = y; movio = false;
        tap = { x: x / p.w, y: (y - 26) / p.h };                               // el hueco, un poco arriba del dedo (que se vea)
        modo = "dedo";
        return true;
      },
      mover(e, x, y) {
        if (modo !== "dedo") return;
        if (!movio && Math.hypot(x - x0, y - y0) > 6) movio = true;
        tap = { x: x / p.w, y: (y - 26) / p.h };
      },
      arriba(e, toque, x, y) {
        if (modo !== "dedo") return;
        const fx = x / p.w, fy = y / p.h;
        if (toque && fx > cp[0] && fx < cp[0] + cp[2] && fy > cp[1] && fy < cp[1] + cp[3] * 0.95) { modo = "auto"; tiempo = 0; tap = { x: fx, y: fy }; desde = { x: bx, y: by, ang }; }
        else comer();
      },
      lejos() {},
    };
  }

  const JUEGOS = { servir, flan, helado, cuchara };
  window.Juegos = { crear: (p, d) => (JUEGOS[d.juego] ? JUEGOS[d.juego](p, d) : null) };
})();
