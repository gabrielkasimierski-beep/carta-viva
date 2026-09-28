-- =============================================================================
--  CARTA VIVA — Mordisco: el local, su carta, sus mesas y su equipo
--  (archivo generado por supabase/semilla.js a partir de app/assets/local.js: no editar a mano)
-- =============================================================================
--  Correr DESPUÉS de esquema.sql. Se puede volver a correr cuando cambie la carta:
--  actualiza platos y precios, suma mesas nuevas y NO cambia los códigos QR ni los PIN.
-- =============================================================================

insert into public.locales (slug, nombre, carta)
values ('mordisco', 'Mordisco', '{"categorias":[{"id":"burgers","nombre":"Burgers","estacion":"cocina"},{"id":"pizzas","nombre":"Pizzas","estacion":"cocina"},{"id":"picar","nombre":"Para picar","estacion":"cocina"},{"id":"postres","nombre":"Postres","estacion":"cocina"},{"id":"bebidas","nombre":"Bebidas","estacion":"barra"}],"estaciones":[{"id":"cocina","nombre":"Cocina"},{"id":"barra","nombre":"Barra"}],"platos":[{"id":"clasica","categoria":"burgers","nombre":"La Clásica","precio":17500,"armable":"hamburguesa","modelo":{"medallon":"carne","medallones":1,"con":["lechuga","tomate","cebolla"]}},{"id":"doble-bacon","categoria":"burgers","nombre":"Doble Bacon","precio":21900,"armable":"hamburguesa","modelo":{"medallon":"carne","medallones":2,"con":[],"extras":["bacon"]}},{"id":"remolacha","categoria":"burgers","nombre":"La Remolacha","precio":16800,"armable":"hamburguesa","modelo":{"medallon":"remolacha","medallones":1,"con":["lechuga","tomate"]}},{"id":"pepperoni","categoria":"pizzas","nombre":"Pepperoni","precio":19500,"armable":null,"modelo":{}},{"id":"fugazzeta","categoria":"pizzas","nombre":"Fugazzeta","precio":18900,"armable":null,"modelo":{}},{"id":"papas-cheddar","categoria":"picar","nombre":"Papas con cheddar","precio":11900,"armable":null,"modelo":{}},{"id":"aros","categoria":"picar","nombre":"Aros de cebolla","precio":9800,"armable":null,"modelo":{}},{"id":"flan","categoria":"postres","nombre":"Flan casero","precio":7900,"armable":null,"modelo":{}},{"id":"helado","categoria":"postres","nombre":"Cucurucho","precio":8500,"armable":null,"modelo":{}},{"id":"cheesecake","categoria":"postres","nombre":"Cheesecake","precio":9200,"armable":null,"modelo":{}},{"id":"limonada","categoria":"bebidas","nombre":"Limonada","precio":6500,"armable":null,"modelo":{}},{"id":"ipa","categoria":"bebidas","nombre":"Pinta de IPA","precio":7800,"armable":null,"modelo":{}},{"id":"fernet","categoria":"bebidas","nombre":"Fernet con coca","precio":9500,"armable":null,"modelo":{}}],"armados":{"hamburguesa":[{"id":"medallones","titulo":"Medallones","tipo":"uno","items":[{"id":1,"nombre":"Simple","precio":0},{"id":2,"nombre":"Doble","precio":4200},{"id":3,"nombre":"Triple","precio":8400}]},{"id":"sacale","titulo":"Sacale","tipo":"varios","items":[{"id":"lechuga","nombre":"Lechuga"},{"id":"tomate","nombre":"Tomate"},{"id":"cebolla","nombre":"Cebolla"}]},{"id":"sumale","titulo":"Sumale","tipo":"varios","items":[{"id":"bacon","nombre":"Panceta","precio":2400},{"id":"huevo","nombre":"Huevo frito","precio":1500},{"id":"cheddar","nombre":"Cheddar extra","precio":1800}]},{"id":"punto","titulo":"Punto de la carne","tipo":"uno","items":[{"id":"jugosa","nombre":"Jugosa"},{"id":"a-punto","nombre":"A punto"},{"id":"cocida","nombre":"Bien cocida"}]}]},"pagos":["Efectivo","Tarjeta","Mercado Pago"],"propinas":[0,10,15]}'::jsonb)
on conflict (slug) do update set nombre = excluded.nombre, carta = excluded.carta;

insert into public.mesas (local_id, numero, zona, lugares)
select l.id, m.numero, m.zona, m.lugares
  from public.locales l, (values
    (1, 'Salón', 2),
    (2, 'Salón', 4),
    (3, 'Salón', 4),
    (4, 'Salón', 2),
    (5, 'Salón', 6),
    (6, 'Salón', 4),
    (7, 'Salón', 4),
    (8, 'Salón', 6),
    (9, 'Vereda', 2),
    (10, 'Vereda', 2),
    (11, 'Vereda', 4),
    (12, 'Vereda', 4)
  ) as m(numero, zona, lugares)
 where l.slug = 'mordisco'
on conflict (local_id, numero) do update set zona = excluded.zona, lugares = excluded.lugares;

-- El equipo. Los PIN de la demo son 1234: cambialos con
--   select interno.cambiar_pin('mordisco', 'Carla', '4821');
insert into public.equipo (local_id, nombre, rol, puesto, zona, color, pin_sal, pin_hash, orden)
select l.id, e.nombre, e.rol, e.puesto, e.zona, e.color, s.sal, interno.hash_pin(s.sal, e.pin), e.orden
  from public.locales l, (values
    ('Sofi', 'encargado', 'Encargada', null, '#C4A4FF', '1234', 0),
    ('Carla', 'mozo', 'Moza', 'Salón', '#7FD6FF', '1234', 1),
    ('Nico', 'mozo', 'Mozo', 'Vereda', '#8BE3B4', '1234', 2),
    ('Diego', 'cocina', 'Cocina', null, '#FFB27A', '1234', 3),
    ('Martín', 'barra', 'Barra', null, '#FFD86B', '1234', 4)
  ) as e(nombre, rol, puesto, zona, color, pin, orden),
  lateral (select replace(gen_random_uuid()::text, '-', '') || e.nombre as sal) s
 where l.slug = 'mordisco'
on conflict (local_id, nombre) do update set rol = excluded.rol, puesto = excluded.puesto, zona = excluded.zona, color = excluded.color, orden = excluded.orden;

-- Los códigos de las mesas (van en los QR):
select m.numero as mesa, m.zona, m.codigo from public.mesas m join public.locales l on l.id = m.local_id where l.slug = 'mordisco' order by m.numero;
