/* =============================================================================
   CARTA VIVA — el panel del local
   Lo usa todo el equipo a la vez, cada uno desde su dispositivo, con su nombre y su PIN.
   Cada persona ve y hace solo lo que le toca (lo elige quien maneja el equipo):
     · PARA HACER — arriba de todo: lo que está listo para llevar, las mesas que llaman
                    al mozo y las que piden la cuenta. Lo nuevo suena, vibra y aparece en
                    un cartel con su botón, en cualquier pantalla.
     · MESAS  — el plano: quién está sentado en cada mesa, qué pidió y cuánto lleva.
     · COCINA y BARRA — las comandas de cada estación, con todo lo que hay que preparar
                    sumado arriba. La pantalla no se apaga.
     · CARTA  — lo que se terminó (deja de poder pedirse en todas las mesas al instante).
     · QR     — los códigos para imprimir y pegar en cada mesa.
     · EQUIPO — sumar personas, su PIN y qué puede ver y hacer cada una.
   Todo queda firmado ("Diego la empezó", "Carla fue a la mesa") y lo que se toca sin
   querer se puede deshacer durante unos segundos.
   ============================================================================= */

const L = window.LOCAL, D = window.Datos, E = window.Escena;
const $ = (s, r = document) => r.querySelector(s);
const plata = n => "$" + Math.round(n).toLocaleString("es-AR");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icono = (id, tam = 16) => `<svg width="${tam}" height="${tam}" aria-hidden="true"><use href="#${id}"/></svg>`;
const lista = xs => (xs.length <= 1 ? xs[0] || "" : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);
const panel = $("#panel"), entrada = $("#entrada-equipo"), adentro = $("#panel-adentro");
const detalle = $("#detalle"), veloDetalle = $("#detalle-velo");
const ahoraEl = $("#ahora"), alertaEl = $("#alerta"), avisoEl = $("#deshacer");

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
const PERMISOS = D.PERMISOS, ROLES = D.ROLES;
const SALON = ["mesas", "atender", "llevar", "cobrar"];
const persona = id => (id && D.persona(id)) || null;
const nombreEst = id => (ESTACIONES.find(e => e.id === id) || { nombre: id }).nombre;
const puestoDe = p => p.puesto || (ROLES.find(r => r.id === p.rol) || {}).nombre || "";

// Quién está usando este dispositivo (cada pestaña puede ser alguien distinto)
let yo = null;
const puede = (permiso, p = persona(yo)) => !!p && (p.permisos || []).includes(permiso);
const deSalon = (p = persona(yo)) => SALON.some(x => puede(x, p));
const puedeMover = (est, a, p = persona(yo)) => (a === "entregado" ? puede("llevar", p) : puede(est, p));
const puedeRechazar = (ped, p = persona(yo)) => puede("mesas", p) || Object.keys(ped.partes).some(e => puede(e, p));
const puedeEditarA = (e, p = persona(yo)) => puede("equipo", p) && (e.rol !== "dueno" || p.rol === "dueno");

const VISTAS = { mesas: "Mesas", ...Object.fromEntries(ESTACIONES.map(e => [e.id, e.nombre])), carta: "Carta", qr: "QR", equipo: "Equipo" };
function vistasDe(p) {
  if (!p) return [];
  const v = [];
  if (deSalon(p)) v.push("mesas");
  EST.forEach(e => { if (puede(e, p)) v.push(e); });
  ["carta", "qr", "equipo"].forEach(x => { if (puede(x, p)) v.push(x); });
  return v;
}
// Quien lleva o atiende pero no ve el plano, tiene su lista de tareas
const nombreVista = (v, p) => (v === "mesas" && !puede("mesas", p) ? "Para hacer" : VISTAS[v]);
const avatarEquipo = (p, clase = "") => `<span class="avatar avatar--equipo ${clase}" style="--av:${p.color}" aria-hidden="true">${esc((p.nombre || "?")[0].toUpperCase())}</span>`;
const avatarComensal = (c, clase = "") => `<span class="avatar ${clase}" style="--av:${c.color}" aria-hidden="true">${esc((c.nombre || "?")[0].toUpperCase())}</span>`;

/* ---------- Estados ---------- */
const ESTADO_MESA = { libre: "Libre", eligiendo: "Eligiendo", nuevo: "Pidió", preparando: "Preparando", listo: "Para llevar", entregado: "Comiendo" };
const ESTADO_PARTE = { nuevo: "Nuevo", preparando: "Preparando", listo: "Listo para llevar", entregado: "En la mesa" };
const URGENCIA = ["nuevo", "listo", "preparando", "entregado"];
const PASO = {
  nuevo:      { boton: "Empezar", sig: "preparando" },
  preparando: { boton: "Listo",   sig: "listo" },
  listo:      { boton: "Llevado", sig: "entregado" },
};
const HECHO = { preparando: "empezada", listo: "lista", entregado: "llevada" };
const FIRMA = { preparando: "La empezó", listo: "La terminó", entregado: "La llevó" };
const COLUMNAS = [
  { id: "nuevo",      titulo: "Nuevas" },
  { id: "preparando", titulo: "Preparando" },
  { id: "listo",      titulo: "Para llevar" },
];
const RELOJ = { barra: [5, 10] };             // minutos para ponerse amarillo y rojo (cocina: 10 y 20)
const RELOJ_LISTO = [3, 6];                   // lo que está listo y nadie lleva se enfría

let vista = "mesas";
let mesaAbierta = null;
let editor = null;                            // la persona que se está editando en Equipo
let liberando = null, rechazando = null, dobleT;
let historiaAbierta = false, verTodo = false;
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

