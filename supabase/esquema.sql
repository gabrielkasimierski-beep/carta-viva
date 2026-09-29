-- =============================================================================
--  CARTA VIVA — la base del local (Supabase)
-- =============================================================================
--  Cómo se usa:  Supabase → SQL Editor → New query → pegar TODO este archivo → Run.
--  Después, lo mismo con semilla.sql (el local, su carta, sus mesas y su equipo).
--  Se puede volver a correr: no borra pedidos ni mesas.
--
--  Quiénes la usan, todos a la vez:
--    · Los COMENSALES, sin cuenta: escanean el QR de su mesa (lleva un código secreto
--      por mesa) y desde ahí piden. Cada celular recibe una "clave" que es su llave:
--      solo puede ver y tocar lo de SU mesa mientras esté abierta.
--    · El EQUIPO: cada dispositivo del local entra con la cuenta del local (mail y
--      clave de Supabase) y cada persona se identifica con su PIN. Todo lo que hace
--      queda firmado con su nombre, y solo puede hacer lo que le permiten sus permisos
--      (los elige el dueño o el encargado desde el panel: ver las mesas, atender,
--      llevar, cobrar, cada estación, agotados, QR, manejar el equipo).
--
--  Nadie toca las tablas directo: todo pasa por las funciones de abajo, que validan
--  (precios los calcula la base, no el celular; si dos tocan lo mismo, gana uno).
--  Cada cambio avisa en vivo (Realtime) a la mesa y al panel del local.
-- =============================================================================

create schema if not exists interno;       -- funciones de uso interno: no se publican en la API


-- -----------------------------------------------------------------------------
--  1. Tablas
-- -----------------------------------------------------------------------------

create table if not exists public.locales (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  nombre      text not null,
  carta       jsonb not null default '{}'::jsonb,   -- platos, categorías, armados, estaciones, pagos y propinas (sale de local.js)
  canal       text not null default replace(gen_random_uuid()::text, '-', ''),   -- el canal en vivo del panel
  numero      integer not null default 0,           -- último número de pedido del día
  numero_dia  date,
  creado      timestamptz not null default now()
);

create table if not exists public.mesas (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid not null references public.locales on delete cascade,
  numero    integer not null,
  zona      text not null default '',
  lugares   integer not null default 4 check (lugares between 1 and 30),
  codigo    text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),   -- lo que lleva el QR
  unique (local_id, numero)
);

-- El equipo: cada persona con su puesto (rol) y lo que puede ver y hacer (permisos).
-- Los puestos y sus permisos de entrada están en la carta del local (roles, sale de local.js);
-- quien tiene el permiso "equipo" los ajusta persona por persona desde el panel.
create table if not exists public.equipo (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid not null references public.locales on delete cascade,
  nombre    text not null,
  rol       text not null check (rol ~ '^[a-z][a-z0-9-]{1,19}$'),
  puesto    text not null default '',
  zona      text,
  color     text not null default '#C4A4FF',
  pin_sal   text not null default replace(gen_random_uuid()::text, '-', ''),
  pin_hash  text not null,
  permisos  text[] not null default '{}',
  activo    boolean not null default true,
  orden     integer not null default 0,
  unique (local_id, nombre)
);
-- Para bases creadas con la versión anterior (puestos fijos y sin permisos por persona)
alter table public.equipo drop constraint if exists equipo_rol_check;
alter table public.equipo add constraint equipo_rol_check check (rol ~ '^[a-z][a-z0-9-]{1,19}$');
alter table public.equipo add column if not exists permisos text[] not null default '{}';

-- Qué cuentas (usuarios de Supabase Auth) pueden abrir el panel de qué local
create table if not exists public.cuentas (
  user_id   uuid primary key references auth.users on delete cascade,
  local_id  uuid not null references public.locales on delete cascade
);

-- Cada persona del equipo que entró con su PIN en un dispositivo
create table if not exists public.turnos (
  token      text primary key default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  equipo_id  uuid not null references public.equipo on delete cascade,
  local_id   uuid not null references public.locales on delete cascade,
  user_id    uuid,
  creado     timestamptz not null default now(),
  vence      timestamptz not null default now() + interval '16 hours'
);

create table if not exists public.intentos_pin (           -- para frenar a quien prueba PINs al azar
  equipo_id  uuid not null references public.equipo on delete cascade,
  t          timestamptz not null default now()
);

-- La mesa abierta: desde que alguien escanea el QR hasta que se cobra
create table if not exists public.sesiones (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references public.locales on delete cascade,
  mesa_id      uuid not null references public.mesas on delete cascade,
  mesa         integer not null,
  canal        text not null unique default replace(gen_random_uuid()::text, '-', ''),   -- el canal en vivo de la mesa (secreto)
  abierta      timestamptz not null default now(),
  cerrada      timestamptz,
  cerrada_por  uuid references public.equipo on delete set null,
  total        integer,
  historia     jsonb not null default '[]'::jsonb
);
create unique index if not exists una_sesion_abierta_por_mesa on public.sesiones (mesa_id) where cerrada is null;
create index if not exists sesiones_local on public.sesiones (local_id, cerrada);

create table if not exists public.comensales (
  id         uuid primary key default gen_random_uuid(),
  sesion_id  uuid not null references public.sesiones on delete cascade,
  clave      text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),   -- la llave del celular
  nombre     text not null,
  color      text not null,
  unido      timestamptz not null default now()
);
create index if not exists comensales_sesion on public.comensales (sesion_id);

-- Lo que la mesa va eligiendo (uno solo para toda la mesa; cada línea es de alguien)
create table if not exists public.carrito (
  id           uuid primary key default gen_random_uuid(),
  sesion_id    uuid not null references public.sesiones on delete cascade,
  comensal_id  uuid not null references public.comensales on delete cascade,
  plato        text not null,
  eleccion     jsonb,
  clave        text not null,
  detalle      text not null default '',
  precio       integer not null,
  cant         integer not null check (cant between 1 and 20),
  creado       timestamptz not null default now()
);
create index if not exists carrito_sesion on public.carrito (sesion_id);

-- Cada ronda que manda la mesa. items y partes van en JSON:
--   items:  [{plato, nombre, cant, precio, detalle, eleccion, comensal, estacion}]
--   partes: {cocina: {estado, cambio, quien}, barra: {...}}  — cada estación avanza sola
create table if not exists public.pedidos (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null references public.locales on delete cascade,
  sesion_id  uuid not null references public.sesiones on delete cascade,
  mesa       integer not null,
  numero     integer not null,
  ronda      integer not null,
  por        uuid references public.comensales on delete set null,
  nota       text not null default '',
  total      integer not null,
  items      jsonb not null,
  partes     jsonb not null,
  rechazado  jsonb,
  creado     timestamptz not null default now()
);
create index if not exists pedidos_sesion on public.pedidos (sesion_id);
create index if not exists pedidos_local on public.pedidos (local_id, creado);

create table if not exists public.llamados (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null references public.locales on delete cascade,
  sesion_id  uuid not null references public.sesiones on delete cascade,
  mesa       integer not null,
  tipo       text not null check (tipo in ('mozo', 'cuenta')),
  comensal   uuid references public.comensales on delete set null,
  datos      jsonb not null default '{}'::jsonb,   -- la cuenta: pago, propina, dividir, partes, total, porPersona
  toma       uuid references public.equipo on delete set null,
  tomado     timestamptz,
  atendido   jsonb,                                -- {quien, t}
  creado     timestamptz not null default now()
);
create index if not exists llamados_sesion on public.llamados (sesion_id);

create table if not exists public.agotados (
  local_id  uuid not null references public.locales on delete cascade,
  plato     text not null,
  quien     uuid references public.equipo on delete set null,
  t         timestamptz not null default now(),
  primary key (local_id, plato)
);

