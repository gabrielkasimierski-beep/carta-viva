# Laboratorio de diseño

Acá se prueban ideas de diseño con fotos reales **sin tocar la app** (`app/` no se modifica:
el laboratorio solo lee de ahí los platos, `local.js`, y el diseño, `estilos.css`). Es para prueba y error.

- Verlo en la compu: `npm run laboratorio` y abrir http://localhost:5185/laboratorio/
- Armar el archivo único para el link: `npm run laboratorio:link` → `laboratorio/vista-previa.html`
- "Tu foto" cambia la del plato que se está viendo, solo en ese navegador (se recorta como un óvalo).
- Lo marcado en cada foto (contorno, capas de las burgers, partes con lupa) está en `assets/fotos.js`.
  Para revisarlo: `laboratorio/recortes.html?p=clasica` (la foto con lo marcado y cómo queda el recorte).
  Para ver un plato abierto: `laboratorio/#que-tiene=clasica`.

## Cómo está hecho

- `assets/carta.js`: la carta de la app (`app/assets/app.js`), solo la carta: feed, colores, secciones,
  "¿Qué tiene?", "Armala", "Agregar" (no se manda) y "Toda la carta".
- `assets/escena-fotos.js`: en lugar del 3D, el plato es la foto recortada. Flota, se mueve con el dedo,
  salta con un toque. Las pizzas y la fuente del helado (fotos desde arriba) se acuestan y giran.
  "¿Qué tiene?": las burgers se abren en capas; lo demás muestra cada parte con una lupa.
- `assets/recorte.js`: saca el plato de la foto. Con el contorno marcado "más o menos", el borde se
  ajusta solo a la foto (mira el color del plato y del fondo, y lo afina siguiendo los bordes).

## Qué se probó

- 29-sep: Vivo, Plato, Tarjetas y Galería. A Gaby le gustaron Vivo y Galería; Plato y Tarjetas
  quedaron descartados. Después: Vivo + Galería combinados, con el "¿Qué tiene?" hecho con la foto.
- 29-sep (2): pidió la interacción de la app con las fotos reales. Ahora el laboratorio es la carta
  de la app tal cual (los tres estilos incluidos), con el plato recortado de la foto en lugar del 3D.
  Vivo + Galería quedó en el historial del repo.

## Fotos (Unsplash, licencia libre de Unsplash: uso gratis, sin atribución obligatoria)

| Plato | Foto |
|---|---|
| La Clásica | https://unsplash.com/photos/sc5sTPMrVfk |
| Doble Bacon | https://unsplash.com/photos/jh5XyK4Rr3Y |
| La Remolacha | images.unsplash.com/photo-1520072959219-c595dc870360 (recortada más cerca) |
| Pepperoni | https://unsplash.com/photos/xIqVfW8XUt4 |
| Fugazzeta | images.unsplash.com/photo-1594007654729-407eedc4be65 |
| Papas con cheddar | images.unsplash.com/photo-1639744210631-209fce3e256c |
| Aros de cebolla | https://unsplash.com/photos/uo46nevU9i4 (recortada) |
| Flan | https://unsplash.com/photos/TqPdzQ00I0U (recortada) |
| Cucurucho | images.unsplash.com/photo-1633933358116-a27b902fad35 |
| Cheesecake | https://unsplash.com/photos/xx1USWIvIFc |
| Limonada | images.unsplash.com/photo-1653542772393-71ffa417b1c4 |
| Pinta de IPA | images.unsplash.com/photo-1608270586620-248524c67de9 (recortada más cerca) |
| Fernet con coca | images.unsplash.com/photo-1629654613528-5d0a2e4166de |

Son fotos de ejemplo, no de Mordisco: sirven para probar cómo se ven las animaciones. Por eso lo
marcado en el "¿Qué tiene?" describe lo que se ve en cada foto, que no siempre es la receta de la carta.
