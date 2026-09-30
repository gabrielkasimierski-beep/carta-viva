/* =============================================================================
   CARTA VIVA · laboratorio — el plato de la foto, con el trato del 3D
   Hace con la foto recortada lo que escena.js hace en la app con el 3D: el plato flota
   en su lugar de la carta, se mueve con el dedo y salta con un toque.
   · De costado (burgers, tragos, flan, aros) dan la vuelta entera con el dedo: la foto se
     envuelve en un cilindro y gira (un toque: una vuelta completa).
   · Desde arriba (las pizzas) se acuestan como un plato de verdad y giran.
   · "¿Qué tiene?": el plato queda entero y alrededor aparece cada ingrediente, con su foto.
   · "Armala": la burger se rearma con las franjas de su foto (simple, doble, triple; lo que
     se saca se va; panceta y huevo se suman con su propia foto).

   EscenaFotos.iniciar({ etiquetas })
   EscenaFotos.vincular(div, plato)       el plato vive en ese div (su lugar en la carta)
   EscenaFotos.explotar(div, si, cambiar) "¿Qué tiene?" (cambiar: lo que cambia la página)
   EscenaFotos.acomodar(div, cambiar)     el lugar cambia de tamaño (armar, volver)
   EscenaFotos.componer(div, eleccion)    "Armala": la burger como se eligió (null: la de la foto)
   EscenaFotos.saltar(div, fuerza)        pega un salto
   EscenaFotos.foto(plato) · fotoLista(plato)   el recorte (listas, pedido)
   EscenaFotos.donde(div) · rect(div)     dónde está el plato en pantalla
   EscenaFotos.cambiarFoto(plato, src)    "Tu foto": la de ese plato, solo en este navegador
   ============================================================================= */
