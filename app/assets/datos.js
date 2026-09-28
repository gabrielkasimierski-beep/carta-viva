/* =============================================================================
   CARTA VIVA — los datos del local: mesas, comensales, pedidos y llamados
   Las mismas funciones sirven para dos lugares:
   · Vista previa (ahora): todo queda en este navegador. Las pestañas se hablan entre
     sí, así que se puede tener la carta en una y el panel en otra.
   · Supabase (la versión real): lo mismo, pero compartido al instante entre todos los
     celulares del local. Ver supabase/esquema.sql.

   Cómo se piensa una mesa con varias personas:
   · SESIÓN: desde que alguien escanea el QR de una mesa libre hasta que se cobra.
   · COMENSALES: cada celular que entra a la sesión, con su nombre y su color.
   · CARRITO: lo que la mesa va eligiendo. Es uno solo para toda la mesa, cada cosa dice
     de quién es y cualquiera lo manda.
   · PEDIDOS (rondas): lo que se mandó junto. Se parte por estación (cocina, barra) y
     cada parte avanza sola: nuevo → preparando → listo → entregado.
   · LLAMADOS: "que venga el mozo" y "la cuenta". Los toma alguien del equipo, con su
     nombre, para que no vayan dos a la misma mesa.
   ============================================================================= */