-- Nadie lee ni escribe las tablas directo: solo a través de las funciones.
alter table public.locales      enable row level security;
alter table public.mesas        enable row level security;
alter table public.equipo       enable row level security;
alter table public.cuentas      enable row level security;
alter table public.turnos       enable row level security;
alter table public.intentos_pin enable row level security;
alter table public.sesiones     enable row level security;
alter table public.comensales   enable row level security;
alter table public.carrito      enable row level security;
alter table public.pedidos      enable row level security;
alter table public.llamados     enable row level security;
alter table public.agotados     enable row level security;
revoke all on public.locales, public.mesas, public.equipo, public.cuentas, public.turnos, public.intentos_pin,
              public.sesiones, public.comensales, public.carrito, public.pedidos, public.llamados, public.agotados
  from anon, authenticated;


-- -----------------------------------------------------------------------------
--  2. Herramientas internas
-- -----------------------------------------------------------------------------

create or replace function interno.ms(t timestamptz) returns bigint
language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;

-- El día de hoy en Argentina (los números de pedido vuelven a 1 cada día)
create or replace function interno.hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;
create or replace function interno.desde_hoy() returns timestamptz
language sql stable as $$ select interno.hoy()::timestamp at time zone 'America/Argentina/Buenos_Aires' $$;

create or replace function interno.hash_pin(sal text, pin text) returns text
language sql immutable as $$ select encode(sha256(convert_to(sal || pin, 'UTF8')), 'hex') $$;

-- La carta: un plato, sus opciones de "Armala a tu gusto", su precio, su descripción y su estación.
-- Hacen lo mismo que gruposDe, precioDe y describir de app.js, así el precio lo decide la base.
create or replace function interno.plato(carta jsonb, id text) returns jsonb
language sql immutable as $$
  select x from jsonb_array_elements(coalesce(carta->'platos', '[]'::jsonb)) x where x->>'id' = id limit 1
$$;

create or replace function interno.grupos(carta jsonb, plato jsonb) returns jsonb
language plpgsql immutable as $$
declare
  modelo jsonb := coalesce(plato->'modelo', '{}'::jsonb);
  res jsonb := '[]'::jsonb;
  g jsonb;
  items jsonb;
begin
  if plato->>'armable' is null then return res; end if;
  for g in select * from jsonb_array_elements(coalesce(carta->'armados'->(plato->>'armable'), '[]'::jsonb)) loop
    if g->>'id' = 'punto' and coalesce(modelo->>'medallon', '') <> 'carne' then continue; end if;
    items := g->'items';
    if g->>'id' = 'sacale' then
      select coalesce(jsonb_agg(it), '[]'::jsonb) into items
        from jsonb_array_elements(g->'items') it where coalesce(modelo->'con', '[]'::jsonb) ? (it->>'id');
    elsif g->>'id' = 'sumale' then
      select coalesce(jsonb_agg(it), '[]'::jsonb) into items
        from jsonb_array_elements(g->'items') it where not (coalesce(modelo->'extras', '[]'::jsonb) ? (it->>'id'));
    end if;
    if jsonb_array_length(items) > 0 then res := res || jsonb_build_array(g || jsonb_build_object('items', items)); end if;
  end loop;
  return res;
end $$;

create or replace function interno.nombre_item(grupos jsonb, grupo text, item text) returns text
language sql immutable as $$
  select it->>'nombre' from jsonb_array_elements(grupos) g, jsonb_array_elements(g->'items') it
   where g->>'id' = grupo and it->>'id' = item limit 1
$$;

create or replace function interno.precio(carta jsonb, plato jsonb, eleccion jsonb) returns integer
language plpgsql immutable as $$
declare
  total integer := (plato->>'precio')::integer;
  g jsonb; base jsonb; elegido jsonb; x text;
begin
  if eleccion is null or plato->>'armable' is null then return total; end if;
  for g in select * from jsonb_array_elements(interno.grupos(carta, plato)) loop
    if g->>'id' = 'medallones' then
      select it into base from jsonb_array_elements(g->'items') it where it->>'id' = coalesce(plato->'modelo'->>'medallones', '1');
      select it into elegido from jsonb_array_elements(g->'items') it where it->>'id' = eleccion->>'medallones';
      elegido := coalesce(elegido, base);
      total := total + coalesce((elegido->>'precio')::integer, 0) - coalesce((base->>'precio')::integer, 0);
    elsif g->>'id' = 'sumale' and jsonb_typeof(eleccion->'sumale') = 'array' then
      for x in select distinct jsonb_array_elements_text(eleccion->'sumale') loop
        total := total + coalesce((select (it->>'precio')::integer from jsonb_array_elements(g->'items') it where it->>'id' = x), 0);
      end loop;
    end if;
  end loop;
  return total;
end $$;

create or replace function interno.detalle(carta jsonb, plato jsonb, eleccion jsonb) returns text
language plpgsql immutable as $$
declare
  grupos jsonb;
  partes text[] := '{}';
  x text; n text;
begin
  if eleccion is null or plato->>'armable' is null then return ''; end if;
  grupos := interno.grupos(carta, plato);
  if eleccion->>'medallones' is not null and eleccion->>'medallones' <> coalesce(plato->'modelo'->>'medallones', '1') then
    n := interno.nombre_item(grupos, 'medallones', eleccion->>'medallones');
    if n is not null then partes := partes || n; end if;
  end if;
  if jsonb_typeof(eleccion->'sacale') = 'array' then
    for x in select jsonb_array_elements_text(eleccion->'sacale') loop
      n := interno.nombre_item(grupos, 'sacale', x);
      if n is not null then partes := partes || ('sin ' || lower(n)); end if;
    end loop;
  end if;
  if jsonb_typeof(eleccion->'sumale') = 'array' then
    for x in select jsonb_array_elements_text(eleccion->'sumale') loop
      n := interno.nombre_item(grupos, 'sumale', x);
      if n is not null then partes := partes || ('+ ' || lower(n)); end if;
    end loop;
  end if;
  if eleccion->>'punto' is not null and eleccion->>'punto' <> 'a-punto' then
    n := interno.nombre_item(grupos, 'punto', eleccion->>'punto');
    if n is not null then partes := partes || lower(n); end if;
  end if;
  return array_to_string(partes, ' · ');
end $$;

create or replace function interno.estacion(carta jsonb, plato jsonb) returns text
language sql immutable as $$
  select coalesce((select c->>'estacion' from jsonb_array_elements(coalesce(carta->'categorias', '[]'::jsonb)) c
                    where c->>'id' = plato->>'categoria' limit 1), 'cocina')
$$;

create or replace function interno.nombre_estacion(carta jsonb, id text) returns text
language sql immutable as $$
  select coalesce((select e->>'nombre' from jsonb_array_elements(coalesce(carta->'estaciones', '[]'::jsonb)) e
                    where e->>'id' = id limit 1), id)
$$;

create or replace function interno.nombre_equipo(id uuid) returns text
language sql stable as $$ select coalesce((select nombre from public.equipo where equipo.id = nombre_equipo.id), 'Alguien del equipo') $$;

-- Lo que pasó en la mesa (lo ve el equipo en el detalle de cada mesa)
create or replace function interno.anotar(sesion uuid, texto text) returns void
language sql as $$
  update public.sesiones
     set historia = (case when jsonb_array_length(historia) >= 80 then historia - 0 else historia end)
                    || jsonb_build_array(jsonb_build_object('t', interno.ms(now()), 'texto', texto))
   where id = sesion
$$;
-- Lo que se deshizo no queda en la historia (se borra la última vez que se anotó)
create or replace function interno.desanotar(p_sesion uuid, p_texto text) returns void
language sql as $$
  update public.sesiones s
     set historia = s.historia - (select (e.i - 1)::integer from jsonb_array_elements(s.historia) with ordinality e(x, i)
                                   where e.x->>'texto' = p_texto order by e.i desc limit 1)
   where s.id = p_sesion
     and exists (select 1 from jsonb_array_elements(s.historia) e(x) where e.x->>'texto' = p_texto)