/* ---------- Para hacer ahora: lo que le toca a cada uno ---------- */
function tareas(d, mesas, p = persona(yo)) {
  const t = [];
  mesas.forEach(m => {
    if (m.llama && puede("atender", p)) t.push({ t: m.llama.creado, m, tipo: "mozo", l: m.llama });
    if (m.cuenta && !m.cuenta.toma && puede("cobrar", p)) t.push({ t: m.cuenta.creado, m, tipo: "cuenta", l: m.cuenta });
    if (puede("llevar", p)) m.listos.forEach(x => t.push({ ...x, t: x.cambio, m, tipo: "listo" }));
  });
  const mia = x => (p && p.zona && p.zona === x.m.zona ? 1 : 0);
  return t.sort((a, b) => mia(b) - mia(a) || a.t - b.t);
}
const ICONO_TAREA = { mozo: "i-campana", cuenta: "i-cuenta", listo: "i-bandeja", comanda: "i-fuego" };
function tareaHtml(x, d) {
  const p = persona(yo);
  const espera = Date.now() - x.t;
  const tarde = espera > (x.tipo === "listo" ? RELOJ_LISTO[0] : 3) * 60e3;
  const tuZona = p && p.zona && p.zona === x.m.zona ? `<span class="aviso-fila__zona">Tu zona</span>` : "";
  const fila = (texto, sub, boton) => `<article class="aviso-fila aviso-fila--${x.tipo}${tarde ? " aviso-fila--tarde" : ""}${espera < 12e3 ? " aviso-fila--nueva" : ""}">
    <span class="aviso-fila__icono">${icono(ICONO_TAREA[x.tipo], 18)}</span>
    <span class="aviso-fila__texto">${texto}${tuZona}<small>${sub} · <span class="aviso-fila__cuando">${haceCuanto(espera)}</span></small></span>
    ${boton}
  </article>`;
  if (x.tipo === "mozo") {
    const c = comensalDe(d, x.l.comensal);
    return fila(`<b>Mesa ${x.m.n}</b> llama al mozo`, `${c ? esc(c.nombre) + " · " : ""}${esc(x.m.zona)}`,
      puede("atender") ? `<button type="button" data-atender="${x.l.id}">Voy</button>` : "");
  }
  if (x.tipo === "cuenta") {
    return fila(`<b>Mesa ${x.m.n}</b> pide la cuenta`, `${esc(x.l.pago)} · ${dividirTexto(x.l)} · ${plata(x.l.total)}`,
      puede("cobrar") ? `<button type="button" data-atender="${x.l.id}">Llevo la cuenta</button>` : "");
  }
  const items = x.p.items.filter(i => i.estacion === x.est);
  return fila(`<b>¡Sale! Mesa ${x.m.n}</b> · ${esc(nombreEst(x.est))}`, esc(resumenItems(items)),
    puedeMover(x.est, "entregado") ? `<button type="button" data-mover="${x.p.id}" data-estacion="${x.est}" data-a="entregado">Llevado</button>` : "");
}
function pintarAhora(d) {
  const p = persona(yo);
  if (!deSalon(p)) return "";
  const t = tareas(d, mesasDelLocal().map(m => mesaInfo(m, d)), p);
  if (vista !== "mesas") {
    if (!t.length) return "";
    const n = tipo => t.filter(x => x.tipo === tipo).length;
    const partes = [[n("listo"), "para llevar"], [n("mozo"), n("mozo") === 1 ? "llama al mozo" : "llaman al mozo"], [n("cuenta"), n("cuenta") === 1 ? "pide la cuenta" : "piden la cuenta"]]
      .filter(([k]) => k).map(([k, s]) => `<b>${k}</b> ${s}`);
    return `<button type="button" class="ahora-corto" data-vista="mesas"><span class="ahora-corto__punto" aria-hidden="true"></span><span>Para hacer: ${partes.join(" · ")}</span>${icono("i-flecha", 15)}</button>`;
  }
  if (!t.length) return `<p class="todo-tranqui">${icono("i-listo", 16)} Nada pendiente por ahora. Lo nuevo suena y aparece acá.</p>`;
  const MAX = 4;
  const vis = verTodo ? t : t.slice(0, MAX);
  return `<h3 class="zona__titulo">Para hacer ahora <span class="insignia insignia--alerta">${t.length}</span></h3>
    <div class="avisos">${vis.map(x => tareaHtml(x, d)).join("")}</div>
    ${t.length > MAX ? `<button type="button" class="ahora__mas" data-ver-todo>${verTodo ? "Ver menos" : `Ver ${t.length - MAX} más`}</button>` : ""}`;
}

/* ---------- Mesas ---------- */
function sillas(m, cuantas, desde) {
  const ocupadas = Math.min(m.comensales.length, m.lugares);
  return `<span class="mesa__sillas" aria-hidden="true">${Array.from({ length: cuantas }, (_, i) => `<i class="${desde + i < ocupadas ? "ocupada" : ""}"></i>`).join("")}</span>`;
}
// Mozo y cuenta: una franja al costado de la mesa, que sobresale por arriba
function bandaHtml(m) {
  const cuenta = m.cuenta, llama = m.llama;
  if (!cuenta && !llama) return "";
  const tomada = cuenta && cuenta.toma && !llama;
  const desde = [llama && llama.creado, cuenta && !cuenta.toma && cuenta.creado].filter(Boolean);
  const min = desde.length ? minutos(Date.now() - Math.min(...desde)) : null;
  const tipo = llama && cuenta ? "ambos" : llama ? "mozo" : "cuenta";
  const texto = llama && cuenta ? "Mozo y cuenta" : llama ? "Mozo" : tomada ? "Cuenta en camino" : "Cuenta";
  return `<span class="mesa__banda banda--${tipo}${tomada ? " tomada" : ""}" aria-hidden="true">
    <span class="mesa__banda-iconos">${llama ? icono("i-campana", 15) : ""}${cuenta ? icono("i-cuenta", 15) : ""}</span>
    <span class="mesa__banda-texto">${texto}</span>
    ${min != null ? `<span class="mesa__banda-min">${min < 1 ? "ya" : min + "′"}</span>` : ""}
  </span>`;
}
function mesaHtml(m) {
  const n = m.comensales.length;
  const dice = [ESTADO_MESA[m.estado]];
  if (n) dice.push(`${n} ${n === 1 ? "persona" : "personas"}`);
  if (m.llama) dice.push("llama al mozo");
  if (m.cuenta) dice.push(m.cuenta.toma ? `cuenta: la lleva ${D.nombreEquipo(m.cuenta.toma)}` : "pide la cuenta");
  if (m.listos.length) dice.push("hay algo para llevar");
  if (m.total) dice.push(plata(m.total));
  const banda = bandaHtml(m);
  const clases = ["mesa", "mesa--" + m.estado, "mesa--l" + m.lugares, m.llama && "mesa--llama", m.cuenta && !m.cuenta.toma && "mesa--cuenta", banda && "mesa--banda", miZona(m) && "mesa--mia"].filter(Boolean).join(" ");
  const arriba = Math.ceil(m.lugares / 2);
  return `<button type="button" class="${clases}" data-mesa="${m.n}" aria-label="Mesa ${m.n}: ${esc(dice.join(", "))}">
    ${sillas(m, arriba, 0)}
    <span class="mesa__tabla">
      <span class="mesa__arriba">
        <span class="mesa__num">${m.n}</span>
        ${m.tuya ? `<span class="mesa__tuya">tu mesa</span>` : ""}
        ${m.listos.length ? `<span class="mesa__avisos"><span class="aviso-mesa aviso-mesa--listo" title="Hay algo para llevar">${icono("i-bandeja", 15)}</span></span>` : ""}
      </span>
      <span class="mesa__estado">${ESTADO_MESA[m.estado]}</span>
      ${n ? `<span class="mesa__gente">${m.comensales.slice(0, 5).map(c => avatarComensal(c, "avatar--mini")).join("")}${n > 5 ? `<span class="avatar avatar--mini avatar--mas">+${n - 5}</span>` : ""}</span>` : ""}
      <span class="mesa__meta">${m.s ? `${m.total ? plata(m.total) + " · " : ""}${hace(Date.now() - m.desde)}` : `${m.lugares} lugares`}</span>
      ${banda}
    </span>
    ${sillas(m, m.lugares - arriba, arriba)}
  </button>`;
}
const miZona = m => { const p = persona(yo); return !!(p && p.zona && p.zona === m.zona); };

