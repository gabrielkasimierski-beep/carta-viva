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
   · CLUB: el comensal que quiere guarda su cuenta con su mail (sin contraseña: le llega un
     código). Cuando se cobra la mesa, lo que pidió suma sellos; cada tantos, un premio de
     regalo que pide desde su celu. Cuando vuelve, la carta lo saluda y el mozo sabe quién es.
   ============================================================================= */

(function () {
  "use strict";

  const L = window.LOCAL;
  const CLAVE = "cartaviva.demo.v9";
  const VIEJA = "cartaviva.demo.v8";      // de la versión anterior de la demo se hereda el equipo
  const VERSION = 9;
  const ESTADOS = ["nuevo", "preparando", "listo", "entregado"];
  // Paleta cálida y apagada, armonizada con la marca (rosa / crema): nada de candy neón
  const COLORES = ["#E08A6E", "#8FB59B", "#E0B25C", "#C77FA6", "#8FB0CE", "#E0929F"];
  const COLORES_EQUIPO = ["#E4879E", "#B98BC0", "#8FB59B", "#E0A36A", "#E3C06A", "#8FB0CE", "#C98F86", "#A9B98C"];
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
    { id: "clientes", grupo: "El local", corto: "Clientes", nombre: "Ver los clientes",    ayuda: "Los del club: quiénes vuelven, sus mails, lo que piden y sus premios. Y qué premio da el club." },
    { id: "equipo",  grupo: "El local", corto: "Equipo",   nombre: "Manejar el equipo",    ayuda: "Sumar personas, darles un PIN y elegir qué puede hacer cada una." },
    { id: "movimientos", grupo: "El local", corto: "Movimientos", nombre: "Ver los movimientos", ayuda: "El resumen del día, la semana y el mes: lo vendido, las mesas cobradas y las comandas de cocina y barra, con el detalle de cada una." },
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
     El club: las cuentas de los comensales y sus premios
     Cada cliente: su mail, su nombre y su color, las veces que vino, lo que pidió de cada
     cosa y los sellos que lleva. Los premios quedan registrados: cuándo lo ganó y cuándo
     lo pidió. Lo que se pide como premio no suma sellos.
     --------------------------------------------------------------------------- */
  function clienteDe(d, id) { return (d.clientes || []).find(k => k.id === id) || null; }
  function enPedido(d, premio) { return d.carrito.some(l => l.premio === premio); }
  // Suma lo que pidió en esa mesa (cuando se cobra). Devuelve lo que sumó y si ganó premio.
  function acreditarA(d, c, s) {
    const k = clienteDe(d, c.cliente), cfg = d.club;
    if (!k || !s || !s.cerrada || !cfg) return null;
    const items = d.pedidos.filter(p => p.sesion === s.id && !p.rechazado).flatMap(p => p.items)
      .filter(i => i.comensal === c.id && !i.premio);
    const cosas = items.reduce((t, i) => t + i.cant, 0);
    k.visitas += 1;
    k.cosas += cosas;
    k.sellos += cosas;
    k.ultima = s.cerrada;
    k.platos = k.platos || {};
    items.forEach(i => { k.platos[i.plato] = (k.platos[i.plato] || 0) + i.cant; });
    const plato = platoDe(cfg.premio);
    let ganados = 0;
    while (plato && k.sellos >= cfg.meta) {
      k.sellos -= cfg.meta;
      ganados += 1;
      d.premios.push({ id: nuevoId("pr"), cliente: k.id, plato: plato.id, nombre: plato.nombre, ganado: s.cerrada, sesion: s.id, canjeado: null });
    }
    anotar(s, `${c.nombre} sumó ${cosas} al club (lleva ${k.sellos} de ${cfg.meta})`, s.cerrada);
    if (ganados) anotar(s, `¡${c.nombre} ganó ${plato.nombre} de regalo!`, s.cerrada);
    return { cosas, ganados, sellos: k.sellos, meta: cfg.meta, premio: plato ? plato.nombre : "" };
  }
  function acreditar(d, s) {
    if (!d.club || !d.club.activo) return;
    d.comensales.filter(c => c.sesion === s.id && c.cliente && !c.acreditado).forEach(c => { c.acreditado = acreditarA(d, c, s); });
  }
  // Lo que ve el mismo cliente (y el panel con permiso "clientes", que además ve el mail)
  function vistaCliente(d, k, conMail) {
    const pr = d.premios.filter(p => p.cliente === k.id);
    return {
      id: k.id, nombre: k.nombre, color: k.color, alta: k.alta, ultima: k.ultima,
      visitas: k.visitas, cosas: k.cosas, sellos: k.sellos, meta: d.club.meta,
      favoritos: Object.entries(k.platos || {}).filter(([id]) => platoDe(id)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([plato, cant]) => ({ plato, cant })),
      premios: pr.filter(p => !p.canjeado).map(p => ({ id: p.id, plato: p.plato, nombre: p.nombre, ganado: p.ganado, enPedido: enPedido(d, p.id) })),
      canjeados: pr.filter(p => p.canjeado).length,
      ...(conMail ? { email: k.email, novedades: !!k.novedades, historial: pr.map(p => ({ ...p })).sort((a, b) => b.ganado - a.ganado) } : {}),
    };
  }

  const clubInicial = () => {
    const c = L.club || {};
    const premio = platoDe(c.premio) ? c.premio : (L.platos.find(p => p.categoria === "postres") || L.platos[0]).id;
    return { activo: c.activo !== false, meta: Math.max(3, Math.min(50, Math.round(c.meta || 10))), premio };
  };

  // Los del club que ya vinieron otras veces (inventados, para la demo).
  // platos: cuánto pidió de cada cosa; cosas: el total; sellos: lo que lleva para el próximo premio.
  function clientesIniciales(ahora) {
    const dia = n => ahora - n * 864e5;
    const k = (id, nombre, email, color, alta, ultima, visitas, platos, novedades) => {
      const cosas = Object.values(platos).reduce((a, b) => a + b, 0);
      return { id, nombre, email, color, alta: dia(alta), ultima: dia(ultima), visitas, cosas, sellos: cosas % 10, platos, novedades };
    };
    return [
      k("k-vale",  "Vale",  "vale.gomez@ejemplo.com",    "#B98BC0", 62, 9,  4, { "doble-bacon": 5, ipa: 6, aros: 3, flan: 3 }, true),
      k("k-caro",  "Caro",  "carolina.paz@ejemplo.com",  "#E4879E", 120, 6, 7, { clasica: 6, fernet: 7, "papas-cheddar": 5, cheesecake: 4 }, true),
      k("k-lucia", "Lucía", "lucia.ferrari@ejemplo.com", "#8FB59B", 150, 3, 9, { remolacha: 9, limonada: 12, flan: 6, "papas-cheddar": 4 }, true),
      k("k-fede",  "Fede",  "fede.rios@ejemplo.com",     "#8FB0CE", 30, 14, 2, { fugazzeta: 2, fernet: 3 }, false),
      k("k-pau",   "Pau",   "pau.sosa@ejemplo.com",      "#E3C06A", 45, 20, 2, { clasica: 2, ipa: 3 }, false),
      k("k-rocio", "Rocío", "rocio.luna@ejemplo.com",    "#E0A36A", 80, 11, 4, { pepperoni: 4, limonada: 3, helado: 2 }, true),
      k("k-tomas", "Tomás", "tomas.vidal@ejemplo.com",   "#A9B98C", 21, 21, 1, { pepperoni: 1, ipa: 2 }, false),
      k("k-meli",  "Meli",  "meli.acosta@ejemplo.com",   "#C77FA6", 40, 40, 2, { cheesecake: 2, clasica: 2, limonada: 2 }, true),
    ];
  }
  // Los premios que ya ganaron (y los que ya usaron)
  function premiosIniciales(ahora) {
    const dia = n => ahora - n * 864e5;
    const flan = platoDe("flan") ? "flan" : clubInicial().premio;
    const pr = (cliente, ganado, canjeado) => ({
      id: nuevoId("pr"), cliente, plato: flan, nombre: platoDe(flan).nombre, ganado: dia(ganado), sesion: null,
      canjeado: canjeado == null ? null : { t: dia(canjeado), sesion: null, pedido: null },
    });
    return [pr("k-vale", 40, 30), pr("k-caro", 70, 55), pr("k-caro", 6), pr("k-lucia", 110, 98), pr("k-lucia", 50, 41), pr("k-lucia", 3)];
  }

  /* ---------------------------------------------------------------------------
     Lo que ya está pasando en el local cuando se abre la demo
     base: lo que se conserva de antes (el equipo, el club y sus clientes)
     --------------------------------------------------------------------------- */
  function ejemplo(base = {}) {
    const ahora = Date.now();
    const antes = m => ahora - m * 60e3;
    const nuevos = !base.clientes;
    const d = {
      v: VERSION, numero: 39, equipo: base.equipo || equipoInicial(),
      club: base.club || clubInicial(), clientes: base.clientes || clientesIniciales(ahora), premios: base.premios || premiosIniciales(ahora),
      sesiones: [], comensales: [], carrito: [], pedidos: [], llamados: [], agotados: [], sim: { inicio: ahora, paso: 0 },
    };
    // Los del club que están hoy en el local (si siguen en el club)
    const socio = (c, id) => { if (clienteDe(d, id)) c.cliente = id; };
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
    socio(m1.gente[0], "k-pau");
    const m6 = mesa(6, 80, ["Rocío", "Lean", "Maca", "Ivo"]);
    pedido(32, m6, m6.gente[2], 74, [item("pepperoni", 1, m6.gente[0]), item("fugazzeta", 1, m6.gente[2]), item("fernet", 2, m6.gente[1]), item("limonada", 2, m6.gente[3])],
      { cocina: ["entregado", 52, "carla"], barra: ["entregado", 70, "carla"] });
    pedido(33, m6, m6.gente[1], 40, [item("flan", 2, m6.gente[1]), item("helado", 1, m6.gente[3])], { cocina: ["entregado", 31, "carla"] });
    const cobra6 = hace("cobrar", "carla");
    Object.assign(m6.s, { cerrada: antes(12), cerradaPor: cobra6, total: d.pedidos.slice(1, 3).reduce((t, p) => t + p.total, 0) });
    anotar(m6.s, `${nombreEn(d, cobra6)} cobró y liberó la mesa`, m6.s.cerrada);
    socio(m6.gente[0], "k-rocio");
    // Pau y Rocío ya sumaron lo de hoy; a Rocío le tocó el premio al cobrar
    if (nuevos) {
      d.comensales.filter(c => c.cliente).forEach(c => {
        c.acreditado = acreditarA(d, c, d.sesiones.find(s => s.id === c.sesion));
      });
    }

    // Las mesas ocupadas ahora
    const m5 = mesa(5, 46, ["Lucas", "Vale", "Agus", "Belu", "Santi"]);
    const [lucas, vale, agus, belu, santi] = m5.gente;
    socio(vale, "k-vale");
    pedido(34, m5, lucas, 38, [item("doble-bacon", 1, lucas), item("doble-bacon", 1, agus), item("aros", 1, belu), item("ipa", 2, santi), item("ipa", 1, lucas)],
      { cocina: ["entregado", 22, "carla"], barra: ["entregado", 34, "carla"] });

    const m2 = mesa(2, 62, ["Caro", "Martu"]);
    const [caro, martu] = m2.gente;
    socio(caro, "k-caro");
    const p35 = pedido(35, m2, caro, 52, [item("remolacha", 1, martu), item("clasica", 1, caro), item("papas-cheddar", 1, caro), item("limonada", 1, martu), item("fernet", 1, caro)],
      { cocina: ["entregado", 30, "carla"], barra: ["entregado", 46, "carla"] });

    const m11 = mesa(11, 33, ["Ana", "Pedro", "Luz"]);
    pedido(36, m11, m11.gente[0], 24, [item("helado", 1, m11.gente[2]), item("flan", 1, m11.gente[1]), item("cheesecake", 1, m11.gente[0])],
      { cocina: ["entregado", 10, "nico"] });

    const m9 = mesa(9, 24, ["Fede", "Sol"]);
    socio(m9.gente[0], "k-fede");
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
    // Movimientos de días anteriores (solo la demo, para que Semana y Mes muestren algo)
    d.historial = L.demo ? sembrarHistorial(ahora) : [];
    return d;
  }

  // Treinta días de ventas y comandas de mentira, con más movimiento los findes (solo demo)
  function sembrarHistorial(ahora) {
    const base = new Date(ahora); base.setHours(12, 0, 0, 0);
    const az = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    const cocinaIds = L.platos.filter(p => estacionDe(p.id) === "cocina").map(p => p.id);
    const barraIds = L.platos.filter(p => estacionDe(p.id) === "barra").map(p => p.id);
    const reparto = (ids, total) => {
      const m = {};
      if (!ids.length) return m;
      let resto = total;
      [...ids].sort(() => Math.random() - 0.5).forEach((id, i, arr) => {
        const q = i === arr.length - 1 ? resto : az(0, Math.ceil(resto / 2));
        if (q > 0) m[id] = (m[id] || 0) + q;
        resto = Math.max(0, resto - q);
      });
      return m;
    };
    const dias = [];
    for (let i = 1; i <= 30; i++) {
      const f = new Date(base); f.setDate(f.getDate() - i);
      const finde = [0, 5, 6].includes(f.getDay());
      const cobros = az(finde ? 12 : 6, finde ? 20 : 12);
      const vendido = cobros * az(9000, 14000);
      const cocina = cobros * az(2, 4), barra = cobros * az(1, 3);
      // El flujo de la mesa: cuánta gente, cuánto se quedó, los tiempos (min) y la ocupación (%)
      const personas = Math.round(cobros * (az(25, 40) / 10));
      dias.push({ t: f.getTime(), vendido, cobros, personas, cocina, barra,
        estadia: az(45, 85), pedir: az(4, 9), llega: az(8, 16), ocupacion: az(finde ? 70 : 42, finde ? 95 : 78),
        platos: { cocina: reparto(cocinaIds, cocina), barra: reparto(barraIds, barra) } });
    }
    return dias;
  }

  /* ---------------------------------------------------------------------------
     Guardar y leer (vista previa: en este navegador)
     --------------------------------------------------------------------------- */
  // De la demo anterior se conserva el equipo (con el permiso nuevo para quien maneja el equipo)
  function heredado() {
    try {
      const v = JSON.parse(localStorage.getItem(VIEJA));
      localStorage.removeItem(VIEJA);
      if (v && Array.isArray(v.equipo) && v.equipo.length) {
        return { equipo: v.equipo.map(e => {
          let permisos = e.permisos || [];
          if (permisos.includes("equipo") && !permisos.includes("clientes")) permisos = [...permisos, "clientes"];
          if (e.rol === "dueno" && !permisos.includes("movimientos")) permisos = [...permisos, "movimientos"];   // permiso nuevo: lo tiene el dueño
          const base = (L.equipo || []).find(x => x.id === e.id);   // colores nuevos de la marca para los de siempre
          return { ...e, permisos, color: (base && base.color) || e.color };
        }) };
      }
    } catch { /* sin almacenamiento */ }
    return {};
  }
  function leer() {
    if (cache) return cache;
    let d = null;
    try { d = JSON.parse(localStorage.getItem(CLAVE)); } catch { d = null; }
    if (!d || d.v !== VERSION) {
      d = memoria && memoria.v === VERSION ? memoria : ejemplo(heredado());
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
    (d.clientes || []).forEach(k => { t(k, "alta"); t(k, "ultima"); });
    (d.premios || []).forEach(p => { t(p, "ganado"); t(p.canjeado, "t"); });
  }
  function revisarReloj() {
    if (document.visibilityState === "hidden") return;
    const ahora = Date.now();
    let vivo = 0;
    try { vivo = +localStorage.getItem(VIVO) || 0; localStorage.setItem(VIVO, String(ahora)); } catch { return; }
    if (!vivo || ahora - vivo <= PAUSA) return;
    cache = null;
    let d = leer();
    if (ahora - vivo > OTRO_DIA) d = ejemplo({ equipo: d.equipo, club: d.club, clientes: d.clientes, premios: d.premios });
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
      if (resto.cliente && (!clienteDe(d, resto.cliente) || gente.some(x => x.cliente === resto.cliente))) delete resto.cliente;
      const c = {
        id: nuevoId("c"), sesion: s.id, nombre, unido: ahora, ...resto,
        color: COLORES.includes(pedido) && !usados.has(pedido) ? pedido
          : COLORES.find(x => !usados.has(x)) || COLORES[gente.length % COLORES.length],
      };
      d.comensales.push(c);
      anotar(s, gente.length ? `${nombre} se sumó a la mesa` : `${nombre} escaneó el QR y abrió la mesa`, ahora);
      if (c.cliente) anotar(s, `${nombre} es del club: ${clienteDe(d, c.cliente).visitas + 1}ª visita`, ahora);
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
      if (!l || !deComensal(d, comensal) || (l.premio && delta > 0)) return SIN;     // un premio es uno
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
        eleccion: l.eleccion, comensal: l.comensal, estacion: estacionDe(l.plato), ...(l.premio ? { premio: l.premio } : {}),
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
      // Los premios que iban en la ronda quedan usados
      items.filter(i => i.premio).forEach(i => {
        const pr = d.premios.find(y => y.id === i.premio);
        if (!pr) return;
        pr.canjeado = { t: ahora, sesion: x.s.id, pedido: p.id };
        const c = d.comensales.find(y => y.id === i.comensal);
        anotar(x.s, `${c ? c.nombre : "Alguien"} pidió su premio del club: ${pr.nombre}`, ahora);
      });
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
      // Si iba un premio, vuelve a estar disponible
      p.items.filter(i => i.premio).forEach(i => { const pr = d.premios.find(y => y.id === i.premio); if (pr) pr.canjeado = null; });
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
      acreditar(d, s);                                         // los del club suman lo que pidieron
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

  /* ---------------------------------------------------------------------------
     El club desde el celular del comensal
     Entrar es con el mail y un código de 6 números (sin contraseña). En la versión real el
     código llega por mail (Supabase Auth); en la demo no se manda nada: se muestra en pantalla.
     Una vez que entró, este celu queda con su cuenta y la próxima vez lo reconoce.
     --------------------------------------------------------------------------- */
  const CLUB_YO = "cartaviva.club.mail";
  const alma = () => (otraPersona ? sessionStorage : localStorage);     // ?nuevo es otro celu
  const limpiarMail = m => String(m || "").trim().toLowerCase().slice(0, 120);
  const mailValido = m => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m);
  const limpiarNombre = n => String(n || "").replace(/\s+/g, " ").trim().slice(0, 20);
  const codigos = new Map();          // mail → { codigo, t, intentos }
  function miMail() { try { return alma().getItem(CLUB_YO) || null; } catch { return null; } }
  function club() {
    const c = leer().club;
    const p = platoDe(c.premio);
    return { ...c, nombrePremio: p ? p.nombre : "" };
  }
  // Quién soy en el club (en este celu), o null
  function miCliente() {
    const d = leer(), mail = miMail();
    const k = mail && d.club.activo && d.clientes.find(x => x.email === mail);
    return k ? vistaCliente(d, k, true) : null;
  }
  async function pedirCodigo(email) {
    email = limpiarMail(email);
    if (!mailValido(email)) return { ok: false, motivo: "mail" };
    const previo = codigos.get(email);
    if (previo && Date.now() - previo.t < 20e3) return { ok: false, motivo: "espera" };
    const codigo = String(100000 + Math.floor(Math.random() * 900000));
    codigos.set(email, { codigo, t: Date.now(), intentos: 0 });
    return { ok: true, email, demo: codigo };                  // en la versión real el código no vuelve: va al mail
  }
  async function verificarCodigo(email, codigo) {
    email = limpiarMail(email);
    const c = codigos.get(email);
    if (!c || Date.now() - c.t > 10 * 60e3) return { ok: false, motivo: "vencido" };
    if (c.intentos >= 5) return { ok: false, motivo: "intentos" };
    if (String(codigo || "").replace(/\D/g, "") !== c.codigo) { c.intentos += 1; return { ok: false, motivo: "codigo" }; }
    codigos.delete(email);
    try { alma().setItem(CLUB_YO, email); } catch { /* queda solo mientras esté abierta */ }
    return { ok: true, email, cliente: miCliente() };           // cliente null: todavía no es del club
  }
  function salirClub() { try { alma().removeItem(CLUB_YO); } catch { /* nada */ } avisar(); }

  // Sumarse (o volver) al club desde la mesa: esta persona de la mesa es la de este mail.
  // Si es nuevo, se crea con su nombre y su color de la mesa. Si la mesa ya se cobró (hace
  // menos de 3 horas), lo que pidió también suma.  datos: { nombre, color, novedades }
  function vincular(comensal, datos = {}) {
    const email = miMail();
    let res = { ok: false, motivo: "sin_cuenta" };
    if (!email) return res;
    cambiar(d => {
      const no = motivo => { res = { ok: false, motivo }; return SIN; };
      if (!d.club.activo) return no("club_apagado");
      const c = d.comensales.find(x => x.id === comensal);
      const s = c && d.sesiones.find(x => x.id === c.sesion);
      if (!c || !s) return no("no_existe");
      if (s.cerrada && Date.now() - s.cerrada > 3 * 3600e3) return no("mesa_cerrada");
      let k = d.clientes.find(x => x.email === email);
      if (c.cliente && (!k || c.cliente !== k.id)) return no("otra_cuenta");
      if (k && d.comensales.some(x => x.sesion === s.id && x.cliente === k.id && x.id !== c.id)) return no("ya_en_la_mesa");
      const nuevo = !k;
      if (!k) {
        k = { id: nuevoId("k"), email, nombre: limpiarNombre(datos.nombre) || c.nombre, color: COLORES.includes(datos.color) ? datos.color : c.color,
              alta: Date.now(), ultima: null, visitas: 0, cosas: 0, sellos: 0, platos: {}, novedades: !!datos.novedades };
        d.clientes.push(k);
      } else if (datos.novedades) k.novedades = true;
      if (c.cliente !== k.id) {
        c.cliente = k.id;
        anotar(s, nuevo ? `${c.nombre} se sumó al club` : `${c.nombre} es del club: ${k.visitas + 1}ª visita`, Date.now());
      }
      if (s.cerrada && !c.acreditado) c.acreditado = acreditarA(d, c, s);
      res = { ok: true, nuevo, cliente: vistaCliente(d, k, true), acreditado: c.acreditado || null };
      return c;
    });
    return res;
  }

  // Pedir un premio: va al pedido de la mesa, gratis. Sale con la próxima ronda.
  function canjear(comensal, premioId) {
    return cambiar(d => {
      const x = deComensal(d, comensal);
      const pr = x && x.c.cliente && d.premios.find(p => p.id === premioId && p.cliente === x.c.cliente && !p.canjeado);
      if (!pr || enPedido(d, pr.id)) return SIN;
      if (d.agotados.some(a => a.id === pr.plato)) { error(`${pr.nombre} se terminó por hoy. Tu premio te espera para la próxima.`); return SIN; }
      const linea = {
        id: nuevoId("l"), sesion: x.s.id, comensal, plato: pr.plato, eleccion: null, detalle: "", precio: 0,
        clave: "premio-" + pr.id, cant: 1, premio: pr.id, creado: Date.now(),
      };
      d.carrito.push(linea);
      return linea;
    });
  }
  function novedades(si) {
    const email = miMail();
    return cambiar(d => { const k = email && d.clientes.find(x => x.email === email); if (!k || k.novedades === !!si) return SIN; k.novedades = !!si; return true; });
  }
  // Borrar mi cuenta del club: el mail, lo que pedí y los premios. Lo de la mesa queda.
  function borrarme() {
    const email = miMail();
    const r = cambiar(d => {
      const k = email && d.clientes.find(x => x.email === email);
      if (!k) return SIN;
      borrarDatos(d, k.id);
      return true;
    });
    salirClub();
    return { ok: !!r };
  }
  function borrarDatos(d, id) {
    d.clientes = d.clientes.filter(x => x.id !== id);
    d.premios = d.premios.filter(p => p.cliente !== id);
    d.comensales.forEach(c => { if (c.cliente === id) { delete c.cliente; delete c.acreditado; } });
    d.carrito = d.carrito.filter(l => !l.premio || d.premios.some(p => p.id === l.premio));
  }

  /* ---------- El club desde el panel ---------- */
  // Lo que ve el mozo de alguien del club sentado en una mesa (sin el mail)
  function clubDe(comensal) {
    const d = leer();
    const c = d.comensales.find(x => x.id === comensal);
    const k = c && c.cliente && d.club.activo && clienteDe(d, c.cliente);
    if (!k) return null;
    const v = vistaCliente(d, k, false);
    const fav = v.favoritos[0] && platoDe(v.favoritos[0].plato);
    return { nombre: k.nombre, visita: k.visitas + (c.acreditado ? 0 : 1), sellos: k.sellos, meta: d.club.meta, favorito: fav ? fav.nombre : "", premios: v.premios };
  }
  // Todos los del club (permiso "clientes"): con su mail y sus premios
  function clientes(quien) {
    const d = leer();
    if (!tiene(quienEs(d, quien), "clientes")) return null;
    return d.clientes.map(k => vistaCliente(d, k, true)).sort((a, b) => (b.ultima || b.alta) - (a.ultima || a.alta));
  }
  function guardarClub(quien, x) {
    let res = { ok: false, motivo: "error" };
    cambiar(d => {
      if (!tiene(quienEs(d, quien), "clientes")) { res = { ok: false, motivo: "sin_permiso" }; return SIN; }
      const meta = Math.round(+x.meta);
      if (!(meta >= 3 && meta <= 50)) { res = { ok: false, motivo: "meta" }; return SIN; }
      if (!platoDe(x.premio)) { res = { ok: false, motivo: "premio" }; return SIN; }
      d.club = { activo: x.activo !== false, meta, premio: x.premio };
      res = { ok: true };
      return true;
    });
    return res;
  }
  function borrarCliente(quien, id) {
    let res = { ok: false, motivo: "no_existe" };
    cambiar(d => {
      if (!tiene(quienEs(d, quien), "clientes")) { res = { ok: false, motivo: "sin_permiso" }; return SIN; }
      if (!clienteDe(d, id)) return SIN;
      borrarDatos(d, id);
      res = { ok: true };
      return true;
    });
    return res;
  }

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

    // El club (el comensal)
    club, miCliente, miMail, pedirCodigo, verificarCodigo, salirClub, vincular, canjear, novedades, borrarme,

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
    clubDe, clientes, guardarClub, borrarCliente,
    reiniciar: () => { memoria = null; cache = null; guardar(ejemplo()); },

    // Solo para la simulación de la demo
    _cambiar: cambiar, _SIN: SIN, _anotar: anotar, _reloj: revisarReloj,
  };
})();