$$;

-- Permisos: los fijos más uno por estación de la carta (cocina, barra, ...)
create or replace function interno.permisos_validos(carta jsonb) returns text[]
language sql immutable as $$
  select array['mesas', 'atender', 'llevar', 'cobrar', 'carta', 'qr', 'equipo']::text[]
         || coalesce((select array_agg(e->>'id') from jsonb_array_elements(coalesce(carta->'estaciones', '[]'::jsonb)) e), '{}'::text[])
$$;
-- Los permisos de entrada de un puesto (según la carta del local)
create or replace function interno.permisos_rol(carta jsonb, rol text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct x), '{}'::text[])
    from jsonb_array_elements(coalesce(carta->'roles', '[]'::jsonb)) r, jsonb_array_elements_text(r->'permisos') x
   where r->>'id' = rol and x = any(interno.permisos_validos(carta))
$$;
create or replace function interno.puede(p_equipo uuid, p_permiso text) returns boolean
language sql stable as $$
  select exists (select 1 from public.equipo e where e.id = p_equipo and e.activo and p_permiso = any(e.permisos))
$$;
-- Si no tiene el permiso, no pasa (la app ya no le muestra el botón; esto es por las dudas)
create or replace function interno.exigir(p_equipo uuid, p_permiso text) returns void
language plpgsql stable as $$
begin
  if not interno.puede(p_equipo, p_permiso) then raise exception 'sin_permiso'; end if;
end $$;

-- "Algo cambió": aviso en vivo a los celulares de la mesa y al panel del local.
-- Si Realtime no está, no pasa nada: los celulares igual preguntan cada tanto.
create or replace function interno.avisar(p_local uuid, p_sesion uuid) returns void
language plpgsql as $$
declare v_canal text;
begin
  begin
    if p_sesion is not null then
      select canal into v_canal from public.sesiones where id = p_sesion;
      if v_canal is not null then perform realtime.send(jsonb_build_object('t', interno.ms(now())), 'cambio', 'mesa-' || v_canal, false); end if;
    end if;
    if p_local is not null then
      select canal into v_canal from public.locales where id = p_local;
      if v_canal is not null then perform realtime.send(jsonb_build_object('t', interno.ms(now())), 'cambio', 'local-' || v_canal, false); end if;
    end if;
  exception when others then null;
  end;
end $$;

-- Cómo sale cada cosa hacia la app (los mismos nombres que usa datos.js)
create or replace function interno.j_sesion(s public.sesiones, con_historia boolean) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', s.id, 'mesa', s.mesa, 'abierta', interno.ms(s.abierta), 'cerrada', interno.ms(s.cerrada),
           'cerradaPor', s.cerrada_por, 'total', s.total, 'canal', s.canal)
         || case when con_historia then jsonb_build_object('historia', s.historia) else '{}'::jsonb end
$$;
create or replace function interno.j_comensal(c public.comensales) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', c.id, 'sesion', c.sesion_id, 'nombre', c.nombre, 'color', c.color, 'unido', interno.ms(c.unido))
$$;
create or replace function interno.j_linea(l public.carrito) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', l.id, 'sesion', l.sesion_id, 'comensal', l.comensal_id, 'plato', l.plato, 'eleccion', l.eleccion,
           'detalle', l.detalle, 'precio', l.precio, 'clave', l.clave, 'cant', l.cant, 'creado', interno.ms(l.creado))
$$;
create or replace function interno.j_pedido(p public.pedidos) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', p.id, 'numero', p.numero, 'sesion', p.sesion_id, 'mesa', p.mesa, 'ronda', p.ronda, 'por', p.por,
           'creado', interno.ms(p.creado), 'items', p.items, 'nota', p.nota, 'total', p.total, 'partes', p.partes, 'rechazado', p.rechazado)
$$;
create or replace function interno.j_llamado(l public.llamados) returns jsonb
language sql immutable as $$
  select l.datos || jsonb_build_object('id', l.id, 'sesion', l.sesion_id, 'mesa', l.mesa, 'tipo', l.tipo, 'comensal', l.comensal,
           'creado', interno.ms(l.creado), 'toma', l.toma, 'tomado', interno.ms(l.tomado), 'atendido', l.atendido)
$$;

-- Todo lo de una mesa, para los celulares de esa mesa
create or replace function interno.estado_mesa(sesion uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'sesion',     interno.j_sesion(s, false),
    'comensales', coalesce((select jsonb_agg(interno.j_comensal(c) order by c.unido) from public.comensales c where c.sesion_id = s.id), '[]'::jsonb),
    'carrito',    coalesce((select jsonb_agg(interno.j_linea(l) order by l.creado) from public.carrito l where l.sesion_id = s.id), '[]'::jsonb),
    'pedidos',    coalesce((select jsonb_agg(interno.j_pedido(p) order by p.creado) from public.pedidos p where p.sesion_id = s.id), '[]'::jsonb),
    'llamados',   coalesce((select jsonb_agg(interno.j_llamado(l) order by l.creado) from public.llamados l where l.sesion_id = s.id), '[]'::jsonb),
    'agotados',   coalesce((select jsonb_agg(jsonb_build_object('id', a.plato, 't', interno.ms(a.t))) from public.agotados a where a.local_id = s.local_id), '[]'::jsonb),
    'equipo',     coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre)) from public.equipo e where e.local_id = s.local_id), '[]'::jsonb)
  )
  from public.sesiones s where s.id = sesion
$$;

-- Todo lo del local, para el panel: mesas abiertas y lo cobrado hoy
create or replace function interno.estado_panel(p_local uuid) returns jsonb
language sql stable as $$
  with ses as (
    select * from public.sesiones s where s.local_id = p_local and (s.cerrada is null or s.cerrada >= interno.desde_hoy())
  )
  select jsonb_build_object(
    'local',      (select jsonb_build_object('id', l.id, 'nombre', l.nombre, 'canal', l.canal) from public.locales l where l.id = p_local),
    'mesas',      coalesce((select jsonb_agg(jsonb_build_object('n', m.numero, 'zona', m.zona, 'lugares', m.lugares, 'codigo', m.codigo) order by m.numero) from public.mesas m where m.local_id = p_local), '[]'::jsonb),
    'equipo',     coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'puesto', e.puesto, 'zona', coalesce(e.zona, ''), 'color', e.color, 'permisos', to_jsonb(e.permisos)) order by e.orden, e.nombre) from public.equipo e where e.local_id = p_local and e.activo), '[]'::jsonb),
    'sesiones',   coalesce((select jsonb_agg(interno.j_sesion(s, true) order by s.abierta) from ses s), '[]'::jsonb),
    'comensales', coalesce((select jsonb_agg(interno.j_comensal(c) order by c.unido) from public.comensales c where c.sesion_id in (select id from ses)), '[]'::jsonb),
    'carrito',    coalesce((select jsonb_agg(interno.j_linea(l) order by l.creado) from public.carrito l where l.sesion_id in (select id from ses)), '[]'::jsonb),
    'pedidos',    coalesce((select jsonb_agg(interno.j_pedido(p) order by p.creado) from public.pedidos p where p.sesion_id in (select id from ses)), '[]'::jsonb),
    'llamados',   coalesce((select jsonb_agg(interno.j_llamado(l) order by l.creado) from public.llamados l where l.sesion_id in (select id from ses)), '[]'::jsonb),
    'agotados',   coalesce((select jsonb_agg(jsonb_build_object('id', a.plato, 'quien', a.quien, 't', interno.ms(a.t))) from public.agotados a where a.local_id = p_local), '[]'::jsonb)
  )
$$;

