/* =============================================================================
   CARTA VIVA · laboratorio — las fotos de cada plato y lo que se marcó en cada una
   Todo en px de la foto (tam). Fotos generadas con Higgsfield (ver CREDITOS.md), ya recortadas:
   el color en un .jpg y lo transparente en otro (alfa). Siguen la receta de la carta.

   vista:    "frente" (de costado: se inclina con el dedo) o "arriba" (desde arriba: se
             acuesta como un plato de verdad y gira con el dedo).
   contorno: puntos alrededor del plato (alcanza con "más o menos": el borde se ajusta
             solo a la foto). O elipse [cx, cy, rx, ry] / superelipse [cx, cy, rx, ry, n].
             extra: más partes que suman (lo que sobresale); huecos: lo que no va.
   lleva:    lo que tiene (según la carta): [foto de ingredientes, nombre]. Es el "¿Qué tiene?".
   giro360:  da la vuelta entera con el dedo (de costado: burgers, tragos, flan, aros).
   capas:    en las burgers, la foto en franjas de arriba hacia abajo (hasta: [izquierda, centro,
             derecha] donde termina cada una; tiene: qué ingredientes hay en esa franja). Con
             "Armala" se sacan, se repiten (doble, triple) o se suman cosas.
   alfa:     lo transparente de la foto (en gris), si ya viene recortada: no hace falta contorno.
   color:    si la foto pide otro color que el de la carta (local.js).
   ============================================================================= */
window.FOTOS = {
  "clasica": {
    foto: "assets/fotos/clasica.jpg", alfa: "assets/fotos/clasica-alfa.jpg", tam: [900, 776], vista: "frente",
    lleva: [["pan", "Pan de papa"], ["medallon", "Medallón"], ["cheddar", "Cheddar"], ["lechuga", "Lechuga"], ["tomate", "Tomate"], ["cebolla", "Cebolla morada"], ["salsa", "Salsa de la casa"]], giro360: true,
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
    lleva: [["pan", "Pan de papa"], ["medallon", "Dos medallones"], ["cheddar", "Doble cheddar"], ["panceta", "Panceta crocante"], ["barbacoa", "Barbacoa ahumada"]], giro360: true,
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
    lleva: [["remolacha", "Medallón de remolacha"], ["palta", "Palta"], ["lechuga", "Lechuga"], ["tomate", "Tomate"], ["albahaca", "Mayo de albahaca"]], giro360: true,
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
  },
  "aros": {
    foto: "assets/fotos/aros.jpg", alfa: "assets/fotos/aros-alfa.jpg", tam: [900, 849], vista: "frente",
    lleva: [["cebolla", "Cebolla morada"], ["cerveza", "Rebozado en birra"], ["barbacoa", "Dip de barbacoa"]], giro360: true,
  },
  "flan": {
    foto: "assets/fotos/flan.jpg", alfa: "assets/fotos/flan-alfa.jpg", tam: [900, 471], vista: "frente",
    lleva: [["huevo", "Huevos de campo"], ["dulcedeleche", "Dulce de leche"], ["crema", "Crema"]], giro360: true,
  },
  "helado": {
    foto: "assets/fotos/helado.jpg", alfa: "assets/fotos/helado-alfa.jpg", tam: [285, 900], vista: "frente",
    lleva: [["cucurucho", "Cucurucho"], ["dulcedeleche", "Dulce de leche"], ["frutilla", "Frutilla a la crema"], ["pistacho", "Pistacho"], ["cereza", "Cereza"]], giro360: true,
  },
  "cheesecake": {
    foto: "assets/fotos/cheesecake.jpg", alfa: "assets/fotos/cheesecake-alfa.jpg", tam: [900, 625], vista: "frente",
    lleva: [["quesocrema", "Queso crema"], ["galletitas", "Base de galletitas"], ["frutosrojos", "Coulis de frutos rojos"]],
  },
  "limonada": {
    foto: "assets/fotos/limonada.jpg", alfa: "assets/fotos/limonada-alfa.jpg", tam: [437, 900], vista: "frente",
    lleva: [["limon", "Limón"], ["menta", "Menta"], ["jengibre", "Jengibre"], ["hielo", "Hielo"]], giro360: true,
  },
  "ipa": {
    foto: "assets/fotos/ipa.jpg", alfa: "assets/fotos/ipa-alfa.jpg", tam: [447, 900], vista: "frente",
    lleva: [["lupulo", "Lúpulo"], ["malta", "Malta"]], giro360: true,
  },
  "fernet": {
    foto: "assets/fotos/fernet.jpg", alfa: "assets/fotos/fernet-alfa.jpg", tam: [412, 893], vista: "frente",
    lleva: [["hierbas", "Fernet"], ["cola", "Coca"], ["hielo", "Hielo"]], giro360: true,
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
