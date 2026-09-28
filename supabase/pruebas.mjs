// Prueba de la base de Carta Viva en PGlite (Postgres en JS), imitando lo que tiene Supabase.
// Uso (desde la carpeta del proyecto): npm install (una vez) y después npm test
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import assert from "assert/strict";
import { fileURLToPath } from "url";

const RAIZ = fileURLToPath(new URL("./", import.meta.url));   // esta carpeta (supabase/)
const db = new PGlite();
const q1 = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const val = async (sql, p = []) => Object.values(await q1(sql, p))[0];
const ok = (cond, msg) => { assert.ok(cond, msg); console.log("  ✓", msg); };
async function falla(sql, p, esperado) {
  try { await db.query(sql, p); } catch (e) { assert.match(e.message, new RegExp(esperado)); console.log("  ✓ rechaza:", esperado); return; }
  throw new Error("Tenía que fallar con " + esperado + ": " + sql);
}

// ---- Lo que ya trae Supabase ----
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
  create schema realtime;
  create table realtime.enviados (topic text, event text, payload jsonb, privado boolean);
  create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void
    language sql as $$ insert into realtime.enviados values (topic, event, payload, private) $$;
  create role anon; create role authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);

console.log("esquema.sql");
await db.exec(fs.readFileSync(RAIZ + "esquema.sql", "utf8"));
console.log("  ✓ corre sin errores");
await db.exec(fs.readFileSync(RAIZ + "esquema.sql", "utf8"));
console.log("  ✓ se puede volver a correr");

console.log("semilla.sql");
await db.exec(fs.readFileSync(RAIZ + "semilla.sql", "utf8"));
await db.exec(fs.readFileSync(RAIZ + "semilla.sql", "utf8"));
ok(await val("select count(*)::int from public.mesas") === 12, "12 mesas (y correrla dos veces no duplica)");
ok(await val("select count(*)::int from public.equipo") === 5, "5 personas en el equipo");
const cod = async n => val("select codigo from public.mesas where numero = $1", [n]);
const C7 = await cod(7), C3 = await cod(3);

console.log("Comensales en la mesa 7");
ok((await val("select public.ver_mesa($1)", [C7])).gente.length === 0, "la mesa arranca vacía");
ok(await val("select public.ver_mesa('no-existe')") === null, "un código inventado no abre nada");
const e1 = await val("select public.entrar($1, $2)", [C7, "Gaby"]);
const e2 = await val("select public.entrar($1, $2)", [C7, "  Juanma   "]);
const e3 = await val("select public.entrar($1, $2)", [C7, "gaby"]);
const e4 = await val("select public.entrar($1, $2)", [C7, ""]);
const gaby = e1.comensal.clave, juanma = e2.comensal.clave;
ok(e1.comensal.sesion === e2.comensal.sesion, "Gaby y Juanma quedan en la misma mesa abierta");
ok(e2.comensal.nombre === "Juanma", "el nombre se limpia (espacios)");
ok(e3.comensal.nombre === "gaby 3", "dos con el mismo nombre se distinguen");
ok(e4.comensal.nombre === "Invitado 4", "sin nombre: Invitado N");
ok(new Set([e1, e2, e3, e4].map(e => e.comensal.color)).size === 4, "cada uno con su color");
ok(!JSON.stringify(e2.mesa).includes(gaby), "nadie ve la clave de otro");
ok((await val("select public.ver_mesa($1)", [C7])).gente.length === 4, "ver_mesa muestra quiénes están");

console.log("El pedido de la mesa");
let m = await val("select public.sumar($1, 'clasica', $2::jsonb, 1)", [gaby, JSON.stringify({ medallones: 2, sacale: ["cebolla"], sumale: ["bacon"], punto: "jugosa" })]);
let l = m.carrito[0];
ok(l.precio === 17500 + 4200 + 2400, "el precio lo calcula la base: " + l.precio);
ok(l.detalle === "Doble · sin cebolla · + panceta · jugosa", "la descripción también: " + l.detalle);
m = await val("select public.sumar($1, 'clasica', $2::jsonb, 1)", [gaby, JSON.stringify({ sumale: ["caviar"], medallones: 9, precio: 1 })]);
ok(m.carrito.find(x => x.eleccion === null && x.plato === "clasica").precio === 17500, "opciones inventadas no cambian el precio");
m = await val("select public.sumar($1, 'ipa', null, 1)", [juanma]);
m = await val("select public.sumar($1, 'ipa', null, 1)", [juanma]);
ok(m.carrito.find(x => x.plato === "ipa").cant === 2, "lo mismo dos veces suma cantidad");
await falla("select public.sumar($1, 'caviar', null, 1)", [juanma], "plato_no_existe");
await falla("select public.sumar('clave-trucha', 'ipa', null, 1)", [], "comensal_no_existe");
const lineaIpa = m.carrito.find(x => x.plato === "ipa").id;
m = await val("select public.cantidad($1, $2, -1)", [gaby, lineaIpa]);
ok(m.carrito.find(x => x.plato === "ipa").cant === 2, "nadie toca la línea de otro");
m = await val("select public.cantidad($1, $2, -1)", [juanma, lineaIpa]);
ok(m.carrito.find(x => x.plato === "ipa").cant === 1, "cada uno cambia lo suyo");
const totalCarrito = m.carrito.reduce((s, x) => s + x.precio * x.cant, 0);