function pintarMesas(d) {
  const yoP = persona(yo);
  if (!puede("mesas", yoP)) return `<p class="panel__ayuda">Acá arriba te aparece lo que tenés que llevar o atender. Lo nuevo suena y vibra.</p>`;
  const mesas = mesasDelLocal().map(m => mesaInfo(m, d));
  const ocupadas = mesas.filter(m => m.estado !== "libre");
  const personas = ocupadas.reduce((s, m) => s + m.comensales.length, 0);
  const vendido = d.pedidos.filter(p => !p.rechazado).reduce((s, p) => s + p.total, 0);
  const cobradas = d.sesiones.filter(s => s.cerrada).length;
  let zonas = [...new Set(mesasDelLocal().map(m => m.zona))];
  if (yoP.zona && zonas.includes(yoP.zona)) zonas = [yoP.zona, ...zonas.filter(z => z !== yoP.zona)];
  return `
    <div class="resumen">
      <p><b>${ocupadas.length}</b> de ${mesas.length} mesas ocupadas</p>
      <p><b>${personas}</b> ${personas === 1 ? "persona" : "personas"} con la carta abierta</p>
      ${puede("equipo", yoP) ? `<p><b>${plata(vendido)}</b> vendido hoy${cobradas ? ` · ${cobradas} ${cobradas === 1 ? "mesa cobrada" : "mesas cobradas"}` : ""}</p>` : ""}
    </div>
    ${zonas.map(z => `
      <section class="zona" aria-label="${esc(z)}">
        <h3 class="zona__titulo">${esc(z)}${yoP.zona === z ? ` <span class="zona__tuya">tu zona</span>` : ""}</h3>
        <div class="plano">${mesas.filter(m => m.zona === z).map(mesaHtml).join("")}</div>
      </section>`).join("")}
    <ul class="referencias" aria-label="Qué significa cada color">
      ${["libre", "eligiendo", "nuevo", "preparando", "listo", "entregado"].map(e => `<li class="ref estado--${e}">${ESTADO_MESA[e]}</li>`).join("")}
      <li class="ref ref--banda">Llama al mozo</li>
      <li class="ref ref--banda ref--cuenta">Pide la cuenta</li>
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
  if (!paso || !puedeMover(est, paso.sig)) return "";
  return `<button type="button" class="boton-paso paso--${pa.estado}" data-mover="${p.id}" data-estacion="${est}" data-a="${paso.sig}">${paso.boton}</button>`;
}
function botonNo(p) {
  if (!puedeRechazar(p)) return "";
  const si = rechazando === p.id;
  return `<button type="button" class="boton-no${si ? " confirmando" : ""}" data-rechazar="${p.id}" title="Por ejemplo, si no hay nadie sentado en esa mesa">${si ? "¿Seguro? Tocá de nuevo" : "No tomar"}</button>`;
}
function rondaHtml(p, d) {
  const por = comensalDe(d, p.por);
  const partes = Object.entries(p.partes);
  const noTomar = !p.rechazado && partes.every(([, pa]) => pa.estado === "nuevo") ? botonNo(p) : "";
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
    ${noTomar ? `<div class="pedido-p__no-tomar">${noTomar}</div>` : ""}
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
  const lleva = l.toma && (persona(l.toma) || { nombre: "?", color: "#999" });
  return `<section class="cuenta-p">
    <header>${icono("i-cuenta", 16)}<b>Pidieron la cuenta</b><small>${c ? esc(c.nombre) + " · " : ""}${haceCuanto(Date.now() - l.creado)}</small></header>
    <dl class="detalle__cuenta">
      <dt>Consumo</dt><dd>${plata(m.total)}</dd>
      <dt>Propina${l.propina ? ` (${l.propina} %)` : ""}</dt><dd>${plata(propina)}</dd>
      <dt>A cobrar · ${esc(l.pago)}</dt><dd class="fuerte">${plata(l.total)}</dd>
    </dl>
    ${division}
    ${l.toma ? `<p class="cuenta-p__quien">${avatarEquipo(lleva, "avatar--chico")} La lleva ${esc(D.nombreEquipo(l.toma))} · ${haceCuanto(Date.now() - l.tomado)}</p>`
      : puede("cobrar") ? `<button type="button" class="cuenta-p__tomar" data-atender="${l.id}">Llevo la cuenta</button>` : ""}
  </section>`;
}
function cerrarAside() {
  detalle.hidden = true;
  veloDetalle.hidden = true;
  detalle._html = null;
}
function pintarDetalle(d) {
  if (editor) return;                          // el editor de Equipo no se repinta solo
  if (mesaAbierta == null || vista !== "mesas" || panel.hidden || !yo || !puede("mesas")) return cerrarAside();
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
      ${m.llama ? tareaHtml({ tipo: "mozo", m, l: m.llama, t: m.llama.creado }, d) : ""}
      ${m.cuenta ? cuentaHtml(m.cuenta, m, d) : ""}
      ${m.listos.map(x => tareaHtml({ ...x, t: x.cambio, m, tipo: "listo" }, d)).join("")}
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
      ${puede("cobrar") ? `<button type="button" class="detalle__liberar${liberando === m.n ? " confirmando" : ""}" data-liberar="${m.n}">${
        liberando === m.n ? "Tocá de nuevo para liberarla" : m.total ? "Cobrada · liberar la mesa" : "Liberar la mesa (no pidieron nada)"}</button>` : ""}
    </footer>` : ""}`;
  poner(detalle, html);
  detalle.hidden = false;
  veloDetalle.hidden = false;
}
function abrirMesa(n) {
  if (!puede("mesas")) return;
  mesaAbierta = n;
  liberando = null;
  historiaAbierta = false;
  pintar();
  setTimeout(() => detalle.querySelector("[data-cerrar-detalle]")?.focus({ preventScroll: true }), 30);
}
function cerrarDetalle() {
  if (editor) return cerrarEditor();
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
  const esperando = pa.estado === "listo";
  const min = minutos(Date.now() - (esperando ? pa.cambio : p.creado));
  const [ojo, tarde] = esperando ? RELOJ_LISTO : RELOJ[est] || [10, 20];
  const reloj = min < ojo ? "bien" : min < tarde ? "ojo" : "tarde";
  const zona = datosMesa(p.mesa).zona;
  const nueva = p.ronda === 1 && pa.estado === "nuevo";
  const accion = botonPaso(p, est, pa) || (esperando ? `<p class="ticket__espera">${icono("i-bandeja", 15)} Esperando que lo lleven</p>` : "");
  const no = pa.estado === "nuevo" ? botonNo(p) : "";
  return `<article class="ticket">
    <header class="ticket__cabeza"><b>Mesa ${p.mesa}</b><span class="reloj reloj--${reloj}" title="${esperando ? "Hace cuánto está listo" : "Hace cuánto lo pidieron"}">${icono("i-reloj", 13)}${min < 1 ? "recién" : min + " min"}</span></header>
    <p class="ticket__sub">${nueva ? `<span class="ticket__nueva" title="Es lo primero que pide esta mesa: si no hay nadie sentado, no lo tomes">Mesa nueva</span>` : ""}Ronda ${p.ronda} · Pedido ${p.numero}${zona ? " · " + esc(zona) : ""}${L.demo && p.mesa === L.mesaDemo ? " · tu mesa" : ""}</p>
    <ul class="lista-items">${itemsHtml(items, d)}</ul>
    ${p.nota ? `<p class="ticket__nota">${esc(p.nota)}</p>` : ""}
    ${accion || no ? `<div class="ticket__acciones">${accion}${no}</div>` : ""}
    ${pa.quien && FIRMA[pa.estado] ? `<p class="ticket__firma">${FIRMA[pa.estado]} ${esc(D.nombreEquipo(pa.quien))} · ${haceCuanto(Date.now() - pa.cambio)}</p>` : ""}
  </article>`;
}
function comandas(d, est) {
  const abiertas = new Set(d.sesiones.filter(s => !s.cerrada).map(s => s.id));
  return d.pedidos
    .filter(p => !p.rechazado && p.partes[est] && abiertas.has(p.sesion))
    .map(p => ({ p, pa: p.partes[est], items: p.items.filter(i => i.estacion === est) }));
}
// Todo lo que hay que preparar, sumado: "4 La Clásica · 2 Papas", para hacer de a tandas
function aPreparar(todas) {
  const juntos = new Map();
  todas.filter(x => x.pa.estado === "nuevo" || x.pa.estado === "preparando").forEach(x => x.items.forEach(i => {
    const v = juntos.get(i.nombre) || { n: 0, gusto: 0, plato: i.plato };
    v.n += i.cant;
    if (i.detalle) v.gusto += i.cant;
    juntos.set(i.nombre, v);
  }));
  if (!juntos.size) return "";
  return `<section class="a-preparar" aria-label="Todo lo que hay que preparar">
    <h3 class="zona__titulo">A preparar</h3>
    <ul>${[...juntos].sort((a, b) => b[1].n - a[1].n).map(([nombre, v]) => `<li>${fotoHtml(v.plato, null, "a-preparar__foto")}<b>${v.n}</b><span>${esc(nombre)}${v.gusto ? `<small>${v.gusto} a gusto</small>` : ""}</span></li>`).join("")}</ul>
  </section>`;
}
function pintarEstacion(d, est) {
  const todas = comandas(d, est);
  const hechas = d.pedidos.filter(p => p.partes[est] && p.partes[est].estado === "entregado").length;
  return `
    ${aPreparar(todas)}
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
function enlaceMesa(m) {
  const base = L.enlace || location.origin + location.pathname;
  const q = m.codigo ? `m=${encodeURIComponent(m.codigo)}` : `mesa=${m.n}`;
  return `${base}${base.includes("?") ? "&" : "?"}${q}`;
}
// En la demo, "Abrir la mesa" abre una pestaña que es otra persona (como otro celular)
const enlaceProbar = m => enlaceMesa(m) + "&nuevo";
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
    <div class="qr-grilla">${mesasDelLocal().map(m => {
      const url = enlaceMesa(m);
      return `<article class="tarjeta-qr">
        <p class="tarjeta-qr__local">${esc(L.nombre)}</p>
        <div class="tarjeta-qr__codigo">${qrLib ? qrSvg(url) : `<span class="tarjeta-qr__cargando"></span>`}</div>
        <p class="tarjeta-qr__mesa">Mesa <b>${m.n}</b></p>
        <p class="tarjeta-qr__texto">Escaneá con la cámara, mirá los platos en 3D y pedí desde tu celu.</p>
        ${L.demo ? `<a class="tarjeta-qr__probar" href="${esc(enlaceProbar(m))}" target="_blank" rel="noopener" title="Se abre como si fuera otro celular">Abrir la mesa ${m.n} ${icono("i-flecha", 13)}</a>` : ""}
      </article>`;
    }).join("")}</div>`;
}

/* ---------- Equipo: quién es quién y qué puede hacer cada uno ---------- */
const MOTIVOS = {
  nombre: "Poné un nombre.", nombre_repetido: "Ya hay alguien con ese nombre en el equipo.",
  rol: "Elegí un puesto.", pin: "El PIN tiene que ser de 4 números.",
  solo_dueno: "Eso lo puede hacer solo un dueño.", tu_permiso: "No te podés sacar a vos el permiso de manejar el equipo.",
  sin_permiso: "No tenés permiso para manejar el equipo.", vos: "No te podés dar de baja a vos.",
  no_existe: "Esa persona ya no está en el equipo.",
};
function pintarEquipo() {
  const yoP = persona(yo);
  return `
    <div class="equipo-intro">
      <p class="panel__ayuda">Cada persona entra con su nombre y su PIN, y ve solo lo que le toca. El puesto trae los permisos de entrada; después los podés ajustar persona por persona.</p>
      <button type="button" class="boton-imprimir" data-persona="nueva">${icono("i-mas", 16)} Sumar a alguien</button>
    </div>
    <div class="fichas">${equipo().map(e => {
      const tags = PERMISOS.filter(x => (e.permisos || []).includes(x.id)).map(x => `<i>${esc(x.corto)}</i>`).join("");
      return `<article class="ficha">
        ${avatarEquipo(e, "avatar--grande")}
        <div class="ficha__info">
          <p class="ficha__nombre"><b>${esc(e.nombre)}</b>${e.id === yo ? `<span class="ficha__vos">vos</span>` : ""}</p>
          <p class="ficha__puesto">${esc(puestoDe(e))}${e.zona ? " · " + esc(e.zona) : ""}</p>
          <p class="ficha__permisos">${tags || `<span class="ficha__nada">Todavía no puede hacer nada</span>`}</p>
        </div>
        ${puedeEditarA(e, yoP) ? `<button type="button" class="ficha__editar" data-persona="${e.id}" aria-label="Editar a ${esc(e.nombre)}">Editar</button>` : `<span class="ficha__nota">Lo cambia un dueño</span>`}
      </article>`;
    }).join("")}</div>`;
}
function abrirEditor(id) {
  const e = id === "nueva" ? null : persona(id);
  if (id !== "nueva" && (!e || !puedeEditarA(e))) return;
  const usados = new Set(equipo().map(x => x.color));
  const rol = (ROLES.find(r => r.id === "mozo") || ROLES[0]).id;
  editor = e
    ? { id: e.id, nombre: e.nombre, rol: e.rol, zona: e.zona || "", color: e.color, permisos: [...(e.permisos || [])] }
    : { id: null, nombre: "", rol, zona: "", color: D.COLORES_EQUIPO.find(c => !usados.has(c)) || D.COLORES_EQUIPO[0], permisos: D.permisosDeRol(rol), pin: D.pinNuevo() };
  mesaAbierta = null;
  pintarEditor();
  setTimeout(() => detalle.querySelector(e ? "[data-cerrar-detalle]" : "#ed-nombre")?.focus({ preventScroll: true }), 60);
}
function cerrarEditor() {
  const volver = editor && editor.id;
  editor = null;
  clearTimeout(dobleT);
  cerrarAside();
  pintar();
  if (volver) panel.querySelector(`[data-persona="${volver}"]`)?.focus({ preventScroll: true });
}
const clavesFoco = ["data-ed-rol", "data-ed-zona", "data-ed-color", "data-ed-permiso", "data-ed-cambiar-pin", "data-ed-otro-pin", "data-ed-baja", "data-ed-reset"];
function pintarEditor() {
  const a = document.activeElement;
  let foco = null;
  if (a && detalle.contains(a)) {
    const k = clavesFoco.find(x => a.hasAttribute(x));
    foco = k ? `[${k}="${a.getAttribute(k)}"]` : a.id ? "#" + a.id : null;
  }
  poner(detalle, editorHtml());
  detalle.hidden = false;
  veloDetalle.hidden = false;
  if (foco) detalle.querySelector(foco)?.focus({ preventScroll: true });
}
function editorHtml() {
  const x = editor, yoP = persona(yo), soyYo = x.id === yo;
  const cabeza = `<header class="detalle__cabeza">
      <div><p class="detalle__zona">Equipo</p><h3 class="detalle__titulo" id="detalle-titulo">${x.id && !x.hecho ? esc(x.nombre) : x.hecho ? "¡Listo!" : "Sumar a alguien"}</h3></div>
      <button type="button" class="detalle__cerrar" data-cerrar-detalle aria-label="Cerrar">${icono("i-cerrar", 18)}</button>
    </header>`;
  if (x.hecho) {
    return cabeza + `<div class="detalle__cuerpo ed-hecho" data-scroll="cuerpo">
        ${avatarEquipo({ nombre: x.nombre, color: x.color }, "avatar--grande")}
        <p class="ed-hecho__titulo"><b>${esc(x.nombre)}</b> ${x.hecho.nuevo ? "ya está en el equipo." : "tiene un PIN nuevo."}</p>
        <p class="ed-rotulo">Su PIN para entrar</p>
        <p class="ed-hecho__pin" aria-label="PIN: ${x.hecho.pin.split("").join(" ")}">${x.hecho.pin.split("").map(n => `<span>${n}</span>`).join("")}</p>
        <p class="panel__ayuda">Pasáselo en persona. Por seguridad no se vuelve a mostrar: si se lo olvida, le das uno nuevo desde acá.</p>
      </div>
      <footer class="detalle__pie"><button type="button" class="detalle__liberar" data-cerrar-detalle>Listo</button></footer>`;
  }
  const rolX = ROLES.find(r => r.id === x.rol) || ROLES[0];
  const preset = D.permisosDeRol(x.rol);
  const aMedida = preset.length !== x.permisos.length || preset.some(p => !x.permisos.includes(p));
  const zonas = [...new Set(mesasDelLocal().map(m => m.zona).filter(Boolean))];
  const salon = SALON.some(p => x.permisos.includes(p));
  const grupos = [...new Set(PERMISOS.map(p => p.grupo))];
  return cabeza + `
    <div class="detalle__cuerpo editor" data-scroll="cuerpo">
      <div class="ed-campo">
        <label class="ed-rotulo" for="ed-nombre">Nombre</label>
        <div class="ed-nombre">${avatarEquipo({ nombre: x.nombre || "?", color: x.color }, "avatar--grande")}<input id="ed-nombre" type="text" maxlength="20" autocomplete="off" autocapitalize="words" value="${esc(x.nombre)}" placeholder="Como lo llaman en el local"></div>
      </div>
      <div class="ed-campo"><p class="ed-rotulo">Puesto</p>
        <div class="ed-chips">${ROLES.map(r => {
          const no = r.id === "dueno" && yoP.rol !== "dueno";
          return `<button type="button" class="ed-chip" data-ed-rol="${r.id}" aria-pressed="${r.id === x.rol}"${no ? ` disabled title="Solo un dueño puede dar este puesto"` : ""}>${esc(r.nombre)}</button>`;
        }).join("")}</div>
      </div>
      ${salon && zonas.length > 1 ? `<div class="ed-campo"><p class="ed-rotulo">Sus mesas</p>
        <div class="ed-chips">${["", ...zonas].map(z => `<button type="button" class="ed-chip" data-ed-zona="${esc(z)}" aria-pressed="${z === x.zona}">${z ? esc(z) : "Todas"}</button>`).join("")}</div>
        <p class="ed-ayuda">Las de su zona le aparecen primero y marcadas.</p></div>` : ""}
      <div class="ed-campo"><p class="ed-rotulo">Color</p>
        <div class="ed-colores">${D.COLORES_EQUIPO.map(c => `<button type="button" class="ed-color" style="--av:${c}" data-ed-color="${c}" aria-pressed="${c === x.color}" aria-label="Color ${c}"></button>`).join("")}</div>
      </div>
      <section class="ed-permisos" aria-labelledby="ed-permisos-titulo">
        <div class="ed-permisos__cabeza">
          <p class="ed-rotulo" id="ed-permisos-titulo">Qué puede ver y hacer</p>
          ${aMedida ? `<span class="ed-medida">A medida</span><button type="button" class="ed-reset" data-ed-reset>Volver a lo de ${esc(rolX.nombre)}</button>` : ""}
        </div>
        ${grupos.map(g => `<h4>${esc(g)}</h4><ul>${PERMISOS.filter(p => p.grupo === g).map(p => {
          const fijo = soyYo && p.id === "equipo";
          return `<li><button type="button" class="ed-permiso" role="switch" aria-checked="${x.permisos.includes(p.id)}" data-ed-permiso="${p.id}"${fijo ? " disabled" : ""}>
            <span><b>${esc(p.nombre)}</b><small>${fijo ? "No te lo podés sacar a vos." : esc(p.ayuda)}</small></span><i aria-hidden="true"></i></button></li>`;
        }).join("")}</ul>`).join("")}
      </section>
      ${x.id ? `<div class="ed-campo"><p class="ed-rotulo">PIN</p>
          <div class="ed-pin"><span class="ed-pin__oculto" aria-label="PIN oculto">••••</span>
            <button type="button" class="ed-boton${x.confirmar === "pin" ? " confirmando" : ""}" data-ed-cambiar-pin>${x.confirmar === "pin" ? "Tocá de nuevo: el de ahora deja de andar" : "Darle un PIN nuevo"}</button></div></div>`
        : `<div class="ed-campo"><label class="ed-rotulo" for="ed-pin">PIN para entrar</label>
          <div class="ed-pin"><input id="ed-pin" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" value="${esc(x.pin)}" aria-describedby="ed-pin-ayuda"><button type="button" class="ed-boton" data-ed-otro-pin>Otro</button></div>
          <p class="ed-ayuda" id="ed-pin-ayuda">4 números. Pasáselo en persona: con eso entra desde cualquier celular del local.</p></div>`}
      ${x.error ? `<p class="ed-error" role="alert">${esc(x.error)}</p>` : ""}
    </div>
    <footer class="detalle__pie ed-pie">
      <button type="button" class="detalle__liberar" data-ed-guardar>${x.id ? "Guardar" : "Sumar al equipo"}</button>
      ${x.id && !soyYo ? `<button type="button" class="ed-baja${x.confirmar === "baja" ? " confirmando" : ""}" data-ed-baja>${x.confirmar === "baja" ? `Tocá de nuevo: ${esc(x.nombre)} ya no va a poder entrar` : "Dar de baja"}</button>` : ""}
    </footer>`;
}
function confirmar(cual) {
  clearTimeout(dobleT);
  if (editor.confirmar === cual) { editor.confirmar = null; return true; }
  editor.confirmar = cual;
  pintarEditor();
  dobleT = setTimeout(() => { if (editor && editor.confirmar === cual) { editor.confirmar = null; pintarEditor(); } }, 4000);
  return false;
}
async function guardarEditor() {
  const x = editor;
  x.error = null;
  if (!x.nombre.trim()) x.error = MOTIVOS.nombre;
  else if (!x.id && !/^\d{4}$/.test(x.pin || "")) x.error = MOTIVOS.pin;
  if (x.error) return pintarEditor();
  const r = await D.guardarPersona(yo, { id: x.id, nombre: x.nombre, rol: x.rol, zona: x.zona, color: x.color, permisos: x.permisos, pin: x.id ? undefined : x.pin });
  if (editor !== x) return;
  if (!r || !r.ok) { x.error = MOTIVOS[r && r.motivo] || "No se pudo guardar. Probá de nuevo."; return pintarEditor(); }
  if (!x.id) {
    x.id = r.persona.id;
    x.nombre = r.persona.nombre;
    x.hecho = { pin: r.pin, nuevo: true };
    return pintarEditor();
  }
  const nombre = r.persona.nombre;
  cerrarEditor();
  avisoPanel(`Listo: guardaste lo de ${nombre}.`);
}
async function editorClic(b) {
  const x = editor;
  if (!x) return;
  if (b("[data-ed-guardar]")) return guardarEditor();
  if (b("[data-ed-cambiar-pin]")) {
    if (!confirmar("pin")) return;
    const r = await D.cambiarPin(yo, x.id);
    if (editor !== x) return;
    if (r && r.ok) x.hecho = { pin: r.pin, nuevo: false };
    else x.error = MOTIVOS[r && r.motivo] || "No se pudo cambiar el PIN.";
    return pintarEditor();
  }
  if (b("[data-ed-baja]")) {
    if (!confirmar("baja")) return;
    const r = await D.bajaPersona(yo, x.id);
    if (editor !== x) return;
    if (r && r.ok) { const nombre = x.nombre; cerrarEditor(); return avisoPanel(`${nombre} ya no puede entrar al panel.`); }
    x.error = MOTIVOS[r && r.motivo] || "No se pudo dar de baja.";
    return pintarEditor();
  }
  const conEquipo = () => { if (x.id === yo && !x.permisos.includes("equipo")) x.permisos.push("equipo"); };
  if (b("[data-ed-rol]")) {
    x.rol = b("[data-ed-rol]").dataset.edRol;
    x.permisos = D.permisosDeRol(x.rol);
    conEquipo();
    if (!SALON.some(p => x.permisos.includes(p))) x.zona = "";
  } else if (b("[data-ed-zona]")) x.zona = b("[data-ed-zona]").dataset.edZona;
  else if (b("[data-ed-color]")) x.color = b("[data-ed-color]").dataset.edColor;
  else if (b("[data-ed-permiso]")) {
    const p = b("[data-ed-permiso]").dataset.edPermiso;
    x.permisos = x.permisos.includes(p) ? x.permisos.filter(y => y !== p) : [...x.permisos, p];
  } else if (b("[data-ed-reset]")) { x.permisos = D.permisosDeRol(x.rol); conEquipo(); }
  else if (b("[data-ed-otro-pin]")) x.pin = D.pinNuevo();
  else return;
  x.error = null;
  pintarEditor();
}
detalle.addEventListener("input", e => {
  if (!editor) return;
  if (e.target.id === "ed-nombre") {
    editor.nombre = e.target.value;
    const av = detalle.querySelector(".ed-nombre .avatar");
    if (av) av.textContent = (editor.nombre.trim()[0] || "?").toUpperCase();
  }
  if (e.target.id === "ed-pin") {
    const limpio = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (limpio !== e.target.value) e.target.value = limpio;
    editor.pin = limpio;
  }
});
detalle.addEventListener("keydown", e => {
  if (editor && e.key === "Enter" && e.target.matches("#ed-nombre, #ed-pin")) { e.preventDefault(); guardarEditor(); }
});

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
          <b>${esc(e.nombre)}</b><small>${esc(puestoDe(e))}${e.zona ? " · " + esc(e.zona) : ""}</small>
        </button>`).join("")}
      </div>
      <p class="entrada-equipo__ayuda">Cada uno entra desde su celular o desde la tablet de la cocina, con su PIN. Ve lo que le toca y todo lo que hace queda con su nombre.</p>
      <a class="panel__salir" href="#carta">Volver a la carta ${icono("i-flecha", 14)}</a>
    </div>` : `
    <div class="entrada-equipo__marco entrada-equipo__marco--pin">
      <button type="button" class="entrada-equipo__volver" data-volver>${icono("i-volver", 14)} Volver</button>
      ${avatarEquipo(p, "avatar--grande")}
      <p class="entrada-equipo__pregunta">Hola, ${esc(p.nombre)}</p>
      <p class="entrada-equipo__rol">${esc(puestoDe(p))}${p.zona ? " · " + esc(p.zona) : ""}</p>
      <div class="pin__puntos${pinMal ? " mal" : ""}" role="status" aria-label="${pin.length} de 4 números${pinMal ? ": PIN incorrecto" : ""}">${[0, 1, 2, 3].map(i => `<i class="${i < pin.length ? "lleno" : ""}"></i>`).join("")}</div>
      <div class="pin__teclado">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"].map(k =>
        k === "" ? "<span></span>" : `<button type="button" data-tecla="${k}"${k === "borrar" ? ' aria-label="Borrar"' : ""}>${k === "borrar" ? icono("i-borrar", 22) : k}</button>`).join("")}
      </div>
      <p class="entrada-equipo__ayuda">${pinMal ? "Ese PIN no es. Probá de nuevo." : L.demo ? "En la demo, el PIN de los de ejemplo es 1234." : "Tu PIN de 4 números."}</p>
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
  vista = vs.includes(pedida) ? pedida : vs[0] || "mesas";
  vistos = null;
  verTodo = false;
  despertarAudio();
  mostrar();
}
function salir(aOtro) {
  yo = null;
  D.salirEquipo();
  mesaAbierta = null;
  editor = null;
  eligiendo = aOtro || null;
  pin = "";
  ocultarAlerta();
  pantallaPrendida(false);
  mostrar();
}

