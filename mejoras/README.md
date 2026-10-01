# Mejoras de fotos

Pruebas puntuales para mejorar cómo se ve un plato, aparte de la app (la app no se toca hasta
que Gaby elige). Cada carpeta es un proyecto chico con su propio link.

## pizzas/

**Ya están en la app (1-oct):** las versiones Video y 3D, con un botón en cada pizza para elegir.

Se notaba que eran fotos (la de arriba, acostada y girando: sin borde ni grosor). Tres maneras
de verlas, para comparar:

- **Hoy**: como está en la carta.
- **Video**: la pizza filmada en ángulo (Higgsfield: foto en ángulo con GPT Image 2.5 y giro con
  Kling 3.0 pro, 8 s, fondo azul). Gira con el dedo; un toque, una vuelta.
- **3D** (`assets/pizza3d.js`, Three.js): la foto de arriba sobre una pizza armada en 3D, con masa,
  borde inflado, costado tostado y ocho porciones. Gira e inclina con el dedo; un toque levanta la
  porción de adelante con el queso estirado.

Ver en la compu: `npm run taller` y abrir http://localhost:5186/mejoras/pizzas/
Link: `npm run pizzas:link` y publicar `mejoras/pizzas/vista-previa.html` con los archivos aparte
(`assets/pizza3d.js` y `assets/cuadros/*.webp`). Los cuadros se arman con el taller
(`herramientas/taller/?v=pepperoni-giro.mp4&dest=mejoras/pizzas/assets`).
