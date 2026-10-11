# Carta Viva

> **Este es el único repo del producto Carta Viva.** Lo trabajamos Gaby y Juanma. "Comilona" fue una demo
> publicada de Carta Viva (su repo `comilona` está archivado). Lo específico de un cliente va en el repo de ese
> cliente, no acá.
>
> **Cómo trabajamos:** [`CONTRIBUTING.md`](CONTRIBUTING.md) (ramas, commits, PRs) · **Por qué se decidió cada
> cosa:** [`decisiones.md`](decisiones.md) · **Planes para explicarle al cliente:**
> [`planes-para-el-cliente.md`](planes-para-el-cliente.md)

Carta viva para locales gastronómicos: el comensal escanea el QR de su mesa y ve cada plato de
verdad (la foto real recortada, que gira con el dedo; los postres y las bebidas tienen su juego),
mira qué tiene, lo arma a su gusto y lo pide desde el celular. También puede verse en 3D. Los de la mesa piden juntos, cada uno desde su
celular, y el equipo del local lo recibe en su panel: cada persona entra con su PIN y ve solo
lo que le toca (el dueño o el encargado eligen qué puede hacer cada uno). El que quiere se suma
al club del local con su mail (sin contraseña): suma sellos, gana premios y, cuando vuelve, la
carta lo saluda por su nombre y el mozo sabe quién es.
Producto propio de **Gaby y Juanma** (arrancado el 26-sep-2026).

- Propuesta, decisiones y arquitectura: [`decisiones.md`](decisiones.md)
- Demo: local ficticio **Mordisco** (burgers, pizzas y birra), 13 platos y 12 mesas.

## Verla

- **Sin instalar nada:** abrir `vista-previa.html` con doble clic. Es toda la app en un solo archivo
  (los cuadros de los giros y los juegos los lee de `app/assets/cuadros/`).