/* ---------- Arriba: quién sos y el sonido (en la demo, entrar como otro) ---------- */
function pintarTurno() {
  const p = persona(yo);
  return `
    <div class="turno__yo">
      ${avatarEquipo(p)}
      <span><b>${esc(p.nombre)}</b><small>${esc(puestoDe(p))}${p.zona ? " · " + esc(p.zona) : ""}</small></span>
      <button type="button" class="turno__boton" data-salir>Salir</button>
    </div>
    ${L.demo ? `<div class="turno__equipo">
      <span class="turno__rotulo">Probar como</span>
      ${equipo().filter(e => e.id !== yo).map(e => `<button type="button" class="turno__otro" data-cambiar="${e.id}" title="Entrar como ${esc(e.nombre)} (${esc(puestoDe(e))})" aria-label="Entrar como ${esc(e.nombre)}, ${esc(puestoDe(e))}">${avatarEquipo(e)}</button>`).join("")}
    </div>` : ""}
    <button type="button" class="turno__boton turno__carteles" data-carteles aria-pressed="${carteles}" title="${carteles ? "Apagar" : "Prender"} los carteles de lo nuevo">${icono("i-campana", 16)}<span>${carteles ? "Avisos prendidos" : "Avisos apagados"}</span></button>
    <button type="button" class="turno__boton turno__sonido" data-sonido aria-pressed="${sonido}">${icono(sonido ? "i-sonido" : "i-mudo", 16)}<span>${sonido ? "Con sonido" : "Sin sonido"}</span></button>`;
}
function pintarTabs(d) {
  const p = persona(yo);
  const pendientes = deSalon(p) ? tareas(d, mesasDelLocal().map(m => mesaInfo(m, d)), p).length : 0;
  return vistasDe(p).map(v => {
    let n = "";
    if (v === "mesas" && pendientes) n = `<span class="insignia insignia--alerta">${pendientes}</span>`;
    if (EST.includes(v)) {
      const c = comandas(d, v).filter(x => x.pa.estado === "nuevo" || x.pa.estado === "preparando").length;
      if (c) n = `<span class="insignia">${c}</span>`;
    }
    return `<button role="tab" type="button" id="tab-${v}" aria-selected="${v === vista}" aria-controls="vistas" data-vista="${v}">${nombreVista(v, p)}${n}</button>`;
  }).join("");
}

