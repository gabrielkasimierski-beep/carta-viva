// Taller del laboratorio: sirve la carpeta del proyecto (como servidor.js) y además deja guardar
// archivos que arma el navegador (los cuadros de los videos, ya recortados) adentro de laboratorio/.
// Es solo para trabajar en la compu: escucha en localhost.
//
// Uso:  node herramientas/taller.js [puerto]      → http://localhost:5186/laboratorio/taller/
//   POST /guardar?ruta=laboratorio/assets/giros/clasica.webp   (el cuerpo es el archivo)

const http = require("http");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname, "..");
const permitido = path.join(raiz, "laboratorio");
const puerto = Number(process.argv[2]) || 5186;
const tipos = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm",
};

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "POST" && url.pathname === "/guardar") {
    const destino = path.resolve(raiz, url.searchParams.get("ruta") || "");
    if (!destino.startsWith(permitido + path.sep)) { res.writeHead(403); res.end("solo adentro de laboratorio/"); return; }
    const partes = [];
    req.on("data", d => partes.push(d));
    req.on("end", () => {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, Buffer.concat(partes));
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(`guardado ${path.relative(raiz, destino)} (${Buffer.concat(partes).length} bytes)`);
    });
    return;
  }
  let archivo = path.join(raiz, decodeURIComponent(url.pathname));
  if (!archivo.startsWith(raiz)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) archivo = path.join(archivo, "index.html");
  if (!fs.existsSync(archivo)) { res.writeHead(404); res.end("no está"); return; }
  const tam = fs.statSync(archivo).size, tipo = tipos[path.extname(archivo).toLowerCase()] || "application/octet-stream";
  // Los videos, por partes (para poder saltar a cualquier cuadro)
  const rango = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (rango) {
    const a = rango[1] ? Number(rango[1]) : 0, b = rango[2] ? Number(rango[2]) : tam - 1;
    res.writeHead(206, { "Content-Type": tipo, "Content-Range": `bytes ${a}-${b}/${tam}`, "Accept-Ranges": "bytes", "Content-Length": b - a + 1, "Cache-Control": "no-store" });
    fs.createReadStream(archivo, { start: a, end: b }).pipe(res);
    return;
  }
  res.writeHead(200, { "Content-Type": tipo, "Content-Length": tam, "Accept-Ranges": "bytes", "Cache-Control": "no-store" });
  fs.createReadStream(archivo).pipe(res);
}).listen(puerto, "127.0.0.1", () => console.log(`Taller en http://localhost:${puerto}/laboratorio/taller/`));
