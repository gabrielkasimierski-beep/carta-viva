/* =============================================================================
   CARTA VIVA — los cuadros de un video, para mover con el dedo
   Un video de Higgsfield (la burger girando, el vaso llenándose) se pasó a cuadros recortados,
   juntos en una o más imágenes (assets/cuadros/*.webp, ver herramientas/taller). Acá se cargan
   cuando el plato está cerca y se sueltan cuando queda lejos (cada una ocupa memoria).

   Cuadros.pedir(def) → Promise<atlas>      def: { src: "x.webp" | ["x-1.webp", …], n, cols, tam: [w, h], porParte }
   Cuadros.soltar(def)                      ya no hace falta (si nadie más la usa, se libera)
   Cuadros.dibujar(g, atlas, f, w, h, lazo) el cuadro f (con decimales: pasa al vecino sin que se vean los dos)
   Cuadros.util(atlas, i)                   dónde está el plato adentro del cuadro i (0 a 1)
   ============================================================================= */
(function () {
  "use strict";
  const cargados = new Map();          // clave → { usos, promesa, imgs }
  const fuentes = def => (Array.isArray(def.src) ? def.src : [def.src]);

  function pedir(def) {
    const clave = fuentes(def)[0];
    let c = cargados.get(clave);
    if (!c) {
      const imgs = fuentes(def).map(() => new Image());
      const promesa = Promise.all(imgs.map((img, k) => new Promise((ok, mal) => {
        img.decoding = "async";
        img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(ok);
        img.onerror = mal;
        img.src = fuentes(def)[k];
      }))).then(() => ({ imgs, ...def, porParte: def.porParte || def.n, utiles: [] })).catch(() => null);
      c = { usos: 0, promesa, imgs };
      cargados.set(clave, c);
    }
    c.usos++;
    return c.promesa;
  }
  function soltar(def) {
    const clave = fuentes(def)[0], c = cargados.get(clave);
    if (!c) return;
    if (--c.usos > 0) return;
    cargados.delete(clave);
    c.imgs.forEach(img => { img.src = ""; });   // que el navegador libere las imágenes
  }

  // En qué imagen y en qué lugar está el cuadro i
  function donde(a, i) {
    const parte = Math.floor(i / a.porParte), k = i % a.porParte, [w, h] = a.tam;
    return [a.imgs[parte], (k % a.cols) * w, Math.floor(k / a.cols) * h];
  }
  function dibujar(g, a, f, W, H, lazo) {
    const n = a.n, [w, h] = a.tam;
    f = lazo ? ((f % n) + n) % n : Math.max(0, Math.min(n - 1, f));
    const i = Math.floor(f), j = lazo ? (i + 1) % n : Math.min(n - 1, i + 1);
    // De un cuadro al otro se pasa en la mitad del camino (mezclar todo el tiempo deja la imagen doble)
    let t = f - i;
    t = Math.max(0, Math.min(1, (t - 0.3) / 0.4));
    t = t * t * (3 - 2 * t);
    g.clearRect(0, 0, W, H);
    if (t < 0.01 || t > 0.99 || i === j) {
      const [img, x, y] = donde(a, t > 0.99 ? j : i);
      g.drawImage(img, x, y, w, h, 0, 0, W, H);
      return;
    }
    // Los dos, sumados con su parte (queda bien también en lo transparente)
    g.globalCompositeOperation = "lighter";
    let [img, x, y] = donde(a, i);
    g.globalAlpha = 1 - t; g.drawImage(img, x, y, w, h, 0, 0, W, H);
    [img, x, y] = donde(a, j);
    g.globalAlpha = t; g.drawImage(img, x, y, w, h, 0, 0, W, H);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }

  // El rectángulo que ocupa el plato en un cuadro (para calzarlo sobre la foto)
  function util(a, i) {
    if (a.utiles[i]) return a.utiles[i];
    const [w, h] = a.tam, c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    const [img, x, y] = donde(a, i);
    g.drawImage(img, x, y, w, h, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 128) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    return (a.utiles[i] = x1 > x0 ? [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h] : [0, 0, 1, 1]);
  }

  window.Cuadros = { pedir, soltar, dibujar, util };
})();