/* ---------- Lo nuevo: suena, vibra y aparece en un cartel ---------- */
let sonido = (() => { try { return localStorage.getItem("cartaviva.sonido") !== "no"; } catch { return true; } })();
let audio = null, vistos = null, silencio = 0;
// Los carteles que aparecen arriba (y la vibración): cada uno los prende o apaga en su celu
let carteles = (() => { try { return localStorage.getItem("cartaviva.carteles") !== "no"; } catch { return true; } })();
function despertarAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch { /* sin audio */ }
}
// Cada cosa suena distinto: lo que sale de la cocina, un llamado, una comanda nueva
const SONIDOS = {
  listo:   { notas: [1047, 1319, 1568], paso: 0.11, vibrar: [70, 40, 70, 40, 70] },
  mozo:    { notas: [988, 1319],        paso: 0.13, vibrar: [60, 40, 60] },
  cuenta:  { notas: [1319, 988],        paso: 0.13, vibrar: [60, 40, 60] },
  comanda: { notas: [659, 659],         paso: 0.17, vibrar: [140] },
};
function sonar(tipo) {
  const s = SONIDOS[tipo] || SONIDOS.mozo;
  if (carteles) { try { navigator.vibrate && navigator.vibrate(s.vibrar); } catch { /* sin vibración */ } }
  if (!sonido || !audio) return;
  try {
    const t = audio.currentTime;
    s.notas.forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * s.paso);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * s.paso + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * s.paso + 0.42);
      o.connect(g).connect(audio.destination);
      o.start(t + i * s.paso);
      o.stop(t + i * s.paso + 0.46);
    });
  } catch { /* sin audio */ }
}
const claveTarea = x => (x.tipo === "listo" ? `r${x.p.id}${x.est}` : x.tipo === "comanda" ? `n${x.p.id}${x.est}` : `${x.tipo}${x.l.id}`);
const PRIORIDAD = ["listo", "mozo", "cuenta", "comanda"];
function novedades(d) {
  const p = persona(yo);
  const actuales = new Map();
  tareas(d, mesasDelLocal().map(m => mesaInfo(m, d)), p).forEach(x => actuales.set(claveTarea(x), x));
  const abiertas = new Set(d.sesiones.filter(s => !s.cerrada).map(s => s.id));
  d.pedidos.forEach(x => {
    if (x.rechazado || !abiertas.has(x.sesion)) return;
    Object.entries(x.partes).forEach(([est, pa]) => {
      if (pa.estado === "nuevo" && puede(est, p)) {
        const t = { tipo: "comanda", p: x, est, t: x.creado, m: datosMesa(x.mesa) };
        actuales.set(claveTarea(t), t);
      }
    });
  });
  if (vistos && Date.now() - silencio > 1500) {
    // Lo que terminó uno mismo en la cocina (o lo que vuelve porque uno lo deshizo) no le suena a uno mismo
    const nuevas = [...actuales].filter(([k, x]) => !vistos.has(k) && !(x.tipo === "listo" && x.quien === yo)).map(([, x]) => x);
    if (nuevas.length) {
      nuevas.sort((a, b) => PRIORIDAD.indexOf(a.tipo) - PRIORIDAD.indexOf(b.tipo));
      sonar(nuevas[0].tipo);
      mostrarAlerta(nuevas[0], nuevas.length - 1, d);
    }
  }
  vistos = new Set(actuales.keys());
}
let alertaT = null, alertaDe = null;
function alertaHtml(x, mas, d) {
  const items = x.p ? x.p.items.filter(i => i.estacion === x.est) : [];
  const titulo = { listo: `¡Sale! Mesa ${x.m.n}`, mozo: `Mesa ${x.m.n} llama al mozo`, cuenta: `Mesa ${x.m.n} pide la cuenta`, comanda: `Comanda nueva · Mesa ${x.m.n}` }[x.tipo];
  const quien = x.l && comensalDe(d, x.l.comensal);
  const sub = x.tipo === "listo" ? `${nombreEst(x.est)}: ${resumenItems(items)}`
    : x.tipo === "comanda" ? resumenItems(items)
    : x.tipo === "cuenta" ? `${x.l.pago} · ${plata(x.l.total)}`
    : [quien && quien.nombre, x.m.zona].filter(Boolean).join(" · ");
  const boton = x.tipo === "listo" ? `<button type="button" data-mover="${x.p.id}" data-estacion="${x.est}" data-a="entregado">Llevado</button>`
    : x.tipo === "mozo" ? `<button type="button" data-atender="${x.l.id}">Voy</button>`
    : x.tipo === "cuenta" ? `<button type="button" data-atender="${x.l.id}">Llevo la cuenta</button>`
    : vista !== x.est ? `<button type="button" data-vista="${x.est}">Ver</button>` : "";
  const zona = x.m && persona(yo).zona && persona(yo).zona === x.m.zona;
  return `<div class="alerta__caja alerta--${x.tipo}" role="alert">
    <span class="alerta__icono">${icono(ICONO_TAREA[x.tipo], 22)}</span>
    <span class="alerta__texto"><b>${esc(titulo)}${zona ? ` <span class="aviso-fila__zona">Tu zona</span>` : ""}</b><small>${esc(sub)}${mas ? ` · y ${mas} ${mas === 1 ? "cosa" : "cosas"} más` : ""}</small></span>
    ${boton}
    <button type="button" class="alerta__cerrar" data-cerrar-alerta aria-label="Cerrar el aviso">${icono("i-cerrar", 16)}</button>
  </div>`;
}
function mostrarAlerta(x, mas, d) {
  if (panel.hidden || !carteles) return;
  alertaDe = claveTarea(x);
  alertaEl.innerHTML = alertaHtml(x, mas, d);
  alertaEl.hidden = false;
  alertaEl.classList.remove("visible");
  void alertaEl.offsetWidth;
  alertaEl.classList.add("visible");
  clearTimeout(alertaT);
  alertaT = setTimeout(ocultarAlerta, 9000);
}
function ocultarAlerta() {
  clearTimeout(alertaT);
  alertaDe = null;
  if (alertaEl.hidden) return;
  alertaEl.classList.remove("visible");
  alertaT = setTimeout(() => { alertaEl.hidden = true; }, 300);
}

