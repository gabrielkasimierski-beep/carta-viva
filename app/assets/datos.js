/* =============================================================================
   CARTA VIVA — los datos del local: mesas, comensales, pedidos, llamados y equipo
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
   · EQUIPO: cada persona con su PIN, su puesto y sus permisos (qué ve y qué puede hacer).
     Los maneja quien tiene el permiso "equipo" (el dueño o el encargado).
   ============================================================================= */

(function () {
  "use strict";

  const L = window.LOCAL;
  const CLAVE = "cartaviva.demo.v4";
  const VERSION = 4;
  const ESTADOS = ["nuevo", "preparando", "listo", "entregado"];
  const COLORES = ["#FF7A59", "#3DB2FF", "#FFC43D", "#A57BFF", "#2BC48A", "#FF6FB5"];
  const COLORES_EQUIPO = ["#C4A4FF", "#7FD6FF", "#8BE3B4", "#FFB27A", "#FFD86B", "#F28FB0", "#9FB4FF", "#E6C79C"];
  const VENTANA = 20e3;           // cuánto tiempo hay para deshacer algo tocado sin querer
  const SIN = {};                 // "no cambió nada": no se guarda ni se avisa
  let memoria = null, cache = null;

  try { localStorage.removeItem("cartaviva.demo.v3"); } catch { /* sin almacenamiento */ }
  const avisar = () => window.dispatchEvent(new CustomEvent("carta:datos"));
  const error = texto => window.dispatchEvent(new CustomEvent("carta:error", { detail: texto }));
  window.addEventListener("storage", e => { if (e.key === CLAVE) { cache = null; avisar(); } });

  const nuevoId = pre => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const platoDe = id => L.platos.find(p => p.id === id);
  const estacionDe = id => {
    const p = platoDe(id), c = p && L.categorias.find(x => x.id === p.categoria);
    return (c && c.estacion) || "cocina";
  };
  const nombreEstacion = id => ((L.estaciones || []).find(e => e.id === id) || {}).nombre || id;
  const suma = items => items.reduce((s, x) => s + x.precio * x.cant, 0);
  const anotar = (s, texto, t = Date.now()) => {
    s.historia.push({ t, texto });
    s.historia.sort((a, b) => a.t - b.t);
    if (s.historia.length > 80) s.historia.shift();
  };
  // Lo que se deshizo no queda en la historia de la mesa
  const desanotar = (s, texto, t) => {
    for (let i = s.historia.length - 1; i >= 0; i--) {
      const h = s.historia[i];
      if (h.texto === texto && Math.abs(h.t - t) < 2000) { s.historia.splice(i, 1); return; }
    }
  };
  const estadoPedido = p => (p.rechazado ? "rechazado"
    : ESTADOS[Math.min(...Object.values(p.partes).map(x => ESTADOS.indexOf(x.estado)))]);
  const DIVIDIR = { junto: "todo junto", igual: "en partes iguales", "cada-uno": "cada uno lo suyo" };

  /* ---------------------------------------------------------------------------
     Permisos y puestos
     --------------------------------------------------------------------------- */
  const ESTACIONES = L.estaciones && L.estaciones.length ? L.estaciones : [{ id: "cocina", nombre: "Cocina", donde: "la cocina" }];
  const PERMISOS = [
    { id: "mesas",   grupo: "El salón", corto: "Mesas",    nombre: "Ver las mesas",        ayuda: "El plano del salón: quién está sentado, qué pidió cada mesa y cuánto lleva." },
    { id: "atender", grupo: "El salón", corto: "Llamados", nombre: "Atender los llamados", ayuda: "Le suena cuando una mesa llama al mozo." },
    { id: "llevar",  grupo: "El salón", corto: "Llevar",   nombre: "Llevar a las mesas",   ayuda: "Le suena cuando la comida o las bebidas están listas para llevar." },
    { id: "cobrar",  grupo: "El salón", corto: "Cobrar",   nombre: "Cobrar",               ayuda: "Lleva la cuenta, cobra y deja la mesa libre." },
    ...ESTACIONES.map(e => ({
      id: e.id, grupo: "Cocina y barra", corto: e.nombre, nombre: e.nombre,
      ayuda: `Ve las comandas de ${e.donde || e.nombre.toLowerCase()} y las marca empezadas y listas.`,
    })),
    { id: "carta",   grupo: "El local", corto: "Agotados", nombre: "Marcar agotados",      ayuda: "Lo que se termina deja de poder pedirse en todas las mesas." },
    { id: "qr",      grupo: "El local", corto: "QR",       nombre: "Los QR de las mesas",  ayuda: "Verlos e imprimirlos para pegar en cada mesa." },
    { id: "equipo",  grupo: "El local", corto: "Equipo",   nombre: "Manejar el equipo",    ayuda: "Sumar personas, darles un PIN y elegir qué puede hacer cada una." },
  ];
  const TODOS = PERMISOS.map(p => p.id);
  const ROLES = (L.roles && L.roles.length ? L.roles : [
    { id: "encargado", nombre: "Encargado/a", permisos: TODOS },
    { id: "mozo", nombre: "Mozo/a", permisos: ["mesas", "atender", "llevar", "cobrar"] },
  ]).map(r => ({ id: r.id, nombre: r.nombre, permisos: r.permisos.filter(p => TODOS.includes(p)) }));
  const rolDe = id => ROLES.find(r => r.id === id) || null;
  const permisosDeRol = id => [...((rolDe(id) || {}).permisos || [])];
  const activo = e => !!e && e.activo !== false;
  const tiene = (e, permiso) => activo(e) && (e.permisos || []).includes(permiso);
  const quienEs = (d, id) => (d.equipo || []).find(e => e.id === id) || null;
  const nombreEn = (d, id) => (quienEs(d, id) || {}).nombre || "Alguien del equipo";
  // Qué hace falta para cada cosa del equipo (lo mismo valida la base real)
  // Llevar a la mesa es de quien lleva (el mozo); empezar y terminar, de la estación
  const puedeMover = (e, estacion, estado) => (estado === "entregado" ? tiene(e, "llevar") : tiene(e, estacion));
  const puedeRechazar = (e, p) => tiene(e, "mesas") || Object.keys(p.partes).some(est => tiene(e, est));
  const puedeAtender = (e, l) => tiene(e, l.tipo === "mozo" ? "atender" : "cobrar");
  // Un dueño solo lo cambia otro dueño
  const puedeEditar = (yo, e) => tiene(yo, "equipo") && (!e || e.rol !== "dueno" || yo.rol === "dueno");

  function pinNuevo() {
    for (;;) {
      const p = String(1000 + Math.floor(Math.random() * 9000));
      if (!/^(\d)\1{3}$/.test(p) && !"0123456789".includes(p) && !"9876543210".includes(p)) return p;
    }
  }
  const pinValido = pin => /^\d{4}$/.test(String(pin || ""));
  const colorValido = c => /^#[0-9A-Fa-f]{6}$/.test(String(c || ""));

  function equipoInicial() {
    return (L.equipo || []).map((e, i) => ({
      id: e.id, nombre: e.nombre, rol: e.rol, puesto: e.puesto || (rolDe(e.rol) || {}).nombre || "",
      zona: e.zona || "", color: e.color || COLORES_EQUIPO[i % COLORES_EQUIPO.length], pin: String(e.pin || "1234"),
      permisos: (e.permisos || permisosDeRol(e.rol)).filter(p => TODOS.includes(p)), activo: true, orden: i,
    }));
  }

  /* ---------------------------------------------------------------------------
     Lo que ya está pasando en el local cuando se abre la demo
     --------------------------------------------------------------------------- */
  function ejemplo(equipo) {
    const ahora = Date.now();
    const antes = m => ahora - m * 60e3;
    const d = {
      v: VERSION, numero: 39, equipo: equipo || equipoInicial(),
      sesiones: [], comensales: [], carrito: [], pedidos: [], llamados: [], agotados: [], sim: { inicio: ahora, paso: 0 },
    };
    // Quién hace cada cosa en lo que ya pasó: alguien del equipo con ese permiso
    const hace = (permiso, prefiere) => {
      const e = d.equipo.filter(x => tiene(x, permiso));
      return (e.find(x => x.id === prefiere) || e.find(x => x.rol === permiso) || e[0] || {}).id || null;
    };

    const mesa = (n, hace_, nombres, extra = {}) => {
      const s = { id: "s" + n + "-" + ahora.toString(36), mesa: n, abierta: antes(hace_), cerrada: null, historia: [], ...extra };
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
    // estados: { cocina: ["preparando", hace (min), quién lo llevó], barra: [...] }
    const pedido = (numero, m, por, hace_, items, estados, nota = "") => {
      const p = {
        id: "p" + numero, numero, sesion: m.s.id, mesa: m.s.mesa, ronda: d.pedidos.filter(x => x.sesion === m.s.id).length + 1,
        por: por.id, creado: antes(hace_), items, nota, total: suma(items), partes: {}, rechazado: null,
      };
      anotar(m.s, `${por.nombre} mandó la ronda ${p.ronda} (pedido ${numero})`, p.creado);
      Object.entries(estados).forEach(([est, [estado, desde, lleva]]) => {
        const k = ESTADOS.indexOf(estado), nom = nombreEstacion(est);
        const cocinero = hace(est, est === "cocina" ? "diego" : "martin");
        const llevo = hace("llevar", lleva);
        p.partes[est] = { estado, cambio: antes(desde), quien: k === 3 ? llevo : k >= 1 ? cocinero : null };
        if (k >= 1) anotar(m.s, `${nombreEn(d, cocinero)} empezó la ronda ${p.ronda} · ${nom}`, k === 1 ? antes(desde) : p.creado + 50e3);
        if (k >= 2) anotar(m.s, `${nombreEn(d, cocinero)} terminó la ronda ${p.ronda} · ${nom}`, k === 2 ? antes(desde) : antes(desde) - 90e3);
        if (k >= 3) anotar(m.s, `${nombreEn(d, llevo)} llevó a la mesa la ronda ${p.ronda} · ${nom}`, antes(desde));
      });
      d.pedidos.push(p);
      return p;
    };

    // Mesas que ya se cobraron hoy (suman a "vendido hoy")
    const m1 = mesa(1, 95, ["Pau", "Gonza"]);
    pedido(31, m1, m1.gente[0], 88, [item("clasica", 1, m1.gente[0]), item("remolacha", 1, m1.gente[1]), item("ipa", 2, m1.gente[0])],
      { cocina: ["entregado", 70, "carla"], barra: ["entregado", 84, "carla"] });
    const cobra = hace("cobrar", "sofi");
    Object.assign(m1.s, { cerrada: antes(41), cerradaPor: cobra, total: d.pedidos[0].total });
    anotar(m1.s, `${nombreEn(d, cobra)} cobró y liberó la mesa`, m1.s.cerrada);
    const m6 = mesa(6, 80, ["Rocío", "Lean", "Maca", "Ivo"]);
    pedido(32, m6, m6.gente[2], 74, [item("pepperoni", 1, m6.gente[0]), item("fugazzeta", 1, m6.gente[2]), item("fernet", 2, m6.gente[1]), item("limonada", 2, m6.gente[3])],
      { cocina: ["entregado", 52, "carla"], barra: ["entregado", 70, "carla"] });
    pedido(33, m6, m6.gente[1], 40, [item("flan", 2, m6.gente[1]), item("helado", 1, m6.gente[3])], { cocina: ["entregado", 31, "carla"] });
    const cobra6 = hace("cobrar", "carla");
    Object.assign(m6.s, { cerrada: antes(12), cerradaPor: cobra6, total: d.pedidos.slice(1, 3).reduce((t, p) => t + p.total, 0) });
    anotar(m6.s, `${nombreEn(d, cobra6)} cobró y liberó la mesa`, m6.s.cerrada);

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
      { cocina: ["listo", 1], barra: ["entregado", 12, "nico"] });

    const m3 = mesa(3, 14, ["Mica", "Joaco", "Rama"]);
    pedido(38, m3, m3.gente[1], 7, [item("pepperoni", 1, m3.gente[0]), item("papas-cheddar", 1, m3.gente[2]), item("ipa", 2, m3.gente[1])],
      { cocina: ["preparando", 5], barra: ["entregado", 3, "carla"] });

    const m12 = mesa(12, 4, ["Flor", "Nahue"]);
    pedido(39, m12, m12.gente[0], 0.8, [item("clasica", 1, m12.gente[0], "Doble · sin cebolla", 21700), item("clasica", 1, m12.gente[1], "Doble · sin cebolla", 21700), item("limonada", 1, m12.gente[0]), item("limonada", 1, m12.gente[1])],
      { cocina: ["nuevo", 0.8], barra: ["nuevo", 0.8] }, "Una de las burgers bien cocida");

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
    if (!d || d.v !== VERSION) {
      d = memoria && memoria.v === VERSION ? memoria : ejemplo();
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
     El reloj de la demo
     La demo vive en este navegador: cuando nadie la mira, el local se "pausa". Al volver,
     todo se corre hacia adelante lo que estuvo pausado (así las horas de lo que hizo cada
     uno siguen teniendo sentido). Si pasaron más de 6 horas, arranca un servicio nuevo
     con el mismo equipo.
     --------------------------------------------------------------------------- */
  const VIVO = "cartaviva.demo.vivo";
  const PAUSA = 45e3, OTRO_DIA = 6 * 3600e3;
  function tiempos(d, fn) {
    const t = (o, k) => { if (o && typeof o[k] === "number") fn(o, k); };
    t(d.sim, "inicio");
    d.sesiones.forEach(s => { t(s, "abierta"); t(s, "cerrada"); t(s.guion, "desde"); (s.historia || []).forEach(h => t(h, "t")); });
    d.comensales.forEach(c => t(c, "unido"));
    d.carrito.forEach(l => t(l, "creado"));
    d.pedidos.forEach(p => {
      t(p, "creado"); t(p.rechazado, "t");
      Object.values(p.partes).forEach(pa => { t(pa, "cambio"); t(pa.antes, "cambio"); });
    });
    d.llamados.forEach(l => { t(l, "creado"); t(l, "tomado"); t(l.atendido, "t"); });
    d.agotados.forEach(a => t(a, "t"));
  }
  function revisarReloj() {
    if (document.visibilityState === "hidden") return;
    const ahora = Date.now();
    let vivo = 0;
    try { vivo = +localStorage.getItem(VIVO) || 0; localStorage.setItem(VIVO, String(ahora)); } catch { return; }
    if (!vivo || ahora - vivo <= PAUSA) return;
    cache = null;
    let d = leer();
    if (ahora - vivo > OTRO_DIA) d = ejemplo(d.equipo);
    else {
      let ultimo = 0;
      tiempos(d, (o, k) => { ultimo = Math.max(ultimo, o[k]); });
      const correr = Math.min(ahora - vivo, ahora - ultimo);      // nunca al futuro
      if (correr < 1000) return;
      tiempos(d, (o, k) => { o[k] += correr; });
    }
    guardar(d);
  }
  revisarReloj();
  setInterval(revisarReloj, 5000);
  document.addEventListener("visibilitychange", revisarReloj);
  window.addEventListener("pageshow", revisarReloj);

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
      const { color: pedido, ...resto } = extra;
      const c = {
        id: nuevoId("c"), sesion: s.id, nombre, unido: ahora, ...resto,
        color: COLORES.includes(pedido) && !usados.has(pedido) ? pedido
          : COLORES.find(x => !usados.has(x)) || COLORES[gente.length % COLORES.length],
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
     aMano = false: lo hace la simulación de la demo (no pide permisos)
     --------------------------------------------------------------------------- */
  const sinPermiso = () => { error("No tenés permiso para eso."); return SIN; };
  const VERBO = { preparando: "empezó", listo: "terminó", entregado: "llevó a la mesa" };
  const textoPaso = (d, quien, estado, p, estacion) => `${nombreEn(d, quien)} ${VERBO[estado]} la ronda ${p.ronda} · ${nombreEstacion(estacion)}`;

  // Avanzar la parte de una estación: nuevo → preparando → listo → entregado.
  // Si dos lo tocan a la vez, gana el primero y el segundo no hace nada.
  function mover(pedidoId, estacion, estado, quien, aMano = true) {
    return cambiar(d => {
      const p = d.pedidos.find(x => x.id === pedidoId);
      const pa = p && p.partes[estacion];
      const s = p && d.sesiones.find(x => x.id === p.sesion);
      if (!pa || !s || s.cerrada || p.rechazado || ESTADOS.indexOf(estado) <= ESTADOS.indexOf(pa.estado)) return SIN;
      if (aMano && !puedeMover(quienEs(d, quien), estacion, estado)) return sinPermiso();
      const antes = { estado: pa.estado, cambio: pa.cambio, quien: pa.quien };
      pa.estado = estado;
      pa.cambio = Date.now();
      pa.quien = quien || null;
      if (aMano) { pa.aMano = true; pa.antes = antes; } else delete pa.antes;
      anotar(s, textoPaso(d, quien, estado, p, estacion), pa.cambio);
      return p;
    });
  }

  // No tomar un pedido (por ejemplo, un pedido "en broma" de una mesa donde no hay nadie).
  function rechazar(pedidoId, quien) {
    return cambiar(d => {
      const p = d.pedidos.find(x => x.id === pedidoId);
      const s = p && d.sesiones.find(x => x.id === p.sesion);
      if (!p || !s || p.rechazado || Object.values(p.partes).some(x => x.estado !== "nuevo")) return SIN;
      if (!puedeRechazar(quienEs(d, quien), p)) return sinPermiso();
      p.rechazado = { quien: quien || null, t: Date.now() };
      anotar(s, `${nombreEn(d, quien)} no tomó la ronda ${p.ronda}`, p.rechazado.t);
      return p;
    });
  }

  // "Voy" (al mozo) o "Llevo la cuenta". El primero que toca se la queda.
  function atender(llamadoId, quien, aMano = true) {
    return cambiar(d => {
      const l = d.llamados.find(x => x.id === llamadoId);
      const s = l && d.sesiones.find(x => x.id === l.sesion);
      if (!l || !s || l.atendido || (l.tipo === "cuenta" && l.toma)) return SIN;
      if (aMano && !puedeAtender(quienEs(d, quien), l)) return sinPermiso();
      const ahora = Date.now();
      if (l.tipo === "mozo") {
        l.atendido = { quien: quien || null, t: ahora };
        anotar(s, `${nombreEn(d, quien)} fue a la mesa`, ahora);
      } else {
        l.toma = quien || null;
        l.tomado = ahora;
        anotar(s, `${nombreEn(d, quien)} lleva la cuenta`, ahora);
      }
      return l;
    });
  }

  // Deshacer lo último que tocó uno mismo, si nadie lo cambió y pasaron menos de 20 segundos.
  //   { tipo: "mover", pedido, estacion }  ·  { tipo: "atender", llamado }
  function deshacer(accion, quien) {
    return cambiar(d => {
      const ahora = Date.now();
      if (accion.tipo === "mover") {
        const p = d.pedidos.find(x => x.id === accion.pedido);
        const pa = p && p.partes[accion.estacion];
        const s = p && d.sesiones.find(x => x.id === p.sesion);
        if (!pa || !pa.antes || !s || s.cerrada || pa.quien !== quien || ahora - pa.cambio > VENTANA) return SIN;
        desanotar(s, textoPaso(d, quien, pa.estado, p, accion.estacion), pa.cambio);
        Object.assign(pa, pa.antes, { aMano: true });           // la simulación ya no la toca
        delete pa.antes;
        return p;
      }
      if (accion.tipo === "atender") {
        const l = d.llamados.find(x => x.id === accion.llamado);
        const s = l && d.sesiones.find(x => x.id === l.sesion);
        if (!l || !s || s.cerrada) return SIN;
        if (l.tipo === "mozo" && l.atendido && l.atendido.quien === quien && ahora - l.atendido.t <= VENTANA) {
          desanotar(s, `${nombreEn(d, quien)} fue a la mesa`, l.atendido.t);
          l.atendido = null;
          return l;
        }
        if (l.tipo === "cuenta" && !l.atendido && l.toma === quien && ahora - l.tomado <= VENTANA) {
          desanotar(s, `${nombreEn(d, quien)} lleva la cuenta`, l.tomado);
          l.toma = null;
          l.tomado = null;
          return l;
        }
      }
      return SIN;
    });
  }

  // Cobrada: la sesión se cierra y la mesa queda libre para los próximos.
  function cerrarMesa(mesa, quien, aMano = true) {
    return cambiar(d => {
      const s = sesionActiva(d, mesa);
      if (!s) return SIN;
      if (aMano && !tiene(quienEs(d, quien), "cobrar")) return sinPermiso();
      const ahora = Date.now();
      s.cerrada = ahora;
      s.cerradaPor = quien || null;
      s.total = d.pedidos.filter(p => p.sesion === s.id && !p.rechazado).reduce((t, p) => t + p.total, 0);
      d.carrito = d.carrito.filter(l => l.sesion !== s.id);
      d.llamados.forEach(l => { if (l.sesion === s.id && !l.atendido) l.atendido = { quien: quien || null, t: ahora }; });
      anotar(s, `${nombreEn(d, quien)} cobró y liberó la mesa`, ahora);
      return s;
    });
  }

  function agotar(id, si, quien) {
    return cambiar(d => {
      if (!tiene(quienEs(d, quien), "carta")) return sinPermiso();
      const ya = d.agotados.some(a => a.id === id);
      if (ya === !!si) return SIN;
      d.agotados = d.agotados.filter(a => a.id !== id);
      if (si) d.agotados.push({ id, quien: quien || null, t: Date.now() });
      return true;
    });
  }

  /* ---------------------------------------------------------------------------
     El equipo: sumar, cambiar, PIN y dar de baja (lo hace quien tiene "equipo")
     Devuelven { ok: true, persona, pin } o { ok: false, motivo }.
     --------------------------------------------------------------------------- */
  function guardarPersona(quien, x) {
    let res = { ok: false, motivo: "error" };
    cambiar(d => {
      const yo = quienEs(d, quien);
      let e = x.id ? quienEs(d, x.id) : null;
      const no = motivo => { res = { ok: false, motivo }; return SIN; };
      if (x.id && !e) return no("no_existe");
      if (!puedeEditar(yo, e)) return no(tiene(yo, "equipo") ? "solo_dueno" : "sin_permiso");
      const nombre = String(x.nombre || "").replace(/\s+/g, " ").trim().slice(0, 20);
      if (!nombre) return no("nombre");
      const rol = rolDe(x.rol);
      if (!rol) return no("rol");
      if (rol.id === "dueno" && yo.rol !== "dueno") return no("solo_dueno");
      const permisos = [...new Set((x.permisos || rol.permisos).filter(p => TODOS.includes(p)))];
      if (e && e.id === quien && !permisos.includes("equipo")) return no("tu_permiso");
      const otro = d.equipo.find(y => activo(y) && y !== e && y.nombre.toLowerCase() === nombre.toLowerCase());
      if (otro) return no("nombre_repetido");
      let pin = null;
      if (!e) {
        pin = x.pin == null ? pinNuevo() : String(x.pin);
        if (!pinValido(pin)) return no("pin");
        // Si alguien con ese nombre estaba dado de baja, vuelve (con su historia)
        e = d.equipo.find(y => !activo(y) && y.nombre.toLowerCase() === nombre.toLowerCase());
        if (!e) { e = { id: nuevoId("e"), orden: d.equipo.length }; d.equipo.push(e); }
        e.pin = pin;
      }
      const usados = new Set(d.equipo.filter(activo).map(y => y.color));
      Object.assign(e, {
        nombre, rol: rol.id,
        puesto: e.rol === rol.id && e.puesto ? e.puesto : rol.nombre,
        zona: String(x.zona || "").slice(0, 30),
        color: colorValido(x.color) ? x.color : e.color || COLORES_EQUIPO.find(c => !usados.has(c)) || COLORES_EQUIPO[0],
        permisos, activo: true,
      });
      res = { ok: true, persona: { ...e, pin: undefined }, pin };
      return e;
    });
    return res;
  }
  // Un PIN nuevo: se lo da quien maneja el equipo, o cada uno a sí mismo.
  function cambiarPin(quien, id, pin) {
    let res = { ok: false, motivo: "error" };
    cambiar(d => {
      const yo = quienEs(d, quien), e = quienEs(d, id);
      if (!activo(e)) { res = { ok: false, motivo: "no_existe" }; return SIN; }
      if (quien !== id && !puedeEditar(yo, e)) { res = { ok: false, motivo: "sin_permiso" }; return SIN; }
      const nuevo = pin == null ? pinNuevo() : String(pin);
      if (!pinValido(nuevo)) { res = { ok: false, motivo: "pin" }; return SIN; }
      e.pin = nuevo;
      res = { ok: true, pin: nuevo };
      return e;
    });
    return res;
  }
  function bajaPersona(quien, id) {
    let res = { ok: false, motivo: "error" };
    cambiar(d => {
      const yo = quienEs(d, quien), e = quienEs(d, id);
      if (!activo(e)) { res = { ok: false, motivo: "no_existe" }; return SIN; }
      if (id === quien) { res = { ok: false, motivo: "vos" }; return SIN; }
      if (!puedeEditar(yo, e)) { res = { ok: false, motivo: "sin_permiso" }; return SIN; }
      e.activo = false;
      res = { ok: true };
      return e;
    });
    return res;
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

  // Quién del equipo está usando este dispositivo
  const SOY = "cartaviva.equipo.yo";
  // Como en la base real: el PIN no sale de acá (solo se compara al entrar)
  const equipoActivo = () => (leer().equipo || []).filter(activo).sort((a, b) => a.orden - b.orden).map(e => ({ ...e, pin: undefined }));
  function soyEquipo() {
    let id = null;
    try { id = sessionStorage.getItem(SOY) || localStorage.getItem(SOY); } catch { /* sin almacenamiento */ }
    return activo(quienEs(leer(), id)) ? id : null;
  }
  async function entrarEquipo(id, pin) {
    const e = quienEs(leer(), id);
    if (!activo(e) || String(e.pin) !== String(pin)) return { ok: false, motivo: "pin" };
    try { sessionStorage.setItem(SOY, id); localStorage.setItem(SOY, id); } catch { /* queda en esta pestaña */ }
    return { ok: true };
  }
  function salirEquipo() { try { sessionStorage.removeItem(SOY); localStorage.removeItem(SOY); } catch { /* nada */ } }

  window.Datos = {
    modo: "vista-previa",
    listo: Promise.resolve(),
    ESTADOS, COLORES, COLORES_EQUIPO, DIVIDIR, PERMISOS, ROLES, VENTANA,

    // La mesa del link (?mesa=7). En la base real llega con el código del QR (?m=...).
    abrirMesa: async ({ mesa }) => { const m = L.mesas.find(x => x.n === mesa); return m ? { mesa: m.n, zona: m.zona, lugares: m.lugares } : null; },
    yo, recordarYo, olvidarYo,
    gente: mesa => { const s = sesionActiva(leer(), mesa); return s ? leer().comensales.filter(c => c.sesion === s.id) : []; },
    coloresLibres: mesa => { const usados = new Set(Datos.gente(mesa).map(c => c.color)); return COLORES.filter(c => !usados.has(c)); },

    todo: leer,                                       // para el panel: no modificar
    sesionDe: mesa => sesionActiva(leer(), mesa),
    mesa: mesaDe,
    comensal: id => leer().comensales.find(c => c.id === id) || null,
    agotado: id => leer().agotados.some(a => a.id === id),
    agotadoPor: id => leer().agotados.find(a => a.id === id) || null,
    estadoPedido, estacionDe, nombreEstacion,
    nombreEquipo: id => nombreEn(leer(), id),

    entrar, sumar, cantidad, mandar, llamar,

    // El equipo
    equipo: equipoActivo,
    persona: id => { const e = quienEs(leer(), id); return e ? { ...e, pin: undefined } : null; },
    permisosDeRol, pinNuevo,
    puede: (id, permiso) => tiene(quienEs(leer(), id), permiso),
    mesas: () => L.mesas,
    necesitaCuenta: () => false,
    abrirPanel: () => {}, cerrarPanel: () => {},
    soyEquipo, entrarEquipo, salirEquipo,
    mover, rechazar, atender, deshacer, cerrarMesa, agotar,
    guardarPersona, cambiarPin, bajaPersona,
    reiniciar: () => { memoria = null; cache = null; guardar(ejemplo()); },

    // Solo para la simulación de la demo
    _cambiar: cambiar, _SIN: SIN, _anotar: anotar, _reloj: revisarReloj,
  };
})();
