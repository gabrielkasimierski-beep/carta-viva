/* =============================================================================
   CARTA VIVA — el panel del local
   Lo usa todo el equipo a la vez, cada uno desde su dispositivo y con su nombre:
     · MESAS  — el plano: quién está sentado en cada mesa, qué pidió, qué hay que
                llevar, quién llama al mozo o pide la cuenta. Tocando una mesa se ve
                todo lo que pasó en ella y se la cobra.
     · COCINA y BARRA — las comandas de cada estación: nuevas, preparando, listas.
     · CARTA  — lo que se terminó (deja de poder pedirse en todas las mesas al instante).
     · QR     — los códigos para imprimir y pegar en cada mesa.
   Cada uno entra con su PIN y ve lo suyo primero: el mozo, las mesas de su zona; la
   cocina y la barra, sus comandas; la encargada, todo. Lo que hace cada uno queda
   firmado ("Diego la empezó", "Carla fue a la mesa"), así no van dos a lo mismo.
   ============================================================================= */

const L = window.LOCAL, D = window.Datos, E = window.Escena;
const $ = (s, r = document) => r.querySelector(s);
const plata = n => "$" + Math.round(n).toLocaleString("es-AR");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icono = (id, tam = 16) => `<svg width="${tam}" height="${tam}" aria-hidden="true"><use href="#${id}"/></svg>`;
const lista = xs => (xs.length <= 1 ? xs[0] || "" : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);
const panel = $("#panel"), entrada = $("#entrada-equipo"), adentro = $("#panel-adentro");
const detalle = $("#detalle"), veloDetalle = $("#detalle-velo");

const minutos = ms => Math.max(0, Math.floor(ms / 60000));
const hace = ms => {
  const m = minutos(ms);
  if (m < 1) return "recién";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
};
const haceCuanto = ms => { const x = hace(ms); return x === "recién" ? x : "hace " + x; };
const hora = t => new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

/* ---------- El equipo y lo que ve cada uno ---------- */
await D.listo;
const equipo = () => D.equipo() || [];
const mesasDelLocal = () => (D.mesas() || []).length ? D.mesas() : L.mesas;
const ESTACIONES = L.estaciones && L.estaciones.length ? L.estaciones : [{ id: "cocina", nombre: "Cocina" }];
const EST = ESTACIONES.map(e => e.id);
const persona = id => equipo().find(e => e.id === id) || null;
const nombreEst = id => (ESTACIONES.find(e => e.id === id) || { nombre: id }).nombre;
const VISTAS = { mesas: "Mesas", ...Object.fromEntries(ESTACIONES.map(e => [e.id, e.nombre])), carta: "Carta", qr: "QR" };
function vistasDe(p) {
  if (!p) return [];
  if (p.rol === "encargado") return ["mesas", ...EST, "carta", "qr"];
  if (p.rol === "mozo") return ["mesas", ...EST];
  if (EST.includes(p.rol)) return [p.rol, "carta"];
  return ["mesas"];
}
const avatarEquipo = (p, clase = "") => `<span class="avatar avatar--equipo ${clase}" style="--av:${p.color}" aria-hidden="true">${esc(p.nombre[0])}</span>`;
const avatarComensal = (c, clase = "") => `<span class="avatar ${clase}" style="--av:${c.color}" aria-hidden="true">${esc((c.nombre || "?")[0].toUpperCase())}</span>`;

// Quién está usando este dispositivo (cada pestaña puede ser alguien distinto)
let yo = null;

/* ---------- Estados ---------- */
const ESTADO_MESA = { libre: "Libre", eligiendo: "Eligiendo", nuevo: "Pidió", preparando: "Preparando", listo: "Para llevar", entregado: "Comiendo" };
const ESTADO_PARTE = { nuevo: "Nuevo", preparando: "Preparando", listo: "Listo para llevar", entregado: "En la mesa" };
const URGENCIA = ["nuevo", "listo", "preparando", "entregado"];
const PASO = {
  nuevo:      { boton: "Aceptar",    sig: "preparando" },
  preparando: { boton: "Está listo", sig: "listo" },
  listo:      { boton: "Llevado",    sig: "entregado" },
};
const FIRMA = { preparando: "La empezó", listo: "La terminó", entregado: "La llevó" };
const COLUMNAS = [
  { id: "nuevo",      titulo: "Nuevas" },
  { id: "preparando", titulo: "Preparando" },
  { id: "listo",      titulo: "Para llevar" },
];
const RELOJ = { barra: [5, 10] };             // minutos para ponerse amarillo y rojo (cocina: 10 y 20)

let vista = "mesas";
let mesaAbierta = null;
let liberando = null, rechazando = null, dobleT;
let historiaAbierta = false;
let eligiendo = null, pin = "", pinMal = false;

const datosMesa = n => mesasDelLocal().find(m => m.n === n) || { n, zona: "", lugares: 4 };
const platoDe = id => L.platos.find(p => p.id === id);