/* ---------- Deshacer y avisos cortos, abajo ---------- */
let avisoT = null, ultima = null;
function mostrarAviso(html) {
  avisoEl.innerHTML = html;
  avisoEl.hidden = false;
  requestAnimationFrame(() => avisoEl.classList.add("visible"));
  clearTimeout(avisoT);
}
function ofrecerDeshacer(accion, texto) {
  ultima = accion;
  mostrarAviso(`<span>${esc(texto)}</span><button type="button" data-deshacer>${icono("i-deshacer", 16)} Deshacer</button>`);
  avisoT = setTimeout(ocultarAviso, 8000);
}
function avisoPanel(texto) {
  ultima = null;
  mostrarAviso(`<span>${esc(texto)}</span>`);
  avisoT = setTimeout(ocultarAviso, 3800);
}
function ocultarAviso() {
  clearTimeout(avisoT);
  ultima = null;
  avisoEl.classList.remove("visible");
  avisoT = setTimeout(() => { avisoEl.hidden = true; }, 300);
}

/* ---------- La pantalla de la cocina no se apaga ---------- */
let candado = null, pidiendoCandado = false;
async function pantallaPrendida(si) {
  if (!("wakeLock" in navigator)) return;
  try {
    if (si && !candado && !pidiendoCandado && document.visibilityState === "visible") {
      pidiendoCandado = true;
      candado = await navigator.wakeLock.request("screen");
      candado.addEventListener("release", () => { candado = null; });
    } else if (!si && candado) {
      const c = candado;
      candado = null;
      await c.release();
    }
  } catch { candado = null; } finally { pidiendoCandado = false; }
}

