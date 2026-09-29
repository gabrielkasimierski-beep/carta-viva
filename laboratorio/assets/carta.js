/* =============================================================================
   CARTA VIVA · laboratorio — la carta de la app, con fotos reales
   Es la carta del comensal de app/assets/app.js: una pantalla por plato con su color,
   las secciones arriba, "¿Qué tiene?", "Armala", "Agregar" y "Toda la carta", y los
   tres estilos (Brasa, Jugo, Estudio). La diferencia: el plato es la foto recortada
   (escena-fotos.js) en lugar del 3D.
   Solo la carta: el pedido no se manda, no hay mesa, mozo ni seguimiento.
   ============================================================================= */
(function () {
  "use strict";
  const L = window.LOCAL, E = window.EscenaFotos;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const raiz = document.documentElement;
  const MOVIMIENTO = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const plata = n => "$" + Math.round(n).toLocaleString("es-AR");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const platos = L.categorias.flatMap(c => L.platos.filter(p => p.categoria === c.id));
  const porId = id => L.platos.find(p => p.id === id);
  const categoria = id => L.categorias.find(c => c.id === id);

  /* ---------- Color: el color de cada plato, llevado a cada estilo (igual que en la app) ---------- */
  const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hexDe = v => "#" + v.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
  const mezclar = (a, b, f) => { const x = rgb(a), y = rgb(b); return hexDe(x.map((v, i) => v + (y[i] - v) * f)); };
  const conAlfa = (hex, al) => `rgba(${rgb(hex).join(",")},${al})`;
  const topes = (x, a, b) => Math.max(a, Math.min(b, x));
  const luminancia = hex => {
    const [r, g, b] = rgb(hex).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const mejor = (fondo, ...opciones) => opciones.reduce((m, o) => (contraste(fondo, o) > contraste(fondo, m) ? o : m));
  const aHsl = hex => {
    const [r, g, b] = rgb(hex).map(x => x / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s * 100, l * 100];
  };
  const deHsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360; s = topes(s, 0, 100) / 100; l = topes(l, 0, 100) / 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return hexDe([0, 8, 4].map(n => (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255));
  };
  const ESTILOS = {
    brasa(p) {
      const [h, s0] = aHsl(p.color), s = topes(s0, 55, 95);
      const [h2, s2] = p.color2 ? aHsl(p.color2) : [h, s];
      const crema = "#FFF4EA";
      return {
        f1: deHsl(h, s, 52), f2: deHsl(h, s * 0.62, 8), f3: deHsl(h2, topes(s2, 50, 90), 30), f4: deHsl(h, s * 0.45, 2.5),
        t: crema, s: conAlfa(crema, 0.66), tc: crema, sc: conAlfa(crema, 0.66),
        a: deHsl(h, s, 62), sa: deHsl(h, s * 0.7, 8),
        c: deHsl(h, s * 0.6, 16), luz: deHsl(h, s, 58), sombra: deHsl(h, s, 50), tema: deHsl(h, s * 0.62, 8),
      };
    },
    jugo(p) {
      const [h, s0, l0] = aHsl(p.color), s = topes(s0, 70, 96);
      const [h2] = p.color2 ? aHsl(p.color2) : [h + 22];
      const base = deHsl(h, s, topes(l0, 46, 56));
      const tc = deHsl(h, topes(s * 0.8, 40, 80), 15);
      const t = mejor(base, "#FFFFFF", tc);
      const a = deHsl(h, s, topes(l0, 44, 52));
      return {
        f1: deHsl(h - 22, s, 60), f2: deHsl(h2, topes(s, 60, 90), 58), f3: deHsl(h + 8, 100, 82), f4: base,
        t, s: conAlfa(t, 0.78), tc, sc: conAlfa(tc, 0.72),
        a, sa: mejor(a, "#FFFFFF", tc),
        c: base, luz: deHsl(h, 100, 78), sombra: deHsl(h, s, 22), tema: base,
      };
    },
    estudio(p) {
      const [h, s0] = aHsl(p.color), s = topes(s0, 35, 80);
      const t = deHsl(h, topes(s * 0.8, 30, 70), 14);
      return {
        f1: deHsl(h, s * 0.85, 86), f2: deHsl(h, s * 0.8, 76), f3: deHsl(h, s, 95), f4: deHsl(h, s * 0.7, 55),
        t, s: conAlfa(t, 0.68), tc: t, sc: conAlfa(t, 0.68),
        a: t, sa: deHsl(h, s * 0.8, 92),
        c: deHsl(h, s * 0.85, 84), luz: deHsl(h, s, 80), sombra: deHsl(h, s * 0.8, 20), tema: deHsl(h, s * 0.85, 86),
      };
    },
  };
  // El color es el de la carta (local.js); si la foto pide otro (fotos.js) o es "Tu foto", ese
  const colorPropio = {};
  const conColor = p => {
    const f = window.FOTOS[p.id] || {};
    return { ...p, color: colorPropio[p.id] || f.color || p.color, color2: colorPropio[p.id] ? null : f.color2 || p.color2 };
  };
  let estilo = ESTILOS[L.estilo] ? L.estilo : "brasa";
  let paletas = {};
  const paleta = p => ((paletas[estilo] ||= {})[p.id] ||= ESTILOS[estilo](conColor(p)));

  /* ---------- Estado ---------- */
  const feed = $("#feed"), fondo = $("#fondo"), palabra = $("#palabra"), velo = $("#velo"), pastilla = $("#pastilla");
  const hojaArmar = $("#hoja-armar"), hojaCarta = $("#hoja-carta");
  let secciones = [];
  let actual = -1;
  let modo = null;               // "explotando" | "armando" | null
  let hojaAbierta = null;
  let eleccion = null, eleccionCambio = false;
  const pedido = [];             // lo que se va sumando (en el laboratorio no se manda)
  const escenario = i => secciones[i].querySelector("[data-escenario]");

  // La foto del plato en un círculo de su color (pedido, carta completa)
  function fotoRedonda(p, clase = "foto-redonda") {
    const url = E.fotoLista(p);
    return `<span class="${clase}" style="--c:${paleta(p).c}"${url ? "" : ` data-foto-de="${p.id}"`}>${url ? `<img src="${url}" alt="">` : ""}</span>`;
  }
  function llenarFotos(raizEl) {
    raizEl.querySelectorAll("[data-foto-de]").forEach(s => {
      const id = s.dataset.fotoDe;
      s.removeAttribute("data-foto-de");
      E.foto(porId(id)).then(url => { if (url && !s.firstChild) s.innerHTML = `<img src="${url}" alt="">`; });
    });
  }

  /* ---------- La carta ---------- */
  function pintarCarta() {
    feed.innerHTML = platos.map((p, i) => `
      <article class="plato" data-i="${i}" aria-label="${esc(p.nombre)}">
        <div class="plato__escenario" data-escenario>
          <div class="plato__sellos">${p.sellos.map(s => `<span class="sello">${esc(s)}</span>`).join("")}</div>
          <p class="armado" hidden></p>
        </div>
        <div class="plato__info">
          <div class="plato__fila">
            <p class="plato__cat">${esc(categoria(p.categoria).nombre)}</p>
            <div class="plato__herramientas">
              <button class="chip-linea" type="button" data-accion="explotar"><svg width="15" height="15" aria-hidden="true"><use href="#i-capas"/></svg>¿Qué tiene?</button>
              ${p.armable ? `<button class="chip-linea" type="button" data-accion="armar" aria-label="Armala a tu gusto"><svg width="15" height="15" aria-hidden="true"><use href="#i-lapiz"/></svg>Armala</button>` : ""}
            </div>
          </div>
          <h2 class="plato__nombre">${esc(p.nombre)}</h2>
          <p class="plato__desc">${esc(p.descripcion)}</p>
        </div>
      </article>`).join("");
    secciones = $$(".plato", feed);
    pintarColores();
    $("#categorias").innerHTML = L.categorias.map(c => `<button class="cat" type="button" data-cat="${c.id}">${esc(c.nombre)}</button>`).join("");
  }
  function pintarColores() {
    secciones.forEach((s, i) => {
      const pa = paleta(platos[i]);
      ["t", "s", "tc", "sc", "a", "sa", "c"].forEach(k => s.style.setProperty("--" + k, pa[k]));
    });
  }

  function irA(i, suave) {
    i = Math.max(0, Math.min(platos.length - 1, i));
    feed.scrollTo({ top: i * feed.clientHeight, behavior: suave && MOVIMIENTO ? "smooth" : "auto" });
  }

  let cuadroPedido = false;
  function alDeslizar() {
    cuadroPedido = false;
    const h = feed.clientHeight || 1;
    const pos = Math.max(0, Math.min(platos.length - 1, feed.scrollTop / h));
    const i = Math.floor(pos), f = pos - i;
    const pa = paleta(platos[i]), pb = paleta(platos[Math.min(i + 1, platos.length - 1)]);
    const k = f * f * (3 - 2 * f);
    ["f1", "f2", "f3", "f4"].forEach(n => fondo.style.setProperty("--" + n, mezclar(pa[n], pb[n], k)));
    const cerca = Math.round(pos);
    if (cerca !== actual) activar(cerca);
    if (feed.scrollTop > 40) ocultarPista();
  }

  function activar(i) {
    const antes = platos[actual];
    actual = i;
    const p = platos[i], pa = paleta(p);
    secciones.forEach((s, j) => s.classList.toggle("activo", j === i));
    [["--tinta-actual", pa.t], ["--suave-actual", pa.s], ["--acento-actual", pa.a], ["--sobre-acento-actual", pa.sa],
     ["--luz-actual", pa.luz], ["--tarjeta-actual", pa.tc]].forEach(([k, v]) => raiz.style.setProperty(k, v));
    $("#meta-tema").content = pa.tema;
    pintarAgregar();
    $$(".cat").forEach(b => {
      const si = b.dataset.cat === p.categoria;
      b.setAttribute("aria-current", si);
      if (si) {
        const nav = b.parentElement;
        nav.scrollTo({ left: b.offsetLeft - nav.clientWidth / 2 + b.offsetWidth / 2, behavior: MOVIMIENTO ? "smooth" : "auto" });
      }
    });
    const texto = categoria(p.categoria).palabra;
    if (!antes || antes.categoria !== p.categoria) {
      palabra.classList.add("cambiando");
      setTimeout(() => { palabra.textContent = texto; palabra.classList.remove("cambiando"); }, antes ? 200 : 0);
    }
  }

  /* ---------- Armar y precios (igual que en la app) ---------- */
  function gruposDe(p) {
    const m = p.modelo;
    return (L.armados[p.armable] || [])
      .filter(g => !(g.id === "punto" && m.medallon !== "carne"))
      .map(g => {
        if (g.id === "sacale") return { ...g, items: g.items.filter(it => (m.con || []).includes(it.id)) };
        if (g.id === "sumale") return { ...g, items: g.items.filter(it => !(m.extras || []).includes(it.id)) };
        return g;
      })
      .filter(g => g.items.length);
  }
  function porDefecto(p) {
    const e = { medallones: p.modelo.medallones || 1, sacale: [], sumale: [] };
    if (p.modelo.medallon === "carne") e.punto = "a-punto";
    return e;
  }
  function precioDe(p, el) {
    if (!el || !p.armable) return p.precio;
    let total = p.precio;
    for (const g of gruposDe(p)) {
      if (g.id === "medallones") {
        const base = g.items.find(x => x.id === (p.modelo.medallones || 1));
        const elegido = g.items.find(x => x.id === el.medallones) || base;
        total += (elegido.precio || 0) - (base.precio || 0);
      }
      if (g.id === "sumale") (el.sumale || []).forEach(id => { total += g.items.find(x => x.id === id)?.precio || 0; });
    }
    return total;
  }
  function describir(p, el) {
    if (!el || !p.armable) return "";
    const partes = [];
    const grupos = gruposDe(p);
    const nombre = (gid, id) => grupos.find(g => g.id === gid)?.items.find(x => x.id === id)?.nombre || id;
    if (el.medallones && el.medallones !== (p.modelo.medallones || 1)) partes.push(nombre("medallones", el.medallones));
    (el.sacale || []).forEach(id => partes.push("sin " + nombre("sacale", id).toLowerCase()));
    (el.sumale || []).forEach(id => partes.push("+ " + nombre("sumale", id).toLowerCase()));
    if (el.punto && el.punto !== "a-punto") partes.push(nombre("punto", el.punto).toLowerCase());
    return partes.join(" · ");
  }
  const normalizar = (p, el) => (el && describir(p, el) ? el : null);

  /* ---------- Agregar (en el laboratorio se suma, pero no se manda) ---------- */
  function agregar(p, el) {
    el = normalizar(p, el);
    const detalle = describir(p, el), clave = p.id + "|" + detalle;
    const linea = pedido.find(l => l.clave === clave);
    if (linea) linea.cant++;
    else pedido.push({ clave, plato: p.id, eleccion: el, detalle, precio: precioDe(p, el), cant: 1 });
    pintarPastilla();
    volar(p, escenario(platos.indexOf(p)));
    try { navigator.vibrate && navigator.vibrate(14); } catch { /* sin vibración */ }
    botonAgregar.sumado = true;
    pintarAgregar();
    clearTimeout(botonAgregar.vuelta);
    botonAgregar.vuelta = setTimeout(() => { botonAgregar.sumado = false; pintarAgregar(); }, 1300);
  }
  const botonAgregar = $("#agregar");
  function pintarAgregar() {
    const p = platos[actual];
    if (!p) return;
    botonAgregar.querySelector(".mas").hidden = botonAgregar.sumado;
    $("#agregar-texto").textContent = botonAgregar.sumado ? "¡Sumado!" : "Agregar";
    $("#agregar-precio").textContent = botonAgregar.sumado ? "" : plata(p.precio);
    botonAgregar.setAttribute("aria-label", `Agregar ${p.nombre}, ${plata(p.precio)}`);
  }
  botonAgregar.addEventListener("click", () => { alDeslizar(); agregar(platos[actual], null); });

  // El plato "vuela" hasta el pedido
  function volar(p, desdeEl) {
    const img = E.fotoLista(p);
    const desde = E.donde(desdeEl);
    const destino = $("#pastilla-fotos").getBoundingClientRect();
    if (!MOVIMIENTO || !destino.width) return latir();
    const tam = Math.max(70, Math.min(220, desde.r * 1.6));
    const v = document.createElement("div");
    v.className = "volador";
    v.style.setProperty("--c", paleta(p).c);
    v.style.width = v.style.height = tam + "px";
    if (img) v.innerHTML = `<img src="${img}" alt="">`;
    document.body.appendChild(v);
    const hx = destino.left + 21, hy = destino.top + 21;
    const x0 = desde.x - tam / 2, y0 = desde.y - tam / 2;
    const x1 = hx - tam / 2, y1 = hy - tam / 2;
    const anim = v.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(1)` },
      { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) scale(.62)`, offset: 0.45 },
      { transform: `translate(${x1}px, ${y1}px) scale(${44 / tam})` },
    ], { duration: 680, easing: "cubic-bezier(.45,0,.25,1)" });
    const fin = () => { v.remove(); latir(); };
    anim.onfinish = fin;
    setTimeout(() => { if (v.isConnected) fin(); }, 1200);
  }
  function latir() {
    pastilla.classList.remove("latido");
    void pastilla.offsetWidth;
    pastilla.classList.add("latido");
  }
  function pintarPastilla() {
    const cant = pedido.reduce((s, l) => s + l.cant, 0);
    pastilla.hidden = cant === 0;
    $("#acciones").classList.toggle("con-pedido", cant > 0);
    if (!cant) return;
    const total = pedido.reduce((s, l) => s + l.precio * l.cant, 0);
    $("#pastilla-cant").textContent = `Pedido · ${cant}`;
    $("#pastilla-total").textContent = plata(total);
    pastilla.setAttribute("aria-label", `Tu pedido: ${cant} ${cant === 1 ? "cosa" : "cosas"}, ${plata(total)}`);
    const cont = $("#pastilla-fotos");
    const html = pedido.slice(-2).map(l => fotoRedonda(porId(l.plato), "pastilla__foto")).join("");
    if (cont.dataset.html !== html) { cont.innerHTML = html; cont.dataset.html = html; llenarFotos(cont); }
  }
  pastilla.addEventListener("click", () => {
    const cant = pedido.reduce((s, l) => s + l.cant, 0);
    avisar(`Es un laboratorio: acá se prueba solo la carta. Tu pedido (${cant}) no se manda.`);
  });

  /* ---------- Hojas ---------- */
  function abrirHoja(h, { claro = false } = {}) {
    if (hojaAbierta) cerrarHoja(true);
    hojaAbierta = h;
    velo.hidden = false;
    velo.classList.toggle("velo--claro", claro);
    h.hidden = false;
    document.body.classList.add("bloqueada");
    requestAnimationFrame(() => requestAnimationFrame(() => { velo.classList.add("abierto"); h.classList.add("abierta"); }));
    setTimeout(() => h.querySelector("[data-cerrar]")?.focus({ preventScroll: true }), 60);
  }
  function cerrarHoja(rapido) {
    const h = hojaAbierta;
    if (!h) return;
    hojaAbierta = null;
    if (h === hojaArmar) salirArmar();
    h.classList.remove("abierta");
    velo.classList.remove("abierto");
    const fin = () => { h.hidden = true; if (!hojaAbierta) velo.hidden = true; };
    if (rapido) fin(); else setTimeout(fin, 420);
    if (!modo) document.body.classList.remove("bloqueada");
  }
  velo.addEventListener("click", () => cerrarHoja());
  document.addEventListener("click", e => { if (e.target.closest("[data-cerrar]")) cerrarHoja(); });

  /* ---------- ¿Qué tiene? ---------- */
  function explotar(si) {
    if (si && modo) return;
    if (si) ocultarPista();
    modo = si ? "explotando" : null;
    const p = platos[actual];
    E.explotar(escenario(actual), si, () => {
      document.body.classList.toggle("explotando", si);
      document.body.classList.toggle("bloqueada", si);
    });
    $("#explosion-pie").hidden = !si;
    $("#explosion-nombre").textContent = p.nombre;
    $("#explosion-bajada").textContent = E.tieneCapas(p) ? "Así viene, capa por capa" : "Así viene, parte por parte";
    if (si) setTimeout(() => $("#explosion-cerrar").focus({ preventScroll: true }), 50);
  }
  $("#explosion-cerrar").addEventListener("click", () => explotar(false));

  /* ---------- Armala a tu gusto: la foto no cambia, pero lo que elegís se ve abajo del plato ---------- */
  function abrirArmar() {
    const p = platos[actual];
    if (!p.armable || modo) return;
    eleccion = porDefecto(p);
    eleccionCambio = false;
    modo = "armando";
    $("#armar-titulo").textContent = p.nombre;
    pintarOpciones(p);
    abrirHoja(hojaArmar, { claro: true });
    raiz.style.setProperty("--hoja", hojaArmar.offsetHeight + "px");
    E.acomodar(escenario(actual), () => document.body.classList.add("armando"));
  }
  function salirArmar() {
    if (modo !== "armando") return;
    modo = null;
    E.acomodar(escenario(actual), () => document.body.classList.remove("armando"));
    if (eleccionCambio) mostrarArmado(null);
  }
  function mostrarArmado(texto) {
    const t = secciones[actual].querySelector(".armado");
    t.hidden = !texto;
    t.textContent = texto || "";
  }
  const elegido = (g, it) => { const v = eleccion[g.id]; return Array.isArray(v) ? v.includes(it.id) : v === it.id; };
  function precioChip(p, g, it) {
    if (g.id === "medallones") {
      const base = g.items.find(x => x.id === (p.modelo.medallones || 1));
      const d = (it.precio || 0) - (base.precio || 0);
      return d ? `<small>${d > 0 ? "+" : "−"}${plata(Math.abs(d))}</small>` : "";
    }
    return it.precio ? `<small>+${plata(it.precio)}</small>` : "";
  }
  function pintarOpciones(p) {
    $("#armar-opciones").innerHTML = gruposDe(p).map(g => `
      <div class="grupo" data-grupo="${g.id}" data-tipo="${g.tipo}">
        <p class="grupo__titulo">${esc(g.titulo)}</p>
        <div class="chips">${g.items.map(it => `
          <button type="button" class="chip${g.id === "sacale" ? " chip--sacar" : ""}" data-item="${it.id}" aria-pressed="${elegido(g, it)}"><span>${esc(it.nombre)}</span>${precioChip(p, g, it)}</button>`).join("")}
        </div>
      </div>`).join("");
    $("#armar-agregar").textContent = `Agregar · ${plata(precioDe(p, eleccion))}`;
  }
  $("#armar-opciones").addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    const p = platos[actual];
    const gEl = b.closest(".grupo");
    const g = gruposDe(p).find(x => x.id === gEl.dataset.grupo);
    const it = g.items.find(x => String(x.id) === b.dataset.item);
    if (g.tipo === "uno") eleccion[g.id] = it.id;
    else {
      const sel = new Set(eleccion[g.id] || []);
      sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id);
      eleccion[g.id] = [...sel];
    }
    $$(".chip", gEl).forEach(c => c.setAttribute("aria-pressed", elegido(g, g.items.find(x => String(x.id) === c.dataset.item))));
    eleccionCambio = true;
    E.saltar(escenario(actual), 0.55);
    mostrarArmado(describir(p, eleccion));
    $("#armar-agregar").textContent = `Agregar · ${plata(precioDe(p, eleccion))}`;
  });
  $("#armar-agregar").addEventListener("click", () => {
    const p = platos[actual];
    const el = { ...eleccion };
    cerrarHoja();
    setTimeout(() => agregar(p, el), MOVIMIENTO ? 260 : 0);
  });

  /* ---------- Toda la carta: tocás un plato y su foto vuela a su lugar ---------- */
  function abrirCarta() {
    $("#carta-sobre").textContent = L.nombre;
    const cuerpo = $("#carta-grilla");
    cuerpo.innerHTML = L.categorias.map(c => `
      <h3 class="carta-cat">${esc(c.nombre)}</h3>
      <div class="grilla">${platos.map((p, i) => p.categoria !== c.id ? "" : `
        <button class="tarjeta" type="button" data-ir="${i}" style="${["f1", "f2", "f3", "f4", "t"].map(k => `--${k}:${paleta(p)[k]}`).join(";")}">
          <span class="tarjeta__foto" data-foto="${p.id}">${E.fotoLista(p) ? `<img src="${E.fotoLista(p)}" alt="">` : ""}</span>
          <b>${esc(p.nombre)}</b><span class="tarjeta__precio">${plata(p.precio)}</span>
        </button>`).join("")}
      </div>`).join("");
    abrirHoja(hojaCarta);
    platos.forEach(p => {
      if (E.fotoLista(p)) return;
      E.foto(p).then(url => {
        const s = cuerpo.querySelector(`[data-foto="${p.id}"]`);
        if (s && url && !s.firstChild) s.innerHTML = `<img src="${url}" alt="">`;
      });
    });
  }
  $("#btn-carta").addEventListener("click", abrirCarta);
  $("#carta-grilla").addEventListener("click", e => {
    const b = e.target.closest("[data-ir]");
    if (!b) return;
    const i = +b.dataset.ir;
    const img = b.querySelector("img");
    const desde = img && img.getBoundingClientRect();
    cerrarHoja(true);
    irA(i, false);
    alDeslizar();
    if (!img || !MOVIMIENTO) return;
    // La foto de la tarjeta crece hasta el lugar del plato
    const el = escenario(i);
    requestAnimationFrame(() => {
      const hasta = E.rect(el);
      if (!hasta.width) return;
      const v = document.createElement("figure");
      v.className = "volando-foto";
      v.innerHTML = `<img src="${img.src}" alt="">`;
      Object.assign(v.style, { left: hasta.left + "px", top: hasta.top + "px", width: hasta.width + "px", height: hasta.height + "px" });
      document.body.appendChild(v);
      E.ocultar(el, true);
      // Sale de la tarjeta y, si es de los que se ven desde arriba, se acuesta al llegar
      const dx = desde.left + desde.width / 2 - (hasta.left + hasta.width / 2), dy = desde.top + desde.height / 2 - (hasta.top + hasta.height / 2);
      const s = Math.min(desde.width / hasta.width, desde.height / hasta.height);
      const a = v.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
        { transform: E.acostado(platos[i]) ? `perspective(1100px) rotateX(${E.acostado(platos[i])}deg)` : "none" },
      ], { duration: 620, easing: "cubic-bezier(.2,.9,.25,1)" });
      let hecho = false;
      const fin = () => { if (hecho) return; hecho = true; v.remove(); E.ocultar(el, false); E.saltar(el, 0.5); };
      a.onfinish = fin;
      setTimeout(fin, 900);
    });
  });

  /* ---------- Avisos ---------- */
  let avisoHasta = 0;
  function avisar(texto) {
    const a = $("#aviso");
    a.innerHTML = `<span>${esc(texto)}</span>`;
    a.classList.add("visible");
    clearTimeout(avisoHasta);
    avisoHasta = setTimeout(() => a.classList.remove("visible"), 3400);
  }

  /* ---------- Pista para la primera vez ---------- */
  let pista = null, pistaPuesta = false;
  function ponerPista() {
    if (pistaPuesta || actual > 0 || modo) return;
    pistaPuesta = true;
    pista = document.createElement("div");
    pista.className = "pista";
    pista.innerHTML = `<svg width="18" height="18" aria-hidden="true"><use href="#i-giro"/></svg>Movelo con el dedo · deslizá para ver más`;
    escenario(0).appendChild(pista);
    setTimeout(ocultarPista, 7000);
  }
  function ocultarPista() {
    if (!pista) return;
    const p = pista;
    pista = null;
    p.classList.add("fuera");
    setTimeout(() => p.remove(), 500);
  }

  /* ---------- Estilo ---------- */
  function usarEstilo(nombre, guardar) {
    if (!ESTILOS[nombre]) return;
    estilo = nombre;
    raiz.dataset.estilo = nombre;
    $$("#estilos [data-estilo]").forEach(b => b.setAttribute("aria-pressed", b.dataset.estilo === nombre));
    pintarColores();
    const i = Math.max(0, actual);
    actual = -1;
    activar(i);
    alDeslizar();
    $("#pastilla-fotos").dataset.html = "";
    pintarPastilla();
    if (guardar) { try { localStorage.setItem("cartaviva.lab.estilo", nombre); } catch { /* sin almacenamiento */ } }
  }
  function estiloInicial() {
    const h = location.hash.slice(1);
    if (ESTILOS[h]) return h;
    try { const g = localStorage.getItem("cartaviva.lab.estilo"); if (ESTILOS[g]) return g; } catch { /* nada */ }
    return estilo;
  }
  $("#estilos").addEventListener("click", e => {
    const b = e.target.closest("[data-estilo]");
    if (b) usarEstilo(b.dataset.estilo, true);
  });

  /* ---------- Tu foto: cambia la del plato que estás viendo (solo en este navegador) ---------- */
  $("#lab-foto").addEventListener("click", () => $("#lab-archivo").click());
  $("#lab-archivo").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (modo === "explotando") explotar(false);
    const p = platos[actual];
    const r = await E.cambiarFoto(p, URL.createObjectURL(f));
    if (!r) return avisar("No se pudo abrir esa foto.");
    if (r.color) colorPropio[p.id] = r.color;
    paletas = {};
    pintarColores();
    const i = actual;
    actual = -1;
    activar(i);
    alDeslizar();
    avisar(`Listo: ${p.nombre} con tu foto (solo en este celu, hasta que recargues).`);
  });

  /* ---------- Arranque ---------- */
  function iniciar() {
    document.title = `${L.nombre} · la carta · laboratorio`;
    $("#marca-nombre").textContent = L.nombre;
    $("#marca-mesa").textContent = `Mesa ${L.mesaDemo || 7}`;
    raiz.classList.add("con-cinta");
    estilo = estiloInicial();
    raiz.dataset.estilo = estilo;
    $$("#estilos [data-estilo]").forEach(b => b.setAttribute("aria-pressed", b.dataset.estilo === estilo));
    pintarCarta();
    E.iniciar({ etiquetas: $("#etiquetas") });
    secciones.forEach((s, i) => E.vincular(escenario(i), platos[i]));
    alDeslizar();
    secciones[0].classList.add("entrada");
    setTimeout(ponerPista, 900);

    feed.addEventListener("scroll", () => { if (!cuadroPedido) { cuadroPedido = true; requestAnimationFrame(alDeslizar); } }, { passive: true });
    addEventListener("resize", () => requestAnimationFrame(alDeslizar));
    feed.addEventListener("click", e => {
      const b = e.target.closest("[data-accion]");
      if (!b) return;
      alDeslizar();
      const i = +b.closest(".plato").dataset.i;
      if (i !== actual) return irA(i, true);
      if (b.dataset.accion === "explotar") explotar(true);
      if (b.dataset.accion === "armar") abrirArmar();
    });
    feed.addEventListener("escena:giro", ocultarPista);
    feed.addEventListener("escena:toque", ocultarPista);
    $("#categorias").addEventListener("click", e => {
      const b = e.target.closest("[data-cat]");
      if (b) irA(platos.findIndex(p => p.categoria === b.dataset.cat), true);
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        if (hojaAbierta) cerrarHoja();
        else if (modo === "explotando") explotar(false);
        return;
      }
      if (modo || hojaAbierta || e.target.closest("input, textarea")) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); irA(actual + 1, true); }
      if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); irA(actual - 1, true); }
    });

    // Para revisar un plato abierto: laboratorio/#que-tiene=clasica
    const revisar = location.hash.match(/que-tiene=([\w-]+)/);
    if (revisar) {
      const i = platos.findIndex(p => p.id === revisar[1]);
      if (i >= 0) { irA(i, false); alDeslizar(); E.foto(platos[i]).then(() => setTimeout(() => explotar(true), 300)); }
    }
  }

  iniciar();
})();