// El dibujo del plato (armado como lo pidieron). Si todavía no está hecho, se completa después.
function fotoHtml(id, eleccion, clase) {
  const p = platoDe(id);
  if (!p) return `<span class="${clase}"></span>`;
  const url = E.fotoLista(p, eleccion || null);
  const el = eleccion ? ` data-eleccion="${esc(JSON.stringify(eleccion))}"` : "";
  return `<span class="${clase}" style="--c:${p.color}"${url ? "" : ` data-foto-plato="${id}"${el}`}>${url ? `<img src="${url}" alt="">` : ""}</span>`;
}
function llenarFotos(raiz) {
  raiz.querySelectorAll("[data-foto-plato]").forEach(s => {
    const el = s.dataset.eleccion ? JSON.parse(s.dataset.eleccion) : null;
    const id = s.dataset.fotoPlato;
    s.removeAttribute("data-foto-plato");
    E.foto(platoDe(id), el).then(url => { if (url && !s.firstChild) s.innerHTML = `<img src="${url}" alt="">`; });
  });
}
// Cambia el contenido solo si cambió (así no salta el scroll ni parpadea con cada aviso)
function poner(el, html) {
  if (el._html === html) return false;
  const scrolls = [...el.querySelectorAll("[data-scroll]")].map(x => [x.dataset.scroll, x.scrollTop, x.scrollLeft]);
  el.innerHTML = html;
  el._html = html;
  scrolls.forEach(([k, t, l]) => { const x = el.querySelector(`[data-scroll="${k}"]`); if (x) { x.scrollTop = t; x.scrollLeft = l; } });
  llenarFotos(el);
  return true;
}

/* ---------- Cómo está cada mesa ---------- */
function mesaInfo(m, d) {
  const s = d.sesiones.find(x => x.mesa === m.n && !x.cerrada) || null;
  const base = { ...m, s, tuya: L.demo && m.n === L.mesaDemo };
  if (!s) return { ...base, estado: "libre", comensales: [], pedidos: [], validos: [], carrito: [], listos: [], total: 0 };
  const pedidos = d.pedidos.filter(p => p.sesion === s.id).sort((a, b) => a.creado - b.creado);
  const validos = pedidos.filter(p => !p.rechazado);
  const partes = validos.flatMap(p => Object.entries(p.partes).map(([est, pa]) => ({ p, est, ...pa })));
  const llamados = d.llamados.filter(l => l.sesion === s.id && !l.atendido);
  return {
    ...base, pedidos, validos,
    comensales: d.comensales.filter(c => c.sesion === s.id),
    carrito: d.carrito.filter(l => l.sesion === s.id),
    estado: URGENCIA.find(e => partes.some(x => x.estado === e)) || "eligiendo",
    total: validos.reduce((t, p) => t + p.total, 0),
    desde: s.abierta,
    llama: llamados.find(l => l.tipo === "mozo"),
    cuenta: llamados.find(l => l.tipo === "cuenta"),
    listos: partes.filter(x => x.estado === "listo"),
  };
}
const comensalDe = (d, id) => d.comensales.find(c => c.id === id);
// "2 Limonada · 1 Fugazzeta": junta lo mismo aunque lo hayan pedido personas distintas
const resumenItems = items => {
  const juntos = new Map();
  items.forEach(i => { const k = i.nombre + (i.detalle ? ` (${i.detalle})` : ""); juntos.set(k, (juntos.get(k) || 0) + i.cant); });
  return [...juntos].map(([k, n]) => `${n} ${k}`).join(" · ");
};
const dividirTexto = l => (l.dividir === "igual" ? `en ${l.partes} partes` : l.dividir === "cada-uno" ? "cada uno lo suyo" : "todo junto");

/* ---------- Mesas ---------- */
function tareas(d, mesas) {
  const t = [];
  mesas.forEach(m => {
    if (m.llama) t.push({ t: m.llama.creado, m, tipo: "mozo", l: m.llama });
    if (m.cuenta && !m.cuenta.toma) t.push({ t: m.cuenta.creado, m, tipo: "cuenta", l: m.cuenta });
    m.listos.forEach(x => t.push({ ...x, t: x.cambio, m, tipo: "listo" }));
  });
  const p = persona(yo);
  const mia = x => (p.rol === "mozo" && p.zona === x.m.zona ? 1 : 0);
  return t.sort((a, b) => mia(b) - mia(a) || a.t - b.t);
}
function tareaHtml(x, d) {
  const p = persona(yo);
  const tuZona = p.rol === "mozo" && p.zona === x.m.zona ? `<span class="aviso-fila__zona">Tu zona</span>` : "";
  const fila = (clase, ico, texto, sub, boton) => `<article class="aviso-fila aviso-fila--${clase}">
    <span class="aviso-fila__icono">${icono(ico, 18)}</span>
    <span class="aviso-fila__texto">${texto}${tuZona}<small>${sub}</small></span>
    ${boton}
  </article>`;
  if (x.tipo === "mozo") {
    const c = comensalDe(d, x.l.comensal);
    return fila("mozo", "i-campana", `<b>Mesa ${x.m.n}</b> llama al mozo`, `${c ? esc(c.nombre) + " · " : ""}${esc(x.m.zona)} · ${haceCuanto(Date.now() - x.l.creado)}`,
      `<button type="button" data-atender="${x.l.id}">Voy</button>`);
  }
  if (x.tipo === "cuenta") {
    return fila("cuenta", "i-cuenta", `<b>Mesa ${x.m.n}</b> pide la cuenta`, `${esc(x.l.pago)} · ${dividirTexto(x.l)} · ${plata(x.l.total)} · ${haceCuanto(Date.now() - x.l.creado)}`,
      `<button type="button" data-atender="${x.l.id}">Llevo la cuenta</button>`);
  }
  const items = x.p.items.filter(i => i.estacion === x.est);
  return fila("listo", "i-bandeja", `<b>Mesa ${x.m.n}</b> · ${esc(nombreEst(x.est))}: listo para llevar`, `${esc(resumenItems(items))} · ${haceCuanto(Date.now() - x.cambio)}`,
    `<button type="button" data-mover="${x.p.id}" data-estacion="${x.est}" data-a="entregado">Llevado</button>`);
}

