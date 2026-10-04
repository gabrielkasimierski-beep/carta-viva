/* =============================================================================
   CARTA VIVA — los datos del local
   Todo lo que es propio de cada restaurante vive acá: nombre, mesas, la carta, los
   colores de cada plato y cómo se arma cada uno en 3D. Las fotos de los platos (y lo
   marcado en cada una) están en fotos.js. Para otro local se cambian estos dos archivos
   (y más adelante, lo mismo desde el panel).

   MORDISCO ES UN LOCAL FICTICIO: nombre, platos y precios son de ejemplo.
   ============================================================================= */

window.LOCAL = {
  nombre: "La Panera Rosa",
  bajada: "Cocina casera non stop",
  logo: "/assets/logo-local.png",   // marca del local: se muestra en el panel y el login
  // Plan contratado: "basico" (carta QR + ver pedidos), "medio" (+ reportes y club) o
  // "premium" (gestión completa: cocina/barra, estados, PIN y permisos, equipo).
  plan: "premium",
  demo: true,                       // muestra la cinta "demo" y simula al resto del local
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

  categorias: [
    { id: "burgers", nombre: "Burgers",    palabra: "BURGERS", estacion: "cocina" },
    { id: "pizzas",  nombre: "Pizzas",     palabra: "PIZZAS",  estacion: "cocina" },
    { id: "picar",   nombre: "Para picar", palabra: "PICOTEO", estacion: "cocina" },
    { id: "postres", nombre: "Postres",    palabra: "POSTRES", estacion: "cocina" },
    { id: "bebidas", nombre: "Bebidas",    palabra: "BEBIDAS", estacion: "barra" },
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
