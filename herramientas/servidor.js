// Servidor local mínimo, sin dependencias.
//
// Sirve una carpeta en http://localhost para probar una web o una app en el navegador tal
// como va a quedar publicada (fetch, rutas y módulos no andan abriendo el archivo suelto).
//
// Uso:  node servidor.js <carpeta> [puerto]

const http = require("http");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(process.argv[2] || ".");
const puerto = Number(process.argv[3] || process.env.PORT || 5180);

const tipos = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml", ".webmanifest": "application/manifest+json",
  ".mp4": "video/mp4", ".webm": "video/webm",
};

http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, "http://local").pathname);
  let archivo = path.join(raiz, ruta);
  if (!archivo.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) archivo = path.join(archivo, "index.html");

  if (!fs.existsSync(archivo)) {
    const p404 = path.join(raiz, "404.html");
    res.writeHead(404, { "Content-Type": tipos[".html"] });
    return res.end(fs.existsSync(p404) ? fs.readFileSync(p404) : "No existe: " + ruta);
  }
  const tipo = tipos[path.extname(archivo).toLowerCase()] || "application/octet-stream";
  const largo = fs.statSync(archivo).size;
  // Los videos se piden por pedazos (Range): Safari y el iPhone no los reproducen si el servidor no lo entiende
  const pedido = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (pedido && (pedido[1] || pedido[2])) {
    let desde = pedido[1] === "" ? largo - Number(pedido[2]) : Number(pedido[1]);
    let hasta = pedido[1] === "" || pedido[2] === "" ? largo - 1 : Number(pedido[2]);
    desde = Math.max(0, desde); hasta = Math.min(largo - 1, hasta);
    if (desde > hasta) { res.writeHead(416, { "Content-Range": `bytes */${largo}` }); return res.end(); }
    res.writeHead(206, {
      "Content-Type": tipo, "Cache-Control": "no-store", "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${desde}-${hasta}/${largo}`, "Content-Length": hasta - desde + 1,
    });
    return fs.createReadStream(archivo, { start: desde, end: hasta }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": tipo, "Cache-Control": "no-store", "Accept-Ranges": "bytes", "Content-Length": largo });
  fs.createReadStream(archivo).pipe(res);
}).listen(puerto, () => console.log(`Sirviendo ${raiz} en http://localhost:${puerto}`));