function sillas(m, cuantas, desde) {
  const ocupadas = Math.min(m.comensales.length, m.lugares);
  return `<span class="mesa__sillas" aria-hidden="true">${Array.from({ length: cuantas }, (_, i) => `<i class="${desde + i < ocupadas ? "ocupada" : ""}"></i>`).join("")}</span>`;
}
function mesaHtml(m) {
  const n = m.comensales.length;
  const dice = [ESTADO_MESA[m.estado]];
  if (n) dice.push(`${n} ${n === 1 ? "persona" : "personas"}`);
  if (m.llama) dice.push("llama al mozo");
  if (m.cuenta) dice.push(m.cuenta.toma ? `cuenta: la lleva ${D.nombreEquipo(m.cuenta.toma)}` : "pide la cuenta");
  if (m.listos.length) dice.push("hay algo para llevar");
  if (m.total) dice.push(plata(m.total));
  const clases = ["mesa", "mesa--" + m.estado, "mesa--l" + m.lugares, m.llama && "mesa--llama", m.cuenta && !m.cuenta.toma && "mesa--cuenta", miZona(m) && "mesa--mia"].filter(Boolean).join(" ");
  const arriba = Math.ceil(m.lugares / 2);
  return `<button type="button" class="${clases}" data-mesa="${m.n}" aria-label="Mesa ${m.n}: ${esc(dice.join(", "))}">
    ${sillas(m, arriba, 0)}
    <span class="mesa__tabla">
      <span class="mesa__arriba">
        <span class="mesa__num">${m.n}</span>
        ${m.tuya ? `<span class="mesa__tuya">tu mesa</span>` : ""}
        <span class="mesa__avisos">
          ${m.listos.length ? `<span class="aviso-mesa aviso-mesa--listo" title="Hay algo para llevar">${icono("i-bandeja", 15)}</span>` : ""}
          ${m.llama ? `<span class="aviso-mesa" title="Llama al mozo">${icono("i-campana", 15)}</span>` : ""}
          ${m.cuenta ? `<span class="aviso-mesa aviso-mesa--cuenta${m.cuenta.toma ? " tomada" : ""}" title="Pide la cuenta">${icono("i-cuenta", 15)}</span>` : ""}
        </span>
      </span>
      <span class="mesa__estado">${ESTADO_MESA[m.estado]}</span>
      ${n ? `<span class="mesa__gente">${m.comensales.slice(0, 5).map(c => avatarComensal(c, "avatar--mini")).join("")}${n > 5 ? `<span class="avatar avatar--mini avatar--mas">+${n - 5}</span>` : ""}</span>` : ""}
      <span class="mesa__meta">${m.s ? `${m.total ? plata(m.total) + " · " : ""}${hace(Date.now() - m.desde)}` : `${m.lugares} lugares`}</span>
    </span>
    ${sillas(m, m.lugares - arriba, arriba)}
  </button>`;
}
const miZona = m => { const p = persona(yo); return p && p.rol === "mozo" && p.zona === m.zona; };

function pintarMesas(d) {
  const mesas = mesasDelLocal().map(m => mesaInfo(m, d));
  const ocupadas = mesas.filter(m => m.estado !== "libre");
  const personas = ocupadas.reduce((s, m) => s + m.comensales.length, 0);
  const vendido = d.pedidos.filter(p => !p.rechazado).reduce((s, p) => s + p.total, 0);
  const cobradas = d.sesiones.filter(s => s.cerrada).length;
  const lista_ = tareas(d, mesas);
  const yoP = persona(yo);
  let zonas = [...new Set(mesasDelLocal().map(m => m.zona))];
  if (yoP.rol === "mozo" && zonas.includes(yoP.zona)) zonas = [yoP.zona, ...zonas.filter(z => z !== yoP.zona)];
  return `
    <div class="resumen">
      <p><b>${ocupadas.length}</b> de ${mesas.length} mesas ocupadas</p>
      <p><b>${personas}</b> ${personas === 1 ? "persona" : "personas"} con la carta abierta</p>
      <p><b>${plata(vendido)}</b> vendido hoy${cobradas ? ` · ${cobradas} ${cobradas === 1 ? "mesa cobrada" : "mesas cobradas"}` : ""}</p>
    </div>
    ${lista_.length ? `<h3 class="zona__titulo">Para hacer ahora</h3><div class="avisos">${lista_.map(x => tareaHtml(x, d)).join("")}</div>`
      : `<p class="todo-tranqui">${icono("i-listo", 16)} Nada pendiente: nadie llama y no hay nada para llevar.</p>`}
    ${zonas.map(z => `
      <section class="zona" aria-label="${esc(z)}">
        <h3 class="zona__titulo">${esc(z)}${yoP.rol === "mozo" && yoP.zona === z ? ` <span class="zona__tuya">tu zona</span>` : ""}</h3>
        <div class="plano">${mesas.filter(m => m.zona === z).map(mesaHtml).join("")}</div>
      </section>`).join("")}
    <ul class="referencias" aria-label="Qué significa cada color">
      ${["libre", "eligiendo", "nuevo", "preparando", "listo", "entregado"].map(e => `<li class="ref estado--${e}">${ESTADO_MESA[e]}</li>`).join("")}
      <li class="ref ref--aviso">Llama al mozo</li>
      <li class="ref ref--aviso ref--cuenta">Pide la cuenta</li>
    </ul>`;
}