/* ---------- Armado general ---------- */
function mostrar() {
  if (panel.hidden) return;
  yo = yo && persona(yo) && persona(yo).activo !== false ? yo : null;
  entrada.hidden = !!yo;
  adentro.hidden = !yo;
  if (!yo) {
    cerrarAside();
    ahoraEl.innerHTML = "";
    ahoraEl._html = null;
    pintarEntrada();
    return;
  }
  const vs = vistasDe(persona(yo));
  if (!vs.includes(vista)) vista = vs[0] || "mesas";
  pintar();
}
function pintar() {
  if (panel.hidden || !yo) return;
  const p = persona(yo);
  if (!p || p.activo === false) return salir();       // lo dieron de baja mientras estaba adentro
  const d = D.todo();
  const vs = vistasDe(p);
  if (vs.length && !vs.includes(vista)) { vista = vs[0]; mesaAbierta = null; }
  $("#panel-titulo").textContent = L.nombre;
  poner($("#panel-tabs"), pintarTabs(d));
  poner($("#turno"), pintarTurno());
  poner(ahoraEl, vs.length ? pintarAhora(d) : "");
  const cont = $("#vistas");
  const html = !vs.length ? `<p class="todo-tranqui">${icono("i-listo", 16)} Todavía no tenés nada asignado. Pedile a quien maneja el equipo que te dé permisos.</p>`
    : vista === "mesas" ? pintarMesas(d)
    : vista === "carta" ? pintarStock(d)
    : vista === "qr" ? pintarQR()
    : vista === "equipo" ? pintarEquipo()
    : pintarEstacion(d, vista);
  cont.setAttribute("aria-labelledby", "tab-" + vista);
  if (cont._vista !== vista) { cont._html = null; cont._vista = vista; }
  poner(cont, html);
  pintarDetalle(d);
  $("#panel-pie").hidden = !L.demo;
  novedades(d);
  pantallaPrendida(EST.includes(vista));
}
function elegirVista(v) {
  if (!vistasDe(persona(yo)).includes(v)) return;
  if (editor) cerrarEditor();
  vista = v;
  if (v !== "mesas") mesaAbierta = null;
  pintar();
  panel.scrollTop = 0;
}