m = await val("select public.mandar($1, $2)", [juanma, "  la burger bien jugosa  "]);
const p1 = m.pedidos[0];
ok(m.carrito.length === 0, "al mandar se vacía el carrito de la mesa");
ok(p1.ronda === 1 && p1.numero === 1, "ronda 1, pedido 1 del día");
ok(p1.total === totalCarrito, "el total es lo del carrito: " + p1.total);
ok(Object.keys(p1.partes).sort().join() === "barra,cocina", "se parte en cocina y barra");
ok(p1.items.every(i => i.comensal), "cada cosa dice de quién es");
ok(p1.nota === "la burger bien jugosa", "la nota llega limpia");
await falla("select public.mandar($1, '')", [gaby], "nada_para_mandar");

console.log("El equipo");
const cuenta = "11111111-1111-1111-1111-111111111111";
await db.query("insert into auth.users values ($1, 'mordisco@ejemplo.com')", [cuenta]);
ok((await val("select interno.dar_panel('mordisco', 'mordisco@ejemplo.com')")).startsWith("Listo"), "dar_panel le da acceso a la cuenta del local");
await falla("select public.panel_estado()", [], "sin_permiso");
await db.query("select set_config('prueba.uid', $1, false)", [cuenta]);
let panel = await val("select public.panel_estado()");
ok(panel.sesiones.length === 1 && panel.comensales.length === 4, "el panel ve la mesa 7 con sus 4 personas");
ok(panel.mesas.every(x => x.codigo), "y los códigos de las mesas para los QR");
const id = nombre => panel.equipo.find(x => x.nombre === nombre).id;
ok((await val("select public.abrir_turno($1, '0000')", [id("Diego")])).ok === false, "PIN equivocado: no entra");
const turno = async (nombre) => (await val("select public.abrir_turno($1, '1234')", [id(nombre)])).turno;
const diego = await turno("Diego"), martin = await turno("Martín"), carla = await turno("Carla"), sofi = await turno("Sofi");
ok(diego && carla && sofi && martin, "con el PIN, cada uno recibe su turno");
for (let i = 0; i < 5; i++) await db.query("select public.abrir_turno($1, '9999')", [id("Nico")]);
ok((await val("select public.abrir_turno($1, '1234')", [id("Nico")])).motivo === "muchos_intentos", "después de 5 errores se frena un rato");

panel = await val("select public.mover($1, $2, 'cocina', 'preparando')", [diego, p1.id]);
let p = panel.pedidos[0];
ok(p.partes.cocina.estado === "preparando" && p.partes.cocina.quien === id("Diego"), "Diego empieza la cocina (queda firmado)");
panel = await val("select public.mover($1, $2, 'cocina', 'preparando')", [carla, p1.id]);
ok(panel.pedidos[0].partes.cocina.quien === id("Diego"), "si otro toca lo mismo, no pisa");
panel = await val("select public.mover($1, $2, 'cocina', 'nuevo')", [carla, p1.id]);
ok(panel.pedidos[0].partes.cocina.estado === "preparando", "no se puede volver para atrás");
panel = await val("select public.mover($1, $2, 'barra', 'listo')", [martin, p1.id]);
ok(panel.pedidos[0].partes.barra.estado === "listo", "la barra avanza sola");
await falla("select public.mover('turno-trucho', $1, 'barra', 'entregado')", [p1.id], "turno_vencido");

