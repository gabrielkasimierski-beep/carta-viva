/* =============================================================================
   CARTA VIVA — las fotos de cada plato y lo que se marcó en cada una
   Todo en px de la foto (tam). Fotos generadas con Higgsfield (ver CREDITOS.md), ya recortadas:
   el color en un .jpg y lo transparente en otro (alfa). Siguen la receta de la carta.

   vista:    "frente" (de costado: se inclina con el dedo) o "arriba" (desde arriba: se
             acuesta como un plato de verdad y gira con el dedo).
   contorno: puntos alrededor del plato (alcanza con "más o menos": el borde se ajusta
             solo a la foto). O elipse [cx, cy, rx, ry] / superelipse [cx, cy, rx, ry, n].
             extra: más partes que suman (lo que sobresale); huecos: lo que no va.
   lleva:    lo que tiene (según la carta): [foto de ingredientes, nombre]. Es el "¿Qué tiene?".
   giro:     la vuelta entera de verdad: los cuadros de un video de Higgsfield (el plato girando en
             un fondo azul), recortados y juntos en una imagen (assets/cuadros, ver herramientas/taller).
             sentido: para qué lado gira el video (1: lo de adelante va a la derecha).
   juego:    lo que se puede hacer con el dedo en los postres y las bebidas (ver juegos.js):
             "servir" (el vaso se llena o el cheddar cae: cuadros de un video), "flan" (tiembla: también un video), "helado" (las
             bochas se hamacan, la cereza salta), "cuchara" (el cheesecake se come con la cuchara).
   capas:    en las burgers, la foto en franjas de arriba hacia abajo (hasta: [izquierda, centro,
             derecha] donde termina cada una; tiene: qué ingredientes hay en esa franja). Con
             "Armala" se sacan, se repiten (doble, triple) o se suman cosas.
   alfa:     lo transparente de la foto (en gris), si ya viene recortada: no hace falta contorno.
   color:    si la foto pide otro color que el de la carta (local.js).
   ============================================================================= */