-- El comensal de esta clave, con su mesa. abierta = true exige que la mesa siga abierta.
create or replace function interno.comensal(p_clave text, p_abierta boolean default true) returns public.comensales
language plpgsql stable as $$
declare v_c public.comensales; v_cerrada timestamptz;
begin
  select * into v_c from public.comensales x where x.clave = p_clave;
  if not found then raise exception 'comensal_no_existe'; end if;
  if p_abierta then
    select s.cerrada into v_cerrada from public.sesiones s where s.id = v_c.sesion_id;
    if v_cerrada is not null then raise exception 'mesa_cerrada'; end if;
  end if;
  return v_c;
end $$;

-- La persona del equipo que está usando este dispositivo (y que el dispositivo sea del local)
create or replace function interno.turno(p_token text) returns public.turnos
language plpgsql stable as $$
declare v_t public.turnos;
begin
  select * into v_t from public.turnos x where x.token = p_token and x.vence > now()
     and exists (select 1 from public.equipo e where e.id = x.equipo_id and e.activo);
  if not found then raise exception 'turno_vencido'; end if;
  if not exists (select 1 from public.cuentas k where k.user_id = auth.uid() and k.local_id = v_t.local_id) then raise exception 'sin_permiso'; end if;
  return v_t;
end $$;

revoke all on all functions in schema interno from public;


-- -----------------------------------------------------------------------------
--  3. Lo que hace el comensal (sin cuenta: con el código del QR y su clave)
-- -----------------------------------------------------------------------------

-- Antes de entrar: qué mesa es y quiénes ya están sentados
create or replace function public.ver_mesa(p_codigo text) returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'mesa', m.numero, 'zona', m.zona, 'lugares', m.lugares, 'local', l.nombre,
    'gente', coalesce((select jsonb_agg(jsonb_build_object('nombre', c.nombre, 'color', c.color) order by c.unido)
                         from public.comensales c join public.sesiones s on s.id = c.sesion_id
                        where s.mesa_id = m.id and s.cerrada is null), '[]'::jsonb),
    'agotados', coalesce((select jsonb_agg(a.plato) from public.agotados a where a.local_id = m.local_id), '[]'::jsonb))
  from public.mesas m join public.locales l on l.id = m.local_id
  where m.codigo = p_codigo
$$;

-- Entrar a la mesa con un nombre (y el color que eligió, si está libre). Si la mesa está libre, se abre.
drop function if exists public.entrar(text, text);            -- la versión anterior, sin color
create or replace function public.entrar(p_codigo text, p_nombre text, p_color text default null) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_m public.mesas; v_s public.sesiones; v_c public.comensales;
  v_gente integer; v_nombre text; v_color text;
  v_colores text[] := array['#FF7A59', '#3DB2FF', '#FFC43D', '#A57BFF', '#2BC48A', '#FF6FB5'];
begin
  select * into v_m from public.mesas x where x.codigo = p_codigo;
  if not found then raise exception 'mesa_no_existe'; end if;
  select * into v_s from public.sesiones x where x.mesa_id = v_m.id and x.cerrada is null for update;
  if not found then
    begin
      insert into public.sesiones (local_id, mesa_id, mesa) values (v_m.local_id, v_m.id, v_m.numero) returning * into v_s;
    exception when unique_violation then                    -- otro la abrió en el mismo instante
      select * into v_s from public.sesiones x where x.mesa_id = v_m.id and x.cerrada is null for update;
    end;
  end if;
  select count(*) into v_gente from public.comensales x where x.sesion_id = v_s.id;
  if v_gente >= 30 then raise exception 'mesa_llena'; end if;
  v_nombre := left(regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g'), 20);
  if v_nombre = '' then v_nombre := 'Invitado ' || (v_gente + 1); end if;
  if exists (select 1 from public.comensales x where x.sesion_id = v_s.id and lower(x.nombre) = lower(v_nombre)) then
    v_nombre := v_nombre || ' ' || (v_gente + 1);
  end if;
  select u.col into v_color from unnest(v_colores) with ordinality as u(col, i)
   where u.col not in (select x.color from public.comensales x where x.sesion_id = v_s.id)
   order by (u.col = p_color) desc, u.i limit 1;                -- el que eligió, si nadie lo tiene
  v_color := coalesce(v_color, v_colores[1 + v_gente % 6]);
  insert into public.comensales (sesion_id, nombre, color) values (v_s.id, v_nombre, v_color) returning * into v_c;
  perform interno.anotar(v_s.id, case when v_gente = 0 then v_nombre || ' escaneó el QR y abrió la mesa' else v_nombre || ' se sumó a la mesa' end);
  perform interno.avisar(v_s.local_id, v_s.id);
  return jsonb_build_object('comensal', interno.j_comensal(v_c) || jsonb_build_object('clave', v_c.clave), 'mesa', interno.estado_mesa(v_s.id));
end $$;

-- Todo lo de mi mesa (también si ya se cobró: así el celular muestra el "gracias")
create or replace function public.mi_mesa(p_clave text) returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_c public.comensales;
begin
  v_c := interno.comensal(p_clave, false);
  return interno.estado_mesa(v_c.sesion_id);
end $$;

-- Sumar algo al pedido de la mesa (el precio lo calcula la base)
create or replace function public.sumar(p_clave text, p_plato text, p_eleccion jsonb default null, p_cant integer default 1) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_c public.comensales; v_s public.sesiones; v_carta jsonb; v_plato jsonb;
  v_eleccion jsonb := p_eleccion; v_detalle text; v_clave text; v_cant integer; v_linea public.carrito;
begin
  v_c := interno.comensal(p_clave);
  select * into v_s from public.sesiones x where x.id = v_c.sesion_id;
  select l.carta into v_carta from public.locales l where l.id = v_s.local_id;
  v_plato := interno.plato(v_carta, p_plato);
  if v_plato is null then raise exception 'plato_no_existe'; end if;
  if exists (select 1 from public.agotados a where a.local_id = v_s.local_id and a.plato = p_plato) then raise exception 'agotado'; end if;
  if v_eleccion is not null and (jsonb_typeof(v_eleccion) <> 'object' or length(v_eleccion::text) > 1000 or v_plato->>'armable' is null) then
    v_eleccion := null;
  end if;
  v_detalle := interno.detalle(v_carta, v_plato, v_eleccion);
  if v_detalle = '' then v_eleccion := null; end if;            -- armada igual que la de la carta: es la de la carta
  v_cant := greatest(1, least(20, coalesce(p_cant, 1)));
  v_clave := p_plato || coalesce(v_eleccion::text, '');
  select * into v_linea from public.carrito x where x.comensal_id = v_c.id and x.clave = v_clave for update;
  if found then
    update public.carrito x set cant = least(20, x.cant + v_cant) where x.id = v_linea.id;
  else
    insert into public.carrito (sesion_id, comensal_id, plato, eleccion, clave, detalle, precio, cant)
    values (v_s.id, v_c.id, p_plato, v_eleccion, v_clave, v_detalle, interno.precio(v_carta, v_plato, v_eleccion), v_cant);
  end if;
  perform interno.avisar(v_s.local_id, v_s.id);
  return interno.estado_mesa(v_s.id);
end $$;

-- Cambiar la cantidad de una línea propia (cada uno toca solo lo suyo)
create or replace function public.cantidad(p_clave text, p_linea uuid, p_delta integer) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_c public.comensales; v_linea public.carrito; v_local uuid;
begin
  v_c := interno.comensal(p_clave);
  select * into v_linea from public.carrito x where x.id = p_linea and x.comensal_id = v_c.id for update;
  if found then
    if v_linea.cant + p_delta <= 0 then delete from public.carrito x where x.id = v_linea.id;
    else update public.carrito x set cant = least(20, v_linea.cant + p_delta) where x.id = v_linea.id;
    end if;
  end if;
  select s.local_id into v_local from public.sesiones s where s.id = v_c.sesion_id;
  perform interno.avisar(v_local, v_c.sesion_id);
  return interno.estado_mesa(v_c.sesion_id);
end $$;

-- Mandar el pedido: sale todo lo que eligió la mesa, de todos, como una ronda
create or replace function public.mandar(p_clave text, p_nota text default '') returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_c public.comensales; v_s public.sesiones; v_carta jsonb;
  v_items jsonb; v_partes jsonb; v_ids uuid[]; v_total integer; v_quienes integer;
  v_numero integer; v_ronda integer; v_pedido uuid; v_ahora bigint := interno.ms(now());
begin
  v_c := interno.comensal(p_clave);
  select * into v_s from public.sesiones x where x.id = v_c.sesion_id for update;   -- de a un envío por mesa
  select l.carta into v_carta from public.locales l where l.id = v_s.local_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'plato', l.plato, 'nombre', interno.plato(v_carta, l.plato)->>'nombre', 'cant', l.cant, 'precio', l.precio,
           'detalle', l.detalle, 'eleccion', l.eleccion, 'comensal', l.comensal_id,
           'estacion', interno.estacion(v_carta, interno.plato(v_carta, l.plato))) order by l.creado), '[]'::jsonb),
         coalesce(sum(l.precio * l.cant), 0), count(distinct l.comensal_id), array_agg(l.id)
    into v_items, v_total, v_quienes, v_ids
    from public.carrito l
   where l.sesion_id = v_s.id
     and not exists (select 1 from public.agotados a where a.local_id = v_s.local_id and a.plato = l.plato);
  if jsonb_array_length(v_items) = 0 then raise exception 'nada_para_mandar'; end if;
  select jsonb_object_agg(q.e, jsonb_build_object('estado', 'nuevo', 'cambio', v_ahora, 'quien', null))
    into v_partes from (select distinct x->>'estacion' as e from jsonb_array_elements(v_items) x) q;
  update public.locales l
     set numero = case when l.numero_dia = interno.hoy() then l.numero + 1 else 1 end, numero_dia = interno.hoy()
   where l.id = v_s.local_id returning l.numero into v_numero;
  select count(*) + 1 into v_ronda from public.pedidos p where p.sesion_id = v_s.id;
  insert into public.pedidos (local_id, sesion_id, mesa, numero, ronda, por, nota, total, items, partes)
  values (v_s.local_id, v_s.id, v_s.mesa, v_numero, v_ronda, v_c.id, left(trim(coalesce(p_nota, '')), 200), v_total, v_items, v_partes)
  returning id into v_pedido;
  delete from public.carrito x where x.id = any(v_ids);
  perform interno.anotar(v_s.id, v_c.nombre || ' mandó la ronda ' || v_ronda || ' (pedido ' || v_numero || ')'
                                 || case when v_quienes > 1 then ', con lo de ' || v_quienes || ' personas' else '' end);
  perform interno.avisar(v_s.local_id, v_s.id);
  return interno.estado_mesa(v_s.id) || jsonb_build_object('pedido', v_pedido);
