/* =============================================================================
   CARTA VIVA — la página en capas
   Le da profundidad a la carta sin tocar a los platos. Detrás del plato hay una escena (la
   foto del ambiente de la sección y un video de humo o brasas), delante pasan partículas, y
   cada capa se mueve distinto según una "cámara": el giroscopio del celu, el mouse o, si nadie
   toca nada, una respiración lenta. Al deslizar de un plato al otro la escena se acerca un
   poquito, como un travelling.

   De atrás para adelante (todas dentro de #fondo, salvo "delante"):
     escena     la foto del ambiente (cocina, horno de leña, barra…). Toma los tonos del plato:
                se mezcla con el color del fondo con "luminosity", así cada plato la tiñe distinto
     video      humo, brasas, vapor… sobre negro. Se funde con "screen" (el negro no se ve) y se
                reengancha solo: dos tandas del mismo video se cruzan, así no se nota el corte
     atrás      partículas que pasan detrás del plato (chicas, medio desenfocadas)
     sueltos    los ingredientes sueltos del plato héroe que van detrás del plato (z menor que 1)
     palabra    la palabra gigante de la sección (#palabra)
     [plato]    se inclina un poco con la cámara y su sombra lo sigue
     vapor      el vapor del plato héroe, en video con "screen"
     delante    partículas y ingredientes sueltos (z mayor que 1) que pasan por delante del plato

   EL PLATO HÉROE (local.js, en el plato: heroe: { armado, vapor, satelites }). Es el plato al que se
   le da toda la coreografía:
     armado     las franjas de la burger caen y se ensamblan al llegar, y se desarman al irse (atado
                al deslizado: se va rápido con el dedo y llega despacio, con un rebote). Lo dibuja
                escena-fotos.js (EscenaFotos.armado) con las franjas de "Armala".
     satelites  ingredientes sueltos con fondo transparente que flotan a distinta profundidad,
                desenfocados según qué tan lejos estén del plato, y entran volando con el armado:
                { src, x, y, z, tam, rot, giro } (x, y: lugar en el escenario de 0 a 1; z: menos de
                1 detrás del plato y más de 1 delante; tam: ancho como fracción del escenario)
     vapor      video de vapor sobre negro, por encima del plato

   Qué lleva cada sección se dice en local.js, en categorias[].ambiente:
     { escena: "assets/ambiente/burgers-escena.jpg", video: "assets/ambiente/burgers.mp4",
       videoOpacidad: 0.85, particulas: "brasas" | "harina" | "chispas" | "azucar" | "burbujas" | "polvo" }
   Si falta algo, esa capa simplemente no está (una sección sin video igual tiene partículas).

   Cuida el celu: con "reducir movimiento" o ahorro de datos no hay video ni partículas (queda
   la escena quieta); si los cuadros bajan de ritmo, primero baja las partículas y después el
   video; todo se frena si la pestaña está oculta o si se está en el panel.

   Profundidad.iniciar({ feed, fondo, palabra, platos })   arma las capas (una vez, al arrancar)
   Profundidad.plato(plato, escenario, { luz, sombra })   el plato que se está mirando
   Profundidad.activar(si) · Profundidad.activa()   prender o apagar (la cinta de la demo)
   Profundidad.pedirGiro()   pide permiso para el giroscopio (iPhone lo exige con un toque)
   ============================================================================= */