/* ---------- Detalle de una mesa ---------- */
function itemsHtml(items, d, conQuien = true) {
  return items.map(it => {
    const c = conQuien && comensalDe(d, it.comensal);
    const bajo = [it.detalle, c ? `para ${c.nombre}` : ""].filter(Boolean).join(" · ");
    return `<li><b>${it.cant}</b>${fotoHtml(it.plato, it.eleccion, "item-foto")}<span>${esc(it.nombre)}${bajo ? `<small>${esc(bajo)}</small>` : ""}</span></li>`;
  }).join("");
}
function botonPaso(p, est, pa) {
  const paso = PASO[pa.estado];
  return paso ? `<button type="button" class="boton-paso paso--${pa.estado}" data-mover="${p.id}" data-estacion="${est}" data-a="${paso.sig}">${paso.boton}</button>` : "";
}
function botonNo(p) {
  const si = rechazando === p.id;
  return `<button type="button" class="boton-no${si ? " confirmando" : ""}" data-rechazar="${p.id}" title="Por ejemplo, si no hay nadie sentado en esa mesa">${si ? "¿Seguro? Tocá de nuevo" : "No tomar"}</button>`;
}
function rondaHtml(p, d) {
  const por = comensalDe(d, p.por);
  const partes = Object.entries(p.partes);
  return `<article class="pedido-p${p.rechazado ? " pedido-p--no" : ""}">
    <header><b>Ronda ${p.ronda}</b><small>Pedido ${p.numero}${por ? ` · lo mandó ${esc(por.nombre)}` : ""} · ${haceCuanto(Date.now() - p.creado)}</small></header>
    ${p.rechazado ? `<p class="pedido-p__no">No se tomó · ${esc(D.nombreEquipo(p.rechazado.quien))}</p>` : partes.map(([est, pa]) => `
      <div class="parte">
        <span class="estado-p estado--${pa.estado}">${esc(nombreEst(est))} · ${ESTADO_PARTE[pa.estado]}</span>
        ${pa.quien ? `<small>${esc(D.nombreEquipo(pa.quien))}</small>` : ""}
        ${botonPaso(p, est, pa)}
      </div>`).join("")}
    <ul class="lista-items">${itemsHtml(p.items, d)}</ul>
    ${p.nota ? `<p class="nota-p">${esc(p.nota)}</p>` : ""}
    ${!p.rechazado && partes.every(([, pa]) => pa.estado === "nuevo") ? `<div class="pedido-p__no-tomar">${botonNo(p)}</div>` : ""}
  </article>`;
}
function cuentaHtml(l, m, d) {
  const c = comensalDe(d, l.comensal);
  const propina = l.total - m.total;
  let division = "";
  if (l.dividir === "igual") division = `<p class="detalle__division">En ${l.partes} partes iguales: <b>${plata(Math.ceil(l.total / l.partes))}</b> cada una</p>`;
  if (l.dividir === "cada-uno" && l.porPersona) division = `<ul class="detalle__personas">${l.porPersona.map(x => {
    const cc = comensalDe(d, x.comensal);
    return `<li>${cc ? avatarComensal(cc, "avatar--chico") : ""}<span>${esc(x.nombre)}</span><b>${plata(x.total)}</b></li>`;
  }).join("")}</ul>`;
  return `<section class="cuenta-p">
    <header>${icono("i-cuenta", 16)}<b>Pidieron la cuenta</b><small>${c ? esc(c.nombre) + " · " : ""}${haceCuanto(Date.now() - l.creado)}</small></header>
    <dl class="detalle__cuenta">
      <dt>Consumo</dt><dd>${plata(m.total)}</dd>
      <dt>Propina${l.propina ? ` (${l.propina} %)` : ""}</dt><dd>${plata(propina)}</dd>
      <dt>A cobrar · ${esc(l.pago)}</dt><dd class="fuerte">${plata(l.total)}</dd>
    </dl>
    ${division}
    ${l.toma ? `<p class="cuenta-p__quien">${avatarEquipo(persona(l.toma) || { nombre: "?", color: "#999" }, "avatar--chico")} La lleva ${esc(D.nombreEquipo(l.toma))} · ${haceCuanto(Date.now() - l.tomado)}</p>`
      : `<button type="button" class="cuenta-p__tomar" data-atender="${l.id}">Llevo la cuenta</button>`}
  </section>`;
}
function pintarDetalle(d) {
  if (mesaAbierta == null || vista !== "mesas" || panel.hidden || !yo) {
    detalle.hidden = true;
    veloDetalle.hidden = true;
    detalle._html = null;
    return;
  }
  const m = mesaInfo(datosMesa(mesaAbierta), d);
  const nombres = m.comensales.map(c => c.nombre);
  const eligen = [...new Set(m.carrito.map(l => l.comensal))].map(id => (comensalDe(d, id) || {}).nombre).filter(Boolean);
  const html = `
    <header class="detalle__cabeza">
      <div>
        <p class="detalle__zona">${esc(m.zona)} · ${m.lugares} lugares${m.tuya ? " · tu mesa" : ""}</p>
        <h3 class="detalle__titulo" id="detalle-titulo">Mesa ${m.n}</h3>
      </div>
      <span class="estado-p estado--${m.estado}">${ESTADO_MESA[m.estado]}</span>
      <button type="button" class="detalle__cerrar" data-cerrar-detalle aria-label="Cerrar">${icono("i-cerrar", 18)}</button>
    </header>
    <div class="detalle__cuerpo" data-scroll="cuerpo">
      ${m.s ? `<div class="detalle__gente">
        <span class="avatares">${m.comensales.slice(0, 6).map(c => avatarComensal(c)).join("")}</span>
        <span><b>${esc(lista(nombres))}</b><small>${nombres.length} ${nombres.length === 1 ? "persona" : "personas"} con la carta · abrieron la mesa ${haceCuanto(Date.now() - m.desde)}</small></span>
      </div>` : ""}
      ${m.llama ? tareaHtml({ tipo: "mozo", m, l: m.llama }, d) : ""}
      ${m.cuenta ? cuentaHtml(m.cuenta, m, d) : ""}
      ${m.listos.map(x => tareaHtml({ ...x, m, tipo: "listo" }, d)).join("")}
      ${m.carrito.length ? `<section class="eligiendo">
        <p><b>Están eligiendo</b> · ${esc(lista(eligen))} ${eligen.length === 1 ? "tiene" : "tienen"} ${m.carrito.reduce((s, l) => s + l.cant, 0)} cosas sin mandar</p>
        <ul class="lista-items">${itemsHtml(m.carrito.map(l => ({ ...l, nombre: platoDe(l.plato).nombre })), d)}</ul>
      </section>` : ""}
      ${m.pedidos.slice().reverse().map(p => rondaHtml(p, d)).join("")}
      ${!m.s ? `<p class="detalle__vacia">Mesa libre. Cuando alguien escanee el QR de la mesa aparece acá, con su nombre, y se ve lo que va eligiendo.</p>` : ""}
      ${m.s && m.s.historia.length ? `<details class="historia"${historiaAbierta ? " open" : ""}>
        <summary>Qué pasó en la mesa</summary>
        <ol>${m.s.historia.slice(-16).reverse().map(h => `<li><time>${hora(h.t)}</time><span>${esc(h.texto)}</span></li>`).join("")}</ol>
      </details>` : ""}
    </div>
    ${m.s ? `<footer class="detalle__pie">
      <dl class="detalle__cuenta"><dt>Consumo${m.validos.length ? ` · ${m.validos.length} ${m.validos.length === 1 ? "ronda" : "rondas"}` : ""}</dt><dd class="fuerte">${plata(m.total)}</dd></dl>
      <button type="button" class="detalle__liberar${liberando === m.n ? " confirmando" : ""}" data-liberar="${m.n}">${
        liberando === m.n ? "Tocá de nuevo para liberarla" : m.total ? "Cobrada · liberar la mesa" : "Liberar la mesa (no pidieron nada)"}</button>
    </footer>` : ""}`;
  poner(detalle, html);
  detalle.hidden = false;
  veloDetalle.hidden = false;
}
function abrirMesa(n) {
  mesaAbierta = n;
  liberando = null;
  historiaAbierta = false;
  pintar();
  setTimeout(() => detalle.querySelector("[data-cerrar-detalle]")?.focus({ preventScroll: true }), 30);
}
function cerrarDetalle() {
  const volver = mesaAbierta;
  mesaAbierta = null;
  liberando = null;
  pintar();
  if (volver != null) panel.querySelector(`[data-mesa="${volver}"]`)?.focus({ preventScroll: true });
}
// Las acciones que no tienen vuelta atrás piden un segundo toque
function dosToques(cual, valor, hacer) {
  clearTimeout(dobleT);
  if ((cual === "liberar" ? liberando : rechazando) === valor) {
    liberando = rechazando = null;
    hacer();
    return;
  }
  liberando = cual === "liberar" ? valor : null;
  rechazando = cual === "rechazar" ? valor : null;
  pintar();
  dobleT = setTimeout(() => { liberando = rechazando = null; pintar(); }, 3500);
}

