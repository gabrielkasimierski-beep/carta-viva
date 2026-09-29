# Laboratorio de diseño

Acá se prueban ideas de diseño con fotos reales **sin tocar la app** (`app/` no se modifica:
el laboratorio solo lee los platos de `app/assets/local.js`). Es para prueba y error.

- Verlo en la compu: `npm run laboratorio` y abrir http://localhost:5185
- Armar el archivo único para el link: `npm run laboratorio:link` → `laboratorio/vista-previa.html`
- Sumar un experimento: una función más en `EXPERIMENTOS` (`assets/lab.js`).
- "Tu foto" cambia la foto del plato que se está viendo, solo en ese navegador.
- Las marcas del "¿Qué tiene?" de cada foto (capas y puntos) están en `PARTES` (`assets/lab.js`).
  Para revisar una: `laboratorio/#que-tiene=clasica`.

## Qué se probó

- 29-sep: Vivo, Plato, Tarjetas y Galería. A Gaby le gustaron Vivo y Galería; Plato y
  Tarjetas quedaron descartados. Ahora: Vivo + Galería combinados, con el "¿Qué tiene?" de la
  app hecho con la foto (las burgers se abren en capas; lo demás, con puntos por ingrediente).

## Fotos (Unsplash, licencia libre de Unsplash: uso gratis, sin atribución obligatoria)

| Plato | Foto |
|---|---|
| La Clásica | https://unsplash.com/photos/sc5sTPMrVfk |
| Doble Bacon | https://unsplash.com/photos/jh5XyK4Rr3Y |
| La Remolacha | images.unsplash.com/photo-1520072959219-c595dc870360 |
| Pepperoni | images.unsplash.com/photo-1534308983496-4fabb1a015ee |
| Fugazzeta | images.unsplash.com/photo-1594007654729-407eedc4be65 |
| Papas con cheddar | images.unsplash.com/photo-1639744210631-209fce3e256c |
| Aros de cebolla | images.unsplash.com/photo-1639024471283-03518883512d |
| Flan | images.unsplash.com/photo-1653988354010-39637252a2db |
| Cucurucho | images.unsplash.com/photo-1633933358116-a27b902fad35 |
| Cheesecake | images.unsplash.com/photo-1578775887804-699de7086ff9 |
| Limonada | images.unsplash.com/photo-1653542772393-71ffa417b1c4 |
| Pinta de IPA | images.unsplash.com/photo-1608270586620-248524c67de9 |
| Fernet con coca | images.unsplash.com/photo-1629654613528-5d0a2e4166de |

Son fotos de ejemplo, no de Mordisco: sirven para probar cómo se ven las animaciones.