(function () {
  "use strict";
  const MOVIMIENTO = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INCLINACION = 54;           // grados: cuánto se acuestan los platos vistos desde arriba
  const BAJO = 0.64;                // y cuánto de su alto se ve así acostados
  const ESPERA = 520;               // lo que tarda en acomodarse el plato cuando cambia su lugar
  const puestos = new Map();
  const propias = {};               // "Tu foto": { src, tam }
  const recortes = {};              // id del plato → recorte hecho
  let capa = null, pausa = false, reloj = performance.now();
  const topes = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const datos = plato => (propias[plato.id] ? { foto: propias[plato.id].src, tam: propias[plato.id].tam, vista: "frente", propia: true } : window.FOTOS[plato.id] || null);
  function pedirRecorte(plato) {
    const d = datos(plato);
    if (!d) return Promise.resolve(null);
    return Recorte.cortar(d.foto, d.propia ? null : d).then(r => {
      if (r && datos(plato) && datos(plato).foto === d.foto) recortes[plato.id] = r;
      return r;
    });
  }

  /* ---------- El plato en su lugar ---------- */
  function vincular(el, plato) {
    const fp = document.createElement("div");
    fp.className = "fp";
    fp.innerHTML = `<div class="fp__sombra"></div><div class="fp__mueve"><div class="fp__plato"></div></div>`;
    el.appendChild(fp);
    const p = {
      el, plato, fp, d: null, r: null,
      mueve: fp.querySelector(".fp__mueve"), plato3: fp.querySelector(".fp__plato"), sombra: fp.querySelector(".fp__sombra"), brillo: null,
      rot: 0, velRot: 0, rotObj: 0, velDedo: 0,                   // inclinación (de costado, sin vuelta entera)
      giro: -20 + Math.random() * 40, velGiro: 0, giroDedo: 0,     // giro de los que se ven desde arriba
      vuelta: 0, velVuelta: 0,                                      // la vuelta entera (grados)
      arrastrando: false, salto: 0, fase: Math.random() * 6, modo: null, w: 0, h: 0, eleccion: null,
    };
    puestos.set(el, p);
    gestos(el);
    preparar(p);
  }

  const enCaja = (p, x, y) => [((x - p.caja[0]) / (p.caja[2] - p.caja[0])) * 100, ((y - p.caja[1]) / (p.caja[3] - p.caja[1])) * 100];

  function preparar(p) {
    const d = (p.d = datos(p.plato));
    p.r = null;
    p.bandas = null;
    p.vista = (d && d.vista) || "frente";
    p.entera = !!(d && d.giro360 && !d.propia);
    p.fp.dataset.vista = p.vista;
    p.fp.classList.remove("listo", "con-capas", "girando");
    p.caja = d && !d.propia ? Recorte.caja(d) : null;
    p.aspecto = p.caja ? (p.caja[2] - p.caja[0]) / (p.caja[3] - p.caja[1]) : 1;
    p.redondo = Math.abs(p.aspecto - 1) < 0.12;
    if (p.vista === "arriba" && !p.redondo) p.giro = 0;
    if (p.canto) { p.canto.remove(); p.canto = null; }
    Rueda.soltar(p);
    // Mientras se hace el recorte: la foto con el borde esfumado
    let html = "";
    if (p.caja) {
      const [x0, y0, x1, y1] = p.caja, [W, H] = d.tam, cw = x1 - x0, ch = y1 - y0;
      html = `<div class="fp__boceto"><img src="${d.foto}" alt="" draggable="false" style="width:${(W / cw) * 100}%;height:${(H / ch) * 100}%;left:${(-x0 / cw) * 100}%;top:${(-y0 / ch) * 100}%"></div>`;
    }
    p.plato3.innerHTML = html;
    ubicar(p);
    pedirRecorte(p.plato).then(r => {
      if (!r || puestos.get(p.el) !== p || p.d !== d) return;
      armar(p, r);
    });
  }

  function armar(p, r) {
    p.r = r;
    p.caja = r.caja;
    p.aspecto = r.ancho / r.alto;
    const img = `<img src="${r.url}" alt="" draggable="false">`;
    let html = `<div class="fp__entero">${img}</div><div class="fp__capas"></div>`;
    if (p.vista !== "arriba" && !p.entera) html += `<div class="fp__brillo" style="--mascara:url(${r.url})"></div>`;
    const boceto = p.plato3.querySelector(".fp__boceto");
    p.plato3.innerHTML = html;
    if (boceto) { p.plato3.prepend(boceto); setTimeout(() => boceto.remove(), 700); }
    p.brillo = p.plato3.querySelector(".fp__brillo");
    p.capas = p.plato3.querySelector(".fp__capas");
    p.bandas = bandas(p);
    if (p.vista === "arriba") {
      p.canto = document.createElement("div");
      p.canto.className = "fp__canto";
      p.canto.innerHTML = img;
      p.mueve.prepend(p.canto);
    }
    ubicar(p);
    void p.fp.offsetWidth;                                     // que el cambio se vea como transición
    p.fp.classList.add("listo");
    if (p.eleccion) componer(p.el, p.eleccion);
    if (p.modo === "explotando") ingredientes(p);
  }

  // Las burgers en franjas (curvas que pasan por izquierda, centro y derecha de lo marcado)
  function bandas(p) {
    const d = p.d;
    if (!d || d.propia || !d.capas) return null;
    const cont = Recorte.contornoDe(d);
    const xs = cont.map(c => c[0]), ys = cont.map(c => c[1]);
    const cx0 = Math.min(...xs), cx1 = Math.max(...xs), arriba = Math.min(...ys), abajo = Math.max(...ys);
    const curva = h => {
      const [a, c, b] = h, m = 2 * c - (a + b) / 2, ps = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, y = (1 - t) * (1 - t) * a + 2 * t * (1 - t) * m + t * t * b;
        const [X, Y] = enCaja(p, cx0 + (cx1 - cx0) * t, y);
        ps.push([i === 0 ? -20 : i === 16 ? 120 : X, Y]);
      }
      return ps;
    };
    const n = d.capas.length;
    return d.capas.map((c, i) => {
      const sup = i ? curva(d.capas[i - 1].hasta) : [[-20, -20], [120, -20]];
      const inf = i < n - 1 ? curva(c.hasta) : [[-20, 120], [120, 120]];
      const ps = sup.concat(inf.slice().reverse());
      const yA = i ? d.capas[i - 1].hasta[1] : arriba, yB = i < n - 1 ? c.hasta[1] : abajo;
      return {
        clip: `polygon(${ps.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(",")})`,
        arriba: enCaja(p, 0, yA)[1], abajo: enCaja(p, 0, yB)[1], tiene: c.tiene || [],
      };
    });
  }

  /* ---------- Armala: la burger se rearma con las franjas de su foto ---------- */
  const extras = {};                // lo que se suma (panceta, huevo): su recorte
  function extra(id) {
    const s = window.SUMAR && window.SUMAR[id];
    if (!s) return null;
    if (!extras[id]) extras[id] = Recorte.cortar(s.foto, s.alfa ? { alfa: s.alfa } : { auto: true, tolerancia: 40 });
    return extras[id];
  }
  function componer(el, eleccion) {
    const p = puestos.get(el);
    if (!p) return;
    p.eleccion = eleccion || null;
    if (!p.bandas || !p.eleccion) {
      p.fp.classList.remove("con-capas");
      if (p.capas) p.capas.style.transform = "";
      return;
    }
    const B = p.bandas, el_ = p.eleccion;
    const sacadas = new Set(el_.sacale || []), sumadas = new Set(el_.sumale || []);
    const meds = B.map((b, i) => (b.tiene.includes("medallon") ? i : -1)).filter(i => i >= 0);
    const quiero = el_.medallones || meds.length;
    const piezas = [];               // de arriba hacia abajo
    let antesDelPrimero = true, cheddarExtra = false;
    B.forEach((b, i) => {
      if (b.tiene.length && !b.tiene.includes("medallon") && b.tiene.every(t => sacadas.has(t))) return;
      if (b.tiene.includes("medallon")) {
        if (antesDelPrimero) {
          if (sumadas.has("huevo")) piezas.push({ clave: "x-huevo", extra: "huevo" });
          if (sumadas.has("bacon")) piezas.push({ clave: "x-bacon", extra: "bacon" });
          antesDelPrimero = false;
        }
        const k = meds.indexOf(i);
        if (k < quiero) piezas.push({ clave: `b${i}`, banda: i });
        if (k === meds.length - 1) for (let c = meds.length; c < quiero; c++) piezas.push({ clave: `b${i}-${c}`, banda: i });
        return;
      }
      piezas.push({ clave: `b${i}`, banda: i });
      if (sumadas.has("cheddar") && !cheddarExtra && b.tiene.includes("cheddar")) { cheddarExtra = true; piezas.push({ clave: "x-cheddar", banda: i }); }
    });
    // Se apilan desde abajo: el pan de abajo queda donde está y lo demás se acomoda arriba
    const fondo = B[B.length - 1].abajo, techoFoto = B[0].arriba;
    let cursor = fondo;
    for (let k = piezas.length - 1; k >= 0; k--) {
      const q = piezas[k];
      const alto = q.extra ? (window.SUMAR[q.extra].alto || 0.07) * 100 : B[q.banda].abajo - B[q.banda].arriba;
      q.arriba = cursor - alto;
      q.alto = alto;
      cursor = q.arriba;
    }
    const escala = Math.min(1, (fondo - techoFoto) / (fondo - cursor));
    p.capas.style.transformOrigin = `50% ${fondo}%`;
    p.capas.style.transform = `scale(${escala.toFixed(4)})`;
    // Las piezas: las que siguen se mueven, las nuevas caen, las que se fueron se esfuman
    const viejas = new Map([...p.capas.children].map(e => [e.dataset.clave, e]));
    piezas.forEach((q, k) => {
      let e = viejas.get(q.clave);
      viejas.delete(q.clave);
      const nueva = !e;
      if (nueva) {
        e = document.createElement("div");
        e.dataset.clave = q.clave;
        if (q.extra) {
          e.className = "fp__extra";
          extra(q.extra).then(r => {
            if (!r) return;
            const [u0, v0, u1, v1] = r.util;
            e.innerHTML = `<img src="${r.url}" alt="" style="width:${100 / (u1 - u0)}%;height:${100 / (v1 - v0)}%;left:${(-u0 / (u1 - u0)) * 100}%;top:${(-v0 / (v1 - v0)) * 100}%">`;
          });
        } else {
          e.className = "fp__capa";
          e.style.clipPath = B[q.banda].clip;
          e.innerHTML = `<img src="${p.r.url}" alt="" draggable="false">`;
        }
      }
      e.style.zIndex = q.extra ? 2 : 1;
      if (q.extra) Object.assign(e.style, { top: `${q.arriba}%`, height: `${q.alto}%` });
      else e.style.transform = `translateY(${(((q.arriba - B[q.banda].arriba) / 100) * p.h).toFixed(1)}px)`;
      p.capas.appendChild(e);
      if (nueva && MOVIMIENTO) e.animate([{ opacity: 0, translate: `0 -${(p.h * 0.12).toFixed(0)}px` }, { opacity: 1, translate: "0 0" }], { duration: 420, easing: "cubic-bezier(.3,1.4,.5,1)" });
    });
    viejas.forEach(e => { e.style.opacity = "0"; setTimeout(() => e.remove(), 260); });
    p.fp.classList.add("con-capas");
  }

  /* ---------- Dónde va y de qué tamaño (como el 3D: ocupa todo su lugar) ---------- */
  function ubicar(p) {
    const W = p.el.clientWidth, H = p.el.clientHeight;
    if (!W || !H) return;
    const angosto = innerWidth < 640;
    const a = p.aspecto, bajo = p.vista === "arriba" ? BAJO : 1;
    const maximo = p.r ? p.r.ancho * 1.3 : Infinity;              // que no se agrande más de lo que da la foto
    let w;
    if (p.modo === "explotando") {
      // Queda entero, más chico, en el medio: alrededor van los ingredientes
      w = Math.min(W * (angosto ? 0.5 : 0.36), (H * (angosto ? 0.42 : 0.5) * a) / bajo, maximo);
    } else {
      w = Math.min(W * (angosto ? 1.12 : 1), (H * 0.97 * a) / bajo, maximo);
    }
    const h = w / a;
    p.w = w;
    p.h = h;
    Object.assign(p.fp.style, { left: `${W / 2 - w / 2}px`, top: `${H / 2 - h / 2}px`, width: `${w}px`, height: `${h}px` });
    if (p.eleccion && p.bandas) componer(p.el, p.eleccion);
  }

  // Cambia el lugar: el plato va volando de donde estaba a donde le toca
  function mudarse(p, cambiar) {
    const antes = p.fp.getBoundingClientRect();
    if (cambiar) cambiar();
    ubicar(p);
    const despues = p.fp.getBoundingClientRect();
    if (!MOVIMIENTO || !antes.width || !despues.width) return;
    p.fp.animate(
      [{ transform: `translate(${antes.left - despues.left}px, ${antes.top - despues.top}px) scale(${antes.width / despues.width})` }, { transform: "none" }],
      { duration: ESPERA, easing: "cubic-bezier(.2,.9,.25,1)" },
    );
  }

  /* ---------- ¿Qué tiene?: el plato entero y alrededor, cada ingrediente con su foto ---------- */
  function explotar(el, si, cambiar) {
    const p = puestos.get(el);
    if (!p) { if (cambiar) cambiar(); return; }
    p.modo = si ? "explotando" : null;
    quitarEtiquetas(p);
    mudarse(p, cambiar);
    if (si) { p.salto = 0.7; ingredientes(p); }
  }
  function ingredientes(p) {
    quitarEtiquetas(p);
    const f = window.FOTOS[p.plato.id] || {}, lista = f.lleva || [];
    if (!lista.length) return;
    const er = p.el.getBoundingClientRect(), angosto = innerWidth < 640;
    const D = angosto ? 66 : 94, n = lista.length;
    const cx = er.left + er.width / 2, cy = er.top + er.height / 2;
    const mitad = Math.max(D / 2, angosto ? 58 : 84);                // la foto o el nombre, lo que sea más ancho
    const rx = er.width / 2 - mitad - (angosto ? 4 : 30), ry = er.height / 2 - D / 2 - 24;
    const inicio = -90 + 180 / n;
    p.etqs = lista.map(([id, nombre], k) => {
      const ang = ((inicio + (360 / n) * k) * Math.PI) / 180;
      const x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * ry;
      const e = document.createElement("div");
      e.className = "ingrediente";
      e.style.setProperty("--k", k);
      e.innerHTML = `<span class="ingrediente__cuerpo"><span class="ingrediente__foto" style="width:${D}px;height:${D}px;background-image:url(${window.INGREDIENTES[id] || ""})"></span><b>${esc(nombre)}</b></span>`;
      e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      capa.appendChild(e);
      if (MOVIMIENTO) e.animate([{ transform: `translate(${cx}px, ${cy}px) scale(.15)`, opacity: 0 }, { transform: e.style.transform, opacity: 1 }],
        { duration: 620, delay: 120 + k * 75, easing: "cubic-bezier(.25,1.35,.5,1)", fill: "backwards" });
      return e;
    });
  }
  function quitarEtiquetas(p) {
    if (!p.etqs) return;
    const viejas = p.etqs;
    p.etqs = null;
    viejas.forEach(e => e.classList.add("fuera"));
    setTimeout(() => viejas.forEach(e => e.remove()), MOVIMIENTO ? 240 : 0);
  }

  /* ---------- La vuelta entera: la foto envuelta en un cilindro (WebGL, uno solo para todos) ----------
     Cada fila del plato se toma como un cilindro de su ancho: al girar, lo de la foto corre de
     costado, se achica en los bordes y vuelve por atrás (espejado). El contorno queda igual,
     como pasa con una burger de verdad. En 0° es exactamente la foto. */
  const Rueda = (() => {
    let cv = null, gl = null, uGiro, uK, uSombra, texFoto, texFilas, duenio = null, roto = false;
    const VS = "attribute vec2 p;varying vec2 uv;void main(){uv=vec2((p.x+1.)/2.,(1.-p.y)/2.);gl_Position=vec4(p,0.,1.);}";
    const FS = `precision highp float;uniform sampler2D foto;uniform sampler2D filas;uniform float giro;uniform float k;uniform float sombra;varying vec2 uv;
      float dec(float a,float b){return (a*65280.+b*255.)/65535.;}
      void main(){vec4 a=texture2D(foto,uv);if(a.a<.004){gl_FragColor=vec4(0.);return;}
        vec4 f=texture2D(filas,vec2(.5,uv.y));float c=dec(f.r,f.g),r=dec(f.b,f.a);vec3 col=a.rgb;float luz=1.;
        if(r>.004){float u=clamp((uv.x-c)/r,-1.,1.);float fi=asin(u)+giro;col=texture2D(foto,vec2(c+r*k*sin(fi),uv.y)).rgb;
          luz=mix(1.,.8+.2*sqrt(1.-u*u),sombra)*(cos(fi)<0.?mix(1.,.93,sombra):1.);}
        gl_FragColor=vec4(col*luz*a.a,a.a);}`;
    function iniciar() {
      if (gl || roto) return !!gl;
      try {
        cv = document.createElement("canvas");
        cv.className = "fp__rueda";
        gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
        if (!gl) throw 0;
        const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x); return x; };
        const pr = gl.createProgram();
        gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
        gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(pr);
        gl.useProgram(pr);
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(pr, "p");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        uGiro = gl.getUniformLocation(pr, "giro"); uK = gl.getUniformLocation(pr, "k"); uSombra = gl.getUniformLocation(pr, "sombra");
        gl.uniform1i(gl.getUniformLocation(pr, "foto"), 0);
        gl.uniform1i(gl.getUniformLocation(pr, "filas"), 1);
        const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
        gl.activeTexture(gl.TEXTURE0); texFoto = tex(); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.activeTexture(gl.TEXTURE1); texFilas = tex(); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return true;
      } catch { roto = true; gl = null; return false; }
    }
    // Por cada fila: el centro y el ancho del plato (de la foto recortada)
    function filasDe(p) {
      if (p.filas) return p.filas;
      const img = p.plato3.querySelector(".fp__entero img");
      if (!img || !img.complete || !img.naturalWidth) return null;
      const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement("canvas");
      c.width = W; c.height = H;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, W, H).data, out = new Uint8Array(H * 4);
      for (let y = 0; y < H; y++) {
        let l = -1, r = -1;
        for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
        if (l < 0) continue;
        const cc = Math.round(((l + r + 1) / 2 / W) * 65535), rr = Math.round(((r + 1 - l) / 2 / W) * 65535);
        out.set([cc >> 8, cc & 255, rr >> 8, rr & 255], y * 4);
      }
      p.filas = out;
      p.imgRueda = img;
      return out;
    }
    function dibujar(p, grados) {
      if (!iniciar()) return false;
      if (duenio !== p) {
        const filas = filasDe(p);
        if (!filas) return false;
        if (duenio) soltar(duenio);
        duenio = p;
        const W = Math.round(topes(p.w * Math.min(devicePixelRatio || 1, 2), 64, p.r.ancho)), H = Math.round((W * p.r.alto) / p.r.ancho);
        cv.width = W; cv.height = H;
        gl.viewport(0, 0, W, H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texFoto);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p.imgRueda);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texFilas);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, filas.length / 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, filas);
        p.plato3.appendChild(cv);
        p.fp.classList.add("girando");
      }
      const rad = (grados * Math.PI) / 180, s = Math.min(1, Math.abs(Math.sin(rad)) * 2.5);
      gl.uniform1f(uGiro, rad);
      gl.uniform1f(uK, 1 - 0.1 * s);
      gl.uniform1f(uSombra, s);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    }
    function soltar(p) {
      if (duenio !== p) return;
      duenio = null;
      if (cv && cv.parentNode) cv.remove();
      p.fp.classList.remove("girando");
    }
    return { dibujar, soltar, duenio: () => duenio };
  })();

  /* ---------- Con el dedo: vuelta entera, giro o inclinación; un toque, salta ---------- */
  function gestos(el) {
    let x0 = 0, xIni = 0, t0 = 0, recorrido = 0, dedo = null, p = null;
    el.addEventListener("pointerdown", e => {
      p = puestos.get(el);
      if (!p || e.target.closest("button, a, input")) return;
      dedo = e.pointerId;
      x0 = xIni = e.clientX;
      t0 = performance.now();
      recorrido = 0;
      p.arrastrando = true;
      p.velDedo = 0;
      if (e.pointerType === "mouse") el.setPointerCapture(dedo);
    });
    el.addEventListener("pointermove", e => {
      if (!p || e.pointerId !== dedo || !p.arrastrando) return;
      const dx = e.clientX - x0, ahora = performance.now(), dt = Math.max(8, ahora - t0) / 1000;
      x0 = e.clientX;
      t0 = ahora;
      recorrido += Math.abs(dx);
      if (conVuelta(p)) {
        p.vuelta += dx * 0.6;
        p.velVuelta = topes((dx * 0.6) / dt, -1400, 1400);
      } else if (p.vista === "arriba" && p.redondo) {
        p.giro += dx * 0.5;
        p.velGiro = topes((dx * 0.5) / dt, -720, 720);
      } else if (p.vista === "arriba") {
        p.giroDedo = topes((e.clientX - xIni) * 0.35, -40, 40);
      } else {
        p.rotObj = topes((e.clientX - xIni) * 0.28, -34, 34);
        p.velDedo = dx / dt;
      }
      if (recorrido > 12) el.dispatchEvent(new CustomEvent("escena:giro", { bubbles: true }));
    });
    const fin = e => {
      if (!p || e.pointerId !== dedo) return;
      p.arrastrando = false;
      dedo = null;
      const quieto = performance.now() - t0 > 120;
      if (conVuelta(p)) { if (quieto) p.velVuelta *= 0.3; }
      else if (p.vista === "arriba") { if (quieto) p.velGiro *= 0.3; }
      else { p.rotObj = 0; p.velRot += topes(p.velDedo * 0.06, -160, 160); }
      if (e.type === "pointerup" && recorrido < 6) {
        p.salto = 1;
        if (conVuelta(p)) p.velVuelta += p.velVuelta >= 0 ? 760 : -760;        // un toque: una vuelta entera
        else if (p.vista === "arriba") p.velGiro += p.redondo ? 220 : 90;
        else p.velRot += 140;
        el.dispatchEvent(new CustomEvent("escena:toque", { bubbles: true }));
      }
    };
    el.addEventListener("pointerup", fin);
    el.addEventListener("pointercancel", fin);
  }
  const conVuelta = p => p.entera && p.r && !p.eleccion;

  /* ---------- Cada cuadro: flota, gira, salta ---------- */
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    const dt = Math.min(0.05, (ahora - reloj) / 1000);
    reloj = ahora;
    if (document.hidden || pausa) return;
    const t = ahora / 1000, alto = innerHeight;
    const vivos = [];
    for (const p of puestos.values()) {
      const r = p.el.getBoundingClientRect();
      if (p.h && r.bottom > -alto * 0.2 && r.top < alto * 1.2) vivos.push({ p, lejos: Math.abs(r.top + r.height / 2 - alto / 2) });
    }
    // La vuelta entera se dibuja en uno solo: el que se está moviendo o el más cerca del medio
    const conRueda = vivos.filter(v => conVuelta(v.p)).sort((a, b) => (b.p.arrastrando || Math.abs(b.p.velVuelta) > 30) - (a.p.arrastrando || Math.abs(a.p.velVuelta) > 30) || a.lejos - b.lejos)[0];
    vivos.forEach(({ p }) => mover(p, t, dt, conRueda && conRueda.p === p));
  }
  function mover(p, t, dt, rueda) {
    p.salto = Math.max(0, p.salto - dt * 1.9);
    const s = p.salto > 0 ? Math.sin((1 - p.salto) * Math.PI) : 0;
    const flota = MOVIMIENTO ? Math.sin(t * 1.5 + p.fase) * 0.014 * p.h : 0;
    const y = flota - s * 0.15 * p.h;
    if (conVuelta(p)) {
      // Suelto: sigue con el envión, frena y vuelve a quedar de frente (a la vuelta más cercana)
      if (!p.arrastrando) {
        p.velVuelta *= Math.exp(-dt * 2);
        if (Math.abs(p.velVuelta) < 110) {
          const meta = Math.round(p.vuelta / 360) * 360;
          p.velVuelta += ((meta - p.vuelta) * 26 - p.velVuelta * 7) * dt;
        }
        p.vuelta += p.velVuelta * dt;
      }
      const vista = p.vuelta + (MOVIMIENTO && rueda && !p.arrastrando ? Math.sin(t * 0.7 + p.fase) * 16 : 0);
      const grados = ((vista % 360) + 360) % 360;
      if (rueda && Math.min(grados, 360 - grados) > 0.3) { if (!Rueda.dibujar(p, vista)) Rueda.soltar(p); }
      else Rueda.soltar(p);
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${(1 + s * 0.035).toFixed(4)})`;
    } else if (p.vista === "arriba" && !p.redondo) {
      // La fuente ovalada: se hamaca, sigue al dedo y vuelve (como un resorte)
      const obj = p.arrastrando ? p.giroDedo || 0 : MOVIMIENTO ? Math.sin(t * 0.45 + p.fase) * 9 : 0;
      if (p.arrastrando) { p.giro += (obj - p.giro) * (1 - Math.exp(-dt * 16)); p.velGiro = 0; }
      else { p.velGiro += ((obj - p.giro) * 40 - p.velGiro * 7) * dt; p.giro += p.velGiro * dt; }
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      girar(p);
    } else if (p.vista === "arriba") {
      if (!p.arrastrando) {
        const solo = MOVIMIENTO ? 9 : 0;                          // grados por segundo: gira solo, despacito
        p.velGiro += (solo - p.velGiro) * (1 - Math.exp(-dt * 1.3));
        p.giro += p.velGiro * dt;
      }
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      girar(p);
    } else {
      if (p.entera) Rueda.soltar(p);
      const obj = p.arrastrando ? p.rotObj : MOVIMIENTO ? Math.sin(t * 0.55 + p.fase) * 5 : 0;
      if (p.arrastrando) { p.rot += (obj - p.rot) * (1 - Math.exp(-dt * 16)); p.velRot = 0; }
      else { p.velRot += ((obj - p.rot) * 55 - p.velRot * 8) * dt; p.rot += p.velRot * dt; }
      p.mueve.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) rotateY(${p.rot.toFixed(2)}deg) scale(${(1 + s * 0.035).toFixed(4)})`;
      if (p.brillo) {
        p.brillo.style.setProperty("--bx", `${(50 - p.rot * 2.4).toFixed(1)}%`);
        p.brillo.style.opacity = (Math.min(1, Math.abs(p.rot) / 16) * 0.85).toFixed(3);
      }
    }
    p.sombra.style.transform = `scale(${(1 - s * 0.3).toFixed(3)})`;
    p.sombra.style.opacity = (1 - s * 0.55).toFixed(3);
  }
  // Acostado y girado; el canto (una copia oscura) un poco más abajo en la pantalla
  function girar(p) {
    const tr = `rotateX(${INCLINACION}deg) rotateZ(${p.giro.toFixed(2)}deg)`;
    p.plato3.style.transform = tr;
    if (p.canto) p.canto.style.transform = `translateY(${(p.w * 0.024).toFixed(1)}px) ${tr}`;
  }

  /* ---------- Lo que usa la carta ---------- */
  let esperaMedida = 0;
  addEventListener("resize", () => {
    cancelAnimationFrame(esperaMedida);
    esperaMedida = requestAnimationFrame(() => {
      for (const p of puestos.values()) {
        ubicar(p);
        if (p.modo === "explotando") ingredientes(p);
        p.filas = null;
        Rueda.soltar(p);
      }
    });
  });

  window.EscenaFotos = {
    iniciar(o) { capa = o.etiquetas; requestAnimationFrame(cuadro); },
    vincular,
    explotar,
    componer,
    acomodar(el, cambiar) {
      const p = puestos.get(el);
      if (p) mudarse(p, cambiar); else if (cambiar) cambiar();
    },
    saltar(el, fuerza = 1) {
      const p = puestos.get(el);
      if (!p) return;
      p.salto = Math.max(p.salto, fuerza);
      if (conVuelta(p)) p.velVuelta += 200 * fuerza;
      else if (p.vista === "arriba") p.velGiro += 160 * fuerza;
      else p.velRot += 110 * fuerza;
    },
    acostado: plato => { const d = datos(plato); return d && d.vista === "arriba" ? INCLINACION : 0; },
    foto: plato => pedirRecorte(plato).then(r => (r ? r.url : "")),
    fotoLista: plato => (recortes[plato.id] ? recortes[plato.id].url : null),
    rect(el) { const p = puestos.get(el); return p ? p.fp.getBoundingClientRect() : el.getBoundingClientRect(); },
    donde(el) {
      const r = this.rect(el);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.min(r.width, r.height) / 2 };
    },
    ocultar(el, si) { const p = puestos.get(el); if (p) p.fp.style.visibility = si ? "hidden" : ""; },
    // "Tu foto": se recorta como un óvalo (no se sabe dónde está el plato en la foto)
    cambiarFoto(plato, src) {
      return new Promise(listo => {
        const img = new Image();
        img.onload = () => {
          propias[plato.id] = { src, tam: [img.naturalWidth, img.naturalHeight] };
          delete recortes[plato.id];
          for (const p of puestos.values()) if (p.plato === plato) { p.caja = null; p.filas = null; preparar(p); }
          pedirRecorte(plato).then(listo);
        };
        img.onerror = () => listo(null);
        img.src = src;
      });
    },
    pausar(si) { pausa = !!si; },
  };
})();