(function () {
  "use strict";
  const L = window.LOCAL || {};
  const raiz = document.documentElement;
  const REDUCIDO = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const conexion = navigator.connection || {};
  const AHORRO = !!conexion.saveData || /(^|-)2g$/.test(conexion.effectiveType || "");
  const CLAVE = "cartaviva.profundidad";
  const FUNDIDO = 0.9;              // segundos que se cruzan dos tandas del mismo video
  const ALCANCE = 46;               // px que se mueve lo más cercano cuando la cámara va al borde
  const topes = (x, a, b) => Math.max(a, Math.min(b, x));
  const suave = (a, b, x) => { const t = topes((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mezcla = (a, b, f) => { const x = rgb(a), y = rgb(b); return x.map((v, i) => Math.round(v + (y[i] - v) * f)); };

  // Cómo se mueve cada tipo de partícula (tam en px, vel en px/s; sube: 1 sube, -1 cae)
  const TIPOS = {
    brasas:   { color: "#FFA53D", cant: 30, tam: [1.6, 4.2], vel: [14, 34], sube: 1,   vaiven: 16, parpadeo: 7 },
    harina:   { color: "#FFEBC8", cant: 34, tam: [1.4, 4.6], vel: [5, 14],  sube: 0.35, vaiven: 26, parpadeo: 1.5 },
    chispas:  { color: "#FFD36B", cant: 26, tam: [1.5, 4],   vel: [12, 28], sube: 1,   vaiven: 20, parpadeo: 6 },
    azucar:   { color: "#FFF3F7", cant: 32, tam: [1.2, 4],   vel: [6, 16],  sube: -1,  vaiven: 18, parpadeo: 4 },
    burbujas: { color: "#E2F7FF", cant: 20, tam: [2.5, 8],   vel: [16, 38], sube: 1,   vaiven: 12, parpadeo: 0, anillo: true },
    polvo:    { color: "#FFF1DD", cant: 22, tam: [1.4, 4],   vel: [4, 11],  sube: 0.3, vaiven: 20, parpadeo: 1 },
  };

  let listo = false, encendido = true, calidad = 2;     // calidad: 2 todo · 1 menos partículas · 0 sin video ni delante
  let feed = null, fondo = null, palabra = null, platosCarta = [];
  let escena = null, imgs = [], videoCaja = null, vineta = null, atras = null, delante = null;
  let satAtras = null, satDelante = null, vaporCaja = null, titulo = null;
  let ctxA = null, ctxD = null, ancho = 0, alto = 0, dpr = 1;
  let plaza = null, cat = null, tipo = "polvo", luz = "#FF9B45", sombra = "#7A2A10";
  let sprites = [], parts = [], rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let raf = 0, ultimo = 0, lentos = 0, visible = true;
  const cam = { x: 0, y: 0 };                           // -1…1: dónde está la cámara (suavizada)
  const entrada = { x: 0, y: 0, t: -1e9 };              // lo que pide el dedo, el mouse o el giroscopio
  let giro = false, giroBase = null, giroPedido = false;

  const estilo = () => raiz.dataset.estilo || "brasa";
  const usaMovimiento = () => encendido && !REDUCIDO;
  const usaVideo = () => usaMovimiento() && !AHORRO && calidad > 0 && estilo() === "brasa";

  /* ---------- Armado ---------- */
  function iniciar(o) {
    if (listo || L.profundidad === false) return false;
    feed = o.feed; fondo = o.fondo; palabra = o.palabra; platosCarta = o.platos || [];
    let guardado = null;
    try { guardado = localStorage.getItem(CLAVE); } catch { /* nada */ }
    const url = new URLSearchParams(location.search).get("profundidad");
    if (url === "0" || url === "1") encendido = url === "1";
    else if (L.demo && (guardado === "0" || guardado === "1")) encendido = guardado === "1";

    const el = (tag, clase, html) => { const e = document.createElement(tag); e.className = clase; if (html) e.innerHTML = html; e.setAttribute("aria-hidden", "true"); return e; };
    escena = el("div", "prof prof__escena", '<img alt="" draggable="false"><img alt="" draggable="false">');
    imgs = [...escena.querySelectorAll("img")];
    const brillo = el("div", "prof__luz");               // el glow del color del plato, que la escena le saca al fondo
    videoCaja = el("div", "prof prof__video");
    atras = el("canvas", "prof__atras");
    satAtras = el("div", "prof__sat-atras");
    titulo = el("div", "prof__titulo");                   // el nombre del plato héroe, enorme y detrás de él
    vineta = el("div", "prof__vineta");
    delante = el("canvas", "prof__delante");
    satDelante = el("div", "prof__sat-delante");
    vaporCaja = el("div", "prof__vapor");
    // Detrás de la palabra, que es lo primero que había en el fondo
    const primero = fondo.firstChild;
    [escena, brillo, titulo, videoCaja, atras, satAtras, vineta].forEach(e => fondo.insertBefore(e, primero));
    [delante, satDelante, vaporCaja].forEach(e => document.body.appendChild(e));
    ctxA = atras.getContext("2d");
    ctxD = delante.getContext("2d");
    ambiente = hacerBucle(videoCaja);
    vapor = hacerBucle(vaporCaja);
    armarHeroes();

    raiz.dataset.profundidad = encendido ? "1" : "0";
    marcarCinta();
    medir();
    hacerSprites();
    sembrar();

    addEventListener("resize", () => { medir(); sembrar(); heroes.forEach(h => { h.geom = null; h.ancho = 0; }); }, { passive: true });
    addEventListener("pointermove", alPuntero, { passive: true });
    document.addEventListener("visibilitychange", cuidarVista);
    new MutationObserver(() => { hacerSprites(); sembrar(); }).observe(raiz, { attributes: true, attributeFilter: ["data-estilo"] });
    // Se escucha siempre: en Android llega solo y en iPhone llega recién cuando se concede el permiso,
    // que se pide con el primer toque (Safari lo exige con un gesto)
    addEventListener("deviceorientation", alGiro);
    if (typeof (window.DeviceOrientationEvent || {}).requestPermission === "function") addEventListener("click", pedirGiro, { once: true, passive: true });
    setInterval(cuidarVista, 400);

    const cinta = document.getElementById("capas-plato");
    if (cinta) cinta.addEventListener("click", e => {
      const b = e.target.closest("[data-capas]");
      if (b) { activar(b.dataset.capas === "1"); pedirGiro(); }
    });
    listo = true;
    arrancar();
    return true;
  }

  function marcarCinta() {
    document.querySelectorAll("#capas-plato [data-capas]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.capas === "1") === encendido)));
  }
  function activar(si) {
    encendido = !!si;
    raiz.dataset.profundidad = encendido ? "1" : "0";
    try { localStorage.setItem(CLAVE, encendido ? "1" : "0"); } catch { /* nada */ }
    marcarCinta();
    if (!encendido) {
      soltarTodo();
      soltarHeroes();
      parar(); ponerVideo("");
    } else {
      if (plaza) { const c = categoriaDe(cat); ponerEscena(c.escena); ponerVideo(c.video); }
      arrancar();
    }
  }

  function medir() {
    ancho = innerWidth; alto = innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, calidad > 1 ? 1.75 : 1.25);
    [atras, delante].forEach(c => { c.width = Math.round(ancho * dpr); c.height = Math.round(alto * dpr); });
    medirEscenario();
  }
  // Dónde está el lugar de un plato cuando la carta está quieta en él (no importa cuánto se haya deslizado)
  function rectDe(el) {
    const r = el.getBoundingClientRect();
    const seccion = el.closest(".plato");
    const i = seccion ? +seccion.dataset.i : 0;
    const desvio = feed.scrollTop - i * (feed.clientHeight || alto);
    return { x0: r.left, y0: r.top + desvio, x1: r.right, y1: r.bottom + desvio };
  }
  function medirEscenario() {
    rect = !plaza || !plaza.isConnected ? { x0: 0, y0: alto * 0.16, x1: ancho, y1: alto * 0.62 } : rectDe(plaza);
  }

  const categoriaDe = id => ((L.categorias || []).find(c => c.id === id) || {}).ambiente || {};

  /* ---------- El plato que se mira ---------- */
  function plato(p, escenario, colores) {
    if (!listo) return;
    plaza = escenario;
    if (colores) { luz = colores.luz || luz; sombra = colores.sombra || sombra; }
    const amb = categoriaDe(p.categoria);
    const cambio = p.categoria !== cat;
    cat = p.categoria;
    medirEscenario();
    if (cambio) {
      ponerEscena(amb.escena);
      videoCaja.style.setProperty("--prof-video", amb.videoOpacidad == null ? 0.85 : topes(+amb.videoOpacidad, 0, 1));
      escena.style.setProperty("--prof-escena", amb.escenaOpacidad == null ? 0.62 : topes(+amb.escenaOpacidad, 0, 1));
      ponerVideo(amb.video);
      tipo = TIPOS[amb.particulas] ? amb.particulas : "polvo";
    }
    hacerSprites();
    if (cambio) sembrar();
  }

  /* ---------- Escena (foto) ---------- */
  let imgVivo = 0;
  function ponerEscena(src) {
    if (!src) { imgs.forEach(i => i.classList.remove("on")); return; }
    if (imgs[imgVivo].dataset.src === src) return;
    const sig = imgs[1 - imgVivo], viejo = imgs[imgVivo];
    sig.dataset.src = src;
    sig.src = src;
    const lista = () => { if (sig.dataset.src !== src) return; sig.classList.add("on"); viejo.classList.remove("on"); imgVivo = 1 - imgVivo; };
    (sig.decode ? sig.decode() : Promise.resolve()).then(lista, lista);
  }

  /* ---------- Videos que se repiten sin que se note el corte ----------
     Dos <video> adentro de una caja: cuando el que suena se acerca al final, el otro arranca desde el
     principio y se funden. Sirve igual para cambiar de video (la escena nueva entra mientras sale la vieja). */
  function hacerBucle(caja) {
    const vids = [];
    let vivo = -1, fuente = "";
    const lanzar = src => {
      if (!vids.length) {
        for (let i = 0; i < 2; i++) {
          const v = document.createElement("video");
          v.muted = v.defaultMuted = true;
          v.playsInline = true;
          v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.setAttribute("aria-hidden", "true");
          v.preload = "auto"; v.disablePictureInPicture = true; v.tabIndex = -1;
          // Si por lo que sea llega al final sin que lo cuidemos, arranca de nuevo
          v.addEventListener("ended", () => { if (v === vids[vivo]) { v.currentTime = 0; v.play().catch(() => {}); } });
          caja.appendChild(v);
          vids.push(v);
        }
      }
      const viejo = vivo >= 0 ? vids[vivo] : null;
      const sig = vids[vivo === 0 ? 1 : 0];
      if (sig.getAttribute("src") !== src) sig.src = src;
      try { sig.currentTime = 0; } catch { /* todavía no cargó */ }
      const pr = sig.play();
      if (pr && pr.catch) pr.catch(() => {});
      sig.classList.add("on");
      if (viejo) viejo.classList.remove("on");
      vivo = vivo === 0 ? 1 : 0;
      fuente = src;
    };
    return {
      vids,
      poner(src) {
        if (!src) { vids.forEach(v => v.classList.remove("on")); fuente = ""; return; }
        if (src !== fuente) lanzar(src);
      },
      cuidar() {
        if (vivo < 0 || !fuente) return;
        const v = vids[vivo];
        if (v.duration && v.currentTime > v.duration - FUNDIDO) lanzar(fuente);
      },
      pausar() { vids.forEach(v => v.pause()); },
      seguir() { if (vivo >= 0 && fuente) vids[vivo].play().catch(() => {}); },
      fuente: () => fuente,
    };
  }
  let ambiente = null, vapor = null;
  function ponerVideo(src) { if (ambiente) ambiente.poner(src && usaVideo() ? src : ""); }

  /* ---------- Partículas ---------- */
  function hacerSprites() {
    const T = TIPOS[tipo] || TIPOS.polvo;
    const claro = estilo() === "estudio";
    const [r, g, b] = claro ? rgb(sombra) : mezcla(T.color, luz, 0.38);
    const rgba = a => `rgba(${r},${g},${b},${a})`;
    sprites = [0, 1, 2, 3].map(n => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d"), m = 32;
      if (T.anillo) {                                   // burbuja: aro finito, un brillo y casi nada de relleno
        x.beginPath(); x.arc(m, m, m * 0.62, 0, 6.2832); x.fillStyle = rgba(0.1); x.fill();
        x.lineWidth = 2.2 + n * 0.9; x.strokeStyle = rgba(0.8 - n * 0.14); x.stroke();
        x.beginPath(); x.arc(m * 0.72, m * 0.68, m * 0.13, 0, 6.2832); x.fillStyle = "rgba(255,255,255,.9)"; x.fill();
      } else {                                          // punto de luz: más duro de cerca del foco, más suave lejos
        const dureza = [0.5, 0.34, 0.2, 0.08][n];
        const gr = x.createRadialGradient(m, m, 0, m, m, m);
        gr.addColorStop(0, rgba(1));
        gr.addColorStop(dureza, rgba(0.6));
        gr.addColorStop(Math.min(1, dureza + 0.34), rgba(0.16));
        gr.addColorStop(1, rgba(0));
        x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      }
      return c;
    });
  }

  function nueva(T, alAzar) {
    const delanteSi = calidad > 0 && Math.random() < 0.34;
    const z = delanteSi ? rnd(1.15, 2.1) : rnd(0.3, 0.95);
    const d = delanteSi ? rect : { x0: 0, y0: 0, x1: ancho, y1: alto };
    const y = alAzar ? rnd(d.y0, d.y1) : (T.sube > 0 ? d.y1 + 12 : d.y0 - 12);
    return { z, delante: delanteSi, x: rnd(d.x0, d.x1), y, tam: rnd(T.tam[0], T.tam[1]), vel: rnd(T.vel[0], T.vel[1]), fase: rnd(0, 6.28), fr: rnd(0.6, 1.7), a: rnd(0.45, 1) };
  }
  function sembrar() {
    parts = [];
    if (!usaMovimiento() || !ancho) return;
    const T = TIPOS[tipo] || TIPOS.polvo;
    const area = topes((ancho * alto) / (390 * 800), 0.7, 1.7);
    const n = Math.round(T.cant * area * [0.5, 0.6, 1][calidad]);
    for (let i = 0; i < n; i++) parts.push(nueva(T, true));
  }

  function simular(dt, t) {
    const T = TIPOS[tipo] || TIPOS.polvo;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const k = 0.6 + p.z * 0.6;                        // lo cercano pasa más rápido
      p.y -= T.sube * p.vel * k * dt;
      p.x += Math.sin(p.fase + t * 0.0006 * p.fr) * T.vaiven * k * dt;
      const d = p.delante ? rect : { x0: 0, y0: 0, x1: ancho, y1: alto };
      if (p.y < d.y0 - 14 || p.y > d.y1 + 14 || p.x < d.x0 - 14 || p.x > d.x1 + 14) {
        // Sale por un lado y vuelve a entrar por el otro, en su misma capa
        p.x = rnd(d.x0, d.x1);
        p.y = T.sube > 0 ? d.y1 + 10 : d.y0 - 10;
        p.tam = rnd(T.tam[0], T.tam[1]); p.vel = rnd(T.vel[0], T.vel[1]); p.a = rnd(0.45, 1);
      }
    }
  }

  function pintar(ctx, lado, t, T) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);
    if (!sprites.length) return;
    const claro = estilo() === "estudio";
    ctx.globalCompositeOperation = claro ? "source-over" : "lighter";
    const esDelante = lado === "delante";
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.delante !== esDelante) continue;
      const nivel = topes(Math.round(Math.abs(p.z - 1) * 3.2), 0, 3);
      const tam = p.tam * (0.55 + 0.75 * p.z) * (1 + nivel * 0.7) * 3.2;
      const x = p.x - cam.x * ALCANCE * (p.z - 1) * 1.5;
      const y = p.y - cam.y * ALCANCE * (p.z - 1) * 0.9;
      let a = p.a * (1 - nivel * 0.1) * (claro ? 0.5 : 1);
      if (T.parpadeo) a *= 0.66 + 0.34 * Math.sin(p.fase + t * 0.001 * T.parpadeo * p.fr);
      if (esDelante) {                                  // los de adelante se esfuman en los bordes del lugar del plato
        const u = (p.x - rect.x0) / Math.max(1, rect.x1 - rect.x0), v = (p.y - rect.y0) / Math.max(1, rect.y1 - rect.y0);
        const borde = topes(Math.min(u, 1 - u, v, 1 - v) / 0.16, 0, 1);
        a *= borde * 0.8;
      }
      if (a < 0.02) continue;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sprites[nivel], x - tam / 2, y - tam / 2, tam, tam);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- El plato héroe: se arma al llegar, con ingredientes sueltos y vapor ---------- */
  const heroes = new Map();           // índice del plato → { i, p, cfg, k, el, sats, geom, vistoK }
  function armarHeroes() {
    platosCarta.forEach((p, i) => { if (p && p.heroe) heroes.set(i, { i, p, cfg: p.heroe, k: 0, el: null, sats: null, geom: null, ancho: 0 }); });
  }

  function crearSats(h) {
    h.sats = (h.cfg.satelites || []).map(c => {
      const z = c.z == null ? 1.5 : c.z;
      const img = document.createElement("img");
      img.className = "prof__sat";
      img.alt = ""; img.draggable = false;
      img.src = c.src;
      const blur = Math.min(6, Math.abs(z - 1) * 5.5);  // fuera del foco del plato: más lejos de 1, más borroso
      img.style.filter = `drop-shadow(0 ${(6 + z * 4).toFixed(0)}px ${(8 + z * 5).toFixed(0)}px rgba(0,0,0,.38))${blur > 0.5 ? ` blur(${blur.toFixed(1)}px)` : ""}`;
      (z < 1 ? satAtras : satDelante).appendChild(img);
      return { img, c, z, fase: rnd(0, 6.28), fr: rnd(0.75, 1.3), w: 0 };
    });
  }

  // Un ingrediente suelto: flota, se mueve con la cámara según su profundidad y entra volando desde su lado
  function sitiar(h, k, ahora, amp, aire) {
    const W = rect.x1 - rect.x0, H = rect.y1 - rect.y0;
    for (const s of h.sats) {
      const c = s.c;
      const falta = 1 - k;
      const lado = (c.x == null ? 0.5 : c.x) < 0.5 ? -1 : 1;
      const ancho_ = Math.round((c.tam || 0.3) * W);
      if (s.w !== ancho_) { s.w = ancho_; s.img.style.width = ancho_ + "px"; }
      const cx = rect.x0 + (c.x == null ? 0.5 : c.x) * W + lado * W * 0.5 * falta * (0.7 + 0.5 * s.fr) - cam.x * ALCANCE * (s.z - 1) * 1.7 * amp;
      const cy = rect.y0 + (c.y == null ? 0.5 : c.y) * H - cam.y * ALCANCE * 0.8 * (s.z - 1) * amp
        + Math.sin(ahora * 0.0011 * s.fr + s.fase) * 7 * (0.5 + s.z * 0.5) - falta * H * 0.12;
      const rot = (c.rot || 0) + Math.sin(ahora * 0.0006 * s.fr + s.fase) * (c.giro == null ? 8 : c.giro) + lado * falta * 40;
      const esc = 1 + falta * 0.35;
      s.img.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rot.toFixed(2)}deg) scale(${esc.toFixed(3)})`;
      s.img.style.opacity = (suave(0.05, 0.75, k) * aire).toFixed(3);
    }
  }

  let tituloDe = null;
  function heroesCuadro(pos, dt, ahora, amp) {
    const E = window.EscenaFotos;
    if (!heroes.size || !E || !E.armado || window.Escena !== E) return;
    // El héroe más cercano manda el título fantasma (y la palabra de la sección se va, para no apilar letras)
    let cerca = null, dMin = 9;
    heroes.forEach(h => { const d = Math.abs(pos - h.i); if (d < dMin) { dMin = d; cerca = h; } });
    if (cerca && dMin < 0.6) {
      if (tituloDe !== cerca) {
        tituloDe = cerca;
        const n = String(cerca.cfg.titulo || cerca.p.nombre || "");
        titulo.textContent = n.trim().split(/\s+/).join("\n");
      }
      const z = 0.8, k = cerca.k;
      titulo.style.top = Math.round(rect.y0 - (rect.y1 - rect.y0) * 0.05) + "px";
      titulo.style.opacity = (suave(0, 0.85, k) * (1 - suave(0.25, 0.6, dMin)) * 0.95).toFixed(3);
      titulo.style.transform = `translate3d(${(-cam.x * ALCANCE * (z - 1) * amp).toFixed(1)}px, ${((1 - k) * -46 - cam.y * ALCANCE * 0.5 * (z - 1) * amp).toFixed(1)}px, 0)`;
      if (palabra) palabra.style.opacity = "0";
    } else {
      titulo.style.opacity = "0";
      if (palabra) palabra.style.opacity = "";
      tituloDe = null;
    }
    heroes.forEach(h => {
      const d = Math.abs(pos - h.i);
      if (d > 1.05) { apagarHeroe(h); return; }
      const sec = feed.children[h.i];
      if (!sec) return;
      h.el = h.el || sec.querySelector("[data-escenario]");
      if (!h.el) return;
      if (!h.sats && h.cfg.satelites) crearSats(h);
      // Llega despacio (en ~1,4 s se arma, con el pan de abajo primero) y se va rápido (se desarma con el
      // dedo, casi a la par del deslizado)
      const objetivo = 1 - suave(0.02, 0.5, d);
      h.k = objetivo > h.k ? Math.min(objetivo, h.k + dt / 1.4) : Math.max(objetivo, h.k - dt / 0.3);
      // Con una hoja abierta (¿Qué tiene?, Armala, pedido…) no hay nada suelto ni vapor
      const aire = amp;
      let armado = false;
      if (h.cfg.armado) {
        const r = E.armado(h.el, h.k, { x: cam.x * amp, y: cam.y * amp });
        if (r === null) h.k = 0;                         // todavía no hay recorte: que arme cuando esté
        armado = r === true && h.k >= 0.99;
      }
      // Ya armado y quieto un momento, el plato hace lo suyo una vez por llegada (la tapa sube, el queso se estira)
      if (armado && d < 0.05 && amp > 0 && E.abrir && !h.abrio) {
        h.quieto = (h.quieto || 0) + dt;
        if (h.quieto > 0.8 && ahora > (h.proximo || 0)) { h.proximo = ahora + 600; if (E.abrir(h.el)) h.abrio = true; }
      } else if (d > 0.4) { h.abrio = false; h.quieto = 0; }
      else if (!armado) h.quieto = 0;
      if (h.sats) sitiar(h, h.k, ahora, amp, calidad === 0 ? 0 : aire);
      // El vapor sale del plato una vez armado
      if (h.cfg.vapor && usaVideo() && aire > 0 && d < 0.5) vaporDe(h, h.k, ahora, amp);
      else if (vaporDe.dueno === h) { vapor.poner(""); vaporCaja.style.opacity = "0"; }
    });
  }

  function apagarHeroe(h) {
    if (h.sats) h.sats.forEach(s => { s.img.style.opacity = "0"; });
    if (vaporDe.dueno === h) { vaporCaja.style.opacity = "0"; }
    if (h.k !== 0) h.k = 0;
  }

  function vaporDe(h, k, ahora, amp) {
    vaporDe.dueno = h;
    const E = window.EscenaFotos;
    // En la bienvenida el plato está en otro lugar y de otro tamaño: ahí no hay vapor (y se vuelve a medir)
    if (document.body.classList.contains("con-bienvenida")) { h.geom = null; vaporCaja.style.opacity = "0"; return; }
    if (!h.geom && k > 0.9) {                           // dónde está el plato (con el escenario quieto)
      const r = E.rect(h.el), sc = rectDe(h.el), dy = sc.y0 - h.el.getBoundingClientRect().top;
      h.geom = { x: r.left, y: r.top + dy, w: r.width, h: r.height };
    }
    if (!h.geom) return;
    const g = h.geom;
    const w = Math.round(g.w * 0.7), hh = Math.round(g.h * 0.95);
    if (vapor.fuente() !== h.cfg.vapor) vapor.poner(h.cfg.vapor);
    if (h.ancho !== w) { h.ancho = w; vapor.vids.forEach(v => { v.style.width = w + "px"; v.style.height = hh + "px"; }); }
    const x = g.x + g.w / 2 - w / 2 - cam.x * ALCANCE * 0.2 * amp;
    const y = g.y + g.h * 0.2 - hh - cam.y * ALCANCE * 0.1 * amp;        // nace en el pan de arriba y sube
    vapor.vids.forEach(v => { v.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; });
    const abriendo = E.abriendo && E.abriendo(h.el);        // el video de la tapa ya trae su propio vapor
    vaporCaja.style.opacity = (abriendo ? 0 : suave(0.8, 1, k) * (h.cfg.vaporOpacidad == null ? 0.75 : h.cfg.vaporOpacidad)).toFixed(3);
    vapor.cuidar();
  }

  // Si se apaga la profundidad o se frena: los platos vuelven enteros y lo suelto se va
  function soltarHeroes() {
    const E = window.EscenaFotos;
    heroes.forEach(h => {
      if (E && E.armado && h.el && h.cfg.armado) E.armado(h.el, 1, null);
      apagarHeroe(h);
    });
    if (vapor) vapor.poner("");
    if (vaporCaja) vaporCaja.style.opacity = "0";
  }

  /* ---------- La cámara ---------- */
  function alPuntero(e) {
    if (giro && e.pointerType === "touch") return;      // en el celu manda el giroscopio
    entrada.x = topes((e.clientX / (innerWidth || 1) - 0.5) * 2, -1, 1);
    entrada.y = topes((e.clientY / (innerHeight || 1) - 0.5) * 2, -1, 1);
    entrada.t = performance.now();
  }
  function alGiro(e) {
    if (e.gamma == null || e.beta == null) return;
    giro = true;
    // El celu casi nunca está en "cero": lo que vale es hacia dónde lo inclinás desde donde lo estabas mirando
    if (!giroBase) giroBase = { g: e.gamma, b: e.beta };
    giroBase.g += (e.gamma - giroBase.g) * 0.006;
    giroBase.b += (e.beta - giroBase.b) * 0.006;
    entrada.x = topes((e.gamma - giroBase.g) / 20, -1, 1);
    entrada.y = topes((e.beta - giroBase.b) / 20, -1, 1);
    entrada.t = performance.now();
  }
  function pedirGiro() {
    const D = window.DeviceOrientationEvent;
    if (giroPedido || !D || typeof D.requestPermission !== "function") return;
    giroPedido = true;
    D.requestPermission().catch(() => {});             // si lo concede, alGiro (ya escuchando) empieza a recibir
  }

  /* ---------- El ciclo ---------- */
  function cuadro(ahora) {
    raf = requestAnimationFrame(cuadro);
    const dt = topes((ahora - (ultimo || ahora)) / 1000, 0.001, 0.05);
    ultimo = ahora;

    // Si los cuadros se atrasan, primero menos partículas y después sin video
    if (dt > 0.034) lentos++; else lentos = Math.max(0, lentos - 2);
    if (lentos > 70 && calidad > 0) {
      calidad--; lentos = 0;
      raiz.dataset.profCalidad = String(calidad);         // en 0, el CSS saca las capas con mezcla (las más caras)
      medir(); sembrar();
      if (calidad === 0) { ponerVideo(""); vapor.poner(""); }
    }

    // Dónde quiere estar la cámara: lo que pide el dedo, y si hace rato que nadie toca, una respiración lenta
    const quieto = topes((ahora - entrada.t) / 2500, 0, 1);
    const ox = entrada.x + (Math.sin(ahora * 0.00037) * 0.34 + Math.sin(ahora * 0.00011) * 0.2) * quieto;
    const oy = entrada.y + Math.cos(ahora * 0.00029) * 0.22 * quieto;
    const f = 1 - Math.exp(-dt * 5.5);
    cam.x += (ox - cam.x) * f;
    cam.y += (oy - cam.y) * f;

    // Con una hoja abierta (armar, pedido…) los platos se quedan derechos para no marear
    const hoja = document.body.classList.contains("bloqueada");
    const amp = hoja ? 0 : 1;

    // El deslizado: de un plato al otro la escena se acerca y vuelve (es periódico, no se acumula)
    const pos = feed.scrollTop / (feed.clientHeight || 1);
    const tt = pos - Math.floor(pos);
    const viaje = Math.sin(Math.PI * tt);
    const onda = Math.sin(2 * Math.PI * pos);

    capa(escena, 0.35, viaje, onda, amp);
    capa(videoCaja, 0.6, viaje, onda, amp);
    if (palabra) {
      const z = 0.85;
      palabra.style.translate = `${(-cam.x * ALCANCE * (z - 1)).toFixed(1)}px ${(-cam.y * ALCANCE * 0.6 * (z - 1) - onda * 22 * (1 - z)).toFixed(1)}px`;
      palabra.style.scale = (1 + viaje * 0.045 * (1 - z)).toFixed(4);
    }
    inclinar(pos, amp);
    heroesCuadro(pos, dt, ahora, amp);

    if (parts.length) {
      const T = TIPOS[tipo] || TIPOS.polvo;
      simular(dt, ahora);
      pintar(ctxA, "atras", ahora, T);
      pintar(ctxD, "delante", ahora, T);
    }
    ambiente.cuidar();
  }

  // El plato se inclina un poco hacia donde está la cámara y su sombra se corre al otro lado.
  // Se escribe directo en el plato (o los dos, mientras se desliza) y no como variable CSS del feed:
  // una variable heredada que cambia en cada cuadro obliga a recalcular el estilo de toda la carta.
  const lugares = [];
  const lugarDe = i => {
    let c = lugares[i];
    if (!c || !c.fp.isConnected) {
      const seccion = feed.children[i], fp = seccion && seccion.querySelector(".fp");
      c = lugares[i] = fp ? { fp, sombra: fp.querySelector(".fp__sombra") } : null;
    }
    return c;
  };
  let inclinados = new Set();
  function inclinar(pos, amp) {
    const ahora = new Set();
    for (const i of [Math.floor(pos), Math.ceil(pos)]) if (i >= 0 && i < feed.children.length) ahora.add(i);
    const ry = (-cam.x * 4.5 * amp).toFixed(2), rx = (cam.y * 3 * amp).toFixed(2), sx = (-cam.x * amp * 14).toFixed(1);
    ahora.forEach(i => {
      const c = lugarDe(i);
      if (!c) return;
      const he = heroes.get(i);
      const esc = he && he.cfg.escala ? ` scale(${he.cfg.escala})` : "";     // el héroe, algo más chico: deja aire para la tipografía y lo suelto
      c.fp.style.transform = `perspective(1100px) rotateY(${ry}deg) rotateX(${rx}deg)${esc}`;
      if (c.sombra) c.sombra.style.translate = `${sx}px 0`;
    });
    inclinados.forEach(i => { if (!ahora.has(i)) soltar(i); });
    inclinados = ahora;
  }
  function soltar(i) {
    const c = lugares[i];
    if (!c) return;
    c.fp.style.transform = "";
    if (c.sombra) c.sombra.style.translate = "";
  }
  function soltarTodo() { lugares.forEach((_, i) => soltar(i)); inclinados = new Set(); }

  function capa(el, z, viaje, onda, amp) {
    const dx = -cam.x * ALCANCE * (z - 1) * amp;
    const dy = -cam.y * ALCANCE * 0.6 * (z - 1) * amp - onda * 22 * (1 - z);
    const s = 1 + viaje * 0.045 * (1 - z);
    el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
  }

  function arrancar() {
    if (raf || !listo || !encendido || !visible) return;
    ultimo = 0;
    if (usaMovimiento()) { if (!parts.length) sembrar(); raf = requestAnimationFrame(cuadro); }
    ambiente.seguir();
    vapor.seguir();
    if (cat && usaVideo()) { const c = categoriaDe(cat); if (c.video && c.video !== ambiente.fuente()) ponerVideo(c.video); }
  }
  function parar() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    ambiente.pausar(); vapor.pausar();
    if (ctxA) { ctxA.clearRect(0, 0, ancho, alto); ctxD.clearRect(0, 0, ancho, alto); }
    parts = [];
  }
  // No gastar nada si no se ve la carta (pestaña oculta o el panel del local)
  function cuidarVista() {
    const panel = document.getElementById("panel");
    const ahora = !document.hidden && !(panel && !panel.hidden);
    if (ahora === visible) return;
    visible = ahora;
    if (visible) arrancar(); else { if (raf) { cancelAnimationFrame(raf); raf = 0; } ambiente.pausar(); vapor.pausar(); }
  }

  window.Profundidad = { iniciar, plato, activar, activa: () => encendido, pedirGiro };
})();