/* ---------- Cocina y barra: las comandas ---------- */
function ticketHtml({ p, pa, items }, est, d) {
  const min = minutos(Date.now() - p.creado);
  const [ojo, tarde] = RELOJ[est] || [10, 20];
  const reloj = min < ojo ? "bien" : min < tarde ? "ojo" : "tarde";
  const zona = datosMesa(p.mesa).zona;
  const nueva = p.ronda === 1 && pa.estado === "nuevo";
  return `<article class="ticket">
    <header class="ticket__cabeza"><b>Mesa ${p.mesa}</b><span class="reloj reloj--${reloj}">${icono("i-reloj", 13)}${min < 1 ? "recién" : min + " min"}</span></header>
    <p class="ticket__sub">${nueva ? `<span class="ticket__nueva" title="Es lo primero que pide esta mesa: si no hay nadie sentado, no lo tomes">Mesa nueva</span>` : ""}Ronda ${p.ronda} · Pedido ${p.numero}${zona ? " · " + esc(zona) : ""}${L.demo && p.mesa === L.mesaDemo ? " · tu mesa" : ""}</p>
    <ul class="lista-items">${itemsHtml(items, d)}</ul>
    ${p.nota ? `<p class="ticket__nota">${esc(p.nota)}</p>` : ""}
    <div class="ticket__acciones">${botonPaso(p, est, pa)}${pa.estado === "nuevo" ? botonNo(p) : ""}</div>
    ${pa.quien && FIRMA[pa.estado] ? `<p class="ticket__firma">${FIRMA[pa.estado]} ${esc(D.nombreEquipo(pa.quien))} · ${haceCuanto(Date.now() - pa.cambio)}</p>` : ""}
  </article>`;
}
function comandas(d, est) {
  const abiertas = new Set(d.sesiones.filter(s => !s.cerrada).map(s => s.id));
  return d.pedidos
    .filter(p => !p.rechazado && p.partes[est] && abiertas.has(p.sesion))
    .map(p => ({ p, pa: p.partes[est], items: p.items.filter(i => i.estacion === est) }));
}
function pintarEstacion(d, est) {
  const todas = comandas(d, est);
  const hechas = d.pedidos.filter(p => p.partes[est] && p.partes[est].estado === "entregado").length;
  return `
    <div class="tablero" data-scroll="tablero">${COLUMNAS.map(c => {
      const lista_ = todas.filter(x => x.pa.estado === c.id).sort((a, b) => a.p.creado - b.p.creado);
      return `<section class="columna" aria-label="${c.titulo}">
        <h3 class="columna__titulo"><span class="punto estado--${c.id}"></span>${c.titulo}<span class="columna__cuenta">${lista_.length}</span></h3>
        ${lista_.length ? lista_.map(x => ticketHtml(x, est, d)).join("") : `<p class="columna__vacia">Nada por ahora</p>`}
      </section>`;
    }).join("")}</div>
    <p class="entregados">${esc(nombreEst(est))}: ${hechas} ${hechas === 1 ? "comanda entregada" : "comandas entregadas"} hoy.</p>`;
}

