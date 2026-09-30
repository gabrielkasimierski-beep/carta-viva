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
- `assets/recorte.js`: saca el plato de la foto (las de Higgsfield ya vienen recortadas: color + alfa). Con el contorno marcado "más o menos", el borde se
  ajusta solo a la foto (mira el color del plato y del fondo, y lo afina siguiendo los bordes).

## Qué se probó

- 29-sep: Vivo, Plato, Tarjetas y Galería. A Gaby le gustaron Vivo y Galería; Plato y Tarjetas
  quedaron descartados. Después: Vivo + Galería combinados, con el "¿Qué tiene?" hecho con la foto.
- 29-sep (2): pidió la interacción de la app con las fotos reales. Ahora el laboratorio es la carta
  de la app tal cual (los tres estilos incluidos), con el plato recortado de la foto en lugar del 3D.
  Vivo + Galería quedó en el historial del repo.
- 29-sep (3): pedidos de Gaby. "¿Qué tiene?": el plato queda entero y alrededor aparece cada
  ingrediente con su propia foto (las capas y lupas cortadas de la foto no gustaron). "Armala":
  la burger se rearma (simple, doble o triple; lo que se saca se va; panceta y huevo se suman).
  Las burgers, tragos, flan y aros dan la vuelta entera con el dedo (un toque: una vuelta).
- 30-sep: todas las fotos generadas con Higgsfield (platos, ingredientes y lo que se suma en "Armala"),
  hechas según la receta de la carta. Los platos vienen con fondo transparente: no hace falta marcar
  el contorno. Las burgers, de costado y en capas parejas, para que "Armala" las rearme mejor. El
  cucurucho ahora es un cucurucho de verdad (de costado, da la vuelta entera).

## Fotos

Generadas con Higgsfield (modelo GPT Image 2.5), el 30-sep, desde la cuenta de Gaby. Platos en
calidad alta con fondo transparente; ingredientes en calidad baja (se ven chicos) sobre fondo blanco.
Se guardan ya recortadas y achicadas: `fotos/<plato>.jpg` (color) + `fotos/<plato>-alfa.jpg` (lo
transparente, en gris). Los PNG originales quedan en la cuenta de Higgsfield.

Las anteriores (Unsplash) quedaron en el historial del repo.
