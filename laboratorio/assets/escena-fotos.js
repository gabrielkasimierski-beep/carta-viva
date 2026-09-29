/* =============================================================================
   CARTA VIVA · laboratorio — el plato de la foto, con el trato del 3D
   Hace con la foto recortada lo que escena.js hace en la app con el 3D: el plato flota
   en su lugar de la carta, se mueve con el dedo, salta con un toque y con "¿Qué tiene?"
   se abre. Las burgers (fotos de costado) se separan en capas; lo demás muestra cada
   parte con una lupa (la foto de cerca) y su nombre.
   Los platos vistos desde arriba (pizzas, la fuente del helado) se acuestan como un
   plato de verdad y giran con el dedo; los de costado se inclinan.

   EscenaFotos.iniciar({ etiquetas })
   EscenaFotos.vincular(div, plato)       el plato vive en ese div (su lugar en la carta)
   EscenaFotos.explotar(div, si, cambiar) "¿Qué tiene?" (cambiar: lo que cambia la página)
   EscenaFotos.acomodar(div, cambiar)     el lugar cambia de tamaño (armar, volver)
   EscenaFotos.saltar(div, fuerza)        pega un salto
   EscenaFotos.foto(plato)                → Promise<url> del recorte (listas, pedido)
   EscenaFotos.fotoLista(plato)           → url del recorte, si ya está
   EscenaFotos.donde(div) · rect(div)     dónde está el plato en pantalla
   EscenaFotos.cambiarFoto(plato, src)    "Tu foto": la de ese plato, solo en este navegador
   ============================================================================= */
