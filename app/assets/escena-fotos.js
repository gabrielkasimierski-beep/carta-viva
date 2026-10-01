/* =============================================================================
   CARTA VIVA — el plato de la foto, con el trato del 3D
   Hace con la foto recortada lo que escena.js hace en la app con el 3D: el plato flota
   en su lugar de la carta, se mueve con el dedo y salta con un toque.
   · Las burgers y los aros dan la vuelta entera de verdad: son los cuadros de un video (el plato
     girando), y el dedo elige cuál se ve (un toque: una vuelta completa).
   · Los postres y las bebidas tienen su juego (juegos.js): servir, temblar, hamacarse, comer.
   · Las pizzas, de dos maneras (las dos con grosor; se elige con el botón de la pizza):
     "video" (la pizza en ángulo, girando con los cuadros de un video) o "3d" (la foto de arriba
     sobre una pizza armada en 3D, pizza3d.js: un toque levanta una porción con el queso).
   · Lo que se ve desde arriba se acuesta como un plato de verdad y gira.
   · "¿Qué tiene?": el plato queda entero y alrededor aparece cada ingrediente, con su foto.
   · "Armala": la burger se rearma con las franjas de su foto (simple, doble, triple; lo que
     se saca se va; panceta y huevo se suman con su propia foto).

   Tiene lo mismo que Escena3D (escena.js), así la carta usa una u otra (local.js: vista):
   EscenaFotos.iniciar({ etiquetas })
   EscenaFotos.vincular(div, plato)       el plato vive en ese div (su lugar en la carta)
   EscenaFotos.explotar(div, si, cambiar) "¿Qué tiene?" (cambiar: lo que cambia la página)
   EscenaFotos.acomodar(div, cambiar)     el lugar cambia de tamaño (armar, volver)
   EscenaFotos.cambiar(div, eleccion)     "Armala": la burger como se eligió (null: la de la foto)
   EscenaFotos.mudar(div, otroDiv)        el plato se va volando a otro lugar (la bienvenida)
   EscenaFotos.presentar(div) · saltar(div, fuerza)   se luce al aparecer · pega un salto
   EscenaFotos.foto(plato) · fotoLista(plato)   el recorte (listas, pedido, panel)
   EscenaFotos.donde(div) · rect(div)     dónde está el plato en pantalla
   EscenaFotos.colorDe(plato)             el color de la foto, si pide otro que el de la carta
   EscenaFotos.cambiarFoto(plato, src)    "Tu foto": la de ese plato, solo en este navegador
   EscenaFotos.variantes(plato) · variante() · usarVariante(v)   las pizzas: "video" o "3d"
   ============================================================================= */