console.log("Llamados y cuenta");
m = await val("select public.llamar($1, 'mozo', '{}')", [juanma]);
ok(m.ya === false && m.llamados.length === 1, "Juanma llama al mozo");
m = await val("select public.llamar($1, 'mozo', '{}')", [gaby]);
ok(m.ya === true && m.llamados.length === 1, "si Gaby llama también, no se duplica");
panel = await val("select public.atender($1, $2)", [carla, m.llamados[0].id]);
ok(panel.llamados[0].atendido.quien === id("Carla"), "Carla va (y queda firmado)");
panel = await val("select public.atender($1, $2)", [sofi, m.llamados[0].id]);
ok(panel.llamados[0].atendido.quien === id("Carla"), "si Sofi toca después, sigue siendo de Carla");
m = await val("select public.llamar($1, 'cuenta', $2::jsonb)", [gaby, JSON.stringify({ pago: "Mercado Pago", propina: 10, dividir: "cada-uno", total: 1 })]);
const cta = m.llamados.find(x => x.tipo === "cuenta");
ok(cta.total === Math.round(p1.total * 1.1), "la cuenta la calcula la base (con 10 % de propina): " + cta.total);
ok(cta.porPersona.length === 2 && cta.porPersona.reduce((s, x) => s + x.total, 0) === cta.total, "cada uno lo suyo: " + cta.porPersona.map(x => x.nombre + " " + x.total).join(", "));
m = await val("select public.llamar($1, 'cuenta', $2::jsonb)", [gaby, JSON.stringify({ pago: "Bitcoin", propina: 99, dividir: "igual", partes: 3 })]);
const cta2 = m.llamados.find(x => x.tipo === "cuenta" && !x.atendido);
ok(cta2.pago === "Efectivo" && cta2.propina === 0 && cta2.partes === 3, "medios y propinas inventados no pasan; en 3 partes");
panel = await val("select public.atender($1, $2)", [carla, cta2.id]);
ok(panel.llamados.find(x => x.id === cta2.id).toma === id("Carla"), "Carla lleva la cuenta");

console.log("Rechazar y cerrar");
await val("select public.sumar($1, 'fernet', null, 1)", [gaby]);
m = await val("select public.mandar($1, '')", [gaby]);
const p2 = m.pedidos.find(x => x.ronda === 2);
ok(p2.numero === 2 && Object.keys(p2.partes).join() === "barra", "ronda 2 (solo barra), pedido 2");
panel = await val("select public.rechazar($1, $2)", [martin, p2.id]);
ok(panel.pedidos.find(x => x.id === p2.id).rechazado.quien === id("Martín"), "Martín no la toma");
panel = await val("select public.rechazar($1, $2)", [diego, p1.id]);
ok(!panel.pedidos.find(x => x.id === p1.id).rechazado, "lo que ya se empezó no se puede rechazar");
panel = await val("select public.cerrar_mesa($1, 7)", [sofi]);
const s7 = panel.sesiones.find(x => x.mesa === 7);
ok(s7.cerrada && s7.total === p1.total && s7.cerradaPor === id("Sofi"), "Sofi cobra: la mesa queda cerrada con su total");
ok(panel.llamados.every(x => x.atendido), "y los llamados quedan resueltos");
m = await val("select public.mi_mesa($1)", [gaby]);
ok(m.sesion.cerrada !== null, "el celular de Gaby se entera de que se cerró");
await falla("select public.sumar($1, 'ipa', null, 1)", [gaby], "mesa_cerrada");
const e5 = await val("select public.entrar($1, 'Lara')", [C7]);
ok(e5.comensal.sesion !== e1.comensal.sesion && e5.mesa.comensales.length === 1, "el próximo que escanea abre la mesa de cero");
ok(s7.historia.length >= 10, "queda la historia de la mesa: " + s7.historia.length + " cosas");

console.log("Agotados");
panel = await val("select public.agotar($1, 'ipa', true)", [martin]);
ok(panel.agotados.some(a => a.id === "ipa"), "Martín marca la IPA como agotada");
await falla("select public.sumar($1, 'ipa', null, 1)", [e5.comensal.clave], "agotado");
ok((await val("select public.ver_mesa($1)", [C3])).agotados.includes("ipa"), "y todas las mesas lo ven");
await val("select public.agotar($1, 'ipa', false)", [martin]);

console.log("Números del día y avisos en vivo");
await val("select public.sumar($1, 'flan', null, 2)", [e5.comensal.clave]);
m = await val("select public.mandar($1, '')", [e5.comensal.clave]);
ok(m.pedidos[0].numero === 3, "el número sigue en el día: 3");
await db.query("update public.locales set numero_dia = current_date - 1");
const e6 = await val("select public.entrar($1, 'Ana')", [C3]);
await val("select public.sumar($1, 'flan', null, 1)", [e6.comensal.clave]);
m = await val("select public.mandar($1, '')", [e6.comensal.clave]);
ok(m.pedidos[0].numero === 1, "al otro día vuelve a 1");
const envios = (await db.query("select topic, count(*)::int n from realtime.enviados group by 1")).rows;
ok(envios.some(x => x.topic.startsWith("mesa-")) && envios.some(x => x.topic.startsWith("local-")), "cada cambio avisa a la mesa y al panel: " + envios.length + " canales");

console.log("Nadie entra por la puerta de atrás");
await db.query("select set_config('prueba.uid', '', false)");
await db.exec("set role anon");
await falla("select * from public.pedidos", [], "permission denied");
await falla("select * from public.comensales", [], "permission denied");
await falla("select public.panel_estado()", [], "permission denied");
await falla("select interno.estado_panel(null)", [], "permission denied");
ok((await val("select public.ver_mesa($1)", [C3])).mesa === 3, "pero sí puede ver la mesa con su código");
await db.exec("reset role");

console.log("\nTodo bien ✔");
