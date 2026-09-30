/* =============================================================================
   CARTA VIVA · laboratorio — los cuadros de un video, para mover con el dedo
   Un video de Higgsfield (la burger girando, el vaso llenándose) se pasó a cuadros recortados,
   todos juntos en una imagen (assets/cuadros/*.webp, ver laboratorio/taller). Acá se cargan
   cuando el plato está cerca y se sueltan cuando queda lejos (cada una ocupa memoria).

   Cuadros.pedir(def) → Promise<atlas>      def: { src, n, cols, tam: [w, h] }
   Cuadros.soltar(def)                      ya no hace falta (si nadie más la usa, se libera)
   Cuadros.dibujar(g, atlas, f, w, h, lazo) el cuadro f (con decimales: mezcla los dos vecinos)
   Cuadros.util(atlas, i)                   dónde está el plato adentro del cuadro i (0 a 1)
   ============================================================================= */
(function () {
  "use strict";
  const cargados = new Map();          // src → { usos, promesa, atlas }

  function pedir(def) {
    let c = cargados.get(def.src);
    if (!c) {
      const img = new Image();
      img.decoding = "async";
      const promesa = new Promise((ok, mal) => {
        img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => ok({ img, ...def, utiles: [] }));
        img.onerror = mal;
      }).catch(() => null);
      img.src = def.src;
      c = { usos: 0, promesa, img };
      cargados.set(def.src, c);
    }
    c.usos++;
    return c.promesa;
  }
  function soltar(def) {
    const c = cargados.get(def.src);
    if (!c) return;
    if (--c.usos > 0) return;
    cargados.delete(def.src);
    c.img.src = "";                    // que el navegador libere la imagen
  }

  const donde = (a, i) => { const [w, h] = a.tam; return [(i % a.cols) * w, Math.floor(i / a.cols) * h]; };
  function dibujar(g, a, f, W, H, lazo) {
    const n = a.n, [w, h] = a.tam;
    f = lazo ? ((f % n) + n) % n : Math.max(0, Math.min(n - 1, f));
    const i = Math.floor(f), j = lazo ? (i + 1) % n : Math.min(n - 1, i + 1), t = f - i;
    g.clearRect(0, 0, W, H);
    if (t < 0.02 || i === j) { const [x, y] = donde(a, i); g.drawImage(a.img, x, y, w, h, 0, 0, W, H); return; }
    // Los dos cuadros vecinos, mezclados (sumados con su parte: queda bien también en lo transparente)
    g.globalCompositeOperation = "lighter";
    let [x, y] = donde(a, i);
    g.globalAlpha = 1 - t; g.drawImage(a.img, x, y, w, h, 0, 0, W, H);
    [x, y] = donde(a, j);
    g.globalAlpha = t; g.drawImage(a.img, x, y, w, h, 0, 0, W, H);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  }

  // El rectángulo que ocupa el plato en un cuadro (para calzarlo sobre la foto)
  function util(a, i) {
    if (a.utiles[i]) return a.utiles[i];
    const [w, h] = a.tam, c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    const [x, y] = donde(a, i);
    g.drawImage(a.img, x, y, w, h, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 128) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    return (a.utiles[i] = x1 > x0 ? [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h] : [0, 0, 1, 1]);
  }

  window.Cuadros = { pedir, soltar, dibujar, util };
})();
