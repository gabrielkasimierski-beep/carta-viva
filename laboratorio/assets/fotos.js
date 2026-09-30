/* =============================================================================
   CARTA VIVA · laboratorio — las fotos de cada plato y lo que se marcó en cada una
   Todo en px de la foto (tam). Fotos de Unsplash (ver CREDITOS.md): son de ejemplo,
   así que lo marcado describe lo que se ve en la foto, no siempre la receta de la carta.

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
   color:    si la foto pide otro color que el de la carta (local.js).
   ============================================================================= */
window.FOTOS = {
  "clasica": {
    foto: "assets/fotos/clasica.jpg", tam: [1080, 897], vista: "frente",
    lleva: [["pan", "Pan de papa"], ["medallon", "Medallón"], ["cheddar", "Cheddar"], ["lechuga", "Lechuga"], ["tomate", "Tomate"], ["cebolla", "Cebolla morada"], ["salsa", "Salsa de la casa"]], giro360: true,
    contorno: [
      [540, 112], [620, 116], [700, 129], [765, 155], [812, 195], [846, 245], [866, 300], [877, 346], [872, 385],
      [860, 415], [866, 445], [875, 480], [890, 500], [906, 510], [904, 538], [884, 550], [866, 562], [870, 588],
      [888, 572], [905, 600], [913, 648], [902, 682], [880, 672], [868, 690], [848, 722], [812, 742], [760, 750],
      [660, 752], [540, 752], [420, 750], [320, 744], [278, 730], [250, 705], [236, 675], [230, 640], [200, 642],
      [160, 638], [134, 632], [148, 606], [186, 580], [212, 575], [206, 548], [198, 515], [188, 480], [186, 445],
      [200, 420], [218, 395], [222, 350], [228, 300], [246, 245], [276, 196], [322, 155], [390, 127], [465, 114],
    ],
    capas: [
      { nombre: "Pan de papa", detalle: "con sésamo", hasta: [372, 352, 390] },
      { nombre: "Salsa y cheddar", tiene: ["cheddar"], hasta: [426, 418, 420] },
      { nombre: "Medallón", tiene: ["medallon"], hasta: [466, 455, 452] },
      { nombre: "Medallón", tiene: ["medallon"], hasta: [550, 540, 496] },
      { nombre: "Cebolla, pepinos y tomate", tiene: ["cebolla", "tomate"], hasta: [592, 596, 594] },
      { nombre: "Lechuga", tiene: ["lechuga"], hasta: [648, 640, 648] },
      { nombre: "Pan de papa", detalle: "horneado en el día" },
    ],
  },
  "doble-bacon": {
    foto: "assets/fotos/doble-bacon.jpg", tam: [1080, 769], vista: "frente",
    lleva: [["pan", "Pan de papa"], ["medallon", "Dos medallones"], ["cheddar", "Doble cheddar"], ["panceta", "Panceta crocante"], ["barbacoa", "Barbacoa ahumada"]], giro360: true,
    contorno: [
      [548, 130], [650, 137], [730, 160], [790, 200], [830, 250], [852, 300], [858, 340], [848, 372], [852, 420],
      [868, 455], [874, 500], [864, 528], [880, 560], [870, 572], [852, 580], [850, 610], [836, 632], [800, 646],
      [700, 650], [560, 651], [420, 650], [300, 644], [252, 632], [228, 612], [224, 585], [196, 578], [160, 575],
      [157, 562], [190, 548], [226, 528], [240, 505], [250, 470], [256, 440], [240, 412], [230, 395], [242, 360],
      [248, 320], [262, 262], [290, 212], [340, 170], [410, 143], [480, 132],
    ],
    capas: [
      { nombre: "Pan con sésamo", detalle: "blanco y negro", hasta: [331, 331, 331] },
      { nombre: "Cebolla y cheddar", tiene: ["cheddar"], hasta: [400, 400, 400] },
      { nombre: "Medallón", tiene: ["medallon"], hasta: [450, 450, 450] },
      { nombre: "Cheddar y morrón", tiene: ["cheddar"], hasta: [477, 477, 477] },
      { nombre: "Medallón", tiene: ["medallon"], hasta: [531, 531, 531] },
      { nombre: "Pepinos y barbacoa", detalle: "", hasta: [569, 569, 569] },
      { nombre: "Pan con sésamo", detalle: "tostado" },
    ],
  },
  "remolacha": {
    foto: "assets/fotos/remolacha.jpg", tam: [1200, 1017], vista: "frente",
    lleva: [["remolacha", "Medallón de remolacha"], ["palta", "Palta"], ["lechuga", "Lechuga"], ["tomate", "Tomate"], ["albahaca", "Mayo de albahaca"]], giro360: true,
    contorno: [
      [590, 95], [680, 100], [760, 118], [830, 150], [890, 190], [930, 225], [952, 262], [952, 300], [975, 330],
      [1005, 360], [1018, 395], [1000, 412], [986, 442], [990, 480], [1004, 492], [1040, 552], [1064, 590],
      [1050, 622], [1026, 618], [1028, 670], [1024, 706], [1032, 742], [1034, 800], [1020, 850], [990, 886],
      [940, 906], [850, 913], [700, 916], [550, 916], [400, 913], [290, 906], [240, 882], [210, 842], [186, 832],
      [164, 815], [158, 760], [168, 722], [157, 690], [154, 640], [164, 600], [180, 576], [184, 532], [140, 530],
      [114, 500], [110, 440], [120, 370], [145, 295], [190, 225], [260, 170], [350, 134], [450, 110], [520, 99],
    ],
    capas: [
      { nombre: "Pan brioche", detalle: "tostado", hasta: [500, 290, 285] },
      { nombre: "Palta y queso", tiene: ["palta"], hasta: [585, 510, 500] },
      { nombre: "Tomate y rúcula", tiene: ["tomate", "lechuga"], hasta: [615, 585, 570] },
      { nombre: "Medallón de remolacha", tiene: ["medallon"], hasta: [665, 675, 700] },
      { nombre: "Salsa de morrones", detalle: "asados", hasta: [740, 760, 718] },
      { nombre: "Pan brioche", detalle: "" },
    ],
  },
  "pepperoni": {
    foto: "assets/fotos/pepperoni.jpg", tam: [1200, 1133], vista: "arriba",
    lleva: [["masa", "Masa de fermentación lenta"], ["tomate", "Salsa de tomate"], ["muzzarella", "Muzzarella"], ["pepperoni", "Pepperoni"]],
    color: "#D8432A", color2: "#F2A93B",            // en la carta es verde (por la albahaca del 3D); la foto es roja
    elipse: [595, 570, 468, 470], afinar: false, suave: 0.004,
  },
  "fugazzeta": {
    foto: "assets/fotos/fugazzeta.jpg", tam: [1080, 1464], vista: "arriba",
    lleva: [["masa", "Masa"], ["cebolla", "Cebolla dulce"], ["muzzarella", "Muzzarella a morir"], ["oregano", "Orégano"]],
    elipse: [579, 930, 394, 398], afinar: false, suave: 0.004,
  },
  "papas-cheddar": {
    foto: "assets/fotos/papas-cheddar.jpg", tam: [1080, 1080], vista: "frente",
    lleva: [["papas", "Papas rústicas"], ["cheddar", "Cheddar fundido"], ["verdeo", "Verdeo"]],
    contorno: [
      [172, 425], [206, 396], [262, 348], [300, 338], [346, 344], [372, 352], [420, 330], [480, 322], [514, 314],
      [520, 300], [546, 296], [572, 300], [586, 328], [602, 328], [626, 248], [642, 254], [636, 330], [656, 380],
      [700, 420], [760, 468], [822, 473], [852, 478], [856, 496], [826, 556], [880, 588], [916, 598], [912, 630],
      [890, 662], [852, 702], [838, 742], [800, 770], [740, 792], [650, 812], [576, 846], [544, 832], [470, 792],
      [420, 748], [360, 712], [300, 672], [258, 642], [220, 602], [204, 556], [176, 512], [168, 470],
    ],
  },
  "aros": {
    foto: "assets/fotos/aros.jpg", tam: [1200, 1171], vista: "frente",
    lleva: [["cebolla", "Cebolla morada"], ["cerveza", "Rebozado en birra"], ["barbacoa", "Dip de barbacoa"]], giro360: true,
    contorno: [
      [300, 124], [362, 134], [420, 168], [456, 214], [500, 230], [560, 224], [620, 218], [680, 228], [714, 246],
      [722, 262], [860, 254], [980, 298], [1080, 360], [1150, 420], [1192, 488], [1100, 522], [980, 562],
      [892, 606], [886, 640], [874, 720], [862, 800], [840, 880], [822, 960], [802, 1010], [772, 1042], [700, 1055],
      [600, 1059], [480, 1057], [360, 1050], [272, 1033], [236, 1004], [214, 960], [196, 880], [176, 800],
      [158, 720], [128, 620], [118, 560], [112, 480], [96, 420], [90, 330], [96, 268], [122, 210], [172, 160], [232, 130],
    ],
  },
  "flan": {
    foto: "assets/fotos/flan.jpg", tam: [1200, 921], vista: "frente",
    lleva: [["huevo", "Huevos de campo"], ["dulcedeleche", "Dulce de leche"], ["crema", "Crema"]], giro360: true,
    contorno: [
      [120, 380], [160, 312], [230, 252], [310, 202], [370, 176], [420, 130], [520, 97], [640, 83], [760, 83],
      [880, 97], [990, 125], [1060, 168], [1105, 192], [1140, 230], [1158, 300], [1164, 420], [1158, 560],
      [1138, 660], [1100, 740], [1020, 810], [900, 848], [760, 865], [620, 865], [480, 852], [360, 820],
      [255, 770], [170, 700], [118, 620], [98, 530], [100, 450],
    ],
  },
  "helado": {
    foto: "assets/fotos/helado.jpg", tam: [1080, 1350], vista: "arriba",
    lleva: [["cucurucho", "Cucurucho"], ["dulcedeleche", "Dulce de leche"], ["frutilla", "Frutilla a la crema"], ["pistacho", "Pistacho"], ["cereza", "Cereza"]],
    superelipse: [568, 713, 321, 501, 3.2], afinar: false, suave: 0.004,
  },
  "cheesecake": {
    foto: "assets/fotos/cheesecake.jpg", tam: [1200, 899], vista: "frente",
    lleva: [["quesocrema", "Queso crema"], ["galletitas", "Base de galletitas"], ["frutosrojos", "Coulis de frutos rojos"]],
    elipse: [610, 472, 549, 305],
    extra: [[[440, 232], [446, 172], [500, 110], [560, 68], [640, 60], [690, 42], [740, 38], [776, 70], [786, 106], [852, 118], [866, 142], [862, 232]]],
  },
  "limonada": {
    foto: "assets/fotos/limonada.jpg", tam: [1080, 1626], vista: "frente",
    lleva: [["limon", "Limón"], ["menta", "Menta"], ["jengibre", "Jengibre"], ["hielo", "Hielo"]], giro360: true,
    contorno: [
      [330, 158], [358, 150], [378, 250], [396, 395], [430, 405], [470, 396], [538, 398], [545, 340], [570, 314],
      [602, 318], [632, 350], [654, 398], [690, 360], [742, 352], [786, 354], [797, 400], [790, 452], [762, 496],
      [748, 522], [750, 560], [742, 700], [732, 850], [722, 1000], [714, 1150], [710, 1250], [707, 1330],
      [690, 1347], [540, 1352], [395, 1347], [380, 1330], [376, 1250], [368, 1150], [358, 1000], [346, 850],
      [336, 700], [328, 560], [328, 520], [342, 476], [358, 440], [350, 350], [340, 250],
    ],
  },
  "ipa": {
    foto: "assets/fotos/ipa.jpg", tam: [1000, 1087], vista: "frente",
    lleva: [["lupulo", "Lúpulo"], ["malta", "Malta"]], giro360: true,
    contorno: [
      [139, 154], [182, 109], [302, 95], [473, 99], [593, 116], [638, 161], [641, 349], [713, 353], [816, 370],
      [871, 418], [893, 538], [898, 710], [888, 830], [854, 902], [792, 926], [713, 909], [655, 891], [648, 950],
      [658, 998], [700, 1036], [682, 1073], [559, 1080], [216, 1080], [106, 1072], [96, 1036], [127, 1001], [130, 881],
      [130, 538], [134, 281],
    ],
    huecos: [[[655, 418], [748, 414], [808, 444], [837, 504], [842, 624], [837, 761], [813, 838], [756, 864], [679, 855], [652, 838]]],
  },
  "fernet": {
    foto: "assets/fotos/fernet.jpg", tam: [1080, 1350], vista: "frente",
    lleva: [["hierbas", "Fernet"], ["cola", "Coca"], ["hielo", "Hielo"]], giro360: true,
    contorno: [
      [215, 585], [230, 575], [395, 568], [410, 562], [470, 560], [525, 575], [540, 548], [600, 540], [655, 548],
      [665, 575], [720, 572], [865, 575], [875, 590], [878, 800], [878, 1050], [876, 1240], [862, 1280], [800, 1300],
      [550, 1306], [300, 1300], [240, 1285], [225, 1255], [220, 1050], [215, 800],
    ],
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
// Lo que se suma en "Armala" (fotos sobre fondo liso: se recortan solas) y cuánto alto ocupa en la burger
window.SUMAR = {
  bacon: { foto: "assets/fotos/sumar-panceta.jpg", auto: true, alto: 0.07 },
  huevo: { foto: "assets/fotos/sumar-huevo.jpg", auto: true, alto: 0.08 },
};
