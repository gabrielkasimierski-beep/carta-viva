/* =============================================================================
   CARTA VIVA — la carta del comensal
   Se entra escaneando el QR de la mesa (?mesa=7). Una pantalla por plato, cada una
   con su color: se desliza como un feed, el plato se gira con el dedo, se "explota"
   para ver qué tiene y se arma a gusto.
   El pedido es de toda la mesa: cada uno suma desde su celular, todos ven lo mismo
   (con el nombre de quien lo pidió) y cualquiera lo manda. Después se sigue cada
   ronda, se llama al mozo y se pide la cuenta: junta, en partes o cada uno lo suyo.
   ============================================================================= */

const L = window.LOCAL, D = window.Datos, E = window.Escena, P = window.Platos3D;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const raiz = document.documentElement;
const MOVIMIENTO = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const plata = n => "$" + Math.round(n).toLocaleString("es-AR");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const lista = xs => (xs.length <= 1 ? xs[0] || "" : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);
const hace = t => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? "recién" : `hace ${m} min`; };

const platos = L.categorias.flatMap(c => L.platos.filter(p => p.categoria === c.id));
const porId = id => L.platos.find(p => p.id === id);
const categoria = id => L.categorias.find(c => c.id === id);
const estacion = id => (L.estaciones || []).find(e => e.id === id) || { id, nombre: id, donde: id, sale: "¡Sale!" };

/* ---------- La mesa: sale del QR ---------- */
// Demo: ?mesa=7. Con la base real, el QR lleva el código secreto de la mesa: ?m=k7f2…
// Sin mesa (alguien que abrió el link suelto), se puede mirar la carta pero no pedir.
await D.listo;
const enlace = new URLSearchParams(location.search);
const pedida = {
  mesa: parseInt(enlace.get("mesa") || (location.hash.match(/mesa[-=]?(\d+)/i) || [])[1], 10) || null,
  codigo: enlace.get("m"),
};
const infoMesa = (await D.abrirMesa(pedida)) || (L.demo && D.modo === "vista-previa" ? await D.abrirMesa({ mesa: L.mesaDemo }) : null);
const mesa = infoMesa ? infoMesa.mesa : null;
const datosMesa = () => infoMesa || { zona: "", lugares: 4 };

/* ---------- Quién soy en la mesa (cada celular, una persona) ---------- */
let yo = null;
function olvidarYo() {
  yo = null;
  D.olvidarYo();
}
const miComensal = () => (yo ? D.comensal(yo) : null);
// Mi mesa mientras está abierta (cuando la cobran, se cierra)
function miMesa() {
  const c = miComensal();
  const m = c && D.mesa(c.sesion);
  return m && !m.sesion.cerrada ? m : null;
}
const inicial = n => (String(n || "?").trim()[0] || "?").toUpperCase();
const avatar = (c, clase = "") => `<span class="avatar ${clase}" style="--av:${c.color}" aria-hidden="true">${esc(inicial(c.nombre))}</span>`;
const nombreEn = (m, id) => (m.comensales.find(c => c.id === id) || {}).nombre || "Alguien";

/* ---------- Color: el color de cada plato, llevado a cada estilo ---------- */
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

// Cada estilo saca sus tonos del color del plato:
//   f1…f4 → el fondo · t/s → textos · tc/sc → textos dentro de la tarjeta (jugo)
//   a/sa → botón y su texto · c → fondo de las fotitos · luz/sombra → el 3D · tema → barra del navegador
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
let estilo = ESTILOS[L.estilo] ? L.estilo : "brasa";
const paletas = {};
const paleta = p => ((paletas[estilo] ||= {})[p.id] ||= ESTILOS[estilo](p));

/* ---------- Estado ---------- */
const feed = $("#feed"), fondo = $("#fondo"), palabra = $("#palabra"), velo = $("#velo");
const pastilla = $("#pastilla"), seg = $("#seguimiento"), gracias = $("#gracias");
const hojaArmar = $("#hoja-armar"), hojaPedido = $("#hoja-pedido"), hojaCarta = $("#hoja-carta"), hojaMozo = $("#hoja-mozo");
const hojaBienvenida = $("#hoja-bienvenida");
let secciones = [];
let actual = -1;
let modo = null;               // "explotando" | "armando" | null
let hojaAbierta = null;
let eleccion = null, eleccionCambio = false;

const escenario = i => secciones[i].querySelector("[data-escenario]");

// La foto del plato (como lo armaron). Si todavía no está hecha, se completa después.
function fotoRedonda(p, el, clase = "foto-redonda") {
  const url = E.fotoLista(p, el || null);
  const pendiente = url ? "" : ` data-foto-de="${esc(JSON.stringify([p.id, el || null]))}"`;
  return `<span class="${clase}" style="--c:${paleta(p).c}"${pendiente}>${url ? `<img src="${url}" alt="">` : ""}</span>`;
}
function llenarFotos(raizEl) {
  raizEl.querySelectorAll("[data-foto-de]").forEach(s => {
    const [id, el] = JSON.parse(s.dataset.fotoDe);
    s.removeAttribute("data-foto-de");
    E.foto(porId(id), el).then(url => { if (url && !s.firstChild) s.innerHTML = `<img src="${url}" alt="">`; });
  });
}