const RUTAS = ["panel", "mesas", "qr", "equipo", ...EST];
function segunDireccion() {
  const h = location.hash.slice(1);
  const ver = RUTAS.includes(h);
  panel.hidden = !ver;
  document.body.classList.toggle("con-panel", ver);
  E.pausar(ver);
  if (!ver) {
    mesaAbierta = null;
    editor = null;
    cerrarAside();
    ocultarAlerta();
    pantallaPrendida(false);
    return;
  }
  yo = yo || D.soyEquipo();
  if (yo) {
    const vs = vistasDe(persona(yo));
    if (vs.includes(h)) vista = h;
  }
  mostrar();
  panel.scrollTop = 0;
}

panel.addEventListener("click", async e => {
  const t = e.target;
  const b = sel => t.closest(sel);
  if (b("[data-elegir]")) { eligiendo = b("[data-elegir]").dataset.elegir; pin = ""; pinMal = false; return pintarEntrada(); }
  if (b("[data-volver]")) { eligiendo = null; pin = ""; pinMal = false; return pintarEntrada(); }
  if (b("[data-tecla]")) return tecla(b("[data-tecla]").dataset.tecla);
  if (b("[data-cerrar-alerta]")) return ocultarAlerta();
  if (b("[data-deshacer]")) {
    const accion = ultima;
    ocultarAviso();
    if (!accion) return;
    silencio = Date.now();
    const r = await D.deshacer(accion, yo);
    if (!r) avisoPanel("Ya no se puede deshacer: pasó el tiempo o alguien lo cambió.");
    return;
  }
  if (b("[data-vista]")) { ocultarAlerta(); return elegirVista(b("[data-vista]").dataset.vista); }
  if (b("[data-salir]")) return salir();
  if (b("[data-cambiar]")) return salir(b("[data-cambiar]").dataset.cambiar);
  if (b("[data-carteles]")) {
    carteles = !carteles;
    try { localStorage.setItem("cartaviva.carteles", carteles ? "si" : "no"); } catch { /* nada */ }
    if (!carteles) ocultarAlerta();
    avisoPanel(carteles ? "Avisos prendidos: lo nuevo aparece arriba y vibra." : "Avisos apagados: lo nuevo solo queda en la lista de Para hacer.");
    return pintar();
  }
  if (b("[data-sonido]")) {
    sonido = !sonido;
    try { localStorage.setItem("cartaviva.sonido", sonido ? "si" : "no"); } catch { /* nada */ }
    if (sonido) { despertarAudio(); sonar("mozo"); }
    return pintar();
  }
  if (t === veloDetalle || b("[data-cerrar-detalle]")) return cerrarDetalle();
  if (b("[data-ver-todo]")) { verTodo = !verTodo; return pintar(); }
  if (b("[data-mover]")) {
    const x = b("[data-mover]").dataset;
    if (b("#alerta")) ocultarAlerta();
    const r = await D.mover(x.mover, x.estacion, x.a, yo);
    if (r) ofrecerDeshacer({ tipo: "mover", pedido: x.mover, estacion: x.estacion }, `Mesa ${r.mesa} · ${nombreEst(x.estacion)}: ${HECHO[x.a]}`);
    return;
  }
  if (b("[data-rechazar]")) { const id = b("[data-rechazar]").dataset.rechazar; return dosToques("rechazar", id, () => D.rechazar(id, yo)); }
  if (b("[data-atender]")) {
    const id = b("[data-atender]").dataset.atender;
    if (b("#alerta")) ocultarAlerta();
    const r = await D.atender(id, yo);
    if (r) ofrecerDeshacer({ tipo: "atender", llamado: id }, r.tipo === "mozo" ? `Vas a la mesa ${r.mesa}` : `Llevás la cuenta de la mesa ${r.mesa}`);
    return;
  }
  if (b("[data-liberar]")) {
    const n = +b("[data-liberar]").dataset.liberar;
    return dosToques("liberar", n, () => { mesaAbierta = null; D.cerrarMesa(n, yo); avisoPanel(`Mesa ${n} libre.`); });
  }
  if (b("[data-mesa]")) return abrirMesa(+b("[data-mesa]").dataset.mesa);
  if (b("[data-agotar]")) { const id = b("[data-agotar]").dataset.agotar; return D.agotar(id, !D.agotado(id), yo); }
  if (b("[data-imprimir]")) { try { window.print(); } catch { /* sin impresora */ } return; }
  if (b("[data-persona]")) return abrirEditor(b("[data-persona]").dataset.persona);
  if (editor && b("#detalle")) return editorClic(b);
  if (b("#panel-reiniciar")) { mesaAbierta = null; editor = null; cerrarAside(); D.reiniciar(); }
});
panel.addEventListener("toggle", e => { if (e.target.matches && e.target.matches(".historia")) historiaAbierta = e.target.open; }, true);
document.addEventListener("keydown", e => {
  if (panel.hidden) return;
  if (!yo && eligiendo && (/^\d$/.test(e.key) || e.key === "Backspace")) { e.preventDefault(); return tecla(e.key === "Backspace" ? "borrar" : e.key); }
  if (e.key === "Escape" && (mesaAbierta != null || editor)) cerrarDetalle();
});
document.addEventListener("visibilitychange", () => { if (!panel.hidden && yo) pantallaPrendida(EST.includes(vista) && document.visibilityState === "visible"); });

addEventListener("hashchange", segunDireccion);
addEventListener("carta:datos", pintar);
addEventListener("carta:error", e => { if (!panel.hidden) avisoPanel(e.detail || "No se pudo. Probá de nuevo."); });
setInterval(pintar, 15000);
segunDireccion();