/* ---------- Carta: lo que hay y lo que se terminó ---------- */
function pintarStock(d) {
  return `
    <p class="panel__ayuda">Lo que marques como agotado deja de poder pedirse en todas las mesas, al instante.</p>
    ${L.categorias.map(c => `
      <h3 class="zona__titulo">${esc(c.nombre)} <span class="zona__est">${esc(nombreEst(c.estacion || EST[0]))}</span></h3>
      <ul class="stock">${L.platos.filter(p => p.categoria === c.id).map(p => {
        const a = d.agotados.find(x => x.id === p.id);
        return `<li class="${a ? "agotado" : ""}">
          ${fotoHtml(p.id, null, "stock__foto")}
          <span class="stock__nombre"><b>${esc(p.nombre)}</b><small>${a ? `Agotado${a.quien ? " por " + esc(D.nombreEquipo(a.quien)) : ""} · ${haceCuanto(Date.now() - a.t)}` : plata(p.precio)}</small></span>
          <button type="button" class="interruptor" role="switch" aria-checked="${!a}" aria-label="${esc(p.nombre)}: ${a ? "agotado" : "hay"}" data-agotar="${p.id}">${a ? "Agotado" : "Hay"}</button>
        </li>`;
      }).join("")}</ul>`).join("")}`;
}

/* ---------- QR de las mesas ---------- */
let qrLib = null, qrError = false;
function enlaceMesa(n) {
  const base = L.enlace || location.origin + location.pathname;
  return `${base}${base.includes("?") ? "&" : "?"}mesa=${n}`;
}
// En la demo, "Abrir la mesa" abre una pestaña que es otra persona (como otro celular)
const enlaceProbar = n => enlaceMesa(n) + "&nuevo";
function qrSvg(texto) {
  const qr = qrLib(0, "M");
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  let camino = "";
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (qr.isDark(f, c)) camino += `M${c} ${f}h1v1h-1z`;
  return `<svg class="tarjeta-qr__svg" viewBox="-3 -3 ${n + 6} ${n + 6}" role="img" aria-label="Código QR"><rect x="-3" y="-3" width="${n + 6}" height="${n + 6}" rx="2" fill="#fff"/><path d="${camino}" fill="#141214" shape-rendering="crispEdges"/></svg>`;
}
function cargarQR() {
  if (qrLib || qrError) return;
  import("https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm")
    .then(m => { qrLib = m.default || m.qrcode || m; pintar(); })
    .catch(() => { qrError = true; pintar(); });
}
function pintarQR() {
  if (!qrLib && !qrError) cargarQR();
  return `
    <div class="qr-intro">
      <p class="panel__ayuda">Imprimí esta hoja y pegá cada código en su mesa. Al escanearlo, el celular abre la carta <b>en esa mesa</b>: todos los que se sientan juntos comparten el mismo pedido, cada uno con su nombre, y la mesa queda abierta hasta que se cobra.</p>
      <button type="button" class="boton-imprimir" data-imprimir>${icono("i-imprimir", 16)} Imprimir</button>
    </div>
    ${qrError ? `<p class="panel__ayuda">No se pudieron dibujar los códigos (hace falta internet). Probá de nuevo en un rato.</p>` : ""}
    ${L.demo && !L.enlace ? `<p class="panel__ayuda panel__ayuda--chica">En la demo cada código apunta a esta misma página. Cuando la carta esté en internet, apuntan a la dirección del local. Con "Abrir la mesa" probás en otra pestaña, como si fuera otro celular.</p>` : ""}
    <div class="qr-grilla">${L.mesas.map(m => {
      const url = enlaceMesa(m.n);
      return `<article class="tarjeta-qr">
        <p class="tarjeta-qr__local">${esc(L.nombre)}</p>
        <div class="tarjeta-qr__codigo">${qrLib ? qrSvg(url) : `<span class="tarjeta-qr__cargando"></span>`}</div>
        <p class="tarjeta-qr__mesa">Mesa <b>${m.n}</b></p>
        <p class="tarjeta-qr__texto">Escaneá con la cámara, mirá los platos en 3D y pedí desde tu celu.</p>
        ${L.demo ? `<a class="tarjeta-qr__probar" href="${esc(enlaceProbar(m.n))}" target="_blank" rel="noopener" title="Se abre como si fuera otro celular">Abrir la mesa ${m.n} ${icono("i-flecha", 13)}</a>` : ""}
      </article>`;
    }).join("")}</div>`;
}

