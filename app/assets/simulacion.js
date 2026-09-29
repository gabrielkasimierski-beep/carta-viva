/* =============================================================================
   CARTA VIVA — la demo en movimiento (solo en la demo)
   Hace de "el resto del local" para ver cómo lo usan varias personas a la vez:
   · Juli y Tomi comparten tu mesa y van sumando cosas al mismo pedido.
   · La cocina (Diego) y la barra (Martín) empiezan y terminan lo que se pide.
   · Los mozos (Carla en el salón, Nico en la vereda) llevan lo que está listo, van
     cuando los llaman y, en tu mesa, te traen la cuenta y te cobran.
   · Las otras mesas siguen su curso: piden otra ronda, llaman al mozo, se sienta gente.
   Cada cosa la hace alguien del equipo que tiene ese permiso (si lo cambiás en Equipo,
   la simulación también). Lo que alguien mueve a mano desde el panel, la simulación no
   lo toca. Corre en una sola pestaña, la que se está mirando: si nadie mira, el local
   queda en pausa (ver "El reloj de la demo" en datos.js).
   ============================================================================= */

(function () {
  "use strict";

  const L = window.LOCAL, D = window.Datos;
  if (!L.demo || !D || D.modo !== "vista-previa") return;

  // Cuánto tarda cada paso (empezar, terminar, llevar). En las mesas con gente de verdad
  // (la tuya), rápido para que se vea; en las otras, a ritmo de local.
  const ESPERA = {
    tuya:  { cocina: [6e3, 14e3, 8e3],      barra: [3e3, 6e3, 7e3] },
    otras: { cocina: [90e3, 420e3, 180e3],  barra: [50e3, 150e3, 120e3] },
  };
  // Alguien del equipo con ese permiso (el de ese puesto primero; el de la zona de la mesa, si hay)
  function alguien(d, permiso, mesa) {
    const e = (d.equipo || []).filter(x => x.activo !== false && (x.permisos || []).includes(permiso));
    const zona = mesa ? (L.mesas.find(m => m.n === mesa) || {}).zona : null;
    const delPuesto = e.filter(x => x.rol === permiso || (["atender", "llevar", "cobrar"].includes(permiso) && x.rol === "mozo"));
    return (delPuesto.find(x => zona && x.zona === zona) || delPuesto[0] || e.find(x => zona && x.zona === zona) || e[0] || {}).id || null;
  }
  const sumarSim = (comensal, id, cant = 1) => {
    const p = L.platos.find(x => x.id === id);
    if (p && !D.agotado(id)) D.sumar(comensal, { plato: id, eleccion: null, detalle: "", precio: p.precio, clave: id, cant });
  };
  const marcar = (fn) => D._cambiar(d => (fn(d) === false ? D._SIN : true));

  /* ---------- Juli y Tomi, en tu mesa ---------- */
  const GUION = [
    { en: 8e3, quien: 0, plato: "limonada" },
    { en: 21e3, quien: 1, plato: "papas-cheddar" },
    { despuesDeComer: 20e3, quien: 1, plato: "ipa" },
  ];
  function amigos(d, s, ahora) {
    const gente = d.comensales.filter(c => c.sesion === s.id);
    const reales = gente.filter(c => !c.sim);
    if (!s.guion) {                      // mesa nueva: Juli y Tomi se sientan con vos
      marcar(x => { const y = x.sesiones.find(z => z.id === s.id); if (!y || y.guion) return false; y.guion = { paso: 0 }; });
      D.entrar(s.mesa, "Juli", { sim: true });
      D.entrar(s.mesa, "Tomi", { sim: true });
      return true;
    }
    if (!s.guion.desde) {
      const desde = Math.max(ahora - 2e3, Math.min(...reales.map(c => c.unido)));
      marcar(x => { const y = x.sesiones.find(z => z.id === s.id); if (!y) return false; y.guion.desde = desde; });
      return true;
    }
    const paso = GUION[s.guion.paso];
    if (!paso) return false;
    let ya = false;
    if (paso.en != null) ya = ahora - s.guion.desde >= paso.en;
    else {
      const comieron = d.pedidos.filter(p => p.sesion === s.id && D.estadoPedido(p) === "entregado");
      const cuando = Math.max(0, ...comieron.flatMap(p => Object.values(p.partes).map(x => x.cambio)));
      ya = comieron.length > 0 && ahora - cuando >= paso.despuesDeComer;
    }
    if (!ya) return false;
    const quien = gente.filter(c => c.sim)[paso.quien];
    if (quien) sumarSim(quien.id, paso.plato);
    marcar(x => { const y = x.sesiones.find(z => z.id === s.id); if (!y) return false; y.guion.paso += 1; });
    return true;
  }

  /* ---------- Cocina, barra y mozos ---------- */
  function servicio(d, ahora, tuyas) {
    for (const p of d.pedidos) {
      if (p.rechazado) continue;
      const s = d.sesiones.find(x => x.id === p.sesion);
      if (!s || s.cerrada) continue;
      const t = tuyas.has(s.id) ? ESPERA.tuya : ESPERA.otras;
      for (const [est, pa] of Object.entries(p.partes)) {
        if (pa.aMano || pa.estado === "entregado") continue;
        const k = D.ESTADOS.indexOf(pa.estado);
        if (ahora - pa.cambio < (t[est] || t.cocina)[k]) continue;
        const sig = D.ESTADOS[k + 1];
        D.mover(p.id, est, sig, sig === "entregado" ? alguien(d, "llevar", p.mesa) : alguien(d, est), false);
        return true;                     // de a una cosa por vez, como en un local
      }
    }
    return false;
  }

  // En las mesas con gente de verdad: el mozo va, trae la cuenta y cobra.
  // Los llamados de las otras mesas quedan para que los atiendas vos desde el panel.
  function llamados(d, ahora, tuyas) {
    for (const l of d.llamados) {
      if (l.atendido || !tuyas.has(l.sesion)) continue;
      if (l.tipo === "mozo" && ahora - l.creado > 5e3) { D.atender(l.id, alguien(d, "atender", l.mesa), false); return true; }
      if (l.tipo === "cuenta" && !l.toma && ahora - l.creado > 6e3) {
        D.atender(l.id, alguien(d, "cobrar", l.mesa), false);
        marcar(x => { const y = x.llamados.find(z => z.id === l.id); if (!y) return false; y.porSim = true; });
        return true;
      }
      if (l.tipo === "cuenta" && l.porSim && l.toma && ahora - l.tomado > 90e3) { D.cerrarMesa(l.mesa, l.toma, false); return true; }
    }
    return false;
  }

  /* ---------- El resto del local ---------- */
  const AMBIENTE = [
    { en: 55e3,  hace: "mandar", mesa: 4 },
    { en: 125e3, hace: "llamar", mesa: 11, quien: "Luz" },
    { en: 195e3, hace: "ronda",  mesa: 5, quien: "Santi", items: [["ipa", 3], ["papas-cheddar", 1]] },
    { en: 265e3, hace: "abrir",  mesa: 10, gente: ["Lara", "Juan"], items: [["fugazzeta", 1, 0], ["limonada", 2, 1]] },
    { en: 335e3, hace: "mandar", mesa: 10 },
    { en: 405e3, hace: "ronda",  mesa: 3, quien: "Mica", items: [["flan", 2], ["cheesecake", 1]] },
    { en: 480e3, hace: "llamar", mesa: 12, quien: "Nahue" },
  ];
  function ambiente(d, ahora, tuyas) {
    const sim = d.sim || { inicio: ahora, paso: 0 };
    const paso = AMBIENTE[sim.paso];
    if (!paso || ahora - sim.inicio < paso.en) return false;
    const s = d.sesiones.find(x => x.mesa === paso.mesa && !x.cerrada);
    const gente = s ? d.comensales.filter(c => c.sesion === s.id) : [];
    const persona = n => gente.find(c => c.nombre === n) || gente[0];
    const libre = paso.mesa !== L.mesaDemo && !(s && tuyas.has(s.id));
    if (libre && s && paso.hace === "mandar") {
      const l = d.carrito.find(x => x.sesion === s.id);
      if (l) D.mandar(l.comensal, "");
    }
    if (libre && s && paso.hace === "llamar" && persona(paso.quien)) D.llamar(persona(paso.quien).id, "mozo");
    if (libre && s && paso.hace === "ronda" && persona(paso.quien)) {
      const c = persona(paso.quien);
      paso.items.forEach(([id, n]) => sumarSim(c.id, id, n));
      D.mandar(c.id, "");
    }
    if (libre && !s && paso.hace === "abrir") {
      const cs = paso.gente.map(n => D.entrar(paso.mesa, n, { sim: true }));
      paso.items.forEach(([id, n, q]) => cs[q] && sumarSim(cs[q].comensal.id, id, n));
    }
    marcar(x => { x.sim = { inicio: sim.inicio, paso: sim.paso + 1 }; });
    return true;
  }

  /* ---------- Un paso por segundo, en una sola pestaña ---------- */
  function paso() {
    D._reloj();                          // si la compu estuvo dormida, primero la pausa
    const d = D.todo();
    const ahora = Date.now();
    const tuyas = new Set(d.comensales.filter(c => !c.sim).map(c => c.sesion));
    for (const s of d.sesiones) {
      if (!s.cerrada && s.mesa === L.mesaDemo && tuyas.has(s.id) && amigos(d, s, ahora)) return;
    }
    if (llamados(d, ahora, tuyas)) return;
    if (servicio(d, ahora, tuyas)) return;
    ambiente(d, ahora, tuyas);
  }

  const PESTANA = Math.random().toString(36).slice(2);
  const LIDER = "cartaviva.demo.lider";
  function meToca() {
    if (document.visibilityState === "hidden") return false;     // si nadie la mira, el local espera
    const ahora = Date.now();
    let l = null;
    try { l = JSON.parse(localStorage.getItem(LIDER)); } catch { return true; }
    if (l && l.tab !== PESTANA && ahora - l.t < 2500) return false;
    try { localStorage.setItem(LIDER, JSON.stringify({ tab: PESTANA, t: ahora })); } catch { /* una sola pestaña */ }
    return true;
  }
  setInterval(() => {
    if (!meToca()) return;
    try { paso(); } catch (e) { console.warn("Simulación de la demo:", e); }
  }, 1000);
})();
