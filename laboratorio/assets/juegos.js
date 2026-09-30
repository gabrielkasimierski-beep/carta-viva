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

  /* ---------- Servir: el vaso se llena (cuadros de un video) ----------
     Lleno, se ve la foto (que es el último cuadro, más nítido): los cuadros se esfuman sobre ella. */
  function servir(p, d) {
    const def = d.cuadros, FPS = 13;
    let atlas = null, pedido = 0, cv = null, g = null, f = 0, pintado = -1, modo = "espera", vista = {}, opaco = 1;
    function poner() {
      if (!cv || !atlas || !p.r) return;
      cv.width = atlas.tam[0]; cv.height = atlas.tam[1];
      g = cv.getContext("2d");
      calzar(cv, Cuadros.util(atlas, atlas.n - 1), caja(p.r.util));
      pintado = -1;
      mostrar(modo !== "lleno");
      pintar();
    }
    // Los cuadros tapan la foto; lleno, se esfuman y queda la foto
    function mostrar(si) {
      if (si) { opaco = 1; cv.style.opacity = "1"; cv.hidden = false; p.fp.classList.add("jugando"); }
      else p.fp.classList.remove("jugando");
    }
    function pintar() {
      if (!g || Math.abs(f - pintado) < 0.01) return;
      Cuadros.dibujar(g, atlas, f, cv.width, cv.height, false);
      pintado = f;
    }
    return {
      pista: d.pista || "Deslizá el vaso para servirlo · tocalo y se sirve otro",
      armar() {
        cv = document.createElement("canvas");
        cv.className = "fp__juego";
        cv.hidden = true;
        // Lo que cae de arriba (el chorro) aparece de a poco
        if (d.esfumar) cv.style.webkitMaskImage = cv.style.maskImage = `linear-gradient(to bottom, transparent, #000 ${d.esfumar * 100}%)`;
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
        if (modo === "sirviendo") { f += dt * FPS; if (f >= n - 1) { f = n - 1; modo = "lleno"; mostrar(false); } }
        else if (modo === "rebobinando") { f -= dt * 80; if (f <= 0) { f = 0; modo = "sirviendo"; } }
        if (modo === "lleno" && !cv.hidden) { opaco -= dt * 3; cv.style.opacity = Math.max(0, opaco).toFixed(3); if (opaco <= 0) cv.hidden = true; }
        else if (modo !== "lleno" && (cv.hidden || opaco < 1)) mostrar(true);
        if (v.visible && !cv.hidden) pintar();
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

  /* ---------- Flan: tiembla de verdad (los cuadros de un video del flan temblando) ----------
     La primera vez que aparece, tiembla solo; después, con cada toque. Quieto, se ve la foto. */
  function flan(p, d) {
    const def = d.cuadros, FPS = def.fps || 16;
    let atlas = null, pedido = 0, cv = null, g = null, f = 0, andando = false, primera = true, vista = {};
    function poner() {
      if (!cv || !atlas || !p.r) return;
      cv.width = atlas.tam[0]; cv.height = atlas.tam[1];
      g = cv.getContext("2d");
      calzar(cv, Cuadros.util(atlas, 0), caja(p.r.util));
    }
    function arrancar(desde) {
      if (!g) return;
      f = desde; andando = true;
      Cuadros.dibujar(g, atlas, f, cv.width, cv.height, false);
      cv.hidden = false;
      p.fp.classList.add("jugando");
    }
    return {
      pista: "Tocalo y mirá cómo tiembla",
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
            poner();
          });
        }
        if (!g) return;
        if (primera && v.centrado) { primera = false; arrancar(0); }
        if (!andando) return;
        f += Math.min(dt, 1 / 20) * FPS;
        if (f >= atlas.n - 1) { andando = false; cv.hidden = true; p.fp.classList.remove("jugando"); return; }
        if (v.visible) Cuadros.dibujar(g, atlas, f, cv.width, cv.height, false);
      },
      abajo() { return !!g; },
      mover() {},
      arriba(e, toque) {
        if (!g) return;
        if (!andando) arrancar(0);
        else if (f > atlas.n * 0.25) arrancar(d.golpe || 2);                  // otro toque mientras tiembla: tiembla de nuevo
      },
      lejos() {
        if (atlas) Cuadros.soltar(def);
        atlas = null; g = null; pedido = 0; andando = false;
        if (cv) cv.hidden = true;
        p.fp.classList.remove("jugando");
      },
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

  /* ---------- Cuchara: el cheesecake se come de la punta para atrás ----------
     Cada bocado: la cuchara baja de canto y corta derecho, un poco más atrás que la vez anterior;
     el pedazo se separa, la cuchara lo levanta y se lo lleva. La porción va quedando cada vez más
     chica (el borde cortado, con su sombra). Caen migas al plato. Cuando no queda nada, llega otra. */
  function cuchara(p, d) {
    const cp = d.porcion.caja, cq = d.platito.caja, dc = d.cuchara, BOCADOS = 6;
    let listo = false, W = 0, H = 0, arriba = null, abajo = null, ini = 0, fin = 0, corte = 0, sigue = 0;
    let platoEl, cvP, gP, orig, pedEl, cuch, cvB, migasCv, migasG, hx = 0.2, hy = 0.45, punta = 0.03, aspecto = 3;
    let bx = 0.52, by = 0.84, ang = -6, alfa = 1, modo = "quieta", tiempo = 0, desde = null, raja = 0, x0 = 0, y0 = 0, movio = false, tap = null;
    let ped = null;                                                          // el pedazo cortado: { c, x, y, w, h } (px de la porción)
    const migas = [];
    const descanso = () => ({ x: 0.52, y: 0.84, ang: -6 });
    const ancC = () => cp[2] * 0.5;
    // De px de la porción a fracción del plato, y al revés
    const fx = X => cp[0] + (X / W) * cp[2], fy = Y => cp[1] + (Y / H) * cp[3];
    const suave = t => t * t * (3 - 2 * t);
    const mezcla = (a, b, k) => a + (b - a) * k;

    function armarTodo([rP, rQ, rC]) {
      if (!rP || !rQ || !rC) return;
      platoEl = document.createElement("div");
      platoEl.className = "cheese__plato";
      platoEl.innerHTML = `<img src="${rQ.url}" alt="" draggable="false">`;
      calzar(platoEl, rQ.util, cq);
      const [u0, v0, u1, v1] = rP.util;
      W = Math.round(Math.min(620, (u1 - u0) * rP.ancho));
      H = Math.round((W * (v1 - v0) * rP.alto) / ((u1 - u0) * rP.ancho));
      cvP = lienzo(W, H);
      cvP.className = "cheese__porcion";
      Object.assign(cvP.style, { left: `${cp[0] * 100}%`, top: `${cp[1] * 100}%`, width: `${cp[2] * 100}%`, height: `${cp[3] * 100}%` });
      gP = cvP.getContext("2d");
      orig = lienzo(W, H);
      pedEl = lienzo(8, 8);
      pedEl.className = "cheese__pedazo";
      pedEl.hidden = true;
      cargar(rP.url).then(img => {
        const go = orig.getContext("2d", { willReadFrequently: true });
        go.drawImage(img, u0 * img.naturalWidth, v0 * img.naturalHeight, (u1 - u0) * img.naturalWidth, (v1 - v0) * img.naturalHeight, 0, 0, W, H);
        // Dónde empieza y termina la porción en cada columna (para cortar y para las migas)
        const dd = go.getImageData(0, 0, W, H).data;
        arriba = new Float32Array(W).fill(-1); abajo = new Float32Array(W).fill(-1);
        for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (dd[(y * W + x) * 4 + 3] > 100) { if (arriba[x] < 0) arriba[x] = y; abajo[x] = y; }
        ini = 0; while (ini < W - 1 && arriba[ini] < 0) ini++;
        fin = W - 1; while (fin > 0 && arriba[fin] < 0) fin--;
        corte = ini;
        pintar();
        cuch = document.createElement("div");
        cuch.className = "cheese__cuchara";
        const [c0, e0, c1, e1] = rC.util;
        aspecto = ((c1 - c0) * rC.ancho) / ((e1 - e0) * rC.alto);
        hx = (dc.hueco[0] - c0) / (c1 - c0); hy = (dc.hueco[1] - e0) / (e1 - e0); punta = Math.max(0, (dc.punta - c0) / (c1 - c0));
        cuch.innerHTML = `<img src="${rC.url}" alt="" draggable="false" style="width:${100 / (c1 - c0)}%;height:${100 / (e1 - e0)}%;left:${(-c0 / (c1 - c0)) * 100}%;top:${(-e0 / (e1 - e0)) * 100}%">`;
        cuch.style.transformOrigin = `${hx * 100}% ${hy * 100}%`;
        migasCv = document.createElement("canvas");
        migasCv.className = "cheese__migas";
        migasG = migasCv.getContext("2d");
        p.plato3.append(platoEl, cvP, pedEl, cuch, migasCv);
        listo = true;
        p.fp.classList.add("jugando");
      });
    }
    // La porción: desde el corte para atrás, con el borde cortado un poco más oscuro (la cara del corte)
    function pintar() {
      gP.globalCompositeOperation = "source-over";
      gP.clearRect(0, 0, W, H);
      gP.drawImage(orig, 0, 0);
      if (corte > ini) {
        gP.clearRect(0, 0, Math.ceil(corte), H);
        const cara = W * 0.035, gr = gP.createLinearGradient(corte, 0, corte + cara, 0);
        gr.addColorStop(0, "rgba(96,52,14,.42)"); gr.addColorStop(0.35, "rgba(96,52,14,.16)"); gr.addColorStop(1, "rgba(96,52,14,0)");
        gP.globalCompositeOperation = "source-atop";
        gP.fillStyle = gr; gP.fillRect(corte, 0, cara, H);
        gP.fillStyle = "rgba(255,248,230,.5)"; gP.fillRect(corte, 0, 1.2, H);        // el filo, con luz
      }
      // La raja mientras la cuchara baja
      if (raja > 0) {
        const X = sigue, y0r = Math.max(0, arriba[Math.round(X)] || 0);
        gP.globalCompositeOperation = "source-atop";
        gP.strokeStyle = "rgba(70,34,6,.55)"; gP.lineWidth = 2;
        gP.beginPath(); gP.moveTo(X, y0r); gP.lineTo(X, raja); gP.stroke();
      }
      gP.globalCompositeOperation = "source-over";
    }
    // El pedazo de la punta: lo que hay entre el corte anterior y el nuevo
    function cortarPedazo(hasta) {
      const a = Math.floor(corte), b = Math.ceil(hasta);
      let y0p = H, y1p = 0;
      for (let x = a; x <= b && x < W; x++) if (arriba[x] >= 0) { y0p = Math.min(y0p, arriba[x]); y1p = Math.max(y1p, abajo[x]); }
      if (y1p <= y0p) return null;
      const w = Math.max(2, b - a), h = y1p - y0p + 1, c = pedEl;
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      g.clearRect(0, 0, w, h);
      g.drawImage(orig, a, y0p, w, h, 0, 0, w, h);
      // la cara del corte, del otro lado del pedazo
      const gr = g.createLinearGradient(w, 0, w - W * 0.03, 0);
      gr.addColorStop(0, "rgba(96,52,14,.4)"); gr.addColorStop(1, "rgba(96,52,14,0)");
      g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
      Object.assign(c.style, { left: `${fx(a) * 100}%`, top: `${fy(y0p) * 100}%`, width: `${(w / W) * cp[2] * 100}%`, height: `${(h / H) * cp[3] * 100}%` });
      c.hidden = false;
      c.style.opacity = 1; c.style.transform = "";
      return { x: a, y: y0p, w, h };
    }
    function migasEn(X, Y, cuantas) {
      if (!MOVIMIENTO) return;
      for (let k = 0; k < cuantas; k++) migas.push({ x: fx(X) * p.w + azar(-5, 5), y: fy(Y) * p.h, vx: azar(-60, 40), vy: azar(-120, -30), r: azar(1.1, 2.6), col: Y > abajo[Math.round(X)] - H * 0.12 ? "#c48a47" : Math.random() < 0.25 ? "#c9243f" : "#f2e4c2", vida: 1, piso: (cq[1] + cq[3] * azar(0.38, 0.62)) * p.h });
    }
    // La cuchara (x, y: el hueco, en fracción del plato; ang: grados)
    function ubicarCuchara() {
      const w = ancC() * p.w, h = w / aspecto;
      Object.assign(cuch.style, { width: `${w}px`, height: `${h}px`, opacity: alfa.toFixed(3) });
      cuch.style.transform = `translate(${(bx * p.w - hx * w).toFixed(1)}px, ${(by * p.h - hy * h).toFixed(1)}px) rotate(${ang.toFixed(1)}deg)`;
    }
    // Dónde queda el hueco para que la punta de la cuchara (de canto) esté en (X, Y) de la porción
    function huecoPara(X, Y, a) {
      const w = ancC() * p.w, r = (a * Math.PI) / 180, lejos = (hx - punta) * w * 0.92;
      return { x: (fx(X) * p.w + Math.cos(r) * lejos) / p.w, y: (fy(Y) * p.h + Math.sin(r) * lejos) / p.h };
    }
    function pintarMigas(dt) {
      const Wm = Math.round(p.w * DPR()), Hm = Math.round(p.h * DPR());
      if (migasCv.width !== Wm || migasCv.height !== Hm) { migasCv.width = Wm; migasCv.height = Hm; }
      migasG.setTransform(1, 0, 0, 1, 0, 0);
      migasG.clearRect(0, 0, Wm, Hm);
      if (!migas.length) return;
      migasG.setTransform(DPR(), 0, 0, DPR(), 0, 0);
      for (let i = migas.length - 1; i >= 0; i--) {
        const m = migas[i];
        if (m.y < m.piso) { m.vy += 900 * dt; m.x += m.vx * dt; m.y += m.vy * dt; }
        else { m.y = m.piso; m.vida -= dt * 0.7; }
        if (m.vida <= 0) { migas.splice(i, 1); continue; }
        migasG.globalAlpha = Math.min(1, m.vida * 2);
        migasG.fillStyle = m.col;
        migasG.beginPath(); migasG.arc(m.x, m.y, m.r, 0, Math.PI * 2); migasG.fill();
      }
      migasG.globalAlpha = 1;
    }
    // Un bocado: a dónde corta esta vez
    function bocado() {
      if (!listo || modo !== "quieta" && modo !== "dedo") return;
      const quedan = BOCADOS - Math.round(((corte - ini) / (fin - ini)) * BOCADOS);
      sigue = quedan <= 1 ? fin + 2 : corte + (fin - ini) / BOCADOS * (corte === ini ? 1.15 : 1);
      modo = "ir"; tiempo = 0; desde = { x: bx, y: by, ang };
    }
    function nuevaPorcion() {
      corte = ini; ped = null; pedEl.hidden = true;
      pintar();
      if (MOVIMIENTO) cvP.animate([{ transform: "translateY(-30%) scale(.94)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 650, easing: "cubic-bezier(.3,1.5,.5,1)" });
    }

    return {
      pista: "Tocá la porción: la cuchara corta un bocado",
      armar() {
        Promise.all([Recorte.cortar(d.porcion.foto, { alfa: d.porcion.alfa }), Recorte.cortar(d.platito.foto, { alfa: d.platito.alfa }), Recorte.cortar(dc.foto, { alfa: dc.alfa })]).then(armarTodo);
      },
      cuadro(t, dt, v) {
        if (!listo || !v.visible) return;
        dt = Math.min(dt, 1 / 30);
        tiempo += dt;
        const X = Math.min(sigue, W - 1), top = arriba[Math.round(Math.min(X, fin))] >= 0 ? arriba[Math.round(Math.min(X, fin))] : H * 0.3;
        const piso = abajo[Math.round(Math.min(X, fin))] >= 0 ? abajo[Math.round(Math.min(X, fin))] : H;
        if (modo === "dedo") {
          const k = 1 - Math.exp(-dt * 20);
          bx += (tap.x - bx) * k; by += (tap.y - by) * k; ang += (-12 - ang) * k;
        } else if (modo === "ir") {
          // Va arriba del lugar del corte, de canto
          const k = suave(Math.min(1, tiempo / 0.3)), meta = huecoPara(X, top - H * 0.1, -78);
          bx = mezcla(desde.x, meta.x, k); by = mezcla(desde.y, meta.y, k); ang = mezcla(desde.ang, -78, k);
          if (k >= 1) { modo = "cortar"; tiempo = 0; raja = top; }
        } else if (modo === "cortar") {
          // Baja derecho y corta (la raja va apareciendo)
          const k = Math.min(1, tiempo / 0.34), y = mezcla(top - H * 0.1, piso + H * 0.02, k * k * (2 - k));
          const meta = huecoPara(X, y, -78); bx = meta.x; by = meta.y; ang = -78;
          const antes = raja; raja = Math.max(raja, Math.min(piso, y));
          if (raja > antes + 2) migasEn(X, raja, Math.random() < 0.5 ? 1 : 0);
          pintar();
          if (k >= 1) {
            ped = cortarPedazo(Math.min(sigue, fin + 1));
            corte = Math.min(sigue, fin + 1); raja = 0; pintar();
            migasEn(X, piso, 4);
            modo = "levantar"; tiempo = 0; desde = { x: bx, y: by, ang };
          }
        } else if (modo === "levantar") {
          // Se acuesta abajo del pedazo, lo levanta y se lo lleva
          const pc = ped ? { x: fx(ped.x + ped.w / 2), y: fy(ped.y + ped.h) } : { x: bx, y: by };
          if (tiempo < 0.24) {
            const k = suave(tiempo / 0.24);
            bx = mezcla(desde.x, pc.x + 0.02, k); by = mezcla(desde.y, pc.y + 0.01, k); ang = mezcla(desde.ang, -8, k);
            if (ped) pedEl.style.transform = `translateX(${(-4 * k).toFixed(1)}px) rotate(${(-5 * k).toFixed(1)}deg)`;
          } else {
            const k = Math.min(1, (tiempo - 0.24) / 0.55), e = k * k;
            bx = pc.x + 0.02 + 0.1 * e; by = pc.y + 0.01 - 0.8 * e; ang = -8 - 22 * e; alfa = 1 - Math.max(0, (k - 0.5) / 0.5);
            if (ped) {
              const dy = (by - (pc.y + 0.01)) * p.h, dx = (bx - (pc.x + 0.02)) * p.w;
              pedEl.style.transform = `translate(${(dx - 4).toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(-5 - 12 * e).toFixed(1)}deg)`;
              pedEl.style.opacity = alfa.toFixed(3);
            }
            if (k >= 1) {
              pedEl.hidden = true; ped = null;
              if (corte >= fin) nuevaPorcion();
              const r = descanso(); bx = r.x; by = r.y + 0.06; ang = r.ang; alfa = 0;
              modo = "volviendo"; tiempo = 0; desde = { x: bx, y: by, ang, aparece: true };
            }
          }
        } else if (modo === "volviendo") {
          const r = descanso(), k = suave(Math.min(1, tiempo / 0.38));
          bx = mezcla(desde.x, r.x, k); by = mezcla(desde.y, r.y, k); ang = mezcla(desde.ang, r.ang, k);
          alfa = desde.aparece ? k : 1;
          if (k >= 1) { modo = "quieta"; alfa = 1; }
        } else if (MOVIMIENTO) {
          const r = descanso(); bx = r.x; by = r.y + Math.sin(t * 2.2) * 0.004; ang = r.ang + Math.sin(t * 1.3) * 1.5;
        }
        ubicarCuchara();
        pintarMigas(dt);
      },
      abajo(e, x, y) {
        if (!listo) return false;
        if (modo !== "quieta") return true;
        x0 = x; y0 = y; movio = false;
        tap = { x: x / p.w, y: (y - 24) / p.h };
        modo = "dedo";
        return true;
      },
      mover(e, x, y) {
        if (modo !== "dedo") return;
        if (!movio && Math.hypot(x - x0, y - y0) > 6) movio = true;
        tap = { x: x / p.w, y: (y - 24) / p.h };
      },
      arriba(e, toque, x, y) {
        if (modo !== "dedo") return;
        const fxx = x / p.w, fyy = y / p.h;
        const sobre = fxx > cp[0] - 0.05 && fxx < cp[0] + cp[2] + 0.05 && fyy > cp[1] - 0.05 && fyy < cq[1] + cq[3];
        if (toque || sobre) bocado();                                           // un toque (o soltarla sobre la porción): un bocado
        else { modo = "volviendo"; tiempo = 0; desde = { x: bx, y: by, ang }; }
      },
      lejos() {},
    };
  }

  const JUEGOS = { servir, flan, helado, cuchara };
  window.Juegos = { crear: (p, d) => (JUEGOS[d.juego] ? JUEGOS[d.juego](p, d) : null) };
})();