end $$;

-- Llamar al mozo o pedir la cuenta. La cuenta la calcula la base (consumo, propina, división).
create or replace function public.llamar(p_clave text, p_tipo text, p_datos jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_c public.comensales; v_s public.sesiones; v_carta jsonb; v_abierto public.llamados;
  v_pago text; v_propina integer; v_dividir text; v_partes integer; v_consumo integer; v_total integer;
  v_por jsonb; v_datos jsonb;
begin
  v_c := interno.comensal(p_clave);
  if p_tipo not in ('mozo', 'cuenta') then raise exception 'tipo_invalido'; end if;
  p_datos := coalesce(p_datos, '{}'::jsonb);
  select * into v_s from public.sesiones x where x.id = v_c.sesion_id for update;
  select * into v_abierto from public.llamados x where x.sesion_id = v_s.id and x.tipo = p_tipo and x.atendido is null order by x.creado desc limit 1;
  if p_tipo = 'mozo' then
    if v_abierto.id is not null then return interno.estado_mesa(v_s.id) || jsonb_build_object('ya', true); end if;
    insert into public.llamados (local_id, sesion_id, mesa, tipo, comensal) values (v_s.local_id, v_s.id, v_s.mesa, 'mozo', v_c.id);
    perform interno.anotar(v_s.id, v_c.nombre || ' llamó al mozo');
  else
    select l.carta into v_carta from public.locales l where l.id = v_s.local_id;
    v_pago := coalesce((select x from jsonb_array_elements_text(coalesce(v_carta->'pagos', '[]'::jsonb)) x where x = p_datos->>'pago' limit 1),
                       v_carta->'pagos'->>0, 'Efectivo');
    v_propina := coalesce((select x::integer from jsonb_array_elements_text(coalesce(v_carta->'propinas', '[]'::jsonb)) x where x = p_datos->>'propina' limit 1), 0);
    v_dividir := case when p_datos->>'dividir' in ('junto', 'igual', 'cada-uno') then p_datos->>'dividir' else 'junto' end;
    v_partes := greatest(2, least(30, case when p_datos->>'partes' ~ '^\d{1,3}$' then (p_datos->>'partes')::integer else 2 end));
    select coalesce(sum(p.total), 0) into v_consumo from public.pedidos p where p.sesion_id = v_s.id and p.rechazado is null;
    if v_consumo = 0 then raise exception 'sin_consumo'; end if;
    v_total := round(v_consumo * (1 + v_propina / 100.0));
    if v_dividir = 'cada-uno' then
      select coalesce(jsonb_agg(jsonb_build_object('comensal', q.comensal, 'nombre', k.nombre, 'total', round(q.sub * (1 + v_propina / 100.0))) order by k.unido), '[]'::jsonb)
        into v_por
        from (select (it->>'comensal')::uuid as comensal, sum((it->>'precio')::integer * (it->>'cant')::integer) as sub
                from public.pedidos p, jsonb_array_elements(p.items) it
               where p.sesion_id = v_s.id and p.rechazado is null group by 1) q
        join public.comensales k on k.id = q.comensal;
    end if;
    v_datos := jsonb_build_object('pago', v_pago, 'propina', v_propina, 'dividir', v_dividir, 'total', v_total,
                                  'partes', case when v_dividir = 'igual' then v_partes end, 'porPersona', v_por);
    if v_abierto.id is not null then delete from public.llamados x where x.id = v_abierto.id; end if;   -- se vuelve a pedir con los datos nuevos
    insert into public.llamados (local_id, sesion_id, mesa, tipo, comensal, datos, toma, tomado)
    values (v_s.local_id, v_s.id, v_s.mesa, 'cuenta', v_c.id, v_datos, v_abierto.toma, v_abierto.tomado);
    perform interno.anotar(v_s.id, v_c.nombre || ' pidió la cuenta: ' || v_pago || ', '
      || case when v_propina > 0 then v_propina || ' % de propina' else 'sin propina' end || ', '
      || case v_dividir when 'igual' then 'en partes iguales' when 'cada-uno' then 'cada uno lo suyo' else 'todo junto' end);
  end if;
  perform interno.avisar(v_s.local_id, v_s.id);
  return interno.estado_mesa(v_s.id) || jsonb_build_object('ya', false);
end $$;


-- -----------------------------------------------------------------------------
--  4. Lo que hace el equipo (dispositivo con la cuenta del local + PIN de cada uno)
-- -----------------------------------------------------------------------------

-- Todo lo del local para el panel (y el equipo, para elegir quién sos)
create or replace function public.panel_estado() returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v_local uuid;
begin
  select k.local_id into v_local from public.cuentas k where k.user_id = auth.uid();
  if v_local is null then raise exception 'sin_permiso'; end if;
  return interno.estado_panel(v_local);
end $$;

-- Entrar con el PIN: devuelve un turno que firma todo lo que haga esa persona en este dispositivo
create or replace function public.abrir_turno(p_equipo uuid, p_pin text) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_local uuid; v_e public.equipo; v_fallas integer; v_token text;
begin
  select k.local_id into v_local from public.cuentas k where k.user_id = auth.uid();
  if v_local is null then raise exception 'sin_permiso'; end if;
  select * into v_e from public.equipo x where x.id = p_equipo and x.local_id = v_local and x.activo;
  if not found then raise exception 'no_existe'; end if;
  select count(*) into v_fallas from public.intentos_pin x where x.equipo_id = v_e.id and x.t > now() - interval '5 minutes';
  if v_fallas >= 5 then return jsonb_build_object('ok', false, 'motivo', 'muchos_intentos'); end if;
  if interno.hash_pin(v_e.pin_sal, coalesce(p_pin, '')) <> v_e.pin_hash then
    insert into public.intentos_pin (equipo_id) values (v_e.id);
    return jsonb_build_object('ok', false, 'motivo', 'pin');
  end if;
  delete from public.turnos x where x.vence < now();
  delete from public.intentos_pin x where x.t < now() - interval '1 day';
  insert into public.turnos (equipo_id, local_id, user_id) values (v_e.id, v_local, auth.uid()) returning token into v_token;
  return jsonb_build_object('ok', true, 'turno', v_token, 'equipo', v_e.id);
end $$;

-- Cómo queda anotado cada paso en la historia de la mesa (mover y deshacer usan el mismo texto)
create or replace function interno.texto_paso(p_equipo uuid, p_estado text, p_ronda integer, carta jsonb, p_estacion text) returns text
language sql stable as $$
  select interno.nombre_equipo(p_equipo) || ' '
      || case p_estado when 'preparando' then 'empezó' when 'listo' then 'terminó' else 'llevó a la mesa' end
      || ' la ronda ' || p_ronda || ' · ' || interno.nombre_estacion(carta, p_estacion)
$$;

-- Avanzar la parte de una estación: nuevo → preparando → listo → entregado.
-- Empezar y terminar es de la estación (permiso "cocina", "barra"...); llevar a la mesa, de
-- quien lleva (permiso "llevar"). Si dos lo tocan a la vez, gana el primero y el segundo no
-- hace nada. Queda guardado cómo estaba, para poder deshacerlo durante 20 segundos.
create or replace function public.mover(p_turno text, p_pedido uuid, p_estacion text, p_estado text) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_t public.turnos; v_p public.pedidos; v_s public.sesiones; v_carta jsonb;
  v_orden text[] := array['nuevo', 'preparando', 'listo', 'entregado'];
begin
  v_t := interno.turno(p_turno);
  perform interno.exigir(v_t.equipo_id, case when p_estado = 'entregado' then 'llevar' else p_estacion end);
  select * into v_p from public.pedidos x where x.id = p_pedido and x.local_id = v_t.local_id for update;
  if not found then raise exception 'no_existe'; end if;
  select * into v_s from public.sesiones x where x.id = v_p.sesion_id;
  if v_s.cerrada is null and v_p.rechazado is null and v_p.partes ? p_estacion
     and coalesce(array_position(v_orden, p_estado), 0) > coalesce(array_position(v_orden, v_p.partes->p_estacion->>'estado'), 99) then
    update public.pedidos x
       set partes = jsonb_set(x.partes, array[p_estacion], jsonb_build_object(
             'estado', p_estado, 'cambio', interno.ms(now()), 'quien', v_t.equipo_id, 'aMano', true,
             'antes', (x.partes->p_estacion) - 'antes' - 'aMano'))
     where x.id = v_p.id;
    select l.carta into v_carta from public.locales l where l.id = v_t.local_id;
    perform interno.anotar(v_s.id, interno.texto_paso(v_t.equipo_id, p_estado, v_p.ronda, v_carta, p_estacion));
    perform interno.avisar(v_t.local_id, v_s.id);
  end if;
  return interno.estado_panel(v_t.local_id);
end $$;

-- Deshacer un paso tocado sin querer: solo quien lo hizo, antes de 20 segundos y si nadie lo
-- cambió después. Devuelve el panel con deshecho = true o false.
create or replace function public.deshacer_paso(p_turno text, p_pedido uuid, p_estacion text) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_t public.turnos; v_p public.pedidos; v_s public.sesiones; v_pa jsonb; v_carta jsonb;
begin
  v_t := interno.turno(p_turno);
  select * into v_p from public.pedidos x where x.id = p_pedido and x.local_id = v_t.local_id for update;
  if not found then raise exception 'no_existe'; end if;
  select * into v_s from public.sesiones x where x.id = v_p.sesion_id;
  v_pa := v_p.partes->p_estacion;
  if v_s.cerrada is null and v_pa ? 'antes' and v_pa->>'quien' = v_t.equipo_id::text
     and (v_pa->>'cambio')::bigint >= interno.ms(now()) - 20000 then
    update public.pedidos x set partes = jsonb_set(x.partes, array[p_estacion], (v_pa->'antes') || jsonb_build_object('aMano', true)) where x.id = v_p.id;
    select l.carta into v_carta from public.locales l where l.id = v_t.local_id;
    perform interno.desanotar(v_s.id, interno.texto_paso(v_t.equipo_id, v_pa->>'estado', v_p.ronda, v_carta, p_estacion));
    perform interno.avisar(v_t.local_id, v_s.id);
    return interno.estado_panel(v_t.local_id) || jsonb_build_object('deshecho', true);
  end if;
  return interno.estado_panel(v_t.local_id) || jsonb_build_object('deshecho', false);
end $$;

-- No tomar un pedido (por ejemplo, uno "en broma" de una mesa donde no hay nadie).
-- Lo puede hacer quien ve las mesas o quien trabaja en alguna estación de ese pedido.
create or replace function public.rechazar(p_turno text, p_pedido uuid) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_t public.turnos; v_p public.pedidos;
begin
  v_t := interno.turno(p_turno);
  select * into v_p from public.pedidos x where x.id = p_pedido and x.local_id = v_t.local_id for update;
  if not found then raise exception 'no_existe'; end if;
  if not interno.puede(v_t.equipo_id, 'mesas')
     and not exists (select 1 from jsonb_object_keys(v_p.partes) k where interno.puede(v_t.equipo_id, k)) then
    raise exception 'sin_permiso';
  end if;
  if v_p.rechazado is null and not exists (select 1 from jsonb_each(v_p.partes) e where e.value->>'estado' <> 'nuevo') then
    update public.pedidos x set rechazado = jsonb_build_object('quien', v_t.equipo_id, 't', interno.ms(now())) where x.id = v_p.id;
    perform interno.anotar(v_p.sesion_id, interno.nombre_equipo(v_t.equipo_id) || ' no tomó la ronda ' || v_p.ronda);
    perform interno.avisar(v_t.local_id, v_p.sesion_id);
  end if;
  return interno.estado_panel(v_t.local_id);
end $$;

-- "Voy" (al mozo, permiso "atender") o "Llevo la cuenta" (permiso "cobrar").
-- El primero que toca se la queda.
create or replace function public.atender(p_turno text, p_llamado uuid) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_t public.turnos; v_l public.llamados;
begin
  v_t := interno.turno(p_turno);
  select * into v_l from public.llamados x where x.id = p_llamado and x.local_id = v_t.local_id for update;
  if not found then raise exception 'no_existe'; end if;
  perform interno.exigir(v_t.equipo_id, case v_l.tipo when 'mozo' then 'atender' else 'cobrar' end);
  if v_l.atendido is null and v_l.tipo = 'mozo' then
    update public.llamados x set atendido = jsonb_build_object('quien', v_t.equipo_id, 't', interno.ms(now())) where x.id = v_l.id;
    perform interno.anotar(v_l.sesion_id, interno.nombre_equipo(v_t.equipo_id) || ' fue a la mesa');
    perform interno.avisar(v_t.local_id, v_l.sesion_id);
  elsif v_l.atendido is null and v_l.tipo = 'cuenta' and v_l.toma is null then
    update public.llamados x set toma = v_t.equipo_id, tomado = now() where x.id = v_l.id;
    perform interno.anotar(v_l.sesion_id, interno.nombre_equipo(v_t.equipo_id) || ' lleva la cuenta');
    perform interno.avisar(v_t.local_id, v_l.sesion_id);
  end if;
  return interno.estado_panel(v_t.local_id);
end $$;

-- Deshacer un "Voy" o un "Llevo la cuenta" tocado sin querer (quien lo tocó, antes de 20 segundos)
create or replace function public.deshacer_llamado(p_turno text, p_llamado uuid) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_t public.turnos; v_l public.llamados; v_cerrada timestamptz; v_hecho boolean := false;
begin
  v_t := interno.turno(p_turno);
  select * into v_l from public.llamados x where x.id = p_llamado and x.local_id = v_t.local_id for update;
  if not found then raise exception 'no_existe'; end if;
  select s.cerrada into v_cerrada from public.sesiones s where s.id = v_l.sesion_id;
  if v_cerrada is null and v_l.tipo = 'mozo' and v_l.atendido->>'quien' = v_t.equipo_id::text
     and (v_l.atendido->>'t')::bigint >= interno.ms(now()) - 20000 then
    update public.llamados x set atendido = null where x.id = v_l.id;
    perform interno.desanotar(v_l.sesion_id, interno.nombre_equipo(v_t.equipo_id) || ' fue a la mesa');
    v_hecho := true;
  elsif v_cerrada is null and v_l.tipo = 'cuenta' and v_l.atendido is null and v_l.toma = v_t.equipo_id
     and v_l.tomado >= now() - interval '20 seconds' then
    update public.llamados x set toma = null, tomado = null where x.id = v_l.id;
    perform interno.desanotar(v_l.sesion_id, interno.nombre_equipo(v_t.equipo_id) || ' lleva la cuenta');
    v_hecho := true;
  end if;
  if v_hecho then perform interno.avisar(v_t.local_id, v_l.sesion_id); end if;
  return interno.estado_panel(v_t.local_id) || jsonb_build_object('deshecho', v_hecho);
end $$;

-- Cobrada: la mesa se cierra y queda libre para los próximos (permiso "cobrar")
create or replace function public.cerrar_mesa(p_turno text, p_mesa integer) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_t public.turnos; v_s public.sesiones; v_ahora bigint := interno.ms(now());
begin
  v_t := interno.turno(p_turno);
  perform interno.exigir(v_t.equipo_id, 'cobrar');
  select * into v_s from public.sesiones x where x.local_id = v_t.local_id and x.mesa = p_mesa and x.cerrada is null for update;
  if found then
    update public.sesiones x
       set cerrada = now(), cerrada_por = v_t.equipo_id,
           total = (select coalesce(sum(p.total), 0) from public.pedidos p where p.sesion_id = v_s.id and p.rechazado is null)
     where x.id = v_s.id;
    delete from public.carrito x where x.sesion_id = v_s.id;
    update public.llamados x set atendido = jsonb_build_object('quien', v_t.equipo_id, 't', v_ahora) where x.sesion_id = v_s.id and x.atendido is null;
    perform interno.anotar(v_s.id, interno.nombre_equipo(v_t.equipo_id) || ' cobró y liberó la mesa');
    perform interno.avisar(v_t.local_id, v_s.id);
  end if;
  return interno.estado_panel(v_t.local_id);
end $$;

-- Marcar lo que se terminó: deja de poder pedirse en todas las mesas al instante (permiso "carta")
create or replace function public.agotar(p_turno text, p_plato text, p_si boolean) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_t public.turnos; v_s record;
begin
  v_t := interno.turno(p_turno);
  perform interno.exigir(v_t.equipo_id, 'carta');
  if p_si then
    insert into public.agotados (local_id, plato, quien) values (v_t.local_id, p_plato, v_t.equipo_id) on conflict do nothing;
  else
    delete from public.agotados a where a.local_id = v_t.local_id and a.plato = p_plato;
  end if;
  perform interno.avisar(v_t.local_id, null);
  for v_s in select x.id from public.sesiones x where x.local_id = v_t.local_id and x.cerrada is null loop   -- que lo vean todas las mesas
    perform interno.avisar(null, v_s.id);
  end loop;
  return interno.estado_panel(v_t.local_id);
end $$;


-- El equipo, desde el panel (permiso "equipo": el dueño y el encargado).
-- Reglas: un dueño solo lo cambia otro dueño; nadie se saca a sí mismo el permiso "equipo"
-- ni se da de baja a sí mismo. Los PIN nunca vuelven de la base: solo se guardan (con sal).
--   p_persona: {id (vacío = nueva), nombre, rol, zona, color, permisos: [...]}
create or replace function public.guardar_persona(p_turno text, p_persona jsonb, p_pin text default null) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_t public.turnos; v_yo public.equipo; v_e public.equipo; v_carta jsonb;
  v_id uuid; v_nombre text; v_rol text; v_puesto text; v_permisos text[]; v_zona text; v_color text; v_nueva boolean := false;
begin
  v_t := interno.turno(p_turno);
  select * into v_yo from public.equipo x where x.id = v_t.equipo_id;
  perform interno.exigir(v_yo.id, 'equipo');
  select l.carta into v_carta from public.locales l where l.id = v_t.local_id;
  v_id := case when coalesce(p_persona->>'id', '') ~ '^[0-9a-f-]{36}$' then (p_persona->>'id')::uuid end;
  if v_id is not null then
    select * into v_e from public.equipo x where x.id = v_id and x.local_id = v_t.local_id for update;
    if not found then raise exception 'no_existe'; end if;
    if v_e.rol = 'dueno' and v_yo.rol <> 'dueno' then raise exception 'solo_dueno'; end if;
  end if;
  v_nombre := left(regexp_replace(trim(coalesce(p_persona->>'nombre', '')), '\s+', ' ', 'g'), 20);
  if v_nombre = '' then raise exception 'nombre'; end if;
  v_rol := p_persona->>'rol';
  select r->>'nombre' into v_puesto from jsonb_array_elements(coalesce(v_carta->'roles', '[]'::jsonb)) r where r->>'id' = v_rol;
  if v_puesto is null then raise exception 'rol'; end if;
  if v_rol = 'dueno' and v_yo.rol <> 'dueno' then raise exception 'solo_dueno'; end if;
  if jsonb_typeof(p_persona->'permisos') = 'array' then
    select coalesce(array_agg(distinct x), '{}'::text[]) into v_permisos
      from jsonb_array_elements_text(p_persona->'permisos') x where x = any(interno.permisos_validos(v_carta));
  else
    v_permisos := interno.permisos_rol(v_carta, v_rol);
  end if;
  if v_id = v_yo.id and not ('equipo' = any(v_permisos)) then raise exception 'tu_permiso'; end if;
  v_zona := left(coalesce(p_persona->>'zona', ''), 30);
  v_color := case when p_persona->>'color' ~ '^#[0-9A-Fa-f]{6}$' then p_persona->>'color' end;
  if v_id is null then
    if coalesce(p_pin, '') !~ '^\d{4}$' then raise exception 'pin'; end if;
    if exists (select 1 from public.equipo x where x.local_id = v_t.local_id and x.activo and lower(x.nombre) = lower(v_nombre)) then
      raise exception 'nombre_repetido';
    end if;
    -- Si alguien con ese nombre estaba dado de baja, vuelve (con su historia)
    select * into v_e from public.equipo x where x.local_id = v_t.local_id and not x.activo and lower(x.nombre) = lower(v_nombre) limit 1 for update;
    if not found then
      insert into public.equipo (local_id, nombre, rol, puesto, pin_hash, orden)
      values (v_t.local_id, v_nombre, v_rol, '', '-', (select coalesce(max(x.orden), 0) + 1 from public.equipo x where x.local_id = v_t.local_id))
      returning * into v_e;
    end if;
    v_id := v_e.id;
    v_nueva := true;
    update public.equipo x set pin_sal = s.sal, pin_hash = interno.hash_pin(s.sal, p_pin)
      from (select replace(gen_random_uuid()::text, '-', '') as sal) s where x.id = v_id;
  elsif exists (select 1 from public.equipo x where x.local_id = v_t.local_id and x.id <> v_id and lower(x.nombre) = lower(v_nombre)) then
    raise exception 'nombre_repetido';
  end if;
  update public.equipo x
     set nombre = v_nombre, rol = v_rol,
         puesto = case when x.rol = v_rol and x.puesto <> '' and not v_nueva then x.puesto else v_puesto end,
         zona = v_zona, color = coalesce(v_color, x.color), permisos = v_permisos, activo = true
   where x.id = v_id;
  perform interno.avisar(v_t.local_id, null);
  return interno.estado_panel(v_t.local_id) || jsonb_build_object('persona', v_id);
end $$;

-- Un PIN nuevo: se lo da quien maneja el equipo (con la regla del dueño) o cada uno a sí mismo
create or replace function public.nuevo_pin(p_turno text, p_equipo uuid, p_pin text) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_t public.turnos; v_yo public.equipo; v_e public.equipo;
begin
  v_t := interno.turno(p_turno);
  select * into v_yo from public.equipo x where x.id = v_t.equipo_id;
  select * into v_e from public.equipo x where x.id = p_equipo and x.local_id = v_t.local_id and x.activo for update;
  if not found then raise exception 'no_existe'; end if;
  if v_e.id <> v_yo.id then
    perform interno.exigir(v_yo.id, 'equipo');
    if v_e.rol = 'dueno' and v_yo.rol <> 'dueno' then raise exception 'solo_dueno'; end if;
  end if;
  if coalesce(p_pin, '') !~ '^\d{4}$' then raise exception 'pin'; end if;
  update public.equipo x set pin_sal = s.sal, pin_hash = interno.hash_pin(s.sal, p_pin)
    from (select replace(gen_random_uuid()::text, '-', '') as sal) s where x.id = v_e.id;
  delete from public.intentos_pin x where x.equipo_id = v_e.id;
  return jsonb_build_object('ok', true);
end $$;

-- Dar de baja: ya no aparece para entrar y se cierran sus turnos abiertos. Lo que hizo queda firmado.
create or replace function public.baja_persona(p_turno text, p_equipo uuid) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare v_t public.turnos; v_yo public.equipo; v_e public.equipo;
begin
  v_t := interno.turno(p_turno);
  select * into v_yo from public.equipo x where x.id = v_t.equipo_id;
  perform interno.exigir(v_yo.id, 'equipo');
  select * into v_e from public.equipo x where x.id = p_equipo and x.local_id = v_t.local_id and x.activo for update;
  if not found then raise exception 'no_existe'; end if;
  if v_e.id = v_yo.id then raise exception 'vos'; end if;
  if v_e.rol = 'dueno' and v_yo.rol <> 'dueno' then raise exception 'solo_dueno'; end if;
  update public.equipo x set activo = false where x.id = v_e.id;
  delete from public.turnos x where x.equipo_id = v_e.id;
  perform interno.avisar(v_t.local_id, null);
  return interno.estado_panel(v_t.local_id);
end $$;


-- -----------------------------------------------------------------------------
--  5. Para la encargada, desde el SQL Editor
-- -----------------------------------------------------------------------------

-- Cambiar el PIN de alguien:   select interno.cambiar_pin('mordisco', 'Carla', '4821');
create or replace function interno.cambiar_pin(slug text, nombre text, pin text) returns text
language plpgsql as $$
declare n integer;
begin
  if pin !~ '^\d{4}$' then raise exception 'El PIN tiene que ser de 4 números'; end if;
  update public.equipo e set pin_sal = x.sal, pin_hash = interno.hash_pin(x.sal, pin)
    from (select replace(gen_random_uuid()::text, '-', '') as sal) x, public.locales l
   where e.local_id = l.id and l.slug = cambiar_pin.slug and lower(e.nombre) = lower(cambiar_pin.nombre);
  get diagnostics n = row_count;
  return case when n = 1 then 'Listo: PIN cambiado' else 'No encontré a ' || nombre end;
end $$;

-- Dar acceso al panel a una cuenta:   select interno.dar_panel('mordisco', 'elmail@dellocal.com');
create or replace function interno.dar_panel(slug text, email text) returns text
language plpgsql as $$
declare u uuid; l uuid;
begin
  select id into u from auth.users where lower(auth.users.email) = lower(dar_panel.email);
  if u is null then return 'Primero creá el usuario en Authentication → Users'; end if;
  select id into l from public.locales where locales.slug = dar_panel.slug;
  if l is null then return 'No existe el local ' || slug; end if;
  insert into public.cuentas (user_id, local_id) values (u, l) on conflict (user_id) do update set local_id = excluded.local_id;
  return 'Listo: ' || email || ' ya puede abrir el panel';
end $$;


-- -----------------------------------------------------------------------------
--  6. Quién puede llamar a qué
-- -----------------------------------------------------------------------------

revoke all on function public.ver_mesa(text)                               from public;
revoke all on function public.entrar(text, text, text)                     from public;
revoke all on function public.mi_mesa(text)                                from public;
revoke all on function public.sumar(text, text, jsonb, integer)            from public;
revoke all on function public.cantidad(text, uuid, integer)                from public;
revoke all on function public.mandar(text, text)                           from public;
revoke all on function public.llamar(text, text, jsonb)                    from public;
revoke all on function public.panel_estado()                               from public, anon;
revoke all on function public.abrir_turno(uuid, text)                      from public, anon;
revoke all on function public.mover(text, uuid, text, text)                from public, anon;
revoke all on function public.deshacer_paso(text, uuid, text)              from public, anon;
revoke all on function public.rechazar(text, uuid)                         from public, anon;
revoke all on function public.atender(text, uuid)                          from public, anon;
revoke all on function public.deshacer_llamado(text, uuid)                 from public, anon;
revoke all on function public.cerrar_mesa(text, integer)                   from public, anon;
revoke all on function public.agotar(text, text, boolean)                  from public, anon;
revoke all on function public.guardar_persona(text, jsonb, text)           from public, anon;
revoke all on function public.nuevo_pin(text, uuid, text)                  from public, anon;
revoke all on function public.baja_persona(text, uuid)                     from public, anon;
revoke all on all functions in schema interno                              from public, anon, authenticated;

-- Los comensales (sin cuenta)
grant execute on function public.ver_mesa(text)                    to anon, authenticated;
grant execute on function public.entrar(text, text, text)          to anon, authenticated;
grant execute on function public.mi_mesa(text)                     to anon, authenticated;
grant execute on function public.sumar(text, text, jsonb, integer) to anon, authenticated;
grant execute on function public.cantidad(text, uuid, integer)     to anon, authenticated;
grant execute on function public.mandar(text, text)                to anon, authenticated;
grant execute on function public.llamar(text, text, jsonb)         to anon, authenticated;
-- El equipo (con la cuenta del local)
grant execute on function public.panel_estado()                    to authenticated;
grant execute on function public.abrir_turno(uuid, text)           to authenticated;
grant execute on function public.mover(text, uuid, text, text)     to authenticated;
grant execute on function public.deshacer_paso(text, uuid, text)   to authenticated;
grant execute on function public.rechazar(text, uuid)              to authenticated;
grant execute on function public.atender(text, uuid)               to authenticated;
grant execute on function public.deshacer_llamado(text, uuid)      to authenticated;
grant execute on function public.cerrar_mesa(text, integer)        to authenticated;
grant execute on function public.agotar(text, text, boolean)       to authenticated;
grant execute on function public.guardar_persona(text, jsonb, text) to authenticated;
grant execute on function public.nuevo_pin(text, uuid, text)       to authenticated;
grant execute on function public.baja_persona(text, uuid)          to authenticated;
