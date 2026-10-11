// Vista previa de un solo archivo.
//
// El sitio real referencia sus estilos, su JavaScript y sus imágenes como archivos
// (assets/...), que es lo correcto para publicar. Pero para mostrarlo como link (artifact)
// todo tiene que ir dentro de un único HTML. Este script copia el sitio y mete adentro
// cada hoja de estilos, cada script y cada imagen.
//
// Uso:  node vista-previa.js <sitio/index.html> <salida.html> [--afuera=assets/cuadros/]
//   --afuera: las imágenes que empiezan así no se meten adentro: quedan como archivos aparte (con
//   la ruta vista desde el HTML de salida; se publican junto con él). Sirve para lo pesado que se
//   carga cuando hace falta (los cuadros de los giros y los juegos, y el ambiente: escenas y videos).
//   Se puede repetir: --afuera=assets/cuadros/ --afuera=assets/ambiente/

const fs = require("fs");
const path = require("path");

const [, , entrada, salida] = process.argv;
const afuera = process.argv.filter(a => a.startsWith("--afuera=")).map(a => a.slice(9));
const aparte = new Set();
if (!entrada || !salida) {
  console.error("Uso: node vista-previa.js <sitio/index.html> <salida.html>");
  process.exit(1);
}

const dir = path.dirname(entrada);
// Lo que queda aparte se nombra desde donde está la salida (app/assets/... si la salida está afuera de app/)
const prefijo = path.relative(path.dirname(path.resolve(salida)), path.resolve(dir)).split(path.sep).join("/");
const desdeSalida = r => (prefijo ? prefijo + "/" : "") + r;
const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
const esVideo = ruta => /\.(mp4|webm)$/i.test(ruta);   // los videos nunca van adentro del HTML: solo aparte (--afuera)
const faltan = [];
const leer = ruta => {
  const abs = path.join(dir, ruta.replace(/^\//, ""));        // "/assets/x" y "assets/x" son lo mismo
  if (!fs.existsSync(abs)) { faltan.push(ruta); return null; }
  return abs;
};

let html = fs.readFileSync(entrada, "utf8");
let estilos = 0, scripts = 0;

// 1. Hojas de estilo propias (las de internet, como Google Fonts, quedan como están)
html = html.replace(/[ \t]*<link[^>]+href="((?!https?:|\/\/)[^"]+\.css)"[^>]*>\n?/gi, (todo, ruta) => {
  const abs = leer(ruta);
  if (!abs) return todo;
  estilos++;
  return `<style>\n/* ${ruta} */\n${fs.readFileSync(abs, "utf8")}\n</style>\n`;
});

// 2. Scripts propios
html = html.replace(/[ \t]*<script[^>]+src="((?!https?:|\/\/)[^"]+\.js)"[^>]*><\/script>\n?/gi, (todo, ruta) => {
  const abs = leer(ruta);
  if (!abs) return todo;
  scripts++;
  const codigo = fs.readFileSync(abs, "utf8").replace(/<\/script>/gi, "<\\/script>");
  // Se conservan los atributos (type="module", o los dormidos: type="text/plain" data-3d)
  const atributos = todo.trim().replace(/^<script/i, "").replace(/><\/script>$/i, "").replace(/\s+src="[^"]*"/i, "");
  return `<script${atributos}>\n/* ${ruta} */\n${codigo}\n</script>\n`;
});

// 3. Imágenes, como data URI (los videos, si no están en --afuera, quedan con su ruta)
const hechas = {};
html = html.replace(/\/?assets\/[\w\/.-]+\.(jpe?g|png|webp|svg|mp4|webm)/gi, ruta => {
  const limpia = ruta.replace(/^\//, "");
  if (afuera.some(a => limpia.startsWith(a))) { if (leer(ruta)) aparte.add(desdeSalida(limpia)); return desdeSalida(limpia); }
  if (esVideo(ruta)) return ruta;
  if (!hechas[ruta]) {
    const abs = leer(ruta);
    if (!abs) return ruta;
    hechas[ruta] = `data:${mime[path.extname(ruta).toLowerCase()]};base64,${fs.readFileSync(abs).toString("base64")}`;
  }
  return hechas[ruta];
});

fs.writeFileSync(salida, html);
const mb = (fs.statSync(salida).size / 1024 / 1024).toFixed(2);
if (aparte.size) console.log(`aparte (publicarlas junto al HTML, con la misma ruta): ${[...aparte].join(", ")}`);
console.log(`${estilos} estilos · ${scripts} scripts · ${Object.keys(hechas).length} imágenes → ${salida} (${mb} MB)`);
if (faltan.length) { console.error("FALTAN:", [...new Set(faltan)].join(", ")); process.exit(2); }