(function () {
  "use strict";
  const MOVIMIENTO = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INCLINACION = 54;           // grados: cuánto se acuestan los platos vistos desde arriba
  const BAJO = 0.64;                // y cuánto de su alto se ve así acostados
  const SEP_MIN = 0.12, SEP_MAX = 0.27;   // separación entre capas al abrir, en altos del plato
  const ESPERA = 520;               // lo que tarda en acomodarse el plato al abrir
  const puestos = new Map();
  const propias = {};               // "Tu foto": { src, tam }
  const recortes = {};              // id del plato → recorte hecho
  let capa = null, lineas = null, pausa = false, reloj = performance.now();
  const topes = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const datos = plato => (propias[plato.id] ? { foto: propias[plato.id].src, tam: propias[plato.id].tam, vista: "frente", propia: true } : window.FOTOS[plato.id] || null);
  function pedirRecorte(plato) {
    const d = datos(plato);
    if (!d) return Promise.resolve(null);
    return Recorte.cortar(d.foto, d.propia ? null : d).then(r => {
      if (r && datos(plato) && datos(plato).foto === d.foto) recortes[plato.id] = r;
      return r;
    });
  }

  /* ---------- El plato en su lugar ---------- */
  function vincular(el, plato) {
    const fp = document.createElement("div");
    fp.className = "fp";
    fp.innerHTML = `<div class="fp__sombra"></div><div class="fp__mueve"><div class="fp__plato"></div></div>`;
    el.appendChild(fp);
    const p = {
      el, plato, fp, d: null, r: null,
      mueve: fp.querySelector(".fp__mueve"), plato3: fp.querySelector(".fp__plato"), sombra: fp.querySelector(".fp__sombra"), brillo: null,
      rot: 0, velRot: 0, rotObj: 0, velDedo: 0,              // inclinación (de costado), en grados
      giro: -20 + Math.random() * 40, velGiro: 0, giroObj: null,   // giro (desde arriba)
      arrastrando: false, salto: 0, fase: Math.random() * 6, modo: null, w: 0, h: 0,
    };
    puestos.set(el, p);
    gestos(el);
    preparar(p);
  }

  // La caja del recorte en % del lugar del plato
  const enCaja = (p, x, y) => [((x - p.caja[0]) / (p.caja[2] - p.caja[0])) * 100, ((y - p.caja[1]) / (p.caja[3] - p.caja[1])) * 100];

  function preparar(p) {
    const d = (p.d = datos(p.plato));
    p.r = null;
    p.vista = (d && d.vista) || "frente";
    p.fp.dataset.vista = p.vista;
    p.fp.classList.remove("listo", "con-capas", "abierto");
    p.caja = d && !d.propia ? Recorte.caja(d) : null;
    p.aspecto = p.caja ? (p.caja[2] - p.caja[0]) / (p.caja[3] - p.caja[1]) : 1;
    p.redondo = Math.abs(p.aspecto - 1) < 0.12;
    if (p.vista === "arriba" && !p.redondo) p.giro = 0;
    // Mientras se hace el recorte: la foto con el borde esfumado
    let html = "";
    if (p.caja) {
      const [x0, y0, x1, y1] = p.caja, [W, H] = d.tam, cw = x1 - x0, ch = y1 - y0;
      html += `<div class="fp__boceto"><img src="${d.foto}" alt="" draggable="false" style="width:${(W / cw) * 100}%;height:${(H / ch) * 100}%;left:${(-x0 / cw) * 100}%;top:${(-y0 / ch) * 100}%"></div>`;
    }
    p.plato3.innerHTML = html + marcas(p);
    ubicar(p);
    pedirRecorte(p.plato).then(r => {
      if (!r || puestos.get(p.el) !== p || p.d !== d) return;
      armar(p, r);
    });
  }
  // Un puntito invisible en cada parte: el navegador dice dónde queda en pantalla (con el plato inclinado y todo)
  const marcas = p => (!p.caja || !p.d.partes ? "" : p.d.partes.map((q, i) => { const [x, y] = enCaja(p, q.x, q.y); return `<i class="fp__marca" data-i="${i}" style="left:${x}%;top:${y}%"></i>`; }).join(""));

  function armar(p, r) {
    p.r = r;
    p.caja = r.caja;
    p.aspecto = r.ancho / r.alto;
    const img = `<img src="${r.url}" alt="" draggable="false">`;
    let html = "";
    html += `<div class="fp__entero">${img}</div>`;
    const capas = bandas(p);
    if (capas) html += `<div class="fp__capas">${capas.map(b => `<div class="fp__capa" style="clip-path:${b.clip}">${img}</div>`).join("")}</div>`;
    if (p.vista !== "arriba") html += `<div class="fp__brillo" style="--mascara:url(${r.url})"></div>`;
    const boceto = p.plato3.querySelector(".fp__boceto");
    p.plato3.innerHTML = html + marcas(p);
    if (boceto) { p.plato3.prepend(boceto); setTimeout(() => boceto.remove(), 700); }
    p.brillo = p.plato3.querySelector(".fp__brillo");
    if (p.canto) p.canto.remove();
    p.canto = null;
    if (p.vista === "arriba") {
      p.canto = document.createElement("div");
      p.canto.className = "fp__canto";
      p.canto.innerHTML = img;
      p.mueve.prepend(p.canto);
    }
    p.capasEl = [...p.plato3.querySelectorAll(".fp__capa")];
    p.centros = capas ? capas.map(b => b.centro) : null;
    ubicar(p);
    void p.fp.offsetWidth;                                     // que el cambio se vea como transición
    p.fp.classList.add("listo");
    if (p.modo === "explotando") abrir(p);
  }

  // Las burgers: franjas entre los cortes marcados (curvas que pasan por izquierda, centro y derecha)
  function bandas(p) {
    const d = p.d;
    if (!d || d.propia || !d.capas) return null;
    const cont = Recorte.contornoDe(d);
    const xs = cont.map(c => c[0]), ys = cont.map(c => c[1]);
    const cx0 = Math.min(...xs), cx1 = Math.max(...xs), arriba = Math.min(...ys), abajo = Math.max(...ys);
    const curva = h => {
      const [a, c, b] = h, m = 2 * c - (a + b) / 2, ps = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, y = (1 - t) * (1 - t) * a + 2 * t * (1 - t) * m + t * t * b;
        const [X, Y] = enCaja(p, cx0 + (cx1 - cx0) * t, y);
        ps.push([i === 0 ? -20 : i === 16 ? 120 : X, Y]);
      }
      return ps;
    };
    const n = d.capas.length;
    return d.capas.map((c, i) => {
      const sup = i ? curva(d.capas[i - 1].hasta) : [[-20, -20], [120, -20]];
      const inf = i < n - 1 ? curva(c.hasta) : [[-20, 120], [120, 120]];
      const ps = sup.concat(inf.slice().reverse());
      const yA = i ? d.capas[i - 1].hasta[1] : arriba, yB = i < n - 1 ? c.hasta[1] : abajo;
      return { clip: `polygon(${ps.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",")})`, centro: enCaja(p, 0, (yA + yB) / 2)[1] };
    });
  }

  /* ---------- Dónde va y de qué tamaño (como el 3D: ocupa todo su lugar) ---------- */
  function ubicar(p) {
    const W = p.el.clientWidth, H = p.el.clientHeight;
    if (!W || !H) return;
    const angosto = innerWidth < 640;
    const a = p.aspecto, bajo = p.vista === "arriba" ? BAJO : 1;
    const maximo = p.r ? p.r.ancho * 1.3 : Infinity;              // que no se agrande más de lo que da la foto
    let w, cx, cy;
    p.sep = 0;
    p.lupaModo = null;
    if (p.modo === "explotando" && p.centros) {
      // Capas: primero el ancho; con el alto que sobra se separan (entre un mínimo y un máximo)
      const n = p.centros.length;
      w = Math.min(W * (angosto ? 0.5 : 0.44), maximo);
      p.sep = topes(((H * 0.86) / (w / a) - 1) / (n - 1), SEP_MIN, SEP_MAX);
      w = Math.min(w, (H * 0.9 * a) / (1 + p.sep * (n - 1)));
      cx = angosto ? W * 0.27 : W / 2;
      cy = H / 2 + ((w / a) * p.sep * (n - 1)) / 2;               // la pila crece para arriba: el plato baja
    } else if (p.modo === "explotando") {
      // Lupas: en el celu, si el plato es ancho va arriba y las lupas abajo; si es alto, las lupas al costado
      p.lupaModo = !angosto ? "lados" : a / bajo >= 0.8 ? "abajo" : "derecha";
      if (p.lupaModo === "abajo") {
        const filas = Math.ceil(cuantasPartes(p) / 4);
        p.lugarAlto = H - filas * (LUPA() + ALTO_TEXTO) - 16;
        w = Math.min(W * 0.92, (p.lugarAlto * 0.94 * a) / bajo, maximo);
        cx = W / 2;
        cy = p.lugarAlto / 2;
      } else {
        w = Math.min(W * (p.lupaModo === "derecha" ? 0.5 : 0.42), (H * 0.9 * a) / bajo, maximo);
        cx = p.lupaModo === "derecha" ? W * 0.28 : W / 2;
        cy = H / 2;
      }
    } else {
      w = Math.min(W * (angosto ? 1.12 : 1), (H * 0.97 * a) / bajo, maximo);
      cx = W / 2;
      cy = H / 2;
    }
    const h = w / a;
    p.w = w;
    p.h = h;
    Object.assign(p.fp.style, { left: `${cx - w / 2}px`, top: `${cy - h / 2}px`, width: `${w}px`, height: `${h}px` });
  }

  // Cambia el lugar: el plato va volando de donde estaba a donde le toca
  function mudarse(p, cambiar) {
    const antes = p.fp.getBoundingClientRect();
    if (cambiar) cambiar();
    ubicar(p);
    const despues = p.fp.getBoundingClientRect();
    if (!MOVIMIENTO || !antes.width || !despues.width) return;
    p.fp.animate(
      [{ transform: `translate(${antes.left - despues.left}px, ${antes.top - despues.top}px) scale(${antes.width / despues.width})` }, { transform: "none" }],
      { duration: ESPERA, easing: "cubic-bezier(.2,.9,.25,1)" },
    );
  }

  /* ---------- ¿Qué tiene? ---------- */
  function explotar(el, si, cambiar) {
    const p = puestos.get(el);
    if (!p) { if (cambiar) cambiar(); return; }
    p.modo = si ? "explotando" : null;
    quitarEtiquetas(p);
    mudarse(p, cambiar);
    if (si) {
      p.giroObj = p.vista === "arriba" && p.redondo ? Math.round(p.giro / 360) * 360 : null;    // vuelve derecho, como en la foto
      if (p.r) abrir(p);
    } else {
      p.giroObj = null;
      p.fp.classList.remove("abierto");
      (p.capasEl || []).forEach(c => { c.style.transform = ""; });
      clearTimeout(p.juntar);
      p.juntar = setTimeout(() => { if (p.modo !== "explotando") p.fp.classList.remove("con-capas"); }, MOVIMIENTO ? 650 : 0);
    }
  }
  function abrir(p) {
    clearTimeout(p.juntar);
    p.fp.classList.add("abierto");
    const id = (p.abriendo = (p.abriendo || 0) + 1);
    if (p.capasEl && p.capasEl.length) {
      p.fp.classList.add("con-capas");
      const n = p.capasEl.length;
      void p.fp.offsetWidth;                                     // juntas primero, y desde ahí se separan
      p.capasEl.forEach((c, i) => {
        c.style.transitionDelay = `${(n - 1 - i) * 0.035}s`;
        c.style.transform = `translateY(${-(n - 1 - i) * p.sep * p.h}px)`;
      });
      setTimeout(() => { if (p.modo === "explotando" && p.abriendo === id) etiquetasCapas(p); }, MOVIMIENTO ? 260 : 0);
    } else {
      quieto(p).then(() => { if (p.modo === "explotando" && p.abriendo === id) lupas(p); });
    }
  }
  // Espera a que el plato termine de acomodarse (y la pizza vuelva derecha) para medir dónde quedó cada parte
  function quieto(p) {
    const listo = Promise.all(p.fp.getAnimations().map(a => a.finished.catch(() => {})));
    const tope = new Promise(r => setTimeout(r, MOVIMIENTO ? ESPERA + 260 : 0));
    return Promise.race([listo.then(() => new Promise(r => setTimeout(r, p.vista === "arriba" && MOVIMIENTO ? 220 : 60))), tope]).then(() => {
      p.fp.getAnimations().forEach(a => a.finish());           // si la pestaña no estaba dibujando, a su lugar de una
      if (p.vista === "arriba") {
        if (p.giroObj != null) p.giro = p.giroObj;
        if (!p.redondo) { p.giro = 0; p.velGiro = 0; }
        p.mueve.style.transform = "translate3d(0, 0, 0)";
        girar(p);
      } else {
        p.rot = 0;
        p.velRot = 0;
        p.mueve.style.transform = "none";
      }
    });
  }
  const cuantasPartes = p => (p.d && p.d.partes && !p.d.propia ? p.d.partes.length : listaDeLaCarta(p.plato).length);
  const listaDeLaCarta = plato => plato.descripcion.split(/,| y |\. /).map(s => s.replace(/\.$/, "").trim()).filter(s => s && s.length < 40).slice(0, 5);
  const LUPA = () => (innerWidth < 640 ? 58 : 78);
  const ALTO_TEXTO = 54;          // lo que ocupa el nombre debajo de cada lupa

  // Las capas: cada una con su nombre al costado (igual que en la app)
  function etiquetasCapas(p) {
    quitarEtiquetas(p);
    const er = p.el.getBoundingClientRect();
    const left = er.left + parseFloat(p.fp.style.left), top = er.top + parseFloat(p.fp.style.top);
    const angosto = innerWidth < 640, n = p.d.capas.length, ancho = innerWidth;
    const lista = p.d.capas.map((c, i) => {
      const d = document.createElement("div");
      const izq = !angosto && i % 2 === 1;
      d.className = "etiqueta " + (izq ? "etiqueta--izq" : "etiqueta--der");
      d.innerHTML = `<span class="etiqueta__linea"></span><span class="etiqueta__texto"><b>${esc(c.nombre)}</b><small>${esc(c.detalle || "")}</small></span>`;
      capa.appendChild(d);
      return { d, izq, i, y: top + (p.centros[i] / 100) * p.h - (n - 1 - i) * p.sep * p.h, h: d.offsetHeight || 30 };
    });
    for (const lado of [true, false]) {
      const col = lista.filter(x => x.izq === lado).sort((a, b) => b.y - a.y);
      for (let k = 1; k < col.length; k++) {
        const minimo = (col[k - 1].h + col[k].h) / 2 + 4;
        if (col[k - 1].y - col[k].y < minimo) col[k].y = col[k - 1].y - minimo;
      }
    }
    lista.forEach(({ d, izq, y, i }) => {
      const x = izq ? Math.max(8, left + p.w * 0.03 - 6) : Math.min(ancho - 60, left + p.w * 0.97 + 6);
      d.style.maxWidth = (izq ? x - 8 : ancho - x - 8) + "px";
      d.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      d.style.transitionDelay = `${(n - 1 - i) * 0.04}s`;
    });
    void capa.offsetWidth;
    lista.forEach(({ d }) => d.classList.add("visible"));
    p.etqs = lista.map(x => x.d);
  }

  // Lo demás: cada parte con su lupa (la foto de cerca), una línea hasta donde está y su nombre.
  //   abajo:   en el celu, con el plato ancho: el plato arriba y las lupas en fila abajo, con el nombre debajo
  //   derecha: en el celu, con el plato alto (un vaso): el plato a la izquierda y las lupas a la derecha
  //   lados:   en la compu: el plato al medio y cada lupa del lado de su parte
  function lupas(p) {
    quitarEtiquetas(p);
    const d = p.d, modo = p.lupaModo || "derecha", D = LUPA();
    const er = p.el.getBoundingClientRect(), caja = p.fp.getBoundingClientRect();
    const els = [];
    let partes;
    if (d && d.partes && !d.propia) {
      const ms = [...p.plato3.querySelectorAll(".fp__marca")];
      partes = d.partes.map((q, i) => { const m = ms[i].getBoundingClientRect(); return { q, x: m.left + m.width / 2, y: m.top + m.height / 2 }; });
    } else {
      // "Tu foto": no se sabe dónde está cada cosa; va la lista de la carta, sin lupas
      const cosas = listaDeLaCarta(p.plato);
      partes = cosas.map((t, k) => ({ q: { nombre: t[0].toUpperCase() + t.slice(1) }, x: null, y: caja.top + (caja.height * (k + 1)) / (cosas.length + 1), orden: k }));
    }
    const conFoto = partes.some(o => o.x != null);

    if (modo === "abajo") {
      // En fila debajo del plato, en el mismo orden que las partes de izquierda a derecha (las líneas no se cruzan)
      const cols = Math.min(4, partes.length), celda = (er.width - 16) / cols;
      const orden = partes.slice().sort((a, b) => (a.x ?? a.orden) - (b.x ?? b.orden));
      orden.forEach((o, k) => {
        const f = Math.floor(k / cols), c = k % cols;
        o.lx = er.left + 8 + (c + 0.5) * celda;
        o.ly = er.top + p.lugarAlto + 10 + f * (D + ALTO_TEXTO);
        o.ancho = celda - 6;
        o.abajo = true;
      });
    } else {
      // En la compu, cada lupa del lado de su parte (mitad y mitad, para que no quede todo de un lado)
      const porX = partes.filter(o => o.x != null).sort((a, b) => a.x - b.x);
      partes.forEach(o => { o.izq = modo === "lados" && o.x != null && porX.indexOf(o) < Math.floor(porX.length / 2); });
      const arriba = er.top + D / 2 + 4, abajo = er.bottom - D / 2 - 4, paso = D + (modo === "lados" ? 18 : 12);
      for (const lado of [true, false]) {
        const col = partes.filter(o => o.izq === lado).sort((a, b) => a.y - b.y);
        col.forEach((o, k) => { o.ly = Math.max(topes(o.y, arriba, abajo), k ? col[k - 1].ly + paso : arriba); });
        for (let k = col.length - 1; k >= 0; k--) {
          const tope = k === col.length - 1 ? abajo : col[k + 1].ly - paso;
          if (col[k].ly > tope) col[k].ly = tope;
        }
      }
      const sep = modo === "lados" ? 34 : 14;
      partes.forEach(o => {
        o.lx = o.izq ? caja.left - sep : caja.right + sep;
        o.ancho = o.izq ? o.lx - 8 : innerWidth - o.lx - 8;
      });
    }

    const [W, H] = d && d.tam ? d.tam : [1, 1];
    lineas.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    partes.forEach((o, k) => {
      const e = document.createElement("div");
      e.className = "lupa" + (o.izq ? " lupa--izq" : "") + (o.abajo ? " lupa--abajo" : "") + (conFoto ? "" : " lupa--sola");
      let foto = "";
      if (o.x != null) {
        const z = D / 2 / o.q.r;
        foto = `<span class="lupa__foto" style="width:${D}px;height:${D}px;background-image:url(${d.foto});background-size:${W * z}px ${H * z}px;background-position:${-(o.q.x * z - D / 2)}px ${-(o.q.y * z - D / 2)}px"></span>`;
      }
      e.innerHTML = `${foto}<span class="etiqueta__texto"><b>${esc(o.q.nombre)}</b>${o.q.detalle ? `<small>${esc(o.q.detalle)}</small>` : ""}</span>`;
      e.style.maxWidth = o.ancho + "px";
      e.style.transform = `translate(${o.lx.toFixed(1)}px, ${o.ly.toFixed(1)}px)`;
      e.style.setProperty("--k", k);
      capa.appendChild(e);
      els.push(e);
      if (o.x == null) return;
      // La lupa sale de su parte del plato y se va a su lugar
      if (MOVIMIENTO) e.animate([{ transform: `translate(${o.x}px, ${o.y}px) scale(.2)`, opacity: 0 }, { transform: e.style.transform, opacity: 1 }],
        { duration: 540, delay: 80 + k * 90, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" });
      const punto = document.createElement("i");
      punto.className = "punto";
      punto.style.transform = `translate(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px)`;
      punto.style.animationDelay = `${k * 0.09}s, ${0.45 + k * 0.09}s`;
      capa.appendChild(punto);
      els.push(punto);
      // La línea, de la parte a su lupa
      let camino;
      if (modo === "abajo") {
        const fx = o.lx, fy = o.ly - 3, my = (o.y + fy) / 2;
        camino = `M${o.x.toFixed(1)} ${o.y.toFixed(1)}C${o.x.toFixed(1)} ${my.toFixed(1)} ${fx.toFixed(1)} ${my.toFixed(1)} ${fx.toFixed(1)} ${fy.toFixed(1)}`;
      } else {
        const fx = o.izq ? o.lx + 3 : o.lx - 3, mx = o.x + (fx - o.x) * 0.55;
        camino = `M${o.x.toFixed(1)} ${o.y.toFixed(1)}C${mx.toFixed(1)} ${o.y.toFixed(1)} ${mx.toFixed(1)} ${o.ly.toFixed(1)} ${fx.toFixed(1)} ${o.ly.toFixed(1)}`;
      }
      const c = document.createElementNS("http://www.w3.org/2000/svg", "path");
      c.setAttribute("d", camino);
      c.style.animationDelay = `${0.3 + k * 0.09}s`;
      lineas.appendChild(c);
      els.push(c);
    });
    p.etqs = els;
  }

  function quitarEtiquetas(p) {
    if (!p.etqs) return;
    const viejas = p.etqs;
    p.etqs = null;
    viejas.forEach(e => { e.classList && e.classList.add("fuera"); });
    setTimeout(() => viejas.forEach(e => e.remove()), MOVIMIENTO ? 220 : 0);
  }

  /* ---------- Con el dedo: de costado se inclina, desde arriba gira; un toque, salta ---------- */
  function gestos(el) {
    let x0 = 0, xIni = 0, t0 = 0, recorrido = 0, dedo = null, p = null;
    el.addEventListener("pointerdown", e => {
      p = puestos.get(el);
      if (!p || p.modo === "explotando" || e.target.closest("button, a, input")) return;
      dedo = e.pointerId;
      x0 = xIni = e.clientX;
      t0 = performance.now();
      recorrido = 0;
      p.arrastrando = true;
      p.velDedo = 0;
      if (e.pointerType === "mouse") el.setPointerCapture(dedo);
    });
    el.addEventListener("pointermove", e => {
      if (!p || e.pointerId !== dedo || !p.arrastrando) return;
      const dx = e.clientX - x0, ahora = performance.now(), dt = Math.max(8, ahora - t0) / 1000;
      x0 = e.clientX;
      t0 = ahora;
      recorrido += Math.abs(dx);
      if (p.vista === "arriba" && p.redondo) {
        p.giro += dx * 0.5;
        p.velGiro = topes((dx * 0.5) / dt, -720, 720);
      } else if (p.vista === "arriba") {
        p.giroDedo = topes((e.clientX - xIni) * 0.35, -40, 40);
      } else {
        p.rotObj = topes((e.clientX - xIni) * 0.28, -34, 34);
        p.velDedo = dx / dt;
      }
      if (recorrido > 12) el.dispatchEvent(new CustomEvent("escena:giro", { bubbles: true }));
    });
    const fin = e => {
      if (!p || e.pointerId !== dedo) return;
      p.arrastrando = false;
      dedo = null;
      if (p.vista === "arriba") { if (performance.now() - t0 > 120) p.velGiro *= 0.3; }
      else { p.rotObj = 0; p.velRot += topes(p.velDedo * 0.06, -160, 160); }
      if (e.type === "pointerup" && recorrido < 6) {
        p.salto = 1;
        if (p.vista === "arriba") p.velGiro += p.redondo ? 220 : 90; else p.velRot += 140;
        el.dispatchEvent(new CustomEvent("escena:toque", { bubbles: true }));
      }
    };
    el.addEventListener("pointerup", fin);
    el.addEventListener("pointercancel", fin);
  }

  /* ---------- Cada cuadro: flota, se hamaca, gira, salta ---------- */
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    const dt = Math.min(0.05, (ahora - reloj) / 1000);
    reloj = ahora;
    if (document.hidden || pausa) return;
    const t = ahora / 1000, alto = innerHeight;
    const vivos = [];
    for (const p of puestos.values()) {
      const r = p.el.getBoundingClientRect();
      if (p.h && r.bottom > -alto * 0.2 && r.top < alto * 1.2) vivos.push(p);
    }
    vivos.forEach(p => mover(p, t, dt));
  }
  function mover(p, t, dt) {
    const abierto = p.modo === "explotando";
    p.salto = Math.max(0, p.salto - dt * 1.9);
    const s = p.salto > 0 ? Math.sin((1 - p.salto) * Math.PI) : 0;
    const flota = MOVIMIENTO && !abierto ? Math.sin(t * 1.5 + p.fase) * 0.014 * p.h : 0;
    const y = flota - s * 0.15 * p.h;
    if (p.vista === "arriba" && !p.redondo) {
      // La fuente ovalada: se hamaca, sigue al dedo y vuelve (como un resorte)
      const obj = p.arrastrando ? p.giroDedo || 0 : MOVIMIENTO && !abierto ? Math.sin(t * 0.45 + p.fase) * 9 : 0;
      if (p.arrastrando) { p.giro += (obj - p.giro) * (1 - Math.exp(-dt * 16)); p.velGiro = 0; }
      else { p.velGiro += ((obj - p.giro) * 40 - p.velGiro * 7) * dt; p.giro += p.velGiro * dt; }
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      girar(p);
    } else if (p.vista === "arriba") {
      if (p.giroObj != null) { p.giro += (p.giroObj - p.giro) * (1 - Math.exp(-dt * 7)); p.velGiro = 0; }
      else if (!p.arrastrando) {
        const solo = MOVIMIENTO ? 9 : 0;                          // grados por segundo: gira solo, despacito
        p.velGiro += (solo - p.velGiro) * (1 - Math.exp(-dt * 1.3));
        p.giro += p.velGiro * dt;
      }
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      girar(p);
    } else {
      const obj = p.arrastrando ? p.rotObj : MOVIMIENTO && !abierto ? Math.sin(t * 0.55 + p.fase) * 5 : 0;
      if (p.arrastrando) { p.rot += (obj - p.rot) * (1 - Math.exp(-dt * 16)); p.velRot = 0; }
      else { p.velRot += ((obj - p.rot) * 55 - p.velRot * 8) * dt; p.rot += p.velRot * dt; }
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotateY(${p.rot.toFixed(2)}deg) scale(${(1 + s * 0.035).toFixed(4)})`;
      if (p.brillo) {
        p.brillo.style.setProperty("--bx", `${(50 - p.rot * 2.4).toFixed(1)}%`);
        p.brillo.style.opacity = (Math.min(1, Math.abs(p.rot) / 16) * 0.85).toFixed(3);
      }
    }
    p.sombra.style.transform = `scale(${(1 - s * 0.3).toFixed(3)})`;
    p.sombra.style.opacity = (1 - s * 0.55).toFixed(3);
  }

  // Acostado y girado; el canto (una copia oscura) un poco más abajo en la pantalla
  function girar(p) {
    const t = `rotateX(${INCLINACION}deg) rotateZ(${p.giro.toFixed(2)}deg)`;
    p.plato3.style.transform = t;
    if (p.canto) p.canto.style.transform = `translateY(${(p.w * 0.024).toFixed(1)}px) ${t}`;
  }

  /* ---------- Lo que usa la carta ---------- */
  let esperaMedida = 0;
  addEventListener("resize", () => {
    cancelAnimationFrame(esperaMedida);
    esperaMedida = requestAnimationFrame(() => {
      for (const p of puestos.values()) {
        ubicar(p);
        if (p.modo === "explotando" && p.r) {
          if (p.capasEl && p.capasEl.length) { p.capasEl.forEach((c, i) => { c.style.transform = `translateY(${-(p.capasEl.length - 1 - i) * p.sep * p.h}px)`; }); etiquetasCapas(p); }
          else lupas(p);
        }
      }
    });
  });

  window.EscenaFotos = {
    iniciar(o) {
      capa = o.etiquetas;
      lineas = capa.querySelector(".lupas-lineas");
      requestAnimationFrame(cuadro);
    },
    vincular,
    explotar,
    acomodar(el, cambiar) {
      const p = puestos.get(el);
      if (p) mudarse(p, cambiar); else if (cambiar) cambiar();
    },
    saltar(el, fuerza = 1) {
      const p = puestos.get(el);
      if (!p) return;
      p.salto = Math.max(p.salto, fuerza);
      if (p.vista === "arriba") p.velGiro += 160 * fuerza; else p.velRot += 110 * fuerza;
    },
    tieneCapas: plato => { const d = datos(plato); return !!(d && !d.propia && d.capas); },
    acostado: plato => { const d = datos(plato); return d && d.vista === "arriba" ? INCLINACION : 0; },
    foto: plato => pedirRecorte(plato).then(r => (r ? r.url : "")),
    fotoLista: plato => (recortes[plato.id] ? recortes[plato.id].url : null),
    colorLista: plato => (recortes[plato.id] ? recortes[plato.id].color : null),
    rect(el) { const p = puestos.get(el); return p ? p.fp.getBoundingClientRect() : el.getBoundingClientRect(); },
    donde(el) {
      const r = this.rect(el);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.min(r.width, r.height) / 2 };
    },
    ocultar(el, si) { const p = puestos.get(el); if (p) p.fp.style.visibility = si ? "hidden" : ""; },
    // "Tu foto": se recorta como un óvalo (no se sabe dónde está el plato en la foto)
    cambiarFoto(plato, src) {
      return new Promise(listo => {
        const img = new Image();
        img.onload = () => {
          propias[plato.id] = { src, tam: [img.naturalWidth, img.naturalHeight] };
          delete recortes[plato.id];
          for (const p of puestos.values()) if (p.plato === plato) { p.caja = null; preparar(p); }
          pedirRecorte(plato).then(listo);
        };
        img.onerror = () => listo(null);
        img.src = src;
      });
    },
    pausar(si) { pausa = !!si; },
  };
})();
