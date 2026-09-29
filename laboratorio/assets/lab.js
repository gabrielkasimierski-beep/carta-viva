/* =============================================================================
   CARTA VIVA — laboratorio de diseño
   Acá se prueban ideas con fotos reales sin tocar la app (app/ no se modifica: de ahí
   solo se leen los platos de local.js). Cada experimento es una función que arma su
   pantalla y devuelve cómo desarmarla: para sumar uno nuevo, agregarlo a EXPERIMENTOS.
   Fotos: Unsplash, licencia libre (ver CREDITOS.md). "Tu foto" cambia la del plato que
   se está viendo, solo en ese navegador y hasta que se recargue.

   Probado y descartado (29-sep, Gaby): "Plato" (foto redonda girando) y "Tarjetas".
   Elegido: Vivo + Galería, con el "¿Qué tiene?" de la app hecho con la foto.
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
  const esperar = ms => new Promise(r => setTimeout(r, MOVIMIENTO ? ms : 0));

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

  /* ---------- ¿Qué tiene? cada foto ----------
     Todo en fracciones de la foto (0 a 1).
     recorte: [x0, x1, y0, y1], la parte de la foto donde está el plato.
     capas: las burgers se ven de costado, así que la foto se corta en franjas horizontales
       (de arriba a abajo) y se separan: [nombre, y donde empieza]; fin: donde termina la última.
     puntos: en lo demás, cada ingrediente marcado en la foto: [nombre, x, y].
     Con "Tu foto" no hay marcas: se muestra la lista. */
  const PARTES = {
    "clasica": { recorte: [0.1, 0.87, 0.08, 0.87], borde: 0.83, fin: 0.84, capas: [
      ["Pan de papa", 0.11], ["Salsa de la casa y cheddar", 0.395], ["Medallones smash", 0.47],
      ["Cebolla, pepinos y tomate", 0.6], ["Lechuga", 0.662], ["Pan de papa", 0.715]] },
    "doble-bacon": { recorte: [0.12, 0.85, 0.12, 0.88], borde: 0.8, fin: 0.85, capas: [
      ["Pan con sésamo", 0.16], ["Cebolla caramelizada y cheddar", 0.43], ["Medallón", 0.52],
      ["Cheddar y morrón asado", 0.585], ["Medallón", 0.62], ["Pepinos y barbacoa", 0.69], ["Pan con sésamo", 0.74]] },
    "remolacha": { recorte: [0.27, 0.77, 0.18, 0.86], borde: 0.72, fin: 0.83, capas: [
      ["Pan brioche", 0.21], ["Palta y queso", 0.42], ["Rúcula y tomate", 0.53],
      ["Medallón de remolacha y garbanzos", 0.585], ["Salsa de morrones", 0.655], ["Pan brioche", 0.715]] },
    "pepperoni": { puntos: [["Pepperoni que se enrula", 0.63, 0.33], ["Muzzarella", 0.34, 0.5], ["Masa de fermentación lenta", 0.9, 0.55]] },
    "fugazzeta": { recorte: [0.1, 0.95, 0.33, 0.93], puntos: [["Muzzarella a morir", 0.42, 0.55], ["Tomate en cubos", 0.66, 0.7], ["Masa al horno de barro", 0.2, 0.64]] },
    "papas-cheddar": { recorte: [0.12, 0.9, 0.2, 0.84], puntos: [["Papas rústicas", 0.25, 0.47], ["Cheddar fundido", 0.52, 0.52], ["Verdeo", 0.46, 0.58], ["Panceta", 0.62, 0.48]] },
    "aros": { recorte: [0.12, 1, 0.14, 0.86], puntos: [["Aros de cebolla morada", 0.5, 0.53], ["Rebozado en birra", 0.74, 0.4]] },
    "flan": { recorte: [0, 0.98, 0.18, 0.88], puntos: [["Caramelo", 0.25, 0.38], ["Flan casero", 0.33, 0.6], ["Dulce de leche líquido", 0.72, 0.66]] },
    "helado": { recorte: [0.18, 0.86, 0.14, 0.92], puntos: [["Helado de frutilla", 0.44, 0.28], ["Frutillas frescas", 0.68, 0.34], ["Menta", 0.6, 0.45], ["Cucurucho", 0.48, 0.62]] },
    "cheesecake": { recorte: [0.14, 0.8, 0.36, 0.84], puntos: [["Coulis de frutos rojos", 0.42, 0.47], ["Cheesecake cremoso", 0.5, 0.66], ["Base de galletita", 0.55, 0.76]] },
    "limonada": { recorte: [0.24, 0.8, 0.07, 0.86], puntos: [["Hielo picado", 0.45, 0.29], ["Lima", 0.69, 0.27], ["Menta fresca", 0.58, 0.44], ["Limonada con jengibre", 0.52, 0.65]] },
    "ipa": { recorte: [0.3, 0.83, 0.14, 0.98], puntos: [["Espuma justa", 0.52, 0.23], ["IPA tirada, bien lupulada", 0.5, 0.58]] },
    "fernet": { recorte: [0.15, 0.85, 0.38, 0.97], puntos: [["Hielo", 0.5, 0.47], ["Fernet con coca", 0.58, 0.75]] },
  };

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
          listo("#" + [r, v, a].map(x => Math.round(x / peso).toString(16).padStart(2, "0")).join(""));
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
  const icono = (id, t = 16) => `<svg width="${t}" height="${t}" aria-hidden="true"><use href="#${id}"/></svg>`;

  // Una foto que vuela de un lugar a otro (de la grilla a la pantalla entera y al revés)
  function volar(desde, hasta, src, { encajar = "cover", duracion = 560 } = {}) {
    return new Promise(listo => {
      const r0 = desde.getBoundingClientRect(), r1 = hasta.getBoundingClientRect();
      if (!MOVIMIENTO || !r0.width || !r1.width) return listo();
      const v = document.createElement("figure");
      v.className = "volando";
      v.innerHTML = `<img src="${src}" alt="" style="object-fit:${encajar}">`;
      Object.assign(v.style, { left: r1.left + "px", top: r1.top + "px", width: r1.width + "px", height: r1.height + "px" });
      document.body.appendChild(v);
      const radio = el => getComputedStyle(el).borderRadius;
      const a = v.animate([
        { transform: `translate(${r0.left - r1.left}px, ${r0.top - r1.top}px) scale(${r0.width / r1.width}, ${r0.height / r1.height})`, borderRadius: radio(desde) },
        { transform: "none", borderRadius: radio(hasta) },
      ], { duration: duracion, easing: "cubic-bezier(.2,.9,.25,1)" });
      let hecho = false;
      const fin = () => { if (hecho) return; hecho = true; v.remove(); listo(); };
      a.onfinish = fin;
      setTimeout(fin, duracion + 250);                  // por si la pestaña no dibuja (en segundo plano)
    });
  }

  /* =============================================================================
     ¿QUÉ TIENE? — como en la app: el plato se abre y cada parte dice qué es.
     Las burgers (fotos de costado) se cortan en capas que se separan; lo demás
     marca cada ingrediente con un punto y su cartel.
     ============================================================================= */
  let abiertoQT = null;
  async function queTiene(p, desdeFoto) {
    if (abiertoQT) return;
    const partes = propias[p.id] ? null : PARTES[p.id];
    const capa = document.createElement("div");
    capa.className = "qt";
    capa.setAttribute("role", "dialog");
    capa.setAttribute("aria-label", `Qué tiene ${p.nombre}`);
    capa.innerHTML = `
      <div class="qt__escena"><div class="qt__foto"></div><svg class="qt__lineas" aria-hidden="true"></svg><div class="qt__carteles"></div></div>
      <div class="qt__pie">
        <p><b class="nombre">${esc(p.nombre)}</b><small class="rotulo">Así viene, parte por parte</small></p>
        <button type="button" class="boton-agregar qt__listo">Listo</button>
      </div>`;
    document.body.appendChild(capa);
    abiertoQT = { capa, p };
    const img = new Image();
    img.src = foto(p);
    await new Promise(r => { img.onload = img.onerror = r; if (img.complete && img.naturalWidth) r(); setTimeout(r, 1500); });
    const W0 = img.naturalWidth || 1000, H0 = img.naturalHeight || 1000;
    const escena = $(".qt__escena", capa), cajaFoto = $(".qt__foto", capa), lineas = $(".qt__lineas", capa), carteles = $(".qt__carteles", capa);
    const [cx0, cx1, cy0, cy1] = (partes && partes.recorte) || [0, 1, 0, 1];
    const capas = partes && partes.capas;
    const lista = !partes ? p.descripcion.split(/,| y /).map(s => s.trim()).filter(Boolean).slice(0, 6) : null;

    // Dónde va la foto: en el celu corrida a la izquierda y los carteles a la derecha (como en la app)
    const er = escena.getBoundingClientRect();
    const angosto = er.width < 640;
    const anchoMax = angosto ? er.width * 0.68 : Math.min(er.width * 0.46, 620);
    const aspecto = ((cx1 - cx0) * W0) / ((cy1 - cy0) * H0);
    const hueco = capas ? Math.max(14, Math.min(40, (er.height - anchoMax / aspecto) / capas.length * 0.7)) : 0;
    const extra = capas ? hueco * (capas.length - 1) : 0;
    let w = Math.min(anchoMax, (er.height - extra - 20) * aspecto), h = w / aspecto;
    const FW = w / (cx1 - cx0), FH = h / (cy1 - cy0);
    const x0 = angosto ? 14 : (er.width - w) / 2, y0 = (er.height - h - extra) / 2;
    Object.assign(cajaFoto.style, { left: x0 + "px", top: y0 + "px", width: w + "px", height: h + extra + "px" });
    const imgHtml = `<img src="${foto(p)}" alt="" style="width:${FW}px;height:${FH}px;left:${-cx0 * FW}px;top:TOPpx">`;
    const franjas = capas
      ? capas.map(([nombre, y], i) => {
        const y1 = i + 1 < capas.length ? capas[i + 1][1] : partes.fin;
        return { nombre, top: (y - cy0) * FH, alto: (y1 - y) * FH, i };
      })
      : [{ top: 0, alto: h, i: 0 }];
    cajaFoto.innerHTML = franjas.map(f => `<div class="qt__franja" style="top:${f.top}px;height:${f.alto}px">${imgHtml.replace("TOP", -cy0 * FH - f.top)}</div>`).join("");

    // La foto sale de donde estaba (la pantalla del plato) y se acomoda
    if (desdeFoto) { cajaFoto.style.visibility = "hidden"; capa.classList.add("abierta"); await volar(desdeFoto, cajaFoto.firstElementChild || cajaFoto, foto(p), { duracion: 520 }); cajaFoto.style.visibility = ""; }
    else { capa.classList.add("abierta"); await esperar(80); }

    // Los carteles: a la derecha en el celu; en la compu, del lado más cercano
    const lado = x => (angosto ? 1 : x < 0.5 ? -1 : 1);
    const cartel = (texto, yCentro, xDesde, dir, k) => {
      const c = document.createElement("div");
      c.className = "qt__cartel" + (dir < 0 ? " qt__cartel--izq" : "");
      c.innerHTML = `<span>${esc(texto)}</span>`;
      c.style.animationDelay = `${0.12 + k * 0.07}s`;
      carteles.appendChild(c);
      const cw = c.offsetWidth, ch = c.offsetHeight;
      const xCartel = dir > 0 ? Math.min(er.width - cw - 10, x0 + w + (angosto ? 10 : 40)) : Math.max(10, x0 - (angosto ? 10 : 40) - cw);
      Object.assign(c.style, { left: xCartel + "px", top: yCentro - ch / 2 + "px" });
      const xLlega = dir > 0 ? xCartel : xCartel + cw;
      lineas.insertAdjacentHTML("beforeend", `<path d="M${xDesde} ${yCentro}H${xLlega}" style="animation-delay:${0.08 + k * 0.07}s"/>${capas ? "" : ""}`);
      return c;
    };
    lineas.setAttribute("viewBox", `0 0 ${er.width} ${er.height}`);
    if (capas) {
      const medio = (franjas.length - 1) / 2;
      [...cajaFoto.children].forEach((div, i) => { div.style.transform = `translateY(${i * hueco}px)`; div.style.transitionDelay = `${Math.abs(i - medio) * 0.03}s`; });
      await esperar(380);
      franjas.forEach((f, k) => cartel(f.nombre, y0 + f.top + f.alto / 2 + k * hueco, x0 + w * ((partes.borde - cx0) / (cx1 - cx0)) - 8, 1, k));
    } else if (partes) {
      // Los puntos, ordenados de arriba a abajo y sin que los carteles se pisen
      const pts = partes.puntos.map(([nombre, x, y]) => ({ nombre, px: x0 + (x - cx0) * FW, py: y0 + (y - cy0) * FH, x }))
        .filter(q => q.px >= x0 - 2 && q.px <= x0 + w + 2).sort((a, b) => a.py - b.py);
      const usados = { "-1": -99, "1": -99 };
      pts.forEach((q, k) => {
        const dir = lado((q.px - x0) / w);
        const y = Math.max(q.py, usados[dir] + 52);
        usados[dir] = y;
        const punto = document.createElement("i");
        punto.className = "qt__punto";
        Object.assign(punto.style, { left: q.px + "px", top: q.py + "px", animationDelay: `${k * 0.07}s` });
        carteles.appendChild(punto);
        const c = cartel(q.nombre, y, q.px, dir, k);
        const path = lineas.lastElementChild;
        const xLlega = dir > 0 ? parseFloat(c.style.left) : parseFloat(c.style.left) + c.offsetWidth;
        path.setAttribute("d", `M${q.px} ${q.py}L${q.px + (xLlega - q.px) * 0.35} ${y}H${xLlega}`);
      });
    } else {
      lista.forEach((t, k) => cartel(t, y0 + (h / (lista.length + 1)) * (k + 1), x0 + w - 6, 1, k));
    }
    capa.classList.add("abierto-del-todo");
    const cerrar = async () => {
      if (!abiertoQT) return;
      abiertoQT = null;
      removeEventListener("keydown", tecla);
      capa.classList.remove("abierto-del-todo");
      [...cajaFoto.children].forEach(div => { div.style.transform = ""; });
      await esperar(260);
      capa.classList.remove("abierta");
      if (desdeFoto) { cajaFoto.style.visibility = "hidden"; volar(cajaFoto.firstElementChild || cajaFoto, desdeFoto, foto(p), { duracion: 480 }); }
      await esperar(420);
      capa.remove();
    };
    const tecla = e => { if (e.key === "Escape") cerrar(); };
    addEventListener("keydown", tecla);
    $(".qt__listo", capa).addEventListener("click", cerrar);
    $(".qt__listo", capa).focus({ preventScroll: true });
  }

  /* =============================================================================
     VIVO + GALERÍA — la carta de a un plato: la foto entera respira (acercamiento
     lento), se corre al deslizar y se inclina con el dedo o moviendo el celu.
     "Toda la carta" abre la galería: la foto del plato se achica hasta su lugar en
     la grilla; al tocar otra, esa foto crece hasta ocupar la pantalla y la carta
     sigue desde ahí. "¿Qué tiene?" abre el plato parte por parte.
     ============================================================================= */
  function carta(cont) {
    cont.innerHTML = `
      <div class="vivo">${platos.map((p, i) => `
        <section class="vivo__plato" data-i="${i}" style="--c:${colorDe(p)}" aria-label="${esc(p.nombre)}">
          <div class="vivo__foto"><img src="${foto(p)}" alt="" ${i > 1 ? 'loading="lazy"' : ""}></div>
          <div class="vivo__info">
            <div class="vivo__arriba"><p class="rotulo">${esc(cat(p).nombre)}</p><button type="button" class="chip-lab" data-que-tiene="${i}">${icono("i-capas", 15)}¿Qué tiene?</button></div>
            <h2 class="nombre">${esc(p.nombre)}</h2>
            <p class="desc">${esc(p.descripcion)}</p>
            <div class="vivo__fila">${botonAgregar(p)}<span class="precio">${plata(p.precio)}</span></div>
          </div>
        </section>`).join("")}</div>
      <button type="button" class="ver-todo" data-ver-todo>${icono("i-grilla", 18)}<span>Toda la carta</span></button>
      <div class="galeria" hidden>
        <div class="galeria__cabeza"><p class="nombre">${esc(L.nombre)}</p><button type="button" class="galeria__cerrar" data-cerrar-galeria aria-label="Volver al plato">✕</button></div>
        ${L.categorias.map(c => `
        <h3 class="rotulo galeria__cat">${esc(c.nombre)}</h3>
        <div class="galeria__grilla">${platos.filter(p => p.categoria === c.id).map(p => `
          <button type="button" class="galeria__item" data-id="${p.id}" style="--c:${colorDe(p)}">
            <img src="${foto(p)}" alt="" loading="lazy"><span>${esc(p.nombre)}<small>${plata(p.precio)}</small></span>
          </button>`).join("")}</div>`).join("")}
      </div>`;
    const feed = $(".vivo", cont), secs = [...feed.children], galeria = $(".galeria", cont);
    const irA = i => { feed.scrollTop = i * feed.clientHeight; };
    irA(actual);
    let tx = 0, ty = 0, ox = 0, oy = 0, raf = 0, cuadroScroll = 0;
    const entrar = i => {
      secs.forEach((s, j) => s.classList.toggle("entra", j === i));
      ponerColor(platos[i]);
    };
    entrar(actual);
    feed.addEventListener("scroll", () => {
      if (cuadroScroll) return;
      cuadroScroll = requestAnimationFrame(() => {
        cuadroScroll = 0;
        const i = Math.round(feed.scrollTop / (feed.clientHeight || 1));
        if (i !== actual && platos[i]) { actual = i; entrar(i); }
      });
    }, { passive: true });
    const cuadro = () => {
      raf = requestAnimationFrame(cuadro);
      if (!galeria.hidden && galeria.classList.contains("abierta")) return;
      tx += (ox - tx) * 0.08; ty += (oy - ty) * 0.08;
      const h = feed.clientHeight || 1;
      secs.forEach((s, j) => {
        const off = (j * h - feed.scrollTop) / h;                 // -1 … 0 … 1
        if (Math.abs(off) > 1.2) return;
        const incl = j === actual ? ` rotateY(${tx * 6}deg) rotateX(${-ty * 5}deg) translate(${-tx * 2}%, ${-ty * 2}%)` : "";
        s.firstElementChild.style.transform = `translateY(${off * 28}%)${incl}`;
      });
    };
    if (MOVIMIENTO) cuadro();
    const mover = e => { if (e.pointerType !== "mouse") return; const r = feed.getBoundingClientRect(); ox = (e.clientX - r.left) / r.width * 2 - 1; oy = (e.clientY - r.top) / r.height * 2 - 1; };
    const inclinar = e => { if (e.gamma == null) return; ox = Math.max(-1, Math.min(1, e.gamma / 25)); oy = Math.max(-1, Math.min(1, (e.beta - 45) / 25)); };
    feed.addEventListener("pointermove", mover);
    feed.addEventListener("pointerleave", () => { ox = 0; oy = 0; });
    addEventListener("deviceorientation", inclinar);

    // La galería: abrir (la foto se achica hasta su lugar) y elegir (la foto crece)
    async function abrirGaleria() {
      const p = platos[actual];
      galeria.hidden = false;
      galeria.scrollTop = 0;
      const tile = $(`.galeria__item[data-id="${p.id}"]`, galeria);
      tile.scrollIntoView({ block: "center" });
      tile.classList.add("esperando");
      requestAnimationFrame(() => galeria.classList.add("abierta"));
      await volar(secs[actual].querySelector(".vivo__foto"), tile, foto(p));
      tile.classList.remove("esperando");
      tile.focus({ preventScroll: true });
    }
    async function elegir(tile) {
      const i = platos.findIndex(x => x.id === tile.dataset.id);
      actual = i;
      irA(i);
      entrar(i);
      const destino = secs[i].querySelector(".vivo__foto");
      destino.style.visibility = "hidden";
      galeria.classList.remove("abierta");
      await volar(tile, destino, foto(platos[i]));
      destino.style.visibility = "";
      galeria.hidden = true;
    }
    function cerrarGaleria() {
      galeria.classList.remove("abierta");
      setTimeout(() => { galeria.hidden = true; }, 350);
    }
    const clic = e => {
      if (e.target.closest("[data-ver-todo]")) return abrirGaleria();
      if (e.target.closest("[data-cerrar-galeria]")) return cerrarGaleria();
      const tile = e.target.closest(".galeria__item");
      if (tile) return elegir(tile);
      const qt = e.target.closest("[data-que-tiene]");
      if (qt) { const i = +qt.dataset.queTiene; return queTiene(platos[i], secs[i].querySelector(".vivo__foto")); }
    };
    cont.addEventListener("click", clic);
    const tecla = e => {
      if (abiertoQT) return;
      if (e.key === "Escape" && !galeria.hidden) cerrarGaleria();
      if (galeria.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); irA(Math.max(0, Math.min(platos.length - 1, actual + (e.key === "ArrowDown" ? 1 : -1)))); }
    };
    addEventListener("keydown", tecla);
    return () => { cancelAnimationFrame(raf); removeEventListener("deviceorientation", inclinar); removeEventListener("keydown", tecla); };
  }

  /* ---------- Los experimentos (para sumar uno: una función más acá) ---------- */
  const EXPERIMENTOS = {
    carta: { nombre: "Vivo + Galería", ayuda: "Deslizá los platos. \"¿Qué tiene?\" lo abre parte por parte; \"Toda la carta\" muestra todas las fotos.", montar: carta },
  };
  let elegido = null, desarmar = null;
  function usar(id, avisar) {
    if (!EXPERIMENTOS[id]) id = Object.keys(EXPERIMENTOS)[0];
    elegido = id;
    if (desarmar) desarmar();
    const cont = $("#escenario");
    cont.innerHTML = "";
    desarmar = EXPERIMENTOS[id].montar(cont) || null;
    document.querySelectorAll("[data-exp]").forEach(b => b.setAttribute("aria-pressed", b.dataset.exp === id));
    try { localStorage.setItem("cartaviva.lab", id); } catch { /* nada */ }
    if (avisar) nota(EXPERIMENTOS[id].ayuda);
  }
  const nav = $("#lab-experimentos");
  nav.innerHTML = Object.entries(EXPERIMENTOS).map(([id, x]) => `<button type="button" data-exp="${id}" aria-pressed="false">${x.nombre}</button>`).join("");
  nav.addEventListener("click", e => { const b = e.target.closest("[data-exp]"); if (b && b.dataset.exp !== elegido) usar(b.dataset.exp, true); });
  document.addEventListener("click", e => { if (e.target.closest("[data-agregar]")) nota("Es un laboratorio: el botón está solo para ver cómo queda."); });

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

  let inicial = null;
  try { inicial = localStorage.getItem("cartaviva.lab"); } catch { /* nada */ }
  usar(inicial, true);
  medirTodo().then(() => usar(elegido));                // con los colores de las fotos
  // Para revisar las marcas de una foto: laboratorio/#que-tiene=clasica
  const revisar = location.hash.match(/que-tiene=([\w-]+)/);
  if (revisar) { const i = platos.findIndex(p => p.id === revisar[1]); if (i >= 0) setTimeout(() => queTiene(platos[i], null), 400); }
})();