/* ---------- Entrar: ¿quién sos? ---------- */
function pintarEntrada() {
  const p = persona(eligiendo);
  entrada.innerHTML = !p ? `
    <div class="entrada-equipo__marco">
      <p class="panel__sobre">Panel del local</p>
      <h2 class="entrada-equipo__titulo">${esc(L.nombre)}</h2>
      <p class="entrada-equipo__pregunta">¿Quién sos?</p>
      <div class="gente-equipo">${equipo().map(e => `
        <button type="button" class="persona-equipo" data-elegir="${e.id}">
          ${avatarEquipo(e, "avatar--grande")}
          <b>${esc(e.nombre)}</b><small>${esc(e.puesto)}${e.zona ? " · " + esc(e.zona) : ""}</small>
        </button>`).join("")}
      </div>
      <p class="entrada-equipo__ayuda">Cada uno entra desde su celular o desde la tablet de la cocina, con su PIN. Todo lo que hace queda con su nombre.</p>
      <a class="panel__salir" href="#carta">Volver a la carta ${icono("i-flecha", 14)}</a>
    </div>` : `
    <div class="entrada-equipo__marco entrada-equipo__marco--pin">
      <button type="button" class="entrada-equipo__volver" data-volver>${icono("i-volver", 14)} Volver</button>
      ${avatarEquipo(p, "avatar--grande")}
      <p class="entrada-equipo__pregunta">Hola, ${esc(p.nombre)}</p>
      <p class="entrada-equipo__rol">${esc(p.puesto)}${p.zona ? " · " + esc(p.zona) : ""}</p>
      <div class="pin__puntos${pinMal ? " mal" : ""}" role="status" aria-label="${pin.length} de 4 números${pinMal ? ": PIN incorrecto" : ""}">${[0, 1, 2, 3].map(i => `<i class="${i < pin.length ? "lleno" : ""}"></i>`).join("")}</div>
      <div class="pin__teclado">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"].map(k =>
        k === "" ? "<span></span>" : `<button type="button" data-tecla="${k}"${k === "borrar" ? ' aria-label="Borrar"' : ""}>${k === "borrar" ? icono("i-borrar", 22) : k}</button>`).join("")}
      </div>
      <p class="entrada-equipo__ayuda">${pinMal ? "Ese PIN no es. Probá de nuevo." : L.demo ? "En la demo, el PIN de todos es 1234." : "Tu PIN de 4 números."}</p>
    </div>`;
}
function tecla(k) {
  const p = persona(eligiendo);
  if (!p) return;
  pinMal = false;
  if (k === "borrar") pin = pin.slice(0, -1);
  else if (pin.length < 4) pin += k;
  if (pin.length === 4) {
    const probado = pin;
    pin = "";
    D.entrarEquipo(p.id, probado).then(r => {
      if (r && r.ok) return entrarComo(p.id);
      pinMal = true;
      pintarEntrada();
    });
  }
  pintarEntrada();
}
function entrarComo(id) {
  yo = id;
  eligiendo = null;
  pin = "";
  const vs = vistasDe(persona(id));
  const pedida = location.hash.slice(1);
  vista = vs.includes(pedida) ? pedida : vs[0];
  vistos = null;
  despertarAudio();
  mostrar();
}
function salir(aOtro) {
  yo = null;
  D.salirEquipo();
  mesaAbierta = null;
  eligiendo = aOtro || null;
  pin = "";
  mostrar();
}

/* ---------- Arriba: quién sos, quién más está y el sonido ---------- */
function pintarTurno() {
  const p = persona(yo);
  return `
    <div class="turno__yo">
      ${avatarEquipo(p)}
      <span><b>${esc(p.nombre)}</b><small>${esc(p.puesto)}${p.zona ? " · " + esc(p.zona) : ""}</small></span>
      <button type="button" class="turno__boton" data-salir>Cambiar</button>
    </div>
    <div class="turno__equipo">
      <span class="turno__rotulo">En turno</span>
      ${equipo().filter(e => e.id !== yo).map(e => `<button type="button" class="turno__otro" data-cambiar="${e.id}" title="Entrar como ${esc(e.nombre)} (${esc(e.puesto)})" aria-label="Entrar como ${esc(e.nombre)}, ${esc(e.puesto)}">${avatarEquipo(e)}</button>`).join("")}
    </div>
    <button type="button" class="turno__boton turno__sonido" data-sonido aria-pressed="${sonido}">${icono(sonido ? "i-sonido" : "i-mudo", 16)}<span>${sonido ? "Con sonido" : "Sin sonido"}</span></button>`;
}
function pintarTabs(d) {
  const p = persona(yo);
  const vs = vistasDe(p);
  const mesas = mesasDelLocal().map(m => mesaInfo(m, d));
  const pendientes = tareas(d, mesas).length;
  return vs.map(v => {
    let n = "";
    if (v === "mesas" && pendientes) n = `<span class="insignia insignia--alerta">${pendientes}</span>`;
    if (EST.includes(v)) {
      const c = comandas(d, v).filter(x => x.pa.estado === "nuevo" || x.pa.estado === "preparando").length;
      if (c) n = `<span class="insignia">${c}</span>`;
    }
    return `<button role="tab" type="button" id="tab-${v}" aria-selected="${v === vista}" aria-controls="vista-${v}" data-vista="${v}">${VISTAS[v]}${n}</button>`;
  }).join("");
}

/* ---------- Sonido: un "ding" cuando hay algo nuevo para vos ---------- */
let sonido = (() => { try { return localStorage.getItem("cartaviva.sonido") !== "no"; } catch { return true; } })();
let audio = null, vistos = null;
function despertarAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch { /* sin audio */ }
}
function ding() {
  if (!sonido || !audio) return;
  try {
    const t = audio.currentTime;
    [988, 1319].forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.13);
      g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.13 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.13 + 0.4);
      o.connect(g).connect(audio.destination);
      o.start(t + i * 0.13);
      o.stop(t + i * 0.13 + 0.45);
    });
    navigator.vibrate && navigator.vibrate([60, 40, 60]);
  } catch { /* sin audio */ }
}
function novedades(d) {
  const p = persona(yo);
  const abiertas = new Set(d.sesiones.filter(s => !s.cerrada).map(s => s.id));
  const claves = new Set();
  const atiende = p.rol === "mozo" || p.rol === "encargado";
  d.llamados.forEach(l => { if (atiende && !l.atendido && !l.toma && abiertas.has(l.sesion)) claves.add("l" + l.id); });
  d.pedidos.forEach(x => {
    if (x.rechazado || !abiertas.has(x.sesion)) return;
    Object.entries(x.partes).forEach(([est, pa]) => {
      if (pa.estado === "nuevo" && (p.rol === est || p.rol === "encargado")) claves.add(`n${x.id}${est}`);
      if (pa.estado === "listo" && p.rol === "mozo") claves.add(`r${x.id}${est}`);
    });
  });
  if (vistos && [...claves].some(k => !vistos.has(k))) ding();
  vistos = claves;
}

