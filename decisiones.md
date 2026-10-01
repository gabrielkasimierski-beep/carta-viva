# Carta Viva — propuesta para arrancar con Juanma

**Fecha:** 26-sep-2026 (actualizado el 27-sep) · **Quiénes:** Gaby + Juanma · **Estado:** demo navegable con un local ficticio
**Nombre:** "Carta Viva" es de trabajo, se cambia cuando quieran.

> **La idea en una línea:** la carta del local en el celular del comensal, con cada plato en
> 3D. Lo gira con el dedo, ve qué tiene capa por capa, lo arma a su gusto y lo pide desde la
> mesa. La cocina lo recibe al instante y el comensal ve cómo avanza.

---

## 1. Qué tiene la demo (Mordisco, local ficticio)

| Parte | Qué hace |
|---|---|
| **La carta** | Un plato por pantalla, como un feed: se desliza para arriba. Cada plato tiene su color y al deslizar cambia todo el mundo de color. Atrás, la palabra de la sección en gigante. |
| **El plato en 3D** | Flota y gira solo; con el dedo se gira para cualquier lado; un toque y pega un saltito. La luz de atrás toma el color del plato. |
| **¿Qué tiene?** | El plato se desarma en el aire, capa por capa, con el nombre de cada una (pan, medallón, cheddar…). |
| **Armala a tu gusto** (burgers) | Simple/doble/triple, sacale, sumale, punto de la carne. **El 3D cambia en vivo** (aparece el huevo, se suma el medallón) y el precio también. |
| **Tu pedido** | El plato "vuela" al pedido. Cantidades, nota para la cocina, mandar. |
| **Seguimiento** | Recibido → En la cocina → Listo → En tu mesa, con aviso cuando cambia. |
| **Mozo y cuenta** | Llamar al mozo. Pedir la cuenta eligiendo cómo pagan (efectivo, tarjeta, Mercado Pago) y la propina. |
| **Panel de la cocina** | Pedidos en columnas (nuevos, en la cocina, para llevar), mesas que llaman o piden la cuenta, y la carta para marcar **agotado**: deja de poder pedirse en todas las mesas al instante. |

**Cómo funciona la demo por dentro:** todo queda en el navegador (la base real ya está escrita,
falta conectarla) y el resto del local se simula: Juli y Tomi en la Mesa 7, la cocina, la barra
y otras mesas. Los platos están **modelados por código** (13 platos, estilo ilustrado); no son
escaneos.

### Diseño: tres estilos para elegir (26-sep-2026)

A Gaby le gustó cómo aparecen los platos y la idea de un color por plato, pero no el diseño
de la primera versión (fondos planos de colores caramelo). Ahora **el color sale del plato**
(remolacha → magenta, pepperoni → albahaca y tomate, fernet → marrón) y hay tres estilos para
probar en el mismo link, con la cinta de arriba:

| Estilo | Cómo usa el color del plato | Letra |
|---|---|---|
| **Brasa** | Fondo oscuro del tono del plato, con una luz de su color detrás y chispas que suben. El plato se ilumina de ese color. | Instrument Serif itálica + Onest |
| **Jugo** | Degradé vivo hecho con los colores del plato, con grano; la info en una tarjeta de vidrio. | Unbounded + Onest |
| **Estudio** | Fondo de foto de producto (pared y piso) en el tono del plato; carteles de "¿Qué tiene?" como plano técnico. | Archivo ancha + DM Mono |

El estilo se fija en `local.js` (`estilo`). Cuando Gaby elija, se deja uno (o se ofrecen los
tres a cada local).

### Panel del local: el plano de mesas (26-sep-2026)

A Gaby no le gustó cómo se veían las mesas en el panel (había quedado con el diseño viejo y
solo mostraba tarjetas de pedidos). Ahora el panel tiene tres vistas:
- **Mesas:** el plano del salón y la vereda, cada mesa vista desde arriba con sus sillas y su
  estado (libre, pidió, en la cocina, para llevar, comiendo). Las que llaman al mozo o piden la
  cuenta titilan y aparecen arriba con un botón para atenderlas. Tocando una mesa se ven sus
  pedidos, lo consumido, la propina y el total; **"Cobrada · liberar la mesa"** (con doble toque)
  la deja libre y el celular de esa mesa vuelve a empezar de cero.
