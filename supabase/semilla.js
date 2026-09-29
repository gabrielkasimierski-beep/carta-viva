/* =============================================================================
   CARTA VIVA — arma semilla.sql a partir de app/assets/local.js
   Así el local, la carta (con precios, armados y estaciones), las mesas y el equipo
   que se ven en la app son los mismos que usa la base para calcular precios.

   Uso (desde 06-Productos/carta-viva/):   node supabase/semilla.js
   Después: Supabase → SQL Editor → pegar supabase/semilla.sql → Run.
   Se puede volver a correr cuando cambie la carta: actualiza precios y platos, suma las
   mesas nuevas y NO toca los códigos QR ni los PIN que ya existen.
   ============================================================================= */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const aqui = __dirname;
const codigo = fs.readFileSync(path.join(aqui, "..", "app", "assets", "local.js"), "utf8");
const caja = { window: {} };
vm.runInNewContext(codigo, caja);
const L = caja.window.LOCAL;

const slug = (process.argv[2] || L.slug || L.nombre).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const txt = s => "'" + String(s ?? "").replace(/'/g, "''") + "'";

// Lo que necesita la base de la carta: nada de colores ni modelos 3D que no hagan falta
const carta = {
  categorias: L.categorias.map(({ id, nombre, estacion }) => ({ id, nombre, estacion: estacion || "cocina" })),
  estaciones: (L.estaciones || [{ id: "cocina", nombre: "Cocina" }]).map(({ id, nombre }) => ({ id, nombre })),
  platos: L.platos.map(p => ({
    id: p.id, categoria: p.categoria, nombre: p.nombre, precio: p.precio, armable: p.armable || null,
    modelo: { medallon: p.modelo.medallon, medallones: p.modelo.medallones, con: p.modelo.con, extras: p.modelo.extras },
  })),
  armados: L.armados,
  pagos: L.pagos,
  propinas: L.propinas,
  roles: L.roles || [],               // los puestos y sus permisos de entrada
};

const mesas = L.mesas.map(m => `(${m.n}, ${txt(m.zona)}, ${m.lugares})`).join(",\n    ");
const permisosDe = e => e.permisos || ((L.roles || []).find(r => r.id === e.rol) || { permisos: [] }).permisos;
const arreglo = xs => `array[${xs.map(txt).join(", ")}]::text[]`;
const equipo = (L.equipo || []).map((e, i) =>
  `(${txt(e.nombre)}, ${txt(e.rol)}, ${txt(e.puesto)}, ${e.zona ? txt(e.zona) : "null"}, ${txt(e.color)}, ${txt(e.pin || "1234")}, ${arreglo(permisosDe(e))}, ${i})`).join(",\n    ");

const sql = `-- =============================================================================
--  CARTA VIVA — ${L.nombre}: el local, su carta, sus mesas y su equipo
--  (archivo generado por supabase/semilla.js a partir de app/assets/local.js: no editar a mano)
-- =============================================================================
--  Correr DESPUÉS de esquema.sql. Se puede volver a correr cuando cambie la carta:
--  actualiza platos y precios, suma mesas nuevas y NO cambia los códigos QR ni los PIN.
-- =============================================================================

insert into public.locales (slug, nombre, carta)
values (${txt(slug)}, ${txt(L.nombre)}, ${txt(JSON.stringify(carta))}::jsonb)
on conflict (slug) do update set nombre = excluded.nombre, carta = excluded.carta;

insert into public.mesas (local_id, numero, zona, lugares)
select l.id, m.numero, m.zona, m.lugares
  from public.locales l, (values
    ${mesas}
  ) as m(numero, zona, lugares)
 where l.slug = ${txt(slug)}
on conflict (local_id, numero) do update set zona = excluded.zona, lugares = excluded.lugares;

-- El equipo de arranque. Los PIN de la demo son 1234: cambialos desde el panel (Equipo) o con
--   select interno.cambiar_pin(${txt(slug)}, 'Carla', '4821');
-- A quien ya existe no se lo toca: el equipo se maneja desde el panel.
insert into public.equipo (local_id, nombre, rol, puesto, zona, color, pin_sal, pin_hash, permisos, orden)
select l.id, e.nombre, e.rol, e.puesto, e.zona, e.color, s.sal, interno.hash_pin(s.sal, e.pin), e.permisos, e.orden
  from public.locales l, (values
    ${equipo}
  ) as e(nombre, rol, puesto, zona, color, pin, permisos, orden),
  lateral (select replace(gen_random_uuid()::text, '-', '') || e.nombre as sal) s
 where l.slug = ${txt(slug)}
on conflict (local_id, nombre) do nothing;

-- Bases de la versión anterior (sin permisos por persona): cada uno recibe los de su puesto
update public.equipo e set permisos = interno.permisos_rol(l.carta, e.rol)
  from public.locales l
 where e.local_id = l.id and l.slug = ${txt(slug)} and e.permisos = '{}';

-- Los códigos de las mesas (van en los QR):
select m.numero as mesa, m.zona, m.codigo from public.mesas m join public.locales l on l.id = m.local_id where l.slug = ${txt(slug)} order by m.numero;
`;

fs.writeFileSync(path.join(aqui, "semilla.sql"), sql);
console.log(`supabase/semilla.sql listo: ${L.nombre} (${slug}) · ${L.platos.length} platos · ${L.mesas.length} mesas · ${(L.equipo || []).length} personas del equipo`);