/* ---------- Armado general ---------- */
function mostrar() {
  if (panel.hidden) return;
  yo = yo && persona(yo) ? yo : null;
  entrada.hidden = !!yo;
  adentro.hidden = !yo;
  if (!yo) {
    detalle.hidden = veloDetalle.hidden = true;
    pintarEntrada();
    return;
  }
  const vs = vistasDe(persona(yo));
  if (!vs.includes(vista)) vista = vs[0];
  pintar();
}
function pintar() {
  if (panel.hidden || !yo) return;
  const d = D.todo();
  $("#panel-titulo").textContent = L.nombre;
  poner($("#panel-tabs"), pintarTabs(d));
  poner($("#turno"), pintarTurno());
  const cont = $("#vistas");
  const html = vista === "mesas" ? pintarMesas(d)
    : vista === "carta" ? pintarStock(d)
    : vista === "qr" ? pintarQR()
    : pintarEstacion(d, vista);
  cont.setAttribute("aria-labelledby", "tab-" + vista);
  if (cont._vista !== vista) { cont._html = null; cont._vista = vista; }
  poner(cont, html);
  pintarDetalle(d);
  $("#panel-pie").hidden = !L.demo;
  novedades(d);
}
function elegirVista(v) {
  if (!vistasDe(persona(yo)).includes(v)) return;
  vista = v;
  if (v !== "mesas") mesaAbierta = null;
  pintar();
  panel.scrollTop = 0;
}

const RUTAS = ["panel", "mesas", "qr", ...EST];
function segunDireccion() {
  const h = location.hash.slice(1);
  const ver = RUTAS.includes(h);
  panel.hidden = !ver;
  document.body.classList.toggle("con-panel", ver);
  E.pausar(ver);
  if (!ver) { mesaAbierta = null; detalle.hidden = veloDetalle.hidden = true; return; }
  yo = yo || D.soyEquipo();
  if (yo) {
    const vs = vistasDe(persona(yo));
    if (vs.includes(h)) vista = h;
  }
  mostrar();
  panel.scrollTop = 0;
}

panel.addEventListener("click", e => {
  const t = e.target;
  const b = sel => t.closest(sel);
  if (b("[data-elegir]")) { eligiendo = b("[data-elegir]").dataset.elegir; pin = ""; pinMal = false; return pintarEntrada(); }
  if (b("[data-volver]")) { eligiendo = null; pin = ""; pinMal = false; return pintarEntrada(); }
  if (b("[data-tecla]")) return tecla(b("[data-tecla]").dataset.tecla);
  if (b("[data-vista]")) return elegirVista(b("[data-vista]").dataset.vista);
  if (b("[data-salir]")) return salir();
  if (b("[data-cambiar]")) return salir(b("[data-cambiar]").dataset.cambiar);
  if (b("[data-sonido]")) {
    sonido = !sonido;
    try { localStorage.setItem("cartaviva.sonido", sonido ? "si" : "no"); } catch { /* nada */ }
    if (sonido) { despertarAudio(); ding(); }
    return pintar();
  }
  if (t === veloDetalle || b("[data-cerrar-detalle]")) return cerrarDetalle();
  if (b("[data-mover]")) { const x = b("[data-mover]").dataset; return D.mover(x.mover, x.estacion, x.a, yo); }
  if (b("[data-rechazar]")) { const id = b("[data-rechazar]").dataset.rechazar; return dosToques("rechazar", id, () => D.rechazar(id, yo)); }
  if (b("[data-atender]")) return D.atender(b("[data-atender]").dataset.atender, yo);
  if (b("[data-liberar]")) {
    const n = +b("[data-liberar]").dataset.liberar;
    return dosToques("liberar", n, () => { mesaAbierta = null; D.cerrarMesa(n, yo); });
  }
  if (b("[data-mesa]")) return abrirMesa(+b("[data-mesa]").dataset.mesa);
  if (b("[data-agotar]")) { const id = b("[data-agotar]").dataset.agotar; return D.agotar(id, !D.agotado(id), yo); }
  if (b("[data-imprimir]")) { try { window.print(); } catch { /* sin impresora */ } return; }
  if (b("#panel-reiniciar")) { mesaAbierta = null; D.reiniciar(); }
});
panel.addEventListener("toggle", e => { if (e.target.matches && e.target.matches(".historia")) historiaAbierta = e.target.open; }, true);
document.addEventListener("keydown", e => {
  if (panel.hidden) return;
  if (!yo && eligiendo && (/^\d$/.test(e.key) || e.key === "Backspace")) { e.preventDefault(); return tecla(e.key === "Backspace" ? "borrar" : e.key); }
  if (e.key === "Escape" && mesaAbierta != null) cerrarDetalle();
});

addEventListener("hashchange", segunDireccion);
addEventListener("carta:datos", pintar);
setInterval(pintar, 20000);
segunDireccion();