(function () {
  "use strict";
  const MOVIMIENTO = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INCLINACION = 54;           // grados: cuánto se acuestan los platos vistos desde arriba
  const BAJO = 0.64;                // y cuánto de su alto se ve así acostados
  const ESPERA = 520;               // lo que tarda en acomodarse el plato cuando cambia su lugar
  const puestos = new Map();
  const propias = {};               // "Tu foto": { src, tam }
  const recortes = {};              // id del plato → recorte hecho
  let capa = null, pausa = false, reloj = performance.now();
  const topes = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Las pizzas: "video" o "3d" (lo elige el local en local.js: pizzas; en la demo, el botón de la pizza)
  const VARIANTES = ["video", "3d"];
  let variante = (() => {
    const L = window.LOCAL || {};
    if (L.demo) { try { const g = localStorage.getItem("cartaviva.pizzas"); if (VARIANTES.includes(g)) return g; } catch { /* nada */ } }
    return VARIANTES.includes(L.pizzas) ? L.pizzas : "video";
  })();
  const datos = plato => (propias[plato.id] ? { foto: propias[plato.id].src, tam: propias[plato.id].tam, vista: "frente", propia: true, colorPropio: propias[plato.id].colorPropio } : (window.FOTOS || {})[plato.id] || null);
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
      rot: 0, velRot: 0, rotObj: 0, velDedo: 0,                   // inclinación (de costado, sin vuelta entera)
      giro: -20 + Math.random() * 40, velGiro: 0, giroDedo: 0,     // giro de los que se ven desde arriba
      vuelta: 0, velVuelta: 0,                                      // la vuelta entera (grados)
      arrastrando: false, salto: 0, fase: Math.random() * 6, modo: null, w: 0, h: 0, eleccion: null,
    };
    puestos.set(el, p);
    gestos(el);
    medidor.observe(el);
    preparar(p);
  }
  // Si su lugar cambia de tamaño (se abre una hoja, cambia la bienvenida), se reacomoda
  const medidor = new ResizeObserver(cambios => cambios.forEach(c => {
    const p = puestos.get(c.target);
    if (p && (Math.abs(c.target.clientWidth - p.lugarW) > 1 || Math.abs(c.target.clientHeight - p.lugarH) > 1)) ubicar(p);
  }));

  const enCaja = (p, x, y) => [((x - p.caja[0]) / (p.caja[2] - p.caja[0])) * 100, ((y - p.caja[1]) / (p.caja[3] - p.caja[1])) * 100];

  function preparar(p) {
    const d = (p.d = datos(p.plato));
    p.r = null;
    p.bandas = null;
    p.vista = (d && d.vista) || "frente";
    soltarGiro(p);
    p.grosor = !!(d && d.grosor && !d.propia && variante === "3d");
    soltarTres(p);
    p.entera = !!(d && d.giro && !d.propia && !p.grosor);
    p.juego = d && d.juego && !d.propia && window.Juegos ? Juegos.crear(p, d) : null;
    p.presentado = false;
    if (p.pistaJ) { p.pistaJ.remove(); p.pistaJ = null; }
    p.fp.dataset.vista = p.vista;
    p.fp.classList.remove("listo", "con-capas", "girando", "girado", "jugando");
    p.caja = d && !d.propia ? Recorte.caja(d) : null;
    p.aspecto = p.caja ? (p.caja[2] - p.caja[0]) / (p.caja[3] - p.caja[1]) : 1;
    p.redondo = Math.abs(p.aspecto - 1) < 0.12;
    if (p.vista === "arriba" && !p.redondo) p.giro = 0;
    if (p.canto) { p.canto.remove(); p.canto = null; }
    // Mientras se hace el recorte: la foto con el borde esfumado
    let html = "";
    if (p.caja) {
      const [x0, y0, x1, y1] = p.caja, [W, H] = d.tam, cw = x1 - x0, ch = y1 - y0;
      html = `<div class="fp__boceto"><img src="${d.foto}" alt="" draggable="false" style="width:${(W / cw) * 100}%;height:${(H / ch) * 100}%;left:${(-x0 / cw) * 100}%;top:${(-y0 / ch) * 100}%"></div>`;
    }
    p.plato3.innerHTML = html;
    ubicar(p);
    pedirRecorte(p.plato).then(r => {
      if (!r || puestos.get(p.el) !== p || p.d !== d) return;
      armar(p, r);
    });
  }

  function armar(p, r) {
    p.r = r;
    p.caja = r.caja;
    p.aspecto = r.ancho / r.alto;
    const img = `<img src="${r.url}" alt="" draggable="false">`;
    let html = `<div class="fp__entero">${img}</div><div class="fp__capas"></div>`;
    if (p.vista !== "arriba" && !p.entera && !p.juego) html += `<div class="fp__brillo" style="--mascara:url(${r.url})"></div>`;
    const boceto = p.plato3.querySelector(".fp__boceto");
    p.plato3.innerHTML = html;
    if (boceto) { p.plato3.prepend(boceto); setTimeout(() => boceto.remove(), 700); }
    p.brillo = p.plato3.querySelector(".fp__brillo");
    p.capas = p.plato3.querySelector(".fp__capas");
    p.bandas = bandas(p);
    if (p.vista === "arriba") {
      p.canto = document.createElement("div");
      p.canto.className = "fp__canto";
      p.canto.innerHTML = img;
      p.mueve.prepend(p.canto);
    }
    if (p.entera) ponerGiro(p);
    if (p.juego) p.juego.armar(r);
    ubicar(p);
    void p.fp.offsetWidth;                                     // que el cambio se vea como transición
    p.fp.classList.add("listo");
    if (p.eleccion) componer(p.el, p.eleccion);
    if (p.modo === "explotando") ingredientes(p);
  }

  // Las burgers en franjas (curvas que pasan por izquierda, centro y derecha de lo marcado)
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
      return {
        clip: `polygon(${ps.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",")})`,
        arriba: enCaja(p, 0, yA)[1], abajo: enCaja(p, 0, yB)[1], tiene: c.tiene || [],
      };
    });
  }

  /* ---------- Armala: la burger se rearma con las franjas de su foto ---------- */
  const extras = {};                // lo que se suma (panceta, huevo): su recorte
  function extra(id) {
    const s = window.SUMAR && window.SUMAR[id];
    if (!s) return null;
    if (!extras[id]) extras[id] = Recorte.cortar(s.foto, s.alfa ? { alfa: s.alfa } : { auto: true, tolerancia: 40 });
    return extras[id];
  }
  function componer(el, eleccion) {
    const p = puestos.get(el);
    if (!p) return;
    p.eleccion = eleccion || null;
    if (!p.bandas || !p.eleccion) {
      p.fp.classList.remove("con-capas");
      if (p.capas) p.capas.style.transform = "";
      return;
    }
    const B = p.bandas, el_ = p.eleccion;
    const sacadas = new Set(el_.sacale || []), sumadas = new Set(el_.sumale || []);
    const meds = B.map((b, i) => (b.tiene.includes("medallon") ? i : -1)).filter(i => i >= 0);
    const quiero = el_.medallones || meds.length;
    const piezas = [];               // de arriba hacia abajo
    let antesDelPrimero = true, cheddarExtra = false;
    B.forEach((b, i) => {
      if (b.tiene.length && !b.tiene.includes("medallon") && b.tiene.every(t => sacadas.has(t))) return;
      if (b.tiene.includes("medallon")) {
        if (antesDelPrimero) {
          if (sumadas.has("huevo")) piezas.push({ clave: "x-huevo", extra: "huevo" });
          if (sumadas.has("bacon")) piezas.push({ clave: "x-bacon", extra: "bacon" });
          antesDelPrimero = false;
        }
        const k = meds.indexOf(i);
        if (k < quiero) piezas.push({ clave: `b${i}`, banda: i });
        if (k === meds.length - 1) for (let c = meds.length; c < quiero; c++) piezas.push({ clave: `b${i}-${c}`, banda: i });
        return;
      }
      piezas.push({ clave: `b${i}`, banda: i });
      if (sumadas.has("cheddar") && !cheddarExtra && b.tiene.includes("cheddar")) { cheddarExtra = true; piezas.push({ clave: "x-cheddar", banda: i }); }
    });
    // Se apilan desde abajo: el pan de abajo queda donde está y lo demás se acomoda arriba
    const fondo = B[B.length - 1].abajo, techoFoto = B[0].arriba;
    let cursor = fondo;
    for (let k = piezas.length - 1; k >= 0; k--) {
      const q = piezas[k];
      const alto = q.extra ? (window.SUMAR[q.extra].alto || 0.07) * 100 : B[q.banda].abajo - B[q.banda].arriba;
      q.arriba = cursor - alto;
      q.alto = alto;
      cursor = q.arriba;
    }
    const escala = Math.min(1, (fondo - techoFoto) / (fondo - cursor));
    p.capas.style.transformOrigin = `50% ${fondo}%`;
    p.capas.style.transform = `scale(${escala.toFixed(4)})`;
    // Las piezas: las que siguen se mueven, las nuevas caen, las que se fueron se esfuman
    const viejas = new Map([...p.capas.children].map(e => [e.dataset.clave, e]));
    piezas.forEach((q, k) => {
      let e = viejas.get(q.clave);
      viejas.delete(q.clave);
      const nueva = !e;
      if (nueva) {
        e = document.createElement("div");
        e.dataset.clave = q.clave;
        if (q.extra) {
          e.className = "fp__extra";
          extra(q.extra).then(r => {
            if (!r) return;
            const [u0, v0, u1, v1] = r.util;
            e.innerHTML = `<img src="${r.url}" alt="" style="width:${100 / (u1 - u0)}%;height:${100 / (v1 - v0)}%;left:${(-u0 / (u1 - u0)) * 100}%;top:${(-v0 / (v1 - v0)) * 100}%">`;
          });
        } else {
          e.className = "fp__capa";
          e.style.clipPath = B[q.banda].clip;
          e.innerHTML = `<img src="${p.r.url}" alt="" draggable="false">`;
        }
      }
      e.style.zIndex = q.extra ? 2 : 1;
      if (q.extra) Object.assign(e.style, { top: `${q.arriba}%`, height: `${q.alto}%` });
      else e.style.transform = `translateY(${(((q.arriba - B[q.banda].arriba) / 100) * p.h).toFixed(1)}px)`;
      p.capas.appendChild(e);
      if (nueva && MOVIMIENTO) e.animate([{ opacity: 0, translate: `0 -${(p.h * 0.12).toFixed(0)}px` }, { opacity: 1, translate: "0 0" }], { duration: 420, easing: "cubic-bezier(.3,1.4,.5,1)" });
    });
    viejas.forEach(e => { e.style.opacity = "0"; setTimeout(() => e.remove(), 260); });
    p.fp.classList.add("con-capas");
  }

  /* ---------- Dónde va y de qué tamaño (como el 3D: ocupa todo su lugar) ---------- */
  function ubicar(p) {
    const W = p.el.clientWidth, H = p.el.clientHeight;
    if (!W || !H) return;
    p.lugarW = W;
    p.lugarH = H;
    const angosto = innerWidth < 640;
    const a = p.aspecto, bajo = p.vista === "arriba" ? BAJO : 1;
    const maximo = p.r ? p.r.ancho * 1.3 : Infinity;              // que no se agrande más de lo que da la foto
    let w;
    if (p.modo === "explotando") {
      // Queda entero, más chico, en el medio: alrededor van los ingredientes
      w = Math.min(W * (angosto ? 0.5 : 0.36), (H * (angosto ? 0.42 : 0.5) * a) / bajo, maximo);
    } else {
      // (la pizza 3D se dibuja más grande que su caja: en el celu, más chica para que entre entera)
      w = Math.min(W * (angosto ? (p.grosor ? 0.92 : 1.12) : 1), (H * 0.97 * a) / bajo, maximo);
    }
    const h = w / a;
    p.w = w;
    p.h = h;
    Object.assign(p.fp.style, { left: `${W / 2 - w / 2}px`, top: `${H / 2 - h / 2}px`, width: `${w}px`, height: `${h}px` });
    if (p.eleccion && p.bandas) componer(p.el, p.eleccion);
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

  /* ---------- ¿Qué tiene?: el plato entero y alrededor, cada ingrediente con su foto ---------- */
  function explotar(el, si, cambiar) {
    const p = puestos.get(el);
    if (!p) { if (cambiar) cambiar(); return; }
    p.modo = si ? "explotando" : null;
    quitarEtiquetas(p);
    quitarPista(p);
    // Las pizzas se quedan quietas mientras se mira qué tienen (la de video, de frente)
    if (p.tres) p.tres.posar(si);
    if (si && conVuelta(p)) { p.metaVuelta = Math.round(p.vuelta / 360) * 360; p.rigidez = 14; }
    mudarse(p, cambiar);
    if (si) { p.salto = 0.7; ingredientes(p); }
  }
  function ingredientes(p) {
    quitarEtiquetas(p);
    const f = window.FOTOS[p.plato.id] || {}, lista = f.lleva || [];
    if (!lista.length) return;
    const er = p.el.getBoundingClientRect(), angosto = innerWidth < 640;
    const D = angosto ? 66 : 94, n = lista.length;
    const cx = er.left + er.width / 2, cy = er.top + er.height / 2;
    const mitad = Math.max(D / 2, angosto ? 58 : 84);                // la foto o el nombre, lo que sea más ancho
    const rx = er.width / 2 - mitad - (angosto ? 4 : 30), ry = er.height / 2 - D / 2 - 24;
    const inicio = -90 + 180 / n;
    p.etqs = lista.map(([id, nombre], k) => {
      const ang = ((inicio + (360 / n) * k) * Math.PI) / 180;
      const x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry;
      const e = document.createElement("div");
      e.className = "ingrediente";
      e.style.setProperty("--k", k);
      e.innerHTML = `<span class="ingrediente__cuerpo"><span class="ingrediente__foto" style="width:${D}px;height:${D}px;background-image:url(${window.INGREDIENTES[id] || ""})"></span><b>${esc(nombre)}</b></span>`;
      e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      capa.appendChild(e);
      if (MOVIMIENTO) e.animate([{ transform: `translate(${cx}px, ${cy}px) scale(.15)`, opacity: 0 }, { transform: e.style.transform, opacity: 1 }],
        { duration: 620, delay: 120 + k * 75, easing: "cubic-bezier(.25,1.35,.5,1)", fill: "backwards" });
      return e;
    });
  }
  function quitarEtiquetas(p) {
    if (!p.etqs) return;
    const viejas = p.etqs;
    p.etqs = null;
    viejas.forEach(e => e.classList.add("fuera"));
    setTimeout(() => viejas.forEach(e => e.remove()), MOVIMIENTO ? 240 : 0);
  }

  /* ---------- La vuelta entera: los cuadros del video (el plato girando) ----------
     Se cargan cuando el plato está cerca y se sueltan cuando queda lejos. En 0° se ve la foto (más
     nítida); girando, el cuadro que toca (mezclado con el vecino, para que no salte). */
  function pedirGiro(p) {
    if (p.giroPedido || !p.entera) return;
    const yo = (p.giroPedido = {});
    Cuadros.pedir(p.d.giro).then(a => {
      if (p.giroPedido !== yo) { if (a) Cuadros.soltar(p.d.giro); return; }
      p.atlas = a;
      ponerGiro(p);
    });
  }
  /* ---------- La pizza con grosor (3D con la foto de arriba): se arma cuando está cerca ---------- */
  let pizza3D = null;
  // pizza3d.js va dormido en la página (necesita Three.js): se despierta la primera vez
  function cargarPizza3D() {
    return (pizza3D ||= new Promise(listo => {
      if (window.Pizza3D) return listo(window.Pizza3D);
      document.querySelectorAll("script[data-pizza3d]").forEach(s => {
        const n = document.createElement("script");
        n.type = "module";
        if (s.src) n.src = s.src; else n.textContent = s.textContent;
        n.onerror = () => listo(null);
        document.head.appendChild(n);
      });
      const desde = Date.now();
      (function esperar() {
        if (window.Pizza3D) return listo(window.Pizza3D);
        if (Date.now() - desde > 15000) return listo(null);
        setTimeout(esperar, 40);
      })();
    }));
  }
  function pedirTres(p) {
    if (!p.grosor || p.tresPedido || !p.r) return;
    const yo = (p.tresPedido = {});
    cargarPizza3D().then(m => {
      if (!m || p.tresPedido !== yo) return;
      const caja = document.createElement("div");
      caja.className = "fp__tres";
      p.mueve.appendChild(caja);
      const g = p.d.grosor;
      m.crearPizza3D(caja, { foto: g.foto, alfa: g.alfa, desfase: g.desfase, salsa: g.salsa, gestos: false }).then(t => {
        if (p.tresPedido !== yo) { t.destruir(); caja.remove(); return; }
        p.tres = t;
        p.cajaTres = caja;
        p.fp.classList.add("con-grosor");
        if (p.modo === "explotando") t.posar(true);
      }).catch(() => caja.remove());
    });
  }
  function soltarTres(p) {
    p.tresPedido = null;
    if (p.tres) { p.tres.destruir(); p.tres = null; }
    if (p.cajaTres) { p.cajaTres.remove(); p.cajaTres = null; }
    if (p.fp) p.fp.classList.remove("con-grosor");
  }
  function usarVariante(v) {
    if (!VARIANTES.includes(v) || v === variante) return;
    variante = v;
    try { localStorage.setItem("cartaviva.pizzas", v); } catch { /* nada */ }
    for (const p of puestos.values()) if (p.d && p.d.grosor) { soltarGiro(p); preparar(p); p.presentado = false; }
  }

  function soltarGiro(p) {
    if (p.giroPedido && p.d && p.d.giro) Cuadros.soltar(p.d.giro);
    p.giroPedido = null;
    p.atlas = null;
    p.gGiro = null;
    if (p.cvGiro) { p.cvGiro.remove(); p.cvGiro = null; }
    p.fp.classList.remove("girando", "girado");
  }
  // El lienzo del giro, calzado sobre la foto (lo que ocupa el plato en el cuadro 0 = lo que ocupa en la foto)
  function ponerGiro(p) {
    if (!p.atlas || !p.r || !p.plato3.querySelector(".fp__entero")) return;
    if (!p.cvGiro || !p.cvGiro.isConnected) {
      p.cvGiro = document.createElement("canvas");
      p.cvGiro.className = "fp__cuadros";
      p.plato3.appendChild(p.cvGiro);
    }
    const a = p.atlas, [u0, v0, u1, v1] = Cuadros.util(a, 0), [s0, t0, s1, t1] = p.r.util;
    const W = (s1 - s0) / (u1 - u0), H = (t1 - t0) / (v1 - v0);
    Object.assign(p.cvGiro.style, { left: `${(s0 - u0 * W) * 100}%`, top: `${(t0 - v0 * H) * 100}%`, width: `${W * 100}%`, height: `${H * 100}%` });
    p.cvGiro.width = a.tam[0]; p.cvGiro.height = a.tam[1];
    p.gGiro = p.cvGiro.getContext("2d");
    p.pintadoGiro = null;
  }
  function dibujarGiro(p, grados) {
    if (!p.gGiro) return;
    const a = p.atlas, f = ((grados * (p.d.giro.sentido || 1)) / 360) * a.n;
    if (p.pintadoGiro !== null && Math.abs(f - p.pintadoGiro) < 0.02) return;
    Cuadros.dibujar(p.gGiro, a, f, p.cvGiro.width, p.cvGiro.height, true);
    p.pintadoGiro = f;
  }

  /* ---------- Con el dedo: vuelta entera, giro o inclinación; un toque, salta ---------- */
  function gestos(el) {
    if (el._gestos) return;
    el._gestos = true;
    let x0 = 0, xIni = 0, t0 = 0, recorrido = 0, dedo = null, p = null, jugando = false;
    const enPlato = e => { const r = p.fp.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.addEventListener("pointerdown", e => {
      p = puestos.get(el);
      if (!p || e.target.closest("button, a, input")) return;
      dedo = e.pointerId;
      x0 = xIni = e.clientX;
      t0 = performance.now();
      recorrido = 0;
      jugando = !!(p.juego && p.juego.abajo(e, ...enPlato(e)));
      if (jugando) { quitarPista(p); if (e.pointerType === "mouse") el.setPointerCapture(dedo); return; }
      if (p.tres) p.tres.agarrar();
      p.arrastrando = true;
      p.velDedo = 0;
      if (e.pointerType === "mouse") el.setPointerCapture(dedo);
    });
    el.addEventListener("pointermove", e => {
      if (!p || e.pointerId !== dedo || (!p.arrastrando && !jugando)) return;
      const dx = e.clientX - x0, ahora = performance.now(), dt = Math.max(8, ahora - t0) / 1000;
      if (jugando) {
        x0 = e.clientX; t0 = ahora; recorrido += Math.abs(dx);
        p.juego.mover(e, ...enPlato(e), dx);
        if (recorrido > 12) el.dispatchEvent(new CustomEvent("escena:giro", { bubbles: true }));
        return;
      }
      x0 = e.clientX;
      t0 = ahora;
      recorrido += Math.abs(dx);
      if (p.tres) p.tres.arrastrar(dx, dt);
      else if (conVuelta(p)) {
        p.vuelta += dx * 0.55;
        p.velVuelta += (topes((dx * 0.55) / dt, -1300, 1300) - p.velVuelta) * 0.5;
        p.metaVuelta = null; p.quieto = 0;
      } else if (p.vista === "arriba" && p.redondo) {
        p.giro += dx * 0.5;
        p.velGiro = topes((dx * 0.5) / dt, -720, 720);
      } else if (p.vista === "arriba") {
        p.giroDedo = topes((e.clientX - xIni) * 0.35, -40, 40);
      } else {
        p.rotObj = topes((e.clientX - xIni) * 0.28, -34, 34);
        p.velDedo = dx / dt;
      }
      if (recorrido > 12) { el.dispatchEvent(new CustomEvent("escena:giro", { bubbles: true })); quitarPista(p); }
    });
    const fin = e => {
      if (!p || e.pointerId !== dedo) return;
      dedo = null;
      if (jugando) {
        jugando = false;
        const toque = e.type === "pointerup" && recorrido < 6;
        p.juego.arriba(e, toque, ...enPlato(e));
        if (toque) el.dispatchEvent(new CustomEvent("escena:toque", { bubbles: true }));
        return;
      }
      p.arrastrando = false;
      const quieto = performance.now() - t0 > 120;
      if (p.tres) {
        const toque = e.type === "pointerup" && recorrido < 6;
        p.tres.soltar(quieto);
        if (toque) { p.tres.tocar(); quitarPista(p); el.dispatchEvent(new CustomEvent("escena:toque", { bubbles: true })); }
        return;
      }
      if (conVuelta(p)) { if (quieto) p.velVuelta = 0; }
      else if (p.vista === "arriba") { if (quieto) p.velGiro *= 0.3; }
      else { p.rotObj = 0; p.velRot += topes(p.velDedo * 0.06, -160, 160); }
      if (e.type === "pointerup" && recorrido < 6) {
        p.salto = 1;
        if (conVuelta(p)) vueltaEntera(p, p.velVuelta >= 0 ? 1 : -1, 16);     // un toque: una vuelta entera
        else if (p.vista === "arriba") p.velGiro += p.redondo ? 220 : 90;
        else p.velRot += 140;
        el.dispatchEvent(new CustomEvent("escena:toque", { bubbles: true }));
      }
    };
    el.addEventListener("pointerup", fin);
    el.addEventListener("pointercancel", fin);
  }
  const conVuelta = p => p.entera && p.r && p.atlas && !p.eleccion;
  // Una vuelta justa, suave (rigidez: más, más rápida), hasta quedar de frente otra vez
  function vueltaEntera(p, sentido, rigidez) {
    p.metaVuelta = Math.round(p.vuelta / 360) * 360 + 360 * sentido;
    p.rigidez = rigidez;
  }

  /* ---------- Cada cuadro: flota, gira, salta ---------- */
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    const dt = Math.min(0.05, (ahora - reloj) / 1000);
    reloj = ahora;
    if (document.hidden || pausa) return;
    const t = ahora / 1000, alto = innerHeight;
    for (const p of puestos.values()) {
      const r = p.el.getBoundingClientRect();
      const v = {
        cerca: r.bottom > -alto * 0.6 && r.top < alto * 1.6,             // el de al lado: ya se cargan sus cuadros
        visible: r.bottom > 0 && r.top < alto,
        centrado: Math.abs(r.top + r.height / 2 - alto / 2) < alto * 0.22,
      };
      if (v.cerca) { pedirGiro(p); pedirTres(p); p.lejos = false; }
      else if (r.bottom < -alto * 1.5 || r.top > alto * 2.5) {           // lejos: se sueltan (ocupan memoria)
        if (p.atlas) soltarGiro(p);
        if (p.tresPedido) soltarTres(p);
        if (p.juego && !p.lejos) { p.lejos = true; p.juego.lejos(); }
      }
      if (p.juego && p.r) p.juego.cuadro(t, dt, v);
      if (v.centrado && p.r && !p.presentado && (p.juego || p.atlas || p.tres) && !p.modo) presentar(p);
      if (p.h && r.bottom > -alto * 0.2 && r.top < alto * 1.2) mover(p, t, dt);
    }
  }
  // La primera vez que se ve: la burger da una vuelta sola; en todos, qué se puede hacer
  function presentar(p) {
    p.presentado = true;
    if (p.atlas && MOVIMIENTO && !p.eleccion) vueltaEntera(p, 1, 9);
    const texto = p.juego ? p.juego.pista : p.tres ? "Girala con el dedo · tocala y sacá una porción" : "Girala con el dedo · un toque, una vuelta";
    if (!texto || p.el.querySelector(".pista")) return;
    p.pistaJ = document.createElement("div");
    p.pistaJ.className = "pista pista--juego";
    p.pistaJ.innerHTML = `<svg width="18" height="18" aria-hidden="true"><use href="#${p.juego ? "i-dedo" : "i-giro"}"/></svg>${esc(texto)}`;
    p.el.appendChild(p.pistaJ);
    setTimeout(() => quitarPista(p), 6500);
  }
  function quitarPista(p) {
    const e = p && p.pistaJ;
    if (!e) return;
    p.pistaJ = null;
    e.classList.add("fuera");
    setTimeout(() => e.remove(), 500);
  }
  function mover(p, t, dt) {
    p.salto = Math.max(0, p.salto - dt * 1.9);
    const s = p.salto > 0 ? Math.sin((1 - p.salto) * Math.PI) : 0;
    const flota = MOVIMIENTO ? Math.sin(t * 1.5 + p.fase) * 0.014 * p.h : 0;
    const y = flota - s * 0.15 * p.h;
    if (p.juego || p.grosor) {
      // Los juegos y la pizza 3D se mueven solos: acá, solo que flote
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    } else if (conVuelta(p)) {
      // Suelto: sigue con el envión y frena de a poco, como en un plato giratorio; queda donde lo
      // dejaron y, si nadie lo toca, al rato vuelve solo a quedar de frente (sin rebotar)
      if (!p.arrastrando) {
        if (p.metaVuelta != null) {
          const k = p.rigidez || 7, c = 2 * Math.sqrt(k) * 0.96;
          p.velVuelta += ((p.metaVuelta - p.vuelta) * k - p.velVuelta * c) * dt;
          p.vuelta += p.velVuelta * dt;
          if (Math.abs(p.metaVuelta - p.vuelta) < 0.25 && Math.abs(p.velVuelta) < 4) { p.vuelta = p.metaVuelta; p.velVuelta = 0; p.metaVuelta = null; p.quieto = 0; }
        } else {
          p.velVuelta *= Math.exp(-dt * 1.5);
          p.vuelta += p.velVuelta * dt;
          const frente = Math.round(p.vuelta / 360) * 360;
          if (Math.abs(p.velVuelta) < 10 && Math.abs(frente - p.vuelta) > 0.25) {
            p.quieto = (p.quieto || 0) + dt;
            if (p.quieto > 2.2) { p.metaVuelta = frente; p.rigidez = 6; }
          } else p.quieto = 0;
        }
      }
      // Cerca del frente se ve la foto (más nítida); al girar, se funde con los cuadros del video
      const grados = ((p.vuelta % 360) + 360) % 360, lejos = Math.min(grados, 360 - grados);
      const mezcla = p.gGiro ? topes(lejos / 7, 0, 1) : 0;
      if (mezcla > 0.001) { dibujarGiro(p, p.vuelta); p.cvGiro.style.opacity = mezcla.toFixed(3); }
      p.fp.classList.toggle("girando", mezcla > 0.001);
      p.fp.classList.toggle("girado", mezcla > 0.995);
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${(1 + s * 0.035).toFixed(4)})`;
    } else if (p.vista === "arriba" && !p.redondo) {
      // La fuente ovalada: se hamaca, sigue al dedo y vuelve (como un resorte)
      const obj = p.arrastrando ? p.giroDedo || 0 : MOVIMIENTO ? Math.sin(t * 0.45 + p.fase) * 9 : 0;
      if (p.arrastrando) { p.giro += (obj - p.giro) * (1 - Math.exp(-dt * 16)); p.velGiro = 0; }
      else { p.velGiro += ((obj - p.giro) * 40 - p.velGiro * 7) * dt; p.giro += p.velGiro * dt; }
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      girar(p);
    } else if (p.vista === "arriba") {
      if (!p.arrastrando) {
        const solo = MOVIMIENTO ? 9 : 0;                          // grados por segundo: gira solo, despacito
        p.velGiro += (solo - p.velGiro) * (1 - Math.exp(-dt * 1.3));
        p.giro += p.velGiro * dt;
      }
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      girar(p);
    } else {
      if (p.entera) p.fp.classList.remove("girando", "girado");
      const obj = p.arrastrando ? p.rotObj : MOVIMIENTO ? Math.sin(t * 0.55 + p.fase) * 5 : 0;
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
    const tr = `rotateX(${INCLINACION}deg) rotateZ(${p.giro.toFixed(2)}deg)`;
    p.plato3.style.transform = tr;
    if (p.canto) p.canto.style.transform = `translateY(${(p.w * 0.024).toFixed(1)}px) ${tr}`;
  }

  /* ---------- Lo que usa la carta ---------- */
  let esperaMedida = 0;
  addEventListener("resize", () => {
    cancelAnimationFrame(esperaMedida);
    esperaMedida = requestAnimationFrame(() => {
      for (const p of puestos.values()) {
        ubicar(p);
        if (p.modo === "explotando") ingredientes(p);
      }
    });
  });

  // Pasar el plato de un lugar a otro (la bienvenida lo toma prestado de la carta): va volando
  function mudar(de, a) {
    const p = puestos.get(de);
    if (!p || !a || puestos.has(a)) return false;
    quitarEtiquetas(p);
    quitarPista(p);
    puestos.delete(de);
    medidor.unobserve(de);
    p.el = a;
    puestos.set(a, p);
    gestos(a);
    medidor.observe(a);
    mudarse(p, () => a.appendChild(p.fp));
    return true;
  }
  // Se luce al aparecer (la bienvenida): la burger da una vuelta, el resto pega un salto
  function lucirse(el) {
    const p = puestos.get(el);
    if (!p || !MOVIMIENTO) return;
    p.salto = 1;
    if (p.entera && !p.eleccion) {
      pedirGiro(p);
      p.presentado = true;
      vueltaEntera(p, 1, 9);
    } else if (!p.juego) {
      if (p.vista === "arriba") p.velGiro += 200; else p.velRot += 160;
    }
  }

  window.EscenaFotos = {
    tipo: "fotos",
    iniciar(o) { capa = o.etiquetas; requestAnimationFrame(cuadro); return true; },
    vincular,
    explotar,
    componer,
    cambiar: componer,
    mudar,
    presentar: lucirse,
    tono() {},                                                    // la luz y la sombra salen del CSS
    estilo() {},
    // El color de la foto, si pide otro que el de la carta (o el de "Tu foto")
    variantes: plato => { const d = datos(plato); return d && d.grosor && !d.propia ? VARIANTES : null; },
    variante: () => variante,
    usarVariante,
    colorDe: plato => { const d = datos(plato) || {}; return { color: d.colorPropio || d.color || null, color2: d.colorPropio ? null : d.color2 || null }; },
    acomodar(el, cambiar) {
      const p = puestos.get(el);
      if (p) mudarse(p, cambiar); else if (cambiar) cambiar();
    },
    saltar(el, fuerza = 1) {
      const p = puestos.get(el);
      if (!p || p.juego) return;
      p.salto = Math.max(p.salto, fuerza);
      if (conVuelta(p)) vueltaEntera(p, 1, 12);
      else if (p.vista === "arriba") p.velGiro += 160 * fuerza;
      else p.velRot += 110 * fuerza;
    },
    acostado: plato => { const d = datos(plato); return d && d.vista === "arriba" ? INCLINACION : 0; },
    foto: plato => pedirRecorte(plato).then(r => (r ? r.url : "")),
    fotoLista: plato => (recortes[plato.id] ? recortes[plato.id].url : null),
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
          pedirRecorte(plato).then(r => {
            if (r && r.color && propias[plato.id]) propias[plato.id].colorPropio = r.color;
            listo(r);
          });
        };
        img.onerror = () => listo(null);
        img.src = src;
      });
    },
    pausar(si) { pausa = !!si; },
    _puesto: el => puestos.get(el),                              // para revisar desde la consola
  };
})();
