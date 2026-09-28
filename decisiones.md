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
- Los comensales no tienen usuario: el código del QR y una clave por persona los dejan pedir
  solo en su mesa y ver solo lo de su mesa.
- El local entra con una cuenta del panel, y cada persona del equipo con su PIN (se traba a los
  5 intentos).
- Las tablas no se leen directo: todo pasa por funciones de la base que controlan quién puede qué.
- Los cambios se avisan al instante (Realtime de Supabase) y, si se corta, la app vuelve a
  preguntar cada unos segundos.

**El 3D de los platos reales.** Cada plato es un archivo `.glb`:
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
5. Usuarios del panel para cocina y mozos.

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

Con un local: Supabase gratis + Netlify gratis → $0 fijo. Con varios locales: Supabase Pro
(~USD 25/mes) y, si hace falta, Netlify Pro (~USD 19/mes). Los modelos 3D van en el Storage de
Supabase.

## 7. Próximos pasos técnicos (en orden)

1. Cargar un plato **escaneado de verdad** (.glb) en la demo, al lado de los modelados.
2. Base multi-local en Supabase: **escrita y probada**. Falta conectarla a la app y probar
   pedidos en tiempo real entre celulares de verdad.
3. Panel del dueño: editar carta, precios, agotados, colores y QR de las mesas.
4. "Ver en tu mesa" (realidad aumentada).
5. Mercado Pago.
