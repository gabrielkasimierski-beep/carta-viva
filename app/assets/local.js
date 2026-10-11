/* =============================================================================
   CARTA VIVA — los datos del local
   Todo lo que es propio de cada restaurante vive acá: nombre, mesas, la carta, los
   colores de cada plato y cómo se arma cada uno en 3D. Las fotos de los platos (y lo
   marcado en cada una) están en fotos.js. Para otro local se cambian estos dos archivos
   (y más adelante, lo mismo desde el panel).

   MORDISCO ES UN LOCAL FICTICIO: nombre, platos y precios son de ejemplo.
   ============================================================================= */

window.LOCAL = {
  nombre: "Comilona",
  bajada: "La cocina de siempre, a un escaneo",
  logo: "",   // marca del local: se muestra en el panel y el login
  // Plan contratado: "basico" (carta QR + ver pedidos), "medio" (+ reportes y club) o
  // "premium" (gestión completa: cocina/barra, estados, PIN y permisos, equipo).
  plan: "basico",
  demo: true,                       // muestra la cinta "demo" y simula al resto del local
  demoCliente: true,                // demo para mostrarle a un cliente: simula el local pero esconde el botón de plan y el cartel "Demo"
  mesaDemo: 7,                      // la mesa que se abre si el link no dice cuál

  // La dirección de la carta cuando esté en internet. Es lo que llevan los QR de las mesas
  // (cada QR suma "?mesa=N"). Vacía: se usa la dirección desde donde se abre el panel.
  enlace: "",

  // Las mesas del local, por zona. lugares: 2, 4 o 6 (la de 6 ocupa el doble en el plano).
  mesas: [
    { n: 1, zona: "Salón", lugares: 2 },
    { n: 2, zona: "Salón", lugares: 4 },
    { n: 3, zona: "Salón", lugares: 4 },
    { n: 4, zona: "Salón", lugares: 2 },
    { n: 5, zona: "Salón", lugares: 6 },
    { n: 6, zona: "Salón", lugares: 4 },
    { n: 7, zona: "Salón", lugares: 4 },
    { n: 8, zona: "Salón", lugares: 6 },
    { n: 9, zona: "Vereda", lugares: 2 },
    { n: 10, zona: "Vereda", lugares: 2 },
    { n: 11, zona: "Vereda", lugares: 4 },
    { n: 12, zona: "Vereda", lugares: 4 },
  ],
  // Los puestos y lo que puede ver y hacer cada uno de entrada. Desde el panel (sección
  // Equipo), el dueño o el encargado suman personas, les eligen el puesto y ajustan los
  // permisos de cada una.
  //   mesas: el plano del salón · atender: le suena cuando llaman al mozo · llevar: le suena
  //   cuando algo está listo para llevar · cobrar: la cuenta y liberar la mesa · cocina,
  //   barra (una por estación): sus comandas · carta: marcar agotados · qr: los códigos de
  //   las mesas · clientes: los del club (con sus mails) y su premio · equipo: sumar
  //   personas, PIN y permisos.
  roles: [
    { id: "dueno",     nombre: "Dueño/a",     permisos: ["mesas", "atender", "llevar", "cobrar", "cocina", "barra", "carta", "qr", "clientes", "equipo", "movimientos"] },
    { id: "encargado", nombre: "Encargado/a", permisos: ["mesas", "atender", "llevar", "cobrar", "cocina", "barra", "carta", "qr", "clientes", "equipo"] },
    { id: "mozo",      nombre: "Mozo/a",      permisos: ["mesas", "atender", "llevar", "cobrar"] },
    { id: "cocina",    nombre: "Cocina",      permisos: ["cocina", "carta"] },
    { id: "barra",     nombre: "Barra",       permisos: ["barra", "carta"] },
    { id: "caja",      nombre: "Caja",        permisos: ["mesas", "cobrar"] },
  ],
  // El equipo de arranque: cada uno entra al panel con su nombre y su PIN, y todo lo que
  // hace queda con su nombre (quién empezó el pedido, quién lo llevó, quién cobró).
  // zona: la de sus mesas (le aparecen primero). permisos: si no se dicen, los de su puesto.
  // En la demo el PIN de todos es 1234. En la versión real, los PIN viven en la base.
  equipo: [
    { id: "rober",  nombre: "Rober",  rol: "dueno",     puesto: "Dueño",     color: "#E4879E", pin: "1234" },
    { id: "sofi",   nombre: "Sofi",   rol: "encargado", puesto: "Encargada", color: "#B98BC0", pin: "1234" },
    { id: "carla",  nombre: "Carla",  rol: "mozo",      puesto: "Moza",      color: "#8FB0CE", pin: "1234", zona: "Salón" },
    { id: "nico",   nombre: "Nico",   rol: "mozo",      puesto: "Mozo",      color: "#8FB59B", pin: "1234", zona: "Vereda" },
    { id: "diego",  nombre: "Diego",  rol: "cocina",    puesto: "Cocina",    color: "#E0A36A", pin: "1234" },
    { id: "martin", nombre: "Martín", rol: "barra",     puesto: "Barra",     color: "#E3C06A", pin: "1234" },
  ],

  // Adónde va cada cosa que se pide: la cocina hace la comida y la barra las bebidas.
  // Cada sección de la carta dice su estación. Un local sin barra: todo a "cocina".
  //   donde: cómo se la nombra en una frase · sale: el aviso al comensal cuando está listo.
  estaciones: [
    { id: "cocina", nombre: "Cocina", donde: "la cocina", sale: "¡Sale la comida!" },
    { id: "barra",  nombre: "Barra",  donde: "la barra",  sale: "¡Salen las bebidas!" },
  ],

  // El club del local: cada comensal puede guardar su cuenta con su mail, sin contraseña (le
  // llega un código). Cada `meta` cosas que pide, gana `premio` (un plato de la carta) de
  // regalo y lo pide desde su celu. Cuando vuelve, la carta lo reconoce y el mozo sabe
  // quién es. Se cambia desde el panel (Clientes).
  club: { activo: true, meta: 10, premio: "flan" },

  pagos: ["Efectivo", "Tarjeta", "Mercado Pago"],
  propinas: [0, 10, 15],            // en %

  // Cómo se ven los platos: "fotos" (la foto real recortada: gira con el dedo, los postres y
  // las bebidas tienen su juego; ver fotos.js) o "3d" (modelados por código, ver platos3d.js).
  // En la demo se cambia desde la cinta de arriba.
  vista: "fotos",
  // Las pizzas (con fotos): "video" (filmada en ángulo, gira con el dedo) o "3d" (la foto de arriba
  // sobre una pizza en 3D, con masa y borde; un toque levanta una porción). En la demo, el botón de la pizza.
  pizzas: "video",

  // Estilo de la carta: "brasa" (oscuro, cada plato con su luz), "jugo" (degradé del color
  // del plato) o "estudio" (fondo de foto de producto, en el tono del plato).
  estilo: "brasa",

  // La página en capas (profundidad.js): detrás de los platos de cada sección hay una escena (foto
  // del ambiente) y un video (humo, brasas, vapor sobre negro), y pasan partículas delante y
  // detrás. En la demo se prende y apaga desde la cinta (Plano / Capas). false: carta plana.
  profundidad: true,

  // ambiente (cada sección): escena = foto del lugar, video = loop sobre negro (assets/ambiente/),
  // videoOpacidad = cuánto se ve el video (0 a 1: el humo denso pide menos, las brasas sueltas más),
  // particulas = brasas · harina · chispas · azucar · burbujas · polvo.
  categorias: [
    { id: "burgers", nombre: "Burgers",    palabra: "BURGERS", estacion: "cocina",
      ambiente: { escena: "assets/ambiente/burgers-escena.jpg", video: "assets/ambiente/burgers.mp4", videoOpacidad: 0.85, escenaOpacidad: 0.42, particulas: "brasas" } },
    { id: "pizzas",  nombre: "Pizzas",     palabra: "PIZZAS",  estacion: "cocina",
      ambiente: { escena: "assets/ambiente/pizzas-escena.jpg", video: "assets/ambiente/pizzas.mp4", videoOpacidad: 0.5, particulas: "harina" } },
    { id: "picar",   nombre: "Para picar", palabra: "PICOTEO", estacion: "cocina",
      ambiente: { escena: "assets/ambiente/picar-escena.jpg", video: "assets/ambiente/picar.mp4", videoOpacidad: 0.42, particulas: "chispas" } },
    { id: "postres", nombre: "Postres",    palabra: "POSTRES", estacion: "cocina",
      ambiente: { escena: "assets/ambiente/postres-escena.jpg", video: "assets/ambiente/postres.mp4", videoOpacidad: 0.6, particulas: "azucar" } },
    { id: "bebidas", nombre: "Bebidas",    palabra: "BEBIDAS", estacion: "barra",
      ambiente: { escena: "assets/ambiente/bebidas-escena.jpg", video: "assets/ambiente/bebidas.mp4", videoOpacidad: 0.32, particulas: "burbujas" } },
  ],

  // color: el color del plato, sacado de lo que tiene (remolacha → magenta, fernet → marrón).
  //   color2 (opcional): un segundo color del plato para los degradés.
  // modelo: cómo se dibuja el plato en 3D.
  //   · { tipo: "...", ... }        → modelado por código (platos3d.js), el de esta demo.
  //   · { archivo: "clasica.glb" }  → el plato real escaneado (próxima etapa).
  platos: [
    {
      id: "clasica", categoria: "burgers", nombre: "La Clásica", precio: 17500, color: "#F08A24",
      descripcion: "Medallón de 180 g smasheado, cheddar, lechuga, tomate, cebolla morada y la salsa de la casa, en pan de papa.",
      sellos: ["El más pedido"],
      modelo: { tipo: "hamburguesa", medallon: "carne", medallones: 1, con: ["lechuga", "tomate", "cebolla"], salsa: "#F3B63F", salsaNombre: "Salsa de la casa" },
      armable: "hamburguesa",
      // El plato héroe (profundidad.js): se arma al llegar (las franjas caen y se ensamblan), echa vapor
      // y a su alrededor flotan ingredientes sueltos a distinta profundidad. x, y: lugar en el
      // escenario (de 0 a 1) · z: menos de 1 detrás del plato, más de 1 delante (más lejos de 1, más
      // desenfocado) · tam: ancho como fracción del escenario · rot/giro: ángulo y cuánto se mece.
      heroe: {
        armado: true,
        vapor: "assets/ambiente/vapor.mp4",
        vaporOpacidad: 0.7,
        escala: 0.84,
        satelites: [
          // detrás del plato (z menor que 1): asoman por las esquinas
          { src: "assets/ambiente/heroe/clasica-cebolla-mitad.webp", x: 0.12, y: 0.12, z: 0.65, tam: 0.28, rot: -20, giro: 9 },
          { src: "assets/ambiente/heroe/clasica-tomate.webp",        x: 0.90, y: 0.16, z: 0.7,  tam: 0.24, rot: 20,  giro: 10 },
          { src: "assets/ambiente/heroe/clasica-pan.webp",           x: 0.08, y: 0.80, z: 0.75, tam: 0.28, rot: -28, giro: 8 },
          { src: "assets/ambiente/heroe/clasica-salsa.webp",         x: 0.88, y: 0.82, z: 0.9,  tam: 0.34, rot: 22,  giro: 4 },
          // delante (z mayor que 1): cruzan el borde del plato, más desenfocados cuanto más cerca de la cámara
          { src: "assets/ambiente/heroe/clasica-lechuga.webp",       x: 0.04, y: 0.50, z: 1.5,  tam: 0.36, rot: -22, giro: 12 },
          { src: "assets/ambiente/heroe/clasica-cheddar-pila.webp",  x: 0.96, y: 0.60, z: 1.35, tam: 0.32, rot: 14,  giro: 8 },
          { src: "assets/ambiente/heroe/clasica-tomate-entero.webp", x: 0.84, y: 0.05, z: 1.8,  tam: 0.30, rot: 22,  giro: 14 },
          { src: "assets/ambiente/heroe/clasica-cebolla.webp",       x: 0.16, y: 0.86, z: 1.4,  tam: 0.22, rot: -10, giro: 11 },
        ],
      },
    },
    {
      id: "doble-bacon", categoria: "burgers", nombre: "Doble Bacon", precio: 21900, color: "#B3261E",
      descripcion: "Dos medallones, doble cheddar, panceta crocante y barbacoa ahumada. Para hambre en serio.",
      sellos: ["Contundente"],
      modelo: { tipo: "hamburguesa", medallon: "carne", medallones: 2, con: [], extras: ["bacon"], salsa: "#7A2A12", salsaNombre: "Barbacoa ahumada" },
      armable: "hamburguesa",
    },
    {
      id: "remolacha", categoria: "burgers", nombre: "La Remolacha", precio: 16800, color: "#C2185B",
      descripcion: "Medallón de remolacha y garbanzos, palta, lechuga, tomate y mayo de albahaca. Cien por ciento vegetal.",
      sellos: ["Veggie"],
      modelo: { tipo: "hamburguesa", medallon: "remolacha", medallones: 1, cheddar: false, pan: "integral", con: ["lechuga", "tomate"], palta: true, salsa: "#A6D65A", salsaNombre: "Mayo de albahaca" },
      armable: "hamburguesa",
    },
    {
      id: "pepperoni", categoria: "pizzas", nombre: "Pepperoni", precio: 19500, color: "#2E9E4F", color2: "#E13A26",
      descripcion: "Masa de fermentación lenta, salsa de tomate, muzzarella y pepperoni que se enrula en el horno. Ocho porciones.",
      sellos: ["Para compartir"],
      modelo: { tipo: "pizza", toppings: ["pepperoni", "albahaca"] },
    },
    {
      id: "fugazzeta", categoria: "pizzas", nombre: "Fugazzeta", precio: 18900, color: "#E6B84A", color2: "#6E8B2F",
      descripcion: "Cebolla dulce en pluma, muzzarella a morir y orégano. La más porteña de todas.",
      sellos: ["De acá"],
      modelo: { tipo: "pizza", toppings: ["cebolla", "oregano"] },
    },
    {
      id: "papas-cheddar", categoria: "picar", nombre: "Papas con cheddar", precio: 11900, color: "#F26B1D",
      descripcion: "Papas rústicas, cheddar fundido y verdeo. Alcanzan para dos, aunque nadie quiera compartir.",
      sellos: ["Para compartir"],
      modelo: { tipo: "papas" },
    },
    {
      id: "aros", categoria: "picar", nombre: "Aros de cebolla", precio: 9800, color: "#7B2D8E",
      descripcion: "De cebolla morada, rebozados en birra: crocantes por fuera y dulces por dentro. Con dip de barbacoa.",
      sellos: [],
      modelo: { tipo: "aros" },
    },
    {
      id: "flan", categoria: "postres", nombre: "Flan casero", precio: 7900, color: "#C0661C",
      descripcion: "Con dulce de leche y crema, como en lo de la abuela.",
      sellos: ["Casero"],
      modelo: { tipo: "flan" },
    },
    {
      id: "helado", categoria: "postres", nombre: "Cucurucho", precio: 8500, color: "#F27BA3", color2: "#A7D37F",
      descripcion: "Tres bochas: dulce de leche, frutilla a la crema y pistacho. Con cereza arriba.",
      sellos: [],
      modelo: { tipo: "helado" },
    },
    {
      id: "cheesecake", categoria: "postres", nombre: "Cheesecake", precio: 9200, color: "#C9173D",
      descripcion: "Porción de cheesecake cremoso con coulis de frutos rojos.",
      sellos: ["Nuevo"],
      modelo: { tipo: "cheesecake" },
    },
    {
      id: "limonada", categoria: "bebidas", nombre: "Limonada", precio: 6500, color: "#C9D82B", color2: "#43C26B",
      descripcion: "Con menta y jengibre, bien fría. Vaso de 500 ml.",
      sellos: ["Sin alcohol"],
      modelo: { tipo: "limonada" },
    },
    {
      id: "ipa", categoria: "bebidas", nombre: "Pinta de IPA", precio: 7800, color: "#E9971A",
      descripcion: "Tirada, bien lupulada y con la espuma justa. 473 ml.",
      sellos: ["Tirada", "+18"],
      modelo: { tipo: "pinta" },
    },
    {
      id: "fernet", categoria: "bebidas", nombre: "Fernet con coca", precio: 9500, color: "#5A2A17", color2: "#D9B98E",
      descripcion: "El de siempre, con hielo y dos dedos de espuma.",
      sellos: ["+18"],
      modelo: { tipo: "fernet" },
    },
  ],

  // Cómo se puede armar cada tipo de plato. El 3D cambia en vivo con cada elección.
  armados: {
    hamburguesa: [
      { id: "medallones", titulo: "Medallones", tipo: "uno", items: [
        { id: 1, nombre: "Simple", precio: 0 },
        { id: 2, nombre: "Doble",  precio: 4200 },
        { id: 3, nombre: "Triple", precio: 8400 },
      ] },
      { id: "sacale", titulo: "Sacale", tipo: "varios", items: [
        { id: "lechuga", nombre: "Lechuga" },
        { id: "tomate",  nombre: "Tomate" },
        { id: "cebolla", nombre: "Cebolla" },
      ] },
      { id: "sumale", titulo: "Sumale", tipo: "varios", items: [
        { id: "bacon",   nombre: "Panceta",       precio: 2400 },
        { id: "huevo",   nombre: "Huevo frito",   precio: 1500 },
        { id: "cheddar", nombre: "Cheddar extra", precio: 1800 },
      ] },
      { id: "punto", titulo: "Punto de la carne", tipo: "uno", items: [
        { id: "jugosa",  nombre: "Jugosa" },
        { id: "a-punto", nombre: "A punto" },
        { id: "cocida",  nombre: "Bien cocida" },
      ] },
    ],
  },
};