window.FOTOS = {
  "clasica": {
    foto: "assets/fotos/clasica.jpg", alfa: "assets/fotos/clasica-alfa.jpg", tam: [900, 776], vista: "frente",
    lleva: [["pan", "Pan de papa"], ["medallon", "Medallón"], ["cheddar", "Cheddar"], ["lechuga", "Lechuga"], ["tomate", "Tomate"], ["cebolla", "Cebolla morada"], ["salsa", "Salsa de la casa"]],
    giro: { src: ["assets/cuadros/clasica-giro-1.webp", "assets/cuadros/clasica-giro-2.webp"], n: 96, cols: 7, tam: [520, 445], porParte: 63, sentido: -1 },
    capas: [
      { nombre: "Pan de papa", hasta: [268, 250, 268] },
      { nombre: "Salsa y cebolla morada", tiene: ["cebolla"], hasta: [328, 340, 336] },
      { nombre: "Tomate", tiene: ["tomate"], hasta: [392, 398, 405] },
      { nombre: "Lechuga", tiene: ["lechuga"], hasta: [485, 475, 480] },
      { nombre: "Cheddar", tiene: ["cheddar"], hasta: [528, 550, 535] },
      { nombre: "Medallón", tiene: ["medallon"], hasta: [622, 632, 618] },
      { nombre: "Pan de papa" },
    ],
  },
  "doble-bacon": {
    foto: "assets/fotos/doble-bacon.jpg", alfa: "assets/fotos/doble-bacon-alfa.jpg", tam: [900, 710], vista: "frente",
    lleva: [["pan", "Pan de papa"], ["medallon", "Dos medallones"], ["cheddar", "Doble cheddar"], ["panceta", "Panceta crocante"], ["barbacoa", "Barbacoa ahumada"]],
    giro: { src: ["assets/cuadros/doble-bacon-giro-1.webp", "assets/cuadros/doble-bacon-giro-2.webp"], n: 96, cols: 7, tam: [520, 404], porParte: 70, sentido: 1 },
    capas: [
      { nombre: "Pan de papa", hasta: [235, 225, 235] },
      { nombre: "Panceta y barbacoa", hasta: [370, 305, 365] },
      { nombre: "Medallón y cheddar", tiene: ["medallon"], hasta: [440, 440, 432] },
      { nombre: "Medallón y cheddar", tiene: ["medallon"], hasta: [548, 552, 545] },
      { nombre: "Pan de papa" },
    ],
  },
  "remolacha": {
    foto: "assets/fotos/remolacha.jpg", alfa: "assets/fotos/remolacha-alfa.jpg", tam: [895, 857], vista: "frente",
    lleva: [["remolacha", "Medallón de remolacha"], ["palta", "Palta"], ["lechuga", "Lechuga"], ["tomate", "Tomate"], ["albahaca", "Mayo de albahaca"]],
    giro: { src: ["assets/cuadros/remolacha-giro-1.webp", "assets/cuadros/remolacha-giro-2.webp"], n: 96, cols: 7, tam: [520, 493], porParte: 56, sentido: -1 },
    capas: [
      { nombre: "Pan integral y mayo de albahaca", hasta: [298, 296, 300] },
      { nombre: "Tomate", tiene: ["tomate"], hasta: [362, 352, 368] },
      { nombre: "Lechuga", tiene: ["lechuga"], hasta: [455, 455, 460] },
      { nombre: "Palta", tiene: ["palta"], hasta: [522, 545, 525] },
      { nombre: "Medallón de remolacha", tiene: ["medallon"], hasta: [655, 690, 662] },
      { nombre: "Pan integral" },
    ],
  },
  "pepperoni": {
    foto: "assets/fotos/pepperoni.jpg", alfa: "assets/fotos/pepperoni-alfa.jpg", tam: [1000, 1000], vista: "arriba",
    lleva: [["masa", "Masa de fermentación lenta"], ["tomate", "Salsa de tomate"], ["muzzarella", "Muzzarella"], ["pepperoni", "Pepperoni"]],
    color: "#D8432A", color2: "#F2A93B",            // en la carta es verde (por la albahaca del 3D); la foto es roja
  },
  "fugazzeta": {
    foto: "assets/fotos/fugazzeta.jpg", alfa: "assets/fotos/fugazzeta-alfa.jpg", tam: [1000, 1000], vista: "arriba",
    lleva: [["masa", "Masa"], ["cebolla", "Cebolla dulce"], ["muzzarella", "Muzzarella a morir"], ["oregano", "Orégano"]],
  },
  "papas-cheddar": {
    foto: "assets/fotos/papas-cheddar.jpg", alfa: "assets/fotos/papas-cheddar-alfa.jpg", tam: [900, 751], vista: "frente",
    lleva: [["papas", "Papas rústicas"], ["cheddar", "Cheddar fundido"], ["verdeo", "Verdeo"]],
    juego: "servir", cuadros: { src: "assets/cuadros/papas-cheddar.webp", n: 48, cols: 7, tam: [460, 425] },
    pista: "Deslizá para bañarlas en cheddar · tocalas y se sirven de nuevo", esfumar: 0.3,
  },
  "aros": {
    foto: "assets/fotos/aros.jpg", alfa: "assets/fotos/aros-alfa.jpg", tam: [488, 900], vista: "frente",
    lleva: [["cebolla", "Cebolla morada"], ["cerveza", "Rebozado en birra"], ["barbacoa", "Dip de barbacoa"]],
    giro: { src: "assets/cuadros/aros-giro.webp", n: 48, cols: 10, tam: [280, 508], sentido: -1 },
  },
  "flan": {
    foto: "assets/fotos/flan.jpg", alfa: "assets/fotos/flan-alfa.jpg", tam: [900, 676], vista: "frente",
    lleva: [["huevo", "Huevos de campo"], ["dulcedeleche", "Dulce de leche"], ["crema", "Crema"]],
    juego: "flan", cuadros: { src: "assets/cuadros/flan-tiembla.webp", n: 64, cols: 8, tam: [500, 385] },
  },
  "helado": {
    foto: "assets/fotos/helado.jpg", alfa: "assets/fotos/helado-alfa.jpg", tam: [285, 900], vista: "frente",
    lleva: [["cucurucho", "Cucurucho"], ["dulcedeleche", "Dulce de leche"], ["frutilla", "Frutilla a la crema"], ["pistacho", "Pistacho"], ["cereza", "Cereza"]],
    juego: "helado", cortes: [0.165, 0.353, 0.511, 0.639],
  },
  "cheesecake": {
    foto: "assets/fotos/cheesecake.jpg", alfa: "assets/fotos/cheesecake-alfa.jpg", tam: [754, 585], vista: "frente",
    lleva: [["quesocrema", "Queso crema"], ["galletitas", "Base de galletitas"], ["frutosrojos", "Coulis de frutos rojos"]],
    juego: "cuchara",
    // dónde va cada parte en la foto (x, y, ancho, alto, en fracción de la foto)
    porcion: { foto: "assets/fotos/cheesecake-porcion.jpg", alfa: "assets/fotos/cheesecake-porcion-alfa.jpg", caja: [0.0995, 0, 0.7997, 0.735] },
    platito: { foto: "assets/fotos/cheesecake-plato.jpg", alfa: "assets/fotos/cheesecake-plato-alfa.jpg", caja: [0, 0.4085, 1, 0.5915] },
    cuchara: { foto: "assets/fotos/cuchara.jpg", alfa: "assets/fotos/cuchara-alfa.jpg", hueco: [0.183, 0.444], punta: 0.02 },
  },
  "limonada": {
    foto: "assets/fotos/limonada.jpg", alfa: "assets/fotos/limonada-alfa.jpg", tam: [400, 820], vista: "frente",
    lleva: [["limon", "Limón"], ["menta", "Menta"], ["jengibre", "Jengibre"], ["hielo", "Hielo"]],
    juego: "servir", cuadros: { src: "assets/cuadros/limonada-servir.webp", n: 48, cols: 10, tam: [300, 615] },
  },
  "ipa": {
    foto: "assets/fotos/ipa.jpg", alfa: "assets/fotos/ipa-alfa.jpg", tam: [400, 820], vista: "frente",
    lleva: [["lupulo", "Lúpulo"], ["malta", "Malta"]],
    juego: "servir", cuadros: { src: "assets/cuadros/ipa-servir.webp", n: 48, cols: 10, tam: [300, 615] },
  },
  "fernet": {
    foto: "assets/fotos/fernet.jpg", alfa: "assets/fotos/fernet-alfa.jpg", tam: [400, 820], vista: "frente",
    lleva: [["hierbas", "Fernet"], ["cola", "Coca"], ["hielo", "Hielo"]],
    juego: "servir", cuadros: { src: "assets/cuadros/fernet-servir.webp", n: 48, cols: 10, tam: [300, 615] },
  },
};