- **Cocina:** las comandas como tickets de papel, con reloj que se pone amarillo a los 10 min y
  rojo a los 20.
- **Carta:** interruptor de hay / agotado por plato.

Las mesas del local (número, zona y lugares) se cargan en `local.js` (`mesas`).

### Varias personas a la vez y QR por mesa (27-sep-2026)

Pedido de Gaby: que lo pueda usar un local de verdad, con muchos comensales y todo el equipo al
mismo tiempo, y que la gente entre escaneando un código en la mesa.
- **QR por mesa.** Al escanearlo se abre la carta de esa mesa y pide el nombre ("Ya están Juli
  y Tomi"). Cada uno queda con su color.
- **Un solo pedido por mesa.** Cada uno suma desde su celular, todos ven lo de los demás al
  instante y cualquiera lo manda. Se pide en rondas.
- **Cocina y barra por separado.** Cada ronda se parte por estación y cada parte avanza sola:
  las bebidas pueden llegar antes que la comida.
- **Mozo y cuenta.** Un solo llamado aunque llamen dos, y la mesa ve quién va. La cuenta se pide
  todo junto, en partes iguales o cada uno lo suyo (con su parte de la propina).
- **El equipo.** Cada uno entra al panel con su nombre y un PIN de 4 números, y ve primero lo
  suyo (mozos: su zona; cocina y barra: sus comandas; encargada: todo). Todo queda firmado y, si
  dos tocan lo mismo a la vez, vale el primero.
- **QR para imprimir** en el panel: una tarjeta por mesa.

Las personas del equipo y las estaciones también se cargan en `local.js` (`equipo`, `estaciones`).

### El equipo con permisos, la bienvenida y las horas pico (29-sep-2026)

Pedido de Gaby (con Juanma): que el dueño o el encargado cree los usuarios y le dé a cada uno
permiso para ver y hacer lo de su puesto (el mozo no entra a la cocina: le aparece cuando la
comida está hecha); una bienvenida interactiva al escanear el QR; que "pide la cuenta" se vea
más; arreglar las horas que no coincidían; y pensar todo para el ritmo de las horas pico.
- **Equipo, en el panel.** El dueño o el encargado suman personas, les dan un PIN y eligen qué
  ve y hace cada una. Cada puesto trae sus permisos de entrada (Dueño/a, Encargado/a, Mozo/a,
  Cocina, Barra, Caja) y se ajustan persona por persona: ver las mesas, atender llamados,
  llevar, cobrar, cada estación, agotados, QR y manejar el equipo. A un dueño lo cambia solo
  otro dueño; nadie se saca a sí mismo el permiso de manejar el equipo; el PIN se muestra una
  sola vez; dar de baja saca a la persona del panel aunque esté adentro.
- **El mozo no ve la cocina.** Cuando algo está listo le aparece "¡Sale! Mesa 9" arriba de todo,
  con sonido, vibración y el botón "Llevado". La cocina y la barra empiezan y terminan; llevar a
  la mesa es de quien tiene el permiso "llevar".
- **Las horas que no coincidían.** Era de la demo: guarda todo en el navegador y, al volver horas
  después, la cocina simulada terminaba de golpe lo pendiente con la hora de ese momento,
  mezclada con las horas viejas (por eso "empezó 21:40, terminó 10:15" o mesas con "35 h").
  Ahora, si nadie mira la demo, el local queda en pausa y al volver todo se corre junto; si
  pasaron más de 6 horas, arranca un servicio nuevo con el mismo equipo. En la versión real no
  pasa: las horas las pone la base.
- **Bienvenida al escanear el QR.** El plato de la carta aparece en el medio y se arma solo; se
  gira con el dedo y salta con un toque. El saludo va según la hora y se completa con tu nombre
  mientras lo escribís, elegís tu color, ves quiénes ya están (y qué pidieron) y al entrar el
  plato vuelve volando a su lugar en la carta.
- **"Pide la cuenta" y "llama al mozo"**: una franja de color al costado de la mesa que sobresale
  por arriba, con los minutos que lleva esperando.
- **Para las horas pico.** Arriba de todo, "Para hacer ahora" (lo de tu zona primero y en rojo lo
  que espera de más); un sonido distinto para cada cosa; lo tocado sin querer se deshace durante
  20 segundos; en la cocina, "A preparar" suma todo lo pendiente (para hacer de a tandas), la
  pantalla no se apaga y los botones son grandes.

La base real (`supabase/esquema.sql`) hace cumplir lo mismo: permisos, equipo y deshacer.

### El club: la cuenta con el mail, los premios y volver (30-sep-2026)

Pedido de Gaby: que cada comensal, al escanear el QR, pueda crear su usuario con su mail y sin
contraseña (su propia identidad); que al consumir cierta cantidad de cosas gane un premio y que
quede registrado; y que al volver sienta familiaridad con el local.
- **Sumarse es opcional y sin contraseña.** En la bienvenida (y en el pedido, el seguimiento y
  el "gracias") está "Club Mordisco: cada 10 cosas, un Flan casero de regalo". Deja su mail y le
  llega un código de 6 números; con eso entra. El celu queda adentro: la próxima vez lo
  reconoce solo. Desde otro celu, otro código. Si ya era del club, entra con el mismo mail.
  En la demo no se manda ningún mail: el código aparece en pantalla.
- **Su identidad:** su nombre y su color (los de la mesa), lo que más pide, sus visitas y sus
  premios. Los del club tienen un aro dorado en su inicial, en la mesa y en el panel.
- **Los sellos.** Cuando se cobra la mesa, cada cosa que pidió suma un sello. Al completar la
  tarjeta gana el premio (un plato de la carta) y el "gracias" lo festeja. Lo que se pide de
  regalo no suma, y lo que el local no tomó tampoco. Si se suma recién en el "gracias" (hasta 3
  horas después de pagar), lo de ese día también cuenta.
- **El premio lo pide desde su celu** cuando quiera: va al pedido de la mesa, gratis, y sale con
  la ronda. Queda registrado cuándo lo ganó y cuándo lo pidió. Si el local no toma esa ronda,
  el premio vuelve.
- **Cuando vuelve:** "¡Hola de nuevo, Vale! Es tu 5ª visita", ya con su nombre y su color, sus
  sellos, su premio para pedir y "¿Lo de siempre?" con lo que más pide (un toque y lo suma).
- **El mozo sabe quién es:** en la mesa ve "Vale es del club · 5ª visita · suele pedir Doble
  Bacon · tiene un Flan de regalo para pedir". Sin el mail.
- **Clientes, en el panel** (permiso nuevo "clientes": dueño y encargado). La regla del premio
  (cada cuántas cosas, qué plato, prendido o apagado), la lista con visitas, sellos y premios,
  quién está sentado ahora, el detalle de cada uno y "Copiar mails" de los que aceptaron promos.
- **Datos personales (Ley 25.326).** Se dice qué se guarda y para qué; las promos son aparte y
  solo si tilda la casilla; cada uno borra su cuenta desde su celu y el local puede borrar los
  datos de quien lo pida.

En la versión real el código lo manda **Supabase Auth** (sin contraseña: `signInWithOtp` y
`verifyOtp`). Antes de abrir un local hay que: poner en la plantilla del mail el código de 6
números (`{{ .Token }}`) en lugar del link, y conectar un servicio de mails propio (por ejemplo
Resend: el de Supabase manda muy pocos por hora y es solo para probar). Las cuentas las crea
Gaby. La base ya lo hace cumplir: `club_ver`, `club_vincular`, `club_canjear`, `club_novedades`,
`club_borrarme` para el comensal; `clientes_estado`, `guardar_club`, `borrar_cliente` para el
panel; los sellos se suman solos al cobrar. Probado (149 pruebas, y una base de la versión
anterior se actualiza sin perder nada).

### Los platos en fotos reales: el laboratorio, adentro de la app (1-oct-2026)

Del 29 al 30-sep se probó aparte (carpeta `laboratorio/`, sin tocar la app) la carta con fotos
reales en lugar del 3D. Lo que pasó:
- Primero cuatro diseños con fotos (Vivo, Plato, Tarjetas, Galería); gustaron Vivo y Galería. Después
  Gaby pidió la interacción de la app con las fotos reales: la carta de la app tal cual, con el plato
  recortado de la foto.
- "¿Qué tiene?": las capas y lupas cortadas de la foto no gustaron; quedó el plato entero y alrededor
  cada ingrediente con su propia foto ("mejoró muchísimo"). "Armala": la burger se rearma con las
  franjas de su foto (simple, doble o triple; lo que se saca se va; panceta y huevo se suman).
- Las fotos se generaron con Higgsfield (GPT Image 2.5, fondo transparente, según la receta de la
  carta), desde la cuenta de Gaby. Los giros con el dedo, primero fingidos (se veían mal a los
  costados), ahora son videos de verdad (Kling 3.0 pro, el plato girando en fondo azul) pasados a
  cuadros con el taller. Postres y bebidas con juego: las bebidas se sirven ("buenísimas"), las papas
  se bañan en cheddar, el flan tiembla (video), el cucurucho se hamaca, el cheesecake se come con la
  cuchara de a bocados.

Gaby pidió juntarlo con el proyecto (1-oct). Ahora la app usa las fotos **de entrada** en todo: la
carta, la bienvenida (el plato se luce y vuelve a su lugar), el pedido, el seguimiento, el club y el
panel. El 3D sigue como opción (`local.js`: `vista`; en la demo, la cinta de arriba: Fotos / 3D) y
solo se baja si se elige. "Tu foto" (la cámara de la cinta) prueba la foto de un plato del local en
el celu, para mostrársela al dueño. Las herramientas quedaron en `herramientas/` (`npm run taller`) y
la carpeta `laboratorio/` se sacó (queda en el historial del repo).

**Para un local de verdad:** sus platos fotografiados (o generados a partir de sus fotos) con fondo
transparente, la foto de cada ingrediente, y los videos de los giros de lo que más impacta (burgers,
tragos). Va en `fotos.js`.

## 2. Qué se reutiliza de Fena y qué cambia

| | Fena (turnos) | Carta Viva |
|---|---|---|
| Frente | HTML + CSS + JS sin compilar, en Netlify | Igual, más **Three.js** para el 3D |
| Base | Supabase, un solo negocio | Supabase, **varios locales desde el día 1** (cada tabla lleva `local_id`) |
| Tiempo real | Aviso push al barbero | **Realtime** de Supabase: la cocina ve el pedido al instante y el comensal ve el estado; push al staff |
| Panel | Barberos y dueño | Cocina, mozos y dueño |
| Datos del negocio | `negocio.js` | `local.js` en la demo; en la real, todo editable desde el panel |
| Costo fijo al arrancar | $0 | $0 con el primer local (planes gratis); ver punto 6 |

## 3. Arquitectura propuesta para la versión real

**QR por mesa.** Cada mesa tiene su QR con un código secreto (`?m=4f9c…`) que dice local y
mesa. Así nadie puede pedir "desde la mesa 12" sin estar ahí, y el pedido llega con la mesa
correcta.

**Base (Supabase): ya escrita en `supabase/esquema.sql` y probada (`npm test`).**
- Varios locales desde el día 1. La carta de cada local se guarda entera (sale de `local.js` con
  `npm run semilla`) y **los precios los calcula la base**: el celular nunca manda un precio.
- Los comensales no necesitan usuario: el código del QR y una clave por persona los dejan pedir
  solo en su mesa y ver solo lo de su mesa. Los que quieren se suman al club con su mail (sin
  contraseña, con Supabase Auth) y quedan como clientes del local.
- El local entra con una cuenta del panel, y cada persona del equipo con su PIN (se traba a los
  5 intentos).
- Las tablas no se leen directo: todo pasa por funciones de la base que controlan quién puede qué.
- Los cambios se avisan al instante (Realtime de Supabase) y, si se corta, la app vuelve a
  preguntar cada unos segundos.

**Los platos de verdad.** Hoy la carta usa **fotos reales recortadas** (ver "Los platos en fotos
reales", arriba): es lo más rápido de conseguir para un local y gustó mucho. La otra vía, para más
adelante, es el 3D escaneado. Cada plato es un archivo `.glb`:
- **Escaneo con el celular** (Polycam, Luma, KIRI Engine o RealityScan): el plato real, con su
  textura real. Una tarde en el local alcanza para toda la carta.
- Se optimiza a **menos de 2–3 MB** por plato (compresión de malla y texturas) para que cargue
  rápido con 4G. Primero aparece la foto y después el 3D.
- **"Ver en tu mesa" (realidad aumentada):** con `<model-viewer>` el plato aparece sobre la mesa
  real, en iPhone y Android, sin instalar nada.
- **Ojo con "¿Qué tiene?":** para desarmar un plato escaneado hay que tenerlo por capas
  (escanear o modelar cada ingrediente). Con un escaneo entero, se muestra la lista de
  ingredientes en vez de desarmarlo. Las burgers y los sándwiches conviene hacerlos por capas:
  es lo que más impacta.

**Pagos.** Etapa 1: se paga como siempre (el comensal pide la cuenta y elige el medio).
Etapa 2: Mercado Pago desde el celular, con propina incluida, a través de una función de
Supabase (la clave de Mercado Pago nunca va en el celular).

**Pedidos en broma.** Hecho: la primera ronda de cada mesa le llega al equipo marcada "Mesa
nueva" y se puede no tomar. Si hiciera falta más, el código de la mesa puede cambiar cada día.

## 4. Qué necesita un local nuevo

1. La carta: platos, precios, secciones y fotos.
2. Escanear los platos (o elegir cuáles van en 3D y cuáles con foto).
3. Un color por plato (o la paleta del local).
4. Imprimir los QR de las mesas.
5. El equipo: se suma desde el panel (sección Equipo), cada uno con su PIN y sus permisos.
6. El premio del club: qué plato se regala y cada cuántas cosas (sección Clientes).

## 5. Decidido y por decidir

**Decidido por Gaby (26-sep-2026):**
- **Platos reales escaneados** (.glb), no ilustrados.
- **Sin pago en la app por ahora:** el comensal pide la cuenta y paga como siempre.
- **Sin local real todavía:** se sigue con Mordisco para mostrar.
- Juanma sabe de IA; el reparto del trabajo se ve más adelante.

**Por decidir:**
- **Quién escanea** los platos: nosotros, Juanma, o se terceriza.
- **Stack:** seguimos como Fena (estático + Supabase, sin servidor propio) salvo que Juanma
  prefiera otra cosa.
- **Nombre** del producto.

## 6. Costos (aproximados, a confirmar al contratar)

Con un local: Supabase gratis + Netlify gratis → $0 fijo. Los mails del club (el código para
entrar): Resend, gratis hasta unos 3.000 por mes. Con varios locales: Supabase Pro
(~USD 25/mes) y, si hace falta, Netlify Pro (~USD 19/mes). Los modelos 3D van en el Storage de
Supabase.

## 7. Próximos pasos técnicos (en orden)

1. Cargar un plato **escaneado de verdad** (.glb) en la demo, al lado de los modelados.
2. Base multi-local en Supabase: **escrita y probada**. Falta conectarla a la app y probar
   pedidos en tiempo real entre celulares de verdad. Para el club: la plantilla del mail con el
   código y un servicio de mails (Resend).
3. Avisos al celular del mozo aunque tenga la app cerrada (como los turnos de Fena): "¡Sale!
   Mesa 9" en la pantalla bloqueada.
4. Panel del dueño: editar carta, precios, colores y mesas (el equipo, los agotados y los QR ya
   están en el panel).
5. "Ver en tu mesa" (realidad aumentada).
6. Mercado Pago.