(function () {
  "use strict";

  const L = window.LOCAL;
  const CLAVE = "cartaviva.demo.v3";
  const ESTADOS = ["nuevo", "preparando", "listo", "entregado"];
  const COLORES = ["#FF7A59", "#3DB2FF", "#FFC43D", "#A57BFF", "#2BC48A", "#FF6FB5"];
  const SIN = {};                 // "no cambió nada": no se guarda ni se avisa
  let memoria = null, cache = null;

  const avisar = () => window.dispatchEvent(new CustomEvent("carta:datos"));
  window.addEventListener("storage", e => { if (e.key === CLAVE) { cache = null; avisar(); } });

  const nuevoId = pre => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const platoDe = id => L.platos.find(p => p.id === id);
  const estacionDe = id => {
    const p = platoDe(id), c = p && L.categorias.find(x => x.id === p.categoria);
    return (c && c.estacion) || "cocina";
  };
  const nombreEquipo = id => ((L.equipo || []).find(e => e.id === id) || {}).nombre || "Alguien del equipo";
  const nombreEstacion = id => ((L.estaciones || []).find(e => e.id === id) || {}).nombre || id;
  const suma = items => items.reduce((s, x) => s + x.precio * x.cant, 0);
  const anotar = (s, texto, t = Date.now()) => {
    s.historia.push({ t, texto });
    s.historia.sort((a, b) => a.t - b.t);
    if (s.historia.length > 80) s.historia.shift();
  };
  const estadoPedido = p => (p.rechazado ? "rechazado"
    : ESTADOS[Math.min(...Object.values(p.partes).map(x => ESTADOS.indexOf(x.estado)))]);
  const DIVIDIR = { junto: "todo junto", igual: "en partes iguales", "cada-uno": "cada uno lo suyo" };

  /* ---------------------------------------------------------------------------
     Lo que ya está pasando en el local cuando se abre la demo
     --------------------------------------------------------------------------- */
  function ejemplo() {
    const ahora = Date.now();
    const antes = m => ahora - m * 60e3;
    const d = { v: 3, numero: 39, sesiones: [], comensales: [], carrito: [], pedidos: [], llamados: [], agotados: [], sim: { inicio: ahora, paso: 0 } };

    const mesa = (n, hace, nombres, extra = {}) => {
      const s = { id: "s" + n + "-" + ahora.toString(36), mesa: n, abierta: antes(hace), cerrada: null, historia: [], ...extra };
      d.sesiones.push(s);
      const gente = nombres.map((nombre, i) => {
        const c = { id: `${s.id}-${i}`, sesion: s.id, nombre, color: COLORES[i % COLORES.length], unido: s.abierta + i * 50e3, sim: true };
        d.comensales.push(c);
        anotar(s, i ? `${nombre} se sumó a la mesa` : `${nombre} escaneó el QR y abrió la mesa`, c.unido);
        return c;
      });
      return { s, gente };
    };
    const item = (id, cant, c, detalle = "", precio) => ({
      plato: id, nombre: platoDe(id).nombre, cant, precio: precio || platoDe(id).precio, detalle, eleccion: null, comensal: c.id, estacion: estacionDe(id),
    });
    // estados: { cocina: ["preparando", hace (min), quién], barra: [...] }
    const QUIEN = { cocina: "diego", barra: "martin" };
    const pedido = (numero, m, por, hace, items, estados, nota = "") => {
      const p = {
        id: "p" + numero, numero, sesion: m.s.id, mesa: m.s.mesa, ronda: d.pedidos.filter(x => x.sesion === m.s.id).length + 1,
        por: por.id, creado: antes(hace), items, nota, total: suma(items), partes: {}, rechazado: null,
      };
      anotar(m.s, `${por.nombre} mandó la ronda ${p.ronda} (pedido ${numero})`, p.creado);
      Object.entries(estados).forEach(([est, [estado, desde, quien]]) => {
        p.partes[est] = { estado, cambio: antes(desde), quien };
        const k = ESTADOS.indexOf(estado), nom = nombreEstacion(est);
        if (k >= 1) anotar(m.s, `${nombreEquipo(QUIEN[est])} empezó la ronda ${p.ronda} · ${nom}`, k === 1 ? antes(desde) : p.creado + 50e3);
        if (k >= 2) anotar(m.s, `${nombreEquipo(QUIEN[est])} terminó la ronda ${p.ronda} · ${nom}`, k === 2 ? antes(desde) : antes(desde) - 90e3);
        if (k >= 3) anotar(m.s, `${nombreEquipo(quien)} llevó a la mesa la ronda ${p.ronda} · ${nom}`, antes(desde));
      });
      d.pedidos.push(p);
      return p;
    };

    // Mesas que ya se cobraron hoy (suman a "vendido hoy")
    const m1 = mesa(1, 95, ["Pau", "Gonza"]);
    pedido(31, m1, m1.gente[0], 88, [item("clasica", 1, m1.gente[0]), item("remolacha", 1, m1.gente[1]), item("ipa", 2, m1.gente[0])],
      { cocina: ["entregado", 70, "carla"], barra: ["entregado", 84, "carla"] });
    Object.assign(m1.s, { cerrada: antes(41), cerradaPor: "sofi", total: d.pedidos[0].total });
    anotar(m1.s, "Sofi cobró y liberó la mesa", m1.s.cerrada);
    const m6 = mesa(6, 80, ["Rocío", "Lean", "Maca", "Ivo"]);
    pedido(32, m6, m6.gente[2], 74, [item("pepperoni", 1, m6.gente[0]), item("fugazzeta", 1, m6.gente[2]), item("fernet", 2, m6.gente[1]), item("limonada", 2, m6.gente[3])],
      { cocina: ["entregado", 52, "carla"], barra: ["entregado", 70, "carla"] });
    pedido(33, m6, m6.gente[1], 40, [item("flan", 2, m6.gente[1]), item("helado", 1, m6.gente[3])], { cocina: ["entregado", 31, "carla"] });
    Object.assign(m6.s, { cerrada: antes(12), cerradaPor: "carla", total: d.pedidos.slice(1, 3).reduce((t, p) => t + p.total, 0) });
    anotar(m6.s, "Carla cobró y liberó la mesa", m6.s.cerrada);

    // Las mesas ocupadas ahora
    const m5 = mesa(5, 46, ["Lucas", "Vale", "Agus", "Belu", "Santi"]);
    const [lucas, vale, agus, belu, santi] = m5.gente;
    pedido(34, m5, lucas, 38, [item("doble-bacon", 1, lucas), item("doble-bacon", 1, agus), item("aros", 1, belu), item("ipa", 2, santi), item("ipa", 1, lucas)],
      { cocina: ["entregado", 22, "carla"], barra: ["entregado", 34, "carla"] });

    const m2 = mesa(2, 62, ["Caro", "Martu"]);
    const [caro, martu] = m2.gente;
    const p35 = pedido(35, m2, caro, 52, [item("remolacha", 1, martu), item("clasica", 1, caro), item("papas-cheddar", 1, caro), item("limonada", 1, martu), item("fernet", 1, caro)],
      { cocina: ["entregado", 30, "carla"], barra: ["entregado", 46, "carla"] });

    const m11 = mesa(11, 33, ["Ana", "Pedro", "Luz"]);
    pedido(36, m11, m11.gente[0], 24, [item("helado", 1, m11.gente[2]), item("flan", 1, m11.gente[1]), item("cheesecake", 1, m11.gente[0])],
      { cocina: ["entregado", 10, "nico"] });

    const m9 = mesa(9, 24, ["Fede", "Sol"]);
    pedido(37, m9, m9.gente[1], 16, [item("fugazzeta", 1, m9.gente[1]), item("fernet", 1, m9.gente[0]), item("fernet", 1, m9.gente[1])],
      { cocina: ["listo", 1, "diego"], barra: ["entregado", 12, "nico"] });

    const m3 = mesa(3, 14, ["Mica", "Joaco", "Rama"]);
    pedido(38, m3, m3.gente[1], 7, [item("pepperoni", 1, m3.gente[0]), item("papas-cheddar", 1, m3.gente[2]), item("ipa", 2, m3.gente[1])],
      { cocina: ["preparando", 5, "diego"], barra: ["entregado", 3, "carla"] });

    const m12 = mesa(12, 4, ["Flor", "Nahue"]);
    pedido(39, m12, m12.gente[0], 0.8, [item("clasica", 1, m12.gente[0], "Doble · sin cebolla", 21700), item("clasica", 1, m12.gente[1], "Doble · sin cebolla", 21700), item("limonada", 1, m12.gente[0]), item("limonada", 1, m12.gente[1])],
      { cocina: ["nuevo", 0.8, null], barra: ["nuevo", 0.8, null] }, "Una de las burgers bien cocida");

    // Mesa 4: se acaban de sentar y están eligiendo
    const m4 = mesa(4, 2, ["Emi"]);
    d.carrito.push(
      { id: "l-emi1", sesion: m4.s.id, comensal: m4.gente[0].id, plato: "clasica", eleccion: null, detalle: "", precio: platoDe("clasica").precio, clave: "clasica", cant: 1, creado: antes(1) },
      { id: "l-emi2", sesion: m4.s.id, comensal: m4.gente[0].id, plato: "ipa", eleccion: null, detalle: "", precio: platoDe("ipa").precio, clave: "ipa", cant: 1, creado: antes(0.5) },
    );

    // Tu mesa: Juli y Tomi ya están sentados (en la demo son de mentira)
    mesa(L.mesaDemo, 2, ["Juli", "Tomi"], { guion: { paso: 0 } });

    // Llamados que están esperando
    d.llamados.push(
      { id: "ll-5", sesion: m5.s.id, mesa: 5, tipo: "mozo", comensal: vale.id, creado: ahora - 35e3, toma: null, tomado: null, atendido: null },
      { id: "ll-2", sesion: m2.s.id, mesa: 2, tipo: "cuenta", comensal: caro.id, creado: ahora - 110e3, toma: null, tomado: null, atendido: null,
        pago: "Mercado Pago", propina: 10, dividir: "igual", partes: 2, total: Math.round(p35.total * 1.1) },
    );
    anotar(m5.s, "Vale llamó al mozo", ahora - 35e3);
    anotar(m2.s, "Caro pidió la cuenta: Mercado Pago, 10 % de propina, en partes iguales", ahora - 110e3);
    return d;
  }

  /* ---------------------------------------------------------------------------
     Guardar y leer (vista previa: en este navegador)
     --------------------------------------------------------------------------- */
  function leer() {
    if (cache) return cache;
    let d = null;
    try { d = JSON.parse(localStorage.getItem(CLAVE)); } catch { d = null; }
    if (!d || d.v !== 3) {
      d = memoria && memoria.v === 3 ? memoria : ejemplo();
      try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch { /* queda en memoria */ }
    }
    memoria = d;
    return (cache = d);
  }
  function guardar(d) {
    memoria = cache = d;
    try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch { /* queda en memoria */ }
    avisar();
  }
  // Toda escritura pasa por acá: lee lo último (por si otra pestaña escribió), cambia y guarda.
  function cambiar(fn) {
    cache = null;
    const d = leer();
    const r = fn(d);
    if (r === SIN) return null;
    guardar(d);
    return r;
  }
  const sesionActiva = (d, mesa) => d.sesiones.find(s => s.mesa === mesa && !s.cerrada) || null;
  const deComensal = (d, id) => {
    const c = d.comensales.find(x => x.id === id);
    const s = c && d.sesiones.find(x => x.id === c.sesion);
    return c && s && !s.cerrada ? { c, s } : null;
  };

  /* ---------------------------------------------------------------------------
     Lo que hace el comensal
     --------------------------------------------------------------------------- */
  // Entrar a la mesa (el QR): si la mesa está libre, se abre una sesión nueva.
  function entrar(mesa, nombre, extra = {}) {
    return cambiar(d => {
      if (!L.mesas.some(m => m.n === mesa)) return SIN;
      const ahora = Date.now();
      let s = sesionActiva(d, mesa);
      if (!s) { s = { id: nuevoId("s"), mesa, abierta: ahora, cerrada: null, historia: [] }; d.sesiones.push(s); }
      const gente = d.comensales.filter(c => c.sesion === s.id);
      const usados = new Set(gente.map(c => c.color));
      nombre = String(nombre || "").replace(/\s+/g, " ").trim().slice(0, 20) || `Invitado ${gente.length + 1}`;
      if (gente.some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) nombre += " " + (gente.length + 1);
      const c = {
        id: nuevoId("c"), sesion: s.id, nombre, unido: ahora, ...extra,
        color: COLORES.find(x => !usados.has(x)) || COLORES[gente.length % COLORES.length],
      };
      d.comensales.push(c);
      anotar(s, gente.length ? `${nombre} se sumó a la mesa` : `${nombre} escaneó el QR y abrió la mesa`, ahora);
      return { sesion: s, comensal: c };
    });
  }

  // Sumar algo al pedido de la mesa (queda a nombre de quien lo sumó)
  function sumar(comensal, l) {
    return cambiar(d => {
      const x = deComensal(d, comensal);
      if (!x || !platoDe(l.plato) || d.agotados.some(a => a.id === l.plato)) return SIN;
      const cant = Math.max(1, Math.min(20, Math.round(l.cant || 1)));
      let linea = d.carrito.find(y => y.comensal === comensal && y.clave === (l.clave || l.plato));
      if (linea) linea.cant += cant;
      else {
        linea = { id: nuevoId("l"), sesion: x.s.id, comensal, plato: l.plato, eleccion: l.eleccion || null, detalle: l.detalle || "", precio: l.precio, clave: l.clave || l.plato, cant, creado: Date.now() };
        d.carrito.push(linea);
      }
      return linea;
    });
  }

  // Cambiar la cantidad de una línea propia (cada uno toca solo lo suyo)
  function cantidad(comensal, lineaId, delta) {
    return cambiar(d => {
      const l = d.carrito.find(x => x.id === lineaId && x.comensal === comensal);
      if (!l || !deComensal(d, comensal)) return SIN;
      l.cant += delta;
      if (l.cant <= 0) d.carrito = d.carrito.filter(x => x !== l);
      return l;
    });
  }

  // Mandar el pedido: sale todo lo que eligió la mesa, de todos, como una ronda.
  function mandar(comensal, nota) {
    return cambiar(d => {
      const x = deComensal(d, comensal);
      if (!x) return SIN;
      const lineas = d.carrito.filter(l => l.sesion === x.s.id && !d.agotados.some(a => a.id === l.plato));
      if (!lineas.length) return SIN;
      const ahora = Date.now();
      const items = lineas.map(l => ({
        plato: l.plato, nombre: platoDe(l.plato).nombre, cant: l.cant, precio: l.precio, detalle: l.detalle,
        eleccion: l.eleccion, comensal: l.comensal, estacion: estacionDe(l.plato),
      }));
      const partes = {};
      items.forEach(i => { partes[i.estacion] = partes[i.estacion] || { estado: "nuevo", cambio: ahora, quien: null }; });
      d.numero += 1;
      const p = {
        id: nuevoId("p"), numero: d.numero, sesion: x.s.id, mesa: x.s.mesa,
        ronda: d.pedidos.filter(y => y.sesion === x.s.id).length + 1,
        por: comensal, creado: ahora, items, nota: String(nota || "").trim().slice(0, 200),
        total: suma(items), partes, rechazado: null,
      };
      d.pedidos.push(p);
      const mandadas = new Set(lineas.map(l => l.id));
      d.carrito = d.carrito.filter(l => !mandadas.has(l.id));
      const cuantos = new Set(items.map(i => i.comensal)).size;
      anotar(x.s, `${x.c.nombre} mandó la ronda ${p.ronda} (pedido ${p.numero})${cuantos > 1 ? `, con lo de ${cuantos} personas` : ""}`, ahora);
      return p;
    });
  }

  // Llamar al mozo o pedir la cuenta. Si ya llamaron y nadie fue, no se duplica.
  function llamar(comensal, tipo, datos = {}) {
    return cambiar(d => {
      const x = deComensal(d, comensal);
      if (!x) return SIN;
      const ahora = Date.now();
      const abierto = d.llamados.find(l => l.sesion === x.s.id && l.tipo === tipo && !l.atendido);
      if (tipo === "mozo" && abierto) return { llamado: abierto, ya: true };
      if (abierto) d.llamados = d.llamados.filter(l => l !== abierto);          // la cuenta, con los datos nuevos
      const l = {
        id: nuevoId("ll"), sesion: x.s.id, mesa: x.s.mesa, tipo, comensal, creado: ahora,
        toma: abierto ? abierto.toma : null, tomado: abierto ? abierto.tomado : null, atendido: null, ...datos,
      };
      d.llamados.push(l);
      anotar(x.s, tipo === "mozo" ? `${x.c.nombre} llamó al mozo`
        : `${x.c.nombre} pidió la cuenta: ${datos.pago}, ${datos.propina ? datos.propina + " % de propina" : "sin propina"}, ${DIVIDIR[datos.dividir] || "todo junto"}`, ahora);
      return { llamado: l, ya: false };
    });
  }

  /* ---------------------------------------------------------------------------
     Lo que hace el equipo (quien = id de la persona que lo hizo)
     --------------------------------------------------------------------------- */
  // Avanzar la parte de una estación: nuevo → preparando → listo → entregado.
  // Si dos lo tocan a la vez, gana el primero y el segundo no hace nada.
  function mover(pedidoId, estacion, estado, quien, aMano = true) {
    return cambiar(d => {
      const p = d.pedidos.find(x => x.id === pedidoId);
      const pa = p && p.partes[estacion];
      const s = p && d.sesiones.find(x => x.id === p.sesion);
      if (!pa || !s || s.cerrada || p.rechazado || ESTADOS.indexOf(estado) <= ESTADOS.indexOf(pa.estado)) return SIN;
      pa.estado = estado;
      pa.cambio = Date.now();
      pa.quien = quien || null;
      if (aMano) pa.aMano = true;
      const verbo = { preparando: "empezó", listo: "terminó", entregado: "llevó a la mesa" }[estado];
      anotar(s, `${nombreEquipo(quien)} ${verbo} la ronda ${p.ronda} · ${nombreEstacion(estacion)}`, pa.cambio);
      return p;
    });
  }

  // No tomar un pedido (por ejemplo, un pedido "en broma" de una mesa donde no hay nadie).
  function rechazar(pedidoId, quien) {
    return cambiar(d => {
      const p = d.pedidos.find(x => x.id === pedidoId);
      const s = p && d.sesiones.find(x => x.id === p.sesion);
      if (!p || !s || p.rechazado || Object.values(p.partes).some(x => x.estado !== "nuevo")) return SIN;
      p.rechazado = { quien: quien || null, t: Date.now() };
      anotar(s, `${nombreEquipo(quien)} no tomó la ronda ${p.ronda}`, p.rechazado.t);
      return p;
    });
  }

  // "Voy" (al mozo) o "Llevo la cuenta". El primero que toca se la queda.
  function atender(llamadoId, quien) {
    return cambiar(d => {
      const l = d.llamados.find(x => x.id === llamadoId);
      const s = l && d.sesiones.find(x => x.id === l.sesion);
      if (!l || !s || l.atendido || (l.tipo === "cuenta" && l.toma)) return SIN;
      const ahora = Date.now();
      if (l.tipo === "mozo") {
        l.atendido = { quien: quien || null, t: ahora };
        anotar(s, `${nombreEquipo(quien)} fue a la mesa`, ahora);
      } else {
        l.toma = quien || null;
        l.tomado = ahora;
        anotar(s, `${nombreEquipo(quien)} lleva la cuenta`, ahora);
      }
      return l;
    });
  }

  // Cobrada: la sesión se cierra y la mesa queda libre para los próximos.
  function cerrarMesa(mesa, quien) {
    return cambiar(d => {
      const s = sesionActiva(d, mesa);
      if (!s) return SIN;
      const ahora = Date.now();
      s.cerrada = ahora;
      s.cerradaPor = quien || null;
      s.total = d.pedidos.filter(p => p.sesion === s.id && !p.rechazado).reduce((t, p) => t + p.total, 0);
      d.carrito = d.carrito.filter(l => l.sesion !== s.id);
      d.llamados.forEach(l => { if (l.sesion === s.id && !l.atendido) l.atendido = { quien: quien || null, t: ahora }; });
      anotar(s, `${nombreEquipo(quien)} cobró y liberó la mesa`, ahora);
      return s;
    });
  }

  function agotar(id, si, quien) {
    return cambiar(d => {
      const ya = d.agotados.some(a => a.id === id);
      if (ya === !!si) return SIN;
      d.agotados = d.agotados.filter(a => a.id !== id);
      if (si) d.agotados.push({ id, quien: quien || null, t: Date.now() });
      return true;
    });
  }

  /* ---------------------------------------------------------------------------
     Lo que ven la carta y el panel
     --------------------------------------------------------------------------- */
  function mesaDe(sesionId) {
    const d = leer();
    const sesion = d.sesiones.find(s => s.id === sesionId);
    if (!sesion) return null;
    const de = lista => lista.filter(x => x.sesion === sesionId);
    return { sesion, comensales: de(d.comensales), carrito: de(d.carrito), pedidos: de(d.pedidos), llamados: de(d.llamados) };
  }

  /* ---------------------------------------------------------------------------
     Quién es este celular en su mesa (cada pestaña puede ser otra persona con ?nuevo)
     --------------------------------------------------------------------------- */
  const YO = "cartaviva.yo", MIOS = "cartaviva.mios";
  const otraPersona = new URLSearchParams(location.search).has("nuevo");
  function yo(mesa) {
    const s = mesa && sesionActiva(leer(), mesa);
    if (!s) return null;
    const valido = id => { const c = id && leer().comensales.find(x => x.id === id); return c && c.sesion === s.id ? c.id : null; };
    let id = null;
    try { id = valido(sessionStorage.getItem(YO)); } catch { /* sin almacenamiento */ }
    if (!id && !otraPersona) { try { id = valido((JSON.parse(localStorage.getItem(MIOS)) || {})[s.id]); } catch { /* idem */ } }
    return id;
  }
  function recordarYo(c) {
    try {
      sessionStorage.setItem(YO, c.id);
      if (otraPersona) return;
      const m = JSON.parse(localStorage.getItem(MIOS) || "{}");
      m[c.sesion] = c.id;
      localStorage.setItem(MIOS, JSON.stringify(m));
    } catch { /* queda solo mientras esté abierta */ }
  }
  function olvidarYo() { try { sessionStorage.removeItem(YO); } catch { /* nada */ } }

  // Quién del equipo está usando este dispositivo (en la demo, el PIN está en local.js)
  const SOY = "cartaviva.equipo.yo";
  const EQUIPO = L.equipo || [];
  function soyEquipo() {
    let id = null;
    try { id = sessionStorage.getItem(SOY) || localStorage.getItem(SOY); } catch { /* sin almacenamiento */ }
    return EQUIPO.some(e => e.id === id) ? id : null;
  }
  async function entrarEquipo(id, pin) {
    const e = EQUIPO.find(x => x.id === id);
    if (!e || String(e.pin) !== String(pin)) return { ok: false, motivo: "pin" };
    try { sessionStorage.setItem(SOY, id); localStorage.setItem(SOY, id); } catch { /* queda en esta pestaña */ }
    return { ok: true };
  }
  function salirEquipo() { try { sessionStorage.removeItem(SOY); localStorage.removeItem(SOY); } catch { /* nada */ } }

  window.Datos = {
    modo: "vista-previa",
    listo: Promise.resolve(),
    ESTADOS, COLORES, DIVIDIR,

    // La mesa del link (?mesa=7). En la base real llega con el código del QR (?m=...).
    abrirMesa: async ({ mesa }) => { const m = L.mesas.find(x => x.n === mesa); return m ? { mesa: m.n, zona: m.zona, lugares: m.lugares } : null; },
    yo, recordarYo, olvidarYo,
    gente: mesa => { const s = sesionActiva(leer(), mesa); return s ? leer().comensales.filter(c => c.sesion === s.id) : []; },

    todo: leer,                                       // para el panel: no modificar
    sesionDe: mesa => sesionActiva(leer(), mesa),
    mesa: mesaDe,
    comensal: id => leer().comensales.find(c => c.id === id) || null,
    agotado: id => leer().agotados.some(a => a.id === id),
    agotadoPor: id => leer().agotados.find(a => a.id === id) || null,
    estadoPedido, estacionDe, nombreEquipo, nombreEstacion,

    entrar, sumar, cantidad, mandar, llamar,

    // El equipo
    equipo: () => EQUIPO,
    mesas: () => L.mesas,
    necesitaCuenta: () => false,
    abrirPanel: () => {}, cerrarPanel: () => {},
    soyEquipo, entrarEquipo, salirEquipo,
    mover, rechazar, atender, cerrarMesa, agotar,
    reiniciar: () => { memoria = null; cache = null; guardar(ejemplo()); },

    // Solo para la simulación de la demo
    _cambiar: cambiar, _SIN: SIN, _anotar: anotar,
  };
})();