// Las fotos de los ingredientes (para el "¿Qué tiene?"), cada una aparte
window.INGREDIENTES = {
  albahaca: "assets/ingredientes/albahaca.jpg", barbacoa: "assets/ingredientes/barbacoa.jpg", cebolla: "assets/ingredientes/cebolla.jpg",
  cereza: "assets/ingredientes/cereza.jpg", cerveza: "assets/ingredientes/cerveza.jpg", cheddar: "assets/ingredientes/cheddar.jpg",
  cola: "assets/ingredientes/cola.jpg", crema: "assets/ingredientes/crema.jpg", cucurucho: "assets/ingredientes/cucurucho.jpg",
  dulcedeleche: "assets/ingredientes/dulcedeleche.jpg", frutilla: "assets/ingredientes/frutilla.jpg", frutosrojos: "assets/ingredientes/frutosrojos.jpg",
  galletitas: "assets/ingredientes/galletitas.jpg", hielo: "assets/ingredientes/hielo.jpg", hierbas: "assets/ingredientes/hierbas.jpg",
  huevo: "assets/ingredientes/huevo.jpg", jengibre: "assets/ingredientes/jengibre.jpg", lechuga: "assets/ingredientes/lechuga.jpg",
  limon: "assets/ingredientes/limon.jpg", lupulo: "assets/ingredientes/lupulo.jpg", malta: "assets/ingredientes/malta.jpg",
  masa: "assets/ingredientes/masa.jpg", medallon: "assets/ingredientes/medallon.jpg", menta: "assets/ingredientes/menta.jpg",
  muzzarella: "assets/ingredientes/muzzarella.jpg", oregano: "assets/ingredientes/oregano.jpg", palta: "assets/ingredientes/palta.jpg",
  pan: "assets/ingredientes/pan.jpg", panceta: "assets/ingredientes/panceta.jpg", papas: "assets/ingredientes/papas.jpg",
  pepperoni: "assets/ingredientes/pepperoni.jpg", pistacho: "assets/ingredientes/pistacho.jpg", quesocrema: "assets/ingredientes/quesocrema.jpg",
  remolacha: "assets/ingredientes/remolacha.jpg", salsa: "assets/ingredientes/salsa.jpg", tomate: "assets/ingredientes/tomate.jpg",
  verdeo: "assets/ingredientes/verdeo.jpg",
};
// Lo que se suma en "Armala" (ya recortado, como los platos) y cuánto alto ocupa en la burger
window.SUMAR = {
  bacon: { foto: "assets/fotos/sumar-panceta.jpg", alfa: "assets/fotos/sumar-panceta-alfa.jpg", alto: 0.1 },
  huevo: { foto: "assets/fotos/sumar-huevo.jpg", alfa: "assets/fotos/sumar-huevo-alfa.jpg", alto: 0.1 },
};