/* ---------- La carta ---------- */
function pintarCarta() {
  feed.innerHTML = platos.map((p, i) => `
    <article class="plato" data-i="${i}" aria-label="${esc(p.nombre)}">
      <div class="plato__escenario" data-escenario>
        <div class="plato__sellos">${p.sellos.map(s => `<span class="sello">${esc(s)}</span>`).join("")}</div>
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

  $("#categorias").innerHTML = L.categorias
    .map(c => `<button class="cat" type="button" data-cat="${c.id}">${esc(c.nombre)}</button>`)
    .join("");
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
  E.tono(pa.luz, pa.sombra);
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
  E.foto(p);
  if (platos[i + 1]) E.foto(platos[i + 1]);
}

/* ---------- Armar y precios ---------- */
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
// Si lo "armado" quedó igual que el de la carta, es el de la carta.
const normalizar = (p, el) => (el && describir(p, el) ? el : null);

/* ---------- Agregar al pedido de la mesa ---------- */
function agregar(p, el) {
  if (!mesa) return avisar("Para pedir, escaneá el código QR de tu mesa.");
  if (D.agotado(p.id)) return avisar(`${p.nombre} se terminó por hoy.`);
  if (!miMesa()) return pedirNombre(() => agregar(p, el));
  el = normalizar(p, el);
  const linea = D.sumar(yo, { plato: p.id, eleccion: el, detalle: describir(p, el), precio: precioDe(p, el), clave: P.clave(p, el) + (el?.punto || "") });
  if (!linea) return avisar("No se pudo sumar. Probá de nuevo.");
  pintarPastilla();
  volar(p, el, escenario(platos.indexOf(p)));
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
  const no = D.agotado(p.id);
  botonAgregar.disabled = no;
  botonAgregar.querySelector(".mas").hidden = no || botonAgregar.sumado;
  $("#agregar-texto").textContent = no ? "Agotado hoy" : botonAgregar.sumado ? "¡Sumado!" : "Agregar";
  $("#agregar-precio").textContent = no || botonAgregar.sumado ? "" : plata(p.precio);
  botonAgregar.setAttribute("aria-label", no ? `${p.nombre}: agotado hoy` : `Agregar ${p.nombre}, ${plata(p.precio)}`);
}
botonAgregar.addEventListener("click", () => { alDeslizar(); agregar(platos[actual], null); });

// El plato "vuela" hasta el pedido
function volar(p, el, desdeEl) {
  const img = E.fotoLista(p, el);
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
  anim.onfinish = () => { v.remove(); latir(); };
}
function latir() {
  pastilla.classList.remove("latido");
  void pastilla.offsetWidth;
  pastilla.classList.add("latido");
}

function pintarPastilla() {
  const m = miMesa();
  const carrito = m ? m.carrito : [];
  const cant = carrito.reduce((s, l) => s + l.cant, 0);
  pastilla.hidden = cant === 0;
  $("#acciones").classList.toggle("con-pedido", cant > 0);
  if (!cant) return;
  const total = carrito.reduce((s, l) => s + l.precio * l.cant, 0);
  const gente = new Set(carrito.map(l => l.comensal)).size;
  $("#pastilla-cant").textContent = `Pedido · ${cant}`;
  $("#pastilla-total").textContent = plata(total);
  pastilla.setAttribute("aria-label", `Ver el pedido de la mesa: ${cant} ${cant === 1 ? "cosa" : "cosas"}${gente > 1 ? ` de ${gente} personas` : ""}, ${plata(total)}`);
  const cont = $("#pastilla-fotos");
  const html = carrito.slice(-2).map(l => fotoRedonda(porId(l.plato), l.eleccion, "pastilla__foto")).join("");
  if (cont.dataset.html !== html) { cont.innerHTML = html; cont.dataset.html = html; llenarFotos(cont); }
}

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
  if (!modo && seg.hidden && gracias.hidden) document.body.classList.remove("bloqueada");
  if (h === hojaBienvenida) setTimeout(ponerPista, 500);
}
velo.addEventListener("click", () => cerrarHoja());
document.addEventListener("click", e => { if (e.target.closest("[data-cerrar]")) cerrarHoja(); });

/* ---------- Bienvenida: entrar a la mesa con tu nombre ---------- */
let alEntrar = null;
function pedirNombre(despues) {
  if (!mesa) return;
  alEntrar = despues || null;
  pintarBienvenida();
  abrirHoja(hojaBienvenida, { claro: true });
  if (despues) setTimeout(() => $("#bienvenida-nombre").focus({ preventScroll: true }), 460);
}
function pintarBienvenida() {
  const m = datosMesa();
  const gente = D.gente(mesa);
  $("#bienvenida-sobre").textContent = [L.nombre, m.zona].filter(Boolean).join(" · ");
  $("#bienvenida-titulo").textContent = `Mesa ${mesa}`;
  $("#bienvenida-gente").innerHTML = gente.length
    ? `<span class="avatares">${gente.slice(0, 5).map(c => avatar(c)).join("")}</span>
       <span>Ya ${gente.length === 1 ? "está" : "están"} <b>${esc(lista(gente.map(c => c.nombre)))}</b>. Lo que elijan va al mismo pedido.</span>`
    : `<span>Todavía no hay nadie: abrís la mesa vos. Si vienen más, que escaneen el mismo código.</span>`;
}
async function entrar() {
  const b = $("#bienvenida-entrar");
  if (b.disabled) return;
  b.disabled = true;
  try {
    const r = await D.entrar(mesa, $("#bienvenida-nombre").value);
    if (!r) return avisar("No pudimos entrar a la mesa. Probá de nuevo.");
    yo = r.comensal.id;
    D.recordarYo(r.comensal);
    antes = null;
    cerrarHoja();
    refrescar();
    avisar(`¡Hola, ${r.comensal.nombre}! Estás en la mesa ${mesa}.`, r.comensal);
    const f = alEntrar;
    alEntrar = null;
    if (f) setTimeout(f, 380);
  } finally {
    b.disabled = false;
  }
}
$("#bienvenida-entrar").addEventListener("click", entrar);
$("#bienvenida-nombre").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); entrar(); } });

/* ---------- ¿Qué tiene? ---------- */
function explotar(si) {
  if (si && modo) return;
  if (si) ocultarPista();
  modo = si ? "explotando" : null;
  document.body.classList.toggle("explotando", si);
  document.body.classList.toggle("bloqueada", si);
  E.explotar(escenario(actual), si);
  $("#explosion-pie").hidden = !si;
  $("#explosion-nombre").textContent = platos[actual].nombre;
  if (si) setTimeout(() => $("#explosion-cerrar").focus({ preventScroll: true }), 50);
}
$("#explosion-cerrar").addEventListener("click", () => explotar(false));

/* ---------- Armala a tu gusto ---------- */
function abrirArmar() {
  const p = platos[actual];
  if (!p.armable || modo || D.agotado(p.id)) return;
  eleccion = porDefecto(p);
  eleccionCambio = false;
  modo = "armando";
  document.body.classList.add("armando");
  $("#armar-titulo").textContent = p.nombre;
  pintarOpciones(p);
  abrirHoja(hojaArmar, { claro: true });
  raiz.style.setProperty("--hoja", hojaArmar.offsetHeight + "px");
}
function salirArmar() {
  if (modo !== "armando") return;
  modo = null;
  document.body.classList.remove("armando");
  if (eleccionCambio) E.cambiar(escenario(actual), null);
}
function elegido(g, it) {
  const v = eleccion[g.id];
  return Array.isArray(v) ? v.includes(it.id) : v === it.id;
}
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
  if (g.tipo === "uno") {
    eleccion[g.id] = it.id;
  } else {
    const sel = new Set(eleccion[g.id] || []);
    sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id);
    eleccion[g.id] = [...sel];
  }
  $$(".chip", gEl).forEach(c => c.setAttribute("aria-pressed", elegido(g, g.items.find(x => String(x.id) === c.dataset.item))));
  eleccionCambio = true;
  E.cambiar(escenario(actual), { ...eleccion });
  $("#armar-agregar").textContent = `Agregar · ${plata(precioDe(p, eleccion))}`;
});
$("#armar-agregar").addEventListener("click", () => {
  const p = platos[actual];
  const el = { ...eleccion };
  if (!miMesa()) { cerrarHoja(true); return pedirNombre(() => agregar(p, el)); }
  agregar(p, el);
  cerrarHoja();
});

/* ---------- El pedido de la mesa ---------- */
const sub = lineas => lineas.reduce((s, l) => s + l.precio * l.cant, 0);
function lineaHtml(l, mia) {
  const p = porId(l.plato);
  return `<li class="linea">
    ${fotoRedonda(p, l.eleccion)}
    <div class="linea__info"><b>${esc(p.nombre)}</b>${l.detalle ? `<small>${esc(l.detalle)}</small>` : ""}<span class="linea__precio">${plata(l.precio * l.cant)}</span></div>
    ${mia ? `<div class="cantidad">
        <button type="button" data-menos="${l.id}" aria-label="Uno menos de ${esc(p.nombre)}">−</button>
        <output>${l.cant}</output>
        <button type="button" data-mas="${l.id}" aria-label="Uno más de ${esc(p.nombre)}">+</button>
      </div>` : `<span class="linea__cant" aria-label="${l.cant} ${l.cant === 1 ? "unidad" : "unidades"}">×${l.cant}</span>`}
  </li>`;
}
function pintarPedido() {
  const m = miMesa();
  if (!m) return cerrarHoja(true);
  const n = m.comensales.length;
  $("#pedido-mesa").textContent = `Mesa ${mesa} · ${n} ${n === 1 ? "persona" : "personas"}`;
  const ul = $("#pedido-lineas");
  const vacio = !m.carrito.length;
  const quienes = new Set(m.carrito.map(l => l.comensal));
  $("#pedido-campo").hidden = vacio;
  $("#pedido-mandar").disabled = vacio;
  $("#pedido-total").textContent = plata(sub(m.carrito));
  $("#pedido-mandar").textContent = quienes.size > 1 ? "Mandar el pedido de la mesa" : "Mandar el pedido";
  $("#pedido-aclara").textContent = quienes.size > 1
    ? `Sale todo junto, lo de las ${quienes.size} personas. Pagan al final.`
    : "Pagan al final, cuando pidan la cuenta.";
  const yoC = miComensal();
  const gente = [yoC, ...m.comensales.filter(c => c.id !== yo)];
  const sinElegir = gente.filter(c => !quienes.has(c.id));
  const faltan = !sinElegir.length ? "" : `<li class="sin-elegir"><span class="avatares">${sinElegir.slice(0, 4).map(c => avatar(c, "avatar--chico")).join("")}</span><span>${
    sinElegir.length === 1 && sinElegir[0].id === yo ? "Vos todavía no elegiste nada."
    : `${esc(lista(sinElegir.map(c => (c.id === yo ? "Vos" : c.nombre))))} todavía no ${sinElegir.length === 1 ? "eligió" : "eligieron"}.`}</span></li>`;
  if (vacio) {
    ul.innerHTML = `<li class="vacio"><b>Nada por acá todavía</b>Deslizá la carta y tocá Agregar. Lo que sumen los demás desde sus celus también aparece acá.</li>`;
    return;
  }
  ul.innerHTML = gente.filter(c => quienes.has(c.id)).map(c => {
    const suyas = m.carrito.filter(l => l.comensal === c.id);
    return `<li class="persona">
      <div class="persona__cabeza">${avatar(c)}<b>${c.id === yo ? "Vos" : esc(c.nombre)}</b><span>${plata(sub(suyas))}</span></div>
      <ul class="lineas">${suyas.map(l => lineaHtml(l, c.id === yo)).join("")}</ul>
    </li>`;
  }).join("") + faltan;
  llenarFotos(ul);
}
$("#pedido-lineas").addEventListener("click", e => {
  const b = e.target.closest("[data-mas], [data-menos]");
  if (!b) return;
  D.cantidad(yo, b.dataset.mas || b.dataset.menos, b.dataset.mas ? 1 : -1);
  pintarPedido();
  pintarPastilla();
});
pastilla.addEventListener("click", () => { if (!miMesa()) return; pintarPedido(); abrirHoja(hojaPedido); });
$("#pedido-mandar").addEventListener("click", async () => {
  const b = $("#pedido-mandar");
  if (b.disabled) return;
  b.disabled = true;
  const p = await D.mandar(yo, $("#pedido-nota").value);
  b.disabled = false;
  if (!p) return avisar("No se pudo mandar. Probá de nuevo.");
  $("#pedido-nota").value = "";
  pintarPastilla();
  cerrarHoja(true);
  abrirSeguimiento(p.id);
});

/* ---------- Seguimiento: cada ronda, con lo de cocina y lo de barra ---------- */
const PASOS = [
  { id: "nuevo",      nombre: "Recibido",   titulo: "¡Recibido!",      color: "#E8663D" },
  { id: "preparando", nombre: "Preparando", titulo: "Preparando",      color: "#C2185B" },
  { id: "listo",      nombre: "Listo",      titulo: "¡Sale!",          color: "#2F6FE0" },
  { id: "entregado",  nombre: "En la mesa", titulo: "¡Buen provecho!", color: "#1F9D57" },
];
const RECHAZADO = { id: "rechazado", nombre: "No se tomó", titulo: "No se tomó", color: "#8A847E" };
const pasoDe = id => PASOS.find(x => x.id === id) || RECHAZADO;
let rondaVista = null;

function bajada(p, estado) {
  const donde = lista(Object.keys(p.partes).map(e => estacion(e).donde));
  return {
    nuevo: `Ya llegó a ${donde}.`,
    preparando: "Lo están preparando ahora mismo.",
    listo: "Está listo y va camino a la mesa.",
    entregado: "Si se les antoja algo más, pídanlo desde acá.",
    rechazado: "El local no pudo tomar este pedido. Llamá al mozo y lo ven.",
  }[estado];
}
function mesaParaSeguir() {
  const c = miComensal();
  return c ? D.mesa(c.sesion) : null;
}
function pintarSeguimiento() {
  const m = mesaParaSeguir();
  if (!m || !m.pedidos.length || m.sesion.cerrada) { if (!seg.hidden) cerrarSeguimiento(); return; }
  const rondas = [...m.pedidos].sort((a, b) => b.creado - a.creado);
  const u = rondas.find(p => p.id === rondaVista)
    || rondas.find(p => !["entregado", "rechazado"].includes(D.estadoPedido(p))) || rondas[0];
  rondaVista = u.id;
  const estado = D.estadoPedido(u);
  const paso = pasoDe(estado);
  const k = PASOS.indexOf(paso);
  seg.style.setProperty("--paso", paso.color);
  $("#seg-numero").textContent = `Mesa ${mesa} · Ronda ${u.ronda}`;
  $("#seg-titulo").textContent = paso.titulo;
  $("#seg-bajada").textContent = bajada(u, estado);
  $("#seg-pasos").hidden = estado === "rechazado";
  $("#seg-pasos").innerHTML = PASOS.map((x, j) =>
    `<li class="paso${j < k ? " hecho" : j === k ? " ahora" : ""}" style="--color:${x.color}"><b>${x.nombre}</b></li>`).join("");
  const partes = Object.entries(u.partes);
  $("#seg-partes").hidden = partes.length < 2 || estado === "rechazado";
  $("#seg-partes").innerHTML = partes.map(([e, pa]) => {
    const x = pasoDe(pa.estado);
    return `<li style="--color:${x.color}"><b>${esc(estacion(e).nombre)}</b><span>${x.nombre}</span></li>`;
  }).join("");
  const ul = $("#seg-items");
  ul.innerHTML = u.items.map(it => {
    const p = porId(it.plato);
    const c = m.comensales.find(x => x.id === it.comensal);
    return `<li>${fotoRedonda(p, it.eleccion)}<span><b>${it.cant}× ${esc(it.nombre)}</b>${it.detalle ? `<small>${esc(it.detalle)}</small>` : ""}${c ? `<em class="de">${avatar(c, "avatar--chico")}${c.id === yo ? "Vos" : esc(c.nombre)}</em>` : ""}</span><span class="precio">${plata(it.precio * it.cant)}</span></li>`;
  }).join("");
  llenarFotos(ul);
  const otras = rondas.filter(p => p !== u);
  $("#seg-rondas").hidden = !otras.length;
  $("#seg-rondas").innerHTML = otras.map(p => {
    const x = pasoDe(D.estadoPedido(p));
    return `<li><button type="button" data-ronda="${p.id}"><i style="--color:${x.color}"></i><span>Ronda ${p.ronda}</span><small>${x.nombre}</small><b>${plata(p.total)}</b></button></li>`;
  }).join("");
  const validas = m.pedidos.filter(p => !p.rechazado);
  const total = validas.reduce((s, p) => s + p.total, 0);
  $("#seg-mesa").textContent = validas.length > 1
    ? `La mesa lleva ${plata(total)} en ${validas.length} rondas. Pagan al final.`
    : `Total: ${plata(total)}. Pagan al final, cuando pidan la cuenta.`;
}
function abrirSeguimiento(id) {
  const m = mesaParaSeguir();
  if (!m || !m.pedidos.length) return;
  rondaVista = id || null;
  pintarSeguimiento();
  seg.hidden = false;
  seg.scrollTop = 0;
  document.body.classList.add("bloqueada");
  requestAnimationFrame(() => requestAnimationFrame(() => seg.classList.add("abierta")));
  E.pausar(true);
}
function cerrarSeguimiento(despues) {
  E.pausar(false);
  seg.classList.remove("abierta");
  setTimeout(() => { seg.hidden = true; }, 480);
  if (!modo && !hojaAbierta && gracias.hidden) document.body.classList.remove("bloqueada");
  if (despues) setTimeout(despues, 200);
}
$("#seg-cerrar").addEventListener("click", () => cerrarSeguimiento());
$("#seg-mas").addEventListener("click", () => cerrarSeguimiento());
$("#seg-mozo").addEventListener("click", () => cerrarSeguimiento(() => abrirMozo(false)));
$("#seg-cuenta").addEventListener("click", () => cerrarSeguimiento(() => abrirMozo(true)));
$("#seg-rondas").addEventListener("click", e => {
  const b = e.target.closest("[data-ronda]");
  if (!b) return;
  rondaVista = b.dataset.ronda;
  pintarSeguimiento();
  seg.scrollTo({ top: 0, behavior: MOVIMIENTO ? "smooth" : "auto" });
});

function pintarEstado() {
  const chip = $("#btn-estado");
  const m = miMesa();
  const enCurso = m && m.pedidos.filter(p => !["entregado", "rechazado"].includes(D.estadoPedido(p))).sort((a, b) => b.creado - a.creado)[0];
  chip.hidden = !enCurso;
  $("#barra").classList.toggle("con-estado", !!enCurso);
  if (enCurso) chip.textContent = pasoDe(D.estadoPedido(enCurso)).nombre;
}
$("#btn-estado").addEventListener("click", () => abrirSeguimiento());

/* ---------- Mozo y cuenta ---------- */
let pago = L.pagos[0], propina = L.propinas[1] ?? 0, dividir = "junto", enPartes = 0;
function abrirMozo(conCuenta) {
  if (!mesa) return avisar("Para llamar al mozo, escaneá el código QR de tu mesa.");
  if (!miMesa()) return pedirNombre(() => abrirMozo(conCuenta));
  $("#mozo-mesa").textContent = `Mesa ${mesa}`;
  $("#cuenta").hidden = true;
  $("#cuenta-pie").hidden = true;
  $("#mozo-cuenta").setAttribute("aria-expanded", "false");
  enPartes = 0;
  pintarMozoEstado();
  abrirHoja(hojaMozo);
  if (conCuenta) mostrarCuenta();
}
function pintarMozoEstado() {
  const m = miMesa();
  const el = $("#mozo-estado");
  if (!m) { el.hidden = true; return; }
  const dice = [];
  const llamado = m.llamados.filter(l => l.tipo === "mozo").sort((a, b) => b.creado - a.creado)[0];
  if (llamado && !llamado.atendido) dice.push(llamado.comensal === yo ? `Ya llamaste al mozo (${hace(llamado.creado)}).` : `${nombreEn(m, llamado.comensal)} ya llamó al mozo (${hace(llamado.creado)}).`);
  else if (llamado && Date.now() - llamado.atendido.t < 180e3) dice.push(`${D.nombreEquipo(llamado.atendido.quien)} va para la mesa.`);
  const cuenta = m.llamados.find(l => l.tipo === "cuenta" && !l.atendido);
  if (cuenta) {
    dice.push(cuenta.comensal === yo ? `Pediste la cuenta (${hace(cuenta.creado)}).` : `${nombreEn(m, cuenta.comensal)} pidió la cuenta (${hace(cuenta.creado)}).`);
    if (cuenta.toma) dice.push(`${D.nombreEquipo(cuenta.toma)} se la lleva.`);
  }
  el.hidden = !dice.length;
  el.textContent = dice.join(" ");
}
function mostrarCuenta() {
  $("#cuenta").hidden = false;
  $("#cuenta-pie").hidden = false;
  $("#mozo-cuenta").setAttribute("aria-expanded", "true");
  pintarCuenta();
}
function numerosCuenta() {
  const m = miMesa();
  const validas = m.pedidos.filter(p => !p.rechazado);
  const conPropina = x => Math.round(x * (1 + propina / 100));
  const consumo = validas.reduce((s, p) => s + p.total, 0);
  const items = validas.flatMap(p => p.items);
  const porPersona = m.comensales
    .map(c => ({ comensal: c.id, nombre: c.nombre, total: conPropina(items.filter(i => i.comensal === c.id).reduce((s, i) => s + i.precio * i.cant, 0)) }))
    .filter(x => x.total > 0);
  if (!enPartes) enPartes = Math.max(2, m.comensales.length);
  return { m, consumo, total: conPropina(consumo), porPersona };
}
function pintarCuenta() {
  const m = miMesa();
  if (!m) return;
  const { consumo, total, porPersona } = numerosCuenta();
  $("#cuenta-pago").innerHTML = L.pagos.map(x => `<button type="button" class="chip" data-pago="${esc(x)}" aria-pressed="${x === pago}">${esc(x)}</button>`).join("");
  $("#cuenta-propina").innerHTML = L.propinas.map(x => `<button type="button" class="chip" data-propina="${x}" aria-pressed="${x === propina}">${x ? x + " %" : "Sin propina"}</button>`).join("");
  $("#cuenta-dividir").innerHTML = Object.entries({ junto: "Todo junto", igual: "En partes iguales", "cada-uno": "Cada uno lo suyo" })
    .map(([k, v]) => `<button type="button" class="chip" data-dividir="${k}" aria-pressed="${k === dividir}">${v}</button>`).join("");
  $("#cuenta-numeros").innerHTML = consumo
    ? `<dt>Lo que pidieron</dt><dd>${plata(consumo)}</dd><dt>Propina</dt><dd>${plata(total - consumo)}</dd><dt>Total</dt><dd class="fuerte">${plata(total)}</dd>`
    : `<dt>Todavía no pidieron nada en esta mesa.</dt><dd></dd>`;
  // Lo elegido y sin mandar no está en la cuenta: que se sepa antes de pedirla
  const sinMandar = m.carrito.map(l => `${porId(l.plato).nombre}${l.comensal === yo ? "" : " de " + nombreEn(m, l.comensal)}`);
  $("#cuenta-ojo").hidden = !sinMandar.length;
  $("#cuenta-ojo").textContent = sinMandar.length
    ? `Ojo: ${lista(sinMandar)} todavía no se ${sinMandar.length === 1 ? "mandó" : "mandaron"}, así que no ${sinMandar.length === 1 ? "está" : "están"} en la cuenta.`
    : "";
  const division = $("#cuenta-division");
  division.hidden = !consumo || dividir === "junto";
  if (dividir === "igual") {
    division.innerHTML = `<div class="en-partes">
      <span>Entre</span>
      <div class="cantidad"><button type="button" data-partes="-1" aria-label="Una persona menos">−</button><output>${enPartes}</output><button type="button" data-partes="1" aria-label="Una persona más">+</button></div>
      <span>personas</span><b>${plata(Math.ceil(total / enPartes))} <small>cada una</small></b>
    </div>`;
  } else if (dividir === "cada-uno") {
    const orden = [...porPersona].sort((a, b) => (b.comensal === yo) - (a.comensal === yo));
    division.innerHTML = `<ul class="por-persona">${orden.map(x => {
      const c = m.comensales.find(y => y.id === x.comensal);
      return `<li>${avatar(c)}<span class="por-persona__nombre">${x.comensal === yo ? "Vos" : esc(x.nombre)}</span><b>${plata(x.total)}</b></li>`;
    }).join("")}</ul><p class="nota-pie">Cada uno paga lo que pidió, con su parte de la propina.</p>`;
  }
  $("#cuenta-pedir").disabled = !consumo;
  $("#cuenta-pedir").textContent = consumo ? `Pedir la cuenta · ${plata(total)}` : "Pedir la cuenta";
}
$("#btn-mozo").addEventListener("click", () => abrirMozo(false));
$("#mozo-llamar").addEventListener("click", async () => {
  const r = await D.llamar(yo, "mozo");
  cerrarHoja();
  if (!r) return avisar("No se pudo llamar. Probá de nuevo.");
  avisar(r.ya ? "Ya le avisaron al mozo: está por ir." : "Listo, ya le avisamos al mozo.");
});
$("#mozo-cuenta").addEventListener("click", mostrarCuenta);
$("#cuenta").addEventListener("click", e => {
  const a = e.target.closest("[data-pago]"), b = e.target.closest("[data-propina]");
  const c = e.target.closest("[data-dividir]"), d = e.target.closest("[data-partes]");
  if (a) pago = a.dataset.pago;
  if (b) propina = +b.dataset.propina;
  if (c) dividir = c.dataset.dividir;
  if (d) enPartes = Math.max(2, Math.min(30, enPartes + +d.dataset.partes));
  if (a || b || c || d) pintarCuenta();
});
$("#cuenta-pedir").addEventListener("click", async () => {
  const { total, porPersona } = numerosCuenta();
  const r = await D.llamar(yo, "cuenta", {
    pago, propina, dividir, total,
    partes: dividir === "igual" ? enPartes : null,
    porPersona: dividir === "cada-uno" ? porPersona : null,
  });
  cerrarHoja();
  if (!r) return avisar("No se pudo pedir la cuenta. Probá de nuevo.");
  avisar(`Listo, pediste la cuenta: ${plata(total)} con ${pago}.`);
});

/* ---------- Cuando cobran: gracias ---------- */
function mostrarGracias() {
  if (!gracias.hidden) return;
  if (hojaAbierta) cerrarHoja(true);
  if (modo === "explotando") explotar(false);
  if (!seg.hidden) { seg.classList.remove("abierta"); seg.hidden = true; }
  const c = miComensal();
  $("#gracias-local").textContent = `${L.nombre} · Mesa ${mesa}`;
  $("#gracias-titulo").textContent = c ? `¡Gracias, ${c.nombre}!` : "¡Gracias por venir!";
  $("#gracias-texto").textContent = `Esperamos verlos pronto en ${L.nombre}. La mesa ${mesa} ya quedó libre para los que siguen.`;
  gracias.hidden = false;
  document.body.classList.add("bloqueada");
  requestAnimationFrame(() => requestAnimationFrame(() => gracias.classList.add("abierta")));
  E.pausar(true);
}
$("#gracias-otra").addEventListener("click", () => {
  olvidarYo();
  antes = null;
  gracias.classList.remove("abierta");
  setTimeout(() => { gracias.hidden = true; }, 450);
  document.body.classList.remove("bloqueada");
  E.pausar(false);
  refrescar();
  setTimeout(() => pedirNombre(), 520);
});

/* ---------- Toda la carta ---------- */
function abrirCarta() {
  $("#carta-sobre").textContent = L.nombre;
  const cuerpo = $("#carta-grilla");
  cuerpo.innerHTML = L.categorias.map(c => `
    <h3 class="carta-cat">${esc(c.nombre)}</h3>
    <div class="grilla">${platos.map((p, i) => p.categoria !== c.id ? "" : `
      <button class="tarjeta${D.agotado(p.id) ? " agotado" : ""}" type="button" data-ir="${i}" style="${["f1", "f2", "f3", "f4", "t"].map(k => `--${k}:${paleta(p)[k]}`).join(";")}">
        <span class="tarjeta__foto" data-foto="${p.id}"></span>
        <b>${esc(p.nombre)}</b><span class="tarjeta__precio">${plata(p.precio)}</span>
      </button>`).join("")}
    </div>`).join("");
  abrirHoja(hojaCarta);
  platos.forEach(p => E.foto(p).then(url => {
    const s = cuerpo.querySelector(`[data-foto="${p.id}"]`);
    if (s && url) s.innerHTML = `<img src="${url}" alt="">`;
  }));
}
$("#btn-carta").addEventListener("click", abrirCarta);
$("#carta-grilla").addEventListener("click", e => {
  const b = e.target.closest("[data-ir]");
  if (!b) return;
  cerrarHoja(true);
  irA(+b.dataset.ir, false);
});

/* ---------- Agotados (los marca la cocina o la barra) ---------- */
function pintarAgotados() {
  platos.forEach((p, i) => {
    const s = secciones[i], no = D.agotado(p.id);
    s.classList.toggle("agotado", no);
    const armar = s.querySelector('[data-accion="armar"]');
    if (armar) armar.disabled = no;
    const sellos = s.querySelector(".plato__sellos");
    const hay = sellos.querySelector(".sello--agotado");
    if (no && !hay) sellos.insertAdjacentHTML("afterbegin", `<span class="sello sello--agotado">Agotado hoy</span>`);
    if (!no && hay) hay.remove();
  });
  pintarAgregar();
}

/* ---------- La mesa, arriba: quiénes están ---------- */
function pintarGente() {
  const el = $("#marca-gente");
  const m = miMesa();
  const gente = m ? m.comensales : [];
  const html = gente.slice(0, 4).map(c => avatar(c, "avatar--mini")).join("")
    + (gente.length > 4 ? `<span class="avatar avatar--mini avatar--mas" aria-hidden="true">+${gente.length - 4}</span>` : "");
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
  el.hidden = !gente.length;
  el.setAttribute("aria-label", `En la mesa: ${lista(gente.map(c => (c.id === yo ? "vos" : c.nombre)))}`);
}
$("#marca-gente").addEventListener("click", () => { if (miMesa()) { pintarPedido(); abrirHoja(hojaPedido); } });

/* ---------- Avisos: lo que hacen los demás, al instante ---------- */
const colaAvisos = [];
let avisando = false;
function avisar(texto, persona) {
  if (!$("#panel").hidden) return;                 // en el panel no: ahí trabaja el equipo
  colaAvisos.push({ texto, persona });
  if (colaAvisos.length > 4) colaAvisos.splice(0, colaAvisos.length - 4);
  if (!avisando) siguienteAviso();
}
function siguienteAviso() {
  const a = $("#aviso");
  const x = colaAvisos.shift();
  if (!x) { avisando = false; a.classList.remove("visible"); return; }
  avisando = true;
  const poner = () => {
    a.innerHTML = (x.persona ? avatar(x.persona, "avatar--aviso") : "") + `<span>${esc(x.texto)}</span>`;
    a.classList.add("visible");
    setTimeout(siguienteAviso, colaAvisos.length ? 2300 : 3000);
  };
  if (a.classList.contains("visible")) { a.classList.remove("visible"); setTimeout(poner, 280); }
  else poner();
}

// Compara cómo estaba la mesa con cómo está y cuenta lo que hicieron los demás.
let antes = null;
function vigilar() {
  const c = miComensal();
  const m = c ? D.mesa(c.sesion) : null;
  if (!m) { antes = null; return; }
  const ahora = {
    sesion: m.sesion.id,
    gente: new Set(m.comensales.map(x => x.id)),
    lineas: new Map(m.carrito.map(l => [l.id, l.cant])),
    rondas: new Map(m.pedidos.map(p => [p.id, { estado: D.estadoPedido(p), partes: Object.fromEntries(Object.entries(p.partes).map(([k, v]) => [k, v.estado])) }])),
    llamados: new Map(m.llamados.map(l => [l.id, { atendido: !!l.atendido, toma: l.toma }])),
    cerrada: !!m.sesion.cerrada,
  };
  const a = antes;
  antes = ahora;
  if (ahora.cerrada && (!a || !a.cerrada)) return mostrarGracias();
  if (!a || a.sesion !== ahora.sesion) return;
  const quien = id => m.comensales.find(x => x.id === id);
  m.comensales.forEach(x => { if (!a.gente.has(x.id) && x.id !== yo) avisar(`${x.nombre} se sumó a la mesa`, x); });
  m.carrito.forEach(l => {
    if (l.comensal !== yo && l.cant > (a.lineas.get(l.id) || 0)) avisar(`${nombreEn(m, l.comensal)} sumó ${porId(l.plato).nombre}`, quien(l.comensal));
  });
  m.pedidos.forEach(p => {
    const prev = a.rondas.get(p.id);
    const e = D.estadoPedido(p);
    if (!prev) {
      if (p.por !== yo) avisar(`${nombreEn(m, p.por)} mandó el pedido de la mesa`, quien(p.por));
      return;
    }
    if (!seg.hidden) return;                        // si está mirando el seguimiento, ya lo ve
    if (e === "rechazado" && prev.estado !== "rechazado") return avisar(`No se tomó la ronda ${p.ronda}: llamá al mozo.`);
    Object.entries(p.partes).forEach(([est, pa]) => {
      if (pa.estado === "listo" && prev.partes[est] !== "listo" && e !== "listo") avisar(estacion(est).sale);
    });
    if (e !== prev.estado) {
      if (e === "preparando") avisar("Ya están preparando el pedido.");
      if (e === "listo") avisar("¡Sale el pedido! Va camino a la mesa.");
      if (e === "entregado") avisar("¡Buen provecho!");
    }
  });
  m.llamados.forEach(l => {
    const prev = a.llamados.get(l.id);
    if (!prev) {
      if (l.comensal !== yo) avisar(l.tipo === "mozo" ? `${nombreEn(m, l.comensal)} llamó al mozo` : `${nombreEn(m, l.comensal)} pidió la cuenta`, quien(l.comensal));
      return;
    }
    if (l.tipo === "mozo" && l.atendido && !prev.atendido) avisar(`${D.nombreEquipo(l.atendido.quien)} va para la mesa`);
    if (l.tipo === "cuenta" && l.toma && !prev.toma) avisar(`${D.nombreEquipo(l.toma)} les trae la cuenta`);
  });
}

function refrescar() {
  pintarAgotados();
  pintarPastilla();
  pintarEstado();
  pintarGente();
  vigilar();
  if (!seg.hidden) pintarSeguimiento();
  if (hojaAbierta === hojaPedido) pintarPedido();
  if (hojaAbierta === hojaMozo) { pintarMozoEstado(); if (!$("#cuenta").hidden) pintarCuenta(); }
  if (hojaAbierta === hojaBienvenida) pintarBienvenida();
}

/* ---------- Pista para la primera vez ---------- */
let pista = null, pistaPuesta = false;
function ponerPista() {
  if (pistaPuesta || actual > 0) return;
  pistaPuesta = true;
  pista = document.createElement("div");
  pista.className = "pista";
  pista.innerHTML = `<svg width="18" height="18" aria-hidden="true"><use href="#i-giro"/></svg>Girá el plato · deslizá para ver más`;
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
  E.estilo(nombre);
  pintarColores();
  const i = Math.max(0, actual);
  actual = -1;
  activar(i);
  alDeslizar();
  $("#pastilla-fotos").dataset.html = "";
  pintarPastilla();
  if (!seg.hidden) pintarSeguimiento();
  if (guardar) { try { localStorage.setItem("cartaviva.estilo", nombre); } catch { /* sin almacenamiento */ } }
}
function estiloInicial() {
  const h = location.hash.slice(1);
  if (ESTILOS[h]) return h;
  try { const g = localStorage.getItem("cartaviva.estilo"); if (ESTILOS[g]) return g; } catch { /* nada */ }
  return estilo;
}
$("#estilos").addEventListener("click", e => {
  const b = e.target.closest("[data-estilo]");
  if (b) usarEstilo(b.dataset.estilo, true);
});
addEventListener("hashchange", () => { const h = location.hash.slice(1); if (ESTILOS[h]) usarEstilo(h, true); });

/* ---------- Arranque ---------- */
function iniciar() {
  document.title = `${L.nombre} · la carta`;
  $("#marca-nombre").textContent = L.nombre;
  $("#marca-mesa").textContent = mesa ? `Mesa ${mesa}` : "La carta";
  $("#btn-mozo").hidden = !mesa;
  if (L.demo) { $("#cinta").hidden = false; raiz.classList.add("con-cinta"); }

  estilo = estiloInicial();
  raiz.dataset.estilo = estilo;
  $$("#estilos [data-estilo]").forEach(b => b.setAttribute("aria-pressed", b.dataset.estilo === estilo));
  pintarCarta();
  const hay3D = E.iniciar({ lienzo: $("#lienzo"), etiquetas: $("#etiquetas") });
  if (hay3D) { E.estilo(estilo); secciones.forEach((s, i) => E.vincular(escenario(i), platos[i])); }
  else document.body.classList.add("sin-3d");
  if (document.fonts) document.fonts.load('800 40px "Archivo"').catch(() => {});    // la caja de papas lo usa

  yo = D.yo(mesa);
  refrescar();
  alDeslizar();
  secciones[0].classList.add("entrada");
  // Si todavía no entró a la mesa, se presenta (el plato queda a la vista, arriba).
  if (mesa && !miMesa() && location.hash !== "#mesas" && location.hash !== "#cocina") setTimeout(() => { if (!hojaAbierta && seg.hidden && $("#panel").hidden) pedirNombre(); else ponerPista(); }, 900);
  else ponerPista();

  feed.addEventListener("scroll", () => { if (!cuadroPedido) { cuadroPedido = true; requestAnimationFrame(alDeslizar); } }, { passive: true });
  addEventListener("resize", () => requestAnimationFrame(alDeslizar));
  feed.addEventListener("click", e => {
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    alDeslizar();                       // por si el toque llegó antes que el cuadro
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
    if (!$("#panel").hidden) return;
    if (e.key === "Escape") {
      if (hojaAbierta) cerrarHoja();
      else if (modo === "explotando") explotar(false);
      else if (!seg.hidden) cerrarSeguimiento();
      return;
    }
    if (modo || hojaAbierta || !seg.hidden || !gracias.hidden || e.target.closest("input, textarea")) return;
    if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); irA(actual + 1, true); }
    if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); irA(actual - 1, true); }
  });
  addEventListener("carta:datos", refrescar);
  addEventListener("carta:error", e => avisar(e.detail || "No se pudo. Probá de nuevo."));
  setInterval(() => { if (hojaAbierta === hojaMozo) pintarMozoEstado(); }, 30000);

  // Fotos de todos los platos, de a poco, para la carta completa y el pedido
  const precargar = () => platos.forEach(p => E.foto(p));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(precargar, 1500));
}

iniciar();
