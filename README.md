# Carta Viva

Carta 3D para locales gastronómicos: el comensal escanea el QR de su mesa, ve cada plato en 3D,
lo arma a su gusto y lo pide desde el celular. Los de la mesa piden juntos, cada uno desde su
celular, y el equipo del local (mozos, cocina, barra y encargada) lo recibe en su panel.
Producto propio de **Gaby y Juanma** (arrancado el 26-sep-2026).

- Propuesta, decisiones y arquitectura: [`decisiones.md`](decisiones.md)
- Demo: local ficticio **Mordisco** (burgers, pizzas y birra), 13 platos y 12 mesas.

## Verla

- **Sin instalar nada:** abrir `vista-previa.html` con doble clic. Es toda la app en un solo archivo.
- **Desde el código** (necesita [Node](https://nodejs.org)): `npm start` y abrir http://localhost:5184

| Dirección | Qué es |
|---|---|
| `/?mesa=3` | la carta de la mesa 3, como si hubieras escaneado su QR (sin número: la mesa 7) |
| `/?mesa=3&nuevo` | otra persona en la misma mesa: abrila en otra pestaña y pidan juntos |
| `/#panel` | el panel del local: cada uno entra con su nombre y su PIN (en la demo, todos 1234) |

En la demo todo queda en el navegador y el resto del local se simula: Juli y Tomi comparten la
mesa 7 con vos, la cocina y la barra avanzan solas y otras mesas van pidiendo.

## Archivos

```
app/index.html            la app: la carta del comensal y el panel del local (#panel)
app/assets/local.js       TODO lo propio del local: carta, precios, armados, mesas, equipo y estaciones
app/assets/platos3d.js    los platos modelados por código, por capas
app/assets/escena.js      el escenario 3D (Three.js): un lienzo, un lugar por plato
app/assets/datos.js       mesas, comensales, pedidos, llamados y agotados (demo: en el navegador)
app/assets/simulacion.js  lo que se simula en la demo: Juli y Tomi, cocina, barra y otras mesas
app/assets/app.js         la carta: feed, armar, pedido de la mesa, seguimiento, mozo y cuenta
app/assets/panel.js       el panel del local: mesas, cocina, barra, carta (agotados) y QR
app/assets/estilos.css    estilos
supabase/esquema.sql      la base real (Supabase): tablas, reglas y funciones
supabase/semilla.js       arma semilla.sql (el local, su carta, mesas y equipo) a partir de local.js
supabase/pruebas.mjs      pruebas de la base en un Postgres local
herramientas/             servidor local y armado de vista-previa.html (sin dependencias)
vista-previa.html         todo en un solo archivo (se genera, no se edita)
```

## Comandos

```
npm start               la app en http://localhost:5184
npm run vista-previa    rearma vista-previa.html después de un cambio
npm run semilla         rearma supabase/semilla.sql después de cambiar local.js
npm install + npm test  prueba la base (esquema + semilla) en un Postgres local
```

## Estado (27-sep-2026)

- **Hecho:** la demo completa (varias personas por mesa, QR por mesa, cocina y barra, panel con
  PIN por persona). La base de Supabase está escrita y pasa las pruebas.
- **Falta:** conectar la app a Supabase (`datos-supabase.js`), la guía para publicarla y probarla
  con celulares de verdad.

## Sumar un plato

En `local.js`, dentro de `platos`: id, categoría, nombre, precio, color, descripción, sellos y
`modelo`. El modelo usa un tipo de `platos3d.js` (hamburguesa, pizza, papas, aros, flan, helado,
cheesecake, limonada, pinta, fernet). La tinta de los textos (oscura o crema) se elige sola
según el color del plato. Después: `npm run semilla` para que la base tenga el mismo precio.