- **Desde el código** (necesita [Node](https://nodejs.org)): `npm start` y abrir http://localhost:5184

| Dirección | Qué es |
|---|---|
| `/?mesa=3` | la carta de la mesa 3, como si hubieras escaneado su QR (sin número: la mesa 7) |
| `/?mesa=3&nuevo` | otra persona en la misma mesa: abrila en otra pestaña y pidan juntos |
| `/#panel` | el panel del local: cada uno entra con su nombre y su PIN (en la demo, los de ejemplo tienen 1234) |
| `/#3d` · `/#fotos` | los platos en 3D o en fotos (también desde la cinta de arriba) |

En la demo todo queda en el navegador y el resto del local se simula: Juli y Tomi comparten la
mesa 7 con vos, la cocina y la barra avanzan solas y otras mesas van pidiendo. Si nadie mira la
demo, el local queda en pausa (así las horas siguen teniendo sentido al volver).

Arriba, la cinta de la demo cambia el estilo (Brasa, Jugo, Estudio), cómo se ven los platos
(**Fotos** o **3D**) y, con la cámara, prueba **tu foto** en el plato que estás viendo (sirve para
mostrarle a un local su propio plato; queda solo en ese celu). Las pizzas tienen su botón
**Video / 3D**: filmadas en ángulo y girando, o en 3D con la foto de arriba (un toque levanta una
porción con el queso estirado).

En el panel, "Probar como" cambia de persona: Carla (moza) no ve la cocina y le suena cuando
algo está listo; Diego ve solo la cocina; Rober (dueño) y Sofi (encargada) tienen **Clientes**
(los del club, sus premios y qué premio se da) y **Equipo**.

El club en la demo: en la bienvenida, "Sumarme" pide el mail y el código aparece en pantalla (no
se manda ningún mail). Pedí 10 cosas, liberá la mesa desde el panel y en el "gracias" ganás el
Flan; al volver a la carta te saluda y lo pedís gratis. Vale (mesa 5), Caro (mesa 2) y Fede
(mesa 9) son del club: en el plano tienen un aro dorado.

## Archivos

```
app/index.html            la app: la carta del comensal y el panel del local (#panel)
app/assets/local.js       TODO lo propio del local: carta, precios, armados, mesas, estaciones, puestos, equipo y club
app/assets/fotos.js       las fotos de cada plato y lo marcado en cada una (capas, ingredientes, giro, juego)
app/assets/fotos/         las fotos de los platos (color + alfa); ingredientes/: la de cada ingrediente
app/assets/cuadros/       los cuadros de los videos (giros de las burgers y aros, bebidas que se sirven, flan)
app/assets/escena-fotos.js  los platos en fotos: flotan, giran, "¿Qué tiene?" y "Armala" con la foto
app/assets/pizza3d.js     la pizza con grosor en 3D (con la foto de arriba): se carga solo si se elige
app/assets/recorte.js     saca el plato de la foto · cuadros.js: carga los cuadros · juegos.js: postres y bebidas
app/assets/platos3d.js    los platos modelados por código, por capas (solo en 3D)
app/assets/escena.js      el escenario 3D (Three.js): se carga solo si se eligen los platos en 3D
app/assets/datos.js       mesas, comensales, pedidos, llamados, agotados, equipo con permisos y el club (demo: en el navegador)
app/assets/simulacion.js  lo que se simula en la demo: Juli y Tomi, cocina, barra y otras mesas
app/assets/app.js         la carta: bienvenida, feed, armar, pedido de la mesa, seguimiento, mozo, cuenta y el club
app/assets/panel.js       el panel del local: para hacer, mesas, cocina, barra, carta (agotados), QR, clientes y equipo
app/assets/estilos.css    estilos
supabase/esquema.sql      la base real (Supabase): tablas, reglas y funciones
supabase/semilla.js       arma semilla.sql (el local, su carta, mesas y equipo) a partir de local.js
supabase/pruebas.mjs      pruebas de la base en un Postgres local
herramientas/             servidor local y armado de vista-previa.html (sin dependencias)
herramientas/taller/      pasa un video (el plato girando en fondo azul) a cuadros recortados
herramientas/recortes.html  revisa lo marcado en cada foto y cómo queda el recorte
mejoras/                  pruebas de fotos puntuales, aparte (las pizzas ya pasaron a la app)
vista-previa.html         todo en un solo archivo (se genera, no se edita)
```

## Comandos

```
npm start               la app en http://localhost:5184
npm run vista-previa    rearma vista-previa.html después de un cambio
npm run semilla         rearma supabase/semilla.sql después de cambiar local.js
npm run taller          el taller de fotos: http://localhost:5186/herramientas/taller/?v=clasica-giro.mp4
                        y http://localhost:5186/herramientas/recortes.html?p=clasica
npm install + npm test  prueba la base (esquema + semilla) en un Postgres local
```

## Estado (1-oct-2026)

- **Hecho:** la demo completa: los platos en fotos reales (giros, juegos, "¿Qué tiene?" y "Armala"
  con la foto) o en 3D, bienvenida al escanear el QR, varias personas por mesa,
  cocina y barra, panel con PIN y permisos por persona (sección Equipo), avisos que suenan y se
  apagan, deshacer, y el club (cuenta con mail sin contraseña, sellos, premios y clientes en el
  panel). La base de Supabase hace cumplir lo mismo y pasa las pruebas (149).
- **Falta:** conectar la app a Supabase (`datos-supabase.js`), la guía para publicarla y probarla
  con celulares de verdad (con el mail del código del club); avisos al celular del mozo con la
  app cerrada.

## Sumar un plato

En `local.js`, dentro de `platos`: id, categoría, nombre, precio, color, descripción, sellos y
`modelo`. Con fotos (lo de siempre), cada plato necesita su foto en `fotos.js`: la foto con fondo
transparente (`fotos/<plato>.jpg` + `-alfa.jpg`), lo que lleva (con la foto de cada ingrediente) y,
si se quiere, su giro (un video pasado a cuadros con el taller) o su juego. Para el 3D, el
modelo usa un tipo de `platos3d.js` (hamburguesa, pizza, papas, aros, flan, helado,
cheesecake, limonada, pinta, fernet). La tinta de los textos (oscura o crema) se elige sola
según el color del plato. Después: `npm run semilla` para que la base tenga el mismo precio.
