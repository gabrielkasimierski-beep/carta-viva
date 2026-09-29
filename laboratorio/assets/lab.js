/* =============================================================================
   CARTA VIVA — laboratorio de diseño
   Acá se prueban ideas con fotos reales sin tocar la app (app/ no se modifica: de ahí
   solo se leen los platos de local.js). Cada experimento es una función que arma su
   pantalla y devuelve cómo desarmarla: para sumar uno nuevo, agregarlo a EXPERIMENTOS.
   Fotos: Unsplash, licencia libre (ver CREDITOS.md). "Tu foto" cambia la del plato que
   se está viendo, solo en ese navegador y hasta que se recargue.
   ============================================================================= */
(function () {
  "use strict";
  const L = window.LOCAL;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plata = n => "$" + Math.round(n).toLocaleString("es-AR");
  const MOVIMIENTO = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const platos = L.categorias.flatMap(c => L.platos.filter(p => p.categoria === c.id));
  const cat = p => L.categorias.find(c => c.id === p.categoria);

  // Las rutas van escritas enteras: así el armado de un solo archivo las mete adentro
  const FOTOS = {
    "clasica": "assets/fotos/clasica.jpg", "doble-bacon": "assets/fotos/doble-bacon.jpg", "remolacha": "assets/fotos/remolacha.jpg",
    "pepperoni": "assets/fotos/pepperoni.jpg", "fugazzeta": "assets/fotos/fugazzeta.jpg",
    "papas-cheddar": "assets/fotos/papas-cheddar.jpg", "aros": "assets/fotos/aros.jpg",
    "flan": "assets/fotos/flan.jpg", "helado": "assets/fotos/helado.jpg", "cheesecake": "assets/fotos/cheesecake.jpg",
    "limonada": "assets/fotos/limonada.jpg", "ipa": "assets/fotos/ipa.jpg", "fernet": "assets/fotos/fernet.jpg",
  };
  const propias = {};                                   // fotos cargadas desde este celu
  const foto = p => propias[p.id] || FOTOS[p.id];

  /* ---------- El color de cada plato, sacado de su foto ---------- */
  const colores = {};
  const colorDe = p => colores[foto(p)] || p.color;
  function medirColor(src) {
    return new Promise(listo => {
      const img = new Image();
      img.onload = () => {
        try {
          const n = 28, c = document.createElement("canvas");
          c.width = c.height = n;
          const g = c.getContext("2d", { willReadFrequently: true });
          g.drawImage(img, 0, 0, n, n);
          const d = g.getImageData(0, 0, n, n).data;
          let r = 0, v = 0, a = 0, peso = 0;
          for (let i = 0; i < d.length; i += 4) {
            const R = d[i], G = d[i + 1], B = d[i + 2];
            const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
            const w = ((max - min) / 255) ** 2 * (1 - Math.abs(l - 128) / 128) + 0.002;   // lo vivo y ni muy claro ni muy oscuro
            r += R * w; v += G * w; a += B * w; peso += w;
          }
          const hex = "#" + [r, v, a].map(x => Math.round(x / peso).toString(16).padStart(2, "0")).join("");
          listo(hex);
        } catch { listo(null); }
      };
      img.onerror = () => listo(null);
      img.src = src;
    });
  }
  async function medirTodo() {
    await Promise.all(platos.map(async p => { const s = foto(p); if (!colores[s]) { const c = await medirColor(s); if (c) colores[s] = c; } }));
  }
  const ponerColor = p => document.documentElement.style.setProperty("--c", colorDe(p));

  /* ---------- Lo que tienen todos ---------- */
  let actual = 0;
  const nota = (() => {
    let t;
    return texto => {
      const n = $("#lab-nota");
      n.textContent = texto;
      n.classList.add("visible");
      clearTimeout(t);
      t = setTimeout(() => n.classList.remove("visible"), 3200);
    };
  })();
  const botonAgregar = p => `<button type="button" class="boton-agregar" data-agregar="${p.id}"><span aria-hidden="true">+</span> Agregar</button>`;

  // Un feed vertical que se desliza de a un plato: avisa cuál quedó a la vista
  function alCambiarDePlato(feed, hacer) {
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const i = Math.round(feed.scrollTop / (feed.clientHeight || 1));
      if (i !== actual && platos[i]) { actual = i; hacer(i); }
    };
    feed.addEventListener("scroll", () => { if (!cuadro) cuadro = requestAnimationFrame(medir); }, { passive: true });
  }
  const irAlActual = feed => { feed.scrollTop = actual * feed.clientHeight; };

  /* =============================================================================
     A. VIVO — la foto entera respira (acercamiento lento), se corre al deslizar
     (paralaje) y se inclina con el dedo o moviendo el celu.
     ============================================================================= */
  function vivo(cont) {
    cont.innerHTML = `<div class="vivo">${platos.map((p, i) => `
      <section class="vivo__plato" data-i="${i}" style="--c:${colorDe(p)}" aria-label="${esc(p.nombre)}">
        <div class="vivo__foto"><img src="${foto(p)}" alt="" ${i > 1 ? 'loading="lazy"' : ""}></div>
        <div class="vivo__info">
          <p class="rotulo">${esc(cat(p).nombre)}</p>
          <h2 class="nombre">${esc(p.nombre)}</h2>
          <p class="desc">${esc(p.descripcion)}</p>
          <div class="vivo__fila">${botonAgregar(p)}<span class="precio">${plata(p.precio)}</span></div>
        </div>
      </section>`).join("")}</div>`;
    const feed = cont.firstElementChild, secs = [...feed.children];
    irAlActual(feed);
    let tx = 0, ty = 0, ox = 0, oy = 0, vivoRaf = 0;
    const entrar = i => { secs.forEach((s, j) => s.classList.toggle("entra", j === i)); ponerColor(platos[i]); };
    entrar(actual);
    alCambiarDePlato(feed, entrar);
    const cuadro = () => {
      vivoRaf = requestAnimationFrame(cuadro);
      tx += (ox - tx) * 0.08; ty += (oy - ty) * 0.08;
      const h = feed.clientHeight || 1;
      secs.forEach((s, j) => {
        const off = (j * h - feed.scrollTop) / h;                 // -1 … 0 … 1
        if (Math.abs(off) > 1.2) return;
        const f = s.firstElementChild;
        const incl = j === actual ? `rotateY(${tx * 6}deg) rotateX(${-ty * 5}deg) translate(${-tx * 2}%, ${-ty * 2}%)` : "";
        f.style.transform = `translateY(${off * 28}%) ${incl}`;
      });
    };
    if (MOVIMIENTO) cuadro();
    const mover = e => { const r = feed.getBoundingClientRect(); ox = (e.clientX - r.left) / r.width * 2 - 1; oy = (e.clientY - r.top) / r.height * 2 - 1; };
    const quieto = () => { ox = 0; oy = 0; };
    const inclinar = e => { if (e.gamma == null) return; ox = Math.max(-1, Math.min(1, e.gamma / 25)); oy = Math.max(-1, Math.min(1, (e.beta - 45) / 25)); };
    feed.addEventListener("pointermove", mover);
    feed.addEventListener("pointerleave", quieto);
    addEventListener("deviceorientation", inclinar);
    return () => { cancelAnimationFrame(vivoRaf); removeEventListener("deviceorientation", inclinar); };
  }

  /* =============================================================================
     B. PLATO — la foto recortada en redondo gira sobre el color que sale de la foto.
     Se gira con el dedo (con envión) y con un toque salta. Atrás, la palabra de la sección.
     ============================================================================= */
  function plato(cont) {
    cont.innerHTML = `<div class="plato-g__fondo"></div><p class="plato-g__palabra" aria-hidden="true"></p>
      <div class="plato-g">${platos.map((p, i) => `
        <section class="plato-g__item" data-i="${i}" aria-label="${esc(p.nombre)}">
          <div class="plato-g__lugar"><div class="plato-g__disco"><img src="${foto(p)}" alt="" ${i > 1 ? 'loading="lazy"' : ""}></div></div>
          <div class="plato-g__info">
            <p class="rotulo" style="color:rgba(255,255,255,.8)">${esc(cat(p).nombre)} · girala con el dedo</p>
            <h2 class="nombre">${esc(p.nombre)}</h2>
            <p class="desc">${esc(p.descripcion)}</p>
            <div class="plato-g__fila">${botonAgregar(p)}<span class="precio">${plata(p.precio)}</span></div>
          </div>
        </section>`).join("")}</div>`;
    const feed = $(".plato-g", cont), palabra = $(".plato-g__palabra", cont);
    const discos = [...cont.querySelectorAll(".plato-g__disco")];
    const giro = discos.map(() => ({ a: Math.random() * 360, v: 10 }));
    irAlActual(feed);
    const entrar = i => { ponerColor(platos[i]); palabra.textContent = cat(platos[i]).palabra || ""; };
    entrar(actual);
    alCambiarDePlato(feed, entrar);
    let raf = 0, t0 = performance.now(), arrastre = null;
    const cuadro = t => {
      raf = requestAnimationFrame(cuadro);
      const dt = Math.min(0.05, (t - t0) / 1000); t0 = t;
      [actual - 1, actual, actual + 1].forEach(i => {
        const g = giro[i]; if (!g) return;
        if (!(arrastre && arrastre.i === i)) { g.v += ((MOVIMIENTO ? 10 : 0) - g.v) * (1 - Math.exp(-dt * 1.4)); g.a += g.v * dt; }
        discos[i].style.transform = `rotate(${g.a}deg)`;
      });
    };
    raf = requestAnimationFrame(cuadro);
    feed.addEventListener("pointerdown", e => {
      const lugar = e.target.closest(".plato-g__lugar"); if (!lugar) return;
      const i = +lugar.parentElement.dataset.i;
      arrastre = { i, x: e.clientX, t: performance.now(), recorrido: 0 };
    });
    feed.addEventListener("pointermove", e => {
      if (!arrastre) return;
      const dx = e.clientX - arrastre.x, ahora = performance.now(), dt = Math.max(8, ahora - arrastre.t) / 1000;
      arrastre.recorrido += Math.abs(dx); arrastre.x = e.clientX; arrastre.t = ahora;
      const g = giro[arrastre.i]; g.a += dx * 0.5; g.v = Math.max(-900, Math.min(900, dx * 0.5 / dt));
    });
    const soltar = () => {
      if (!arrastre) return;
      if (arrastre.recorrido < 6) { const d = discos[arrastre.i]; d.classList.remove("salta"); void d.offsetWidth; d.classList.add("salta"); giro[arrastre.i].v += 240; }
      arrastre = null;
    };
    feed.addEventListener("pointerup", soltar);
    feed.addEventListener("pointercancel", soltar);
    return () => cancelAnimationFrame(raf);
  }

  /* =============================================================================
     C. TARJETAS — como una pila de cartas: a la derecha "¡lo quiero!", a la izquierda
     "después". Un toque da vuelta la tarjeta y muestra qué tiene.
     ============================================================================= */
  function tarjetas(cont) {
    let quiero = 0;
    cont.innerHTML = `<div class="tarjetas">
        <div class="tarjetas__pila" aria-live="polite"></div>
        <div class="tarjetas__botones">
          <button type="button" class="redondo" data-t="no" aria-label="Después">✕</button>
          <button type="button" class="redondo" data-t="vuelta" aria-label="Dar vuelta">↻</button>
          <button type="button" class="redondo redondo--si" data-t="si">¡Lo quiero!</button>
        </div>
        <p class="tarjetas__cuenta"></p>
      </div>`;
    const pila = $(".tarjetas__pila", cont), cuenta = $(".tarjetas__cuenta", cont);
    const tarjetaHtml = (p, k) => `<article class="tarjeta" data-id="${p.id}" style="--tc:${colorDe(p)};z-index:${10 - k};transform:translateY(${k * 14}px) scale(${1 - k * 0.05});opacity:${k > 2 ? 0 : 1}">
        <div class="tarjeta__giro">
          <div class="tarjeta__cara"><img src="${foto(p)}" alt="">
            <div class="tarjeta__texto"><small class="rotulo">${esc(cat(p).nombre)}</small><h2 class="nombre">${esc(p.nombre)}</h2><span class="precio">${plata(p.precio)}</span></div>
          </div>
          <div class="tarjeta__dorso">
            <div><p class="rotulo">Qué tiene</p><h2 class="nombre">${esc(p.nombre)}</h2><p class="desc">${esc(p.descripcion)}</p></div>
            <span class="precio" style="font-size:22px">${plata(p.precio)}</span>
          </div>
        </div>
        <span class="tarjeta__sello tarjeta__sello--si">¡Lo quiero!</span><span class="tarjeta__sello tarjeta__sello--no">Después</span>
      </article>`;
    const pintar = () => {
      pila.innerHTML = [0, 1, 2, 3].map(k => platos[(actual + k) % platos.length]).map(tarjetaHtml).join("");
      ponerColor(platos[actual]);
      cuenta.textContent = `${actual + 1} de ${platos.length}${quiero ? ` · ${quiero} que querés` : ""}`;
    };
    pintar();
    const arriba = () => pila.firstElementChild;
    function irse(lado) {
      const t = arriba(); if (!t || t._yendo) return;
      t._yendo = true;
      t.style.transition = "transform .5s var(--ease), opacity .5s";
      t.style.transform = `translateX(${lado * 130}%) rotate(${lado * 24}deg)`;
      t.style.opacity = "0";
      if (lado > 0) { quiero++; nota(`${platos[actual].nombre}: al pedido (es de prueba)`); }
      setTimeout(() => { actual = (actual + 1) % platos.length; pintar(); }, 330);
    }
    let arr = null;
    pila.addEventListener("pointerdown", e => {
      const t = e.target.closest(".tarjeta"); if (!t || t !== arriba()) return;
      arr = { t, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
      t.setPointerCapture(e.pointerId);
      t.style.transition = "none";
    });
    pila.addEventListener("pointermove", e => {
      if (!arr) return;
      arr.dx = e.clientX - arr.x0; arr.dy = e.clientY - arr.y0;
      arr.t.style.transform = `translate(${arr.dx}px, ${arr.dy * 0.3}px) rotate(${arr.dx / 18}deg)`;
      const f = Math.min(1, Math.abs(arr.dx) / 110);
      arr.t.querySelector(".tarjeta__sello--si").style.opacity = arr.dx > 0 ? f : 0;
      arr.t.querySelector(".tarjeta__sello--no").style.opacity = arr.dx < 0 ? f : 0;
    });
    const soltar = () => {
      if (!arr) return;
      const { t, dx, dy } = arr; arr = null;
      t.style.transition = "";
      if (Math.abs(dx) > 110) return irse(Math.sign(dx));
      t.style.transform = "";
      t.querySelectorAll(".tarjeta__sello").forEach(s => { s.style.opacity = 0; });
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) t.classList.toggle("dada-vuelta");
    };
    pila.addEventListener("pointerup", soltar);
    pila.addEventListener("pointercancel", soltar);
    cont.addEventListener("click", e => {
      const b = e.target.closest("[data-t]"); if (!b) return;
      if (b.dataset.t === "vuelta") arriba()?.classList.toggle("dada-vuelta");
      else irse(b.dataset.t === "si" ? 1 : -1);
    });
    const tecla = e => { if (e.key === "ArrowRight") irse(1); if (e.key === "ArrowLeft") irse(-1); if (e.key === " ") arriba()?.classList.toggle("dada-vuelta"); };
    addEventListener("keydown", tecla);
    return () => removeEventListener("keydown", tecla);
  }

  /* =============================================================================
     D. GALERÍA — todas las fotos juntas; al tocar una, la foto vuela y se agranda
     hasta ocupar la pantalla (y al cerrar vuelve a su lugar).
     ============================================================================= */
  function galeria(cont) {
    cont.innerHTML = `<div class="galeria">${L.categorias.map(c => `
      <h3 class="rotulo galeria__cat">${esc(c.nombre)}</h3>
      <div class="galeria__grilla">${platos.filter(p => p.categoria === c.id).map(p => `
        <button type="button" class="galeria__item" data-id="${p.id}" style="--c:${colorDe(p)}">
          <img src="${foto(p)}" alt="" loading="lazy"><span>${esc(p.nombre)}<small>${plata(p.precio)}</small></span>
        </button>`).join("")}</div>`).join("")}</div>`;
    ponerColor(platos[actual]);
    let abierto = null;
    const volar = (desde, hasta, src, alTerminar) => {
      const v = document.createElement("figure");
      v.className = "volando";
      v.innerHTML = `<img src="${src}" alt="">`;
      document.body.appendChild(v);
      const r0 = desde.getBoundingClientRect(), r1 = hasta.getBoundingClientRect();
      Object.assign(v.style, { left: r1.left + "px", top: r1.top + "px", width: r1.width + "px", height: r1.height + "px" });
      const radio0 = getComputedStyle(desde).borderRadius, radio1 = getComputedStyle(hasta).borderRadius;
      const a = v.animate([
        { transform: `translate(${r0.left - r1.left}px, ${r0.top - r1.top}px) scale(${r0.width / r1.width}, ${r0.height / r1.height})`, borderRadius: radio0, transformOrigin: "0 0" },
        { transform: "none", borderRadius: radio1, transformOrigin: "0 0" },
      ], { duration: MOVIMIENTO ? 520 : 1, easing: "cubic-bezier(.2,.9,.25,1)" });
      a.onfinish = () => { v.remove(); alTerminar && alTerminar(); };
    };
    function abrir(item) {
      const p = platos.find(x => x.id === item.dataset.id);
      actual = platos.indexOf(p);
      ponerColor(p);
      const d = document.createElement("div");
      d.className = "detalle-lab";
      d.setAttribute("role", "dialog");
      d.setAttribute("aria-label", p.nombre);
      d.innerHTML = `<div class="detalle-lab__foto"><img src="${foto(p)}" alt="" style="visibility:hidden"></div>
        <div class="detalle-lab__cuerpo"><p class="rotulo">${esc(cat(p).nombre)}</p><h2 class="nombre">${esc(p.nombre)}</h2><p class="desc">${esc(p.descripcion)}</p>
          <div style="display:flex;align-items:center;gap:16px;margin-top:6px">${botonAgregar(p)}<span class="precio" style="font-size:22px">${plata(p.precio)}</span></div></div>
        <button type="button" class="detalle-lab__cerrar" aria-label="Cerrar">✕</button>`;
      cont.appendChild(d);
      const img = $(".detalle-lab__foto img", d);
      item.style.visibility = "hidden";
      volar(item.querySelector("img"), $(".detalle-lab__foto", d), foto(p), () => { img.style.visibility = ""; });
      abierto = { d, item, p };
      $(".detalle-lab__cerrar", d).focus({ preventScroll: true });
    }
    function cerrar() {
      if (!abierto) return;
      const { d, item, p } = abierto; abierto = null;
      d.scrollTop = 0;
      const lugar = $(".detalle-lab__foto", d);
      $(".detalle-lab__foto img", d).style.visibility = "hidden";
      d.style.transition = "opacity .3s"; d.style.opacity = "0";
      volar(lugar, item.querySelector("img") || item, foto(p), () => { item.style.visibility = ""; d.remove(); item.focus({ preventScroll: true }); });
    }
    cont.addEventListener("click", e => {
      if (e.target.closest(".detalle-lab__cerrar")) return cerrar();
      const item = e.target.closest(".galeria__item");
      if (item && !abierto) abrir(item);
    });
    const tecla = e => { if (e.key === "Escape") cerrar(); };
    addEventListener("keydown", tecla);
    return () => removeEventListener("keydown", tecla);
  }

  /* ---------- Los experimentos (para sumar uno: una función más acá) ---------- */
  const EXPERIMENTOS = {
    vivo:     { nombre: "Vivo",     ayuda: "La foto entera respira. Deslizá, mové el dedo o inclinando el celu.", montar: vivo },
    plato:    { nombre: "Plato",    ayuda: "La foto en redondo gira sobre el color que sale de ella. Girala con el dedo, tocala.", montar: plato },
    tarjetas: { nombre: "Tarjetas", ayuda: "Arrastrá: derecha lo querés, izquierda para después. Un toque la da vuelta.", montar: tarjetas },
    galeria:  { nombre: "Galería",  ayuda: "Todas las fotos. Tocá una: vuela y ocupa toda la pantalla.", montar: galeria },
  };
  let elegido = null, desarmar = null;
  function usar(id, avisar) {
    if (!EXPERIMENTOS[id]) id = "vivo";
    elegido = id;
    if (desarmar) desarmar();
    const cont = $("#escenario");
    cont.innerHTML = "";
    desarmar = EXPERIMENTOS[id].montar(cont) || null;
    document.querySelectorAll("[data-exp]").forEach(b => b.setAttribute("aria-pressed", b.dataset.exp === id));
    try { localStorage.setItem("cartaviva.lab", id); } catch { /* nada */ }
    if (location.hash.slice(1) !== id) history.replaceState(null, "", "#" + id);
    if (avisar) nota(EXPERIMENTOS[id].ayuda);
  }

  $("#lab-experimentos").innerHTML = Object.entries(EXPERIMENTOS).map(([id, x]) => `<button type="button" data-exp="${id}" aria-pressed="false">${x.nombre}</button>`).join("");
  $("#lab-experimentos").addEventListener("click", e => { const b = e.target.closest("[data-exp]"); if (b && b.dataset.exp !== elegido) usar(b.dataset.exp, true); });
  document.addEventListener("click", e => { const b = e.target.closest("[data-agregar]"); if (b) nota("Es un laboratorio: el botón está solo para ver cómo queda."); });

  // Tu foto: cambia la del plato que se está viendo (solo en este navegador)
  $("#lab-foto").addEventListener("click", () => $("#lab-archivo").click());
  $("#lab-archivo").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const p = platos[actual];
    propias[p.id] = URL.createObjectURL(f);
    const c = await medirColor(propias[p.id]);
    if (c) colores[propias[p.id]] = c;
    usar(elegido);
    nota(`Listo: ${p.nombre} con tu foto (solo en este celu, hasta que recargues).`);
  });

  const inicial = (() => { const h = location.hash.slice(1); if (EXPERIMENTOS[h]) return h; try { return localStorage.getItem("cartaviva.lab"); } catch { return null; } })();
  usar(inicial || "vivo");
  medirTodo().then(() => usar(elegido));                // con los colores de las fotos
  addEventListener("hashchange", () => { const h = location.hash.slice(1); if (EXPERIMENTOS[h] && h !== elegido) usar(h, true); });
})();
